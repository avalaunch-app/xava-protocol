const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require('./utils')
const { ethers, web3 } = hre

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

async function main() {

    const contracts = getSavedContractAddresses()[hre.network.name];

    const salesFactory = await hre.ethers.getContractAt('SalesFactory', contracts['SalesFactory']);

    const tx = await salesFactory.deploySale();
    console.log('Sale deployed.');

    const lastDeployedSale = await salesFactory.getLastDeployedSale();
    console.log('Deployed Sale is: ', lastDeployedSale);

    const numberOfSales = await salesFactory.getNumberOfSalesDeployed();

    const Token = await hre.ethers.getContractFactory("XavaToken");
    const token = await Token.deploy(`MOCK-SALE-${numberOfSales.toString()}`, `MOCK-SALE-${numberOfSales.toString()}`, ethers.utils.parseEther('200000'), 18);
    await token.deployed();
    console.log("Sale Token deployed to: ", token.address);

    const sale = await hre.ethers.getContractAt('AvalaunchSale', lastDeployedSale);

    const totalTokens = ethers.utils.parseEther('2000');
    const tokenPriceInAvax = ethers.utils.parseEther("0.005");

    const saleOwner = '0x094028E04c1FADf12F5a4Fe6C1b9D2062a252a17';

    const registrationStart = 1627936200;
    const registrationEnd = registrationStart + 86400; // Registration 24 hours
    const validatorRound = registrationEnd + 43200; // 12 hours delay
    const stakingRound = validatorRound + 28800; // validator round 30 mins
    const publicRound = stakingRound + 28800; // Staking round 2 hours
    const saleEndTime = publicRound + 28800;
    const tokensUnlockTime = saleEndTime + 600;

    await sale.setSaleParams(
        token.address,
        saleOwner,
        tokenPriceInAvax,
        totalTokens,
        saleEndTime,
        tokensUnlockTime
    );

    console.log('Params set.');

    await sale.setRegistrationTime(
        registrationStart,
        registrationEnd
    );

    console.log('Registration time set.');

    await sale.setRounds(
        [validatorRound, stakingRound, publicRound],
        [ethers.utils.parseEther('2000'),ethers.utils.parseEther('2000'),ethers.utils.parseEther('2000')]
    );

    console.log('Rounds set.');

    console.log({
        saleAddress: lastDeployedSale,
        saleToken: token.address,
        saleOwner,
        tokenPriceInAvax: tokenPriceInAvax.toString(),
        totalTokens: totalTokens.toString(),
        saleEndTime,
        tokensUnlockTime,
        registrationStart,
        registrationEnd,
        validatorRound,
        stakingRound,
        publicRound
    });


    await token.approve(sale.address, totalTokens);
    await sale.depositTokens();
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
