pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./math/SafeMath.sol";
import "./interfaces/IAvalaunchSale.sol";
import "./Admin.sol";

contract AvalaunchCollateral is Initializable {

    using SafeMath for *;

    Admin public admin;

    struct Fee {
        uint256 totalCollected;
        uint256 totalWithdrawn;
    }

    Fee public fee;
    address public beneficiary;
    mapping (address => uint256) public userBalance;

    event DepositedCollateral(address wallet, uint256 amountDeposited, uint256 timestamp);
    event WithdrawnCollateral(address wallet, uint256 amountWithdrawn, uint256 timestamp);
    event FeeTaken(address sale, uint256 participationAmount, uint256 feeAmount);

    modifier onlyAdmin {
        require(admin.isAdmin(msg.sender), "Only admin.");
        _;
    }

    function initialize(address _beneficiary, address _admin) external initializer {
        require(_beneficiary != address(0x0));
        beneficiary = _beneficiary;
        admin = Admin(_admin);
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

    function autoParticipate(
        address saleAddress,
        bytes calldata signature,
        uint256 amountAVAX,
        uint256 amount,
        uint256 amountXavaToBurn,
        uint256 roundId,
        address user,
        uint256 participationFeeAVAX
    )
    external
    onlyAdmin
    {
        require(amountAVAX.add(participationFeeAVAX) >= userBalance[user], "Not enough collateral.");
        userBalance[msg.sender] = userBalance[msg.sender].sub(amountAVAX.add(participationFeeAVAX));

        // TODO: Add verification layer that sale is verified, and supports autobuy
        // Increase participation fee
        fee.totalCollected = fee.totalCollected.add(participationFeeAVAX);

        // Participate
        IAvalaunchSale(saleAddress).autoParticipate{
            value: amountAVAX
        }(signature, amount, amountXavaToBurn, roundId, user);

        // Trigger event
        emit FeeTaken(saleAddress, amountAVAX, participationFeeAVAX);
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
