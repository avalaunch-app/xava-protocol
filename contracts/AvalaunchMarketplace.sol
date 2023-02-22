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
    // Total market traded volume
    uint256 public totalVolumeTraded;
    // Mapping for approved sales
    mapping(address => bool) public officialSales;
    // Mapping for market visible portions
    mapping(address => mapping(address => bool[])) public listedUserPortionsPerSale;
    // Message usage mapping
    mapping(bytes32 => bool) public isMsgHashUsed;
    // Maximum fee percentage value
    uint256 public constant MAX_FEE = 5;

    // Events
    event PortionListed(address indexed portionOwner, address indexed saleAddress, uint256 portionId);
    event PortionRemoved(address indexed portionOwner, address indexed saleAddress, uint256 portionId);
    event PortionSold(address indexed portionSeller, address indexed portionBuyer, address indexed saleAddress, uint256 portionId);
    event SaleApproved(address indexed sale);
    event ApprovedSaleRemoved(address indexed sale);
    event FactorySet(ISalesFactory indexed factory);
    event FeeParamsSet(uint256 percentage, uint256 precision);

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

    constructor() public initializer {}

    function initialize(IAdmin _admin, ISalesFactory _factory, uint256 _feePercentage, uint256 _feePrecision) external initializer {
        require(address(_admin) != address(0) && address(_factory) != address(0));
        admin = _admin;
        factory = _factory;
        _setFeeParams(_feePercentage, _feePrecision);
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
     * @param priceSum is sum of all portion prices
     * @param itemId is unique identifier of marketplace item
     * @param signature is admin signed data hash which confirms validity of action
     */
    function buyPortions(
        address sale,
        address owner,
        uint256 sigExpTimestamp,
        uint256 priceSum,
        uint256 itemId,
        uint256[] calldata portions,
        bytes calldata signature
    ) external payable {
        // Require that sale address provided is approved by moderator
        require(officialSales[sale], "Invalid sale address.");
        // Disable user from buying his own listed sale
        require(address(msg.sender) != owner, "Can't purchase your own portions.");
        {
            // Compute signed message hash
            bytes32 msgHash = keccak256(abi.encodePacked(owner, msg.sender/*buyer*/, sale, portions, priceSum, itemId, sigExpTimestamp, "buyPortions"));
            // Make sure provided signature is signed by admin and containing valid data
            verifySignature(msgHash, signature);
        }
        // Make sure signature is used in a valid timeframe
        require(block.timestamp <= sigExpTimestamp, "Signature expired.");
        // Require that msg.value is matching sum of all portion prices
        require(msg.value == priceSum, "Invalid AVAX amount sent.");
        // Delist portions from marketplace
        for(uint i = 0; i < portions.length; i++) {
            uint256 portionId = portions[i];
            // Make sure portion is listed
            require(listedUserPortionsPerSale[owner][sale][portionId] == true, "Portion not listed.");
            // Delist portion
            delete listedUserPortionsPerSale[owner][sale][portionId];
            // Trigger relevant event
            emit PortionSold(owner, msg.sender, sale, portionId);
        }
        // Increase traded volume
        totalVolumeTraded += msg.value;
        // Compute fee amount
        uint256 feeAmount = msg.value.mul(feePercentage).div(feePrecision);
        // Increase total fees collected
        totalFeesCollected += feeAmount;
        // Make portion transfer state changes on sale contract
        IAvalaunchSaleV2(sale).transferPortions(owner, msg.sender, portions);
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
        emit SaleApproved(sale);
    }

    /**
     * @notice Function to remove sale from approved sales
     */
    function removeApprovedSale(address sale) external onlyAdmin {
        require(officialSales[sale], "Sale not approved.");
        delete officialSales[sale];
        emit ApprovedSaleRemoved(sale);
    }

    /**
     * @notice Function to verify admin signed signatures
     */
    function verifySignature(bytes32 hash, bytes memory signature) internal {
        // Check if message hash is already used
        require(!isMsgHashUsed[hash], "Message already used.");
        // Check if message signer is admin
        require(
            admin.isAdmin(hash.toEthSignedMessageHash().recover(signature)),
            "Invalid signature."
        );
        // Mark hash as used
        isMsgHashUsed[hash] = true;
    }

    /**
     * @notice Function to set new factory contract
     */
    function setFactory(ISalesFactory _factory) external onlyAdmin {
        require(address(_factory) != address(factory) && address(_factory) != address(0));
        factory = _factory;
        emit FactorySet(_factory);
    }

    /**
     * @notice Function to set new fee parameters by admin
     */
    function setFeeParams(uint256 _percentage, uint256 _precision) external onlyAdmin {
        _setFeeParams(_percentage, _precision);
    }

    /**
     * @notice Internal function to set new fee parameters
     */
    function _setFeeParams(uint256 _percentage, uint256 _precision) internal {
        require(_percentage > 0 && _percentage < _precision && _precision >= 100);
        require(_percentage * 100 / _precision < MAX_FEE);
        feePercentage = _percentage;
        feePrecision = _precision;
        emit FeeParamsSet(_percentage, _precision);
    }
}
