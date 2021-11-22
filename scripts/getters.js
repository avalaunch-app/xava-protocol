// scripts/upgrade-box.js
const { ethers, upgrades } = require("hardhat");
const { getSavedContractAddresses } = require('./utils')
const hre = require("hardhat");

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];
    const allocationStaking = await hre.ethers.getContractAt(
        'AllocationStaking',
        contracts['AllocationStakingProxy']
    );

    const unlockTime = await getCurrentBlockTimestamp();

    const stake = await allocationStaking.deposited(0, '0xE8E6959a29bB94cB1080DE4257417E6f22AB3AE2');
    console.log(stake.toString());

    const fee = await allocationStaking.getWithdrawFee('0xE8E6959a29bB94cB1080DE4257417E6f22AB3AE2', stake.toString(), 0);
    console.log(fee.toString());

    const endDate = await allocationStaking.setTokensUnlockAtForUser(
        '0xE8E6959a29bB94cB1080DE4257417E6f22AB3AE2',
        0,
        unlockTime
    );

}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
