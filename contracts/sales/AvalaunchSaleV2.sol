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

    // Round Types
    enum Rounds { None, Validator, Staking, Booster }
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
        uint256 amountAVAXPaid;              // Amount of $AVAX paid for tokens
        uint256 timeParticipated;            // Timestamp of participation time
        uint256 roundId;                     // Round user is registered for
        uint256[] portionAmounts;            // Amount of tokens for each portion
        PortionStates[] portionStates;       // State of each portion
        uint256 boostedAmountAVAXPaid;       // Amount of $AVAX paid for boost
        uint256 boostedAmountBought;         // Amount of tokens bought with boost
    }

    struct Registration {
        uint256 registrationTimeStarts;      // Registration start time
        uint256 registrationTimeEnds;        // Registration end time
        uint256 numberOfRegistrants;         // Number of registrants
    }

    struct Round {
        uint256 startTime;                   // Round start time
        uint256 maxParticipation;            // Maximum participation allowed
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
    // Max vesting time shift
    uint256 public maxVestingTimeShift;
    // Accounting total AVAX collected, after sale end admin can withdraw this
    uint256 public registrationFees;
    // Timestamp of sale.tokenPriceInAvax latest update
    uint256 public lastPriceUpdateTimestamp;
    // First vested portion's Dexalot unlock timestamp
    uint256 public dexalotUnlockTime;
    // Sale setter lock flag
    bool public isLockOn;

    // Empty global arrays for cheaper participation initialization
    PortionStates[] private _emptyPortionStates;
    uint256[] private _emptyUint256;

    // Registration deposit AVAX, deposited during the registration, returned after the participation.
    uint256 private constant registrationDepositAVAX = 1 ether;

    // Events
    event TokensSold(address user, uint256 amount);
    event UserRegistered(address user, uint256 roundId);
    event NewTokenPriceSet(uint256 newPrice);
    event MaxParticipationSet(uint256 roundId, uint256 maxParticipation);
    event TokensWithdrawn(address user, uint256 amount);
    event SaleCreated(address saleOwner, uint256 tokenPriceInAVAX, uint256 amountOfTokensToSell, uint256 saleEnd);
    event SaleTokenSet(address indexed saleToken, uint256 timestamp);
    event RegistrationTimeSet(uint256 registrationTimeStarts, uint256 registrationTimeEnds);
    event RoundAdded(uint256 roundId, uint256 startTime, uint256 maxParticipation);
    event RegistrationAVAXRefunded(address user, uint256 amountRefunded);
    event TokensWithdrawnToDexalot(address user, uint256 amount);
    event LockActivated(uint256 time);
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

        factory = ISalesFactory(msg.sender);
        admin = IAdmin(_admin);
        allocationStaking = IAllocationStaking(_allocationStaking);
        collateral = ICollateral(_collateral);
        marketplace = IAvalaunchMarketplace(_marketplace);
    }

    /**
     * @notice Function to set vesting params
     * @param _unlockingTimes is array of unlock times for each portion
     * @param _percents are percents of purchased tokens that are distributed among portions
     * @param _maxVestingTimeShift is maximal possible time shift for portion unlock times
     */
    function setVestingParams(
        uint256[] calldata _unlockingTimes,
        uint256[] calldata _percents,
        uint256 _maxVestingTimeShift
    )
    external
    onlyAdmin
    {
        require(_unlockingTimes.length == _percents.length);
        require(vestingPercentPerPortion.length == 0 && vestingPortionsUnlockTime.length == 0, "Already set.");
        require(_maxVestingTimeShift <= 30 days, "Maximal shift is 30 days.");
        require(portionVestingPrecision != 0, "Sale params not set.");

        // Set max vesting time shift
        maxVestingTimeShift = _maxVestingTimeShift;
        // Set number of vested portions
        numberOfVestedPortions = _unlockingTimes.length;
        // Create empty arrays with slot number of numberOfVestedPortions
        _emptyPortionStates = new PortionStates[](numberOfVestedPortions);
        _emptyUint256 = new uint256[](numberOfVestedPortions);

        // Require that locking times are later than sale end
        require(_unlockingTimes[0] > sale.saleEnd, "Invalid first unlock time.");
        // Use precision to make sure percents of portions align
        uint256 precision = portionVestingPrecision;
        // Set vesting portions percents and unlock times
        for (uint256 i = 0; i < numberOfVestedPortions; i++) {
            if (i > 0) {
                // Each portion unlock time must be latter than previous
                require(_unlockingTimes[i] > _unlockingTimes[i-1], "Invalid unlock time.");
            }
            vestingPortionsUnlockTime.push(_unlockingTimes[i]);
            vestingPercentPerPortion.push(_percents[i]);
            precision = precision.sub(_percents[i]);
        }
        require(precision == 0, "Invalid percentage calculation.");
    }

    /**
     * @notice Function to shift vested portion unlock times externally by admin
     * @param timeToShift is amount of time to add to all portion unlock times
     */
    function shiftVestingUnlockingTimes(uint256 timeToShift) external onlyAdmin {
        _shiftVestingUnlockingTimes(timeToShift);
    }

    /**
     * @notice Function to shift vested portion unlock times internally
     * @param timeToShift is amount of time to add to all portion unlock times
     */
    function _shiftVestingUnlockingTimes(uint256 timeToShift) internal {
        require(timeToShift > 0 && timeToShift < maxVestingTimeShift, "Invalid shift time.");

        bool movable;
        // Shift the unlock time for each portion
        for (uint256 i = 0; i < numberOfVestedPortions; i++) {
            // Shift only portions that time didn't reach yet
            if (!movable && block.timestamp < vestingPortionsUnlockTime[i]) movable = true;
            // Each portion is after the previous so once movable flag is active all latter portions may be shifted
            if (movable) {
                vestingPortionsUnlockTime[i] = vestingPortionsUnlockTime[i].add(
                    timeToShift
                );
            }
        }
    }

    /**
     * @notice Function to set fundamental sale parameters
     * @param _token is official sale token, may be set asynchronously too
     * @param _moderator is unique wallet used for each sale which has authorized access to fundamental functions
     * @param _tokenPriceInAVAX is token price in $AVAX, dynamically set by admin every 'n' minutes
     * @param _amountOfTokensToSell is amount of tokens that will be deposited to sale contract and available to buy
     * @param _saleEnd is timestamp of sale end
     * @param _portionVestingPrecision is precision rate for vested portion percents
     */
    function setSaleParams(
        address _token,
        address _moderator,
        uint256 _tokenPriceInAVAX,
        uint256 _amountOfTokensToSell,
        uint256 _saleEnd,
        uint256 _portionVestingPrecision
    )
    external
    onlyAdmin
    {
        require(!sale.isCreated, "Sale already created.");
        require(_moderator != address(0), "Invalid moderator address.");
        require(_portionVestingPrecision >= 100, "Invalid vesting precision.");
        require(
            _tokenPriceInAVAX != 0 && _amountOfTokensToSell != 0 && _saleEnd > block.timestamp,
            "Invalid input."
        );

        // Set sale params
        sale.isCreated = true;
        sale.token = IERC20(_token);
        sale.moderator = _moderator;
        sale.tokenPriceInAVAX = _tokenPriceInAVAX;
        sale.amountOfTokensToSell = _amountOfTokensToSell;
        sale.saleEnd = _saleEnd;

        // Set portion vesting precision
        portionVestingPrecision = _portionVestingPrecision;

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
     * @param _dexalotPortfolio is official Dexalot Portfolio contract address
     * @param _dexalotUnlockTime is unlock time for first portion withdrawal to Dexalot Portfolio
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
     * @param saleToken is official token of the project
     * @dev Retroactive calls are option for teams which do not have token at the moment of sale launch
     */
    function setSaleToken(
        address saleToken
    )
    external
    onlyAdmin
    ifUnlocked
    {
        require(address(sale.token) == address(0));
        sale.token = IERC20(saleToken);
        emit SaleTokenSet(saleToken, block.timestamp);
    }

    /**
     * @notice Function to set registration period parameters
     * @param _registrationTimeStarts is timestamp of registration start
     * @param _registrationTimeEnds is timestamp of registration end
     */
    function setRegistrationTime(
        uint256 _registrationTimeStarts,
        uint256 _registrationTimeEnds
    )
    external
    onlyAdmin
    ifUnlocked
    {
        // Require that the sale is created and registration timestamps are correct
        require(sale.isCreated);
        require(_registrationTimeStarts >= block.timestamp && _registrationTimeEnds > _registrationTimeStarts);
        if (roundIds.length > 0) require(_registrationTimeEnds < roundIdToRound[roundIds[0]].startTime);
        require(_registrationTimeEnds < sale.saleEnd);

        // Set registration start and end time
        registration.registrationTimeStarts = _registrationTimeStarts;
        registration.registrationTimeEnds = _registrationTimeEnds;

        // Emit event
        emit RegistrationTimeSet(
            registration.registrationTimeStarts,
            registration.registrationTimeEnds
        );
    }

    /**
     * @notice Function to set round configuration for the upcoming sale
     * @param startTimes are starting times for each round of the sale
     * @param maxParticipations are maximum allowed participations for each round
     */
    function setRounds(
        uint256[] calldata startTimes,
        uint256[] calldata maxParticipations
    )
    external
    onlyAdmin
    {
        require(startTimes.length == maxParticipations.length);
        require(sale.isCreated);
        require(roundIds.length == 0, "Rounds already set.");
        require(startTimes.length > 0);
        require(startTimes[0] > registration.registrationTimeEnds);
        require(startTimes[0] >= block.timestamp);

        uint256 lastTimestamp = 0;
        // Set rounds and their caps
        for (uint256 i = 0; i < startTimes.length; i++) {
            require(startTimes[i] < sale.saleEnd);
            require(maxParticipations[i] > 0);
            // Make sure each round is latter than previous
            require(startTimes[i] > lastTimestamp);
            lastTimestamp = startTimes[i];

            // Compute round id, starting from 1 (0 is none)
            uint256 roundId = i + 1;
            // Push round id to array of ids
            roundIds.push(roundId);
            // Create round
            Round memory round = Round(startTimes[i], maxParticipations[i]);
            // Map round id to round
            roundIdToRound[roundId] = round;

            // Emit event
            emit RoundAdded(roundId, round.startTime, round.maxParticipation);
        }
    }

    /**
     * @notice Function to register for the upcoming sale
     * @param signature is pass for sale registration provided by admins
     * @param signatureExpirationTimestamp is timestamp after which signature is no longer valid
     * @param roundId is id of round user is registering for
     */
    function registerForSale(
        bytes memory signature,
        uint256 signatureExpirationTimestamp,
        uint256 roundId
    )
    external
    payable
    {
        // Sale registration validity checks
        require(msg.value == registrationDepositAVAX, "Invalid deposit amount.");
        require(roundId != 0 && roundId <= uint8(Rounds.Staking), "Invalid round id.");
        require(
            block.timestamp >= registration.registrationTimeStarts &&
            block.timestamp <= registration.registrationTimeEnds,
            "Registration is closed."
        );
        require(block.timestamp <= signatureExpirationTimestamp, "Signature expired.");
        require(addressToRoundRegisteredFor[msg.sender] == 0, "Already registered.");

        // Make sure signature is signed by admin, with proper parameters
        checkSignatureValidity(
            keccak256(abi.encodePacked(signatureExpirationTimestamp, msg.sender, roundId, address(this))),
            signature
        );

        // Set user's registration round
        addressToRoundRegisteredFor[msg.sender] = roundId;

        // Locking tokens for participants of staking round until the sale ends
        if (roundId == uint8(Rounds.Staking)) {
            allocationStaking.setTokensUnlockTime(
                0,
                msg.sender,
                sale.saleEnd
            );
        }
        // Increment number of registered users
        registration.numberOfRegistrants++;
        // Increase earnings from registration fees
        registrationFees += msg.value;
        // Emit event
        emit UserRegistered(msg.sender, roundId);
    }

    /**
     * @notice Function to update token price in $AVAX to match real time value of token
     * @param price is token price in $AVAX to be set
     * @dev To help us reduce reliance on $AVAX volatility, oracle will update price during sale every 'n' minutes (n>=5)
     */
    function updateTokenPriceInAVAX(uint256 price) external onlyAdmin {
        // Compute 30% of the current token price
        uint256 thirtyPercent = sale.tokenPriceInAVAX.mul(30).div(100);
        // Require that new price is under 30% difference compared to current
        require(
            sale.tokenPriceInAVAX.add(thirtyPercent) > price && sale.tokenPriceInAVAX - thirtyPercent < price,
            "Price out of range."
        );
        require(lastPriceUpdateTimestamp + 5 minutes < block.timestamp);
        // Set new token price via internal call
        setNewTokenPrice(price);
    }

    /**
     * @notice Function to set new token price by moderator
     * @dev Works only until setter lock becomes active
     */
    function overrideTokenPrice(uint256 price) external onlyModerator ifUnlocked {
        // Set new token price via internal call
        setNewTokenPrice(price);
    }

    /**
     * @notice Function for internal set of token price in $AVAX
     */
    function setNewTokenPrice(uint256 price) internal {
        // Update parameters
        sale.tokenPriceInAVAX = price;
        lastPriceUpdateTimestamp = block.timestamp;
        // Emit event
        emit NewTokenPriceSet(price);
    }

    // ------------------------------------ Reached this point --------------------------------------------- //

    /**
     * @notice Function to postpone the sale rounds externally by admin
     * @param timeToShift is time increase to rounds start time
     */
    function postponeSaleRounds(uint256 timeToShift) external onlyAdmin {
        _postponeSaleRounds(timeToShift);
    }

    /**
     * @notice Function to postpone the sale rounds internally
     * @param timeToShift is time increase to rounds start time
     * @dev Function will also shift vesting unlock times if sale end crosses first unlock time
     */
    function _postponeSaleRounds(uint256 timeToShift) internal {
        require(block.timestamp < sale.saleEnd);

        uint256 lastRoundStartTime;
        uint256 lastRoundSaleEndDiff;
        uint256 saleEndDexalotUnlockDiff;
        uint256 saleEndFirstUnlockDiff = vestingPortionsUnlockTime[0].sub(sale.saleEnd);

        if (dexalotUnlockTime > sale.saleEnd) {
            saleEndDexalotUnlockDiff = dexalotUnlockTime - sale.saleEnd;
        }

        uint256 i = getCurrentRound();
        // Iterate through all registered rounds and postpone them
        for (; i < roundIds.length; i++) {
            Round storage round = roundIdToRound[roundIds[i]];
            uint256 newStartTime = round.startTime.add(timeToShift);

            if ((i + 1) == roundIds.length) {
                lastRoundSaleEndDiff = sale.saleEnd.sub(round.startTime);
                lastRoundStartTime = newStartTime;
            }
            round.startTime = newStartTime;
        }

        sale.saleEnd = lastRoundStartTime.add(lastRoundSaleEndDiff);
        if (sale.saleEnd > vestingPortionsUnlockTime[0]) {
            _shiftVestingUnlockingTimes(saleEndFirstUnlockDiff.add(sale.saleEnd - vestingPortionsUnlockTime[0]));
        }

        if (saleEndDexalotUnlockDiff != 0) dexalotUnlockTime = sale.saleEnd.add(saleEndDexalotUnlockDiff);
    }

    /**
     * @notice Function to extend registration period
     */
    function extendRegistrationPeriod(uint256 startTimestampIncrease, uint256 endTimestampIncrease) external onlyAdmin {

        if (startTimestampIncrease > 0 && block.timestamp < registration.registrationTimeStarts) {
            registration.registrationTimeStarts = registration.registrationTimeStarts.add(startTimestampIncrease);
        }

        if (endTimestampIncrease > 0 && block.timestamp < registration.registrationTimeEnds) {
            uint256 extendedRegistrationTime = registration.registrationTimeEnds.add(endTimestampIncrease);
            uint256 firstRoundStartTime = roundIdToRound[roundIds[0]].startTime;

            if (extendedRegistrationTime > firstRoundStartTime) {
                _postponeSaleRounds(extendedRegistrationTime - firstRoundStartTime);
            }

            registration.registrationTimeEnds = extendedRegistrationTime;
        }
    }

    /**
     * @notice Function to set max participation cap per round
     */
    function setCapPerRound(
        uint256[] calldata rounds,
        uint256[] calldata caps
    )
    external
    onlyAdmin
    {
        require(rounds.length == caps.length);
        // Require that round has not already started
        require(
            block.timestamp < roundIdToRound[roundIds[0]].startTime,
            "Rounds already started."
        );

        // Set max participation per round
        for (uint256 i = 0; i < rounds.length; i++) {
            require(caps[i] > 0, "Invalid cap.");

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
        require(sale.isCreated && address(sale.token) != address(0));

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
        _participate(user, amount, amountXavaToBurn, roundId);
    }

    /**
     * @notice Function to boost user's participation via collateral
     */
    function boostParticipation(
        address user,
        uint256 amountXavaToBurn
    ) external payable onlyCollateral {
        _participate(user, 0, amountXavaToBurn, uint256(Rounds.Booster));
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
        // Make sure admin signature is valid
        checkSignatureValidity(
            keccak256(abi.encodePacked(msg.sender, amount, amountXavaToBurn, roundId, address(this))),
            signature
        );
        _participate(msg.sender, amount, amountXavaToBurn, roundId);
    }

    /**
     * @notice Function to participate in sale with multiple variants
     */
    function _participate(
        address user,
        uint256 amount,
        uint256 amountXavaToBurn,
        uint256 roundId
    ) internal {

        require(roundId == getCurrentRound(), "Invalid round.");

        bool isCollateralCaller = msg.sender == address(collateral);
        bool isBooster = roundId == uint8(Rounds.Booster);

        if (!isBooster) {
            // User must have registered for the round in advance
            require(addressToRoundRegisteredFor[user] == roundId, "Not registered for this round.");
            // Check user haven't participated before
            require(!isParticipated[user], "Already participated.");
        } else { // if (isBooster)
            // Check user has participated before
            require(isParticipated[user], "Only participated users.");
        }

        // Compute the amount of tokens user is buying
        uint256 amountOfTokensBuying =
            (msg.value).mul(uint(10) ** IERC20Metadata(address(sale.token)).decimals()).div(sale.tokenPriceInAVAX);

        if (!isCollateralCaller) {
            // Must buy more than 0 tokens
            require(amountOfTokensBuying > 0, "Can't buy 0 tokens");
            // Check in terms of user allo
            require(amountOfTokensBuying <= amount, "Exceeding allowance.");
            // Check for overflowing round's max participation
            require(amount <= roundIdToRound[roundId].maxParticipation, "Crossing max participation.");
        }

        // Require that amountOfTokensBuying is less than sale token leftover cap
        require(amountOfTokensBuying <= sale.amountOfTokensToSell.sub(sale.totalTokensSold), "Out of tokens.");
        // Increase amount of sold tokens
        sale.totalTokensSold = sale.totalTokensSold.add(amountOfTokensBuying);
        // Increase amount of AVAX raised
        sale.totalAVAXRaised = sale.totalAVAXRaised.add(msg.value);

        Participation storage p = userToParticipation[user];
        if (!isBooster) {
            initParticipationForUser(user, amountOfTokensBuying, msg.value, block.timestamp, roundId);
        } else { // if (isBooster)
            require(p.boostedAmountBought == 0, "Already boosted.");
        }

        if (roundId == uint8(Rounds.Staking) || isBooster) { // Every round except validator
            // Burn XAVA from this user
            allocationStaking.redistributeXava(
                0,
                user,
                amountXavaToBurn
            );
        }

        uint256 lastPercent; uint256 lastAmount;
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
            p.boostedAmountAVAXPaid = msg.value;
            // Add amountOfTokensBuying as boostedAmount
            p.boostedAmountBought = amountOfTokensBuying;
            // Emit participation boosted event
            emit ParticipationBoosted(user, msg.value, amountOfTokensBuying);
        }
    }

    /**
     * @notice function to initialize participation structure for user
     */
    function initParticipationForUser(
        address user,
        uint256 amountBought,
        uint256 amountAVAXPaid,
        uint256 timeParticipated,
        uint256 roundId
    ) internal {
        userToParticipation[user] = Participation({
            amountBought: amountBought,
            amountAVAXPaid: amountAVAXPaid,
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
    function withdrawMultiplePortions(uint256[] calldata portionIds, bool toDexalot) external {

        if (toDexalot) {
            require(address(dexalotPortfolio) != address(0) && dexalotUnlockTime != 0, "Dexalot withdraw not supported.");
            require(block.timestamp >= dexalotUnlockTime, "Dexalot withdraw locked.");
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
        require(portions.length == prices.length);
        for(uint256 i = 0; i < portions.length; i++) {
            Participation storage p = userToParticipation[msg.sender];
            uint256 portionId = portions[i];
            require(
                p.portionStates[portionId] == PortionStates.Available && p.portionAmounts[portionId] > 0,
                "Portion unavailable."
            );
            p.portionStates[portionId] = PortionStates.OnMarket;
        }
        marketplace.listPortions(msg.sender, portions, prices);
    }

    /**
     * @notice Function to remove portions from market
     */
    function removePortionsFromMarket(uint256[] calldata portions) external {
        for(uint256 i = 0; i < portions.length; i++) {
            Participation storage p = userToParticipation[msg.sender];
            require(p.portionStates[portions[i]] == PortionStates.OnMarket, "Portion not on market.");
            p.portionStates[portions[i]] = PortionStates.Available;
        }
        marketplace.removePortions(msg.sender, portions);
    }

    /**
     * @notice Function to transfer portions from seller to buyer
     */
    function transferPortions(address seller, address buyer, uint256[] calldata portions) external {
        require(msg.sender == address(marketplace), "Marketplace only.");
        Participation storage pSeller = userToParticipation[seller];
        Participation storage pBuyer = userToParticipation[buyer];
        if(pBuyer.amountBought == 0) {
            initParticipationForUser(buyer, 0, 0, 0, 0);
        }
        for(uint256 i = 0; i < portions.length; i++) {
            uint256 portionId = portions[i];
            require(pSeller.portionStates[portionId] == PortionStates.OnMarket, "Portion unavailable.");
            pSeller.portionStates[portionId] = PortionStates.Sold;
            PortionStates portionState = pBuyer.portionStates[portionId];
            /* case 1: portion with same id is on market
               case 2: portion is available
               case 3: portion is unavailable (withdrawn or sold) */
            require(portionState != PortionStates.OnMarket, "Can't buy portion with same id you listed on market.");
            if (portionState == PortionStates.Available) {
                pBuyer.portionAmounts[portionId] += pSeller.portionAmounts[portionId];
            } else {
                pBuyer.portionAmounts[portionId] = pSeller.portionAmounts[portionId];
                pBuyer.portionStates[portionId] = PortionStates.Available;
            }
        }
    }

    /**
     * @notice Function to withdraw sale earnings and/or leftover
     */
    function withdrawEarningsAndLeftover(bool withdrawEarnings, bool withdrawLeftover) external onlyModerator {
        require(block.timestamp >= sale.saleEnd);
        uint256 total;
        if (withdrawEarnings) total += withdrawEarningsInternal();
        if (withdrawLeftover) total += withdrawLeftoverInternal();
        sale.token.safeTransfer(msg.sender, total);
    }

    /**
     * @notice Function to withdraw earnings
     */
    function withdrawEarningsInternal() internal returns (uint256 totalProfit) {
        // Make sure owner can't withdraw twice
        require(!sale.earningsWithdrawn);
        sale.earningsWithdrawn = true;
        // Earnings amount of the owner in AVAX
        totalProfit = sale.totalAVAXRaised;
    }

    /**
     * @notice Function to withdraw leftover
     */
    function withdrawLeftoverInternal() internal returns (uint256 leftover) {
        // Make sure owner can't withdraw twice
        require(!sale.leftoverWithdrawn);
        sale.leftoverWithdrawn = true;
        // Amount of tokens which are not sold
        leftover = sale.amountOfTokensToSell.sub(sale.totalTokensSold);
    }

    /**
     * @notice Function to withdraw registration fees by admin
     * @dev only after sale has ended and there is fund leftover
     */
    function withdrawRegistrationFees() external onlyAdmin {
        require(block.timestamp >= sale.saleEnd, "Sale isn't over.");
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
    function checkSignatureValidity(bytes32 hash, bytes memory signature) internal view {
        require(
            admin.isAdmin((hash.toEthSignedMessageHash()).recover(signature)),
            "Invalid signature."
        );
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
    function getParticipationAmountsAndStates(address user)
    external
    view
    returns (uint256[] memory, PortionStates[] memory) {
        Participation memory p = userToParticipation[user];
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
    function getVestingInfo() external view returns (uint256[] memory, uint256[] memory) {
        return (vestingPortionsUnlockTime, vestingPercentPerPortion);
    }

    /**
     * @notice Function to remove stuck tokens from contract
     */
    function removeStuckTokens(address token, address beneficiary, uint256 amount) external onlyAdmin {
        // Require that token address does not match with sale token
        require(token != address(sale.token));
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
        // Make sure admin signature is valid
        checkSignatureValidity(keccak256(abi.encodePacked("Activate lock.", address(this))), signature);
        // Lock the setters
        isLockOn = true;
        // Emit relevant event
        emit LockActivated(block.timestamp);
    }

    /**
     * @notice Function to handle receiving AVAX
     */
    receive() external payable {}
}