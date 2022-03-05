const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require("../utils");


async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];

    const Airdrop = await hre.ethers.getContractFactory("Airdrop");
    const token = '0x3eefb18003d033661f84e48360ebecd181a84709';

    let airdropContract;

    for (let i = 0; i < 5; i++) {
        airdropContract = await Airdrop.deploy(token, contracts['Admin']);
        await airdropContract.deployed();
        console.log("Airdrop contract is deployed to: ", airdropContract.address);
        saveContractAddress(hre.network.name, `AirdropISA-Portion-${i+1}`, airdropContract.address);
    }

}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
