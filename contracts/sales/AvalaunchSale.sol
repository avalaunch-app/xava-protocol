//"SPDX-License-Identifier: UNLICENSED"
pragma solidity 0.6.12;

import "../interfaces/IAdmin.sol";
import "../interfaces/ISalesFactory.sol";
import "../interfaces/IAllocationStaking.sol";
import "../interfaces/IERC20Metadata.sol";
import "../interfaces/IDexalotPortfolio.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./SaleVault.sol";

contract AvalaunchSale is Initializable {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Pointer to Allocation staking contract, where burnXavaFromUser will be called.
    IAllocationStaking public allocationStakingContract;
    // Pointer to sales factory contract
    ISalesFactory public factory;
    // Admin contract
    IAdmin public admin;
    // Sale Vault NFT contract
    SaleVault public saleVault;
    // Pointer to dexalot portfolio smart-contract
    IDexalotPortfolio public dexalotPortfolio;

    struct Sale {
        // Token being sold
        IERC20 token;
        // Is sale created
        bool isCreated;
        // Are earnings withdrawn
        bool earningsWithdrawn;
        // Is leftover withdrawn
        bool leftoverWithdrawn;
        // Have tokens been deposited
        bool tokensDeposited;
        // Address of sale owner
        address saleOwner;
        // Price of the token quoted in AVAX
        uint256 tokenPriceInAVAX;
        // Amount of tokens to sell
        uint256 amountOfTokensToSell;
        // Total tokens being sold
        uint256 totalTokensSold;
        // Total AVAX Raised
        uint256 totalAVAXRaised;
        // Sale end time
        uint256 saleEnd;
        // Price of the token quoted in USD
        uint256 tokenPriceInUSD;
    }

    // Participation structure
    struct Participation {
        uint256 amountBought;
        uint256 amountAVAXPaid;
        uint256 timeParticipated;
        uint256 roundId;
        bool[] isPortionWithdrawn;
        bool[] isPortionWithdrawnToDexalot;
    }

    // Round structure
    struct Round {
        uint256 startTime;
        uint256 maxParticipation;
    }

    struct Registration {
        uint256 registrationTimeStarts;
        uint256 registrationTimeEnds;
        uint256 numberOfRegistrants;
    }

    // Sale
    Sale public sale;
    // Registration
    Registration public registration;
    // Number of users participated in the sale.
    uint256 public numberOfParticipants;
    // Array storing IDS of rounds (IDs start from 1, so they can't be mapped as array indexes
    uint256[] public roundIds;
    // Mapping round Id to round
    mapping(uint256 => Round) public roundIdToRound;
    // Mapping user to his participation
    mapping(address => Participation) public userToParticipation;
    // User to round for which he registered
    mapping(address => uint256) public addressToRoundRegisteredFor;
    // mapping if user is participated or not
    mapping(address => bool) public isParticipated;
    // Mapping vault ID to his participation
    mapping(uint => Participation) public vaultToParticipation;
    // Vault ID to round for which he registered
    mapping(uint256 => uint256) public vaultToRoundRegisteredFor;
    // mapping if vault is participated or not
    mapping(uint256 => bool) public isVaultParticipated;
    // Times when portions are getting unlocked
    uint256[] public vestingPortionsUnlockTime;
    // Percent of the participation user can withdraw
    uint256[] public vestingPercentPerPortion;
    //Precision for percent for portion vesting
    uint256 public portionVestingPrecision;
    // Added configurable round ID for staking round
    uint256 public stakingRoundId;
    // Max vesting time shift
    uint256 public maxVestingTimeShift;
    // Registration deposit AVAX, which will be paid during the registration, and returned back during the participation.
    uint256 public registrationDepositAVAX;
    // Accounting total AVAX collected, after sale admin can withdraw this
    uint256 public registrationFees;
    // Price update percent threshold
    uint8 updateTokenPriceInAVAXPercentageThreshold;
    // Price update time limit
    uint256 updateTokenPriceInAVAXTimeLimit;
    // Token price in AVAX latest update timestamp
    uint256 updateTokenPriceInAVAXLastCallTimestamp;
    // If Dexalot Withdrawals are supported
    bool public supportsDexalotWithdraw;
    // Represent amount of seconds before 0 portion unlock users can at earliest move their tokens to dexalot
    uint256 public dexalotUnlockTime;
    // Sale setter gate flag
    bool public gateClosed;

    // Restricting calls only to sale owner
    modifier onlySaleOwner() {
        require(msg.sender == sale.saleOwner, "OnlySaleOwner:: Restricted");
        _;
    }

    // Restricting calls only to sale admin
    modifier onlyAdmin() {
        require(
            admin.isAdmin(msg.sender),
            "Only admin can call this function."
        );
        _;
    }

    // Restricting setter calls after gate closing
    modifier onlyIfGateOpen() {
        require(!gateClosed, "Setter gate is closed.");
        _;
    }

    // Only existing vaults and vault owners can access
    modifier onlyVaultOwner(uint256 vaultID) {
        require(saleVault.exists(vaultID), "Vault does not exist");
        require(saleVault.ownerOf(vaultID) == msg.sender, "Vault is not owned by you");
        _;
    }

    // Events
    event TokensSold(address user, uint256 amount);
    event UserRegistered(address user, uint256 roundId);
    event TokenPriceSet(uint256 newPrice);
    event MaxParticipationSet(uint256 roundId, uint256 maxParticipation);
    event TokensWithdrawn(address user, uint256 amount);
    event SaleCreated(
        address saleOwner,
        uint256 tokenPriceInAVAX,
        uint256 amountOfTokensToSell,
        uint256 saleEnd,
        uint256 tokenPriceInUSD
    );
    event RegistrationTimeSet(
        uint256 registrationTimeStarts,
        uint256 registrationTimeEnds
    );
    event RoundAdded(
        uint256 roundId,
        uint256 startTime,
        uint256 maxParticipation
    );
    event RegistrationAVAXRefunded(address user, uint256 amountRefunded);
    event TokensWithdrawnToDexalot(address user, uint256 amount);
    event GateClosed(uint256 time);
    event ParticipationMigrated(address user, uint256 vaultId);
    event VaultBurned(address user, uint256 vaultId);

    // Constructor replacement for upgradable contracts
    function initialize(
        address _admin,
        address _allocationStaking,
        address _saleVault
    ) public initializer {
        require(_admin != address(0));
        require(_allocationStaking != address(0));
        admin = IAdmin(_admin);
        factory = ISalesFactory(msg.sender);
        allocationStakingContract = IAllocationStaking(_allocationStaking);
        saleVault = SaleVault(_saleVault);
    }

    /// @notice         Function to set vesting params
    function setVestingParams(
        uint256[] memory _unlockingTimes,
        uint256[] memory _percents,
        uint256 _maxVestingTimeShift
    )
        external
        onlyAdmin
    {
        require(
            vestingPercentPerPortion.length == 0 &&
            vestingPortionsUnlockTime.length == 0
        );
        require(_unlockingTimes.length == _percents.length);
        require(portionVestingPrecision > 0, "Safeguard for making sure setSaleParams get first called.");
        require(_maxVestingTimeShift <= 30 days, "Maximal shift is 30 days.");

        // Set max vesting time shift
        maxVestingTimeShift = _maxVestingTimeShift;

        uint256 sum;

        // Require that locking times are later than sale end
        require(_unlockingTimes[0] > sale.saleEnd, "Unlock time must be after the sale ends.");

        // Set vesting portions percents and unlock times
        for (uint256 i = 0; i < _unlockingTimes.length; i++) {
            if(i > 0) {
                require(_unlockingTimes[i] > _unlockingTimes[i-1], "Unlock time must be greater than previous.");
            }
            vestingPortionsUnlockTime.push(_unlockingTimes[i]);
            vestingPercentPerPortion.push(_percents[i]);
            sum = sum.add(_percents[i]);
        }

        require(sum == portionVestingPrecision, "Percent distribution issue.");
    }

    /// @notice     Admin function to shift vesting unlocking times
    function shiftVestingUnlockingTimes(uint256 timeToShift)
        external
        onlyAdmin
    {
        require(
            timeToShift > 0 && timeToShift < maxVestingTimeShift,
            "Shift must be nonzero and smaller than maxVestingTimeShift."
        );

        // Time can be shifted only once.
        maxVestingTimeShift = 0;

        // Shift the unlock time
        for (uint256 i = 0; i < vestingPortionsUnlockTime.length; i++) {
            vestingPortionsUnlockTime[i] = vestingPortionsUnlockTime[i].add(
                timeToShift
            );
        }
    }

    /// @notice     Admin function to set sale parameters
    function setSaleParams(
        address _token,
        address _saleOwner,
        uint256 _tokenPriceInAVAX,
        uint256 _amountOfTokensToSell,
        uint256 _saleEnd,
        uint256 _portionVestingPrecision,
        uint256 _stakingRoundId,
        uint256 _registrationDepositAVAX,
        uint256 _tokenPriceInUSD
    )
        external
        onlyAdmin
    {
        require(!sale.isCreated, "setSaleParams: Sale is already created.");
        require(
            _saleOwner != address(0),
            "setSaleParams: Sale owner address can not be 0."
        );
        require(
            _tokenPriceInAVAX != 0 &&
            _amountOfTokensToSell != 0 &&
            _saleEnd > block.timestamp &&
            _tokenPriceInUSD != 0,
            "setSaleParams: Bad input"
        );
        require(_portionVestingPrecision >= 100, "Should be at least 100");
        require(_stakingRoundId > 0, "Staking round ID can not be 0.");

        // Set params
        sale.token = IERC20(_token);
        sale.isCreated = true;
        sale.saleOwner = _saleOwner;
        sale.tokenPriceInAVAX = _tokenPriceInAVAX;
        sale.amountOfTokensToSell = _amountOfTokensToSell;
        sale.saleEnd = _saleEnd;
        sale.tokenPriceInUSD = _tokenPriceInUSD;

        // Deposit in AVAX, sent during the registration
        registrationDepositAVAX = _registrationDepositAVAX;
        // Set portion vesting precision
        portionVestingPrecision = _portionVestingPrecision;
        // Set staking round id
        stakingRoundId = _stakingRoundId;
        // Emit event
        emit SaleCreated(
            sale.saleOwner,
            sale.tokenPriceInAVAX,
            sale.amountOfTokensToSell,
            sale.saleEnd,
            sale.tokenPriceInUSD
        );
    }

    /// @notice  If sale supports early withdrawals to Dexalot.
    function setAndSupportDexalotPortfolio(
        address _dexalotPortfolio,
        uint256 _dexalotUnlockTime
    )
    external
    onlyAdmin
    {
        require(address(dexalotPortfolio) == address(0x0), "Dexalot Portfolio already set.");
        require(_dexalotPortfolio != address(0x0), "Cannot set zero address as Dexalot Portfolio.");
        dexalotPortfolio = IDexalotPortfolio(_dexalotPortfolio);
        dexalotUnlockTime = _dexalotUnlockTime;
        supportsDexalotWithdraw = true;
    }

    // @notice     Function to retroactively set sale token address, can be called only once,
    //             after initial contract creation has passed. Added as an options for teams which
    //             are not having token at the moment of sale launch.
    function setSaleToken(
        address saleToken
    )
        external
        onlyAdmin
        onlyIfGateOpen
    {
        sale.token = IERC20(saleToken);
    }


    /// @notice     Function to set registration period parameters
    function setRegistrationTime(
        uint256 _registrationTimeStarts,
        uint256 _registrationTimeEnds
    )
        external
        onlyAdmin
        onlyIfGateOpen
    {
        // Require that the sale is created
        require(sale.isCreated);
        require(
            _registrationTimeStarts >= block.timestamp &&
                _registrationTimeEnds > _registrationTimeStarts
        );
        require(_registrationTimeEnds < sale.saleEnd);

        if (roundIds.length > 0) {
            require(
                _registrationTimeEnds < roundIdToRound[roundIds[0]].startTime
            );
        }

        // Set registration start and end time
        registration.registrationTimeStarts = _registrationTimeStarts;
        registration.registrationTimeEnds = _registrationTimeEnds;

        emit RegistrationTimeSet(
            registration.registrationTimeStarts,
            registration.registrationTimeEnds
        );
    }

    /// @notice     Setting rounds for sale.
    function setRounds(
        uint256[] calldata startTimes,
        uint256[] calldata maxParticipations
    )
        external
        onlyAdmin
    {
        require(sale.isCreated);
        require(
            startTimes.length == maxParticipations.length,
            "setRounds: Bad input."
        );
        require(roundIds.length == 0, "setRounds: Rounds are set already.");
        require(startTimes.length > 0);

        uint256 lastTimestamp = 0;

        require(startTimes[0] > registration.registrationTimeEnds);
        require(startTimes[0] >= block.timestamp);

        for (uint256 i = 0; i < startTimes.length; i++) {
            require(startTimes[i] < sale.saleEnd);
            require(maxParticipations[i] > 0);
            require(startTimes[i] > lastTimestamp);
            lastTimestamp = startTimes[i];

            // Compute round Id
            uint256 roundId = i + 1;

            // Push id to array of ids
            roundIds.push(roundId);

            // Create round
            Round memory round = Round(startTimes[i], maxParticipations[i]);

            // Map round id to round
            roundIdToRound[roundId] = round;

            // Fire event
            emit RoundAdded(roundId, round.startTime, round.maxParticipation);
        }
    }

    /// @notice     Registration for sale.
    /// @param      signature is the message signed by the backend
    /// @param      roundId is the round for which user expressed interest to participate
    function registerForSale(bytes memory signature, uint256 roundId)
        external
        payable
    {
        require(
            msg.value == registrationDepositAVAX,
            "Registration deposit does not match."
        );
        require(roundId != 0, "Round ID can not be 0.");
        require(roundId <= roundIds.length, "Invalid round id");
        require(
            block.timestamp >= registration.registrationTimeStarts &&
                block.timestamp <= registration.registrationTimeEnds,
            "Registration gate is closed."
        );
        require(
            checkRegistrationSignature(signature, msg.sender, roundId),
            "Invalid signature"
        );
        require(
            addressToRoundRegisteredFor[msg.sender] == 0,
            "User can not register twice."
        );

        // Rounds are 1,2,3
        addressToRoundRegisteredFor[msg.sender] = roundId;
        // Special cases for staking round
        if (roundId == stakingRoundId) {
            // Lock users stake
            allocationStakingContract.setTokensUnlockTime(
                0,
                msg.sender,
                sale.saleEnd
            );
        }
        // Increment number of registered users
        registration.numberOfRegistrants++;
        // Increase earnings from registration fees
        registrationFees = registrationFees.add(msg.value);
        // Emit Registration event
        emit UserRegistered(msg.sender, roundId);
    }

    /// @notice     Admin function, to update token price before sale to match the closest $ desired rate.
    /// @dev        This will be updated with an oracle during the sale every N minutes, so the users will always
    ///             pay initialy set $ value of the token. This is to reduce reliance on the AVAX volatility.
    function updateTokenPriceInAVAX(uint256 price) external onlyAdmin {
        // Zero check on the first set
        if(sale.tokenPriceInAVAX != 0) {
            // Require that function params are properly set
            require(
                updateTokenPriceInAVAXTimeLimit != 0 && updateTokenPriceInAVAXPercentageThreshold != 0,
                "Function params not set."
            );

            // Require that the price does not differ more than 'N%' from previous one
            uint256 maxPriceChange = sale.tokenPriceInAVAX.mul(updateTokenPriceInAVAXPercentageThreshold).div(100);
            require(
                price < sale.tokenPriceInAVAX.add(maxPriceChange) &&
                price > sale.tokenPriceInAVAX.sub(maxPriceChange),
                "Price differs too much from the previous."
            );

            // Require that 'N' time has passed since last call
            require(
                updateTokenPriceInAVAXLastCallTimestamp.add(updateTokenPriceInAVAXTimeLimit) < block.timestamp,
                "Not enough time passed since last call."
            );
        }

        // Set latest call time to current timestamp
        updateTokenPriceInAVAXLastCallTimestamp = block.timestamp;

        // Allowing oracle to run and change the sale value
        sale.tokenPriceInAVAX = price;
        emit TokenPriceSet(price);
    }

    /// @notice     Admin function to postpone the sale
    function postponeSale(uint256 timeToShift) external onlyAdmin {
        require(
            block.timestamp < roundIdToRound[roundIds[0]].startTime,
            "1st round already started."
        );
        // Iterate through all registered rounds and postpone them
        for (uint256 i = 0; i < roundIds.length; i++) {
            Round storage round = roundIdToRound[roundIds[i]];
            // Require that timeToShift does not extend sale over it's end
            require(
                round.startTime.add(timeToShift) < sale.saleEnd,
                "Start time can not be greater than end time."
            );
            // Postpone sale
            round.startTime = round.startTime.add(timeToShift);
        }
    }

    /// @notice     Function to extend registration period
    function extendRegistrationPeriod(uint256 timeToAdd) external onlyAdmin {
        require(
            registration.registrationTimeEnds.add(timeToAdd) <
                roundIdToRound[roundIds[0]].startTime,
            "Registration period overflows sale start."
        );

        registration.registrationTimeEnds = registration
            .registrationTimeEnds
            .add(timeToAdd);
    }

    /// @notice     Admin function to set max participation cap per round
    function setCapPerRound(uint256[] calldata rounds, uint256[] calldata caps)
        external
        onlyAdmin
    {
        // Require that round has not already started
        require(
            block.timestamp < roundIdToRound[roundIds[0]].startTime,
            "1st round already started."
        );
        require(rounds.length == caps.length, "Arrays length is different.");

        // Set max participation per round
        for (uint256 i = 0; i < rounds.length; i++) {
            require(caps[i] > 0, "Can't set max participation to 0");

            Round storage round = roundIdToRound[rounds[i]];
            round.maxParticipation = caps[i];

            emit MaxParticipationSet(rounds[i], round.maxParticipation);
        }
    }

    // Function for owner to deposit tokens, can be called only once.
    function depositTokens()
        external
        onlySaleOwner
        onlyIfGateOpen
    {
        // Require that setSaleParams was called
        require(
            sale.amountOfTokensToSell > 0,
            "Sale parameters not set."
        );

        // Require that tokens are not deposited
        require(
            !sale.tokensDeposited,
            "Tokens already deposited."
        );

        // Mark that tokens are deposited
        sale.tokensDeposited = true;

        // Perform safe transfer
        sale.token.safeTransferFrom(
            msg.sender,
            address(this),
            sale.amountOfTokensToSell
        );
    }

    // Function to participate in the sales
    function participate(
        bytes calldata signature,
        uint256 amount,
        uint256 amountXavaToBurn,
        uint256 roundId,
        uint256 signatureExpirationTimestamp
    ) external payable {

        require(roundId != 0, "Round can not be 0.");

        require(
            amount <= roundIdToRound[roundId].maxParticipation,
            "Overflowing maximal participation for this round."
        );

        // User must have registered for the round in advance
        require(
            addressToRoundRegisteredFor[msg.sender] == roundId,
            "Not registered for this round"
        );

        // Verify the signature
        require(
            checkParticipationSignature(
                signature,
                msg.sender,
                amount,
                amountXavaToBurn,
                roundId,
                signatureExpirationTimestamp
            ),
            "Invalid signature. Verification failed"
        );

        // Check if signature has expired
        require(block.timestamp < signatureExpirationTimestamp, "Signature expired.");

        // Check user haven't participated before
        require(!isParticipated[msg.sender], "User can participate only once.");

        // Disallow contract calls.
        require(msg.sender == tx.origin, "Only direct contract calls.");

        // Get current active round
        uint256 currentRound = getCurrentRound();

        // Assert that
        require(
            roundId == currentRound,
            "You can not participate in this round."
        );

        // Compute the amount of tokens user is buying
        uint256 amountOfTokensBuying =
            (msg.value).mul(uint(10) ** IERC20Metadata(address(sale.token)).decimals()).div(sale.tokenPriceInAVAX);

        // Must buy more than 0 tokens
        require(amountOfTokensBuying > 0, "Can't buy 0 tokens");

        // Check in terms of user allo
        require(
            amountOfTokensBuying <= amount,
            "Trying to buy more than allowed."
        );

        // Require that amountOfTokensBuying is less than sale token leftover cap
        require(
            amountOfTokensBuying <= sale.amountOfTokensToSell.sub(sale.totalTokensSold),
            "Trying to buy more than contract has."
        );

        // Increase amount of sold tokens
        sale.totalTokensSold = sale.totalTokensSold.add(amountOfTokensBuying);

        // Increase amount of AVAX raised
        sale.totalAVAXRaised = sale.totalAVAXRaised.add(msg.value);

        // Empty bool array used to be set as initial for 'isPortionWithdrawn' and 'isPortionWithdrawnToDexalot'
        // Size determined by number of sale portions
        bool[] memory _empty = new bool[](
            vestingPortionsUnlockTime.length
        );

        // Create participation object
        Participation memory p = Participation({
            amountBought: amountOfTokensBuying,
            amountAVAXPaid: msg.value,
            timeParticipated: block.timestamp,
            roundId: roundId,
            isPortionWithdrawn: _empty,
            isPortionWithdrawnToDexalot: _empty
        });

        // Staking round only.
        if (roundId == stakingRoundId) {
            // Burn XAVA from this user.
            allocationStakingContract.redistributeXava(
                0,
                msg.sender,
                amountXavaToBurn
            );
        }

        // Add participation for user.
        userToParticipation[msg.sender] = p;
        // Mark user is participated
        isParticipated[msg.sender] = true;
        // Increment number of participants in the Sale.
        numberOfParticipants++;
        // Decrease of available registration fees
        registrationFees = registrationFees.sub(registrationDepositAVAX);
        // Transfer registration deposit amount in AVAX back to the users.
        safeTransferAVAX(msg.sender, registrationDepositAVAX);

        emit RegistrationAVAXRefunded(msg.sender, registrationDepositAVAX);
        emit TokensSold(msg.sender, amountOfTokensBuying);
    }

    // Migrate participation details from user to vault NFT
    function migrateToVault() external {

        require(isParticipated[msg.sender] 
            && userToParticipation[msg.sender].amountBought > 0,"No participation found");

        // Check if there are portions left to withdraw
        Participation storage p = userToParticipation[msg.sender];

        uint portionsLeft;

        for(uint i=0; i < p.isPortionWithdrawn.length; i++) {
            if(!p.isPortionWithdrawn[i]) portionsLeft++;
        }

        require(portionsLeft > 0, "All portions withdrawn");

        uint256 vaultId = saleVault.currentId();
        saleVault.mint(msg.sender);

        vaultToParticipation[vaultId] = userToParticipation[msg.sender];
        vaultToRoundRegisteredFor[vaultId] = addressToRoundRegisteredFor[msg.sender];
        isVaultParticipated[vaultId] = true;


        delete userToParticipation[msg.sender];
        isParticipated[msg.sender] = false;
        addressToRoundRegisteredFor[msg.sender] = 0;

        emit ParticipationMigrated(msg.sender, vaultId);
    }

    // Migrate participation details from user to vault NFT
    function burnVault(uint vaultId) external onlyVaultOwner(vaultId) {

        // Check if there are portions left to withdraw
        Participation storage p = vaultToParticipation[vaultId];

        uint portionsLeft;

        for(uint i=0; i < p.isPortionWithdrawn.length; i++) {
            if(!p.isPortionWithdrawn[i]) portionsLeft++;
        }

        require(portionsLeft == 0, "Not all portions withdrawn");

        // Burn NFT
        saleVault.burn(vaultId);

        emit VaultBurned(msg.sender, vaultId);
    }

    /// Helper function to claim participation
    function _withdrawTokens(uint256 portionId, Participation storage p) internal {

        if (
            !p.isPortionWithdrawn[portionId] &&
            vestingPortionsUnlockTime[portionId] <= block.timestamp
        ) {
            p.isPortionWithdrawn[portionId] = true;
            uint256 amountWithdrawing = p
                .amountBought
                .mul(vestingPercentPerPortion[portionId])
                .div(portionVestingPrecision);

            // Withdraw percent which is unlocked at that portion
            if(amountWithdrawing > 0) {
                sale.token.safeTransfer(msg.sender, amountWithdrawing);
                emit TokensWithdrawn(msg.sender, amountWithdrawing);
            }
        } else {
            revert("Tokens already withdrawn or portion not unlocked yet.");
        }
    }

    /// Users can deposit their participation to Dexalot Portfolio
    /// @dev first portion can be deposited before it's unlocking time, while others can only after
    function withdrawTokensToDexalot(uint256 portionId) external {

        // Security check
        performDexalotChecks();

        require(
            portionId < vestingPercentPerPortion.length,
            "Portion id out of range."
        );

        // Retrieve participation from storage
        Participation storage p = userToParticipation[msg.sender];

        // Require that portion is not withdrawn
        require(!p.isPortionWithdrawn[portionId], "Portion already withdrawn.");

        if(portionId > 0) {
            require(
                vestingPortionsUnlockTime[portionId] <= block.timestamp,
                "Portion not unlocked yet."
            );
        } // modifier checks for portionId == 0 case

        // Mark portion as withdrawn
        p.isPortionWithdrawn[portionId] = true;
        // Mark portion as withdrawn to dexalot
        p.isPortionWithdrawnToDexalot[portionId] = true;

        // Compute amount withdrawing
        uint256 amountWithdrawing = p
            .amountBought
            .mul(vestingPercentPerPortion[portionId])
            .div(portionVestingPrecision);

        // Withdraw percent which is unlocked at that portion
        if(amountWithdrawing > 0) {
            // Transfer tokens to user's wallet prior to dexalot deposit
            sale.token.safeTransfer(msg.sender, amountWithdrawing);

            // Deposit tokens to dexalot contract - Withdraw from sale contract
            dexalotPortfolio.depositTokenFromContract(
                msg.sender, getTokenSymbolBytes32(), amountWithdrawing
            );
            // Trigger event
            emit TokensWithdrawnToDexalot(msg.sender, amountWithdrawing);
        }
    }

    /// Users can claim their participation
    function withdrawTokens(uint256 portionId) external {
        require(
            portionId < vestingPercentPerPortion.length,
            "Portion id out of range."
        );

        // Retrieve participation from storage
        Participation storage p = userToParticipation[msg.sender];

        _withdrawTokens(portionId, p);
    }

    /// NFT owners can claim their participation
    function withdrawTokensFromVault(uint256 portionId, uint256 vaultId) external onlyVaultOwner(vaultId) {
        require(
            portionId < vestingPercentPerPortion.length,
            "Portion id out of range."
        );

        Participation storage p = vaultToParticipation[vaultId];

        _withdrawTokens(portionId, p);
    }

    /// Helper function for multiple portions withdrawal
    function _withdrawMultiplePortions(uint256 [] calldata portionIds, Participation storage p) internal {

        uint256 totalToWithdraw = 0;

        for(uint i=0; i < portionIds.length; i++) {
            uint256 portionId = portionIds[i];
            require(portionId < vestingPercentPerPortion.length);

            if (
                !p.isPortionWithdrawn[portionId] &&
                vestingPortionsUnlockTime[portionId] <= block.timestamp
            ) {
                // Mark participation as withdrawn
                p.isPortionWithdrawn[portionId] = true;
                // Compute amount withdrawing
                uint256 amountWithdrawing = p
                    .amountBought
                    .mul(vestingPercentPerPortion[portionId])
                    .div(portionVestingPrecision);
                // Withdraw percent which is unlocked at that portion
                totalToWithdraw = totalToWithdraw.add(amountWithdrawing);
            }
        }

        if(totalToWithdraw > 0) {
            // Transfer tokens to user
            sale.token.safeTransfer(msg.sender, totalToWithdraw);
            // Trigger an event
            emit TokensWithdrawn(msg.sender, totalToWithdraw);
        }
    }

    // Expose function where a vault owner can withdraw multiple unlocked portions at once.
    function withdrawMultiplePortions(uint256 [] calldata portionIds) external {

        Participation storage p = userToParticipation[msg.sender];

        _withdrawMultiplePortions(portionIds, p);
        
    }

    // Expose function where user can withdraw multiple unlocked portions at once.
    function withdrawMultiplePortionsFromVault(
        uint256 [] calldata portionIds,
        uint vaultId
    ) 
        external 
        onlyVaultOwner(vaultId)
    {
        Participation storage p = vaultToParticipation[vaultId];

        _withdrawMultiplePortions(portionIds, p);
    }

    /// Expose function where user can withdraw multiple unlocked portions to Dexalot Portfolio at once
    /// @dev first portion can be deposited before it's unlocking time, while others can only after
    function withdrawMultiplePortionsToDexalot(uint256 [] calldata portionIds) external {

        // Security check
        performDexalotChecks();

        uint256 totalToWithdraw = 0;

        // Retrieve participation from storage
        Participation storage p = userToParticipation[msg.sender];

        for(uint i=0; i < portionIds.length; i++) {
            uint256 portionId = portionIds[i];
            require(portionId < vestingPercentPerPortion.length);

            bool eligible;

            if(!p.isPortionWithdrawn[portionId]) {
                if(portionId > 0) {
                    if(vestingPortionsUnlockTime[portionId] <= block.timestamp) {
                        eligible = true;
                    }
                } else { // if portion id == 0
                    eligible = true;
                } // modifier checks for portionId == 0 case
            }

            if(eligible) {
                // Mark participation as withdrawn
                p.isPortionWithdrawn[portionId] = true;
                // Mark portion as withdrawn to dexalot
                p.isPortionWithdrawnToDexalot[portionId] = true;
                // Compute amount withdrawing
                uint256 amountWithdrawing = p
                    .amountBought
                    .mul(vestingPercentPerPortion[portionId])
                    .div(portionVestingPrecision);
                // Withdraw percent which is unlocked at that portion
                totalToWithdraw = totalToWithdraw.add(amountWithdrawing);
            }
        }

        if(totalToWithdraw > 0) {
            // Transfer tokens to user's wallet prior to dexalot deposit
            sale.token.safeTransfer(msg.sender, totalToWithdraw);

            // Deposit tokens to dexalot contract - Withdraw from sale contract
            dexalotPortfolio.depositTokenFromContract(
                msg.sender, getTokenSymbolBytes32(), totalToWithdraw
            );

            // Trigger an event
            emit TokensWithdrawnToDexalot(msg.sender, totalToWithdraw);
        }
    }

    // Internal function to handle safe transfer
    function safeTransferAVAX(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success);
    }

    /// Function to withdraw all the earnings and the leftover of the sale contract.
    function withdrawEarningsAndLeftover() external onlySaleOwner {
        withdrawEarningsInternal();
        withdrawLeftoverInternal();
    }

    // Function to withdraw only earnings
    function withdrawEarnings() external onlySaleOwner {
        withdrawEarningsInternal();
    }

    // Function to withdraw only leftover
    function withdrawLeftover() external onlySaleOwner {
        withdrawLeftoverInternal();
    }

    // Function to withdraw earnings
    function withdrawEarningsInternal() internal  {
        // Make sure sale ended
        require(block.timestamp >= sale.saleEnd);

        // Make sure owner can't withdraw twice
        require(!sale.earningsWithdrawn);
        sale.earningsWithdrawn = true;
        // Earnings amount of the owner in AVAX
        uint256 totalProfit = sale.totalAVAXRaised;

        safeTransferAVAX(msg.sender, totalProfit);
    }

    // Function to withdraw leftover
    function withdrawLeftoverInternal() internal {
        // Make sure sale ended
        require(block.timestamp >= sale.saleEnd);

        // Make sure owner can't withdraw twice
        require(!sale.leftoverWithdrawn);
        sale.leftoverWithdrawn = true;

        // Amount of tokens which are not sold
        uint256 leftover = sale.amountOfTokensToSell.sub(sale.totalTokensSold);

        if (leftover > 0) {
            sale.token.safeTransfer(msg.sender, leftover);
        }
    }

    // Function after sale for admin to withdraw registration fees if there are any left.
    function withdrawRegistrationFees() external onlyAdmin {
        require(block.timestamp >= sale.saleEnd, "Require that sale has ended.");
        require(registrationFees > 0, "No earnings from registration fees.");

        // Transfer AVAX to the admin wallet.
        safeTransferAVAX(msg.sender, registrationFees);
        // Set registration fees to be 0
        registrationFees = 0;
    }

    // Function where admin can withdraw all unused funds.
    function withdrawUnusedFunds() external onlyAdmin {
        uint256 balanceAVAX = address(this).balance;

        uint256 totalReservedForRaise = sale.earningsWithdrawn ? 0 : sale.totalAVAXRaised;

        safeTransferAVAX(
            msg.sender,
            balanceAVAX.sub(totalReservedForRaise.add(registrationFees))
        );
    }

    /// @notice     Get current round in progress.
    ///             If 0 is returned, means sale didn't start or it's ended.
    function getCurrentRound() public view returns (uint256) {
        uint256 i = 0;
        if (block.timestamp < roundIdToRound[roundIds[0]].startTime) {
            return 0; // Sale didn't start yet.
        }

        while (
            (i + 1) < roundIds.length &&
            block.timestamp > roundIdToRound[roundIds[i + 1]].startTime
        ) {
            i++;
        }

        if (block.timestamp >= sale.saleEnd) {
            return 0; // Means sale is ended
        }

        return roundIds[i];
    }

    /// @notice     Check signature user submits for registration.
    /// @param      signature is the message signed by the trusted entity (backend)
    /// @param      user is the address of user which is registering for sale
    /// @param      roundId is the round for which user is submitting registration
    function checkRegistrationSignature(
        bytes memory signature,
        address user,
        uint256 roundId
    ) public view returns (bool) {
        bytes32 hash = keccak256(
            abi.encodePacked(user, roundId, address(this))
        );
        bytes32 messageHash = hash.toEthSignedMessageHash();
        return admin.isAdmin(messageHash.recover(signature));
    }

    /// @notice     Check who signed the message
    /// @param      signature is the message allowing user to participate in sale
    /// @param      user is the address of user for which we're signing the message
    /// @param      amount is the maximal amount of tokens user can buy
    /// @param      roundId is the Id of the round user is participating.
    function checkParticipationSignature(
        bytes memory signature,
        address user,
        uint256 amount,
        uint256 amountXavaToBurn,
        uint256 roundId,
        uint256 signatureExpirationTimestamp
    ) public view returns (bool) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                user,
                amount,
                amountXavaToBurn,
                roundId,
                signatureExpirationTimestamp,
                address(this)
            )
        );
        bytes32 messageHash = hash.toEthSignedMessageHash();
        return admin.isAdmin(messageHash.recover(signature));
    }

    /// @notice     Function to get participation for passed user address
    function getParticipation(address _user)
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            bool[] memory,
            bool[] memory
        )
    {
        Participation memory p = userToParticipation[_user];
        return (
            p.amountBought,
            p.amountAVAXPaid,
            p.timeParticipated,
            p.roundId,
            p.isPortionWithdrawn,
            p.isPortionWithdrawnToDexalot
        );
    }

    /// @notice     Function to get participation for passed user address
    function getVaultParticipation(uint256 vaultId)
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            bool[] memory
        )
    {
        Participation memory p = vaultToParticipation[vaultId];
        return (
            p.amountBought,
            p.amountAVAXPaid,
            p.timeParticipated,
            p.roundId,
            p.isPortionWithdrawn
        );
    }

    /// @notice     Function to get number of registered users for sale
    function getNumberOfRegisteredUsers() external view returns (uint256) {
        return registration.numberOfRegistrants;
    }

    /// @notice     Function to get all info about vesting.
    function getVestingInfo()
        external
        view
        returns (uint256[] memory, uint256[] memory)
    {
        return (vestingPortionsUnlockTime, vestingPercentPerPortion);
    }

    /// @notice     Function to remove stuck tokens from sale contract
    function removeStuckTokens(
        address token,
        address beneficiary
    )
        external
        onlyAdmin
    {
        // Require that token address does not match with sale token
        require(token != address(sale.token), "Cannot withdraw official sale token.");
        // Safe transfer token from sale contract to beneficiary
        IERC20(token).safeTransfer(beneficiary, IERC20(token).balanceOf(address(this)));
    }

    /// @notice     Function to set params for updatePriceInAVAX function
    function setUpdateTokenPriceInAVAXParams(
        uint8 _updateTokenPriceInAVAXPercentageThreshold,
        uint256 _updateTokenPriceInAVAXTimeLimit
    )
        external
        onlyAdmin
        onlyIfGateOpen
    {
        // Require that arguments don't equal zero
        require(
            _updateTokenPriceInAVAXTimeLimit != 0 && _updateTokenPriceInAVAXPercentageThreshold != 0,
            "Cannot set zero value."
        );
        // Require that percentage threshold is less or equal 100%
        require(
            _updateTokenPriceInAVAXPercentageThreshold <= 100,
            "Percentage threshold cannot be higher than 100%"
        );
        // Set new values
        updateTokenPriceInAVAXPercentageThreshold = _updateTokenPriceInAVAXPercentageThreshold;
        updateTokenPriceInAVAXTimeLimit = _updateTokenPriceInAVAXTimeLimit;
    }

    /// @notice     Function to secure dexalot portfolio interactions
    function performDexalotChecks() internal view {
        require(
            supportsDexalotWithdraw,
            "Dexalot Portfolio withdrawal not supported."
        );
        require(
            block.timestamp >= dexalotUnlockTime,
            "Dexalot Portfolio withdrawal not unlocked."
        );
    }

    /// @notice     Function to get sale.token symbol and parse as bytes32
    function getTokenSymbolBytes32() internal view returns (bytes32 _symbol) {
        // get token symbol as string memory
        string memory symbol = IERC20Metadata(address(sale.token)).symbol();
        // parse token symbol to bytes32 format - to fit dexalot function interface
        assembly {
            _symbol := mload(add(symbol, 32))
        }
    }

    /// @notice     Function close setter gate after all params are set
    function closeGate() external onlyAdmin onlyIfGateOpen {
        // Require that sale is created
        require(sale.isCreated, "closeGate: Sale not created.");
        // Require that sale token is set
        require(address(sale.token) != address(0), "closeGate: Token not set.");
        // Require that tokens were deposited
        require(sale.tokensDeposited, "closeGate: Tokens not deposited.");
        // Require that token price updating params are set
        require(
            updateTokenPriceInAVAXPercentageThreshold != 0 && updateTokenPriceInAVAXTimeLimit != 0,
            "closeGate: Params for updateTokenPriceInAvax not set."
        );
        // Require that registration times are set
        require(
            registration.registrationTimeStarts != 0 && registration.registrationTimeEnds != 0,
            "closeGate: Registration params not set."
        );

        // Close the gate
        gateClosed = true;
        emit GateClosed(block.timestamp);
    }

    // Function to act as a fallback and handle receiving AVAX.
    receive() external payable {

    }
}
