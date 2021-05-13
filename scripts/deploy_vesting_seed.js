const hre = require("hardhat");
const { getSavedContractAddresses, saveContractAddress } = require('./utils')
const config = require('./config.json');

const delay = ms => new Promise(res => setTimeout(res, ms));


async function main() {

    await hre.run('compile')

    const ParticipationVestingSeed = await hre.ethers.getContractFactory('ParticipationVestingSeed');

    const participationVestingContract = await ParticipationVestingSeed.deploy(
        config[hre.network.name].numberOfPortions,
        config[hre.network.name].timeBetweenPortions,
        config[hre.network.name].distributionStartDate,
        config[hre.network.name].firstPortionUnlock,
        config[hre.network.name].adminWallet,
        getSavedContractAddresses()[hre.network.name]["XavaToken"]
    );

    await participationVestingContract.deployed();
    console.log("Participation Vesting Seed contract deployed to: ", participationVestingContract.address);
    saveContractAddress(hre.network.name, 'ParticipationVestingSeed', participationVestingContract.address);

    let token = await hre.ethers.getContractAt('XavaToken', getSavedContractAddresses()[hre.network.name]["XavaToken"]);
    await token.transfer(participationVestingContract.address, "60000000000000000000000");
    console.log('Transfer done');

    await participationVestingContract.registerParticipants(
        ['0xf3B39c28bF4c5c13346eEFa8F90e88B78A610381','0x3EC7eF9B96a36faa0c0949a2ba804f60D12593Dd'],
        ['2000000000000000000000','4000000000000000000000']
    );
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
