pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./math/SafeMath.sol";
import "./interfaces/IAvalaunchSale.sol";
import "./Admin.sol";

contract AvalaunchCollateral is Initializable {

    using SafeMath for *;

    Admin public admin;

    // Accounting total fees collected by the contract
    uint256 public totalFeesCollected;
    // Moderator of the contract.
    address public moderator;
    // Mapping if sale is approved by moderator for the autobuys
    mapping (address => bool) public isSaleApprovedByModerator;
    // User to his collateral balance
    mapping (address => uint256) public userBalance;

    event DepositedCollateral(address wallet, uint256 amountDeposited, uint256 timestamp);
    event WithdrawnCollateral(address wallet, uint256 amountWithdrawn, uint256 timestamp);
    event FeeTaken(address sale, uint256 participationAmount, uint256 feeAmount);
    event ApprovedSale(address sale);

    modifier onlyAdmin {
        require(admin.isAdmin(msg.sender), "Only admin.");
        _;
    }

    modifier onlyModerator {
        require(msg.sender == moderator, "Only moderator.");
        _;
    }

    /**
     * @notice  Initializer - setting initial parameters on the contract
     * @param   _moderator is the address of moderator, which will be used to receive
     *          proceeds from the fees, and has permissions to approve sales for autobuy
     * @param   _admin is the address of Admin contract
     */
    function initialize(address _moderator, address _admin) external initializer {
        require(_moderator != address(0x0), "Moderator can not be 0x0.");
        require(_admin != address(0x0), "Admin can not be 0x0.");
        moderator = _moderator;
        admin = Admin(_admin);
    }

    // Internal function to handle safe transfer
    function safeTransferAVAX(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success);
    }

    /**
     * @notice  Function to collateralize AVAX by user.
     */
    function depositCollateral() external payable {
        userBalance[msg.sender] = userBalance[msg.sender].add(msg.value);
        emit DepositedCollateral(
            msg.sender,
            msg.value,
            block.timestamp
        );
    }

    /**
     * @notice  Function where user can withdraw his collateralized funds from the contract
     * @param   _amount is the amount of AVAX user is willing to withdraw.
     *          It can't exceed his collateralized amount.
     */
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

    /**
     * @notice  Function for auto participation, where admin can participate on user behalf and buy him allocation
     *          by taking funds from his collateral.
     *          Function is restricted only to admins.
     * @param   saleAddress is the address of the sale contract in which admin participates
     * @param   signature is the signature which backend gives as additional safeguard
     * @param   amountAVAX is the amount of AVAX which will be taken from user to get him an allocation.
     * @param   amount is the amount of tokens user is allowed to buy (maximal)
     * @param   amountXavaToBurn is the amount of XAVA which will be taken from user and redistributed across
     *          other Avalaunch stakers
     * @param   roundId is the ID of the round for which participation is being taken.
     * @param   user is the address of user on whose behalf this action is being done.
     * @param   participationFeeAVAX is the FEE amount which is taken by Avalaunch for this service.
     */
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
        // Reduce user balance
        userBalance[msg.sender] = userBalance[msg.sender].sub(amountAVAX.add(participationFeeAVAX));
        // Increase total fees collected
        totalFeesCollected = totalFeesCollected.add(participationFeeAVAX);
        // Transfer AVAX fee immediately to beneficiary
        safeTransferAVAX(moderator, participationFeeAVAX);
        // Trigger event
        emit FeeTaken(saleAddress, amountAVAX, participationFeeAVAX);
        // Participate
        IAvalaunchSale(saleAddress).autoParticipate{
            value: amountAVAX
        }(signature, amount, amountXavaToBurn, roundId, user);
    }

    /**
     * @notice  Function to set new moderator. Can be only called by current moderator
     * @param   _moderator is the address of new moderator to be set.
     */
    function setModerator(address _moderator) onlyModerator external {
        require(_moderator != address(0x0), "Moderator can not be 0x0");
        moderator = _moderator;
    }

    /**
     * @notice  Function to approve sale for AutoBuy feature.
     * @param   saleAddress is the address of the sale contract
     */
    function approveSale(address saleAddress) onlyModerator external {
        // Set that sale is approved by moderator
        isSaleApprovedByModerator[saleAddress] = true;
        // Trigger event
        emit ApprovedSale(saleAddress);
    }

    /**
     * @notice  Function to get total collateralized amount of AVAX by users.
     */
    function getTVL() external view returns (uint256) {
        return address(this).balance;
    }
}
