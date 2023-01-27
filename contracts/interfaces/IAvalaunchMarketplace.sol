// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

interface IAvalaunchMarketplace {
    function listPortions(address owner, uint256[] calldata portions) external;
    function removePortions(address owner, uint256[] calldata portions) external;
    function approveSale(address sale) external;
}