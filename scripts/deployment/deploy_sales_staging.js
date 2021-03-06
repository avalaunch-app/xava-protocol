const hre = require("hardhat");
const { getSavedContractAddresses, saveContractAddress } = require('../utils');
const { ethers } = hre;
const { greenOut, boldOut } = require('../styling');
const config = require("../configs/saleConfig.json");

const getCurrentBlockTimestamp = async () => {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

const delay = ms => new Promise(res => setTimeout(res, ms));
const delayLength = 3000;

const main = async () => {

    const contracts = getSavedContractAddresses()[hre.network.name];
    const c = config[hre.network.name];

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
    const sale = await hre.ethers.getContractAt('AvalaunchSale', lastDeployedSale);
    console.log(' - Successfully instantiated sale contract.');

    // retrieve sale deployer address
    const wallet = new hre.ethers.Wallet(process.env.PK);
    const saleOwner = wallet.address;
    console.log(` - saleOwner address: ${greenOut(saleOwner)}`);

    // deploy sale token
    const saleTokenFactory = await hre.ethers.getContractFactory("XavaToken");
    const saleToken = await saleTokenFactory.deploy("Test Token 7", "TT7", "1000000000000000000000000000", 18);
    await saleToken.deployed();
    console.log(` - Sale token deployed to: ${greenOut(saleToken.address)}`);

    // compute the states for a new sale
    // token amount & pricing
    const tokenPriceInAvax = ethers.utils.parseEther("0.00005").toString();
    const totalTokens = ethers.utils.parseEther("1000000").toString();
    const tokenPriceInUSD = 100000; // Six decimals USD value (100000 => 0.1$)
    // fundamental timestamps
    const registrationStart = await getCurrentBlockTimestamp() + 60;
    const registrationEnd = registrationStart + 3600;
    const validatorRound = registrationEnd + 60;
    const stakingRound = validatorRound + 180;
    const boosterRound = stakingRound + 600;
    const saleEndTime = boosterRound + 600;
    const tokensUnlockTime = saleEndTime + 600;
    // vesting
    const unlockingTimes = [tokensUnlockTime, tokensUnlockTime + 200, tokensUnlockTime + 400];
    const percents = [3333, 3333, 3334];
    const maxVestingTimeShift = 2592000;
    // dexalot
    const dexalotPortfolio = "0x780380eB4787775b07dfa60fB11C2CdAD6A44f7C";
    const dexalotUnlockingTime = tokensUnlockTime - 300;
    // misc
    const portionVestingPrecision = 10000;
    const stakingRoundId = 2;
    const registrationDepositAVAX = ethers.utils.parseEther('1').toString();

    // set proper sale parameters
    await(await sale.setSaleParams(
        saleToken.address,
        saleOwner,
        tokenPriceInAvax,
        totalTokens,
        saleEndTime,
        portionVestingPrecision,
        stakingRoundId,
        registrationDepositAVAX,
        tokenPriceInUSD
    )).wait();
    console.log(' - Sale params set successfully.');
    await delay(delayLength);

    // set sale registration time
    await sale.setRegistrationTime(
        registrationStart,
        registrationEnd
    );
    console.log(' - Registration time set.');
    await delay(delayLength);

    // set sale rounds
    await sale.setRounds(
        [validatorRound, stakingRound, boosterRound],
        [ethers.utils.parseEther('70000000'),
         ethers.utils.parseEther('70000000'),
         ethers.utils.parseEther('70000000')]
    );
    console.log(' - Rounds set.');
    await delay(delayLength);

    // set vesting parameters
    await sale.setVestingParams(unlockingTimes, percents, maxVestingTimeShift);
    console.log(' - Vesting parameters set successfully.');
    await delay(delayLength);

    // deposit tokens to sale contract
    await saleToken.approve(sale.address, totalTokens);
    await delay(delayLength);
    await sale.depositTokens();
    console.log(' - Tokens deposited.');
    await delay(delayLength);

    // add dexalot portfolio support
    await sale.setAndSupportDexalotPortfolio(dexalotPortfolio, dexalotUnlockingTime);
    console.log(' - Dexalot Support Added.');
    await delay(delayLength);

    await sale.setUpdateTokenPriceInAVAXParams(c['updateTokenPriceInAVAXPercentageThreshold'], c['updateTokenPriceInAVAXTimeLimit']);
    console.log(' - Token price updating parameters set.');
    await delay(delayLength);

    console.log("Config:");
    console.log({
        saleAddress: lastDeployedSale,
        saleToken: saleToken.address,
        saleOwner,
        tokenPriceInAvax,
        tokenPriceInUSD,
        totalTokens,
        saleEndTime,
        tokensUnlockTime,
        registrationStart,
        registrationEnd,
        validatorRound,
        stakingRound,
        registrationDepositAVAX,
        unlockingTimes,
        percents,
        dexalotUnlockingTime
    });

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
