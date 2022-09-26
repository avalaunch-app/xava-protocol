// "SPDX-License-Identifier: UNLICENSED"
pragma solidity 0.6.12;

import "../interfaces/IAdmin.sol";
import "../interfaces/IAvalaunchMarketplace.sol";

contract SalesFactory {

    // Admin contract
    IAdmin public admin;
    // Marketplace contract address
    IAvalaunchMarketplace public marketplace;
    // Allocation staking contract address
    address public allocationStaking;
    // Collateral contract address
    address public collateral;
    // Moderator wallet address
    address public moderator;
    // Official sale creation flag
    mapping (address => bool) public isSaleCreatedThroughFactory;
    // Expose so query can be possible only by position as well
    address [] public allSales;
    // Latest sale implementation contract address
    address public implementation;

    // Events
    event SaleDeployed(address saleContract);
    event ImplementationChanged(address implementation);

    // Restricting calls only to sale admin
    modifier onlyAdmin {
        require(admin.isAdmin(msg.sender), "Only Admin can deploy sales");
        _;
    }

    constructor(
        address _adminContract,
        address _allocationStaking,
        address _collateral,
        address _marketplace,
        address _moderator
    ) public {
        require(_adminContract != address(0));
        require(_collateral != address(0));
        require(_moderator != address(0));

        admin = IAdmin(_adminContract);
        marketplace = IAvalaunchMarketplace(_marketplace);
        allocationStaking = _allocationStaking;
        collateral = _collateral;
        moderator = _moderator;
    }

    /// @notice     Set allocation staking contract address
    function setAllocationStaking(address _allocationStaking) external onlyAdmin {
        require(_allocationStaking != address(0));
        allocationStaking = _allocationStaking;
    }

    /// @notice     Set official marketplace contract
    function setAvalaunchMarketplace(address _marketplace) external onlyAdmin {
        require(_marketplace != address(0));
        marketplace = IAvalaunchMarketplace(_marketplace);
    }

    /// @notice     Admin function to deploy a new sale
    function deploySale() external onlyAdmin {
        // Require that implementation is set
        require(implementation != address(0), "Sale implementation not set.");

        // Deploy sale clone
        address sale;
        // Inline assembly works only with local vars
        address imp = implementation;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, imp))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            sale := create(0, ptr, 0x37)
        }

        // Require that sale was created
        require(sale != address(0), "Sale creation failed.");

        // Initialize sale
        (bool success, ) = sale.call(
            abi.encodeWithSignature(
                "initialize(address,address,address,address,address)",
                address(admin), allocationStaking, collateral, address(marketplace), moderator
            )
        );
        require(success, "Initialization failed.");

        // Mark sale as created through official factory
        isSaleCreatedThroughFactory[sale] = true;
        // Approve sale on marketplace
        marketplace.approveSale(sale);
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
        if(allSales.length > 0) return allSales[allSales.length - 1];
        // Return zero address if no sales were deployed
        return address(0);
    }

    /// @notice     Function to get all sales between indexes
    function getAllSales(uint startIndex, uint endIndex) external view returns (address[] memory) {
        // Require valid index input
        require(endIndex >= startIndex && endIndex <= allSales.length, "Invalid index range.");
        // Create new array for sale addresses
        address[] memory sales = new address[](endIndex - startIndex + 1);
        uint index = 0;
        // Fill the array with sale addresses
        for(uint i = startIndex; i <= endIndex; i++) {
            sales[index] = allSales[i];
            index++;
        }
        return sales;
    }

    /// @notice     Function to set the latest sale implementation contract
    function setImplementation(address _implementation) external onlyAdmin {
        // Require that implementation is different from current one
        require(
            _implementation != implementation,
            "Given implementation is same as current."
        );
        // Set new implementation
        implementation = _implementation;
        // Emit relevant event
        emit ImplementationChanged(implementation);
    }
}
