// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

interface ICollateral {
    function depositCollateral() external payable;
    function withdrawCollateral() external payable;
    function totalBalance() external view returns (uint256);
}