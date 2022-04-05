const { ethers } = require("hardhat");
const { expect } = require("chai");
const { signTokenWithdrawal } = require("./helpers/signatures.js");

const DEPLOYER_PRIVATE_KEY = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const BAD_DEPLOYER_PRIVATE_KEY = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff89";

describe("Airdrop", () => {

    let Admin;
    let deployer, alice, bob, cedric;
    let airdropInstance, airdropTokenInstance;

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const AIRDROP_TOKEN_TOTAL_SUPPLY = "1000000000000000000000000000";
    const WITHDRAW_AMOUNT = 100;

    beforeEach(async function() {
        const accounts = await ethers.getSigners();
        deployer = accounts[0];
        alice = accounts[1];
        bob = accounts[2];
        cedric = accounts[3];

        const AdminFactory = await ethers.getContractFactory("Admin");
        Admin = await AdminFactory.deploy([deployer.address, alice.address, bob.address]);
        await Admin.deployed();

        const AirdropToken = await ethers.getContractFactory("XavaToken");
        airdropTokenInstance = await AirdropToken.deploy("AirdropToken", "AT", AIRDROP_TOKEN_TOTAL_SUPPLY, 18);
        await airdropTokenInstance.deployed();

        const Airdrop = await ethers.getContractFactory("Airdrop");
        airdropInstance = await Airdrop.deploy(airdropTokenInstance.address, Admin.address);
        await airdropInstance.deployed();

        await airdropTokenInstance.transfer(airdropInstance.address, "10000000000000000");
    });

    context("Main Functionalities", () => {
        describe("WithdrawTokens", () => {
            it("Should withdraw tokens with proper signature", async () => {
                const sig = signTokenWithdrawal(alice.address, WITHDRAW_AMOUNT, airdropInstance.address, DEPLOYER_PRIVATE_KEY);
                expect(await airdropInstance.connect(alice).withdrawTokens(sig, WITHDRAW_AMOUNT))
                    .to.emit(airdropInstance, "TokensAirdropped")
                    .withArgs(alice.address, WITHDRAW_AMOUNT);
            });

            it("Should not withdraw tokens with invalid signature", async () => {
                const sig = signTokenWithdrawal(alice.address, WITHDRAW_AMOUNT, airdropInstance.address, BAD_DEPLOYER_PRIVATE_KEY);
                await expect(airdropInstance.connect(alice).withdrawTokens(sig, WITHDRAW_AMOUNT))
                    .to.be.revertedWith('Not eligible to claim tokens!');
            });

            it("Should not withdraw tokens second time", async () => {
                const sig = signTokenWithdrawal(alice.address, WITHDRAW_AMOUNT, airdropInstance.address, DEPLOYER_PRIVATE_KEY);
                expect(await airdropInstance.connect(alice).withdrawTokens(sig, WITHDRAW_AMOUNT))
                    .to.emit(airdropInstance, "TokensAirdropped")
                    .withArgs(alice.address, WITHDRAW_AMOUNT);
                await expect(airdropInstance.connect(alice).withdrawTokens(sig, WITHDRAW_AMOUNT))
                    .to.be.revertedWith("Already claimed!");
            });
        });
    });

});
