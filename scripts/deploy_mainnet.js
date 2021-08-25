const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require('./utils')
const config = require('./config.json');

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

async function main() {

    const c = config[hre.network.name];
    const contracts = getSavedContractAddresses()[hre.network.name];

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";


    const Admin = await ethers.getContractFactory("Admin");
    const admin = await Admin.deploy(c.admins);
    await admin.deployed();
    console.log("Admin contract deployed to: ", admin.address);
    saveContractAddress(hre.network.name, "Admin", admin.address);


    const SalesFactory = await ethers.getContractFactory("SalesFactory");
    const salesFactory = await SalesFactory.deploy(admin.address, ZERO_ADDRESS);
    await salesFactory.deployed();
    saveContractAddress(hre.network.name, "SalesFactory", salesFactory.address);
    console.log('Sales factory deployed to: ',salesFactory.address);


    const currentTimestamp = await getCurrentBlockTimestamp();

    const AllocationStaking = await ethers.getContractFactory("AllocationStaking");

    const allocationStaking = await upgrades.deployProxy(AllocationStaking, [
            contracts["XavaToken"],
            ethers.utils.parseEther(c.allocationStakingRPS),
            currentTimestamp + c.delayBeforeStart,
            salesFactory.address,
            c.depositFeePercent,
            c.depositFeePrecision
        ]
    );
    await allocationStaking.deployed()
    console.log('AllocationStaking Proxy deployed to:', allocationStaking.address);
    saveContractAddress(hre.network.name, 'AllocationStaking', allocationStaking.address);

    await salesFactory.setAllocationStaking(allocationStaking.address);
    console.log(`salesFactory.setAllocationStaking ${allocationStaking.address} done.;`);

    const totalRewards = ethers.utils.parseEther(c.initialRewardsAllocationStaking);

    const token = await hre.ethers.getContractAt('XavaToken', contracts['XavaToken']);
    const devToken = await hre.ethers.getContractAt('DevToken', contracts['DevTokenAlloStaking']);

    await token.approve(allocationStaking.address, totalRewards);
    console.log(`token.approve(${allocationStaking.address}, ${totalRewards.toString()});`)

    await allocationStaking.add(c.xavaPoolAllocPoints, token.address, true);
    console.log(`allocationStaking.add(${c.xavaPoolAllocPoints}, ${token.address}, true);`)

    await allocationStaking.add(c.placeholderPoolAllocPoints, contracts["DevTokenAlloStaking"], true);
    console.log(`allocationStaking.add(${c.placeholderPoolAllocPoints}, ${contracts["DevTokenAlloStaking"]}, true)`)

    const totalSupplyDevToken = ethers.utils.parseEther('10000');
    await devToken.approve(allocationStaking.address, totalSupplyDevToken);
    console.log('Dev token successfully approved.');

    await allocationStaking.deposit(1, totalSupplyDevToken);
    console.log('Successfully deposited total supply for dev token to the farm.');

    // Fund only 5000 tokens, for testing
    await allocationStaking.fund(ethers.utils.parseEther('500'));
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
