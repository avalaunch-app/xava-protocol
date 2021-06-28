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
    });
  });
});
