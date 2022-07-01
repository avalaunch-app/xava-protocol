//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "../interfaces/IAdmin.sol";
import "../interfaces/ISalesFactory.sol";
import "../interfaces/IAllocationStaking.sol";
import "../interfaces/IERC20Metadata.sol";
import "../interfaces/IDexalotPortfolio.sol";
import "../interfaces/ICollateral.sol";
import "../interfaces/IAvalaunchMarketplace.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

contract AvalaunchSaleV2 is Initializable {

    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using SafeMath for uint256;

    // Pointer allocation staking contract
    IAllocationStaking public allocationStaking;
    // Pointer to sales factory contract
    ISalesFactory public factory;
    // Pointer to admin contract
    IAdmin public admin;
    // Pointer to collateral contract
    ICollateral public collateral;
    // Pointer to marketplace contract
    IAvalaunchMarketplace public marketplace;
    // Pointer to dexalot portfolio contract
    IDexalotPortfolio public dexalotPortfolio;

    // Participation Types
    enum ParticipationTypes { Normal, Auto, Boost }
    // Rounds
    enum Rounds { Public, Validator, Staking, Booster }
    // Portion States
    enum PortionStates { Available, Withdrawn, WithdrawnToDexalot, OnMarket, Sold }

    struct Sale {
        IERC20 token;                        // Official sale token
        bool isCreated;                      // Sale creation marker
        bool earningsWithdrawn;              // Earnings withdrawal marker
        bool leftoverWithdrawn;              // Leftover withdrawal marker
        bool tokensDeposited;                // Token deposit marker
        address moderator;                   // Sale moderator's address
        uint256 tokenPriceInAVAX;            // Sale token's price in AVAX
        uint256 amountOfTokensToSell;        // Amount of tokens to sell
        uint256 totalTokensSold;             // Amount of sold tokens
        uint256 totalAVAXRaised;             // Total AVAX amount raised
        uint256 saleEnd;                     // Sale end timestamp
    }

    struct Participation {
        uint256 amountBought;                // Amount of tokens bought
        uint256 amountAVAXPaid;
        uint256 timeParticipated;
        uint256 roundId;
        uint256[] portionAmounts;
        PortionStates[] portionStates;
        uint256 boostedAmountAVAXPaid;
        uint256 boostedAmountBought;
    }

    struct Registration {
        uint256 registrationTimeStarts;
        uint256 registrationTimeEnds;
        uint256 numberOfRegistrants;
    }

    struct Round {
        uint256 startTime;
        uint256 maxParticipation;
    }

    // Sale state structure
    Sale public sale;
    // Registration state structure
    Registration public registration;
    // Mapping round Id to round
    mapping(uint256 => Round) public roundIdToRound;
    // Mapping user to his participation
    mapping(address => Participation) public userToParticipation;
    // User to round for which he registered
    mapping(address => uint256) public addressToRoundRegisteredFor;
    // mapping if user is participated or not
    mapping(address => bool) public isParticipated;
    // Array storing round ids - starting from 1
    uint256[] public roundIds;
    // Times when portions are getting unlocked
    uint256[] public vestingPortionsUnlockTime;
    // Percent of the participation user can withdraw
    uint256[] public vestingPercentPerPortion;
    // Number of users participated in the sale
    uint256 public numberOfParticipants;
    // Number of vested token portions
    uint256 public numberOfVestedPortions;
    // Precision for percent for portion vesting
    uint256 public portionVestingPrecision;
    // Added configurable round ID for staking round
    uint256 public stakingRoundId;
    // Added configurable round ID for staking round
    uint256 public boosterRoundId;
    // Max vesting time shift
    uint256 public maxVestingTimeShift;
    // Registration deposit AVAX, deposited during the registration, returned after the participation.
    uint256 public registrationDepositAVAX;
    // Accounting total AVAX collected, after sale end admin can withdraw this
    uint256 public registrationFees;
    // First vested portion's Dexalot unlock timestamp
    uint256 public dexalotUnlockTime;
    // Sale setter lock flag
    bool public isLockOn;

    // Empty global arrays for cheaper participation initialization
    PortionStates[] public _emptyPortionStates;
    uint256[] public _emptyUint256;

    // Events
    event TokensSold(address user, uint256 amount);
    event UserRegistered(address user, uint256 roundId);
    event TokenPriceSet(uint256 newPrice);
    event MaxParticipationSet(uint256 roundId, uint256 maxParticipation);
    event TokensWithdrawn(address user, uint256 amount);
    event SaleCreated(address saleOwner, uint256 tokenPriceInAVAX, uint256 amountOfTokensToSell, uint256 saleEnd);
    event SaleTokenSet(address indexed saleToken, uint256 timestamp);
    event RegistrationTimeSet(uint256 registrationTimeStarts, uint256 registrationTimeEnds);
    event RoundAdded(uint256 roundId, uint256 startTime, uint256 maxParticipation);
    event RegistrationAVAXRefunded(address user, uint256 amountRefunded);
    event TokensWithdrawnToDexalot(address user, uint256 amount);
    event SettersLocked(uint256 time);
    event ParticipationBoosted(address user, uint256 amountAVAX, uint256 amountTokens);

    // Restricting calls only to sale owner
    modifier onlyModerator() {
        require(msg.sender == sale.moderator, "Only moderator.");
        _;
    }

    // Restricting calls only to sale admin
    modifier onlyAdmin() {
        require(admin.isAdmin(msg.sender), "Only admin.");
        _;
    }

    // Restricting calls only to collateral contract
    modifier onlyCollateral() {
        require(msg.sender == address(collateral), "Only collateral.");
        _;
    }

    // Restricting setter calls after gate closing
    modifier ifUnlocked() {
        require(!isLockOn, "Lock active.");
        _;
    }

    function initialize(
        address _admin,
        address _allocationStaking,
        address _collateral,
        address _marketplace
    ) external initializer {
        require(_admin != address(0));
        require(_allocationStaking != address(0));
        require(_collateral != address(0));
        require(_marketplace != address(0));

        admin = IAdmin(_admin);
        allocationStaking = IAllocationStaking(_allocationStaking);
        collateral = ICollateral(_collateral);
        marketplace = IAvalaunchMarketplace(_marketplace);
        factory = ISalesFactory(msg.sender);
    }

    /**
     * @notice Function to set vesting params
     */
    function setVestingParams(
        uint256[] memory _unlockingTimes,
        uint256[] memory _percents,
        uint256 _maxVestingTimeShift
    )
    external
    onlyAdmin
    {
        require(
            vestingPercentPerPortion.length == 0 && vestingPortionsUnlockTime.length == 0,
            "Vesting params already set."
        );
        require(_unlockingTimes.length == _percents.length, "Array length mismatch.");
        require(_maxVestingTimeShift <= 30 days, "Maximal shift is 30 days.");
        require(portionVestingPrecision > 0, "Sale params not set.");

        // Set max vesting time shift
        maxVestingTimeShift = _maxVestingTimeShift;

        uint256 precision = portionVestingPrecision;

        // Require that locking times are later than sale end
        require(_unlockingTimes[0] > sale.saleEnd, "Unlock times must be after the sale end.");

        // Set vesting portions percents and unlock times
        for (uint256 i = 0; i < _unlockingTimes.length; i++) {
            if(i > 0) {
                require(_unlockingTimes[i] > _unlockingTimes[i-1], "Invalid unlocking time.");
            }
            vestingPortionsUnlockTime.push(_unlockingTimes[i]);
            vestingPercentPerPortion.push(_percents[i]);
            precision = precision.sub(_percents[i]);
        }

        numberOfVestedPortions = _unlockingTimes.length;

        _emptyPortionStates = new PortionStates[](numberOfVestedPortions);
        _emptyUint256 = new uint256[](numberOfVestedPortions);

        require(precision == 0, "Invalid percentage calculation.");
    }

    /**
     * @notice Function to shift vested portion unlock times
     */
    function shiftVestingUnlockingTimes(uint256 timeToShift) external onlyAdmin {
        require(
            timeToShift > 0 && timeToShift < maxVestingTimeShift,
            "Invalid shift time."
        );

        // Time can be shifted only once.
        maxVestingTimeShift = 0;

        // Shift the unlock time
        for (uint256 i = 0; i < numberOfVestedPortions; i++) {
            vestingPortionsUnlockTime[i] = vestingPortionsUnlockTime[i].add(
                timeToShift
            );
        }
    }

    /**
     * @notice Function to set sale parameters
     */
    function setSaleParams(
        address _token,
        address _moderator,
        uint256 _tokenPriceInAVAX,
        uint256 _amountOfTokensToSell,
        uint256 _saleEnd,
        uint256 _portionVestingPrecision,
        uint256 _stakingRoundId,
        uint256 _registrationDepositAVAX
    )
    external
    onlyAdmin
    {
        require(!sale.isCreated, "Sale already created.");
        require(
            _moderator != address(0),
            "Invalid sale owner address."
        );
        require(
            _tokenPriceInAVAX != 0 &&
            _amountOfTokensToSell != 0 &&
            _saleEnd > block.timestamp,
            "Invalid input."
        );
        require(_portionVestingPrecision >= 100, "Should be at least 100");
        require(_stakingRoundId > 0, "Invalid staking round id.");

        // Set params
        sale.token = IERC20(_token);
        sale.isCreated = true;
        sale.moderator = _moderator;
        sale.tokenPriceInAVAX = _tokenPriceInAVAX;
        sale.amountOfTokensToSell = _amountOfTokensToSell;
        sale.saleEnd = _saleEnd;

        // Deposit in AVAX, sent during the registration
        registrationDepositAVAX = _registrationDepositAVAX;
        // Set portion vesting precision
        portionVestingPrecision = _portionVestingPrecision;
        // Set staking round id
        stakingRoundId = _stakingRoundId;
        // Set booster round id
        boosterRoundId = _stakingRoundId.add(1);

        // Emit event
        emit SaleCreated(
            sale.moderator,
            sale.tokenPriceInAVAX,
            sale.amountOfTokensToSell,
            sale.saleEnd
        );
    }

    /**
     * @notice Function to set Dexalot parameters
     * @dev Optional feature to enable user portion withdrawals directly to Dexalot Portfolio
     */
    function setDexalotParameters(
        address _dexalotPortfolio,
        uint256 _dexalotUnlockTime
    )
    external
    onlyAdmin
    ifUnlocked
    {
        require(_dexalotPortfolio != address(0) && dexalotUnlockTime > sale.saleEnd);
        dexalotPortfolio = IDexalotPortfolio(_dexalotPortfolio);
        dexalotUnlockTime = _dexalotUnlockTime;
    }

    /**
     * @notice Function to retroactively set sale token address
     * @dev Retroactive calls are option for teams which do not have token at the moment of sale launch
     */
    function setSaleToken(
        address saleToken
    )
    external
    onlyAdmin
    ifUnlocked
    {
        sale.token = IERC20(saleToken);
        emit SaleTokenSet(saleToken, block.timestamp);
    }

    /**
     * @notice Function to set registration period parameters
     */
    function setRegistrationTime(
        uint256 _registrationTimeStarts,
        uint256 _registrationTimeEnds
    )
    external
    onlyAdmin
    ifUnlocked
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

    /**
     * @notice Function to set round configuration for the upcoming sale
     */
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
            "Invalid array lengths."
        );
        require(roundIds.length == 0, "Rounds set already.");
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

    /**
     * @notice Function to register for the upcoming sale
     */
    function registerForSale(
        bytes memory signature,
        uint256 signatureExpirationTimestamp,
        uint256 roundId
    )
    external
    payable
    {
        require(
            msg.value == registrationDepositAVAX,
            "Registration deposit doesn't match."
        );
        require(roundId != 0, "Invalid round id.");
        require(roundId <= stakingRoundId, "Invalid round id");
        require(
            block.timestamp >= registration.registrationTimeStarts &&
            block.timestamp <= registration.registrationTimeEnds,
            "Registration gate is closed."
        );
        require(
            verifySignature(
                keccak256(abi.encodePacked(signatureExpirationTimestamp, msg.sender, roundId, address(this))),
                signature
            ),
            "Invalid signature."
        );
        require(block.timestamp < signatureExpirationTimestamp, "Signature expired.");
        require(
            addressToRoundRegisteredFor[msg.sender] == 0,
            "User already registered."
        );

        // Rounds are 1,2,3
        addressToRoundRegisteredFor[msg.sender] = roundId;
        // Special cases for staking round
        if (roundId == stakingRoundId) {
            // Lock users stake
            allocationStaking.setTokensUnlockTime(
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

    /**
     * @notice Function to update token price in $AVAX to match real time value of token
     * @dev To help us reduce reliance on $AVAX volatility, oracle will update price during sale every N minutes
     */
    function updateTokenPriceInAVAX(uint256 price) external onlyAdmin {
        // Allowing oracle to run and change the sale value
        sale.tokenPriceInAVAX = price;
        emit TokenPriceSet(price);
    }

    /**
     * @notice Function to postpone the sale
     */
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

    /**
     * @notice Function to extend registration period
     */
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

    /**
     * @notice Function to set max participation cap per round
     */
    function setCapPerRound(uint256[] calldata rounds, uint256[] calldata caps) external onlyAdmin {
        // Require that round has not already started
        require(
            block.timestamp < roundIdToRound[roundIds[0]].startTime,
            "1st round already started."
        );
        require(rounds.length == caps.length, "Invalid array length.");

        // Set max participation per round
        for (uint256 i = 0; i < rounds.length; i++) {
            require(caps[i] > 0, "Max participation can't be 0.");

            Round storage round = roundIdToRound[rounds[i]];
            round.maxParticipation = caps[i];

            emit MaxParticipationSet(rounds[i], round.maxParticipation);
        }
    }

    /**
     * @notice Function to deposit sale tokens
     * @dev Only sale moderator may deposit
     */
    function depositTokens() external onlyModerator ifUnlocked {
        // Require that setSaleParams was called
        require(
            sale.isCreated,
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

    /**
     * @notice Function to auto-participate for user via collateral
     */
    function autoParticipate(
        address user,
        uint256 amount,
        uint256 amountXavaToBurn,
        uint256 roundId
    ) external payable onlyCollateral {
        _participate(user, msg.value, amount, amountXavaToBurn, roundId, true, false);
    }

    /**
     * @notice Function to boost user's participation via collateral
     */
    function boostParticipation(
        address user,
        uint256 amountXavaToBurn
    ) external payable onlyCollateral {
        _participate(user, msg.value, 0, amountXavaToBurn, boosterRoundId, true, true);
    }

    /**
     * @notice Function to participate in sale manually
     */
    function participate(
        uint256 amount,
        uint256 amountXavaToBurn,
        uint256 roundId,
        bytes calldata signature
    ) external payable {
        require(msg.sender == tx.origin, "Only direct calls.");
        // Verify the signature
        require(
            verifySignature(
                keccak256(abi.encodePacked(msg.sender, amount, amountXavaToBurn, roundId, address(this))),
                signature
            ),
            "Invalid signature."
        );
        _participate(msg.sender, msg.value, amount, amountXavaToBurn, roundId, false, false);
    }

    /**
     * @notice Function to participate in sale with multiple variants
     */
    function _participate(
        address user,
        uint256 amountAVAX,
        uint256 amount,
        uint256 amountXavaToBurn,
        uint256 roundId,
        bool isCollateralCaller,
        bool isBooster
    ) internal {

        if (!isBooster) {
            // User must have registered for the round in advance
            require(
                addressToRoundRegisteredFor[user] == roundId,
                "Not registered for this round."
            );
            // Check user haven't participated before
            require(!isParticipated[user], "Already participated.");
        } else { // if (isBooster)
            // Check user has participated before
            require(isParticipated[user], "Only participated users.");
        }

        // Assert that
        require(
            roundId == getCurrentRound(),
            "Invalid round."
        );

        // Compute the amount of tokens user is buying
        uint256 amountOfTokensBuying =
            (amountAVAX).mul(uint(10) ** IERC20Metadata(address(sale.token)).decimals()).div(sale.tokenPriceInAVAX);

        if (!isCollateralCaller) {
            // Must buy more than 0 tokens
            require(amountOfTokensBuying > 0, "Can't buy 0 tokens");

            // Check in terms of user allo
            require(
                amountOfTokensBuying <= amount,
                "Exceeding allowance."
            );

            // Check for overflowing round's max participation
            require(
                amount <= roundIdToRound[roundId].maxParticipation,
                "Crossing max participation."
            );
        }

        // Require that amountOfTokensBuying is less than sale token leftover cap
        require(
            amountOfTokensBuying <= sale.amountOfTokensToSell.sub(sale.totalTokensSold),
            "Not enough tokens to sell."
        );

        // Increase amount of sold tokens
        sale.totalTokensSold = sale.totalTokensSold.add(amountOfTokensBuying);
        // Increase amount of AVAX raised
        sale.totalAVAXRaised = sale.totalAVAXRaised.add(amountAVAX);

        Participation storage p = userToParticipation[user];
        if (!isBooster) {
            initParticipationForUser(user, amountOfTokensBuying, amountAVAX, block.timestamp, roundId);
        } else { // if (isBooster)
            require(p.boostedAmountBought > 0, "Participation already boosted.");
        }

        if (roundId == stakingRoundId || roundId == boosterRoundId) { // Every round except validator
            // Burn XAVA from this user
            allocationStaking.redistributeXava(
                0,
                user,
                amountXavaToBurn
            );
        }

        uint256 lastPercent;
        uint256 lastAmount;
        // Compute portion amounts
        for(uint256 i = 0; i < numberOfVestedPortions; i++) {
            if (lastPercent != vestingPercentPerPortion[i]) {
                lastPercent = vestingPercentPerPortion[i];
                lastAmount = amountOfTokensBuying.mul(lastPercent).div(portionVestingPrecision);
            }
            p.portionAmounts[i] += lastAmount;
        }

        if (!isBooster) {
            // Mark user is participated
            isParticipated[user] = true;
            // Increment number of participants in the Sale.
            numberOfParticipants++;
            // Decrease of available registration fees
            registrationFees = registrationFees.sub(registrationDepositAVAX);
            // Transfer registration deposit amount in AVAX back to the users.
            sale.token.safeTransfer(user, registrationDepositAVAX);
            // Trigger events
            emit RegistrationAVAXRefunded(user, registrationDepositAVAX);
            emit TokensSold(user, amountOfTokensBuying);
        } else { // if (isBooster)
            // Add msg.value to boosted avax paid
            p.boostedAmountAVAXPaid = amountAVAX;
            // Add amountOfTokensBuying as boostedAmount
            p.boostedAmountBought = amountOfTokensBuying;
            // Increase total amount avax paid
            p.amountAVAXPaid = p.amountAVAXPaid.add(amountAVAX);
            // Increase total amount of tokens bought
            p.amountBought = p.amountBought.add(amountOfTokensBuying);
            // Emit participation boosted event
            emit ParticipationBoosted(user, amountAVAX, amountOfTokensBuying);
        }
    }

    function initParticipationForUser(
        address user,
        uint256 amountOfTokensBuying,
        uint256 amountAVAX,
        uint256 timeParticipated,
        uint256 roundId
    ) internal {
        userToParticipation[user] = Participation({
            amountBought: amountOfTokensBuying,
            amountAVAXPaid: amountAVAX,
            timeParticipated: timeParticipated,
            roundId: roundId,
            portionAmounts: _emptyUint256,
            portionStates: _emptyPortionStates,
            boostedAmountAVAXPaid: 0,
            boostedAmountBought: 0
        });
    }

    /**
     * @notice Function to withdraw unlocked portions to wallet or Dexalot portfolio
     */
    function withdrawMultiplePortions(uint256 [] calldata portionIds, bool toDexalot) external {

        if (toDexalot) {
            require(address(dexalotPortfolio) != address(0) && dexalotUnlockTime != 0, "Dexalot withdraw not supported.");
            require(block.timestamp >= dexalotUnlockTime, "Dexalot withdraw not unlocked.");
        }

        uint256 totalToWithdraw = 0;

        // Retrieve participation from storage
        Participation storage p = userToParticipation[msg.sender];

        for (uint256 i = 0; i < portionIds.length; i++) {
            uint256 portionId = portionIds[i];
            require(portionId < numberOfVestedPortions, "Invalid portion id.");

            bool eligible;

            if (
                p.portionStates[portionId] == PortionStates.Available && p.portionAmounts[portionId] > 0 && (
                    vestingPortionsUnlockTime[portionId] <= block.timestamp || (portionId == 0 && toDexalot)
                )
            ) eligible = true;

            if (eligible) {
                // Mark portion as withdrawn to dexalot
                if (!toDexalot) p.portionStates[portionId] = PortionStates.Withdrawn;
                else p.portionStates[portionId] = PortionStates.WithdrawnToDexalot;

                // Compute amount withdrawing
                uint256 amountWithdrawing = p
                    .amountBought
                    .mul(vestingPercentPerPortion[portionId])
                    .div(portionVestingPrecision);
                // Withdraw percent which is unlocked at that portion
                totalToWithdraw = totalToWithdraw.add(amountWithdrawing);
            }
        }

        if (totalToWithdraw > 0) {
            // Transfer tokens to user
            sale.token.safeTransfer(msg.sender, totalToWithdraw);
            // Trigger an event
            emit TokensWithdrawn(msg.sender, totalToWithdraw);

            if (toDexalot) {
                // Deposit tokens to dexalot contract - Withdraw from sale contract
                dexalotPortfolio.depositTokenFromContract(
                    msg.sender, getTokenSymbolBytes32(), totalToWithdraw
                );
                // Trigger an event
                emit TokensWithdrawnToDexalot(msg.sender, totalToWithdraw);
            }
        }
    }

    /**
     * @notice Function to add available portions to market
     */
    function addPortionsToMarket(uint256[] calldata portions, uint256[] calldata prices) external {
        // TODO: enforce requirement on other functions
        require(portions.length == prices.length);
        for(uint256 i = 0; i < portions.length; i++) {
            uint256 portionId = portions[i];
            require(userToParticipation[msg.sender].portionStates[portionId] == PortionStates.Available);
            userToParticipation[msg.sender].portionStates[portionId] = PortionStates.OnMarket;
        }
        marketplace.listPortions(msg.sender, portions, prices);
    }

    function removePortionsFromMarket(uint256[] calldata portions, uint256[] calldata prices) external {
        require(portions.length == prices.length);
        for(uint256 i = 0; i < portions.length; i++) {
            uint256 portionId = portions[i];
            require(userToParticipation[msg.sender].portionStates[portionId] == PortionStates.OnMarket);
            userToParticipation[msg.sender].portionStates[portionId] = PortionStates.Available;
        }
        marketplace.removePortions(msg.sender, portions);
    }

    /**
     * @notice Function to transfer portions from seller to buyer
     */
    function transferPortions(address seller, address buyer, uint256[] calldata portions) external {
        require(msg.sender == address(marketplace), "Restricted to marketplace.");
        Participation storage pSeller = userToParticipation[seller];
        Participation storage pBuyer = userToParticipation[buyer];
        if(pBuyer.amountBought == 0) {
            initParticipationForUser(buyer, 0, 0, 0, 0);
        }
        for(uint256 i = 0; i < portions.length; i++) {
            uint256 portionId = portions[i];
            require(pSeller.portionStates[portionId] == PortionStates.OnMarket, "Portion not available.");
            pSeller.portionStates[portionId] = PortionStates.Sold;
            PortionStates portionState = pBuyer.portionStates[portionId];
            // solve the edge case of portions on market
            require(portionState != PortionStates.OnMarket, "Can't buy portion with same id of one you put on market.");
            if(portionState == PortionStates.Available) {
                pBuyer.portionAmounts[portionId] += pSeller.portionAmounts[portionId];
            } else {
                pBuyer.portionAmounts[portionId] = pSeller.portionAmounts[portionId];
            }
        }
    }

    /**
     * @notice Function to withdraw all earnings and leftover
     */
    function withdrawEarningsAndLeftover(bool withdrawEarnings, bool withdrawLeftover) external onlyModerator {
        require(block.timestamp >= sale.saleEnd);
        if (withdrawEarnings) withdrawEarningsInternal();
        if (withdrawLeftover) withdrawLeftoverInternal();
    }

    /**
     * @notice Function to withdraw earnings
     */
    function withdrawEarningsInternal() internal  {
        // Make sure owner can't withdraw twice
        require(!sale.earningsWithdrawn);
        sale.earningsWithdrawn = true;
        // Earnings amount of the owner in AVAX
        uint256 totalProfit = sale.totalAVAXRaised;

        sale.token.safeTransfer(msg.sender, totalProfit);
    }

    /**
     * @notice Function to withdraw leftover
     */
    function withdrawLeftoverInternal() internal {
        // Make sure owner can't withdraw twice
        require(!sale.leftoverWithdrawn);
        sale.leftoverWithdrawn = true;

        // Amount of tokens which are not sold
        uint256 leftover = sale.amountOfTokensToSell.sub(sale.totalTokensSold);

        if (leftover > 0) {
            sale.token.safeTransfer(msg.sender, leftover);
        }
    }

    /**
     * @notice Function to withdraw registration fees by admin
     * @dev only after sale has ended and there is fund leftover
     */
    function withdrawRegistrationFees() external onlyAdmin {
        require(block.timestamp >= sale.saleEnd, "Sale is not over.");
        require(registrationFees > 0, "No fees accumulated.");

        // Transfer AVAX to the admin wallet
        sale.token.safeTransfer(msg.sender, registrationFees);
        registrationFees = 0;
    }

    /**
     * @notice Function to withdraw all unused funds by admin
     */
    function withdrawUnusedFunds() external onlyAdmin {
        uint256 balanceAVAX = address(this).balance;
        uint256 totalReservedForRaise = sale.earningsWithdrawn ? 0 : sale.totalAVAXRaised;

        sale.token.safeTransfer(
            msg.sender,
            balanceAVAX.sub(totalReservedForRaise.add(registrationFees))
        );
    }

    /**
     * @notice Function to verify admin signed signatures
     */
    function verifySignature(bytes32 hash, bytes memory signature) public view returns (bool) {
        return admin.isAdmin((hash.toEthSignedMessageHash()).recover(signature));
    }

    /**
     * @notice Function to get current active round
     * @dev Returns zero if sale hasn't start yet, or has already ended
     */
    function getCurrentRound() public view returns (uint256) {
        if (block.timestamp < roundIdToRound[roundIds[0]].startTime || block.timestamp >= sale.saleEnd) {
            return 0;
        }

        uint256 i = 0;
        while (
            (i + 1) < roundIds.length &&
            block.timestamp > roundIdToRound[roundIds[i + 1]].startTime
        ) {
            i++;
        }

        return roundIds[i];
    }

    /**
     * @notice Function to get participation for passed user address
     */
    function getParticipationArrays(address _user)
    external
    view
    returns (
        uint256[] memory,
        PortionStates[] memory
    )
    {
        Participation memory p = userToParticipation[_user];
        return (
            p.portionAmounts,
            p.portionStates
        );
    }

    /**
     * @notice Function to get number of registered users for sale
     */
    function getNumberOfRegisteredUsers() external view returns (uint256) {
        return registration.numberOfRegistrants;
    }

    /**
     * @notice Function to get vesting info
     */
    function getVestingInfo() external view returns (uint256[] memory, uint256[] memory){
        return (vestingPortionsUnlockTime, vestingPercentPerPortion);
    }

    /**
     * @notice Function to remove stuck tokens from contract
     */
    function removeStuckTokens(address token, address beneficiary, uint256 amount) external onlyAdmin {
        // Require that token address does not match with sale token
        require(token != address(sale.token), "Can't withdraw sale token.");
        // Safe transfer token from sale contract to beneficiary
        IERC20(token).safeTransfer(beneficiary, amount);
    }

    /**
     * @notice Function to parse token symbol as bytes32
     */
    function getTokenSymbolBytes32() internal view returns (bytes32 _symbol) {
        // Get token symbol
        string memory symbol = IERC20Metadata(address(sale.token)).symbol();
        // Parse token symbol to bytes32
        assembly {
            _symbol := mload(add(symbol, 32))
        }
    }

    /**
     * @notice Function which locks setters after initial configuration
     * @dev Contract lock can be activated only once and never unlocked
     */
    function activateLock(bytes memory signature) external onlyModerator ifUnlocked {
        // Require valid signature to activate lock
        require(
            verifySignature(keccak256(abi.encodePacked("Activate lock.", address(this))), signature),
            "Invalid signature."
        );
        // Lock the setters
        isLockOn = true;
        // Emit relevant event
        emit SettersLocked(block.timestamp);
    }

    /**
     * @notice Function to handle receiving AVAX
     */
    receive() external payable {}
}