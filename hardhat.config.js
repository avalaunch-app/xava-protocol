require('dotenv').config();
require('@nomiclabs/hardhat-waffle')
require('@nomiclabs/hardhat-ethers')
require("@nomiclabs/hardhat-web3")
require('@openzeppelin/hardhat-upgrades')
require('solidity-coverage');
require('hardhat-gas-reporter');
require('hardhat-contract-sizer');

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const testPK = "0x56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027";

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: 'avash',
  networks: {
    avash: {
      url: 'http://localhost:9650/ext/bc/C/rpc',
      gasPrice: 225000000000,
      chainId: 43112,
      accounts: [
        "0x56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027",
        "0x7b4198529994b0dc604278c99d153cfd069d594753d471171a1d102a10438e07",
        "0x15614556be13730e9e8d6eacc1603143e7b96987429df8726384c2ec4502ef6e",
        "0x31b571bf6894a248831ff937bb49f7754509fe93bbd2517c9c73c4144c0e97dc",
        "0x6934bef917e01692b789da754a0eae31a8536eb465e7bff752ea291dad88c675",
        "0xe700bdbdbc279b808b1ec45f8c2370e4616d3a02c336e68d85d4668e08f53cff",
        "0xbbc2865b76ba28016bc2255c7504d000e046ae01934b04c694592a6276988630",
        "0xcdbfd34f687ced8c6968854f8a99ae47712c4f4183b78dcc4a903d1bfe8cbf60",
        "0x86f78c5416151fe3546dece84fda4b4b1e36089f2dbc48496faf3a950f16157c",
        "0x750839e9dbbd2a0910efe40f50b2f3b2f2f59f5580bb4b83bd8c1201cf9a010a"
      ]
    },
    fuji: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      gasPrice: 225000000000,
      chainId: 43113,
      accounts: [process.env.PK || testPK]
    },
    staging: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      gasPrice: 225000000000,
      chainId: 43113,
      accounts: [process.env.PK || testPK]
    },
    mainnet: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      gasPrice: 80000000000,
      chainId: 43114,
      timeout: 900000000,
      accounts: [process.env.PK || testPK]
    },
    local: {
      url: 'http://localhost:8545',
    },
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 100,
    enabled: true
  },
  solidity: {
    compilers: [ {version: '0.6.12'} ],
    overrides: {
      "contracts/sales/AvalaunchSaleV2.sol": {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999
          },
        },
      },
      "contracts/sales/AvalaunchSale.sol": {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
        },
      },
      "contracts/sales/SalesFactory.sol": {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999
          },
        },
      },
      "contracts/AvalaunchMarketplace.sol": {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999
          },
        },
      },
      "contracts/AllocationStaking.sol": {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
        },
      },
      "contracts/AvalaunchCollateral.sol": {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999
          },
        },
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  }
};

