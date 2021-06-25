pragma solidity ^0.6.12;

import "../interfaces/IAdmin.sol";


contract SalesFactory {

    address [] public allSales;
    mapping (address => bool) isSaleCreatedThroughFactory;

    IAdmin public admin;

    mapping(address => address) public projectOwnerToSaleContractAddress;

    modifier onlyAdmin {
        require(admin.isAdmin(msg.sender), "Only Admin can deploy sales");
        _;
    }

    // TODO: Add events
    // TODO: Add lookup per sale state (add all passed sales, active sales, upcoming sales)
    // TODO: Add lookup per token sold
    constructor (address _adminContract) public {
        admin = IAdmin(_adminContract);
    }

//    function deploySale(
//        uint256 tokensForSale,
//        uint256 communityRoundPercent,
//        uint256 validatorsRoundPercent,
//        uint256 tokenPriceInAvax
//    )
//    external
//    onlyAdmin
//    {
//        require(tokensForSale > 0, "Tokens for sale must be > 0");
//        require(communityRoundPercent <= 100, "Community round percent overflow");
//        require(validatorsRoundPercent <= 100, "Community round percent overflow");
//        require(tokenPriceInAvax > 0, "Token price must be > 0");
//
//    }

    // Function to return number of pools deployed
    function getNumberOfSalesDeployed() external view returns (uint) {
        return allSales.length;
    }


    //TODO: Add start and end index
    function getAllSales() external view returns (address[] memory) {
        return allSales;
    }

}
