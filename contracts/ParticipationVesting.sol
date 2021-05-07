//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "./math/SafeMath.sol";
import "./IERC20.sol";

/// ParticipationVesting smart contract
contract ParticipationVesting  {

    using SafeMath for *;

    struct Participation {
        uint256 participationAmount;
        uint256 amountPerPortion;
        bool [] isPortionWithdrawn;
    }

    IERC20 public token;

    address public adminWallet;
    mapping(address => Participation) public addressToParticipation;
    mapping(address => bool) public hasParticipated;

    uint public numberOfPortions;
    uint [] public distributionDates;

    modifier onlyAdmin {
        require(msg.sender == adminWallet, "OnlyAdmin: Restricted access.");
        _;
    }

    /// Load initial distribution dates
    constructor (
        uint _numberOfPortions,
        uint timeBetweenPortions,
        uint distributionStartDate,
        address _adminWallet,
        address _token
    )
    public
    {
        // Set admin wallet
        adminWallet = _adminWallet;
        // Store number of portions
        numberOfPortions = _numberOfPortions;
        // Set distribution dates
        for(uint i = 0 ; i < _numberOfPortions; i++) {
            distributionDates.push(distributionStartDate + i*timeBetweenPortions);
        }
        // Set the token address
        token = IERC20(_token);
    }

    /// Register participant
    function registerParticipant(
        address participant,
        uint participationAmount
    )
    public
    onlyAdmin
    {
        require(hasParticipated[participant] == false, "User already registered as participant.");
        // Compute amount per portion
        uint portionAmount = participationAmount.div(numberOfPortions);

        bool[] memory isPortionWithdrawn = new bool[](numberOfPortions);

        // Create new participation object
        Participation memory p = Participation({
            participationAmount: participationAmount,
            amountPerPortion: portionAmount,
            isPortionWithdrawn: isPortionWithdrawn
        });

        // Map user and his participation
        addressToParticipation[participant] = p;
        // Mark that user have participated
        hasParticipated[participant] = true;
    }

    // User will always withdraw everything available
    function withdraw()
    public
    {
        address user = msg.sender;
        require(hasParticipated[user] == true, "Withdraw: User is not a participant.");

        Participation storage p = addressToParticipation[user];
        uint256 totalToWithdraw = 0;

        uint i = 0;

        while (isPortionUnlocked(i) == true && i < distributionDates.length) {
            // If portion is not withdrawn
            if(!p.isPortionWithdrawn[i]) {
                // Add this portion to withdraw amount
                totalToWithdraw = totalToWithdraw.add(p.amountPerPortion);

                // Mark portion as withdrawn
                p.isPortionWithdrawn[i] = true;
            }
            // Increment counter
            i++;
        }

        // Transfer all tokens to user
        token.transfer(user, totalToWithdraw);
    }

    function isPortionUnlocked(uint portionId)
    public
    view
    returns (bool)
    {
        return block.timestamp >= distributionDates[portionId];
    }

}
