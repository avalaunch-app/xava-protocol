const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("AvalaunchSale", function() {

  let Admin;
  let AvalaunchSale;
  let XavaToken;
  let SalesFactory;
  let deployer, alice, bob, cedric;
  let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const TOKEN_PRICE_IN_AVAX = 12;
  const AMOUNT_OF_TOKENS_TO_SELL = 1000000;
  const SALE_END_DELTA = 100;
  const TOKENS_UNLOCK_TIME_DELTA = 150;
  const REGISTRATION_TIME_STARTS_DELTA = 10;
  const REGISTRATION_TIME_ENDS_DELTA = 40;
  const ROUNDS_START_DELTAS = [50, 70, 90];
  const ROUNDS_MAX_PARTICIPATIONS = [100, 1000, 10000];

  function firstOrDefault(first, key, def) {
    if (first && first[key] !== undefined) {
      return first[key];
    }
    return def;
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
    const tokensUnlockTime = blockTimestamp + firstOrDefault(params, 'tokensUnlockTimeDelta', TOKENS_UNLOCK_TIME_DELTA);

    return AvalaunchSale.setSaleParams(token, saleOwner, tokenPriceInAVAX, amountOfTokensToSell, saleEnd, tokensUnlockTime);
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

  async function runFullSetup(params) {
    await setSaleParams(params);
    await setRegistrationTime(params);
    await setRounds(params);
  }

  beforeEach(async function() {
    const accounts = await ethers.getSigners();
    deployer = accounts[0];
    alice = accounts[1];
    bob = accounts[2];
    cedric = accounts[3];

    const XavaTokenFactory = await ethers.getContractFactory("XavaToken");
    XavaToken = await XavaTokenFactory.deploy("Xava", "XAVA", ethers.utils.parseUnits("100000000"), 18);

    const AdminFactory = await ethers.getContractFactory("Admin");
    Admin = await AdminFactory.deploy([deployer.address, alice.address, bob.address]);

    const SalesFactoryFactory = await ethers.getContractFactory("SalesFactory");
    SalesFactory = await SalesFactoryFactory.deploy(Admin.address);
    
    await SalesFactory.deploySale();
    const AvalaunchSaleFactory = await ethers.getContractFactory("AvalaunchSale");
    AvalaunchSale = AvalaunchSaleFactory.attach(await SalesFactory.allSales(0));
  });

  xcontext("Setup", async function() {
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

        // When
        await AvalaunchSale.setSaleParams(token, saleOwner, tokenPriceInAVAX, amountOfTokensToSell, saleEnd, tokensUnlockTime);

        // Then
        const sale = await AvalaunchSale.sale();
        expect(sale.token).to.equal(token);
        expect(sale.isCreated).to.be.true;
        expect(sale.saleOwner).to.equal(saleOwner);
        expect(sale.tokenPriceInAVAX).to.equal(tokenPriceInAVAX);
        expect(sale.amountOfTokensToSell).to.equal(amountOfTokensToSell);
        expect(sale.saleEnd).to.equal(saleEnd);
        expect(sale.tokensUnlockTime).to.equal(tokensUnlockTime);

        expect(await SalesFactory.saleOwnerToSale(saleOwner)).to.equal(AvalaunchSale.address);
        expect(await SalesFactory.tokenToSale(token)).to.equal(AvalaunchSale.address);
      });

      it("Should not allow non-admin to set sale parameters", async function() {
        // Given
        await Admin.removeAdmin(deployer.address);

        // Then
        await expect(setSaleParams()).to.be.revertedWith("Only admin can call this function.");
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

        // Then
        await expect(AvalaunchSale.setSaleParams(token, saleOwner, tokenPriceInAVAX, amountOfTokensToSell, saleEnd, tokensUnlockTime))
          .to.emit(AvalaunchSale, "SaleCreated")
          .withArgs(saleOwner, tokenPriceInAVAX, amountOfTokensToSell, saleEnd, tokensUnlockTime);
      });

      it("Should not set sale parameters if sale is already created", async function() {
        // Given
        await setSaleParams();

        // Then
        await expect(setSaleParams()).to.be.revertedWith("setSaleParams: Sale is already created.");
      });

      it("Should not set sale parameters if token address is the zero address", async function() {
        // Then
        await expect(setSaleParams({token: ZERO_ADDRESS})).to.be.revertedWith("setSaleParams: Token address can not be 0.");
      });

      it("Should not set sale parameters if sale owner is the zero address", async function() {
        // Then
        await expect(setSaleParams({saleOwner: ZERO_ADDRESS})).to.be.revertedWith("setSaleParams: Sale owner address can not be 0.");
      });

      it("Should not set sale parameters if token price is 0", async function() {
        // Then
        await expect(setSaleParams({tokenPriceInAVAX: 0})).to.be.revertedWith("setSaleParams: Bad input");
      });

      it("Should not set sale parameters if token amount is 0", async function() {
        // Then
        await expect(setSaleParams({amountOfTokensToSell: 0})).to.be.revertedWith("setSaleParams: Bad input");
      });

      it("Should not set sale parameters if sale end date is in the past", async function() {
        // Then
        await expect(setSaleParams({saleEndDelta: -100})).to.be.revertedWith("setSaleParams: Bad input");
      });

      it("Should not set sale parameters if tokens unlock time is in the past", async function() {
        // Then
        await expect(setSaleParams({tokensUnlockTimeDelta: -100})).to.be.revertedWith("setSaleParams: Bad input");
      });
    });

    describe("Set sale registration times", async function() {
      it("Should set the registration times", async function() {
        // Given
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
        await Admin.removeAdmin(deployer.address);

        // Then
        await expect(setRegistrationTime()).to.be.revertedWith("Only admin can call this function.");
      });

      it("Should emit RegistrationTimeSet when setting registration times", async function() {
        // Given
        const blockTimestamp = await getCurrentBlockTimestamp();

        const registrationTimeStarts = blockTimestamp + REGISTRATION_TIME_STARTS_DELTA; 
        const registrationTimeEnds = blockTimestamp + REGISTRATION_TIME_ENDS_DELTA;

        // Then
        await expect(AvalaunchSale.setRegistrationTime(registrationTimeStarts, registrationTimeEnds))
          .to.emit(AvalaunchSale, "RegistrationTimeSet")
          .withArgs(registrationTimeStarts, registrationTimeEnds);
      });

      it("Should not set registration times twice", async function() {
        // Given
        await setRegistrationTime()

        // Then
        await expect(setRegistrationTime()).to.be.reverted;
      });

      it("Should not set registration times if registration start time is in the past", async function() {
        // Then
        await expect(setRegistrationTime({registrationTimeStartsDelta: -100})).to.be.reverted;
      });

      it("Should not set registration times if registration end time is in the past", async function() {
        // Then
        await expect(setRegistrationTime({registrationTimeEndsDelta: -100})).to.be.reverted;
      });

      it("Should not set registration times if registration end time is before start time", async function() {
        // Then
        await expect(setRegistrationTime({registrationTimeStartsDelta: 30, registrationTimeEndsDelta: 20})).to.be.reverted;
      });

      it("Should not set registration times if registration end time is equal to start time", async function() {
        // Then
        await expect(setRegistrationTime({registrationTimeStartsDelta: 30, registrationTimeEndsDelta: 30})).to.be.reverted;
      });
    });

    describe("Set sale rounds", async function() {
      it("Should set sale rounds", async function() {
        // Given
        const blockTimestamp = await getCurrentBlockTimestamp();
        const startTimes = ROUNDS_START_DELTAS.map((s) => blockTimestamp+s);
        const maxParticipations = ROUNDS_MAX_PARTICIPATIONS;

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
        await Admin.removeAdmin(deployer.address);

        // Then
        await expect(setRounds()).to.be.revertedWith("Only admin can call this function.");
      });

      it("Should not set sale rounds if rounds are already set", async function() {
        // Given
        await setRounds();
        
        // Then
        await expect(setRounds()).to.be.revertedWith("setRounds: Rounds are already");
      });

      it("Should not set sale rounds if times and participation arrays lengths don't match", async function() {
        // Then
        await expect(setRounds({maxParticipations: [10, 100]})).to.be.revertedWith("setRounds: Bad input.");
      });

      it("Should not set sale rounds if round start times are not sorted", async function() {
        // Then
        await expect(setRounds({startTimes: [50, 45, 60]})).to.be.reverted;
      });

      it("Should not set sale rounds if 0 rounds are provided", async function() {
        // Then
        await expect(setRounds({startTimes: [], maxParticipations: []})).to.be.reverted;
      });

      it("Should not set sale rounds if one round's max participation is 0", async function() {
        // Then
        await expect(setRounds({maxParticipations: [10, 0, 1000]})).to.be.reverted;
      });

      it("Should emit RoundAdded event", async function() {
        // Given
        const blockTimestamp = await getCurrentBlockTimestamp();
        const startTimes = [blockTimestamp + 50];
        const maxParticipations = [125];

        // Then
        await expect(AvalaunchSale.setRounds(startTimes, maxParticipations))
          .to.emit(AvalaunchSale, "RoundAdded")
          .withArgs(1, startTimes[0], maxParticipations[0]);
      });
    });
  });

  context("Update", async function() {
    describe("Update token price", async function() {
      it("Should set the token price", async function() {
        // Given
        const price = 123;
        await runFullSetup();

        // When
        await AvalaunchSale.updateTokenPriceInAVAX(price);

        // Then
        expect((await AvalaunchSale.sale()).tokenPriceInAVAX).to.equal(price);
      });

      it("Should not allow non-admin to set token price", async function() {
        // Given
        const price = 123;
        await runFullSetup();
        await Admin.removeAdmin(deployer.address);

        // Then
        await expect(AvalaunchSale.updateTokenPriceInAVAX(price)).to.be.revertedWith("Only admin can call this function.");
      });

      it("Should emit TokenPriceSet event", async function() {
        // Given
        const price = 123;
        await runFullSetup();

        // Then
        await expect(AvalaunchSale.updateTokenPriceInAVAX(price))
          .to.emit(AvalaunchSale, "TokenPriceSet")
          .withArgs(price);
      });

      it("Should not update token price if 1st round already started", async function() {
        // Given
        const price = 123;
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
        await expect(AvalaunchSale.updateTokenPriceInAVAX(price)).to.be.revertedWith("Price can not be 0.");
      });
    });

    describe("Postpone sale", async function() {
      it("Should postpone the sale", async function() {
        // Given
        const timeToShift = 10;
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
        await expect(AvalaunchSale.postponeSale(timeToShift)).to.be.revertedWith("Only admin can call this function.");
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
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not extend registration to overlap sale start", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });
    });

    describe("Set max participation per round", async function() {
      it("Should set max participation per round", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should emit MaxParticipationSet", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not allow non-admin to set max participation", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not set max participation if first round already started", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not set max participation if round ids and caps array lengths don't match", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("[???] Should not set max participation to 0", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });
    });

    describe("Deposit tokens", async function() {
      it("Should allow sale owner to deposit tokens", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not allow non-sale owner to deposit tokens", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not deposit tokens twice", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not deposit tokens if round already started", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });
    });
  });
});

// postpone - should not postpone if rounds not set
// updateTokenPrice - must check setRounds has been called
// set registration time - no check sale has been created
// set registration time - can set after sale ends
// set registration time - no check does not overlap sale start
// TODO participate - check deposit tokens has been called
// TODO register - no check for registration time starts
// GetCurrentRound - must use saleEnd for ended
// setRounds - no check sale has been created
// setRounds - no check rounds are before sale end
// setRounds - no check sale does not overlap registration