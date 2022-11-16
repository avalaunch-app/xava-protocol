const { ethers } = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = require("ethers");

const REWARDS_PER_SECOND = ethers.utils.parseUnits("0.005");
const FEE_PERCENT = 2;
const FEE_PRECISION = 100;
const START_TIMESTAMP_DELTA = 600;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ONE_ADDRESS = "0x0000000000000000000000000000000000000001";
const PORTION_VESTING_PRECISION = 10000;
const NUMBER_1E18 = "1000000000000000000";
const REGISTRATION_DEPOSIT_AVAX = ethers.utils.parseEther('1').toString();
const TOTAL_SALE_TOKENS = ethers.utils.parseEther("1000000").toString();
const SALE_TOKEN_PRICE_IN_AVAX = ethers.utils.parseEther("0.00005").toString();
const SALE_TIME_TO_SHIFT = 6 * 50;

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

async function signParticipation(user, amount, amountXavaToBurn, phaseId, contractAddress) {

    const digest = ethers.utils.solidityKeccak256(
        ['address', 'uint256', 'uint256', 'uint256', 'address', 'string'],
        [user, amount, amountXavaToBurn, phaseId, contractAddress, "participate"]
    );

    return await deployer.signMessage(ethers.utils.arrayify(digest));
}

async function signAddPortionsToMarket(user, contractAddress, portions, sigExpTime) {

    const digest = ethers.utils.solidityKeccak256(
        ['address', 'address', 'uint256[]', 'uint256', 'string'],
        [user, contractAddress, portions, sigExpTime, "addPortionsToMarket"]
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

        const depositAmount = "100000000000000000000";
        await xavaToken.transfer(alice.address, depositAmount);
        await xavaToken.connect(alice).approve(allocationStaking.address, depositAmount);
        await allocationStaking.add(100, xavaToken.address, true);
        await allocationStaking.connect(alice).deposit(0, depositAmount);
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

        it("Should set different sale token, and then re-set old one", async () => {
            await sale.setSaleToken(ONE_ADDRESS);
            let saleDetails = await sale.sale();
            expect(saleDetails.token).to.equal(ONE_ADDRESS);
            // Return to a valid token value
            await sale.setSaleToken(saleToken.address);
            saleDetails = await sale.sale();
            expect(saleDetails.token).to.equal(saleToken.address);
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

        it("Should get vesting info", async () => {
            const vestingInfo = await sale.getVestingInfo();
            //console.log(vestingInfo);
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

        it("Should not set new sale token after deposit", async () => {
            await expect(sale.setSaleToken(saleToken.address))
                .to.be.revertedWith("Tokens already deposited.");
        });

        it("Set dexalot parameters", async () => {
            const unlockTime = await getCurrentBlockTimestamp() + 3600 * 10; // In 10 hrs
            await sale.setDexalotParameters(ONE_ADDRESS, unlockTime);
            expect(await sale.dexalotPortfolio()).to.equal(ONE_ADDRESS);
            expect(await sale.dexalotUnlockTime()).to.equal(unlockTime);
        });
    });

    context("Update Token Price", async () => {
        it("Should update token price the regular way", async () => {
            const newPrice = ethers.utils.parseEther("0.00006").toString();
            await sale.updateTokenPriceInAVAX(newPrice);
            let saleDetails = await sale.sale();
            expect(saleDetails.tokenPriceInAVAX).to.equal(newPrice);
        });

        it("Should not set price if outside of allowed difference", async () => {
            const newPrice = ethers.utils.parseEther("0.0001").toString();
            await expect(sale.updateTokenPriceInAVAX(newPrice))
                .to.be.revertedWith("Price out of range.");
        });

        it("Should override token price", async () => {
            const newPrice = ethers.utils.parseEther("0.0001").toString();
            await sale.overrideTokenPrice(newPrice);
            let saleDetails = await sale.sale();
            expect(saleDetails.tokenPriceInAVAX).to.equal(newPrice);
        });

        after(async () => {
            // Revert to default price
            await sale.overrideTokenPrice(SALE_TOKEN_PRICE_IN_AVAX);
            let saleDetails = await sale.sale();
            expect(saleDetails.tokenPriceInAVAX).to.equal(SALE_TOKEN_PRICE_IN_AVAX);
        });
    });

    context("Lock activation", async () => {
        it("Should not activate lock if caller is not admin", async () => {
            await expect(sale.connect(alice).activateLock()).to.be.revertedWith("Only admin.");
        });

        it("Should activate lock", async () => {
            await expect(sale.activateLock()).to.emit(sale, "LockActivated");
        });

        it("Should not activate lock if it is already active", async () => {
            await expect(sale.activateLock()).to.be.revertedWith("Lock active.");
        });
    });

    context("Marketplace setters", async () => {
        it("Should set new sales factory on marketplace", async () => {
            await marketplace.setFactory(ONE_ADDRESS);
            expect(await marketplace.factory()).to.equal(ONE_ADDRESS);
        });

        it("Should set new fee params on marketplace", async () => {
            await marketplace.setFeeParams(30, 1000);
            expect(await marketplace.feePercentage()).to.equal(30);
            expect(await marketplace.feePrecision()).to.equal(1000);
        });

        // Revert states to original
        after(async () => {
            await marketplace.setFactory(salesFactory.address);
            expect(await marketplace.factory()).to.equal(salesFactory.address);

            await marketplace.setFeeParams(FEE_PERCENT, FEE_PRECISION);
            expect(await marketplace.feePercentage()).to.equal(FEE_PERCENT);
            expect(await marketplace.feePrecision()).to.equal(FEE_PRECISION);
        });
    });

    context("Registration", async () => {
        before(async () => {
            // Change from Idle to Registration Phase
            await sale.connect(deployer).changePhase(1);
        });

        it("Should register for sale", async () => {
            const sigExpTime = await getCurrentBlockTimestamp() + 90;
            const sig = await signRegistration(sigExpTime, alice.address, 3, sale.address);
            await sale.connect(alice).registerForSale(sig, sigExpTime, 3, {value: REGISTRATION_DEPOSIT_AVAX});
        });

        it("Should not register for sale 2nd time", async () => {
            const sigExpTime = await getCurrentBlockTimestamp() + 90;
            const sig = await signRegistration(sigExpTime, alice.address, 3, sale.address);
            await expect(sale.connect(alice).registerForSale(sig, sigExpTime, 2, {value: REGISTRATION_DEPOSIT_AVAX}))
                .to.be.revertedWith("Already registered.");
        });

        it("Should not register for sale outside of phase", async () => {
            await sale.connect(deployer).changePhase(0);

            const sigExpTime = await getCurrentBlockTimestamp() + 90;
            const sig = await signRegistration(sigExpTime, bob.address, 3, sale.address);
            await expect(sale.connect(bob).registerForSale(sig, sigExpTime, 3, {value: REGISTRATION_DEPOSIT_AVAX}))
                .to.be.revertedWith("Must be called during registration phase.");

            await sale.connect(deployer).changePhase(1);
        });
    });

    context("Participation", async () => {
        let amount = "1000000000000000000000"
        let amountXavaToBurn = "1000000000000000000";
        let phaseId = 3;
        let participationMsgValue = ethers.utils.parseEther('0.02').toString();

        before(async () => {
            // Change from Idle to Registration Phase
            await sale.connect(deployer).changePhase(3);
        });

        it("Should participate", async () => {
            const sig = await signParticipation(alice.address, amount, amountXavaToBurn, phaseId, sale.address);
            await expect(sale.connect(alice).participate(amount, amountXavaToBurn, 3, sig, {value: participationMsgValue}))
                .to.emit(sale, "TokensSold")
                .withArgs(alice.address, ethers.BigNumber.from(participationMsgValue).mul(NUMBER_1E18).div(SALE_TOKEN_PRICE_IN_AVAX));
        });

        it("Should not participate for 2nd time", async () => {
            const sig = await signParticipation(alice.address, amount, amountXavaToBurn, phaseId, sale.address);
            await expect(sale.connect(alice).participate(amount, amountXavaToBurn, 3, sig, {value: participationMsgValue}))
                .to.be.revertedWith("Already participated.");
        });

        it("Should not participate for 2nd time", async () => {
            await sale.changePhase(2);
            const sig = await signParticipation(alice.address, amount, amountXavaToBurn, phaseId, sale.address);
            await expect(sale.connect(alice).participate(amount, amountXavaToBurn, 3, sig, {value: participationMsgValue}))
                .to.be.revertedWith("Invalid phase.");
            await sale.changePhase(3);
        });
    });

    context("Misc", async () => {
        it("Shift sale end", async () => {
            const saleData = await sale.sale();
            await sale.shiftSaleEnd(SALE_TIME_TO_SHIFT); // Shift end by 5 minutes
            expect((await sale.sale()).saleEnd).to.equal(BigNumber.from(saleData.saleEnd).add(SALE_TIME_TO_SHIFT));
        });

        it("Should not shift sale end if crossing unlock times", async () => {
            await expect(sale.shiftSaleEnd(SALE_TIME_TO_SHIFT))
                .to.be.revertedWith("Sale end crossing vesting unlock times.");
        });

        it("Shift vesting unlock times", async () => {
            const vestingInfo = await sale.getVestingInfo();
            await sale.shiftVestingUnlockTimes(60*10); // Shift all portion unlock times by 10 minutes
            for (let i = 0; i < vestingInfo[0].length; i++) { // Check that all portions are shifted
                expect((await sale.getVestingInfo())[0][i]).to.equal(BigNumber.from(vestingInfo[0][i]).add(60*10));
            }
        });
    });

    context("Marketplace actions", async () => {

        before(async () => {
            const time = saleEndTime - await getCurrentBlockTimestamp() + SALE_TIME_TO_SHIFT;
            await hre.network.provider.send('evm_increaseTime', [time]);
            await sale.changePhase(0);
        });

        it("Should add portions to market", async () => {
            const portions = [0,1];
            const sigExpTime = await getCurrentBlockTimestamp() + 500;
            const sig = await signAddPortionsToMarket(
                alice.address, sale.address, portions, sigExpTime
            );
            await sale.connect(alice).addPortionsToMarket(portions, sig, sigExpTime);

            // Check that portions are put on market successfully
            expect(await marketplace.listedUserPortionsPerSale(alice.address, sale.address, 0)).to.equal(true);
            expect(await marketplace.listedUserPortionsPerSale(alice.address, sale.address, 1)).to.equal(true);
        });
    });
});