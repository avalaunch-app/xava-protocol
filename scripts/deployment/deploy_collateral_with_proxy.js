const hre = require("hardhat");
const { getSavedContractAddresses, saveContractAddress} = require('../utils');
const ethers = require("ethers");
const c = require('../configs/config.json');
const config = c[hre.network.name];

async function main() {
    await hre.run('compile');
    const contracts = getSavedContractAddresses()[hre.network.name];
    const proxyAdmin = contracts["ProxyAdmin"];

    console.log(`ProxyAdmin address: ${proxyAdmin}`);

    const collateralFactory = await hre.ethers.getContractFactory("AvalaunchCollateral");
    const collateral = await collateralFactory.deploy();
    await collateral.deployed();

    console.log(`Collateral implementation address: ${collateral.address}`);
    saveContractAddress(hre.network.name, "AvalaunchCollateral", collateral.address);

    const methodId = (ethers.utils.keccak256(ethers.utils.toUtf8Bytes("initialize(address,address,uint256)"))).substring(0,10); // '0x' + 4 bytes
    const types = ['address','address','uint256']; // Types to encode
    const values = [config['moderator'], contracts['Admin'], hre.network.name === 'mainnet' ? 43114 : 43113]; // Values to encode

    const abi = new ethers.utils.AbiCoder(); // Get abi coder instance
    let data = methodId + abi.encode(types, values).substring(2); // Generate calldata
    console.log(`Calldata: ${data}`);

    const proxyFactory = await hre.ethers.getContractFactory("contracts/openzeppelin/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy");
    const proxy = await proxyFactory.deploy(collateral.address, proxyAdmin, data);
    await proxy.deployed();

    console.log(`Collateral proxy address: ${proxy.address}`);
    saveContractAddress(hre.network.name, "AvalaunchCollateralProxy", proxy.address);

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
