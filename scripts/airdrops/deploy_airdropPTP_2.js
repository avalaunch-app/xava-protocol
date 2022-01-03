const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require("../utils");


async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];

    const Airdrop = await hre.ethers.getContractFactory("Airdrop");
    const token = '0x22d4002028f537599be9f666d1c4fa138522f9c8';

    let airdropContract;

    for (let i = 0; i < 13; i++) {
        airdropContract = await Airdrop.deploy(token, contracts['Admin']);
        await airdropContract.deployed();
        console.log("Airdrop contract is deployed to: ", airdropContract.address);
        saveContractAddress(hre.network.name, `AirdropPTP-1m-${i+1}`, airdropContract.address);
    }

}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
