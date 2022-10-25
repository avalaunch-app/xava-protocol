const { ethers } = require("hardhat");
const { expect } = require("chai");
const ethUtil = require("ethereumjs-util");


const REWARDS_PER_SECOND = ethers.utils.parseUnits("0.005");
const FEE_PERCENT = 2;
const FEE_PRECISION = 100;
const START_TIMESTAMP_DELTA = 600;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const PORTION_VESTING_PRECISION = 10000;
const REGISTRATION_DEPOSIT_AVAX = ethers.utils.parseEther('1').toString();
const TOTAL_SALE_TOKENS = ethers.utils.parseEther("1000000").toString();
const SALE_TOKEN_PRICE_IN_AVAX = ethers.utils.parseEther("0.00005").toString();

let admin, allocationStaking, marketplace, xavaToken, salesFactory, collateral;
let deployer, mod, alice, bob, charlie;
let sale, saleToken, saleEndTime, unlockingTimes, percents;

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

async function signRegistration(sigExpTime, registrant, phaseId, contractAddress) {

    const digest = ethers.utils.solidityKeccak256(
        ['uint256', 'address', 'uint256', 'address', 'string'],
        [sigExpTime, registrant, phaseId, contractAddress, "registerForSale"]
    );

    return await deployer.signMessage(ethers.utils.arrayify(digest));
}

describe("Avalaunch Sale V2/Marketplace Tests", async () => {

    before(async () => {
        const accounts = await ethers.getSigners();

        deployer = accounts[0];
        mod = accounts[1];
        alice = accounts[2];
        bob = accounts[3];
        charlie = accounts[4];

        const adminFactory = await ethers.getContractFactory("Admin");
        admin = await adminFactory.deploy([deployer.address]);
        await admin.deployed();

        const collateralFactory = await ethers.getContractFactory("AvalaunchCollateral");
        collateral = await collateralFactory.deploy();
        await collateral.deployed();
        await collateral.initialize(deployer.address, admin.address, 43114);

        const xavaTokenFactory = await ethers.getContractFactory("XavaToken");
        xavaToken = await xavaTokenFactory.deploy("Avalaunch Token", "XAVA", "1000000000000000000000000", 18);
        await xavaToken.deployed();

        saleToken = await xavaTokenFactory.connect(mod).deploy("Sale Token", "ST", "1000000000000000000000000", 18);
        await saleToken.deployed();

        const allocationStakingFactory = await ethers.getContractFactory("AllocationStaking");
        allocationStaking = await allocationStakingFactory.connect(deployer).deploy();
        await allocationStaking.deployed();

        const marketplaceFactory = await ethers.getContractFactory("AvalaunchMarketplace");
        marketplace = await marketplaceFactory.deploy();
        await marketplace.deployed();

        const salesFactoryFactory = await ethers.getContractFactory("SalesFactory");
        salesFactory = await salesFactoryFactory.deploy(
            admin.address,
            allocationStaking.address,
            collateral.address,
            marketplace.address,
            mod.address
        );
        await salesFactory.deployed();

        await marketplace.initialize(admin.address, salesFactory.address, FEE_PERCENT, FEE_PRECISION);

        const saleImplementationFactory = await ethers.getContractFactory("AvalaunchSaleV2");
        const saleImplementation = await saleImplementationFactory.deploy();
        await saleImplementation.deployed();

        await salesFactory.setImplementation(saleImplementation.address);

        await salesFactory.deploySale();

        sale = await ethers.getContractAt("AvalaunchSaleV2", await salesFactory.getLastDeployedSale());

        await allocationStaking.initialize(
            xavaToken.address,
            REWARDS_PER_SECOND,
            await getCurrentBlockTimestamp() + START_TIMESTAMP_DELTA,
            salesFactory.address,
            FEE_PERCENT,
            FEE_PRECISION
        );
    });

    context("Sale Setup", async () => {

        before(async () => {
            saleEndTime = await getCurrentBlockTimestamp() + 3600 * 2;
            percents = [2000, 2000, 2000, 2000, 2000];
            unlockTimes = [
                saleEndTime + 600,
                saleEndTime + 600 * 2, 
                saleEndTime + 600 * 3, 
                saleEndTime + 600 * 4, 
                saleEndTime + 600 * 5
            ];
        });

        it("Should not set vesting params when sale params are not set", async () => {
            await expect(sale.setVestingParams(
                unlockTimes,
                percents
            )).to.be.revertedWith("Sale params not set.");
        });

        it("Should set sale params", async () => {
            await expect(sale.setSaleParams(
                saleToken.address,
                SALE_TOKEN_PRICE_IN_AVAX,
                TOTAL_SALE_TOKENS,
                saleEndTime,
                PORTION_VESTING_PRECISION,
                REGISTRATION_DEPOSIT_AVAX
            ))
            .to.emit(sale, "SaleCreated")
            .withArgs(
                SALE_TOKEN_PRICE_IN_AVAX,
                TOTAL_SALE_TOKENS,
                saleEndTime
            );
        });

        it("Should revert set vesting params with invalid percents", async () => {
            percents[4] = 1999;

            await expect(sale.setVestingParams(
                unlockTimes,
                percents
            )).to.be.revertedWith("Invalid percentage calculation.");

            percents[4] = 2000;
        });

        it("Should set vesting params", async () => {
            await sale.setVestingParams(
                unlockTimes,
                percents
            );
        });

        it("Should not set vesting params for the second time", async () => {
            await expect(sale.setVestingParams(
                unlockTimes,
                percents
            )).to.be.revertedWith("Already set.");
        });

        it("Should deposit tokens", async () => {
            await saleToken.connect(mod).approve(sale.address, TOTAL_SALE_TOKENS);
            await sale.connect(mod).depositTokens();

            expect(await saleToken.balanceOf(sale.address)).to.be.equal(TOTAL_SALE_TOKENS);
            expect(await saleToken.balanceOf(mod.address)).to.be.equal(0);
        });
    });

    context("Registration", async () => {

        before(async () => {
            // Change from Idle to Registration Phase
            await sale.connect(deployer).changePhase(1);
        });

        it("Register for sale", async () => {
            const sigExpTime = await getCurrentBlockTimestamp() + 90;
            const sig = await signRegistration(sigExpTime, alice.address, 3, sale.address);
            await sale.connect(alice).registerForSale(sig, sigExpTime, 3, {value: REGISTRATION_DEPOSIT_AVAX});
        });
    });
});