//"SPDX-License-Identifier: UNLICENSED"
pragma solidity 0.6.12;

interface IAllocationStaking {
    function redistributeXava(uint256 _pid, address _user, uint256 _amountToBurn, uint256 minimalStakeAmount) external;
    function deposited(uint256 _pid, address _user) external view returns (uint256);
}
