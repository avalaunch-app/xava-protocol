pragma solidity ^0.6.12;

import "../IERC20.sol";


contract FarmTokenSwap {

    IERC20 public xavaToken;
    IERC20 public wXavaToken;
    address public xavaFarming;

    modifier onlyXavaFarming {
        require(msg.sender == xavaFarming);
        _;
    }

    event SwappedXavaForWXava(address user, uint amount);
    event SwappedWXavaForXava(address user, uint amount);

    constructor (address _xavaToken, address _wXavaToken, address _xavaFarming) public {
        xavaToken = IERC20(_xavaToken);
        wXavaToken = IERC20(_wXavaToken);
        xavaFarming = _xavaFarming;
    }

    function swapXavaToWXava(
        address user,
        uint amount
    )
    public
    onlyXavaFarming
    {
        xavaToken.transferFrom(user, address(this), amount);
        wXavaToken.transfer(xavaFarming, amount);

        emit SwappedXavaForWXava(user, amount);
    }

    function swapWXavaForXava(
        address user,
        uint amount
    )
    public
    onlyXavaFarming
    {
        wXavaToken.transferFrom(user, address(this), amount);
        xavaToken.transfer(user, amount);

        emit SwappedWXavaForXava(user, amount);
    }

}

