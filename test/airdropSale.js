const { ethers } = require("hardhat");
const { expect } = require("chai");
const { signMultipleTokenWithdrawal } = require("./helpers/signatures.js");

const DEPLOYER_PRIVATE_KEY = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const BAD_DEPLOYER_PRIVATE_KEY = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff89";

let Admin;
let deployer, alice, bob, cedric;
let airdropInstance, airdropTokenInstance, airdropTokenInstance2;
let amounts, hashedAmounts;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const AIRDROP_TOKEN_TOTAL_SUPPLY = "1000000000000000000000000000";
const WITHDRAW_AMOUNT = 100;

const before = async () => {
    const accounts = await ethers.getSigners();
    deployer = accounts[0];
    alice = accounts[1];
    bob = accounts[2];
    cedric = accounts[3];

    const AdminFactory = await ethers.getContractFactory("Admin");
    Admin = await AdminFactory.deploy([deployer.address, alice.address, bob.address]);
    await Admin.deployed();
}

describe("Airdrop", () => {

    beforeEach(async () => { await before(); });

    context("Main With AVAX", () => {
        beforeEach(async function() {
            const AirdropToken = await ethers.getContractFactory("XavaToken");
            airdropTokenInstance = await AirdropToken.deploy("AirdropToken", "AT", AIRDROP_TOKEN_TOTAL_SUPPLY, 18);
            await airdropTokenInstance.deployed();

            airdropTokenInstance2 = await AirdropToken.deploy("AirdropToken2", "AT2", AIRDROP_TOKEN_TOTAL_SUPPLY, 18);
            await airdropTokenInstance2.deployed();

            const Airdrop = await ethers.getContractFactory("AirdropSale");
            airdropInstance = await Airdrop.deploy([airdropTokenInstance.address, airdropTokenInstance2.address], Admin.address, true);
            await airdropInstance.deployed();

            await airdropTokenInstance.transfer(airdropInstance.address, "10000000000000000");
            await airdropTokenInstance2.transfer(airdropInstance.address, "10000000000000000");

            const value = "10";
            const tx = await deployer.sendTransaction({
                to: ethers.provider._getAddress(airdropInstance.address),
                value: ethers.utils.parseEther(value)
            });

            amounts = [WITHDRAW_AMOUNT, WITHDRAW_AMOUNT + 1, WITHDRAW_AMOUNT + 2];

            hashedAmounts = ethers.utils.keccak256(
                ethers.utils.solidityPack(['uint256[]'], [[amounts[0], amounts[1], amounts[2]]])
            );
        });

        describe("WithdrawTokens", () => {
            it("Should withdraw tokens with proper signature", async () => {
                const sig = signMultipleTokenWithdrawal(alice.address, hashedAmounts, airdropInstance.address, DEPLOYER_PRIVATE_KEY);
                expect(await airdropInstance.connect(alice).withdrawTokens(sig, amounts))
                    .to.emit(airdropInstance, "SentAVAX")
                    .withArgs(alice.address, WITHDRAW_AMOUNT);
            });

            it("Should not withdraw tokens with invalid signature", async () => {
                const sig = signMultipleTokenWithdrawal(alice.address, hashedAmounts, airdropInstance.address, BAD_DEPLOYER_PRIVATE_KEY);
                await expect(airdropInstance.connect(alice).withdrawTokens(sig, amounts))
                    .to.be.revertedWith('Not eligible to claim tokens!');
            });

            it("Should not withdraw tokens second time", async () => {
                const sig = signMultipleTokenWithdrawal(alice.address, hashedAmounts, airdropInstance.address, DEPLOYER_PRIVATE_KEY);
                expect(await airdropInstance.connect(alice).withdrawTokens(sig, amounts))
                    .to.emit(airdropInstance, "SentAVAX")
                    .withArgs(alice.address, amounts[0]);
                await expect(airdropInstance.connect(alice).withdrawTokens(sig, amounts))
                    .to.be.revertedWith("Already claimed!");
            });
        });
    });

    context("Main Without AVAX", () => {
        beforeEach(async function() {
            const AirdropToken = await ethers.getContractFactory("XavaToken");
            airdropTokenInstance = await AirdropToken.deploy("AirdropToken", "AT", AIRDROP_TOKEN_TOTAL_SUPPLY, 18);
            await airdropTokenInstance.deployed();

            airdropTokenInstance2 = await AirdropToken.deploy("AirdropToken2", "AT2", AIRDROP_TOKEN_TOTAL_SUPPLY, 18);
            await airdropTokenInstance2.deployed();

            const Airdrop = await ethers.getContractFactory("AirdropSale");
            airdropInstance = await Airdrop.deploy([airdropTokenInstance.address, airdropTokenInstance2.address], Admin.address, false);
            await airdropInstance.deployed();

            await airdropTokenInstance.transfer(airdropInstance.address, "10000000000000000");
            await airdropTokenInstance2.transfer(airdropInstance.address, "10000000000000000");

            hashedAmounts = ethers.utils.keccak256(
                ethers.utils.solidityPack(
                    ['uint256', 'uint256'],
                    [WITHDRAW_AMOUNT, WITHDRAW_AMOUNT]
                )
            );

            amounts = [WITHDRAW_AMOUNT, WITHDRAW_AMOUNT + 1];

            hashedAmounts = ethers.utils.keccak256(
                ethers.utils.solidityPack(['uint256[]'], [[amounts[0], amounts[1]]])
            );
        });

        describe("WithdrawTokens", () => {
            it("Should withdraw tokens with proper signature", async () => {
                const sig = signMultipleTokenWithdrawal(alice.address, hashedAmounts, airdropInstance.address, DEPLOYER_PRIVATE_KEY);
                expect(await airdropInstance.connect(alice).withdrawTokens(sig, amounts))
                    .to.emit(airdropInstance, "SentERC20")
                    .withArgs(alice.address, airdropTokenInstance.address, WITHDRAW_AMOUNT);
            });

            it("Should not withdraw tokens with invalid signature", async () => {
                const sig = signMultipleTokenWithdrawal(alice.address, hashedAmounts, airdropInstance.address, BAD_DEPLOYER_PRIVATE_KEY);
                await expect(airdropInstance.connect(alice).withdrawTokens(sig, amounts))
                    .to.be.revertedWith('Not eligible to claim tokens!');
            });

            it("Should not withdraw tokens second time", async () => {
                const sig = signMultipleTokenWithdrawal(alice.address, hashedAmounts, airdropInstance.address, DEPLOYER_PRIVATE_KEY);
                expect(await airdropInstance.connect(alice).withdrawTokens(sig, amounts))
                    .to.emit(airdropInstance, "SentERC20")
                    .withArgs(alice.address, airdropTokenInstance.address, amounts[0]);
                await expect(airdropInstance.connect(alice).withdrawTokens(sig, amounts))
                    .to.be.revertedWith("Already claimed!");
            });
        });
    });

    context("Main Only AVAX", () => {
        beforeEach(async function() {
            const Airdrop = await ethers.getContractFactory("AirdropSale");
            airdropInstance = await Airdrop.deploy([], Admin.address, true);
            await airdropInstance.deployed();

            const value = "10";
            const tx = await deployer.sendTransaction({
                to: ethers.provider._getAddress(airdropInstance.address),
                value: ethers.utils.parseEther(value)
            });

            amounts = [WITHDRAW_AMOUNT];

            hashedAmounts = ethers.utils.keccak256(
                ethers.utils.solidityPack(['uint256[]'], [[amounts[0]]])
            );
        });

        describe("WithdrawTokens", () => {
            it("Should withdraw tokens with proper signature", async () => {
                const sig = signMultipleTokenWithdrawal(alice.address, hashedAmounts, airdropInstance.address, DEPLOYER_PRIVATE_KEY);
                expect(await airdropInstance.connect(alice).withdrawTokens(sig, amounts))
                    .to.emit(airdropInstance, "SentAVAX")
                    .withArgs(alice.address, amounts[0]);
            });

            it("Should not withdraw tokens with invalid signature", async () => {
                const sig = signMultipleTokenWithdrawal(alice.address, hashedAmounts, airdropInstance.address, BAD_DEPLOYER_PRIVATE_KEY);
                await expect(airdropInstance.connect(alice).withdrawTokens(sig, amounts))
                    .to.be.revertedWith('Not eligible to claim tokens!');
            });

            it("Should not withdraw tokens second time", async () => {
                const sig = signMultipleTokenWithdrawal(alice.address, hashedAmounts, airdropInstance.address, DEPLOYER_PRIVATE_KEY);
                expect(await airdropInstance.connect(alice).withdrawTokens(sig, amounts))
                    .to.emit(airdropInstance, "SentAVAX")
                    .withArgs(alice.address, amounts[0]);
                await expect(airdropInstance.connect(alice).withdrawTokens(sig, amounts))
                    .to.be.revertedWith("Already claimed!");
            });
        });
    });

});
