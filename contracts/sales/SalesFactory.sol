// "SPDX-License-Identifier: UNLICENSED"
pragma solidity 0.6.12;

import "../interfaces/IAdmin.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract SalesFactory {

    // Admin contract
    IAdmin public admin;
    // Allocation staking contract address
    address public allocationStaking;

    // Official sale creation flag
    mapping (address => bool) public isSaleCreatedThroughFactory;
    // Mapping sale owner to sale address
    mapping(address => address) public saleOwnerToSale;
    // Mapping token to sale address
    mapping(address => address) public tokenToSale;
    // Expose so query can be possible only by position as well
    address [] public allSales;
    // Latest sale implementation contract address
    address implementation;

    // Events
    event SaleDeployed(address saleContract);
    event SaleOwnerAndTokenSetInFactory(address sale, address saleOwner, address saleToken);
    event ImplementationChanged(address implementation);

    // Restricting calls only to sale admin
    modifier onlyAdmin {
        require(admin.isAdmin(msg.sender), "Only Admin can deploy sales");
        _;
    }

    constructor (address _adminContract, address _allocationStaking) public {
        admin = IAdmin(_adminContract);
        allocationStaking = _allocationStaking;
    }

    /// @notice     Set allocation staking contract address
    function setAllocationStaking(address _allocationStaking) public onlyAdmin {
        require(_allocationStaking != address(0));
        allocationStaking = _allocationStaking;
    }

    /// @notice     Admin function to deploy a new sale
    function deploySale()
    external
    onlyAdmin
    {
        // Deploy sale clone
        address sale = Clones.clone(implementation);

        // Initialize sale
        (bool success, ) = sale.call(abi.encodeWithSignature("initialize(address,address)", address(admin), allocationStaking));
        require(success, "Initialization failed.");

        // Mark sale as created through official factory
        isSaleCreatedThroughFactory[sale] = true;
        // Add sale to allSales
        allSales.push(sale);

        // Emit relevant event
        emit SaleDeployed(sale);
    }

    /// @notice     Function to return number of pools deployed
    function getNumberOfSalesDeployed() external view returns (uint) {
        return allSales.length;
    }

    /// @notice     Get most recently deployed sale
    function getLastDeployedSale() external view returns (address) {
        if(allSales.length > 0) {
            // Return the sale address
            return allSales[allSales.length - 1];
        }
        return address(0);
    }

    /// @notice     Function to get all sales between indexes
    function getAllSales(uint startIndex, uint endIndex) external view returns (address[] memory) {
        // Require valid index input
        require(endIndex > startIndex, "Invalid index range.");

        // Create new array for sale addresses
        address[] memory sales = new address[](endIndex - startIndex);
        uint index = 0;

        // Fill the array with sale addresses
        for(uint i = startIndex; i < endIndex; i++) {
            sales[index] = allSales[i];
            index++;
        }

        return sales;
    }

    /// @notice     Function to set the latest sale implementation contract
    function setImplementation(address _implementation) external onlyAdmin {
        require(
            _implementation != implementation,
            "Given implementation is same as current."
        );
        implementation = _implementation;
        emit ImplementationChanged(implementation);
    }
}
