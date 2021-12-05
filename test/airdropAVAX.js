const { ethers } = require("hardhat");
const { expect } = require("chai");
const { signTokenWithdrawal } = require("./helpers/signatures.js");

const DEPLOYER_PRIVATE_KEY = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const BAD_DEPLOYER_PRIVATE_KEY = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff89";

describe("Airdrop", () => {

    let Admin;
    let deployer, alice, bob, cedric;
    let airdropInstance;

    const WITHDRAW_AMOUNT = 1;

    beforeEach(async function() {
        const accounts = await ethers.getSigners();
        deployer = accounts[0];
        alice = accounts[1];
        bob = accounts[2];
        cedric = accounts[3];

        const AdminFactory = await ethers.getContractFactory("Admin");
        Admin = await AdminFactory.deploy([deployer.address, alice.address, bob.address]);
        await Admin.deployed();

        const Airdrop = await ethers.getContractFactory("AirdropAVAX");
        airdropInstance = await Airdrop.deploy(Admin.address);
        await airdropInstance.deployed();

        const value = "10";
        const tx = await deployer.sendTransaction({
            to: ethers.provider._getAddress(airdropInstance.address),
            value: ethers.utils.parseEther(value)
        });
    });

    context("Main Functionalities", () => {
        describe("WithdrawTokens", () => {
            it("Should withdraw tokens with proper signature", async () => {
                const sig = signTokenWithdrawal(alice.address, WITHDRAW_AMOUNT, airdropInstance.address, DEPLOYER_PRIVATE_KEY);
                expect(await airdropInstance.connect(alice).withdrawTokens(sig, WITHDRAW_AMOUNT))
                    .to.emit(airdropInstance, "SentAVAX")
                    .withArgs(alice.address, WITHDRAW_AMOUNT);
            });

            it("Should not withdraw tokens with invalid signature", async () => {
                const sig = signTokenWithdrawal(alice.address, WITHDRAW_AMOUNT, airdropInstance.address, BAD_DEPLOYER_PRIVATE_KEY);
                await expect(airdropInstance.connect(alice).withdrawTokens(sig, WITHDRAW_AMOUNT))
                    .to.be.revertedWith('Not eligible to claim AVAX!');
            });

            it("Should not withdraw tokens second time", async () => {
                const sig = signTokenWithdrawal(alice.address, WITHDRAW_AMOUNT, airdropInstance.address, DEPLOYER_PRIVATE_KEY);
                expect(await airdropInstance.connect(alice).withdrawTokens(sig, WITHDRAW_AMOUNT))
                    .to.emit(airdropInstance, "SentAVAX")
                    .withArgs(alice.address, WITHDRAW_AMOUNT);
                await expect(airdropInstance.connect(alice).withdrawTokens(sig, WITHDRAW_AMOUNT))
                    .to.be.revertedWith("Already claimed AVAX!");
            });
        });
    });

});
