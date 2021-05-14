const hre = require("hardhat");
const { getSavedContractAddresses, saveContractAddress } = require('./utils')
const config = require('./config.json');

const delay = ms => new Promise(res => setTimeout(res, ms));


async function main() {

    await hre.run('compile')

    const ParticipationVestingPrivate = await hre.ethers.getContractFactory('ParticipationVestingPrivate');

    const participationVestingContract = await ParticipationVestingPrivate.deploy(
        config[hre.network.name].numberOfPortions,
        config[hre.network.name].timeBetweenPortions,
        config[hre.network.name].distributionStartDate,
        config[hre.network.name].firstPortionUnlock,
        config[hre.network.name].adminWallet,
        getSavedContractAddresses()[hre.network.name]["XavaToken"]
    );

    await participationVestingContract.deployed();
    console.log("Participation Vesting Private contract deployed to: ", participationVestingContract.address);
    saveContractAddress(hre.network.name, 'ParticipationVestingPrivate', participationVestingContract.address);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
