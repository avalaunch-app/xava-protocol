const { ethers } = require("hardhat");
const { expect } = require("chai");
const ethUtil = require("ethereumjs-util")
const {BigNumber} = require("ethers");

xdescribe("AvalaunchSale", function() {

  let Admin;
  let Collateral;
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

  const DECIMALS = 18; // Working with non-18 decimals
  const MULTIPLIER = (10 ** DECIMALS).toString();
  const REV = (10 ** (18-DECIMALS)).toString();

  const REWARDS_PER_SECOND = ethers.utils.parseUnits("0.1");
  const DEPOSIT_FEE_PERCENT = 5;
  const DEPOSIT_FEE_PRECISION = 100;
  const START_TIMESTAMP_DELTA = 600;
  const NUMBER_1E36 = "1000000000000000000000000000000000000";
  const NUMBER_1E18 = "1000000000000000000";

  const TOKEN_PRICE_IN_AVAX = (10 ** DECIMALS).toString();
  const AMOUNT_OF_TOKENS_TO_SELL = 1000;
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

  function signRegistration(signatureExpirationTimestamp, userAddress, roundId, contractAddress, privateKey) {
    // compute keccak256(abi.encodePacked(user, roundId, address(this)))
    const digest = ethers.utils.keccak256(
      ethers.utils.solidityPack(
        ['uint256', 'address', 'uint256', 'address'],
        [signatureExpirationTimestamp, userAddress, roundId, contractAddress]
      )
    );

    return generateSignature(digest, privateKey);
  }

  function signParticipation(userAddress, amount, roundId, amountOfXavaToBurn, contractAddress, privateKey) {
    // compute keccak256(abi.encodePacked(user, amount, roundId))
    const digest = ethers.utils.keccak256(
      ethers.utils.solidityPack(
        ['address', 'uint256', 'uint256', 'uint256','address'],
        [userAddress, amount, amountOfXavaToBurn, roundId, contractAddress]
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
    const sig = signParticipation(userAddress, participationAmount, participationRound, amountOfXavaToBurn, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);
    return AvalaunchSale.connect(registrant).participate(participationAmount, amountOfXavaToBurn, participationRound, sig, {value: value});
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
    const stakingRoundId = 2;

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
    const sig = signRegistration(sigExp, registrant.address, roundId, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

    await AvalaunchSale.connect(registrant).registerForSale(sig, sigExp, roundId, {value: REGISTRATION_DEPOSIT_AVAX});
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

    const CollateralFactory = await ethers.getContractFactory("AvalaunchCollateral");
    Collateral = await CollateralFactory.deploy();
    await Collateral.deployed();
    await Collateral.initialize(deployer.address, Admin.address, 43114);

    const SalesFactoryFactory = await ethers.getContractFactory("SalesFactory");
    SalesFactory = await SalesFactoryFactory.deploy(Admin.address, ZERO_ADDRESS, Collateral.address);

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

  context("Setup", async function() {
    it("Should setup the token correctly", async function() {
      // Given
      let admin = await AvalaunchSale.admin();

      // Then
      expect(admin).to.equal(Admin.address);
    });

    describe("Set sale parameters", async function() {
      it("Should set the sale parameters", async function() {
        // Given
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        const token = XavaToken.address;
        const saleOwner = deployer.address;
        const tokenPriceInAVAX = TOKEN_PRICE_IN_AVAX;
        const amountOfTokensToSell = AMOUNT_OF_TOKENS_TO_SELL;
        const saleEnd = blockTimestamp + SALE_END_DELTA;
        const tokensUnlockTime = blockTimestamp + TOKENS_UNLOCK_TIME_DELTA;
        const stakingRoundId = 1;

        // When
        await AvalaunchSale.setSaleParams(
            token, saleOwner, tokenPriceInAVAX, amountOfTokensToSell,
            saleEnd, PORTION_VESTING_PRECISION, stakingRoundId, REGISTRATION_DEPOSIT_AVAX, tokenPriceInUSD
        );

        // Then
        const sale = await AvalaunchSale.sale();
        expect(sale.token).to.equal(token);
        expect(sale.isCreated).to.be.true;
        expect(sale.saleOwner).to.equal(saleOwner);
        expect(sale.tokenPriceInAVAX).to.equal(tokenPriceInAVAX);
        expect(sale.amountOfTokensToSell).to.equal(amountOfTokensToSell);
        expect(sale.saleEnd).to.equal(saleEnd);

        // Deprecated checks

        // expect(await SalesFactory.saleOwnerToSale(saleOwner)).to.equal(AvalaunchSale.address);
        // expect(await SalesFactory.tokenToSale(token)).to.equal(AvalaunchSale.address);
      });

      it("Should not allow non-admin to set sale parameters", async function() {
        // Given
        await Admin.removeAdmin(deployer.address);

        // Then
        await expect(setSaleParams()).to.be.revertedWith('Restricted to admins.');
      });

      it("Should emit SaleCreated event when parameters are set", async function() {
        // Given
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        const token = XavaToken.address;
        const saleOwner = deployer.address;
        const tokenPriceInAVAX = TOKEN_PRICE_IN_AVAX;
        const amountOfTokensToSell = AMOUNT_OF_TOKENS_TO_SELL;
        const saleEnd = blockTimestamp + SALE_END_DELTA;
        const tokensUnlockTime = blockTimestamp + TOKENS_UNLOCK_TIME_DELTA;
        const stakingRoundId = 1;

        // When
        expect(await AvalaunchSale.setSaleParams(
            token, saleOwner, tokenPriceInAVAX, amountOfTokensToSell,
            saleEnd, PORTION_VESTING_PRECISION, stakingRoundId, REGISTRATION_DEPOSIT_AVAX, tokenPriceInUSD
        )).to.emit(AvalaunchSale, "SaleCreated")
        .withArgs(saleOwner, tokenPriceInAVAX, amountOfTokensToSell, saleEnd, tokenPriceInUSD);
      });

      it("Should not set sale parameters if sale is already created", async function() {
        // Given
        await setSaleParams();

        // Then
        await expect(setSaleParams()).to.be.revertedWith("Sale already created.");
      });

      // Deprecated
      xit("Should not set sale parameters if token address is the zero address", async function() {
        // Then
        await expect(setSaleParams({token: ZERO_ADDRESS})).to.be.revertedWith("setSaleParams: Token address can not be 0.");
      });

      it("Should not set sale parameters if sale owner is the zero address", async function() {
        // Then
        await expect(setSaleParams({saleOwner: ZERO_ADDRESS})).to.be.revertedWith("Invalid sale owner address.");
      });

      it("Should not set sale parameters if token price is 0", async function() {
        // Then
        await expect(setSaleParams({tokenPriceInAVAX: 0})).to.be.revertedWith("Invalid input.");
      });

      it("Should not set sale parameters if token amount is 0", async function() {
        // Then
        await expect(setSaleParams({amountOfTokensToSell: 0})).to.be.revertedWith("Invalid input.");
      });

      it("Should not set sale parameters if sale end date is in the past", async function() {
        // Then
        await expect(setSaleParams({saleEndDelta: -100})).to.be.revertedWith("Invalid input.");
      });

      xit("Should not set sale parameters if tokens unlock time is in the past", async function() {
        // Then
        await expect(setSaleParams({tokensUnlockTimeDelta: -100})).to.be.revertedWith("Invalid input.");
      });
    });

    describe("Set sale registration times", async function() {
      it("Should set the registration times", async function() {
        // Given
        await setSaleParams();
        const blockTimestamp = await getCurrentBlockTimestamp();

        const registrationTimeStarts = blockTimestamp + REGISTRATION_TIME_STARTS_DELTA;
        const registrationTimeEnds = blockTimestamp + REGISTRATION_TIME_ENDS_DELTA;

        // When
        await AvalaunchSale.setRegistrationTime(registrationTimeStarts, registrationTimeEnds);

        // Then
        const registration = await AvalaunchSale.registration();
        expect(registration.registrationTimeStarts).to.equal(registrationTimeStarts);
        expect(registration.registrationTimeEnds).to.equal(registrationTimeEnds);
      });

      it("Should not allow non-admin to set registration times", async function() {
        // Given
        await setSaleParams();
        await Admin.removeAdmin(deployer.address);

        // Then
        await expect(setRegistrationTime()).to.be.revertedWith("Restricted to admins.");
      });

      it("Should emit RegistrationTimeSet when setting registration times", async function() {
        // Given
        await setSaleParams();
        const blockTimestamp = await getCurrentBlockTimestamp();

        const registrationTimeStarts = blockTimestamp + REGISTRATION_TIME_STARTS_DELTA;
        const registrationTimeEnds = blockTimestamp + REGISTRATION_TIME_ENDS_DELTA;

        // Then
        await expect(AvalaunchSale.setRegistrationTime(registrationTimeStarts, registrationTimeEnds))
          .to.emit(AvalaunchSale, "RegistrationTimeSet")
          .withArgs(registrationTimeStarts, registrationTimeEnds);
      });

      it("Should not set registration times when gate is closed", async function() {
        // Given
        await setSaleParams();
        await setRegistrationTime();
        await depositTokens();
        await setUpdatePriceInAVAXParams();

        await AvalaunchSale.closeGate();

        // Then
        await expect(setRegistrationTime()).to.be.reverted;
      });

      it("Should not set registration times if registration start time is in the past", async function() {
        // Given
        await setSaleParams();

        // Then
        await expect(setRegistrationTime({registrationTimeStartsDelta: -100})).to.be.reverted;
      });

      it("Should not set registration times if registration end time is in the past", async function() {
        // Given
        await setSaleParams();

        // Then
        await expect(setRegistrationTime({registrationTimeEndsDelta: -100})).to.be.reverted;
      });

      it("Should not set registration times if registration end time is before start time", async function() {
        // Given
        await setSaleParams();

        // Then
        await expect(setRegistrationTime({registrationTimeStartsDelta: 30, registrationTimeEndsDelta: 20})).to.be.reverted;
      });

      it("Should not set registration times if registration end time is equal to start time", async function() {
        // Given
        await setSaleParams();

        // Then
        await expect(setRegistrationTime({registrationTimeStartsDelta: 30, registrationTimeEndsDelta: 30})).to.be.reverted;
      });

      it("Should not set registration times if sale not created", async function() {
        // Then
        await expect(setRegistrationTime()).to.be.reverted;
      });

      it("Should not set registration times beyond sale end", async function() {
        // Given
        await setSaleParams();

        // Then
        await expect(setRegistrationTime({registrationTimeStartsDelta: 20, registrationTimeEndsDelta: SALE_END_DELTA + 100})).to.be.reverted;
      });

      it("Should not set registration times beyond sale start", async function() {
        // Given
        await setSaleParams();
        await setRounds();

        // Then
        await expect(setRegistrationTime({registrationTimeStartsDelta: 1, registrationTimeEndsDelta: ROUNDS_START_DELTAS[0]})).to.be.reverted;
      });
    });

    describe("Edge Cases & Miscellaneous", async function () {
      it("Should register for sale, but not participate and withdraw leftover after", async function() {
        // Given
        await setSaleParams({saleEndDelta: 25});
        await setUpdatePriceInAVAXParams();
        await depositTokens();

        // When
        const blockTimestamp = await getCurrentBlockTimestamp();
        const startTimes = [5,6,7].map((s) => blockTimestamp+s);
        const maxParticipations = ROUNDS_MAX_PARTICIPATIONS;
        await AvalaunchSale.setRounds(startTimes, maxParticipations);

        // Then
        for (let i = 0; i < startTimes.length; i++) {
          expect(await AvalaunchSale.roundIds(i)).to.equal(i+1);
          expect((await AvalaunchSale.roundIdToRound(i+1)).startTime).to.equal(startTimes[i]);
          expect((await AvalaunchSale.roundIdToRound(i+1)).maxParticipation).to.equal(maxParticipations[i]);
        }

        await setRegistrationTime({registrationTimeStartsDelta: 1, registrationTimeEndsDelta: 3});

        // When
        await ethers.provider.send("evm_increaseTime", [1]);
        await ethers.provider.send("evm_mine");

        expect((await AvalaunchSale.registration()).numberOfRegistrants).to.equal(0);

        const roundId = 1;
        const sig = signRegistration(sigExp, deployer.address, roundId, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        // When
        await AvalaunchSale.registerForSale(sig, sigExp, roundId, {value: REGISTRATION_DEPOSIT_AVAX});

        // Then
        expect((await AvalaunchSale.registration()).numberOfRegistrants).to.equal(1);

        let balance = await ethers.provider.getBalance(AvalaunchSale.address)
        // console.log(balance);

        await ethers.provider.send("evm_increaseTime", [30]);
        await ethers.provider.send("evm_mine");

        await AvalaunchSale.withdrawRegistrationFees();

        balance = await ethers.provider.getBalance(AvalaunchSale.address)
        // console.log(balance);
      });

      it("Remove stuck tokens", async () => {
        // Given
        const TokenFactory = await ethers.getContractFactory("XavaToken");
        const testToken = await TokenFactory.deploy("TestToken", "TT", ethers.utils.parseUnits("10000000000000000000000000"), DECIMALS);

        // When
        const val = 1000;
        await testToken.transfer(AvalaunchSale.address, val);

        // Then
        await AvalaunchSale.removeStuckTokens(testToken.address, alice.address);

        expect(await testToken.balanceOf(alice.address)).to.equal(val);
      });

      it("Should not remove XAVA using removeStuckTokens", async () => {
        await AvalaunchSale.setSaleToken(XavaToken.address);

        await expect(AvalaunchSale.removeStuckTokens(XavaToken.address, alice.address))
          .to.be.revertedWith("Can't withdraw sale token.");
      });
    });

    describe("Set sale rounds", async function() {
      it("Should set sale rounds", async function() {
        // Given
        const blockTimestamp = await getCurrentBlockTimestamp();
        const startTimes = ROUNDS_START_DELTAS.map((s) => blockTimestamp+s);
        const maxParticipations = ROUNDS_MAX_PARTICIPATIONS;
        await setSaleParams();

        // When
        await AvalaunchSale.setRounds(startTimes, maxParticipations);

        // Then
        for (let i = 0; i < startTimes.length; i++) {
          expect(await AvalaunchSale.roundIds(i)).to.equal(i+1);
          expect((await AvalaunchSale.roundIdToRound(i+1)).startTime).to.equal(startTimes[i]);
          expect((await AvalaunchSale.roundIdToRound(i+1)).maxParticipation).to.equal(maxParticipations[i]);
        }
      });

      it("Should not allow non-admin to set sale rounds", async function() {
        // Given
        await setSaleParams();
        await Admin.removeAdmin(deployer.address);

        // Then
        await expect(setRounds()).to.be.revertedWith("Restricted to admins.");
      });

      it("Should not set sale rounds if rounds are already set", async function() {
        // Given
        await setSaleParams();
        await setRounds();

        // Then
        await expect(setRounds()).to.be.revertedWith("Rounds set already");
      });

      it("Should not set sale rounds if times and participation arrays lengths don't match", async function() {
        // Given
        await setSaleParams();

        // Then
        await expect(setRounds({maxParticipations: [10, 100]})).to.be.revertedWith("Invalid array lengths.");
      });

      it("Should not set sale rounds if round start times are not sorted", async function() {
        // Given
        await setSaleParams();

        // Then
        await expect(setRounds({startTimes: [50, 45, 60]})).to.be.reverted;
      });

      it("Should not set sale rounds if 0 rounds are provided", async function() {
        // Given
        await setSaleParams();

        // Then
        await expect(setRounds({startTimes: [], maxParticipations: []})).to.be.reverted;
      });

      it("Should not set sale rounds if one round's max participation is 0", async function() {
        // Given
        await setSaleParams();

        // Then
        await expect(setRounds({maxParticipations: [10, 0, 1000]})).to.be.reverted;
      });

      it("Should not set sale rounds if start times are in the past", async function() {
        // Given
        await setSaleParams();

        // Then
        await expect(setRounds({startTimes: [-20, 0, 10], maxParticipations: [10, 10, 10]})).to.be.reverted;
      });

      it("Should not set sale rounds if start times are after sale end date", async function() {
        // Given
        await setSaleParams();

        // Then
        await expect(setRounds({startTimes: [SALE_END_DELTA-10, SALE_END_DELTA, SALE_END_DELTA+10], maxParticipations: [10, 10, 10]})).to.be.reverted;
      });

      it("Should not set sale rounds to overlap with registration", async function() {
        // Given
        await setSaleParams();
        await setRegistrationTime();

        // Then
        await expect(setRounds({startTimes: [REGISTRATION_TIME_ENDS_DELTA-10, REGISTRATION_TIME_ENDS_DELTA, REGISTRATION_TIME_ENDS_DELTA+10], maxParticipations: [10, 10, 10]})).to.be.reverted;
      });

      it("Should not set sale rounds if sale not created", async function() {
        // Then
        await expect(setRounds()).to.be.reverted;
      });

      it("Should emit RoundAdded event", async function() {
        // Given
        const blockTimestamp = await getCurrentBlockTimestamp();
        const startTimes = [blockTimestamp + 50];
        const maxParticipations = [125];
        await setSaleParams();

        // Then
        await expect(AvalaunchSale.setRounds(startTimes, maxParticipations))
          .to.emit(AvalaunchSale, "RoundAdded")
          .withArgs(1, startTimes[0], maxParticipations[0]);
      });

      it("Should set sale token", async function () {
        // Given
        const XavaTokenFactory = await ethers.getContractFactory("XavaToken");
        const XavaToken2 = await XavaTokenFactory.deploy("Xava", "XAVA", ethers.utils.parseUnits("10000000000000000000000000"), 18);

        // When
        await AvalaunchSale.setSaleToken(XavaToken2.address);

        // Then
        const sale = await AvalaunchSale.sale();
        expect(sale[0]).to.equal(XavaToken2.address);
      });

      it("Should add Dexalot Support", async function () {
        const unlockTime = await getCurrentBlockTimestamp() + 100000;
        await AvalaunchSale.setAndSupportDexalotPortfolio(ONE_ADDRESS, unlockTime);

        expect(await AvalaunchSale.dexalotPortfolio()).to.equal(ONE_ADDRESS);
        expect(await AvalaunchSale.dexalotUnlockTime()).to.equal(unlockTime);
      });
    });
  });

  context("Update", async function() {
    describe("Update token price", async function() {
      it("Should set the token price", async function() {
        // Given
        const price = BigNumber.from(TOKEN_PRICE_IN_AVAX).add(1);
        await runFullSetup();

        // When
        await AvalaunchSale.updateTokenPriceInAVAX(price);

        // Then
        expect((await AvalaunchSale.sale()).tokenPriceInAVAX).to.equal(price);
      });

      it("Should not allow non-admin to set token price", async function() {
        // Given
        const price = BigNumber.from(TOKEN_PRICE_IN_AVAX).add(1);
        await runFullSetup();
        await Admin.removeAdmin(deployer.address);

        // Then
        await expect(AvalaunchSale.updateTokenPriceInAVAX(price)).to.be.revertedWith("Restricted to admins.");
      });

      it("Should emit TokenPriceSet event", async function() {
        // Given
        const price = BigNumber.from(TOKEN_PRICE_IN_AVAX).add(1);
        await runFullSetup();

        // Then
        await expect(AvalaunchSale.updateTokenPriceInAVAX(price))
          .to.emit(AvalaunchSale, "TokenPriceSet")
          .withArgs(price);
      });

      // Deprecated
      xit("Should not update token price if 1st round already started", async function() {
        // Given
        const price = BigNumber.from(TOKEN_PRICE_IN_AVAX).add(1);
        await runFullSetup();

        // When
        await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0]]);
        await ethers.provider.send("evm_mine");

        // Then
        await expect(AvalaunchSale.updateTokenPriceInAVAX(price)).to.be.revertedWith("1st round already started.");
      });

      it("Should not update token price to zero", async function() {
        // Given
        const price = 0;
        await runFullSetup();

        // Then
        await expect(AvalaunchSale.updateTokenPriceInAVAX(price)).to.be.revertedWith("Price too different from the previous.");
      });

      // Deprecated
      xit("Should not update token price if rounds not set", async function() {
        // Given
        const price = BigNumber.from(TOKEN_PRICE_IN_AVAX).add(1);
        await setSaleParams();
        await setRegistrationTime();
        await setUpdatePriceInAVAXParams();

        // Then
        await expect(AvalaunchSale.updateTokenPriceInAVAX(price)).to.be.reverted;
      });
    });

    describe("Postpone sale", async function() {
      it("Should postpone the sale", async function() {
        // Given
        const timeToShift = 2;
        await runFullSetup();
        const currentStartRound1 = parseInt((await AvalaunchSale.roundIdToRound(1)).startTime);
        const currentStartRound2 = parseInt((await AvalaunchSale.roundIdToRound(2)).startTime);
        const currentStartRound3 = parseInt((await AvalaunchSale.roundIdToRound(3)).startTime);

        // When
        await AvalaunchSale.postponeSale(timeToShift);

        // Then
        expect((await AvalaunchSale.roundIdToRound(1)).startTime).to.equal(currentStartRound1 + timeToShift);
        expect((await AvalaunchSale.roundIdToRound(2)).startTime).to.equal(currentStartRound2 + timeToShift);
        expect((await AvalaunchSale.roundIdToRound(3)).startTime).to.equal(currentStartRound3 + timeToShift);
      });

      it("Should not allow non-admin to postpone sale", async function() {
        // Given
        const timeToShift = 10;
        await runFullSetup();
        await Admin.removeAdmin(deployer.address);

        // Then
        await expect(AvalaunchSale.postponeSale(timeToShift)).to.be.revertedWith("Restricted to admins.");
      });

      it("Should not postpone sale if sale already started", async function() {
        // Given
        const timeToShift = 10;
        await runFullSetup();

        // When
        await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0]]);
        await ethers.provider.send("evm_mine");

        // Then
        await expect(AvalaunchSale.postponeSale(timeToShift)).to.be.revertedWith("1st round already started.");
      });

      it("Should not postpone sale if rounds not set", async function() {
        // Given
        const timeToShift = 10;
        await setSaleParams();
        await setRegistrationTime();

        // Then
        await expect(AvalaunchSale.postponeSale(timeToShift)).to.be.reverted;
      });
    });

    describe("Extend registration period", async function() {
      it("Should extend the registration period", async function() {
        // Given
        const timeToAdd = 10;
        await runFullSetup();
        const currentRegistrationEnd = parseInt((await AvalaunchSale.registration()).registrationTimeEnds);

        // When
        await AvalaunchSale.extendRegistrationPeriod(timeToAdd);

        // Then
        expect((await AvalaunchSale.registration()).registrationTimeEnds).to.equal(currentRegistrationEnd + timeToAdd);
      });

      it("Should not allow non-admin to extend registration period", async function() {
        // Given
        const timeToAdd = 10;
        await runFullSetup();
        await Admin.removeAdmin(deployer.address);

        // Then
        await expect(AvalaunchSale.extendRegistrationPeriod(timeToAdd)).to.be.revertedWith("Restricted to admins.");
      });

      it("Should not extend registration to overlap sale start", async function() {
        // Given
        const timeToAdd = 60;
        await runFullSetup();
        const currentRegistrationEnd = parseInt((await AvalaunchSale.registration()).registrationTimeEnds);

        // Then
        await expect(AvalaunchSale.extendRegistrationPeriod(timeToAdd)).to.be.revertedWith("Registration period overflows sale start.");
      });
    });

    describe("Set max participation per round", async function() {
      it("Should set max participation per round", async function() {
        // Given
        const rounds = [2, 3];
        const caps = [20, 30];
        await runFullSetup();

        // When
        await AvalaunchSale.setCapPerRound(rounds, caps);

        // Then
        expect((await AvalaunchSale.roundIdToRound(1)).maxParticipation).to.equal(ROUNDS_MAX_PARTICIPATIONS[0]);
        expect((await AvalaunchSale.roundIdToRound(2)).maxParticipation).to.equal(20);
        expect((await AvalaunchSale.roundIdToRound(3)).maxParticipation).to.equal(30);
      });

      it("Should emit MaxParticipationSet", async function() {
        // Given
        const rounds = [2, 3];
        const caps = [20, 30];
        await runFullSetup();

        // Then
        await expect(AvalaunchSale.setCapPerRound(rounds, caps))
          .to.emit(AvalaunchSale, "MaxParticipationSet");
      });

      it("Should not allow non-admin to set max participation", async function() {
        // Given
        const rounds = [2, 3];
        const caps = [20, 30];
        await runFullSetup();
        await Admin.removeAdmin(deployer.address);

        // Then
        await expect(AvalaunchSale.setCapPerRound(rounds, caps)).to.be.revertedWith("Restricted to admins.");
      });

      it("Should not set max participation if first round already started", async function() {
        // Given
        const rounds = [2, 3];
        const caps = [20, 30];
        await runFullSetup();

        // When
        await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0]]);
        await ethers.provider.send("evm_mine");

        // Then
        await expect(AvalaunchSale.setCapPerRound(rounds, caps)).to.be.revertedWith("1st round already started.");
      });

      it("Should not set max participation if round ids and caps array lengths don't match", async function() {
        // Given
        const rounds = [2, 3];
        const caps = [20];
        await runFullSetup();

        // Then
        await expect(AvalaunchSale.setCapPerRound(rounds, caps)).to.be.revertedWith("Invalid array length.");
      });

      it("Should not set max participation to 0", async function() {
        // Given
        const rounds = [2, 3];
        const caps = [0, 15];
        await runFullSetup();

        // Then
        await expect(AvalaunchSale.setCapPerRound(rounds, caps)).to.be.reverted;
      });
    });

    describe("Deposit tokens", async function() {
      it("Should allow sale owner to deposit tokens", async function() {
        // Given
        await runFullSetupNoDeposit();
        await XavaToken.approve(AvalaunchSale.address, AMOUNT_OF_TOKENS_TO_SELL);

        // When
        await AvalaunchSale.depositTokens();

        // Then
        const balance = await XavaToken.balanceOf(AvalaunchSale.address);
        expect(balance).to.equal(AMOUNT_OF_TOKENS_TO_SELL);
      });

      it("Should not allow non-sale owner to deposit tokens", async function() {
        // Given
        await runFullSetupNoDeposit({saleOwner: bob.address});
        await XavaToken.approve(AvalaunchSale.address, AMOUNT_OF_TOKENS_TO_SELL);

        // Then
        await expect(AvalaunchSale.depositTokens()).to.be.revertedWith("Restricted to sale owner.");
      });

      it("Should not deposit tokens when gate is closed", async function() {
        // Given
        await runFullSetupNoDeposit();
        await XavaToken.approve(AvalaunchSale.address, AMOUNT_OF_TOKENS_TO_SELL);
        await AvalaunchSale.depositTokens();
        await setUpdatePriceInAVAXParams();

        await AvalaunchSale.closeGate();
        // Then
        await expect(AvalaunchSale.depositTokens()).to.be.revertedWith("Gate is closed.");
      });

      // Deprecated
      xit("Should not deposit tokens if round already started", async function() {
        // Given
        await runFullSetupNoDeposit();
        await XavaToken.approve(AvalaunchSale.address, AMOUNT_OF_TOKENS_TO_SELL);

        // When
        await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0]]);
        await ethers.provider.send("evm_mine");

        // Then
        await expect(AvalaunchSale.depositTokens()).to.be.revertedWith("Deposit too late. Round already started.");
      });
    });
  });

  context("Registration", async function() {
    describe("Register for sale", async function() {
      it("Should register for sale", async function() {
        // Given
        await runFullSetup();
        expect((await AvalaunchSale.registration()).numberOfRegistrants).to.equal(0);

        const roundId = 1;
        const sig = signRegistration(sigExp, deployer.address, roundId, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
        await ethers.provider.send("evm_mine");

        // When
        await AvalaunchSale.registerForSale(sig, sigExp, roundId, {value: REGISTRATION_DEPOSIT_AVAX});

        // Then
        expect((await AvalaunchSale.registration()).numberOfRegistrants).to.equal(1);
      });

      it("Should not register for round id 0", async function() {
        // Given
        await runFullSetup();
        expect((await AvalaunchSale.registration()).numberOfRegistrants).to.equal(0);

        const roundId = 0;
        const sig = signRegistration(sigExp, deployer.address, roundId, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
        await ethers.provider.send("evm_mine");

        // Then
        await expect(AvalaunchSale.registerForSale(sig, sigExp, roundId, {value: REGISTRATION_DEPOSIT_AVAX}))
          .to.be.revertedWith("Invalid round id.");
      });

      it("Should not register after registration ends", async function() {
        // Given
        await runFullSetup();
        expect((await AvalaunchSale.registration()).numberOfRegistrants).to.equal(0);

        const roundId = 1;
        const sig = signRegistration(sigExp, deployer.address, roundId, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        // When
        await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_ENDS_DELTA + 1]);
        await ethers.provider.send("evm_mine");

        // Then
        await expect(AvalaunchSale.registerForSale(sig, sigExp, roundId, {value: REGISTRATION_DEPOSIT_AVAX}))
          .to.be.revertedWith("Registration gate is closed.");
      });

      it("Should not register before registration starts", async function() {
        // Given
        await runFullSetup();
        expect((await AvalaunchSale.registration()).numberOfRegistrants).to.equal(0);

        const roundId = 1;
        const sig = signRegistration(sigExp, deployer.address, roundId, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        // Then
        await expect(AvalaunchSale.registerForSale(sig, sigExp, roundId, {value: REGISTRATION_DEPOSIT_AVAX}))
          .to.be.revertedWith("Registration gate is closed.");
      });

      it("Should not register if signature invalid", async function() {
        // Given
        await runFullSetup();
        expect((await AvalaunchSale.registration()).numberOfRegistrants).to.equal(0);

        const roundId = 1;
        const sig = signRegistration(sigExp, alice.address, roundId, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
        await ethers.provider.send("evm_mine");

        // Then
        await expect(AvalaunchSale.registerForSale(sig, sigExp, roundId, {value: REGISTRATION_DEPOSIT_AVAX}))
          .to.be.revertedWith("Invalid signature");
      });

      it("Should not register twice", async function() {
        // Given
        await runFullSetup();
        expect((await AvalaunchSale.registration()).numberOfRegistrants).to.equal(0);

        const roundId = 1;
        const sig = signRegistration(sigExp, deployer.address, roundId, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
        await ethers.provider.send("evm_mine");

        await AvalaunchSale.registerForSale(sig, sigExp, roundId, {value: REGISTRATION_DEPOSIT_AVAX});

        // Then
        await expect(AvalaunchSale.registerForSale(sig, sigExp, roundId, {value: REGISTRATION_DEPOSIT_AVAX}))
          .to.be.revertedWith("User already registered.");
      });

      it("Should not register for non-existent roundId", async function() {
        // Given
        await runFullSetup();
        expect((await AvalaunchSale.registration()).numberOfRegistrants).to.equal(0);

        const roundId = 20;
        const sig = signRegistration(sigExp, deployer.address, roundId, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
        await ethers.provider.send("evm_mine");

        // Then
        await expect(AvalaunchSale.registerForSale(sig, sigExp, roundId, {value: REGISTRATION_DEPOSIT_AVAX})).to.be.reverted;
      });

      it("Should emit UserRegistered event", async function() {
        // Given
        await runFullSetup();
        expect((await AvalaunchSale.registration()).numberOfRegistrants).to.equal(0);

        const roundId = 2;
        const sig = signRegistration(sigExp, deployer.address, roundId, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
        await ethers.provider.send("evm_mine");

        // Then
        await expect(AvalaunchSale.registerForSale(sig, sigExp, roundId, {value: REGISTRATION_DEPOSIT_AVAX}))
          .to.emit(AvalaunchSale, "UserRegistered").withArgs(deployer.address, roundId);
      });

      it("Should withdraw registration fees after registration", async function() {
        // Given
        await runFullSetup();
        expect((await AvalaunchSale.registration()).numberOfRegistrants).to.equal(0);

        const roundId = 1;
        const sig = signRegistration(sigExp, deployer.address, roundId, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
        await ethers.provider.send("evm_mine");

        // When
        await AvalaunchSale.registerForSale(sig, sigExp, roundId, {value: REGISTRATION_DEPOSIT_AVAX});

        // Then
        expect((await AvalaunchSale.registration()).numberOfRegistrants).to.equal(1);

        await ethers.provider.send("evm_increaseTime", [SALE_END_DELTA]);
        await ethers.provider.send("evm_mine");

        await AvalaunchSale.withdrawRegistrationFees();

        expect(await AvalaunchSale.registrationFees()).to.equal(0);
      });

      it("Should withdraw unused funds after registration", async function() {
        // Given
        await runFullSetup();
        expect((await AvalaunchSale.registration()).numberOfRegistrants).to.equal(0);

        const roundId = 1;
        const sig = signRegistration(sigExp, deployer.address, roundId, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
        await ethers.provider.send("evm_mine");

        // When
        await AvalaunchSale.registerForSale(sig, sigExp, roundId, {value: REGISTRATION_DEPOSIT_AVAX});

        // Then
        expect((await AvalaunchSale.registration()).numberOfRegistrants).to.equal(1);

        await ethers.provider.send("evm_increaseTime", [SALE_END_DELTA]);
        await ethers.provider.send("evm_mine");

        await AvalaunchSale.withdrawUnusedFunds();

        const bal = await ethers.provider.getBalance(AvalaunchSale.address);
        // TODO:
        // expect(bal).to.equal(0);
      });
    });

    // Deprecated getter function tests
    xdescribe("Get registration info", async function() {
      it("Should return registration info when sale not set", async function() {
        // When
        const regInfo = await AvalaunchSale.getRegistrationInfo();

        // Then
        expect(regInfo[0]).to.equal(0);
        expect(regInfo[1]).to.equal(0);
      });

      it("Should return initial registration info", async function() {
        // Given
        const blockTimestamp = getCurrentBlockTimestamp();
        await runFullSetup();

        // When
        const regInfo = await AvalaunchSale.getRegistrationInfo();

        // Then
        const registrationTimeEnds = (await AvalaunchSale.registration()).registrationTimeEnds;
        expect(regInfo[0]).to.equal(registrationTimeEnds);
        expect(regInfo[1]).to.equal(0);
      });

      it("Should return updated registration info after users registered", async function() {
        // Given
        await runFullSetup();
        await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
        await ethers.provider.send("evm_mine");

        // When
        await registerForSale();

        // Then
        const regInfo = await AvalaunchSale.getRegistrationInfo();
        expect(regInfo[1]).to.equal(1);
      });

      it("Should return updated registration info after registration extended", async function() {
        // Given
        await runFullSetup();

        // When
        const timeToAdd = 10;
        await AvalaunchSale.extendRegistrationPeriod(timeToAdd);

        // Then
        const regInfo = await AvalaunchSale.getRegistrationInfo();
        const registrationTimeEnds = (await AvalaunchSale.registration()).registrationTimeEnds;
        expect(regInfo[0]).to.equal(registrationTimeEnds);
      });
    });
  });

  context("Signature validation", async function() {
    describe("Check registration signature", async function() {
      it("Should succeed for valid signature", async function() {
        // Given
        const sig = signRegistration(sigExp, deployer.address, 1, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        // Then
        expect(await AvalaunchSale.checkRegistrationSignature(sig, sigExp, deployer.address, 1)).to.be.true;
      });

      it("Should fail if signature is for a different user", async function() {
        // Given
        const sig = signRegistration(sigExp, alice.address, 1, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        // Then
        expect(await AvalaunchSale.checkRegistrationSignature(sig, sigExp, deployer.address, 1)).to.be.false;
      });

      it("Should fail if signature is for a different roundId", async function() {
        // Given
        const sig = signRegistration(sigExp, deployer.address, 2, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        // Then
        expect(await AvalaunchSale.checkRegistrationSignature(sig, sigExp, deployer.address, 1)).to.be.false;
      });

      it("Should fail if signature is for a different contract", async function() {
        // Given
        const sig = signRegistration(sigExp, deployer.address, 1, XavaToken.address, DEPLOYER_PRIVATE_KEY);

        // Then
        expect(await AvalaunchSale.checkRegistrationSignature(sig, sigExp, deployer.address, 1)).to.be.false;
      });

      it("Should revert if signature has wrong length", async function() {
        // Given
        const sig = signRegistration(sigExp, deployer.address, 1, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        // Then
        await expect(AvalaunchSale.checkRegistrationSignature(sig.slice(1), sigExp, deployer.address, 1)).to.be.revertedWith("ECDSA: invalid signature length");
      });

      it("Should revert if signature has wrong format", async function() {
        // Given
        const sig = Buffer.alloc(32 + 32 + 1);

        // Then
        await expect(AvalaunchSale.checkRegistrationSignature(sig, sigExp, deployer.address, 1)).to.be.revertedWith("ECDSA: invalid signature 'v' value");
      });

      it("Should fail if signer is sale owner and not admin", async function() {
        // Given
        await runFullSetup();
        await Admin.removeAdmin(deployer.address);
        const sig = signRegistration(sigExp, deployer.address, 1, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        // Then
        expect(await AvalaunchSale.checkRegistrationSignature(sig, sigExp, deployer.address, 1)).to.be.false;
      });

      it("Should fail if signer is neither sale owner nor admin", async function() {
        // Given
        await runFullSetupNoDeposit({saleOwner: alice.address});
        await Admin.removeAdmin(deployer.address);
        const sig = signRegistration(sigExp, deployer.address, 1, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        // Then
        expect(await AvalaunchSale.checkRegistrationSignature(sig, sigExp, deployer.address, 1)).to.be.false;
      });

      it("Should fail if signature is applied to hash instead of prefixed EthereumSignedMessage hash", async function() {
        // Given
        const digest = ethers.utils.keccak256(
          ethers.utils.solidityPack(
            ['address', 'uint256', 'address'],
            [deployer.address, 1, AvalaunchSale.address]
          )
        );
        const {v, r, s} = ethUtil.ecsign(ethUtil.toBuffer(digest), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
        const vb = Buffer.from([v]);
        const sig = Buffer.concat([r, s, vb]);

        // Then
        expect(await AvalaunchSale.checkRegistrationSignature(sig, sigExp, deployer.address, 1)).to.be.false;
      });
    });

    describe("Check participation signature", async function() {
      it("Should succeed for valid signature", async function() {
        // Given
        const sig = signParticipation(deployer.address, 100, 1, AMOUNT_OF_XAVA_TO_BURN, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        // Then
        expect(await AvalaunchSale.checkParticipationSignature(sig, deployer.address, 100, AMOUNT_OF_XAVA_TO_BURN, 1)).to.be.true;
      });

      it("Should fail if signature is for a different user", async function() {
        // Given
        const sig = signParticipation(alice.address, 100, 1, AMOUNT_OF_XAVA_TO_BURN, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        // Then
        expect(await AvalaunchSale.checkParticipationSignature(sig, deployer.address, 100, AMOUNT_OF_XAVA_TO_BURN, 1)).to.be.false;
      });

      it("Should fail if signature is for a different amount", async function() {
        // Given
        const sig = signParticipation(deployer.address, 200, 1, AMOUNT_OF_XAVA_TO_BURN, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        // Then
        expect(await AvalaunchSale.checkParticipationSignature(sig, deployer.address, 100, AMOUNT_OF_XAVA_TO_BURN, 1)).to.be.false;
      });

      it("Should fail if signature is for a different roundId", async function() {
        // Given
        const sig = signParticipation(deployer.address, 100, 2, AMOUNT_OF_XAVA_TO_BURN, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        // Then
        expect(await AvalaunchSale.checkParticipationSignature(sig, deployer.address, 100, AMOUNT_OF_XAVA_TO_BURN, 1)).to.be.false;
      });

      it("Should fail if signature is for a different contract", async function() {
        // Given
        const sig = signParticipation(deployer.address, 100, 1, AMOUNT_OF_XAVA_TO_BURN, XavaToken.address, DEPLOYER_PRIVATE_KEY);

        // Then
        expect(await AvalaunchSale.checkParticipationSignature(sig, deployer.address, 100, AMOUNT_OF_XAVA_TO_BURN, 1)).to.be.false;
      });

      it("Should revert if signature has wrong length", async function() {
        // Given
        const sig = signParticipation(deployer.address, 100, 1, AMOUNT_OF_XAVA_TO_BURN, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        // Then
        await expect(AvalaunchSale.checkParticipationSignature(sig.slice(1), deployer.address, 100, AMOUNT_OF_XAVA_TO_BURN, 1)).to.be.revertedWith("ECDSA: invalid signature length");
      });

      it("Should revert if signature has wrong format", async function() {
        // Given
        const sig = Buffer.alloc(32 + 32 + 1);

        // Then
        await expect(AvalaunchSale.checkParticipationSignature(sig, deployer.address, 100, AMOUNT_OF_XAVA_TO_BURN, 1)).to.be.revertedWith("ECDSA: invalid signature 'v' value");
      });

      it("Should fail if signer is sale owner and not admin", async function() {
        // Given
        await runFullSetup();
        await Admin.removeAdmin(deployer.address);
        const sig = signParticipation(deployer.address, 100, 1, AMOUNT_OF_XAVA_TO_BURN, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        // Then
        expect(await AvalaunchSale.checkParticipationSignature(sig, deployer.address, 100, AMOUNT_OF_XAVA_TO_BURN, 1)).to.be.false;
      });

      it("Should fail if signer is neither sale owner nor admin", async function() {
        // Given
        await runFullSetupNoDeposit({saleOwner: alice.address});
        await Admin.removeAdmin(deployer.address);
        const sig = signParticipation(deployer.address, 100, 1, AMOUNT_OF_XAVA_TO_BURN, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        // Then
        expect(await AvalaunchSale.checkParticipationSignature(sig, deployer.address, 100, AMOUNT_OF_XAVA_TO_BURN, 1)).to.be.false;
      });

      it("Should fail if signature is applied to hash instead of prefixed EthereumSignedMessage hash", async function() {
        // Given
        const digest = ethers.utils.keccak256(
          ethers.utils.solidityPack(
            ['address', 'uint256', 'uint256'],
            [deployer.address, 100, 1]
          )
        );
        const {v, r, s} = ethUtil.ecsign(ethUtil.toBuffer(digest), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
        const vb = Buffer.from([v]);
        const sig = Buffer.concat([r, s, vb]);

        // Then
        expect(await AvalaunchSale.checkParticipationSignature(sig, deployer.address, 100, AMOUNT_OF_XAVA_TO_BURN, 1)).to.be.false;
      });
    });
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
        const participation = await AvalaunchSale.userToParticipation(deployer.address);

        expect(sale.totalTokensSold).to.equal(Math.floor(PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX * MULTIPLIER));
        expect(sale.totalAVAXRaised).to.equal(PARTICIPATION_VALUE);
        expect(isParticipated).to.be.true;
        expect(participation.amountBought).to.equal(Math.floor(PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX * MULTIPLIER));
        expect(participation.roundId).to.equal(PARTICIPATION_ROUND);
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
          .to.be.revertedWith("Not registered for this round.");
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
          .to.be.revertedWith("Crossing max participation.");
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
        const sig = signParticipation(alice.address, PARTICIPATION_AMOUNT, PARTICIPATION_ROUND, AMOUNT_OF_XAVA_TO_BURN, AvalaunchSale.address, DEPLOYER_PRIVATE_KEY);

        // Then
        await expect(AvalaunchSale.participate(PARTICIPATION_AMOUNT, AMOUNT_OF_XAVA_TO_BURN, PARTICIPATION_ROUND, sig, {value: PARTICIPATION_VALUE}))
          .to.be.revertedWith("Invalid signature.");
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
          .to.be.revertedWith("Already participated.");
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
          .to.be.revertedWith("Invalid round.");
      });

      it("Should not participate in a round that has not started", async function() {
        // Given
        await runFullSetup();

        await ethers.provider.send("evm_increaseTime", [REGISTRATION_TIME_STARTS_DELTA]);
        await ethers.provider.send("evm_mine");

        await registerForSale({registerRound: 2});

        await ethers.provider.send("evm_increaseTime", [ROUNDS_START_DELTAS[0] - REGISTRATION_TIME_STARTS_DELTA]);
        await ethers.provider.send("evm_mine");

        // Then
        await expect(participate({participationRound: 2}))
          .to.be.revertedWith("Invalid round.");
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
          .to.be.revertedWith("Exceeding allowance.");
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
        await AvalaunchSale.withdrawMultiplePortions([0]);

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
        await AvalaunchSale.withdrawMultiplePortions([0]);

        // Then
        const currentBalance = ethers.BigNumber.from(await XavaToken.balanceOf(deployer.address));
        expect(currentBalance).to.equal(previousBalance);
      });

      xit("Should not withdraw twice", async function() {
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
        await AvalaunchSale.withdrawMultiplePortions([0]);

        // Then
        // Passes because withdrawMultiplePortions jumps over already withdrawn portions - works properly
        // await expect(AvalaunchSale.withdrawMultiplePortions([0])).to.be.revertedWith("Portion already withdrawn.");
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
        await expect(AvalaunchSale.withdrawMultiplePortions([0])).to.be.revertedWith("Tokens can not be withdrawn yet.");
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
        await expect(AvalaunchSale.withdrawMultiplePortions([0])).to.emit(AvalaunchSale, "TokensWithdrawn").withArgs(deployer.address, Math.floor(PARTICIPATION_VALUE / TOKEN_PRICE_IN_AVAX * 5 / PORTION_VESTING_PRECISION * MULTIPLIER));
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
        await expect(AvalaunchSale.connect(bob).withdrawEarningsAndLeftover()).to.be.revertedWith("Restricted to sale owner.");
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
