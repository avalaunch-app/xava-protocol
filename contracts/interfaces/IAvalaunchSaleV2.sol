// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

interface IAvalaunchSaleV2 {
    function transferPortions(address seller, address buyer, uint256[] calldata portions) external;
    function numberOfVestedPortions() external view returns (uint256);
}
