pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";

contract AvalaunchCollateral is Initializable {

    function initialize() external initializer {

    }

    function depositCollateral() external payable {

    }

    function withdrawCollateral() external payable {

    }

    function totalBalance() external view returns (uint256) {
        return address(this).balance;
    }
}