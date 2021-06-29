const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("AvalaunchSale", function() {

  let Admin;
  let AvalaunchSale;
  let XavaToken;
  let SalesFactory;
  let deployer, alice, bob;
  let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const TOKEN_PRICE_IN_AVAX = 12;
  const AMOUNT_OF_TOKENS_TO_SELL = 1000000;
  const SALE_END = 10; // TODO
  const TOKENS_UNLOCK_TIME = 5; // TODO

  beforeEach(async function() {
    const accounts = await ethers.getSigners();
    deployer = accounts[0];
    alice = accounts[1];
    bob = accounts[2];

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
        const BLOCK_TIMESTAMP = (await ethers.provider.getBlock('latest')).timestamp;
        const token = XavaToken.address;
        const saleOwner = deployer.address;
        const tokenPriceInAVAX = TOKEN_PRICE_IN_AVAX;
        const amountOfTokensToSell = AMOUNT_OF_TOKENS_TO_SELL;
        const saleEnd = BLOCK_TIMESTAMP + SALE_END; 
        const tokensUnlockTime = BLOCK_TIMESTAMP + TOKENS_UNLOCK_TIME;

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
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should emit SaleCreated event when parameters are set", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not set sale parameters if sale is already created", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not set sale parameters if token address is the zero address", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not set sale parameters if sale owner is the zero address", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not set sale parameters if token price is 0", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not set sale parameters if token amount is 0", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not set sale parameters if sale end date is in the past", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not set sale parameters if tokens unlock time is in the past", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });
    });

    describe("Set sale registration times", async function() {
      it("Should set the registration times", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not allow non-admin to set registration times", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should emit RegistrationTimeSet when setting registration times", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not set registration times if registration start time is in the past", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not set registration times if registration end time is before start time", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });
    });

    describe("Set sale rounds", async function() {
      it("Should set sale rounds", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not allow non-admin to set sale rounds", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not set sale rounds if rounds are already set", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not set sale rounds if times and participation arrays lengths don't match", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not set sale rounds if round start times are not sorted", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not set sale rounds if one round's max participation is 0", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should emit RoundAdded event", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });
    });
  });

  context("Update", async function() {
    describe("Update token price", async function() {
      it("Should emit set the token price", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not allow non-admin to set token price", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should emit TokenPriceSet event", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not update token price if 1st round already started", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not update token price to zero", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });
    });

    describe("Postpone sale", async function() {
      it("Should postpone the sale", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not allow non-admin to postpone sale", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });

      it("Should not postpone sale if sale already started", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
      });
    });

    describe("Extend registration period", async function() {
      it("Should extend the registration period", async function() {
        // Given
        // When
        // Then
        expect(false).to.be.true;
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

// TODO participate - check deposit tokens has been called
