const { ethers, network } = require("hardhat");
const { getSavedContractAddresses, saveContractAddress } = require('../utils');
const { greenOut, boldOut } = require('../styling');
const config = require("../configs/saleConfig.json");

const delay = ms => new Promise(res => setTimeout(res, ms));
const delayLength = 3000;

const main = async () => {

    const contracts = getSavedContractAddresses()[network.name];
    const c = config[network.name];

    // instantiate salesFactory
    const salesFactory = await ethers.getContractAt('SalesFactory', contracts['SalesFactory']);

    // deploy new sale and await the block after
    await (await salesFactory.deploySale()).wait();
    console.log(boldOut('Sale deployed successfully.'));

    await delay(delayLength);

    // retrieve the sale deployed and save the address
    const lastDeployedSale = await salesFactory.getLastDeployedSale();
    saveContractAddress(network.name, c['saleName'], lastDeployedSale);
    console.log(`Deployed sale address: ${greenOut(lastDeployedSale)}`);

    console.log('Sale setup:');
    // instantiate deployed sale contract
    const sale = await ethers.getContractAt('AvalaunchSaleV2', lastDeployedSale);
    console.log(' - Successfully instantiated sale contract.');

    // compute the states for a new sale
    const saleEndTime = c['saleEndTime'];
    const token = c['tokenAddress'];
    const registrationDepositAVAX = ethers.utils.parseEther(c['registrationDepositAVAX']);
    // token amount & pricing
    const tokenPriceInAvax = ethers.utils.parseEther(c['tokenPriceInAvax']);
    const totalTokens = ethers.utils.parseEther(c['totalTokens']);
    // vesting
    const portionVestingPrecision = c['portionVestingPrecision'];
    const unlockingTimes = c['unlockingTimes'];
    const percents = c['portionPercents'];

    // set proper sale parameters
    await(await sale.setSaleParams(
        token,
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

    // // add dexalot portfolio support
    // await sale.setAndSupportDexalotPortfolio(c['dexalotPortfolio'], c['dexalotUnlockingTime'])
    //     .then(() => console.log(greenOut('Dexalot supported.')))
    //     .catch((err) => console.log(redOut('Dexalot not supported.')));

    console.log("Config:");
    console.log({
        sale: lastDeployedSale,
        token,
        tokenPriceInAvax,
        totalTokens,
        saleEndTime,
        registrationDepositAVAX,
        unlockingTimes,
        percents
    });

    const marketplace = await ethers.getContractAt("AvalaunchMarketplace", contracts['AvalaunchMarketplaceProxy']);
    await marketplace.approveSale(sale.address)
        .then(() => console.log(' - Sale approved on marketplace'))
        .catch((err) => console.log(' - Marketplace whitelist failed.'));


    const collateral = await ethers.getContractAt("AvalaunchCollateral", contracts['AvalaunchCollateralProxy']);
    await collateral.approveSale(sale.address)
        .then(() => console.log(' - Sale approved on collateral'))
        .catch((err) => console.log(' - Collateral whitelist failed.'));

    console.log(boldOut('Done!'));
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
