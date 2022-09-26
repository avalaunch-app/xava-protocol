//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "./interfaces/IAdmin.sol";
import "./interfaces/ISalesFactory.sol";
import "./interfaces/IAvalaunchSaleV2.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

contract AvalaunchMarketplace is Initializable {

    using SafeMathUpgradeable for uint256;
    using ECDSAUpgradeable for bytes32;

    // Pointer to sales factory contract
    ISalesFactory public factory;
    // Pointer to admin contract
    IAdmin public admin;
    // Fee percent taken from sold portions
    uint256 public feePercentage;
    // Fee precision
    uint256 public feePrecision;
    // Total fees ever collected
    uint256 public totalFeesCollected;
    // Mapping for approved sales
    mapping(address => bool) public officialSales;
    // Mapping for market visible portions
    mapping(address => mapping(address => bool[])) public listedUserPortionsPerSale;

    // Events
    event PortionListed(address portionOwner, address saleAddress, uint256 portionId);
    event PortionRemoved(address portionOwner, address saleAddress, uint256 portionId);
    event PortionSold(address portionSeller, address portionBuyer, address saleAddress, uint256 portionId, uint256 portionPrice);
    event SaleApproved(address indexed sale, uint256 indexed timestamp);

    // Modifier to receive calls only from official sale contracts
    modifier onlyOfficialSales() {
        require(officialSales[msg.sender], "Only official sales.");
        _;
    }

    // Restricting calls only to sale admin
    modifier onlyAdmin() {
        require(admin.isAdmin(msg.sender), "Only admin.");
        _;
    }

    function initialize(address _admin, address _factory, uint256 _feePercentage, uint256 _feePrecision) external initializer {
        require(_admin != address(0) && _factory != address(0));
        require(_feePercentage > 0 && _feePercentage < _feePrecision && _feePrecision >= 100);
        admin = IAdmin(_admin);
        factory = ISalesFactory(_factory);
        feePercentage = _feePercentage;
        feePrecision = _feePrecision;
    }

    /**
     * @notice Function to list user's portions to market
     * @param owner is user who wants to list portions
     * @param portions are portion ids of portions user wants to sell
     * @dev approved sale contract is calling marketplace to list user's portions
     * * After portion is listed, its price is changeable without contract interaction and will be saved on backend
     * * Portion prices are later checked on buy function with admin provided expirable signature
     */
    function listPortions(address owner, uint256[] calldata portions) external onlyOfficialSales {
        if (listedUserPortionsPerSale[owner][msg.sender].length == 0 ) {
            uint256 numberOfVestedPortions = IAvalaunchSaleV2(msg.sender).numberOfVestedPortions();
            for (uint i = 0; i < numberOfVestedPortions; i++) {
                listedUserPortionsPerSale[owner][msg.sender].push(false);
            }
        }
        for (uint i = 0; i < portions.length; i++) {
            uint256 portionId = portions[i];
            require(listedUserPortionsPerSale[owner][msg.sender][portionId] == false, "Portion already listed.");
            listedUserPortionsPerSale[owner][msg.sender][portionId] = true;
            emit PortionListed(owner, msg.sender, portionId);
        }
    }

    /**
     * @notice Function to remove portion listing from the market
     */
    function removePortions(address owner, uint256[] calldata portions) external onlyOfficialSales {
        for(uint i = 0; i < portions.length; i++) {
            delete listedUserPortionsPerSale[owner][msg.sender][portions[i]];
            emit PortionRemoved(owner, msg.sender, portions[i]);
        }
    }

    /**
     * @notice Function to buy portions from market
     * @param sale is Avalaunch sale where portions are from
     * @param owner is account which owns the portions
     * @param sigExpTimestamp is signature expiration timestamp
     * @param portions is array of portion ids function caller wants to buy
     * @param prices is array of price values for portions
     * @param signature is admin signed data hash which confirms validity of action
     */
    function buyPortions(
        address sale,
        address owner,
        uint256 sigExpTimestamp,
        uint256[] calldata portions,
        uint256[] calldata prices,
        bytes calldata signature
    ) external payable {
        require(officialSales[sale], "Invalid sale address.");
        bytes32 msgHash = keccak256(abi.encodePacked(owner, sale, portions, prices, sigExpTimestamp, "buyPortions"));
        // Make sure provided signature is signed by admin and containing valid data
        verifySignature(msgHash, signature);
        // Make sure signature is used in a valid timeframe
        require(block.timestamp <= sigExpTimestamp, "Signature expired.");
        // Mark portions as sold on sale contract
        IAvalaunchSaleV2(sale).transferPortions(owner, msg.sender, portions);
        uint256 total;
        // Compute total amount to be paid for selected portions
        for(uint i = 0; i < portions.length; i++) {
            uint256 portionId = portions[i];
            // Make sure portion is for sale
            require(listedUserPortionsPerSale[owner][sale][portionId] == true, "Portion not for sale.");
            total = total.add(prices[i]);
            // Mark portion as 'not for sale'
            listedUserPortionsPerSale[owner][sale][portionId] = false;
            // Trigger relevant event
            emit PortionSold(owner, msg.sender, sale, portionId, prices[i]);
        }
        require(msg.value == total, "Invalid AVAX amount sent.");
        // Compute fee amount
        uint256 feeAmount = msg.value.mul(feePercentage).div(feePrecision);
        // Increase total fees collected
        totalFeesCollected += feeAmount;
        // Forward msg.value to portion owner (with message)
        (bool success, ) = owner.call{value: msg.value - feeAmount}(
            bytes("Your portion(s) just got sold! Greetings from Avalaunch Team :)")
        );
        require(success);
    }

    /**
     * @notice Function to withdraw $AVAX from contract
     * @dev $AVAX is accumulated from sold portion fees
     */
    function withdrawAVAX() external onlyAdmin {
        require(address(this).balance != 0);
        (bool success, ) = msg.sender.call{value: address(this).balance}("");
        require(success);
    }

    /**
     * @notice Function to approve sale/mark it as official
     */
    function approveSale(address sale) external {
        require(msg.sender == address(factory) || admin.isAdmin(msg.sender), "Only authorized calls.");
        officialSales[sale] = true;
        emit SaleApproved(sale, block.timestamp);
    }

    /**
     * @notice Function to verify admin signed signatures
     */
    function verifySignature(bytes32 hash, bytes memory signature) internal view {
        require(
            admin.isAdmin(hash.toEthSignedMessageHash().recover(signature)),
            "Invalid signature."
        );
    }

    /**
     * @notice Function to set new factory contract
     */
    function setFactory(address _factory) external onlyAdmin {
        require(_factory != address(factory) && _factory != address(0));
        factory = ISalesFactory(_factory);
    }

    /**
     * @notice Function to set new fee parameters
     */
    function setFeeParams(uint256 _percentage, uint256 _precision) external onlyAdmin {
        require(_percentage > 0 && _percentage < _precision && _precision >= 100);
        feePercentage = _percentage;
        feePrecision = _precision;
    }
}
