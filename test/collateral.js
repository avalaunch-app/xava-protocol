const hre = require("hardhat");
const { expect } = require("chai");

let Admin, collateral;
let deployer, alice, bob, cedric;
let ONE_ADDRESS = "0x0000000000000000000000000000000000000001";

const sendAsync = (payload) =>
    new Promise((resolve, reject) => {
        hre.web3.currentProvider.send(payload, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res.result);
            }
        });
    });

const generateSignature = async (message, type, primaryType) => {
    const data = {
        domain: {
            name: 'AvalaunchApp',
            version: '1',
            chainId: 43114,
            verifyingContract: collateral.address.toString(),
        },
        message,
        ...primaryType,
        types: {
            EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
            ],
            ...type,
        },
    };

    const msgParams = JSON.stringify(data);
    const from = deployer.address;
    const params = [from, msgParams];
    const method = 'eth_signTypedData_v4';

    return await sendAsync(
        {
            method,
            params,
            from
        }
    );
}

describe("Collateral", function() {

    beforeEach(async function() {
        const accounts = await ethers.getSigners();
        deployer = accounts[0];
        alice = accounts[1];
        bob = accounts[2];
        cedric = accounts[3];

        const AdminFactory = await ethers.getContractFactory("Admin");
        Admin = await AdminFactory.deploy([deployer.address, alice.address, bob.address]);

        const collateralFactory = await ethers.getContractFactory("AvalaunchCollateral");
        collateral = await collateralFactory.deploy();
        await collateral.deployed();
        await collateral.initialize(deployer.address, Admin.address, 43114);
    });

    context("Deposit & Withdraw", async function () {
        it("Should deposit collateral", async function () {
            const value = hre.ethers.utils.parseEther("1");
            await collateral.depositCollateral({value: value});
            expect(await hre.ethers.provider.getBalance(collateral.address)).to.equal(value);
        });

        it("Should withdraw collateral", async function () {
            const value = hre.ethers.utils.parseEther("1");
            await collateral.depositCollateral({value: value});
            expect(await hre.ethers.provider.getBalance(collateral.address)).to.equal(value);
            await expect(collateral.withdrawCollateral(value))
                .to.emit(collateral, "WithdrawnCollateral");
        });

        it("Should not withdraw more than deposited", async function () {
            const value = hre.ethers.utils.parseEther("1");
            await collateral.depositCollateral({value: value});
            expect(await hre.ethers.provider.getBalance(collateral.address)).to.equal(value);
            await expect(collateral.withdrawCollateral(value + 1))
                .to.be.revertedWith("Not enough funds.");
        });
    });

    context("Moderator Only Functions", async function () {
        it("Should set new moderator", async function () {
           expect(await collateral.moderator()).to.equal(deployer.address);
           await collateral.setModerator(alice.address);
           expect(await collateral.moderator()).to.equal(alice.address);
        });

        it("Should approve sale", async function () {
            expect(await collateral.isSaleApprovedByModerator(ONE_ADDRESS)).to.equal(false);
            await collateral.approveSale(ONE_ADDRESS);
            expect(await collateral.isSaleApprovedByModerator(ONE_ADDRESS)).to.equal(true);
        });
    });

    context("Miscellaneous", async function () {
       it("get TVL", async function () {
          expect(await collateral.getTVL()).to.equal(await hre.ethers.provider.getBalance(collateral.address));
       });
    });

    context("Signature Testing", async function() {
        it("Should verify user's autoBuy signature", async function() {
            let messageJSON = {
                confirmationMessage: "Turn AutoBUY ON.",
                saleAddress: ONE_ADDRESS
            };
            let message = eval(messageJSON);

            let type = {
                AutoBuy: [
                    { name: 'confirmationMessage', type: 'string' },
                    { name: 'saleAddress', type: 'address' }
                ],
            };

            let primaryType = {
                primaryType: 'AutoBuy'
            };

            expect(await collateral.verifyAutoBuySignature(
                deployer.address,
                ONE_ADDRESS,
                await generateSignature(message, type, primaryType)
            )).to.equal(true);
        });

        it("Should fail verifying user's autoBuy signature - bad user", async function() {
            let messageJSON = {
                confirmationMessage: "Turn AutoBUY ON.",
                saleAddress: ONE_ADDRESS
            };
            let message = eval(messageJSON);

            let type = {
                AutoBuy: [
                    { name: 'confirmationMessage', type: 'string' },
                    { name: 'saleAddress', type: 'address' }
                ],
            };

            let primaryType = {
                primaryType: 'AutoBuy'
            };

            expect(await collateral.verifyAutoBuySignature(
                alice.address,
                ONE_ADDRESS,
                await generateSignature(message, type, primaryType)
            )).to.equal(false);
        });

        it("Should verify user's boost signature", async function() {
            let messageJSON = {
                confirmationMessage: "Boost participation.",
                saleAddress: ONE_ADDRESS
            };
            let message = eval(messageJSON);

            let type = {
                Boost: [
                    { name: 'confirmationMessage', type: 'string' },
                    { name: 'saleAddress', type: 'address' }
                ],
            };

            let primaryType = {
                primaryType: 'Boost'
            };

            expect(await collateral.verifyBoostSignature(
                deployer.address,
                ONE_ADDRESS,
                await generateSignature(message, type, primaryType)
            )).to.equal(true);
        });

        it("Should fail verifying user's boost signature - bad user", async function() {
            let messageJSON = {
                confirmationMessage: "Boost participation.",
                saleAddress: ONE_ADDRESS
            };
            let message = eval(messageJSON);

            let type = {
                Boost: [
                    { name: 'confirmationMessage', type: 'string' },
                    { name: 'saleAddress', type: 'address' }
                ],
            };

            let primaryType = {
                primaryType: 'Boost'
            };

            expect(await collateral.verifyBoostSignature(
                alice.address,
                ONE_ADDRESS,
                await generateSignature(message, type, primaryType)
            )).to.equal(false);
        });
    });
});
