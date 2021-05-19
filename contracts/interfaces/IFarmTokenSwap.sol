pragma solidity ^0.6.12;

interface IFarmTokenSwap {
    function swapXavaToWXava(address user, uint amount) external;
    function swapWXavaForXava(address user, uint amount) external;
}
