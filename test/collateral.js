const hre  = require("hardhat");
const { expect } = require("chai");

let Admin, collateral;
let deployer, alice, bob, cedric;
let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
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
