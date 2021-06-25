// "SPDX-License-Identifier: UNLICENSED"
pragma solidity 0.6.12;

import "../interfaces/IAdmin.sol";
import "./AvalaunchSale.sol";


contract SalesFactory {

    IAdmin public admin;

    mapping (address => bool) public isSaleCreatedThroughFactory;

    mapping(address => address) public saleOwnerToSale;
    mapping(address => address) public tokenToSale;

    // Expose so query can be possible only by position as well
    address [] public allSales;

    event SaleDeployed(address saleContract);
    event SaleOwnerAndTokenSetInFactory(address sale, address saleOwner, address saleToken);

    modifier onlyAdmin {
        require(admin.isAdmin(msg.sender), "Only Admin can deploy sales");
        _;
    }

    constructor (address _adminContract) public {
        admin = IAdmin(_adminContract);
    }

    function deploySale()
    external
    onlyAdmin
    {
        AvalaunchSale sale = new AvalaunchSale(address(admin));

        isSaleCreatedThroughFactory[address(sale)] = true;
        allSales.push(address(sale));

        emit SaleDeployed(address(sale));
    }

    // Function to set owner and token for the sale
    function setSaleOwnerAndToken(address saleOwner, address saleToken) external {
        require(isSaleCreatedThroughFactory[msg.sender] == true);
        require(saleOwnerToSale[saleOwner] == address(0));
        require(tokenToSale[saleToken] == address(0));
        // Set owner of the sale.
        saleOwnerToSale[saleOwner] = msg.sender;
        // Set token to sale
        tokenToSale[saleToken] = msg.sender;
        // Emit event
        emit SaleOwnerAndTokenSetInFactory(msg.sender, saleOwner, saleToken);
    }

    // Function to return number of pools deployed
    function getNumberOfSalesDeployed() external view returns (uint) {
        return allSales.length;
    }


    // Function to get all sales
    function getAllSales(uint startIndex, uint endIndex) external view returns (address[] memory) {
        require(endIndex > startIndex, "Bad input");

        address[] memory sales = new address[](endIndex - startIndex);
        uint index = 0;

        for(uint i = startIndex; i < endIndex; i++) {
            sales[index] = allSales[i];
            index++;
        }

        return sales;
    }

}
