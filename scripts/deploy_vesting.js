const hre = require("hardhat");
const { getSavedContractAddresses, saveContractAddress } = require('./utils')
const config = require('config.json');

async function main() {

    await hre.run('compile')

    const ParticipationVesting = await hre.ethers.getContractFactory('ParticipationVesting');

    const participationVestingContract = await ParticipationVesting.deploy(
        config[hre.network.name].numberOfPortions,
        config[hre.network.name].timeBetweenPortions,
        config[hre.network.name].distributionStartDate,
        config[hre.network.name].adminWallet,
        getSavedContractAddresses()[hre.network.name]["XavaToken"]
    );

    await participationVestingContract.deployed();
    console.log("Participation Vesting contract deployed to: ", participationVestingContract.address);
    saveContractAddress(hre.network.name, 'ParticipationVesting', participationVestingContract.address);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
