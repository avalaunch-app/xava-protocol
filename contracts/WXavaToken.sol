pragma solidity ^0.6.12;

import "./XavaToken.sol";


contract WXavaToken is XavaToken {

    address public deployer;

    constructor (uint256 totalSupply_, uint8 decimals_)
    public
    XavaToken("Wrapped Xava Token", "WXAVA", totalSupply_, decimals_)
    {
        deployer = msg.sender;
    }
}
