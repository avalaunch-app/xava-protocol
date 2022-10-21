const hre = require("hardhat");
const { getSavedContractAddresses, saveContractAddress } = require('../utils');
const { ethers } = hre;
const { greenOut, boldOut } = require('../styling');

const getCurrentBlockTimestamp = async () => {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

const delay = ms => new Promise(res => setTimeout(res, ms));
const delayLength = 3000;

const main = async () => {

    const contracts = getSavedContractAddresses()[hre.network.name];

    // instantiate salesFactory
    const salesFactory = await hre.ethers.getContractAt('SalesFactory', contracts['SalesFactory']);

    // deploy new sale and await the block after
    await(await salesFactory.deploySale()).wait();
    console.log(boldOut('Sale deployed successfully.'));
    await delay(delayLength);

    // retrieve the sale deployed and save the address
    const lastDeployedSale = await salesFactory.getLastDeployedSale();
    saveContractAddress(hre.network.name,'LatestSale', lastDeployedSale);
    console.log(`Deployed sale address: ${greenOut(lastDeployedSale)}`);
    console.log('Sub-operations:');
    // instantiate deployed sale contract
    const sale = await hre.ethers.getContractAt('AvalaunchSaleV2', lastDeployedSale);
    console.log(' - Successfully instantiated sale contract.');

    // deploy sale token
    const saleTokenFactory = await hre.ethers.getContractFactory("XavaToken");
    const saleToken = await saleTokenFactory.deploy("Test Token", "TT", "1000000000000000000000000000", 18);
    await saleToken.deployed();
    console.log(` - Sale token deployed to: ${greenOut(saleToken.address)}`);

    // compute the states for a new sale
    const saleEndTime = await getCurrentBlockTimestamp() + 3600 * 12;
    // token amount & pricing
    const tokenPriceInAvax = ethers.utils.parseEther("0.00005").toString();
    const totalTokens = ethers.utils.parseEther("1000000").toString();
    // vesting
    const tokensUnlockTime = saleEndTime + 600;
    const unlockingTimes = [tokensUnlockTime, tokensUnlockTime + 3600, tokensUnlockTime + 3600 * 2, tokensUnlockTime + 3600 * 3, tokensUnlockTime + 3600 * 4];
    const percents = [2000, 2000, 2000, 2000, 2000];
    // dexalot
    const dexalotPortfolio = "0x780380eB4787775b07dfa60fB11C2CdAD6A44f7C";
    const dexalotUnlockingTime = saleEndTime + 300;
    // misc
    const portionVestingPrecision = 10000;
    const registrationDepositAVAX = ethers.utils.parseEther('1').toString();

    // set proper sale parameters
    await(await sale.setSaleParams(
        saleToken.address,
        tokenPriceInAvax,
        totalTokens,
        saleEndTime,
        portionVestingPrecision,
        registrationDepositAVAX
    )).wait();
    console.log(' - Sale params set successfully.');
    await delay(delayLength);

    // set vesting parameters
    await sale.setVestingParams(unlockingTimes, percents);
    console.log(' - Vesting parameters set successfully.');
    await delay(delayLength);

    // deposit tokens to sale contract
    await saleToken.approve(sale.address, totalTokens);
    await delay(delayLength);
    await sale.depositTokens();
    console.log(' - Tokens deposited.');
    await delay(delayLength);

    // add dexalot portfolio support
    await sale.setDexalotParameters(dexalotPortfolio, dexalotUnlockingTime);
    console.log(' - Dexalot Support Added.');
    await delay(delayLength);

    console.log("Config:");
    console.log({
        saleAddress: lastDeployedSale,
        saleToken: saleToken.address,
        tokenPriceInAvax,
        totalTokens,
        saleEndTime,
        tokensUnlockTime,
        registrationDepositAVAX,
        unlockingTimes,
        percents,
        dexalotUnlockingTime
    });

    const marketplace = await hre.ethers.getContractAt("AvalaunchMarketplace", contracts['AvalaunchMarketplaceProxy']);
    await marketplace.approveSale(sale.address);
    console.log(' - Sale approved on marketplace');

    const collateral = await hre.ethers.getContractAt("AvalaunchCollateral", contracts['AvalaunchCollateralProxy']);
    await collateral.approveSale(sale.address);
    console.log(' - Sale approved on collateral');

    console.log(boldOut('Done!'));
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
