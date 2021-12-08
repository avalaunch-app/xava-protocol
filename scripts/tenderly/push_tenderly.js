const hre = require('hardhat');
const fetch = require('axios');
const { getSavedContractAddresses } = require('../utils');
require('dotenv').config();

const tenderlyPush = async (contracts) => {
    const axios = require('axios')
    await axios.post(`https://api.tenderly.co/api/v1/account/${process.env.TENDERLY_USERNAME}/project/${process.env.PROJECT_NAME}/addresses`, {
        "contracts" : contracts
    }, {
        headers: {
            'Content-Type': 'application/json',
            'x-access-key' : process.env.ACCESS_KEY
        }
    })
        .then(res => {
            console.log(`statusCode: ${res.status} ✅`);
        })
        .catch(error => {
            console.error(error)
        });
}


async function main() {

    const contracts = getSavedContractAddresses()[hre.network.name];
    let payload = [];

    Object.keys(contracts).forEach(name => {
        payload.push({
            "network_id": hre.network.config.chainId.toString(),
            "address": contracts[name],
            "display_name": name
        });
    });

    await tenderlyPush(payload);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1)
    });
