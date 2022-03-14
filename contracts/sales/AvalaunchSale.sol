//"SPDX-License-Identifier: UNLICENSED"
pragma solidity 0.6.12;

import "../interfaces/IAdmin.sol";
import "../interfaces/ISalesFactory.sol";
import "../interfaces/IAllocationStaking.sol";
import "../interfaces/IERC20Metadata.sol";
import "../interfaces/IDexalotPortfolio.sol";
import "../interfaces/ICollateral.sol";
import "../interfaces/IAvalaunchSale.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./SaleVault.sol";
import "../libraries/ParticipationLib.sol";
import "../libraries/SaleLib.sol";
import "../libraries/RegistrationLib.sol";
import "../libraries/DexalotLib.sol";
import "../libraries/VestingLib.sol";

contract AvalaunchSale is IAvalaunchSale, Initializable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using ParticipationLib for ParticipationLib.Participation;
    using SaleLib for SaleLib.Sale;
    using RegistrationLib for RegistrationLib.Registration;
    using RegistrationLib for RegistrationLib.Round;
    using DexalotLib for DexalotLib.DexalotConfig;
    using VestingLib for VestingLib.VestingConfig;

    // Pointer to Allocation staking contract, where burnXavaFromUser will be called.
    IAllocationStaking public allocationStakingContract;
    // Pointer to sales factory contract
    ISalesFactory public factory;
    // Admin contract
    IAdmin public admin;
    // Sale Vault NFT contract
    SaleVault public saleVault;
    // Avalaunch collateral contract
    ICollateral public collateral;

    // Sale
    SaleLib.Sale public sale;
    // Registration
    RegistrationLib.Registration public registration;
    // Dexalot configs
    DexalotLib.DexalotConfig public dexalotConfig;
    // Vesting configs
    VestingLib.VestingConfig public vestingConfig;

    // Array storing IDS of rounds (IDs start from 1, so they can't be mapped as array indexes
    uint256[] public roundIds;
    // Mapping round Id to round
    mapping(uint256 => RegistrationLib.Round) public roundIdToRound;
    // Mapping user to his participation
    mapping(address => ParticipationLib.Participation) public userToParticipation;
    // User to round for which he registered
    mapping(address => uint256) public addressToRoundRegisteredFor;
    // mapping if user is participated or not
    mapping(address => bool) public isParticipated;
    // Mapping vault ID to his participation
    mapping(uint256 => ParticipationLib.Participation) public vaultToParticipation;
    // Vault ID to round for which he registered
    mapping(uint256 => uint256) public vaultToRoundRegisteredFor;
    // mapping if vault is participated or not
    mapping(uint256 => bool) public isVaultParticipated;
    // Added configurable round ID for staking round
    uint256 public stakingRoundId;

    // Token price in AVAX latest update timestamp
    uint256 updateTokenPriceInAVAXLastCallTimestamp;

    // Sale setter gate flag
    bool public gateClosed;

    // constants
    uint256 public constant MAX_INT = 2**256 - 1;

    // Restricting calls only to sale owner
    modifier onlySaleOwner() {
        require(msg.sender == sale.saleOwner, "OnlySaleOwner:: Restricted");
        _;
    }

    // Restricting calls only to sale admin
    modifier onlyAdmin() {
        require(admin.isAdmin(msg.sender), "Only admin can call this function.");
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

    // Constructor replacement for upgradable contracts
    function initialize(
        address _admin,
        address _allocationStaking,
        address _saleVault,
        address _collateral
    ) public initializer {
        require(_admin != address(0));
        require(_allocationStaking != address(0));
        admin = IAdmin(_admin);
        factory = ISalesFactory(msg.sender);
        allocationStakingContract = IAllocationStaking(_allocationStaking);
        saleVault = SaleVault(_saleVault);
        collateral = ICollateral(_collateral);
    }

    /// @notice         Function to set vesting params
    function setVestingParams(
        uint256[] memory _unlockingTimes,
        uint256[] memory _percents,
        uint256 _maxVestingTimeShift
    ) external onlyAdmin {
        vestingConfig.setParams(_unlockingTimes, _percents, _maxVestingTimeShift, sale.saleEnd);
    }

    /// @notice     Admin function to shift vesting unlocking times
    function shiftVestingUnlockingTimes(uint256 timeToShift) external onlyAdmin {
        vestingConfig.shiftUnlockingTimes(timeToShift);
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
    ) external onlyAdmin {
        sale.setParams(
            _token,
            _saleOwner,
            _tokenPriceInAVAX,
            _amountOfTokensToSell,
            _saleEnd,
            _stakingRoundId,
            _tokenPriceInUSD
        );
        // Deposit in AVAX, sent during the registration
        registration.registrationDepositAVAX = _registrationDepositAVAX;
        // Set portion vesting precision
        vestingConfig.setPrecision(_portionVestingPrecision);
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

    function setAndSupportDexalotPortfolio(address _dexalotPortfolio, uint256 _dexalotUnlockTime) external onlyAdmin {
        dexalotConfig.setParams(_dexalotPortfolio, _dexalotUnlockTime);
    }

    // @notice     Function to retroactively set sale token address, can be called only once,
    //             after initial contract creation has passed. Added as an options for teams which
    //             are not having token at the moment of sale launch.
    function setSaleToken(address saleToken) external onlyAdmin onlyIfGateOpen {
        sale.setToken(saleToken);
    }

    function getFirstRoundStartTime() internal view returns (uint256) {
        return roundIds.length > 0 ? roundIdToRound[roundIds[0]].startTime : MAX_INT;
    }

    /// @notice     Function to set registration period parameters
    function setRegistrationTime(uint256 _registrationTimeStarts, uint256 _registrationTimeEnds)
        external
        onlyAdmin
        onlyIfGateOpen
    {
        // Require that the sale is created
        require(sale.isCreated);
        require(_registrationTimeEnds < sale.saleEnd);

        // Set registration start and end time
        registration.setTimes(_registrationTimeStarts, _registrationTimeEnds, getFirstRoundStartTime());

        emit RegistrationTimeSet(registration.registrationTimeStarts, registration.registrationTimeEnds);
    }

    /// @notice     Setting rounds for sale.
    // Size: 0.656 KB
    function setRounds(uint256[] calldata startTimes, uint256[] calldata maxParticipations) external onlyAdmin {
        require(sale.isCreated);
        require(startTimes.length == maxParticipations.length, "setRounds: Bad input.");
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
            RegistrationLib.Round memory round = RegistrationLib.Round(startTimes[i], maxParticipations[i]);

            // Map round id to round
            roundIdToRound[roundId] = round;

            // Fire event
            emit RoundAdded(roundId, round.startTime, round.maxParticipation);
        }
    }

    /// @notice     Registration for sale.
    /// @param      signature is the message signed by the backend
    /// @param      roundId is the round for which user expressed interest to participate
    function registerForSale(bytes memory signature, uint256 roundId) external payable {
        require(roundId != 0, "Round ID can not be 0.");
        require(roundId <= roundIds.length, "Invalid round id");
        require(addressToRoundRegisteredFor[msg.sender] == 0, "User can not register twice.");
        require(checkRegistrationSignature(signature, msg.sender, roundId), "Invalid signature");

        // Rounds are 1,2,3
        addressToRoundRegisteredFor[msg.sender] = roundId;
        // Special cases for staking round
        if (roundId == stakingRoundId) {
            // Lock users stake
            allocationStakingContract.setTokensUnlockTime(0, msg.sender, sale.saleEnd);
        }
        registration.register();
        // Emit Registration event
        emit UserRegistered(msg.sender, roundId);
    }

    /// @notice     Admin function, to update token price before sale to match the closest $ desired rate.
    /// @dev        This will be updated with an oracle during the sale every N minutes, so the users will always
    ///             pay initialy set $ value of the token. This is to reduce reliance on the AVAX volatility.
    function updateTokenPriceInAVAX(uint256 price) external onlyAdmin {
        // Require that 'N' time has passed since last call
        if (sale.tokenPriceInAVAX != 0) {
            require(
                updateTokenPriceInAVAXLastCallTimestamp.add(
                    sale.updateTokenPriceInAVAXTimeLimit
                ) < block.timestamp,
                "Not enough time passed since last call."
            );
        }
        sale.updateTokenPrice(price);
        // Set latest call time to current timestamp
        updateTokenPriceInAVAXLastCallTimestamp = block.timestamp;

        emit TokenPriceSet(price);
    }

    /// @notice     Admin function to postpone the sale
    function postponeSale(uint256 timeToShift) external onlyAdmin {
        uint256 firstRoundStartTime = getFirstRoundStartTime();
        require(firstRoundStartTime != MAX_INT, "Rounds are not set.");
        require(block.timestamp < firstRoundStartTime, "1st round already started.");
        // Iterate through all registered rounds and postpone them
        for (uint256 i = 0; i < roundIds.length; i++) {
            roundIdToRound[roundIds[i]].postponeRound(timeToShift, sale.saleEnd);
        }
        // May emit event here.
    }

    /// @notice     Function to extend registration period
    function extendRegistrationPeriod(uint256 timeToAdd) external onlyAdmin {
        registration.extendRegistration(timeToAdd, getFirstRoundStartTime());
    }

    /// @notice     Admin function to set max participation cap per round
    function setCapPerRound(uint256[] calldata rounds, uint256[] calldata caps) external onlyAdmin {
        // Require that round has not already started
        require(block.timestamp < getFirstRoundStartTime(), "1st round already started.");
        require(rounds.length == caps.length, "Arrays length is different.");

        // Set max participation per round
        for (uint256 i = 0; i < rounds.length; i++) {
            require(caps[i] > 0, "Can't set max participation to 0");

            RegistrationLib.Round storage round = roundIdToRound[rounds[i]];
            round.maxParticipation = caps[i];

            emit MaxParticipationSet(rounds[i], round.maxParticipation);
        }
    }

    // Function for owner to deposit tokens, can be called only once.
    function depositTokens() external onlySaleOwner onlyIfGateOpen {
        sale.deposit();
    }

    // Participate function for collateral auto-buy
    function autoParticipate(
        address user,
        uint256 amount,
        uint256 amountXavaToBurn,
        uint256 roundId
    ) external payable override {
        require(msg.sender == address(collateral), "Only collateral contract may call this function.");
        require(admin.isAdmin(tx.origin), "Call must originate from an admin.");
        _participate(user, msg.value, amount, amountXavaToBurn, roundId);
    }

    // Participate function for manual participation
    function participate(
        bytes calldata signature,
        uint256 amount,
        uint256 amountXavaToBurn,
        uint256 roundId,
        uint256 signatureExpirationTimestamp
    ) external payable {
        require(msg.sender == tx.origin, "Allow only direct calls.");
        // Require that user doesn't have autoBuy activated
        require(
            !collateral.saleAutoBuyers(address(this), msg.sender),
            "Cannot participate manually, autoBuy activated."
        );
        // Check if signature has expired
        require(block.timestamp < signatureExpirationTimestamp, "Signature expired.");
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
        _participate(msg.sender, msg.value, amount, amountXavaToBurn, roundId);
    }

    // Function to participate in the sales
    function _participate(
        address user,
        uint256 amountAVAX,
        uint256 amount,
        uint256 amountXavaToBurn,
        uint256 roundId
    ) internal {
        require(roundId != 0, "Round can not be 0.");

        require(
            amount <= roundIdToRound[roundId].maxParticipation,
            "Overflowing maximal participation for this round."
        );

        // User must have registered for the round in advance
        require(addressToRoundRegisteredFor[user] == roundId, "Not registered for this round");

        // Check user haven't participated before
        require(!isParticipated[user], "User can participate only once.");

        // Get current active round
        uint256 currentRound = getCurrentRound();

        // Assert that
        require(roundId == currentRound, "You can not participate in this round.");

        uint256 amountOfTokensBuying = sale.purchase(amountAVAX, amount);

        bool[] memory _empty = new bool[](vestingConfig.vestingPortionsUnlockTime.length);

        // Create participation object
        ParticipationLib.Participation memory p = ParticipationLib.Participation({
            amountBought: amountOfTokensBuying,
            amountAVAXPaid: amountAVAX,
            timeParticipated: block.timestamp,
            roundId: roundId,
            isPortionWithdrawn: _empty,
            isPortionWithdrawnToDexalot: _empty
        });

        // Staking round only.
        if (roundId == stakingRoundId) {
            // Burn XAVA from this user.
            allocationStakingContract.redistributeXava(0, user, amountXavaToBurn);
        }

        // Add participation for user.
        userToParticipation[user] = p;
        // Mark user is participated
        isParticipated[user] = true;
        registration.newParticipation();
        // Transfer registration deposit amount in AVAX back to the users.
        safeTransferAVAX(user, registration.registrationDepositAVAX);

        emit RegistrationAVAXRefunded(user, registration.registrationDepositAVAX);
        emit TokensSold(user, amountOfTokensBuying);
    }

    // Migrate participation details from user to vault NFT
    function migrateToVault() external {
        require(
            isParticipated[msg.sender] && userToParticipation[msg.sender].amountBought > 0,
            "No participation found"
        );

        // Check if there are portions left to withdraw
        uint256 vaultId = userToParticipation[msg.sender].migrate(saleVault);

        vaultToParticipation[vaultId] = userToParticipation[msg.sender];
        vaultToRoundRegisteredFor[vaultId] = addressToRoundRegisteredFor[msg.sender];
        isVaultParticipated[vaultId] = true;

        delete userToParticipation[msg.sender];
        isParticipated[msg.sender] = false;
        addressToRoundRegisteredFor[msg.sender] = 0;

        emit ParticipationMigrated(msg.sender, vaultId);
    }

    // Migrate participation details from user to vault NFT
    function burnVault(uint256 vaultId) external onlyVaultOwner(vaultId) {
        vaultToParticipation[vaultId].burn(saleVault, vaultId);

        emit VaultBurned(msg.sender, vaultId);
    }

    function _withdrawToken(
        address beneficiary,
        uint256 amountWithdrawing,
        bool allowDexalot
    ) internal {
        if (amountWithdrawing == 0) {
            // do nothing
            return;
        }
        sale.token.safeTransfer(beneficiary, amountWithdrawing);
        emit TokensWithdrawn(beneficiary, amountWithdrawing);
        if (allowDexalot) {
            // Deposit tokens to dexalot contract - Withdraw from sale contract
            dexalotConfig.dexalotPortfolio.depositTokenFromContract(
                beneficiary,
                getTokenSymbolBytes32(),
                amountWithdrawing
            );
            emit TokensWithdrawnToDexalot(beneficiary, amountWithdrawing);
        }
    }

    /// Helper function to claim participation
    function _withdrawPortion(
        ParticipationLib.Participation storage p,
        uint256 portionId,
        address beneficiary,
        bool allowDexalot,
        bool allowTokenTransfer
    ) internal returns (uint256) {
        require(portionId < vestingConfig.vestingPercentPerPortion.length, "Portion id out of range.");
        require(!p.isPortionWithdrawn[portionId], "Portion already withdrawn.");
        if (portionId > 0) {
            require(vestingConfig.vestingPortionsUnlockTime[portionId] <= block.timestamp, "Portion not unlocked yet.");
        }

        p.isPortionWithdrawn[portionId] = true;
        uint256 amountWithdrawing = p.amountBought.mul(vestingConfig.vestingPercentPerPortion[portionId]).div(
            vestingConfig.portionVestingPrecision
        );

        if (allowTokenTransfer) _withdrawToken(beneficiary, amountWithdrawing, allowDexalot);
        return amountWithdrawing;
    }

    /// Users can deposit their participation to Dexalot Portfolio
    /// @dev first portion can be deposited before it's unlocking time, while others can only after

    function withdrawTokensToDexalot(uint256 portionId) external {
        // Security check
        dexalotConfig.performChecks();
        _withdrawPortion(userToParticipation[msg.sender], portionId, msg.sender, true, true);
    }

    // Expose function where user can withdraw multiple unlocked portions at once.
    function _withdrawMultiplePortions(
        ParticipationLib.Participation storage p,
        uint256[] calldata portionIds,
        address beneficiary,
        bool allowDexalot
    ) internal returns (uint256) {
        uint256 totalToWithdraw = 0;

        for (uint256 i = 0; i < portionIds.length; i++) {
            totalToWithdraw = totalToWithdraw.add(_withdrawPortion(p, portionIds[i], beneficiary, false, false));
        }

        _withdrawToken(beneficiary, totalToWithdraw, allowDexalot);
        return totalToWithdraw;
    }

    /// Users can claim their participation
    function withdrawTokens(uint256 portionId) external {
        // Retrieve participation from storage
        _withdrawPortion(userToParticipation[msg.sender], portionId, msg.sender, false, true);
    }

    /// NFT owners can claim their participation
    function withdrawTokensFromVault(uint256 portionId, uint256 vaultId) external onlyVaultOwner(vaultId) {
        _withdrawPortion(vaultToParticipation[vaultId], portionId, msg.sender, false, true);
    }

    // Expose function where a vault owner can withdraw multiple unlocked portions at once.
    function withdrawMultiplePortions(uint256[] calldata portionIds) external {
        _withdrawMultiplePortions(userToParticipation[msg.sender], portionIds, msg.sender, false);
    }

    // Expose function where user can withdraw multiple unlocked portions at once.
    function withdrawMultiplePortionsFromVault(uint256[] calldata portionIds, uint256 vaultId)
        external
        onlyVaultOwner(vaultId)
    {
        _withdrawMultiplePortions(vaultToParticipation[vaultId], portionIds, msg.sender, false);
    }

    /// Expose function where user can withdraw multiple unlocked portions to Dexalot Portfolio at once
    /// @dev first portion can be deposited before it's unlocking time, while others can only after
    // 0.838 KB

    function withdrawMultiplePortionsToDexalot(uint256[] calldata portionIds) external {
        // Security check
        dexalotConfig.performChecks();
        _withdrawMultiplePortions(userToParticipation[msg.sender], portionIds, msg.sender, true);
    }

    // Internal function to handle safe transfer
    function safeTransferAVAX(address to, uint256 value) internal {
        (bool success, ) = to.call{ value: value }(new bytes(0));
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
    function withdrawEarningsInternal() internal {
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
        sale.withdrawLeftover();
    }

    // Function after sale for admin to withdraw registration fees if there are any left.
    function withdrawRegistrationFees() external onlyAdmin {
        require(block.timestamp >= sale.saleEnd, "Require that sale has ended.");
        registration.withdrawRegistrationFee();
        // Transfer AVAX to the admin wallet.
        safeTransferAVAX(msg.sender, registration.registrationFees);
    }

    // Function where admin can withdraw all unused funds.
    function withdrawUnusedFunds() external onlyAdmin {
        uint256 balanceAVAX = address(this).balance;

        uint256 totalReservedForRaise = sale.earningsWithdrawn ? 0 : sale.totalAVAXRaised;

        safeTransferAVAX(msg.sender, balanceAVAX.sub(totalReservedForRaise.add(registration.registrationFees)));
    }

    /// @notice     Get current round in progress.
    ///             If 0 is returned, means sale didn't start or it's ended.
    function getCurrentRound() public view returns (uint256) {
        uint256 i = 0;
        if (block.timestamp < getFirstRoundStartTime()) {
            return 0; // Sale didn't start yet.
        }

        while ((i + 1) < roundIds.length && block.timestamp > roundIdToRound[roundIds[i + 1]].startTime) {
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
        return admin.verifySignature(keccak256(abi.encodePacked(user, roundId, address(this))), signature);
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
        return
            admin.verifySignature(
                keccak256(
                    abi.encodePacked(
                        user,
                        amount,
                        amountXavaToBurn,
                        roundId,
                        signatureExpirationTimestamp,
                        address(this)
                    )
                ),
                signature
            );
    }

    /// @notice     Function to get participation for passed user address
    // 0.576 KB
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
        return userToParticipation[_user].normalize();
    }

    /// @notice     Function to get participation for passed user address
    // Size: 0.361 KB
    function getVaultParticipation(uint256 vaultId)
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
        return vaultToParticipation[vaultId].normalize();
    }

    /// @notice     Function to get number of registered users for sale
    function getNumberOfRegisteredUsers() external view returns (uint256) {
        return registration.numberOfRegistrants;
    }

    /// @notice     Function to get all info about vesting.
    function getVestingInfo() external view returns (uint256[] memory, uint256[] memory) {
        return (vestingConfig.vestingPortionsUnlockTime, vestingConfig.vestingPercentPerPortion);
    }

    /// @notice     Function to remove stuck tokens from sale contract
    function removeStuckTokens(address token, address beneficiary) external onlyAdmin {
        // Require that token address does not match with sale token
        require(token != address(sale.token), "Cannot withdraw official sale token.");
        // Safe transfer token from sale contract to beneficiary
        IERC20(token).safeTransfer(beneficiary, IERC20(token).balanceOf(address(this)));
    }

    /// @notice     Function to set params for updatePriceInAVAX function
    function setUpdateTokenPriceInAVAXParams(
        uint8 _updateTokenPriceInAVAXPercentageThreshold,
        uint256 _updateTokenPriceInAVAXTimeLimit
    ) external onlyAdmin onlyIfGateOpen {
        sale.setUpdateTokenPriceParams(_updateTokenPriceInAVAXPercentageThreshold, _updateTokenPriceInAVAXTimeLimit);
        // May emit event here.
    }

    /// @notice     Function to get sale.token symbol and parse as bytes32
    function getTokenSymbolBytes32() internal view returns (bytes32 _symbol) {
        return DexalotLib.getTokenSymbolBytes32(sale.token);
    }

    /// @notice     Function close setter gate after all params are set
    function closeGate() external onlyAdmin onlyIfGateOpen {
        // Require that registration times are set
        require(
            registration.registrationTimeStarts != 0 && registration.registrationTimeEnds != 0,
            "closeGate: Registration params not set."
        );
        sale.performChecksToCloseGate();
        // Close the gate
        gateClosed = true;
        emit GateClosed(block.timestamp);
    }

    // Function to act as a fallback and handle receiving AVAX.
    receive() external payable {}
}
