const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require("../utils");


async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];

    const AirdropAVAX = await hre.ethers.getContractFactory("AirdropAVAX");
    const airdropContract = await AirdropAVAX.deploy(contracts['Admin']);
    await airdropContract.deployed();

    console.log("AirdropAVAX contract is deployed to: ", airdropContract.address);
    saveContractAddress(hre.network.name, "AirdropAVAXCrabada", airdropContract.address);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
