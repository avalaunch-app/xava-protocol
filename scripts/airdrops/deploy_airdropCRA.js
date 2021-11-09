const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require("../utils");


async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];

    const AirdropCRA = await hre.ethers.getContractFactory("Airdrop");
    const CRAToken = '0xA32608e873F9DdEF944B24798db69d80Bbb4d1ed';
    const airdropContract = await AirdropCRA.deploy(CRAToken, contracts['Admin']);
    await airdropContract.deployed();


    console.log("AirdropCRA contract is deployed to: ", airdropContract.address);
    saveContractAddress(hre.network.name, "AirdropCRA", airdropContract.address);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
