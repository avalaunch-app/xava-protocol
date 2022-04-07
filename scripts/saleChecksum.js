const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require('./utils')
const config = require("./configs/saleConfig.json");
const {BigNumber} = require("ethers");

// Style
const bS = "\x1b[1m"; // Brightness start
const e = "\x1b[0m";  // End style
const VALID = bS + "\x1b[32mVALID ✅" + e;
const NOT_VALID = bS + "\x1b[31mNOT VALID ❌" + e;

const NUMBER_1E18 = "1000000000000000000";

async function main() {
    const c = config[hre.network.name];

    const saleAddress = '0x0450CFD41a9bbA5349f50a75043d69e8D96f2f9e';

    const saleContract = await hre.ethers.getContractAt('AvalaunchSale', saleAddress);

    const sale = await saleContract.sale();
    const registration = await saleContract.registration();

    console.log('Token');
    console.log(sale[0], c["tokenAddress"], sale[0] === c["tokenAddress"] ? VALID : NOT_VALID, "\n");

    console.log("SaleOwner");
    console.log(sale[5], c["saleOwner"], sale[5] === c["saleOwner"] ? VALID : NOT_VALID, "\n");

    console.log("RegistrationDepositAvax");
    const regDep = await saleContract.registrationDepositAVAX();
    console.log(
        parseInt(regDep.div(NUMBER_1E18)).toString(), c["registrationDepositAVAX"],
        parseInt(regDep.div(NUMBER_1E18)).toString() === c["registrationDepositAVAX"] ? VALID : NOT_VALID, "\n"
    );

    console.log("TotalTokenAmount")
    const totalTokens = sale[7];
    const a = c["totalTokens"];
    console.log(
        parseInt(totalTokens), parseInt(BigNumber.from(a).mul(NUMBER_1E18)),
        parseInt(totalTokens) === parseInt(BigNumber.from(a).mul(NUMBER_1E18)) ? VALID : NOT_VALID, "\n"
    );

    console.log("TokenPriceInAvax")
    const o = sale[6];
    const p = parseFloat(c["tokenPriceInAvax"]) * NUMBER_1E18;
    console.log(
        parseInt(o), parseInt(p),
        parseInt(o) === parseInt(p) ? VALID : NOT_VALID, "\n"
    );

    console.log("Sale end");
    let val1 = parseInt(sale[10]);
    let val2 = parseInt(c["registrationStartAt"]) + parseInt(c["registrationLength"]) +
        parseInt(c["delayBetweenRegistrationAndSale"]) + parseInt(c["validatorRoundLength"]) +
        parseInt(c["stakingRoundLength"]) + parseInt(c["boosterRoundLength"]);

    console.log(val1, val2, val1 === val2 ? VALID : NOT_VALID, "\n");

    // console.log("TokensUnlockTime")
    // val1 = parseInt(sale[10]);
    // val2 = parseInt(c["unlockingTimes"][0]);
    // console.log(val1, val2, val1 === val2 ? VALID : NOT_VALID, "\n");

    console.log("Registration Start");
    val1 = parseInt(registration[0]);
    val2 = parseInt(c["registrationStartAt"]);
    console.log(val1, val2, val1 === val2 ? VALID : NOT_VALID, "\n");

    console.log("Registration End");
    val1 = parseInt(registration[1]);
    val2 = parseInt(c["registrationStartAt"]) + parseInt(c["registrationLength"]);
    console.log(val1, val2, val1 === val2 ? VALID : NOT_VALID, "\n");

    console.log("Validator Round Start");
    const round1 = await saleContract.roundIdToRound(1);
    val1 = parseInt(round1[0]);
    val2 = parseInt(c["registrationStartAt"]) + parseInt(c["registrationLength"]) +
        parseInt(c["delayBetweenRegistrationAndSale"]);
    console.log(val1, val2, val1 === val2 ? VALID : NOT_VALID, "\n");

    console.log("Staking Round Start");
    const round2 = await saleContract.roundIdToRound(2);
    val1 = parseInt(round2[0]);
    val2 = parseInt(c["registrationStartAt"]) + parseInt(c["registrationLength"]) +
        parseInt(c["delayBetweenRegistrationAndSale"]) + parseInt(c["validatorRoundLength"]);
    console.log(val1, val2, val1 === val2 ? VALID : NOT_VALID, "\n");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
