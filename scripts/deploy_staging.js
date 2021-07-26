const hre = require("hardhat");
const { saveContractAddress } = require('./utils')
const { ethers, web3 } = hre

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

async function main() {

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const tokenName = "Avalaunch Mock Token";
    const symbol = "MOCK-XAVA";
    const totalSupply = "100000000000000000000000000";
    const decimals = 18;

    const XavaToken = await hre.ethers.getContractFactory("XavaToken");
    const token = await XavaToken.deploy(tokenName, symbol, totalSupply, decimals);
    await token.deployed();
    console.log("Xava Token deployed to: ", token.address);
    saveContractAddress(hre.network.name, "MOCK-XAVA", token.address);

    const Admin = await hre.ethers.getContractFactory("Admin");
    const admin = await Admin.deploy(['0x0c3e4509ee2EdD1BE61230BdE49b2FfC7a8ca88b', '0x85E3e0224a199f9e908AB4E3525Dd5504569EE5a']);
    await admin.deployed();

    console.log("Admin Token deployed to: ", token.address);
    saveContractAddress(hre.network.name, "Admin", admin.address);

    const SalesFactory = await hre.ethers.getContractFactory("SalesFactory");
    const salesFactory = await SalesFactory.deploy(admin.address, ZERO_ADDRESS);
    await salesFactory.deployed();

    saveContractAddress(hre.network.name, "SalesFactory", salesFactory.address);
    console.log('Sales factory deployed to: ',salesFactory.address);

    const currentTimestamp = await getCurrentBlockTimestamp();

    const AllocationStaking = await hre.ethers.getContractFactory("AllocationStaking");
    const allocationStaking = await AllocationStaking.deploy(
        token.address,
        ethers.utils.parseEther("0.01"),
        currentTimestamp + 1000,
        salesFactory.address,
        "100"
    );
    await allocationStaking.deployed();
    saveContractAddress(hre.network.name, "AllocationStaking", allocationStaking.address);


    const totalRewards = ethers.utils.parseEther("500000");
    await token.approve(allocationStaking.address, totalRewards);
    console.log('Approval for allocation staking contract done properly.');

    await allocationStaking.setDepositFee(200000, 10000000);
    await allocationStaking.add(100, token.address, true);
    console.log('Create farming / staking pool.');

    await allocationStaking.fund(totalRewards);
    console.log('Funded Allocation Staking contract.');


}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
