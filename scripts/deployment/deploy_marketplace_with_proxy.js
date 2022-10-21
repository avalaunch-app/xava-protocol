const hre = require("hardhat");
const { getSavedContractAddresses, saveContractAddress} = require('../utils');
const ethers = require("ethers");
const c = require('../configs/config.json');
const config = c[hre.network.name];

async function main() {
    await hre.run('compile');
    const contracts = getSavedContractAddresses()[hre.network.name];
    const proxyAdmin = contracts["ProxyAdmin"];

    const feePercentage = 200;
    const feePrecision = 10000;

    console.log(`ProxyAdmin address: ${proxyAdmin}`);

    const marketplaceFactory = await hre.ethers.getContractFactory("AvalaunchMarketplace");
    const marketplace = await marketplaceFactory.deploy();
    await marketplace.deployed();

    console.log(`Marketplace implementation address: ${marketplace.address}`);
    saveContractAddress(hre.network.name, "AvalaunchMarketplace", marketplace.address);

    const methodId = (ethers.utils.keccak256(ethers.utils.toUtf8Bytes("initialize(address,address,uint256,uint256)"))).substring(0,10); // '0x' + 4 bytes
    const types = ['address','address','uint256','uint256']; // Types to encode
    const values = [contracts['Admin'], contracts['SalesFactory'], feePercentage, feePrecision]; // Values to encode

    const abi = new ethers.utils.AbiCoder(); // Get abi coder instance
    let data = methodId + abi.encode(types, values).substring(2); // Generate calldata
    console.log(`Calldata: ${data}`);

    const proxyFactory = await hre.ethers.getContractFactory("contracts/openzeppelin/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy");
    const proxy = await proxyFactory.deploy(marketplace.address, proxyAdmin, data);
    await proxy.deployed();

    console.log(`Marketplace proxy address: ${proxy.address}`);
    saveContractAddress(hre.network.name, "AvalaunchMarketplaceProxy", proxy.address);

    console.log("Done!");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
