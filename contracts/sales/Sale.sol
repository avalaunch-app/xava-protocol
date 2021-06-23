pragma solidity ^0.6.12;

import "../interfaces/IAdmin.sol";
import "../math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";



contract Sale {

    using ECDSA for bytes32;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Admin contract
    IAdmin admin;
    // Token being sold
    IERC20 public token;

    //TODO
    struct Sale {
        address saleOwner;
        uint256 tokenPrice;
        uint256 amountOfTokensToSell;
        uint256 totalTokensSold;
        uint256 totalAVAXRaised;
        uint256 registrationTimeStarts;
        uint256 saleEnds;
    }

    Sale sale;

    // Address of sale owner
    // This address will deposit tokens and later on claim the earnings from the sale
    address public saleOwner;

    // Token price against AVAX
    uint256 public tokenPriceInAVAX;

    // Total amount of tokens to sell
    uint256 public amountOfTokensToSell;

    // Total amount of tokens being sold
    uint256 public totalTokensSold;

    // Total AVAX raised.
    uint256 public totalAVAXRaised;

    // User to round for which he registered
    mapping (address => uint256) addressToRoundRegisteredFor;

    // mapping if user is participated or not
    mapping (address => bool) public isParticipated;

    // Mapping rounds to start times
    // 1 - 1st July 10am (ends when 2nd starts)
    // 2 - 1st July 12pm (ends when 3rd starts)
    // 3 - 1st July 5pm
    // Sale end

    struct Round {
        uint startTime;
        uint roundId;
        uint maxParticipation;
    }

    Round [] rounds;

    mapping (uint256 => uint256) public roundIdToStartTime;

    // Storing round ids
    uint256 [] roundIds;

    // Mapping round id to maximal participation
    mapping (uint256 => uint256) public roundIdToMaxParticipation;

    // Assuming registration gate is open from the moment contract is deployed
    uint256 public registrationTimeEnds;

    // Public round ending time
    uint256 public saleEnd;

    // Time when users can claim/withdraw the tokens bought
    uint256 public tokensUnlockTime;

    // One ether in weis
    uint256 public constant one = 10**18;

    // Mapping user to his participation
    struct Participation {
        uint256 amount;
        uint256 timestamp;
        uint256 roundId;
        bool isWithdrawn;
    }

    // Mapping user to his participation
    mapping (address => Participation) public userToParticipation;

    // Restricting calls only to sale owner
    modifier onlySaleOwner {
        require(msg.sender == saleOwner, 'OnlySaleOwner:: Restricted');
        _;
    }

    modifier saleSet {
        // TODO: Iterate and make sure all the caps are set
        // TODO: Check that price is updated
        // TODO: Add function to postpone sale by shifting all start times by passed argument in seconds
        // TODO: Extend registration period, making sure it ends at least 24 hrs before 1st round start
    }

    event TokensSold(address user, address saleContract, uint amount);
    event Registration(address user, address saleContract, uint roundId);
    //TODO: Add more events

    constructor() public {
        // TODO: All the param validations are going to be here
    }

    /// @notice     Registration for sale.
    /// @param      signature is the message signed by the backend
    /// @param      roundId is the round for which user expressed interest to participate
    function registerForSale(
        bytes memory signature,
        uint roundId
    )
    public
    {
        require(roundId != 0, "Round ID can not be 0.");
        require(block.timestamp <= registrationTimeEnds, "Registration gate is closed.");
        require(checkRegistrationSignature(signature, msg.sender, roundId), "Invalid signature");
        require(addressToRoundRegisteredFor[msg.sender] == 0, "User can not register twice.");

        // Rounds are 1,2,3
        addressToRoundRegisteredFor[msg.sender] = roundId;

        // Emit Registration event
        emit Registration(msg.sender, address(this), roundId);
    }


    /// @notice     Admin function, to update token price before sale to match the closest $ desired rate.
    function updateTokenPriceInAVAX(uint256 price)
    public
    {
        require(admin.isAdmin(msg.sender));
        require(block.timestamp < roundIdToStartTime[1], "1st round already started.");
        require(price > 0, "Price can not be 0.");
        tokenPriceInAVAX = price;
    }

    /// @notice TODO: Add comments
    function setCapPerRound(uint256[] calldata rounds, uint256[] calldata caps) public {
        require(admin.isAdmin(msg.sender));
        require(block.timestamp < roundIdToStartTime[1], "1st round already started.");
        require(rounds.length == caps.length, "Arrays length is different.");

        for(uint i = 0; i < rounds.length; i++) {
            roundIdToMaxParticipation[rounds[i]] = caps[i];
        }
    }


    // Function for owner to deposit tokens, can be called only once.
    function depositTokens()
    public
    onlySaleOwner
    {
        require(totalTokensSold == 0 && token.balanceOf(address(this)) == 0, "Deposit can be done only once");
        // TODO: Change this to be required before registrations
        require(block.timestamp < roundIdToStartTime[1], "Deposit too late. Round already started.");

        bool success = token.safeTransferFrom(msg.sender, address(this), amountOfTokensToSell);
        require(success, "TransferFrom failed.");
    }


    // Function to participate in the sales
    function participate(
        bytes memory signature,
        uint256 amount,
        uint256 roundId
    )
    external
    payable
    {

        require(roundId != 0, "Round can not be 0.");

        require(amount <= roundIdToMaxParticipation[roundId], "Overflowing maximal participation for this round.");

        // Verify the signature
        require(checkSignature(signature, msg.sender, amount, roundId), "Invalid signature. Verification failed");

        // Check user haven't participated before
        require(isParticipated[msg.sender] == false, "User can participate only once.");

        // Disallow contract calls.
        require(msg.sender == tx.origin, "Only direct contract calls.");


        // Get current active round
        uint256 currentRound = getCurrentRound();

        // Assert that
        require(roundId == currentRound, "You can not participate in this round.");

        // Compute the amount of tokens user is buying
        uint256 amountOfTokensBuying = (msg.value).mul(one).div(tokenPriceInAVAX);

        // Check in terms of user allo
        require(amountOfTokensBuying <= amount, "Trying to buy more than allowed.");

        // Increase amount of sold tokens
        totalTokensSold = totalTokensSold.add(amountOfTokensBuying);

        // Increase amount of AVAX raised
        totalAVAXRaised = totalAVAXRaised.add(msg.value);

        // Create participation object
        Participation memory p = Participation({
            amount: amountOfTokensBuying,
            timestamp: block.timestamp,
            roundId: roundId,
            isWithdrawn: false
        });

        // Add participation for user.
        userToParticipation[msg.sender] = p;

        // Mark user is participated
        isParticipated[msg.sender] = true;

        // Fire event
        //TODO: Improve event
        emit TokensSold(msg.sender, address(this), amountOfTokensBuying);
    }


    /// Users can claim their participation
    function withdrawTokens() public {
        require(block.timestamp >= tokensUnlockTime, "Tokens can not be withdrawn yet.");

        Participation memory p = userToParticipation[msg.sender];

        if(!p.isWithdrawn) {
            p.isWithdrawn = true;
            token.safeTransfer(msg.sender, p.amount);
        } else {
            revert("Tokens already withdrawn.");
        }
    }


    // Internal function to handle safe transfer
    function safeTransferAVAX(
        address to,
        uint value
    )
    internal
    {
        (bool success,) = to.call{value:value}(new bytes(0));
        require(success, 'TransferHelper: AVAX_TRANSFER_FAILED');
    }


    /// Function to withdraw all the earnings and the leftover of the sale contract.
    function withdrawEarningsAndLeftover(
        bool withBurn
    )
    external
    onlySaleOwner
    {
        // Make sure sale ended
        require(block.timestamp >= saleEnd);

        // Earnings amount of the owner in AVAX
        uint totalProfit = address(this).balance;

        // Amount of tokens which are not sold
        uint leftover = amountOfTokensToSell.sub(totalTokensSold);
        // TODO: Add an option to burn leftover

        safeTransferAVAX(msg.sender, totalProfit);

        if(leftover > 0 && !withBurn) {
            token.safeTransfer(msg.sender, leftover);
            return;
        }

        if(withBurn) {
            token.safeTransfer(address(1), leftover);
        }
    }

    /// @notice     Get current round in progress.
    ///             If 0 is returned, means sale didn't start or it's ended.
    function getCurrentRound() public view returns (uint) {
        if(block.timestamp >= roundIdToStartTime[1] && block.timestamp < roundIdToStartTime[2]) {
            return 1; // means staking round is active
        } else if (block.timestamp >= roundIdToStartTime[2] && block.timestamp < roundIdToStartTime[3]) {
            return 2; // means validator round is active
        } else if (block.timestamp > roundIdToStartTime[3] && block.timestamp < saleEnd) {
            return 3; // means public round is active
        }
        return 0; // means sale is ended or haven't started yet
    }

    /// @notice     Check signature user submits for registration.
    /// @param      signature is the message signed by the trusted entity (backend)
    /// @param      user is the address of user which is registering for sale
    /// @param      roundId is the round for which user is submitting registration
    function checkRegistrationSignature(bytes memory signature, address user, uint256 roundId) public view returns (bool) {
        bytes32 hash = keccak256(abi.encodePacked(user, roundId, address(this)));
        bytes32 messageHash = hash.toEthSignedMessageHash();
        return admin.isAdmin(messageHash.recover(signature));
    }


    // Function to check if admin was the message signer
    function checkSignature(bytes memory signature, address user, uint256 amount, uint256 round) public view returns (bool) {
        return admin.isAdmin(getParticipationSigner(signature, user, amount, round));
    }


    /// @notice     Check who signed the message
    /// @param      signature is the message allowing user to participate in sale
    /// @param      user is the address of user for which we're signing the message
    /// @param      amount is the maximal amount of tokens user can buy
    /// @param      roundId is the Id of the round user is participating.
    function getParticipationSigner(bytes memory signature, address user, uint256 amount, uint256 roundId) public pure returns (address) {
        bytes32 hash = keccak256(abi.encodePacked(user, amount, roundId));
        bytes32 messageHash = hash.toEthSignedMessageHash();
        return messageHash.recover(signature);
    }

    function getParticipation(address _user) external view returns (uint, uint, uint, bool) {
        //TODO...
    }

}
