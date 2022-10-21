const { ethers } = require("hardhat");
const { expect } = require("chai");

const REWARDS_PER_SECOND = ethers.utils.parseUnits("0.005");
const FEE_PERCENT = 2;
const FEE_PRECISION = 100;
const START_TIMESTAMP_DELTA = 600;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

describe("Avalaunch Marketplace Tests", async () => {

    let admin, allocationStaking, marketplace, xavaToken, salesFactory, collateral;
    let deployer, mod, alice, bob, charlie;

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

        const allocationStakingFactory = await ethers.getContractFactory("AllocationStaking");
        allocationStaking = await allocationStakingFactory.deploy();
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
        await allocationStaking.initialize(
            xavaToken.address,
            REWARDS_PER_SECOND,
            await getCurrentBlockTimestamp() + START_TIMESTAMP_DELTA,
            salesFactory.address,
            FEE_PERCENT,
            FEE_PRECISION
        );
    });

    context("Testing", async () => {
        it("test", async () => {
        });
    });
});