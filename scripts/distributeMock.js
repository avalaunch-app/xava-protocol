const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require('./utils')
const { ethers, web3 } = hre

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

async function main() {

    const contracts = getSavedContractAddresses()[hre.network.name];

    const wallets = [
        "0x8F01cA4c3b90D21DB939a866fD894c92183bDB5f",
        "0x159DD6Fd6cBAD7846fe3d25DbeD301958BBf1a8B",
        "0x920F2A4b60da341844AB7F278F917A7F59883a3e",
        "0x26ec483b35C6c10e4DEEFE77768Fb88eEC012817",
        "0x8077A6319f1661416c63C424F033946e310865AB"
    ];

    const amounts = [
        "0",
        "0",
        "100",
        "100000",
        "0",
    ]

    const xavaMock = await hre.ethers.getContractAt('XavaToken', contracts['MOCK-XAVA']);

    for (let i=0; i < wallets.length; i++) {
        if(amounts[i] !== "0") {
            await xavaMock.transfer(
                wallets[i],
                ethers.utils.parseEther(amounts[i])
            );
            console.log(`Send ${amounts[i]} MOCK-XAVA to ${wallets[i]}`);
        }
    }


}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
