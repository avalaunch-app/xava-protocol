## Avalaunch protcool implementation


_The first protocol, exclusively for the Avalanche ecosystem, to offer promising and innovative projects a fast, secure, and efficient platform for decentralized fundraising._

### Token (Mainnet)
- **Deployed to Avalanche blockchain**
- **Token address:** `0xd1c3f94DE7e5B45fa4eDBBA472491a9f4B166FC4`
- **Total supply :** 100000000 XAVA
- **Deployer address:** `0xADeA14a2F5ffa5016f34141D00C249e691AE300E`
- **Verified source code:** https://cchain.explorer.avax.network/address/0xd1c3f94DE7e5B45fa4eDBBA472491a9f4B166FC4/contracts

### Avalaunch Farm contracts
- **Old FARM:** https://cchain.explorer.avax.network/address/0xE82AAE7fc62547BdFC36689D0A83dE36FF034A68/contracts
  - Supported single sided XAVA farming and LP farming
- **New FARM:** https://cchain.explorer.avax.network/address/0x6E125b68F0f1963b09add1b755049e66f53CC1EA/contracts
  - Supports only LP farming.
   

### Developement instructions
- `$ yarn install` - _Install all dependencies_
- `$ echo PK="PRIVATE_KEY" > .env` - _Add testing private key_
- `$ npx hardhat compile` - _Compile all contracts_
- `$ npx hardhat test` - _Run all tests_

---

- Migrations are inside `scripts/` folder.
- Tests are inside `test/` folder.
