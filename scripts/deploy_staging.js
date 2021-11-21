const hre = require("hardhat");
const { saveContractAddress } = require('./utils')
const config = require('./config.json');

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

async function main() {

    const c = config[hre.network.name];
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    // Deploy Xava Token
    const XavaToken = await ethers.getContractFactory("XavaToken");
    const token = await XavaToken.deploy(c.token.tokenName, c.token.symbol, c.token.totalSupply, c.token.decimals);
    await token.deployed();
    console.log("Xava MOCK Token deployed to: ", token.address);
    saveContractAddress(hre.network.name, "MOCK-XAVA", token.address);

    // Deploy Admin contract
    const Admin = await ethers.getContractFactory("Admin");
    const admin = await Admin.deploy(c.admins);
    await admin.deployed();
    console.log("Admin contract deployed to: ", admin.address);
    saveContractAddress(hre.network.name, "Admin", admin.address);

    // Deploy Sales Factory contract
    const SalesFactory = await ethers.getContractFactory("SalesFactory");
    const salesFactory = await SalesFactory.deploy(admin.address, ZERO_ADDRESS);
    await salesFactory.deployed();
    saveContractAddress(hre.network.name, "SalesFactory", salesFactory.address);
    console.log('Sales factory deployed to: ',salesFactory.address);

    // Get current block timestamp
    const currentTimestamp = await getCurrentBlockTimestamp();

    // Deploy Allocation Staking contract with proxy
    const AllocationStaking = await ethers.getContractFactory("AllocationStaking");
    const allocationStaking = await upgrades.deployProxy(AllocationStaking, [
            token.address,
            ethers.utils.parseEther(c.allocationStakingRPS),
            currentTimestamp + c.delayBeforeStart,
            salesFactory.address,
            c.depositFeePercent,
            c.depositFeePrecision
        ]
    );
    await allocationStaking.deployed()
    console.log('AllocationStakingProxy deployed to:', allocationStaking.address);
    saveContractAddress(hre.network.name, 'AllocationStakingProxy', allocationStaking.address);

    // Get and store Proxy Admin contract
    let proxyAdminContract = await upgrades.admin.getInstance();
    saveContractAddress(hre.network.name, 'ProxyAdmin', proxyAdminContract.address);

    // Set allocation staking on sales factory
    await salesFactory.setAllocationStaking(allocationStaking.address);

    // Calculate total rewards, add lp token to pool and fund
    const totalRewards = ethers.utils.parseEther(c.initialRewardsAllocationStaking);
    await token.approve(allocationStaking.address, totalRewards);
    await allocationStaking.add(c.xavaPoolAllocPoints, token.address, true);
    await allocationStaking.fund(totalRewards);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
