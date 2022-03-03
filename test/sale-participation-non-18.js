const { ethers } = require("hardhat");
const { expect } = require("chai");
const ethUtil = require("ethereumjs-util")
const {BigNumber} = require("ethers");

describe("AvalaunchSale", function() {

    let Admin;
    let AvalaunchSale;
    let XavaToken;
    let SalesFactory;
    let AllocationStaking;
    let deployer, alice, bob, cedric;
    let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    let ONE_ADDRESS = "0x0000000000000000000000000000000000000001";
    let sigExp =  3000000000;
    let vestingPortionsUnlockTime = [];
    let vestingPercentPerPortion = [];
    let tokenPriceInUSD = 10;

    const DECIMALS = 6; // Working with non-18 decimals
    const MULTIPLIER = (10 ** DECIMALS).toString();
    const REV = (10 ** (18-DECIMALS)).toString();

    const REWARDS_PER_SECOND = ethers.utils.parseUnits("0.1");
    const DEPOSIT_FEE_PERCENT = 5;
    const DEPOSIT_FEE_PRECISION = 100;
    const START_TIMESTAMP_DELTA = 600;
    const NUMBER_1E36 = "1000000000000000000000000000000000000";
    const NUMBER_1E18 = "1000000000000000000";

    const TOKEN_PRICE_IN_AVAX = (10 ** DECIMALS).toString();
    const AMOUNT_OF_TOKENS_TO_SELL = "1000000000000000000";
    const SALE_END_DELTA = 100;
    const TOKENS_UNLOCK_TIME_DELTA = 150;
    const REGISTRATION_TIME_STARTS_DELTA = 10;
    const REGISTRATION_TIME_ENDS_DELTA = 40;
    const REGISTRATION_DEPOSIT_AVAX = 1;
    const PORTION_VESTING_PRECISION = 100;
    const ROUNDS_START_DELTAS = [50, 70, 90];
    const ROUNDS_MAX_PARTICIPATIONS = [100 * REV, 120 * REV, 1000 * REV];
    const FIRST_ROUND = 1;
    const MIDDLE_ROUND = 2;
    const LAST_ROUND = 3;
    const PARTICIPATION_AMOUNT = 100 * REV;
    const PARTICIPATION_ROUND = 1;
    const PARTICIPATION_VALUE = 80 * REV;
    const AMOUNT_OF_XAVA_TO_BURN = 0;

    const DEPLOYER_PRIVATE_KEY = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

    function firstOrDefault(first, key, def) {
        if (first && first[key] !== undefined) {
            return first[key];
        }
        return def;
    }

    function generateSignature(digest, privateKey) {
        // prefix with "\x19Ethereum Signed Message:\n32"
        // Reference: https://github.com/OpenZeppelin/openzeppelin-contracts/issues/890
        const prefixedHash = ethUtil.hashPersonalMessage(ethUtil.toBuffer(digest));

        // sign message
        const {v, r, s} = ethUtil.ecsign(prefixedHash, Buffer.from(privateKey, 'hex'))

        // generate signature by concatenating r(32), s(32), v(1) in this order
        // Reference: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/76fe1548aee183dfcc395364f0745fe153a56141/contracts/ECRecovery.sol#L39-L43
        const vb = Buffer.from([v]);
        const signature = Buffer.concat([r, s, vb]);

        return signature;
    }

    function signRegistration(userAddress, roundId, contractAddress, privateKey) {
        // compute keccak256(abi.encodePacked(user, roundId, address(this)))
        const digest = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ['address', 'uint256', 'address'],
                [userAddress, roundId, contractAddress]
            )
        );

        return generateSignature(digest, privateKey);
    }

    function signParticipation(userAddress, amount, roundId, amountOfXavaToBurn, signatureExpirationTimestamp, contractAddress, privateKey) {
        // compute keccak256(abi.encodePacked(user, amount, roundId))
        const digest = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ['address', 'uint256', 'uint256', 'uint256', 'uint256','address'],
                [userAddress, amount, amountOfXavaToBurn, roundId, signatureExpirationTimestamp, contractAddress]
            )
        );

        return generateSignature(digest, privateKey);
    }

    function participate(params) {
        const registrant = firstOrDefault(params, 'sender', deployer);

        const userAddress = registrant.address;
        const participationAmount = firstOrDefault(params, 'participationAmount', PARTICIPATION_AMOUNT);
        const participationRound = firstOrDefault(params, "participationRound", PARTICIPATION_ROUND);
        const amountOfXavaToBurn = firstOrDefault(params, "amountOfXavaToBurn", AMOUNT_OF_XAVA_TO_BURN);
        const value = firstOrDefault(params, "participationValue", PARTICIPATION_VALUE);
        const sig = signParticipation(userAddress, participationAmount, participationRound, amountOfXavaToBurn, sigExp, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);
        return AvalaunchSale.connect(registrant).participate(sig, participationAmount, amountOfXavaToBurn, participationRound, sigExp, {value: value});
    }

    async function getCurrentBlockTimestamp() {
        return (await ethers.provider.getBlock('latest')).timestamp;
    }

    async function setSaleParams(params) {
        const blockTimestamp = await getCurrentBlockTimestamp();

        const token = firstOrDefault(params, 'token', XavaToken.address);
        const saleOwner = firstOrDefault(params, 'saleOwner', deployer.address);
        const tokenPriceInAVAX = firstOrDefault(params, 'tokenPriceInAVAX', TOKEN_PRICE_IN_AVAX);
        const amountOfTokensToSell = firstOrDefault(params, 'amountOfTokensToSell', AMOUNT_OF_TOKENS_TO_SELL);
        const saleEnd = blockTimestamp + firstOrDefault(params, 'saleEndDelta', SALE_END_DELTA);
        // const tokensUnlockTime = blockTimestamp + firstOrDefault(params, 'tokensUnlockTimeDelta', TOKENS_UNLOCK_TIME_DELTA);
        const stakingRoundId = 1;

        return await AvalaunchSale.setSaleParams(
            token, saleOwner, tokenPriceInAVAX, amountOfTokensToSell,
            saleEnd, PORTION_VESTING_PRECISION, stakingRoundId, REGISTRATION_DEPOSIT_AVAX, tokenPriceInUSD
        );
    }

    async function setRegistrationTime(params) {
        const blockTimestamp = await getCurrentBlockTimestamp();

        const registrationTimeStarts = blockTimestamp + firstOrDefault(params, 'registrationTimeStartsDelta', REGISTRATION_TIME_STARTS_DELTA);
        const registrationTimeEnds = blockTimestamp + firstOrDefault(params, 'registrationTimeEndsDelta', REGISTRATION_TIME_ENDS_DELTA);

        return AvalaunchSale.setRegistrationTime(registrationTimeStarts, registrationTimeEnds);
    }

    async function setRounds(params) {
        const blockTimestamp = await getCurrentBlockTimestamp();

        const startTimes = firstOrDefault(params, 'startTimes', ROUNDS_START_DELTAS).map((s) => blockTimestamp+s);
        const maxParticipations = firstOrDefault(params, 'maxParticipations', ROUNDS_MAX_PARTICIPATIONS);

        return AvalaunchSale.setRounds(startTimes, maxParticipations);
    }

    async function setVestingParams() {
        const blockTimestamp = await getCurrentBlockTimestamp();
        vestingPortionsUnlockTime = [blockTimestamp + SALE_END_DELTA + 25, blockTimestamp + SALE_END_DELTA + 35];
        vestingPercentPerPortion = [5, 95];
        await AvalaunchSale.setVestingParams(vestingPortionsUnlockTime, vestingPercentPerPortion, 500000);
    }

    async function depositTokens() {
        await XavaToken.approve(AvalaunchSale.address, AMOUNT_OF_TOKENS_TO_SELL);
        await AvalaunchSale.depositTokens();
    }

    async function runFullSetupNoDeposit(params) {
        await setSaleParams(params);
        await setRegistrationTime(params);
        await setRounds(params);
    }

    async function runFullSetup(params) {
        await setSaleParams(params);
        await setRegistrationTime(params);
        await setRounds(params);
        await setUpdatePriceInAVAXParams();
        await depositTokens();
    }

    async function setUpdatePriceInAVAXParams() {
        await AvalaunchSale.setUpdateTokenPriceInAVAXParams(30, 500);
    }

    async function registerForSale(params) {
        const registrant = firstOrDefault(params, 'sender', deployer);

        const roundId = firstOrDefault(params, 'registerRound', FIRST_ROUND)
        const sig = signRegistration(registrant.address, roundId, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        await AvalaunchSale.connect(registrant).registerForSale(sig, roundId, {value: REGISTRATION_DEPOSIT_AVAX});
    }

    beforeEach(async function() {
        const accounts = await ethers.getSigners();
        deployer = accounts[0];
        alice = accounts[1];
        bob = accounts[2];
        cedric = accounts[3];

        const XavaTokenFactory = await ethers.getContractFactory("XavaToken");
        XavaToken = await XavaTokenFactory.deploy("Xava", "XAVA", ethers.utils.parseUnits("10000000000000000000000000"), DECIMALS);

        const AdminFactory = await ethers.getContractFactory("Admin");
        Admin = await AdminFactory.deploy([deployer.address, alice.address, bob.address]);

        const SalesFactoryFactory = await ethers.getContractFactory("SalesFactory");
        SalesFactory = await SalesFactoryFactory.deploy(Admin.address, ZERO_ADDRESS);

        AllocationStakingRewardsFactory = await ethers.getContractFactory("AllocationStaking");
        const blockTimestamp = await getCurrentBlockTimestamp();
        startTimestamp = blockTimestamp + START_TIMESTAMP_DELTA;
        AllocationStaking = await AllocationStakingRewardsFactory.deploy();
        await AllocationStaking.initialize(XavaToken.address, REWARDS_PER_SECOND, startTimestamp, SalesFactory.address, DEPOSIT_FEE_PERCENT, DEPOSIT_FEE_PRECISION);

        await AllocationStaking.add(1, XavaToken.address, false);

        await SalesFactory.setAllocationStaking(AllocationStaking.address);

        const saleContract = await ethers.getContractFactory("AvalaunchSale");
        const saleImplementation = await saleContract.deploy();
        await saleImplementation.deployed();

        await SalesFactory.setImplementation(saleImplementation.address);

        await SalesFactory.deploySale();
        const AvalaunchSaleFactory = await ethers.getContractFactory("AvalaunchSale");
        AvalaunchSale = AvalaunchSaleFactory.attach(await SalesFactory.allSales(0));
    });

    context("Participation", async function() {
        describe("Participate", async function() {
            it("Should allow user to participate", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale();

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await XavaToken.approve(AllocationStaking.address, "50000000");
                await AllocationStaking.deposit(0, "50000000");

                // When
                await participate({amountOfXavaToBurn: 1});

                // Then
                const sale = await AvalaunchSale.sale();
                const isParticipated = await AvalaunchSale.isParticipated(deployer.address);
                const participation = await AvalaunchSale.getParticipation(deployer.address);

                expect(sale.totalTokensSold).to.equal(Math.floor(PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX * MULTIPLIER));
                expect(sale.totalAVAXRaised).to.equal(PARTICIPATION_VALUE);
                expect(isParticipated).to.be.true;
                expect(participation[0]).to.equal(Math.floor(PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX * MULTIPLIER));
                expect(participation[3]).to.equal(PARTICIPATION_ROUND);
                // expect(participation.isWithdrawn).to.be.false;

                expect(await AvalaunchSale.getNumberOfRegisteredUsers()).to.equal(1);
            });

            it("Should allow multiple users to participate", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale();
                await registerForSale({sender: alice});

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                // When
                await participate();
                await participate({sender: alice});

                // Then
                const sale = await AvalaunchSale.sale();
                const isParticipatedDeployer = await AvalaunchSale.isParticipated(deployer.address);
                const isParticipatedAlice = await AvalaunchSale.isParticipated(alice.address);
                const participationDeployer = await AvalaunchSale.userToParticipation(deployer.address);
                const participationAlice = await AvalaunchSale.userToParticipation(alice.address);

                expect(sale.totalTokensSold).to.equal(Math.floor(2 * PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX * MULTIPLIER));
                expect(sale.totalAVAXRaised).to.equal(BigNumber.from(PARTICIPATION_VALUE).mul(2));
                expect(isParticipatedDeployer).to.be.true;
                expect(isParticipatedAlice).to.be.true;
                expect(participationDeployer.amountBought).to.equal(Math.floor(PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX * MULTIPLIER));
                expect(participationDeployer.roundId).to.equal(PARTICIPATION_ROUND);
                // expect(participationDeployer.isWithdrawn).to.be.false;
                expect(participationAlice.amountBought).to.equal(Math.floor(PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX * MULTIPLIER));
                expect(participationAlice.roundId).to.equal(PARTICIPATION_ROUND);
                // expect(participationAlice.isWithdrawn).to.be.false;
            });

            it("Should not participate in roundId 0", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale();

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                // Then
                await expect(participate({participationRound: 0}))
                    .to.be.revertedWith("Round can not be 0.");
            });

            it("Should not participate with amount larger than maxParticipation", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale();

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                // Then
                await expect(participate({participationAmount: ROUNDS_MAX_PARTICIPATIONS[0]+1}))
                    .to.be.revertedWith("Overflowing maximal participation for this round.");
            });

            it("Should not participate with invalid signature", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale();

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                // When
                const sig = signParticipation(alice.address, PARTICIPATION_AMOUNT, PARTICIPATION_ROUND, AMOUNT_OF_XAVA_TO_BURN, await getCurrentBlockTimestamp() + 10, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

                // Then
                await expect(AvalaunchSale.participate(sig, PARTICIPATION_AMOUNT, AMOUNT_OF_XAVA_TO_BURN, PARTICIPATION_ROUND, await getCurrentBlockTimestamp() + 10, {value: PARTICIPATION_VALUE}))
                    .to.be.revertedWith("Invalid signature. Verification failed");
            });

            it("Should not participate twice", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale();

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await participate();

                // Then
                await expect(participate())
                    .to.be.revertedWith("User can participate only once.");
            });

            it("Should not participate in a round that ended", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale({registerRound: 2});

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[2] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                // Then
                await expect(participate({participationRound: 2}))
                    .to.be.revertedWith("You can not participate in this round.");
            });

            it("Should not participate in a round that has not started", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale({registerRound: 3});

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                // Then
                await expect(participate({participationRound: 3}))
                    .to.be.revertedWith("You can not participate in this round.");
            });

            it("Should not buy more than allowed", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale();

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                // Then
                await expect(participate({participationValue: (ROUNDS_MAX_PARTICIPATIONS[0]+5), value: ethers.utils.parseEther("10")}))
                    .to.be.revertedWith("Trying to buy more than allowed.");
            });

            it("Should emit TokensSold event", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale();

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                // Then
                await expect(participate()).to.emit(AvalaunchSale, "TokensSold").withArgs(deployer.address, Math.floor(PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX * MULTIPLIER));
            });

            it("Should not participate without registering for the round", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                // Then
                await expect(participate()).to.be.reverted;
            });

            // Current flow relies on signature rather than depositing
            xit("Should not participate if tokens have not been deposited", async function() {
                // Given
                await setSaleParams();
                await setRegistrationTime();
                await setRounds();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale();

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                // Then
                await expect(participate()).to.be.reverted;
            });

            it("Should fail if buying 0 tokens", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale();

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                // Then
                await expect(participate({participationValue: 0})).to.be.reverted;
            });
        });

        describe("Withdraw tokens", async function() {
            it("Should withdraw user's tokens", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale();
                await setVestingParams();

                const vestingParams = await AvalaunchSale.getVestingInfo();
                expect(vestingParams[0][0]).to.equal(vestingPortionsUnlockTime[0]);
                expect(vestingParams[0][1]).to.equal(vestingPortionsUnlockTime[1]);
                expect(vestingParams[1][0]).to.equal(vestingPercentPerPortion[0]);
                expect(vestingParams[1][1]).to.equal(vestingPercentPerPortion[1]);

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await participate();

                await ethers.provider.send("evm_increaseTime", [TOKENS_UNLOCK_TIME_DELTA - ROUNDS_START_DELTAS[0]]);
                await ethers.provider.send("evm_mine");

                // console.log(await AvalaunchSale.getParticipation(deployer.address));

                await XavaToken.transfer(AvalaunchSale.address, "10000000000000000000");
                const previousBalance = ethers.BigNumber.from(await XavaToken.balanceOf(deployer.address));

                // When
                await AvalaunchSale.withdrawTokens(0);

                // Then
                const currentBalance = ethers.BigNumber.from(await XavaToken.balanceOf(deployer.address));
                // console.log(parseInt(currentBalance))
                const withdrawAmount = ((PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX) * 5) / PORTION_VESTING_PRECISION * MULTIPLIER;
                // console.log(withdrawAmount)
                expect(currentBalance).to.equal(previousBalance.add(Math.floor(withdrawAmount)));
            });

            it("Should withdraw user's tokens using multiple portion withdrawal", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale();
                await setVestingParams();

                const vestingParams = await AvalaunchSale.getVestingInfo();
                expect(vestingParams[0][0]).to.equal(vestingPortionsUnlockTime[0]);
                expect(vestingParams[0][1]).to.equal(vestingPortionsUnlockTime[1]);
                expect(vestingParams[1][0]).to.equal(vestingPercentPerPortion[0]);
                expect(vestingParams[1][1]).to.equal(vestingPercentPerPortion[1]);

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await participate();

                await ethers.provider.send("evm_increaseTime", [TOKENS_UNLOCK_TIME_DELTA - ROUNDS_START_DELTAS[0]]);
                await ethers.provider.send("evm_mine");

                // console.log(await AvalaunchSale.getParticipation(deployer.address));

                await XavaToken.transfer(AvalaunchSale.address, "10000000000000000000");
                const previousBalance = ethers.BigNumber.from(await XavaToken.balanceOf(deployer.address));

                // When
                await AvalaunchSale.withdrawMultiplePortions([0]);

                // Then
                const currentBalance = ethers.BigNumber.from(await XavaToken.balanceOf(deployer.address));
                // console.log(parseInt(currentBalance))
                const withdrawAmount = ((PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX) * 5) / PORTION_VESTING_PRECISION * MULTIPLIER;
                // console.log(withdrawAmount)
                expect(currentBalance).to.equal(previousBalance.add(Math.floor(withdrawAmount)));
            });

            // Deprecated - User not participating leads to having 'invalid opcode' error on line 570 / Cause: Array index out of bounds
            xit("Should not withdraw if user did not participate", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale();

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await ethers.provider.send("evm_increaseTime", [TOKENS_UNLOCK_TIME_DELTA - ROUNDS_START_DELTAS[0]]);
                await ethers.provider.send("evm_mine");

                const previousBalance = ethers.BigNumber.from(await XavaToken.balanceOf(deployer.address));

                // When
                await AvalaunchSale.withdrawTokens(0);

                // Then
                const currentBalance = ethers.BigNumber.from(await XavaToken.balanceOf(deployer.address));
                expect(currentBalance).to.equal(previousBalance);
            });

            it("Should not withdraw twice", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale();
                await setVestingParams();

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await participate();

                await ethers.provider.send("evm_increaseTime", [TOKENS_UNLOCK_TIME_DELTA - ROUNDS_START_DELTAS[0]]);
                await ethers.provider.send("evm_mine");

                await XavaToken.transfer(AvalaunchSale.address, "10000000000000000000");
                await AvalaunchSale.withdrawTokens(0);

                // Then
                await expect(AvalaunchSale.withdrawTokens(0)).to.be.revertedWith("Tokens already withdrawn or portion not unlocked yet.");
            });

            xit("Should not withdraw before tokens unlock time", async function() {
                // Given
                await runFullSetup();

                await setVestingParams();
                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale();

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await participate();

                // Then
                await expect(AvalaunchSale.withdrawTokens(0)).to.be.revertedWith("Tokens can not be withdrawn yet.");
            });

            it("Should emit TokensWithdrawn event", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale();
                await setVestingParams();

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await participate();
                await XavaToken.transfer(AvalaunchSale.address, "10000000000000000000");

                await ethers.provider.send("evm_increaseTime", [TOKENS_UNLOCK_TIME_DELTA - ROUNDS_START_DELTAS[0]]);
                await ethers.provider.send("evm_mine");

                // Then
                await expect(AvalaunchSale.withdrawTokens(0)).to.emit(AvalaunchSale, "TokensWithdrawn").withArgs(deployer.address, Math.floor(PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX * 5 / PORTION_VESTING_PRECISION * MULTIPLIER));
            });

            it("Should shift westing unclock times", async function () {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale();
                await setVestingParams();

                const shift = 10;
                await AvalaunchSale.shiftVestingUnlockingTimes(shift);

                const vestingParams = await AvalaunchSale.getVestingInfo();
                expect(vestingParams[0][0]).to.equal(vestingPortionsUnlockTime[0] + shift);
                expect(vestingParams[0][1]).to.equal(vestingPortionsUnlockTime[1] + shift);
            });
        });

        describe("Withdraw earnings and leftover", async function() {
            it("Should withdraw sale owner's earnings and leftovers", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale({sender: alice});

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await participate({sender: alice});

                await ethers.provider.send("evm_increaseTime", [SALE_END_DELTA - ROUNDS_START_DELTAS[0]]);
                await ethers.provider.send("evm_mine");

                const previousBalance = await ethers.provider.getBalance(deployer.address);
                const previousTokenBalance = await XavaToken.balanceOf(deployer.address);

                const sale = await AvalaunchSale.sale();
                // console.log(parseInt(sale.amountOfTokensToSell), parseInt(sale.totalTokensSold));

                // When
                await AvalaunchSale.withdrawEarningsAndLeftover();

                // Then
                const currentBalance = await ethers.provider.getBalance(deployer.address);
                const contractBalance = await ethers.provider.getBalance(AvalaunchSale.address);
                const currentTokenBalance = await XavaToken.balanceOf(deployer.address);
                const contractTokenBalance = await XavaToken.balanceOf(AvalaunchSale.address);

                // TODO:
                // expect(currentBalance).to.equal(previousBalance.add(PARTICIPATION_VALUE));
                // expect(currentTokenBalance).to.equal(previousTokenBalance.add((AMOUNT_OF_TOKENS_TO_SELL - PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX)));
                // expect(contractBalance).to.equal(0);
                // expect(contractTokenBalance).to.equal(PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX);
            });

            it("Should withdraw sale owner's earnings and leftovers separately", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale({sender: alice});

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await participate({sender: alice});

                await ethers.provider.send("evm_increaseTime", [SALE_END_DELTA - ROUNDS_START_DELTAS[0]]);
                await ethers.provider.send("evm_mine");

                const previousBalance = await ethers.provider.getBalance(deployer.address);
                const previousTokenBalance = await XavaToken.balanceOf(deployer.address);

                const sale = await AvalaunchSale.sale();
                // console.log(parseInt(sale.amountOfTokensToSell), parseInt(sale.totalTokensSold));

                // When
                await AvalaunchSale.withdrawEarnings();

                await AvalaunchSale.withdrawLeftover();

                // Then
                const currentBalance = await ethers.provider.getBalance(deployer.address);
                const contractBalance = await ethers.provider.getBalance(AvalaunchSale.address);
                const currentTokenBalance = await XavaToken.balanceOf(deployer.address);
                const contractTokenBalance = await XavaToken.balanceOf(AvalaunchSale.address);

                // TODO:
                // expect(currentBalance).to.equal(previousBalance.add(PARTICIPATION_VALUE));
                // expect(currentTokenBalance).to.equal(previousTokenBalance.add((AMOUNT_OF_TOKENS_TO_SELL - PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX)));
                // expect(contractBalance).to.equal(0);
                // expect(contractTokenBalance).to.equal(PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX);
            });

            it("Should not withdraw twice", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale({sender: alice});

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await participate({sender: alice});

                await ethers.provider.send("evm_increaseTime", [SALE_END_DELTA - ROUNDS_START_DELTAS[0]]);
                await ethers.provider.send("evm_mine");

                await AvalaunchSale.withdrawEarningsAndLeftover();

                // Then
                await expect(AvalaunchSale.withdrawEarningsAndLeftover()).to.be.reverted;
            });

            it("Should not withdraw before sale ended", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale({sender: alice});

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await participate({sender: alice});

                await ethers.provider.send("evm_increaseTime", [SALE_END_DELTA - ROUNDS_START_DELTAS[0] - 15]);
                await ethers.provider.send("evm_mine");

                // Then
                await expect(AvalaunchSale.withdrawEarningsAndLeftover()).to.be.reverted;
            });

            it("Should not allow non-sale owner to withdraw", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale({sender: alice});

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await participate({sender: alice});

                await ethers.provider.send("evm_increaseTime", [SALE_END_DELTA - ROUNDS_START_DELTAS[0]]);
                await ethers.provider.send("evm_mine");

                // Then
                await expect(AvalaunchSale.connect(bob).withdrawEarningsAndLeftover()).to.be.revertedWith("OnlySaleOwner:: Restricted");
            });

            //TODO:
            xit("Should burn leftover if requested", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale({sender: alice});

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await participate({sender: alice});

                await ethers.provider.send("evm_increaseTime", [SALE_END_DELTA - ROUNDS_START_DELTAS[0]]);
                await ethers.provider.send("evm_mine");

                const previousBalance = await ethers.provider.getBalance(deployer.address);
                const previousTokenBalance = await XavaToken.balanceOf(deployer.address);

                // When
                await AvalaunchSale.withdrawEarningsAndLeftover();

                // Then
                const currentBalance = await ethers.provider.getBalance(deployer.address);
                const contractBalance = await ethers.provider.getBalance(AvalaunchSale.address);
                const currentTokenBalance = await XavaToken.balanceOf(deployer.address);
                const contractTokenBalance = await XavaToken.balanceOf(AvalaunchSale.address);
                const burnedTokenBalance = await XavaToken.balanceOf(ONE_ADDRESS);

                expect(currentBalance).to.equal(previousBalance.add(PARTICIPATION_VALUE));
                expect(currentTokenBalance).to.equal(previousTokenBalance);
                expect(contractBalance).to.equal(0);
                expect(contractTokenBalance).to.equal(PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX);
                expect(burnedTokenBalance).to.equal(AMOUNT_OF_TOKENS_TO_SELL - PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX);
            });

            //TODO:
            xit("Should not crash if leftover is 0", async function() {
                // Given
                await runFullSetup({amountOfTokensToSell: Math.floor(PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX * MULTIPLIER)});

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale({sender: alice});

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await participate({sender: alice});

                await ethers.provider.send("evm_increaseTime", [SALE_END_DELTA - ROUNDS_START_DELTAS[0]]);
                await ethers.provider.send("evm_mine");

                const previousBalance = await ethers.provider.getBalance(deployer.address);
                const previousTokenBalance = await XavaToken.balanceOf(deployer.address);

                // When
                await AvalaunchSale.withdrawEarningsAndLeftover();

                // Then
                const currentBalance = await ethers.provider.getBalance(deployer.address);
                const contractBalance = await ethers.provider.getBalance(AvalaunchSale.address);
                const currentTokenBalance = await XavaToken.balanceOf(deployer.address);
                const contractTokenBalance = await XavaToken.balanceOf(AvalaunchSale.address);

                expect(currentBalance).to.equal(previousBalance.add(PARTICIPATION_VALUE));
                expect(currentTokenBalance).to.equal(previousTokenBalance);
                expect(contractBalance).to.equal(0);
                expect(contractTokenBalance).to.equal(PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX * MULTIPLIER);
            });

            //TODO:
            xit("Should not crash if leftover is 0 and burn is requested", async function() {
                // Given
                await runFullSetup({amountOfTokensToSell: Math.floor(PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX * MULTIPLIER)});

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await registerForSale({sender: alice});

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await participate({sender: alice});

                await ethers.provider.send("evm_increaseTime", [SALE_END_DELTA - ROUNDS_START_DELTAS[0]]);
                await ethers.provider.send("evm_mine");

                const previousBalance = await ethers.provider.getBalance(deployer.address);
                const previousTokenBalance = await XavaToken.balanceOf(deployer.address);

                // When
                await AvalaunchSale.withdrawEarningsAndLeftover();

                // Then
                const currentBalance = await ethers.provider.getBalance(deployer.address);
                const contractBalance = await ethers.provider.getBalance(AvalaunchSale.address);
                const currentTokenBalance = await XavaToken.balanceOf(deployer.address);
                const contractTokenBalance = await XavaToken.balanceOf(AvalaunchSale.address);
                const burnedTokenBalance = await XavaToken.balanceOf(ONE_ADDRESS);

                expect(currentBalance).to.equal(previousBalance.add(PARTICIPATION_VALUE));
                expect(currentTokenBalance).to.equal(previousTokenBalance);
                expect(contractBalance).to.equal(0);
                expect(contractTokenBalance).to.equal(PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX * MULTIPLIER);
                expect(burnedTokenBalance).to.equal(0);
            });

            //TODO:
            xit("Should not crash if earnings are 0", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await ethers.provider.send("evm_increaseTime", [SALE_END_DELTA - ROUNDS_START_DELTAS[0]]);
                await ethers.provider.send("evm_mine");

                const previousBalance = await ethers.provider.getBalance(deployer.address);
                const previousTokenBalance = await XavaToken.balanceOf(deployer.address);

                // When
                await AvalaunchSale.withdrawEarningsAndLeftover();

                // Then
                const currentBalance = await ethers.provider.getBalance(deployer.address);
                const contractBalance = await ethers.provider.getBalance(AvalaunchSale.address);
                const currentTokenBalance = await XavaToken.balanceOf(deployer.address);
                const contractTokenBalance = await XavaToken.balanceOf(AvalaunchSale.address);

                expect(currentBalance).to.equal(previousBalance);
                expect(currentTokenBalance).to.equal(previousTokenBalance.add(AMOUNT_OF_TOKENS_TO_SELL));
                expect(contractBalance).to.equal(0);
                expect(contractTokenBalance).to.equal(0);
            });

            //TODO:
            xit("Should not crash if earnings are 0 and burn is requested", async function() {
                // Given
                await runFullSetup();

                await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
                await ethers.provider.send("evm_mine");

                await ethers.provider.send("evm_increaseTime", [SALE_END_DELTA - ROUNDS_START_DELTAS[0]]);
                await ethers.provider.send("evm_mine");

                const previousBalance = await ethers.provider.getBalance(deployer.address);
                const previousTokenBalance = await XavaToken.balanceOf(deployer.address);

                // When
                await AvalaunchSale.withdrawEarningsAndLeftover();

                // Then
                const currentBalance = await ethers.provider.getBalance(deployer.address);
                const contractBalance = await ethers.provider.getBalance(AvalaunchSale.address);
                const currentTokenBalance = await XavaToken.balanceOf(deployer.address);
                const contractTokenBalance = await XavaToken.balanceOf(AvalaunchSale.address);
                const burnedTokenBalance = await XavaToken.balanceOf(ONE_ADDRESS);

                expect(currentBalance).to.equal(previousBalance);
                expect(currentTokenBalance).to.equal(previousTokenBalance);
                expect(contractBalance).to.equal(0);
                expect(contractTokenBalance).to.equal(0);
                expect(burnedTokenBalance).to.equal(AMOUNT_OF_TOKENS_TO_SELL);
            });
        });

        describe("Get current round", async function() {
            it("Should return 0 if sale didn't start yet", async function() {
                // Given
                await runFullSetup();

                // Then
                expect(await AvalaunchSale.getCurrentRound()).to.equal(0);
            });

            it("Should return correct roundId at very beginning of first round", async function() {
                // Given
                await runFullSetup();

                // When
                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0]]);
                await ethers.provider.send("evm_mine");

                // Then
                expect(await AvalaunchSale.getCurrentRound()).to.equal(1);
            });

            it("Should return correct roundId at very beginning of middle round", async function() {
                // Given
                await runFullSetup();

                // When
                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[1]]);
                await ethers.provider.send("evm_mine");

                // Then
                expect(await AvalaunchSale.getCurrentRound()).to.equal(2);
            });

            it("Should return correct roundId at very beginning of last round", async function() {
                // Given
                await runFullSetup();

                // When
                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[2]]);
                await ethers.provider.send("evm_mine");

                // Then
                expect(await AvalaunchSale.getCurrentRound()).to.equal(3);
            });

            it("Should return correct roundId if first round is active", async function() {
                // Given
                await runFullSetup();

                // When
                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] + 5]);
                await ethers.provider.send("evm_mine");

                // Then
                expect(await AvalaunchSale.getCurrentRound()).to.equal(1);
            });

            it("Should return correct roundId if middle round is active", async function() {
                // Given
                await runFullSetup();

                // When
                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[1] + 5]);
                await ethers.provider.send("evm_mine");

                // Then
                expect(await AvalaunchSale.getCurrentRound()).to.equal(2);
            });

            it("Should return correct roundId if last round is active", async function() {
                // Given
                await runFullSetup();

                // When
                await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[2] + 1]);
                await ethers.provider.send("evm_mine");

                // Then
                expect(await AvalaunchSale.getCurrentRound()).to.equal(3);
            });

            it("Should return 0 if sale already ended", async function() {
                // Given
                await runFullSetup();

                // When
                await ethers.provider.send("evm_increaseTime", [SALE_END_DELTA]);
                await ethers.provider.send("evm_mine");

                // Then
                expect(await AvalaunchSale.getCurrentRound()).to.equal(0);
            });
        });
    });
});
