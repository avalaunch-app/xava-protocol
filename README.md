## Avalaunch protcool implementation


_The first protocol, exclusively for the Avalanche ecosystem, to offer promising and innovative projects a fast, secure, and efficient platform for decentralized fundraising._

### Token (Mainnet)
- **Deployed to Avalanche blockchain**
- **Token address:** `0xd1c3f94DE7e5B45fa4eDBBA472491a9f4B166FC4`
- **Total supply :** 100000000 XAVA
- **Deployer address:** `0xADeA14a2F5ffa5016f34141D00C249e691AE300E`
- **Verified source code:** https://cchain.explorer.avax.network/address/0xd1c3f94DE7e5B45fa4eDBBA472491a9f4B166FC4/contracts

---

### Avalaunch Farm contracts
- **Old FARM:** https://cchain.explorer.avax.network/address/0xE82AAE7fc62547BdFC36689D0A83dE36FF034A68/contracts
  - Supported single sided XAVA farming and LP farming
- **New FARM:** https://cchain.explorer.avax.network/address/0x6E125b68F0f1963b09add1b755049e66f53CC1EA/contracts
  - Supports only LP farming.
   
---

### Launchpad
**Admin**
- Address: 0x0cE58B15874cb9AA3E64C0aE95615C6112004A32
- Verified: https://cchain.explorer.avax.network/address/0x0cE58B15874cb9AA3E64C0aE95615C6112004A32/contracts

**Sales Factory**
- Address:0xb9dB9e6A5943E3a21CE87D61A1F5D0b59a2c3aF6
- Verified: https://cchain.explorer.avax.network/address/0xb9dB9e6A5943E3a21CE87D61A1F5D0b59a2c3aF6/contracts

**AllocationStaking Implementation**
- Address: 0x027D6EA70Bc4904c2BfC00b014571c6C4EDF0DD6
- Verified: https://cchain.explorer.avax.network/address/0x027D6EA70Bc4904c2BfC00b014571c6C4EDF0DD6/contracts

**AllocationStakingProxy**
- Address: 0xA6A01f4b494243d84cf8030d982D7EeB2AeCd329
- Verified: TBD.

---

### Developement instructions
- `$ yarn install` - _Install all dependencies_
- `$ echo PK="PRIVATE_KEY" > .env` - _Add testing private key_
- `$ npx hardhat compile` - _Compile all contracts_
- `$ npx hardhat test` - _Run all tests_

---

- Migrations are inside `scripts/` folder.
- Tests are inside `test/` folder.
