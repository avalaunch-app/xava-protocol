const hre = require("hardhat");
const { getSavedContractAddresses, saveContractAddress } = require('./utils');
const { ethers } = hre;
const { greenOut, boldOut } = require('./styling');

const getCurrentBlockTimestamp = async () => {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

const main = async () => {

    const contracts = getSavedContractAddresses()[hre.network.name];

    // instantiate salesFactory
    const salesFactory = await hre.ethers.getContractAt('SalesFactory', contracts['SalesFactory']);

    // deploy new sale and await the block after
    await(await salesFactory.deploySale()).wait();
    console.log(boldOut('Sale deployed successfully.'));

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
    const saleToken = await saleTokenFactory.deploy("Sale Token 5", "ST5", "1000000000000000000000000000", 18);
    await saleToken.deployed();
    console.log(` - Sale token deployed to: ${greenOut(saleToken.address)}`);

    // compute the states for a new sale
    // token amount & pricing
    const tokenPriceInAvax = ethers.utils.parseEther("0.00005").toString();
    const totalTokens = ethers.utils.parseEther("1000000").toString();
    // fundamental timestamps
    const registrationStart = await getCurrentBlockTimestamp() + 150;
    const registrationEnd = registrationStart + 300;
    const validatorRound = registrationEnd + 300;
    const stakingRound = validatorRound + 300;
    const saleEndTime = stakingRound + 300;
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
        tokensUnlockTime,
        portionVestingPrecision,
        stakingRoundId,
        registrationDepositAVAX
    )).wait();
    console.log(' - Sale params set successfully.');

    // set sale registration time
    await sale.setRegistrationTime(
        registrationStart,
        registrationEnd
    );
    console.log(' - Registration time set.');

    // set sale rounds
    await sale.setRounds(
        [validatorRound, stakingRound],
        [ethers.utils.parseEther('70000000'), ethers.utils.parseEther('70000000')]
    );
    console.log(' - Rounds set.');

    // set vesting parameters
    await sale.setVestingParams(unlockingTimes, percents, maxVestingTimeShift);
    console.log(' - Vesting parameters set successfully.');

    // deposit tokens to sale contract
    await(await saleToken.approve(sale.address, totalTokens)).wait();
    await sale.depositTokens();
    console.log(' - Tokens deposited.');

    // add dexalot portfolio support
    await sale.setAndSupportDexalotPortfolio(dexalotPortfolio, dexalotUnlockingTime);
    console.log(' - Dexalot Support Added.');

    console.log("Config:");
    console.log({
        saleAddress: lastDeployedSale,
        saleToken: saleToken.address,
        saleOwner,
        tokenPriceInAvax,
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

    console.log(boldOut('Done!'));
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
