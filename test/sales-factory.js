const { ethers } = require("hardhat");
const { expect } = require("chai");
const ethUtil = require("ethereumjs-util")

describe("SalesFactory", function() {

  let Admin;
  let Collateral;
  let AvalaunchSale;
  let XavaToken;
  let Marketplace;
  let SalesFactory;
  let AvalaunchSaleFactory;
  let deployer, alice, bob;

  let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const REWARDS_PER_SECOND = ethers.utils.parseUnits("0.1");
  const DEPOSIT_FEE_PERCENT = 5;
  const DEPOSIT_FEE_PRECISION = 100;
  const REGISTRATION_DEPOSIT_AVAX = 1;
  const PORTION_VESTING_PRECISION = 100;
  const START_TIMESTAMP_DELTA = 600;

  // const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY
  const DEPLOYER_PRIVATE_KEY = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
  }

  beforeEach(async function() {
    const accounts = await ethers.getSigners();
    deployer = accounts[0];
    alice = accounts[1];
    bob = accounts[2];

    const XavaTokenFactory = await ethers.getContractFactory("XavaToken");
    XavaToken = await XavaTokenFactory.deploy("Xava", "XAVA", ethers.utils.parseUnits("100000000"), 18);
    XavaToken2 = await XavaTokenFactory.deploy("Xava2", "XAVA2", ethers.utils.parseUnits("100000000"), 18);

    const AdminFactory = await ethers.getContractFactory("Admin");
    Admin = await AdminFactory.deploy([deployer.address, alice.address, bob.address]);

    const CollateralFactory = await ethers.getContractFactory("AvalaunchCollateral");
    Collateral = await CollateralFactory.deploy();
    await Collateral.deployed();
    await Collateral.initialize(deployer.address, Admin.address, 43114);

    const SalesFactoryFactory = await ethers.getContractFactory("SalesFactory");
    SalesFactory = await SalesFactoryFactory.deploy(Admin.address, ZERO_ADDRESS, Collateral.address, ZERO_ADDRESS, deployer.address);
    await SalesFactory.deployed();

    const MarketplaceFactory = await ethers.getContractFactory("AvalaunchMarketplace");
    Marketplace = await MarketplaceFactory.deploy();
    await Marketplace.initialize(Admin.address, SalesFactory.address, 200, 100000);

    const AvalaunchSaleV2Factory = await ethers.getContractFactory("AvalaunchSaleV2");
    AvalaunchSale = await AvalaunchSaleV2Factory.deploy();

    await SalesFactory.setImplementation(AvalaunchSale.address);
    await SalesFactory.setAvalaunchMarketplace(Marketplace.address);

    AllocationStakingRewardsFactory = await ethers.getContractFactory("AllocationStaking");
    const blockTimestamp = await getCurrentBlockTimestamp();
    startTimestamp = blockTimestamp + START_TIMESTAMP_DELTA;
    AllocationStaking = await AllocationStakingRewardsFactory.deploy();
    await AllocationStaking.initialize(XavaToken.address, REWARDS_PER_SECOND, startTimestamp, SalesFactory.address, DEPOSIT_FEE_PERCENT, DEPOSIT_FEE_PRECISION);

    await AllocationStaking.add(1, XavaToken.address, false);
    await SalesFactory.setAllocationStaking(AllocationStaking.address);

    AvalaunchSaleFactory = await ethers.getContractFactory("AvalaunchSale");
  });

  context("Setup", async function() {
    it("Should setup the factory correctly", async function() {
      // Given
      let admin = await SalesFactory.admin();

      // Then
      expect(admin).to.equal(Admin.address);
    });

    describe("Set allocation staking", async function() {
      it("Should set allocation staking contract", async function() {
        // When
        await SalesFactory.setAllocationStaking(XavaToken.address);

        // Then
        expect(await SalesFactory.allocationStaking()).to.equal(XavaToken.address);
      });

      it("Should not set allocation staking contract to zero address", async function() {
        // Then
        await expect(SalesFactory.setAllocationStaking(ZERO_ADDRESS)).to.be.reverted;
      });

      it("Should not allow non-admin to set allocation staking contract", async function() {
        // Given
        await Admin.removeAdmin(deployer.address);

        // Then
        await expect(SalesFactory.setAllocationStaking(XavaToken.address)).to.be.reverted;
      });
    });
  });

  context("Sales", async function() {
    describe("Deploy sale", async function() {
      it("Should deploy sale", async function() {
        // When
        await SalesFactory.deploySale();

        // Then
        expect(await SalesFactory.getNumberOfSalesDeployed()).to.equal(1);
        const saleAddress = await SalesFactory.allSales(0);
        expect(await SalesFactory.isSaleCreatedThroughFactory(saleAddress)).to.be.true;
      });

      it("Should not allow non-admin to deploy sale", async function() {
        // Given
        await Admin.removeAdmin(deployer.address);

        // Then
        await expect(SalesFactory.deploySale()).to.be.revertedWith("Only Admin can deploy sales");
      });

      it("Should emit SaleDeployed event", async function() {
        // Then
        await expect(SalesFactory.deploySale()).to.emit(SalesFactory, "SaleDeployed");
      });
    });

    describe("Set sale owner and token", async function() {
      // TODO: Re-enable and fix
      xit("Should set sale owner and token", async function() {
        // Given
        await SalesFactory.deploySale();
        const AvalaunchSale = AvalaunchSaleFactory.attach(await SalesFactory.allSales(0));

        // When
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        await AvalaunchSale.setSaleParams(XavaToken.address, deployer.address, 10, 10, blockTimestamp + 100,
             PORTION_VESTING_PRECISION, 1, REGISTRATION_DEPOSIT_AVAX);

        // Deprecated checks
        // expect(await SalesFactory.saleOwnerToSale(deployer.address)).to.equal(AvalaunchSale.address);
        // expect(await SalesFactory.tokenToSale(XavaToken.address)).to.equal(AvalaunchSale.address);

        // Then
        const sale = await AvalaunchSale.sale();
        expect(sale.saleOwner).to.equal(deployer.address);
        expect(sale.token).to.equal(XavaToken.address);
      });

      // Deprecated
      xit("Should emit SaleOwnerAndTokenSetInFactory event", async function() {
        // Given
        await SalesFactory.deploySale();
        const AvalaunchSale = AvalaunchSaleFactory.attach(await SalesFactory.allSales(0));

        // Then
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        await expect(AvalaunchSale.setSaleParams(
            XavaToken.address, deployer.address, 10, 10, blockTimestamp + 100,
            blockTimestamp + 10, PORTION_VESTING_PRECISION, 1, REGISTRATION_DEPOSIT_AVAX
        )).to.emit(SalesFactory, "SaleOwnerAndTokenSetInFactory");
      });

      // Deprecated
      xit("Should not allow same sale owner to own two sales", async function() {
        // Given
        await SalesFactory.deploySale();
        const AvalaunchSale = AvalaunchSaleFactory.attach(await SalesFactory.allSales(0));

        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        await AvalaunchSale.setSaleParams(
            XavaToken.address, deployer.address, 10, 10, blockTimestamp + 100,
            blockTimestamp + 10, PORTION_VESTING_PRECISION, 1, REGISTRATION_DEPOSIT_AVAX
        );

        // When
        await SalesFactory.deploySale();
        const AvalaunchSale2 = AvalaunchSaleFactory.attach(await SalesFactory.allSales(1));

        // Then
        await expect(AvalaunchSale2.setSaleParams(
            XavaToken.address, deployer.address, 10, 10, blockTimestamp + 100,
            blockTimestamp + 10, PORTION_VESTING_PRECISION, 2, REGISTRATION_DEPOSIT_AVAX
        )).to.be.revertedWith("Sale owner already set.");
      });

      // Deprecated
      xit("Should not allow same token to be part of two sales", async function() {
        // Given
        await SalesFactory.deploySale();
        const AvalaunchSale = AvalaunchSaleFactory.attach(await SalesFactory.allSales(0));

        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        await AvalaunchSale.setSaleParams(
            XavaToken.address, deployer.address, 10, 10, blockTimestamp + 100,
            blockTimestamp + 10, PORTION_VESTING_PRECISION, 1, REGISTRATION_DEPOSIT_AVAX
        );

        // When
        await SalesFactory.deploySale();
        const AvalaunchSale2 = AvalaunchSaleFactory.attach(await SalesFactory.allSales(1));

        // Then
        await expect(AvalaunchSale2.setSaleParams(XavaToken.address, alice.address, 10, 10, blockTimestamp + 100, blockTimestamp + 10))
          .to.be.revertedWith("Sale token already set.");
      });

      // Deprecated
      xit("Should not allow address to set sale owner and token if address not deployed through factory", async function() {
        // Given
        await SalesFactory.deploySale();

        // Then
        await expect(SalesFactory.setSaleOwnerAndToken(deployer.address, XavaToken.address))
          .to.be.revertedWith("setSaleOwnerAndToken: Contract not eligible.");
      });
    });

    describe("Get number of sales deployed", async function() {
      it("Should return 0 if there are no sales", async function() {
        // Then
        expect (await SalesFactory.getNumberOfSalesDeployed()).to.equal(0);
      });

      it("Should return number of sales if there is only one sale", async function() {
        // Given
        await SalesFactory.deploySale();

        // Then
        expect (await SalesFactory.getNumberOfSalesDeployed()).to.equal(1);
      });

      it("Should return number of sales if there are multiple sales", async function() {
        // Given
        await SalesFactory.deploySale();
        await SalesFactory.deploySale();
        await SalesFactory.deploySale();

        // Then
        expect (await SalesFactory.getNumberOfSalesDeployed()).to.equal(3);
      });
    });

    describe("Get all sales", async function() {
      it("Should return last deployed sale", async function() {
        // Given
        // Condition: There were no sales deployed before
        await SalesFactory.deploySale();

        let sale = await SalesFactory.allSales(0);
        expect(await SalesFactory.getLastDeployedSale()).to.equal(sale);
      });

      it("Should return zero address if there were no sales deployed", async function() {
        // Given
        // Condition: There were no sales deployed before

        expect(await SalesFactory.getLastDeployedSale()).to.equal(ZERO_ADDRESS);
      });

      describe("With 3 deployed sales", async function() {
        
        beforeEach(async function() {
          // Given
          await SalesFactory.deploySale();
          await SalesFactory.deploySale();
          await SalesFactory.deploySale();
        });

        it("Should return only first sale", async function() {
          // When
          const sales = await SalesFactory.getAllSales(0, 0);
  
          // Then
          expect(sales.length).to.equal(1);
          expect(sales[0]).to.equal(await SalesFactory.allSales(0));
        });
  
        it("Should return only last sale", async function() {
          // When
          const sales = await SalesFactory.getAllSales(2, 2);
  
          // Then
          expect(sales.length).to.equal(1);
          expect(sales[0]).to.equal(await SalesFactory.allSales(2));
        });
  
        it("Should return all sales", async function() {
          // When
          const sales = await SalesFactory.getAllSales(0, 2);
  
          // Then
          expect(sales.length).to.equal(3);
          expect(sales[0]).to.equal(await SalesFactory.allSales(0));
          expect(sales[1]).to.equal(await SalesFactory.allSales(1));
          expect(sales[2]).to.equal(await SalesFactory.allSales(2));
        });
  
        xit("Should not return 0 sales", async function() {
          // Then
          await expect(SalesFactory.getAllSales(2, 2)).to.be.reverted;
        });
  
        it("Should not return sales if start index is higher than end index", async function() {
          // Then
          await expect(SalesFactory.getAllSales(1, 0)).to.be.reverted;
        });
  
        it("Should not allow negative start index", async function() {
          // Then
          await expect(SalesFactory.getAllSales(-5, 2)).to.be.reverted;
        });
  
        it("Should not allow end index out of bounds", async function() {
          // Then
          await expect(SalesFactory.getAllSales(1, 12)).to.be.reverted;
        });
  
        it("Should not allow start index out of bounds", async function() {
          // Then
          await expect(SalesFactory.getAllSales(12, 13)).to.be.reverted;
        });
      })
    });
  });
});
