//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "./interfaces/IAdmin.sol";
import "./interfaces/ISalesFactory.sol";
import "./interfaces/IAvalaunchSaleV2.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

contract AvalaunchMarketplace is Initializable {

    using SafeMathUpgradeable for uint256;

    // Pointer to sales factory contract
    ISalesFactory public factory;
    // Pointer to admin contract
    IAdmin public admin;
    // Mapping for approved sales
    mapping(address => bool) public officialSales;
    // Mapping for market visible portions
    mapping(address => mapping(address => uint256[])) public userToPortions;

    // Events
    event PortionListed(address portionOwner, address saleAddress, uint256 portionId, uint256 portionPrice);
    event PortionRemoved(address portionOwner, address saleAddress, uint256 portionId);
    event PortionSold(address portionSeller, address portionBuyer, address saleAddress, uint256 portionId, uint256 portionPrice);
    event SaleApproved(address indexed sale, uint256 indexed timestamp);

    // Modifier to receive calls only from official sale contracts
    modifier onlyOfficialSales() {
        require(officialSales[msg.sender], "Only official sales.");
        _;
    }

    function initialize(address _admin, address _factory) external initializer {
        require(_admin != address(0) && _factory != address(0));
        admin = IAdmin(_admin);
        factory = ISalesFactory(_factory);
    }

    /**
     * @notice Function to list user's portions to market
     */
    function listPortions(address owner, uint256[] calldata portions, uint256[] calldata prices) external onlyOfficialSales {
        require(portions.length == prices.length, "Array size mismatch.");
        for(uint i = 0; i < portions.length; i++) {
            uint256 portionId = portions[i];
            require(userToPortions[owner][msg.sender][portionId] == 0, "Portion already listed.");
            userToPortions[owner][msg.sender][portionId] = prices[i];
            emit PortionListed(owner, msg.sender, portionId, prices[i]);
        }
    }

    /**
     * @notice Function to remove portion listing from the market
     */
    function removePortions(address owner, uint256[] calldata portions) external onlyOfficialSales {
        for(uint i = 0; i < portions.length; i++) {
            userToPortions[owner][msg.sender][portions[i]] = 0;
            emit PortionRemoved(owner, msg.sender, portions[i]);
        }
    }

    /**
     * @notice Function to buy portions from market
     */
    function buyPortions(address sale, address owner, uint256[] calldata portions) external payable {
        require(officialSales[sale], "Invalid sale address.");
        // Mark portions as sold on sale contract
        IAvalaunchSaleV2(sale).transferPortions(owner, msg.sender, portions);
        uint256 total;
        for(uint i = 0; i < portions.length; i++) {
            uint256 portionId = portions[i];
            uint256 singlePortionPrice = userToPortions[owner][sale][portionId];
            require(singlePortionPrice > 0, "Portion not buyable.");
            total = total.add(singlePortionPrice);
            delete userToPortions[owner][sale][portionId];
            emit PortionSold(owner, msg.sender, sale, portionId, singlePortionPrice);
        }
        require(msg.value == total, "Invalid AVAX amount sent.");
        // Forward msg.value to portion owner (with message)
        (bool success, ) = owner.call{value: msg.value}(bytes("Your portion(s) just got sold! Greetings from Avalaunch Team :)"));
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
}