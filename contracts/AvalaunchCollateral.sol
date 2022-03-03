pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./math/SafeMath.sol";

contract AvalaunchCollateral is Initializable {

    using SafeMath for *;

    struct Fee {
        uint256 totalCollected;
        uint256 totalWithdrawn;
    }

    Fee public fee;
    address public beneficiary;
    mapping (address => uint256) public userBalance;

    event DepositedCollateral(address wallet, uint256 amountDeposited, uint256 timestamp);
    event WithdrawnCollateral(address wallet, uint256 amountWithdrawn, uint256 timestamp);


    function initialize(address _beneficiary) external initializer {
        require(_beneficiary != address(0x0));
        beneficiary = _beneficiary;
    }

    // Internal function to handle safe transfer
    function safeTransferAVAX(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success);
    }

    function depositCollateral() external payable {
        userBalance[msg.sender] = userBalance[msg.sender].add(msg.value);
        emit DepositedCollateral(
            msg.sender,
            msg.value,
            block.timestamp
        );
    }

    function withdrawCollateral(uint256 _amount) external {
        require(userBalance[msg.sender] >= _amount, "Not enough funds.");

        userBalance[msg.sender] = userBalance[msg.sender].sub(_amount);
        safeTransferAVAX(msg.sender, _amount);

        emit WithdrawnCollateral(
            msg.sender,
            _amount,
            block.timestamp
        );
    }

    function getTVL() external view returns (uint256) {
        return address(this).balance;
    }

    function getTotalFeesCollected() external view returns (uint256) {
        return fee.totalCollected;
    }

    function getTotalFeesWithdrawn() external view returns (uint256) {
        return fee.totalWithdrawn;
    }

    function getTotalFeesAvailable() external view returns (uint256) {
        return fee.totalCollected.sub(fee.totalWithdrawn);
    }


}
