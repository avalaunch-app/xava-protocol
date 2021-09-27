## Avalaunch protcool implementation


_The first protocol, exclusively for the Avalanche ecosystem, to offer promising and innovative projects a fast, secure, and efficient platform for decentralized fundraising._

### Developement instructions
- `$ yarn install` - _Install all dependencies_
- `$ echo PK="PRIVATE_KEY" > .env` - _Add testing private key_
- `$ npx hardhat compile` - _Compile all contracts_
- `$ npx hardhat test` - _Run all tests_


- Migrations are inside `scripts/` folder.
- Tests are inside `test/` folder.

--- 
### XavaToken 
- **Deployed to C-Chain***
- **Token address:** `0xd1c3f94DE7e5B45fa4eDBBA472491a9f4B166FC4`
- **Total supply :** 100000000 XAVA
- **Verified source code:** https://cchain.explorer.avax.network/address/0xd1c3f94DE7e5B45fa4eDBBA472491a9f4B166FC4/contracts

---

### Avalaunch Farm contracts
- **Old FARM:** https://cchain.explorer.avax.network/address/0xE82AAE7fc62547BdFC36689D0A83dE36FF034A68/contracts
  - *Supported single sided XAVA farming and LP farming*
- **New FARM:** https://cchain.explorer.avax.network/address/0x6E125b68F0f1963b09add1b755049e66f53CC1EA/contracts
  - *Supports only LP farming.*
   
---

### Launchpad
**Admin**
- Address: 0x68c58e1107bcE9be240aF941151d42101086AF56
- Verified: https://cchain.explorer.avax.network/address/0x68c58e1107bcE9be240aF941151d42101086AF56/contracts

**Sales Factory**
- Address:0x0e5505404c0bfC6FC9F70bb1E7D015B7daAC2FC6
- Verified: https://cchain.explorer.avax.network/address/0x0e5505404c0bfC6FC9F70bb1E7D015B7daAC2FC6/contracts
- V2: https://cchain.explorer.avax.network/address/0x635DB067Bbd00edE40F47614E65Bdb65bb8715a3/contracts

**AllocationStaking Implementation v0**
- Address: 0x027D6EA70Bc4904c2BfC00b014571c6C4EDF0DD6
- Verified: https://cchain.explorer.avax.network/address/0x027D6EA70Bc4904c2BfC00b014571c6C4EDF0DD6/contracts

**AllocationStaking Implementation v1**
- Address: 0xfbCEA5AF909e798CffC7653968ddF01b9Cb1A6EA
- Verified: https://cchain.explorer.avax.network/address/0xfbCEA5AF909e798CffC7653968ddF01b9Cb1A6EA/contracts
- ChangeLog: Added one more setter, supporting system improvements and migration. 

**AllocationStakingProxy**
- Address: 0xA6A01f4b494243d84cf8030d982D7EeB2AeCd329
- Verified: TBD.

---

### Sales
1. Yay Games:
   1. Sale Contract address: https://cchain.explorer.avax.network/address/0x4437c4ca026f08380812D545e26679EB8404E26b/contracts
   2. URL: https://launchpad.avalaunch.app/project-details?id=3
   3. Website: https://yay.games
   
---
