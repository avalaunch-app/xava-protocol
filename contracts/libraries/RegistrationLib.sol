// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/IERC20Metadata.sol";

library RegistrationLib {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Round structure
    struct Round {
        uint256 startTime;
        uint256 maxParticipation;
    }

    struct Registration {
        uint256 registrationTimeStarts;
        uint256 registrationTimeEnds;
        uint256 numberOfRegistrants;
        // Registration deposit AVAX, which will be paid during the registration, and returned back during the participation.
        uint256 registrationDepositAVAX;
        // Accounting total AVAX collected, after sale admin can withdraw this
        uint256 registrationFees;
        // Number of users participated in the sale.
        uint256 numberOfParticipants;
    }

    function setTimes(
        Registration storage reg,
        uint256 _registrationTimeStarts,
        uint256 _registrationTimeEnds,
        uint256 firstRoundStartTime,
        uint256 _saleEnd
    ) public {
        require(_registrationTimeEnds < _saleEnd);
        require(_registrationTimeStarts >= block.timestamp && _registrationTimeEnds > _registrationTimeStarts);
        require(_registrationTimeEnds < firstRoundStartTime);

        reg.registrationTimeStarts = _registrationTimeStarts;
        reg.registrationTimeEnds = _registrationTimeEnds;
    }

    function register(Registration storage reg) public {
        require(msg.value == reg.registrationDepositAVAX, "Registration deposit does not match.");
        require(
            block.timestamp >= reg.registrationTimeStarts && block.timestamp <= reg.registrationTimeEnds,
            "Registration gate is closed."
        );
        // Increment number of registered users
        reg.numberOfRegistrants++;
        // Increase earnings from registration fees
        reg.registrationFees = reg.registrationFees.add(msg.value);
    }

    function postponeRound(
        Round storage round,
        uint256 timeToShift,
        uint256 saleEndTime
    ) public {
        // Require that timeToShift does not extend sale over it's end
        uint256 postPonedTime = round.startTime.add(timeToShift);
        require(postPonedTime < saleEndTime, "Start time can not be greater than end time.");
        // Postpone sale
        round.startTime = postPonedTime;
    }

    function extendRegistration(
        Registration storage reg,
        uint256 timeToAdd,
        uint256 firstRoundStartTime
    ) public {
        uint256 extendedTime = reg.registrationTimeEnds.add(timeToAdd);
        require(extendedTime < firstRoundStartTime, "Registration period overflows sale start.");
        reg.registrationTimeEnds = extendedTime;
    }

    function withdrawFee(Registration storage reg, uint256 saleEndTime) public {
        require(block.timestamp >= saleEndTime, "Require that sale has ended.");
        require(reg.registrationFees > 0, "No earnings from registration fees.");
        reg.registrationFees = 0;
    }

    function newParticipation(Registration storage reg) public {
        // Increment number of participants in the Sale.
        reg.numberOfParticipants++;
        // Decrease of available registration fees
        reg.registrationFees = reg.registrationFees.sub(reg.registrationDepositAVAX);
    }

    function performChecksToCloseGate(Registration storage reg) public view {
        // Require that registration times are set
        require(
            reg.registrationTimeStarts != 0 && reg.registrationTimeEnds != 0,
            "closeGate: Registration params not set."
        );
        // add more checks here
    }
}
