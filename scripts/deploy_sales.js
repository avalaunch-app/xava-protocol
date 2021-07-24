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
    const token = await Token.deploy(`MOCK-SALE-${numberOfSales.toString()}`, `MOCK-SALE-${numberOfSales.toString()}`, ethers.utils.parseEther('5000000'), 18);
    await token.deployed();
    console.log("Sale Token deployed to: ", token.address);

    const sale = await hre.ethers.getContractAt('AvalaunchSale', lastDeployedSale);
    const currentTimestamp = await getCurrentBlockTimestamp();


    const totalTokens = ethers.utils.parseEther('40000');
    const tokenPriceInAvax = ethers.utils.parseEther("0.000015");
    const saleOwner = '0x0c3e4509ee2EdD1BE61230BdE49b2FfC7a8ca88b';
    const saleEndTime = currentTimestamp + 3300;
    const tokensUnlockTime = currentTimestamp + 3700;
    const registrationStart = currentTimestamp + 300;
    const registrationEnd = registrationStart + 1200;
    const validatorRound = registrationEnd + 600; //
    const stakingRound = validatorRound + 300; // validator round 30 mins
    const publicRound = stakingRound + 600; // Staking round 2 hours

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
        [ethers.utils.parseEther('10000'),ethers.utils.parseEther('10000'),ethers.utils.parseEther('10000')]
    );

    console.log('Rounds set.');

    console.log({
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
