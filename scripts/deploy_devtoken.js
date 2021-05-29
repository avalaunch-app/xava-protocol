const hre = require("hardhat");
const { saveContractAddress } = require('./utils')

async function main() {
    const tokenName = "DevToken";
    const symbol = "DT";
    const totalSupply = "10000000000000000000000";
    const decimals = 18;

    const DevToken = await hre.ethers.getContractFactory("DevToken");
    const token = await DevToken.deploy(tokenName, symbol, totalSupply, decimals);
    await token.deployed();
    console.log("DevToken deployed to: ", token.address);

    saveContractAddress(hre.network.name, "DevToken", token.address);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
