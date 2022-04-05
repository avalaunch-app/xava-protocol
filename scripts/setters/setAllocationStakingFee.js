const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require('../utils')
const { ethers, web3 } = hre

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

async function main() {

    const contracts = getSavedContractAddresses()[hre.network.name];

    const allocationStaking = await hre.ethers.getContractAt('AllocationStaking', contracts['AllocationStaking']);
    await allocationStaking.setDepositFee(2, 100);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
