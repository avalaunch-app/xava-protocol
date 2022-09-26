const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const ethUtil = require("ethereumjs-util");
const hre = require("hardhat");
const { zeroPad } = require("ethers/lib/utils");

describe("AllocationStaking", function() {

  let Admin;
  let Collateral;
  let XavaToken, XavaLP1, XavaLP2;
  let AllocationStaking;
  let AllocationStakingRewardsFactory;
  let SalesFactory;
  let deployer, alice, bob;
  let sigExp =  3000000000;
  let startTimestamp;

  let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const REWARDS_PER_SECOND = ethers.utils.parseUnits("0.1");
  const TOKENS_TO_ADD = ethers.utils.parseUnits("100000");
  const TOKENS_TO_SEND = ethers.utils.parseUnits("1000");
  const START_TIMESTAMP_DELTA = 600;
  const END_TIMESTAMP_DELTA = Math.floor(TOKENS_TO_ADD / REWARDS_PER_SECOND + 1);
  const ALLOC_POINT = 1000;
  const DEPOSIT_FEE_PERCENT = 5;
  const DEPOSIT_FEE_PRECISION = 100;
  const DEFAULT_DEPOSIT = 1000;
  const NUMBER_1E36 = "1000000000000000000000000000000000000";
  const DEFAULT_LP_APPROVAL = 10000;
  const DEFAULT_BALANCE_ALICE = 10000;
  const POST_SALE_WITHDRAW_PENALTY_PERCENT = 10;
  const POST_SALE_WITHDRAW_PENALTY_LENGTH = 500;
  const POST_SALE_WITHDRAW_PENALTY_PRECISION = 100;

  const DEPLOYER_PRIVATE_KEY = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  function generateSignature(digest, privateKey) {
    // prefix with "\x19Ethereum Signed Message:\n32"
    // Reference: https://github.com/OpenZeppelin/openzeppelin-contracts/issues/890
    const prefixedHash = ethUtil.hashPersonalMessage(ethUtil.toBuffer(digest));

    // sign message
    const {v, r, s} = ethUtil.ecsign(prefixedHash, Buffer.from(privateKey, 'hex'))

    // generate signature by concatenating r(32), s(32), v(1) in this order
    // Reference: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/76fe1548aee183dfcc395364f0745fe153a56141/contracts/ECRecovery.sol#L39-L43
    const vb = Buffer.from([v]);
    const signature = Buffer.concat([r, s, vb]);

    return signature;
  }

  function signWithdrawal(user, pid, amount, nonce, signatureExpirationTimestamp) {
    // compute keccak256(abi.encodePacked(user, roundId, address(this)))
    const digest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            [ 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
            [user, pid, amount, nonce, signatureExpirationTimestamp]
        )
    );

    return generateSignature(digest, DEPLOYER_PRIVATE_KEY);
  }

  async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
  }

  async function baseSetup(params) {
    await XavaToken.approve(AllocationStaking.address, TOKENS_TO_ADD);
    await AllocationStaking.fund(TOKENS_TO_ADD);

    await AllocationStaking.add(ALLOC_POINT, XavaLP1.address, false);
  }

  async function baseSetupTwoPools(params) {
    await XavaToken.approve(AllocationStaking.address, TOKENS_TO_ADD);
    await AllocationStaking.fund(TOKENS_TO_ADD);

    await AllocationStaking.setDepositFee(DEPOSIT_FEE_PERCENT, DEPOSIT_FEE_PRECISION);

    await AllocationStaking.add(ALLOC_POINT, XavaLP1.address, false);
    await AllocationStaking.add(ALLOC_POINT, XavaLP2.address, false);

    await XavaLP1.approve(AllocationStaking.address, DEFAULT_LP_APPROVAL);
    await XavaLP1.connect(alice).approve(AllocationStaking.address, DEFAULT_LP_APPROVAL);
    await XavaLP1.connect(bob).approve(AllocationStaking.address, DEFAULT_LP_APPROVAL);

    await XavaLP2.approve(AllocationStaking.address, DEFAULT_LP_APPROVAL);
    await XavaLP2.connect(alice).approve(AllocationStaking.address, DEFAULT_LP_APPROVAL);
    await XavaLP2.connect(bob).approve(AllocationStaking.address, DEFAULT_LP_APPROVAL);

    await AllocationStaking.setPostSaleWithdrawPenaltyPercentAndLength(
        POST_SALE_WITHDRAW_PENALTY_PERCENT,
        POST_SALE_WITHDRAW_PENALTY_LENGTH,
        POST_SALE_WITHDRAW_PENALTY_PRECISION
    );

    await AllocationStaking.deposit(0, DEFAULT_DEPOSIT);
  }

  function computeExpectedReward(timestampNow, lastTimestamp, rewPerSec, poolAlloc, totalAlloc, poolDeposit) {
    const tnow = ethers.BigNumber.from(timestampNow);
    // console.log(parseInt(tnow));
    const tdif = tnow.sub(lastTimestamp);
    // console.log(parseInt(tdif));
    const totalRewards = tdif.mul(rewPerSec);
    // console.log(parseInt(totalRewards));
    const poolRewards = totalRewards.mul(poolAlloc).div(totalAlloc);
    // console.log(parseInt(poolRewards));
    const poolRewardsPerShare = poolRewards.mul(NUMBER_1E36).div(poolDeposit)
    // console.log(parseInt(poolRewardsPerShare));

    return poolRewardsPerShare;
  }

  function takeFeeFromDeposit(deposit) {
    return deposit - ((deposit * DEPOSIT_FEE_PERCENT) / DEPOSIT_FEE_PRECISION);
  }

  beforeEach(async function() {
    const accounts = await ethers.getSigners();
    deployer = accounts[0];
    alice = accounts[1];
    bob = accounts[2];

    const AdminFactory = await ethers.getContractFactory("Admin");
    Admin = await AdminFactory.deploy([deployer.address, alice.address, bob.address]);

    const XavaTokenFactory = await ethers.getContractFactory("XavaToken");
    XavaToken = await XavaTokenFactory.deploy("Xava", "XAVA", ethers.utils.parseUnits("100000000000000"), 18);

    XavaLP1 = await XavaTokenFactory.deploy("XavaLP1", "XAVALP1", ethers.utils.parseUnits("100000000"), 18);
    XavaLP2 = await XavaTokenFactory.deploy("XavaLP2", "XAVALP2", ethers.utils.parseUnits("100000000"), 18);

    const CollateralFactory = await ethers.getContractFactory("AvalaunchCollateral");
    Collateral = await CollateralFactory.deploy();
    await Collateral.deployed();
    await Collateral.initialize(deployer.address, Admin.address, 43114);

    const SalesFactoryFactory = await ethers.getContractFactory("SalesFactory");
    SalesFactory = await SalesFactoryFactory.deploy(Admin.address, ZERO_ADDRESS, Collateral.address, ZERO_ADDRESS, deployer.address);

    AllocationStakingRewardsFactory = await ethers.getContractFactory("AllocationStaking");
    const blockTimestamp = await getCurrentBlockTimestamp();
    startTimestamp = blockTimestamp + START_TIMESTAMP_DELTA;

    AllocationStaking = await AllocationStakingRewardsFactory.deploy();
    await AllocationStaking.initialize(XavaToken.address, REWARDS_PER_SECOND, startTimestamp, SalesFactory.address, DEPOSIT_FEE_PERCENT, DEPOSIT_FEE_PRECISION);

    await AllocationStaking.setAdmin(Admin.address);

    await AllocationStaking.setDepositFee(DEPOSIT_FEE_PERCENT, DEPOSIT_FEE_PRECISION);
    await SalesFactory.setAllocationStaking(AllocationStaking.address);

    await XavaLP1.transfer(alice.address, DEFAULT_BALANCE_ALICE);
    await XavaLP2.transfer(alice.address, DEFAULT_BALANCE_ALICE);
  });

  context("Setup", async function() {
    it("Should setup the token correctly", async function() {
      // When
      let decimals = await XavaToken.decimals();
      let totalSupply = await XavaToken.totalSupply();
      let deployerBalance = await XavaToken.balanceOf(deployer.address);

      // Then
      expect(decimals).to.equal(18);
      expect(totalSupply).to.equal(ethers.utils.parseUnits("100000000000000"));
      expect(totalSupply).to.equal(deployerBalance);
    });

    it("Should setup the reward contract with no pools", async function() {
      // When
      let poolLength = await AllocationStaking.poolLength();
      let rewardPerSecond = await AllocationStaking.rewardPerSecond();
      let owner = await AllocationStaking.owner();
      let totalRewards = await AllocationStaking.totalRewards();

      // Then
      expect(poolLength).to.equal(0);
      expect(rewardPerSecond).to.equal(REWARDS_PER_SECOND);
      expect(owner).to.equal(deployer.address);
      expect(totalRewards).to.equal(0);
    });

    it("Should add a pool successfully", async function() {
      // When
      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, false);

      // Then
      let poolLength = await AllocationStaking.poolLength();
      let totalAllocPoint = await AllocationStaking.totalAllocPoint();

      expect(poolLength).to.equal(1);
      expect(totalAllocPoint).to.equal(ALLOC_POINT);
    });

    it("Should add a pool successfully with mass update", async function() {
      // When
      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, true);

      // Then
      let poolLength = await AllocationStaking.poolLength();
      let totalAllocPoint = await AllocationStaking.totalAllocPoint();

      expect(poolLength).to.equal(1);
      expect(totalAllocPoint).to.equal(ALLOC_POINT);
    });

    it("Should set salesFactory", async function() {
      // Given
      const SalesFactoryFactory = await ethers.getContractFactory("SalesFactory");
      const SalesFactory2 = await SalesFactoryFactory.deploy(Admin.address, ZERO_ADDRESS, Collateral.address, ZERO_ADDRESS, deployer.address);

      // When
      await AllocationStaking.setSalesFactory(SalesFactory2.address);

      // Then
      expect(await AllocationStaking.salesFactory()).to.equal(SalesFactory2.address);
    });

    describe("Deposit fee", async function() {
      it("Should set a deposit fee and precision", async function() {
        // When
        await AllocationStaking.setDepositFee(DEPOSIT_FEE_PERCENT, DEPOSIT_FEE_PRECISION);

        // Then
        expect(await AllocationStaking.depositFeePercent()).to.equal(DEPOSIT_FEE_PERCENT);
        expect(await AllocationStaking.depositFeePrecision()).to.equal(DEPOSIT_FEE_PRECISION);
      });

      it("Should set the deposit fee to 0", async function() {
        // When
        await AllocationStaking.setDepositFee(0, 0);

        // Then
        expect(await AllocationStaking.depositFeePercent()).to.equal(0);
      });

      it("Should not allow non-owner to set deposit fee ", async function() {
        // Then
        await expect(AllocationStaking.connect(alice).setDepositFee(10, 10e7))
            .to.be.reverted;
      });

      it("Should emit DepositFeeSet event", async function() {
        await expect(AllocationStaking.setDepositFee(DEPOSIT_FEE_PERCENT, DEPOSIT_FEE_PRECISION))
            .to.emit(AllocationStaking, "DepositFeeSet").withArgs(DEPOSIT_FEE_PERCENT, DEPOSIT_FEE_PRECISION);
      });
    });
  });

  context("Fund", async function() {
    it("Should fund the farm successfully", async function() {
      // Given
      let deployerBalanceBefore = await XavaToken.balanceOf(deployer.address);
      let rewardPerSecond = await AllocationStaking.rewardPerSecond();
      let startTimestamp = await AllocationStaking.startTimestamp();

      await XavaToken.approve(AllocationStaking.address, TOKENS_TO_ADD);
      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, false);

      // When
      await AllocationStaking.fund(TOKENS_TO_ADD);

      // Then
      let deployerBalanceAfter = await XavaToken.balanceOf(deployer.address);
      let contractBalanceAfter = await XavaToken.balanceOf(AllocationStaking.address);
      let endTimestampAfter = await AllocationStaking.endTimestamp();
      let totalRewardsAfter = await AllocationStaking.totalRewards();

      expect(deployerBalanceBefore.sub(deployerBalanceAfter)).to.equal(TOKENS_TO_ADD);
      expect(contractBalanceAfter).to.equal(TOKENS_TO_ADD);
      expect(endTimestampAfter).to.equal(startTimestamp.add(ethers.BigNumber.from(TOKENS_TO_ADD).div(rewardPerSecond)));
      expect(totalRewardsAfter).to.equal(TOKENS_TO_ADD);
    });

    it("Should not fund the farm after end date", async function() {
      // Given
      await XavaToken.approve(AllocationStaking.address, TOKENS_TO_ADD);

      // When
      await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA]);
      await ethers.provider.send("evm_mine");

      // Then
      await expect(AllocationStaking.fund(TOKENS_TO_ADD)).to.be.revertedWith("fund: too late, the farm is closed");
    });

    it("Should not fund the farm if token was not approved", async function() {
      // Then
      await expect(AllocationStaking.fund(TOKENS_TO_ADD)).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    });

    it("Should not fund the farm if reward per second is 0", async function() {
      // Given
      const blockTimestamp = await getCurrentBlockTimestamp();
      AllocationStaking = await AllocationStakingRewardsFactory.deploy();
      AllocationStaking.initialize(XavaToken.address, 0, blockTimestamp + START_TIMESTAMP_DELTA, SalesFactory.address, DEPOSIT_FEE_PERCENT, DEPOSIT_FEE_PRECISION);
      await XavaToken.approve(AllocationStaking.address, TOKENS_TO_ADD);

      // Then
      await expect(AllocationStaking.fund(TOKENS_TO_ADD)).to.be.revertedWith("SafeMath: division by zero");
    });
  });

  context("Pools", async function() {
    describe("Add pools", async function() {
      it("Should add pool to list", async function() {
        // When
        await AllocationStaking.add(ALLOC_POINT, XavaLP1.address, false);

        // Then
        const poolLength = await AllocationStaking.poolLength();
        const pool = await AllocationStaking.poolInfo(0);

        expect(poolLength).to.equal(1);
        expect(pool.lpToken).to.equal(XavaLP1.address);
        expect(pool.allocPoint).to.equal(ALLOC_POINT);
        expect(pool.lastRewardTimestamp).to.equal(startTimestamp);
        expect(pool.accERC20PerShare).to.equal(0);
        expect(pool.totalDeposits).to.equal(0);

        expect(await AllocationStaking.totalAllocPoint()).to.equal(ALLOC_POINT);
      });

      it("Should add two pools to list", async function() {
        // When
        await AllocationStaking.add(ALLOC_POINT, XavaLP1.address, false);
        await AllocationStaking.add(ALLOC_POINT, XavaLP2.address, false);

        // Then
        const poolLength = await AllocationStaking.poolLength();
        const pool1 = await AllocationStaking.poolInfo(0);
        const pool2 = await AllocationStaking.poolInfo(1);

        expect(poolLength).to.equal(2);

        expect(pool1.lpToken).to.equal(XavaLP1.address);
        expect(pool1.allocPoint).to.equal(ALLOC_POINT);
        expect(pool1.lastRewardTimestamp).to.equal(startTimestamp);
        expect(pool1.accERC20PerShare).to.equal(0);
        expect(pool1.totalDeposits).to.equal(0);

        expect(pool2.lpToken).to.equal(XavaLP2.address);
        expect(pool2.allocPoint).to.equal(ALLOC_POINT);
        expect(pool2.lastRewardTimestamp).to.equal(startTimestamp);
        expect(pool2.accERC20PerShare).to.equal(0);
        expect(pool2.totalDeposits).to.equal(0);

        expect(await AllocationStaking.totalAllocPoint()).to.equal(2 * ALLOC_POINT);
      });

      it("Should not allow non-owner to add pool", async function() {
        // Then
        await expect(AllocationStaking.connect(alice).add(ALLOC_POINT, XavaLP1.address, false))
            .to.be.reverted;
      });
    });

    describe("Set allocation point", async function() {
      it("Should set pool's allocation point", async function() {
        // Given
        await baseSetup();
        const newAllocPoint = 12345;

        // When
        await AllocationStaking.set(0, newAllocPoint, false);

        // Then
        const pool = await AllocationStaking.poolInfo(0);
        expect(pool.allocPoint).to.equal(newAllocPoint);
        expect(await AllocationStaking.totalAllocPoint()).to.equal(newAllocPoint);
      });

      it("Should set pool's allocation point with mass update", async function() {
        // Given
        await baseSetup();
        const newAllocPoint = 12345;

        // When
        await AllocationStaking.set(0, newAllocPoint, true);

        // Then
        const pool = await AllocationStaking.poolInfo(0);
        expect(pool.allocPoint).to.equal(newAllocPoint);
        expect(await AllocationStaking.totalAllocPoint()).to.equal(newAllocPoint);
      });

      it("Should set pool's allocation point to 0", async function() {
        // Given
        await baseSetup();
        const newAllocPoint = 0;

        // When
        await AllocationStaking.set(0, newAllocPoint, false);

        // Then
        const pool = await AllocationStaking.poolInfo(0);
        expect(pool.allocPoint).to.equal(newAllocPoint);
        expect(await AllocationStaking.totalAllocPoint()).to.equal(newAllocPoint);
      });

      it("Should not allow non-owner to set allocation point", async function() {
        // Given
        await baseSetup();
        const newAllocPoint = 12345;

        // Then
        await expect(AllocationStaking.connect(alice).set(0, newAllocPoint, false))
            .to.be.reverted;
      });
    });

    describe("Update pool", async function() {
      it("Should update pool", async function() {
        // Given
        await baseSetup();

        await XavaLP1.approve(AllocationStaking.address, DEFAULT_DEPOSIT);
        await AllocationStaking.deposit(0, DEFAULT_DEPOSIT);

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA]);
        await ethers.provider.send("evm_mine");

        // When
        await AllocationStaking.updatePool(0);

        // Then
        let blockTimestamp = await getCurrentBlockTimestamp();
        const pool = await AllocationStaking.poolInfo(0);
        expect(pool.lastRewardTimestamp).to.equal(blockTimestamp);
        const endTimestamp = await AllocationStaking.endTimestamp();
        if(blockTimestamp > endTimestamp) blockTimestamp = endTimestamp.deposited(0, )
        const expectedRewardsPerShare = computeExpectedReward(blockTimestamp, startTimestamp, REWARDS_PER_SECOND, ALLOC_POINT, ALLOC_POINT, takeFeeFromDeposit(DEFAULT_DEPOSIT));
        expect(pool.accERC20PerShare).to.equal(expectedRewardsPerShare);
      });

      it("Should allow non-owner to update pool", async function() {
        // Given
        await baseSetup();

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA]);
        await ethers.provider.send("evm_mine");

        // Then
        await expect(AllocationStaking.connect(alice).updatePool(0))
            .to.not.be.reverted;

        const blockTimestamp = await getCurrentBlockTimestamp();
        const pool = await AllocationStaking.poolInfo(0);
        expect(pool.lastRewardTimestamp).to.equal(blockTimestamp);
      });

      it("Should update pool after staking ended", async function() {
        // Given
        await baseSetup();

        await XavaLP1.approve(AllocationStaking.address, DEFAULT_DEPOSIT);
        await AllocationStaking.deposit(0, DEFAULT_DEPOSIT);

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA]);
        await ethers.provider.send("evm_mine");

        await ethers.provider.send("evm_increaseTime", [END_TIMESTAMP_DELTA + 1000]);
        await ethers.provider.send("evm_mine");

        // When
        await AllocationStaking.updatePool(0);

        // Then
        const blockTimestamp = await getCurrentBlockTimestamp();
        const pool = await AllocationStaking.poolInfo(0);
        expect(pool.lastRewardTimestamp).to.equal(startTimestamp + END_TIMESTAMP_DELTA);
        const expectedRewardsPerShare = computeExpectedReward(END_TIMESTAMP_DELTA, 0, REWARDS_PER_SECOND, ALLOC_POINT, ALLOC_POINT, takeFeeFromDeposit(DEFAULT_DEPOSIT));
        expect(pool.accERC20PerShare).to.equal(expectedRewardsPerShare);
      });

      it("Should not change pool if updated twice after end time", async function() {
        // Given
        await baseSetup();

        await XavaLP1.approve(AllocationStaking.address, DEFAULT_DEPOSIT);
        await AllocationStaking.deposit(0, DEFAULT_DEPOSIT);

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA]);
        await ethers.provider.send("evm_mine");

        await ethers.provider.send("evm_increaseTime", [END_TIMESTAMP_DELTA + 1000]);
        await ethers.provider.send("evm_mine");

        await AllocationStaking.updatePool(0);

        // When
        await ethers.provider.send("evm_increaseTime", [100]);
        await ethers.provider.send("evm_mine");
        await AllocationStaking.updatePool(0);

        // Then
        const blockTimestamp = await getCurrentBlockTimestamp();
        const pool = await AllocationStaking.poolInfo(0);
        expect(pool.lastRewardTimestamp).to.equal(startTimestamp + END_TIMESTAMP_DELTA);
        const expectedRewardsPerShare = computeExpectedReward(END_TIMESTAMP_DELTA, 0, REWARDS_PER_SECOND, ALLOC_POINT, ALLOC_POINT, takeFeeFromDeposit(DEFAULT_DEPOSIT));
        expect(pool.accERC20PerShare).to.equal(expectedRewardsPerShare);
      });

      it("Should only change timestamp if pool is empty", async function() {
        // Given
        await baseSetup();

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA]);
        await ethers.provider.send("evm_mine");

        const prevPoolInfo = await AllocationStaking.poolInfo(0);
        expect(prevPoolInfo.totalDeposits).to.equal(0);

        // When
        await AllocationStaking.updatePool(0);

        // Then
        const blockTimestamp = await getCurrentBlockTimestamp();
        const pool = await AllocationStaking.poolInfo(0);
        expect(pool.lastRewardTimestamp).to.equal(blockTimestamp);
        expect(pool.accERC20PerShare).to.equal(0);
      });
    });

    describe("Mass update pools", async function() {
      // TODO:
      xit("Should update all pools", async function() {
        // Given
        await baseSetup();

        await XavaLP1.approve(AllocationStaking.address, DEFAULT_DEPOSIT);
        await AllocationStaking.deposit(0, DEFAULT_DEPOSIT);

        await AllocationStaking.add(ALLOC_POINT, XavaLP2.address, false);
        await XavaLP2.approve(AllocationStaking.address, DEFAULT_DEPOSIT);
        await AllocationStaking.deposit(1, DEFAULT_DEPOSIT);

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA]);
        await ethers.provider.send("evm_mine");

        // When
        await AllocationStaking.massUpdatePools();

        // Then
        const blockTimestamp = await getCurrentBlockTimestamp();
        const pool1 = await AllocationStaking.poolInfo(0);
        const pool2 = await AllocationStaking.poolInfo(1);
        expect(pool1.lastRewardTimestamp).to.equal(blockTimestamp);
        expect(pool2.lastRewardTimestamp).to.equal(blockTimestamp);
        const expectedRewardsPerShare = computeExpectedReward(blockTimestamp, startTimestamp, REWARDS_PER_SECOND, ALLOC_POINT, 2 * ALLOC_POINT, takeFeeFromDeposit(DEFAULT_DEPOSIT));
        console.log("Pool1 AccERC20:", parseInt(pool1.accERC20PerShare), "Expected AccERC20:", parseInt(expectedRewardsPerShare), "Pool2 AccERC20:", parseInt(pool2.accERC20PerShare));
        expect(pool1.accERC20PerShare).to.equal(expectedRewardsPerShare);
        expect(pool2.accERC20PerShare).to.equal(expectedRewardsPerShare);
      });

      it("Should allow non-owner to mass update pools", async function() {
        // Given
        await baseSetup();

        await XavaLP1.approve(AllocationStaking.address, DEFAULT_DEPOSIT);
        await AllocationStaking.deposit(0, DEFAULT_DEPOSIT);

        await AllocationStaking.add(ALLOC_POINT, XavaLP2.address, false);
        await XavaLP2.approve(AllocationStaking.address, DEFAULT_DEPOSIT);
        await AllocationStaking.deposit(1, DEFAULT_DEPOSIT);

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA]);
        await ethers.provider.send("evm_mine");

        // Then
        await expect(AllocationStaking.connect(alice).massUpdatePools()).to.not.be.reverted;
      });

      it("Should not break if array of pools is empty", async function() {
        // Given
        await XavaToken.approve(AllocationStaking.address, TOKENS_TO_ADD);
        await AllocationStaking.fund(TOKENS_TO_ADD);

        // Then
        await expect(AllocationStaking.connect(alice).massUpdatePools()).to.not.be.reverted;
      });
    });
  });

  context("Deposits", async function() {
    describe("Deposited", async function() {
      it("Should return user amount deposited in pool", async function() {
        // Given
        await baseSetupTwoPools();

        // When
        const deposited = await AllocationStaking.deposited(0, deployer.address);
        expect(deposited).to.equal(takeFeeFromDeposit(DEFAULT_DEPOSIT));
      });

      it("Should return 0 if user not participated in pool", async function() {
        // Given
        await baseSetupTwoPools();

        // When
        const deposited = await AllocationStaking.deposited(1, deployer.address);
        expect(deposited).to.equal(0);
      });
    });

    describe("Pending", async function() {
      it("Should return 0 if user deposited but staking not started", async function() {
        // Given
        await baseSetupTwoPools();

        // When
        const pending = await AllocationStaking.pending(0, deployer.address);

        // Then
        expect(pending).to.equal(0);
      });

      it("Should return 0 if user didn't deposit and staking not started", async function() {
        // Given
        await baseSetupTwoPools();

        // When
        const pending = await AllocationStaking.pending(1, deployer.address);

        // Then
        expect(pending).to.equal(0);
      });

      it("Should return 0 if staking started but user didn't deposit", async function() {
        // Given
        await baseSetupTwoPools();

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        // When
        const pending = await AllocationStaking.pending(1, deployer.address);

        // Then
        expect(pending).to.equal(0);
      });

      it("Should return user's pending amount if staking started and user deposited", async function() {
        // Given
        await baseSetupTwoPools();

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        // When
        const blockTimestamp = await getCurrentBlockTimestamp();
        const pending = await AllocationStaking.pending(0, deployer.address);

        // Then
        const expectedRewardsPerShare = computeExpectedReward(blockTimestamp, startTimestamp, REWARDS_PER_SECOND, ALLOC_POINT, 2 * ALLOC_POINT, takeFeeFromDeposit(DEFAULT_DEPOSIT));
        expect(pending).to.equal(expectedRewardsPerShare.mul(takeFeeFromDeposit(DEFAULT_DEPOSIT)).div(NUMBER_1E36));
      });

      it("Should return user's pending amount if called right after an update", async function() {
        // Given
        await baseSetupTwoPools();

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        // When
        await AllocationStaking.updatePool(0);
        const blockTimestamp = await getCurrentBlockTimestamp();
        const pending = await AllocationStaking.pending(0, deployer.address);

        // Then
        const expectedRewardsPerShare = computeExpectedReward(blockTimestamp, startTimestamp, REWARDS_PER_SECOND, ALLOC_POINT, 2 * ALLOC_POINT, takeFeeFromDeposit(DEFAULT_DEPOSIT));
        expect(pending).to.equal(expectedRewardsPerShare.mul(takeFeeFromDeposit(DEFAULT_DEPOSIT)).div(NUMBER_1E36));
      });

      it("Should return user's pending amount if called some time after an update", async function() {
        // Given
        await baseSetupTwoPools();

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        // When
        await AllocationStaking.updatePool(0);

        await ethers.provider.send("evm_increaseTime", [20]);
        await ethers.provider.send("evm_mine");

        const blockTimestamp = await getCurrentBlockTimestamp();
        const pending = await AllocationStaking.pending(0, deployer.address);

        // Then
        const expectedRewardsPerShare = computeExpectedReward(blockTimestamp, startTimestamp, REWARDS_PER_SECOND, ALLOC_POINT, 2 * ALLOC_POINT, takeFeeFromDeposit(DEFAULT_DEPOSIT));
        expect(pending).to.equal(expectedRewardsPerShare.mul(takeFeeFromDeposit(DEFAULT_DEPOSIT)).div(NUMBER_1E36));
      });

      it("Should return user's last pending amount if user deposited multiple times", async function() {
        // Given
        await baseSetupTwoPools();
        await AllocationStaking.deposit(0, DEFAULT_DEPOSIT);

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        // When
        await AllocationStaking.deposit(0, DEFAULT_DEPOSIT);
        const blockTimestampAtLastDeposit = await getCurrentBlockTimestamp();

        await ethers.provider.send("evm_increaseTime", [20]);
        await ethers.provider.send("evm_mine");

        const blockTimestamp = await getCurrentBlockTimestamp();
        const pending = await AllocationStaking.pending(0, deployer.address);

        // Then
        // const expectedRewardsPerShare1 = computeExpectedReward(blockTimestampAtLastDeposit, startTimestamp, REWARDS_PER_SECOND, ALLOC_POINT, 2 * ALLOC_POINT, 2 * takeFeeFromDeposit(DEFAULT_DEPOSIT));
        const expectedRewardsPerShare2 = computeExpectedReward(blockTimestamp, blockTimestampAtLastDeposit, REWARDS_PER_SECOND, ALLOC_POINT, 2 * ALLOC_POINT, takeFeeFromDeposit(DEFAULT_DEPOSIT));

        const user = await AllocationStaking.userInfo(0, deployer.address);
        // console.log("User rewardDebt:", user.rewardDebt);

        // TODO: Check pending - adding 1
        expect(pending).to.equal(expectedRewardsPerShare2.mul(takeFeeFromDeposit(DEFAULT_DEPOSIT)).div(NUMBER_1E36).add(1));
      });

      //TODO:
      xit("Should compute reward debt properly if user is not first to stake in pool", async function() {
        // Given
        await baseSetupTwoPools();

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        // When
        await AllocationStaking.connect(alice).deposit(0, DEFAULT_DEPOSIT);
        const blockTimestampAtLastDeposit = await getCurrentBlockTimestamp();

        await ethers.provider.send("evm_increaseTime", [20]);
        await ethers.provider.send("evm_mine");

        const blockTimestamp = await getCurrentBlockTimestamp();
        const pending = await AllocationStaking.pending(0, alice.address);

        // Then
        const prevExpectedRewardsPerShare = computeExpectedReward(blockTimestampAtLastDeposit, startTimestamp, REWARDS_PER_SECOND, ALLOC_POINT, 2 * ALLOC_POINT, takeFeeFromDeposit(DEFAULT_DEPOSIT));
        const user = await AllocationStaking.userInfo(0, alice.address);
        console.log('a')
        // const firstRewardDebt =
        expect(user.rewardDebt).to.equal(prevExpectedRewardsPerShare.mul(takeFeeFromDeposit(DEFAULT_DEPOSIT)).div(NUMBER_1E36)/* + firstRewardDebt*/);
        console.log('a')

        const expectedRewardsPerShare = computeExpectedReward(blockTimestamp, blockTimestampAtLastDeposit, REWARDS_PER_SECOND, ALLOC_POINT, 2 * ALLOC_POINT, 2 * takeFeeFromDeposit(DEFAULT_DEPOSIT));
        expect(pending).to.equal(expectedRewardsPerShare.mul(takeFeeFromDeposit(DEFAULT_DEPOSIT)).div(NUMBER_1E36));
      });

      //TODO:
      xit("Should compute reward debt properly if user is not first to stake in pool but staking not started", async function() {
        // Given
        await baseSetupTwoPools();

        // When
        await AllocationStaking.connect(alice).deposit(0, DEFAULT_DEPOSIT);

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        const blockTimestamp = await getCurrentBlockTimestamp();
        const pending = await AllocationStaking.pending(0, alice.address);

        // Then
        const user = await AllocationStaking.userInfo(0, alice.address);
        expect(user.rewardDebt).to.equal(0)

        const expectedRewardsPerShare = computeExpectedReward(blockTimestamp, startTimestamp, REWARDS_PER_SECOND, ALLOC_POINT, 2 * ALLOC_POINT, 2 * takeFeeFromDeposit(DEFAULT_DEPOSIT));
        expect(pending).to.equal(expectedRewardsPerShare.mul(takeFeeFromDeposit(DEFAULT_DEPOSIT)).div(NUMBER_1E36));
      });

      it("Should not use updated accERC20PerShare if time passed but staking ended without pool update", async function() {
        // Given
        await baseSetupTwoPools();

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA]);
        await ethers.provider.send("evm_mine");

        await ethers.provider.send("evm_increaseTime", [END_TIMESTAMP_DELTA + 100]);
        await ethers.provider.send("evm_mine");

        // When
        const pending = await AllocationStaking.pending(0, deployer.address);

        // Then
        const expectedRewardsPerShare = computeExpectedReward(END_TIMESTAMP_DELTA, 0, REWARDS_PER_SECOND, ALLOC_POINT, 2 * ALLOC_POINT, takeFeeFromDeposit(DEFAULT_DEPOSIT));
        expect(pending).to.equal(expectedRewardsPerShare.mul(takeFeeFromDeposit(DEFAULT_DEPOSIT)).div(NUMBER_1E36));
      });

      it("Should not use updated accERC20PerShare if time passed but staking ended with pool update", async function() {
        // Given
        await baseSetupTwoPools();

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA]);
        await ethers.provider.send("evm_mine");

        await ethers.provider.send("evm_increaseTime", [END_TIMESTAMP_DELTA + 100]);
        await ethers.provider.send("evm_mine");

        // When
        await AllocationStaking.updatePool(0);
        const pending = await AllocationStaking.pending(0, deployer.address);

        // Then
        const expectedRewardsPerShare = computeExpectedReward(END_TIMESTAMP_DELTA, 0, REWARDS_PER_SECOND, ALLOC_POINT, 2 * ALLOC_POINT, takeFeeFromDeposit(DEFAULT_DEPOSIT));
        expect(pending).to.equal(expectedRewardsPerShare.mul(takeFeeFromDeposit(DEFAULT_DEPOSIT)).div(NUMBER_1E36));
      });
    });

    describe("Total pending", async function() {
      it("Should return total amount pending", async function() {
        // Given
        await baseSetupTwoPools();

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        // When
        const blockTimestamp = await getCurrentBlockTimestamp();
        const totalPending = await AllocationStaking.totalPending();

        // Then
        const expectedTotalPending = ethers.BigNumber.from(blockTimestamp).sub(startTimestamp).mul(REWARDS_PER_SECOND);
        expect(totalPending).to.equal(expectedTotalPending);
      });

      it("Should be sum of pending for each pool if multiple pools", async function() {
        // Given
        await baseSetupTwoPools();

        await AllocationStaking.deposit(1, 250);

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        // When
        const blockTimestamp = await getCurrentBlockTimestamp();
        const totalPending = await AllocationStaking.totalPending();

        const pending0 = await AllocationStaking.pending(0, deployer.address);
        const pending1 = await AllocationStaking.pending(1, deployer.address);

        // Then
        const expectedTotalPending = pending0.add(pending1);
        // TODO: Recheck

        expect(totalPending).to.equal(expectedTotalPending.add(1));
      });

      it("Should be sum of pending for each user if multiple users", async function() {
        // Given
        await baseSetup();

        await XavaLP1.connect(alice).approve(AllocationStaking.address, DEFAULT_LP_APPROVAL);
        await AllocationStaking.connect(alice).deposit(0, 250);

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        // When
        const totalPending = await AllocationStaking.totalPending();

        const pendingDeployer = await AllocationStaking.pending(0, deployer.address);
        const pendingAlice = await AllocationStaking.pending(0, alice.address);

        // Then
        const expectedTotalPending = pendingDeployer.add(pendingAlice);
        // TODO: Recheck
        expect(totalPending).to.equal(expectedTotalPending.add(1));
      });

      //TODO:
      xit("Should be sum of pending for each pool and user if multiple pools and users", async function() {
        // Given
        await baseSetupTwoPools();

        await AllocationStaking.deposit(0, 100);
        await AllocationStaking.connect(alice).deposit(0, 250);
        await AllocationStaking.connect(alice).deposit(1, 2500);

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        await AllocationStaking.deposit(1, 250);

        await ethers.provider.send("evm_increaseTime", [100]);
        await ethers.provider.send("evm_mine");

        // When
        const blockTimestamp = await getCurrentBlockTimestamp();
        const totalPending = await AllocationStaking.totalPending();

        const pendingDeployer0 = await AllocationStaking.pending(0, deployer.address);
        const pendingDeployer1 = await AllocationStaking.pending(1, deployer.address);
        const pendingAlice0 = await AllocationStaking.pending(0, alice.address);
        const pendingAlice1 = await AllocationStaking.pending(1, alice.address);

        // Then
        const expectedTotalPending = pendingDeployer0.add(pendingDeployer1).add(pendingAlice0).add(pendingAlice1);
        expect(totalPending).to.equal(expectedTotalPending.add(2));
      });

      it("Should return 0 if staking not started", async function() {
        // Given
        await baseSetupTwoPools();

        // When
        const totalPending = await AllocationStaking.totalPending();

        // Then
        expect(totalPending).to.equal(0);
      });

      //TODO: check why 1 is a withdrawal leftover in many cases
      xit("Should return 0 if all pending tokens have been paid", async function() {
        // Given
        await baseSetupTwoPools();

        await AllocationStaking.deposit(1, 250);

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        await ethers.provider.send("evm_increaseTime", [END_TIMESTAMP_DELTA]);
        await ethers.provider.send("evm_mine");

        await AllocationStaking.withdraw(0, Math.ceil(takeFeeFromDeposit(DEFAULT_DEPOSIT)));
        await AllocationStaking.withdraw(1, Math.ceil(takeFeeFromDeposit(250)));

        // When
        // const blockTimestamp = await getCurrentBlockTimestamp();
        const totalPending = await AllocationStaking.totalPending();

        // Then
        expect(totalPending).to.equal(0);
      });

      xit("Should return 0 if all pending tokens have been wiped by emergency withdraw", async function() {
        // Given
        await baseSetupTwoPools();

        await AllocationStaking.deposit(1, 250);

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        await ethers.provider.send("evm_increaseTime", [END_TIMESTAMP_DELTA]);
        await ethers.provider.send("evm_mine");

        await AllocationStaking.emergencyWithdraw(0);
        await AllocationStaking.emergencyWithdraw(1);

        // When
        const blockTimestamp = await getCurrentBlockTimestamp();
        const totalPending = await AllocationStaking.totalPending();

        // Then
        expect(totalPending).to.equal(0);
      });

      xit("Should return correct amount if one pool is empty", async function() {
        // Given
        await baseSetupTwoPools();

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        // When
        const blockTimestamp = await getCurrentBlockTimestamp();
        const totalPending = await AllocationStaking.totalPending();
        const pendingInPool0 = await AllocationStaking.pending(0, deployer.address);
        const pendingInPool1 = await AllocationStaking.pending(1, deployer.address);

        // Then
        expect(pendingInPool0).to.not.equal(0);
        expect(pendingInPool1).to.equal(0);

        expect(totalPending).to.equal(pendingInPool0);
      });
    });

    describe("Deposit", async function() {
      it("Should deposit LP tokens in pool if user is first to deposit", async function() {
        // Given
        await baseSetupTwoPools();

        // When
        await AllocationStaking.deposit(1, 250);

        // Then
        const pool = await AllocationStaking.poolInfo(1);
        const user = await AllocationStaking.userInfo(1, deployer.address);
        expect(pool.totalDeposits).to.equal(250);
        expect(user.amount).to.equal(250);
      });

      it("Should deposit LP tokens in pool if user is already deposited in this pool", async function() {
        // Given
        await baseSetupTwoPools();

        // When
        await AllocationStaking.deposit(0, 250);

        // Then
        const pool = await AllocationStaking.poolInfo(0);
        const user = await AllocationStaking.userInfo(0, deployer.address);
        expect(pool.totalDeposits).to.equal(Math.ceil(takeFeeFromDeposit(DEFAULT_DEPOSIT + 250)));
        expect(user.amount).to.equal(Math.ceil(takeFeeFromDeposit(DEFAULT_DEPOSIT + 250)));
      });

      it("Should deposit LP tokens in pool if user is second to deposit", async function() {
        // Given
        await baseSetupTwoPools();

        // When
        await AllocationStaking.deposit(1, 250);
        await AllocationStaking.connect(alice).deposit(1, 300);

        // Then
        const pool = await AllocationStaking.poolInfo(1);
        const user = await AllocationStaking.userInfo(1, alice.address);
        expect(pool.totalDeposits).to.equal(250 + 300);
        expect(user.amount).to.equal(300);
      });

      //TODO:
      xit("Should update pool before adding LP tokens", async function() {
        // Given
        await baseSetupTwoPools();

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA]);
        await ethers.provider.send("evm_mine");

        // When
        await AllocationStaking.deposit(0, 100);

        // Then
        const blockTimestamp = await getCurrentBlockTimestamp();
        const pool = await AllocationStaking.poolInfo(0);
        expect(pool.lastRewardTimestamp).to.equal(blockTimestamp);
        const expectedRewardsPerShare = computeExpectedReward(blockTimestamp, startTimestamp, REWARDS_PER_SECOND, ALLOC_POINT, 2 * ALLOC_POINT, takeFeeFromDeposit(DEFAULT_DEPOSIT));
        expect(pool.accERC20PerShare).to.equal(expectedRewardsPerShare);
        expect(pool.totalDeposits).to.equal(takeFeeFromDeposit(DEFAULT_DEPOSIT + 100));
      });

      it("Should not deposit into non-existent pool", async function() {
        // Given
        await baseSetupTwoPools();

        // Then
        await expect(AllocationStaking.deposit(5, 100)).to.be.reverted;
      });

      //TODO:
      xit("Should pay user pending amount before adding new deposit", async function() {
        // Given
        await baseSetupTwoPools();

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        await ethers.provider.send("evm_increaseTime", [END_TIMESTAMP_DELTA]);
        await ethers.provider.send("evm_mine");

        const pendingBefore = await AllocationStaking.pending(0, deployer.address);
        const balanceLPBefore = await XavaLP1.balanceOf(deployer.address);
        const balanceERC20Before = await XavaToken.balanceOf(deployer.address);

        // When
        await AllocationStaking.deposit(0, 100);

        // Then
        const pendingAfter = await AllocationStaking.pending(0, deployer.address);
        const balanceLPAfter = await XavaLP1.balanceOf(deployer.address);
        const balanceERC20After = await XavaToken.balanceOf(deployer.address);

        expect(pendingAfter).to.equal(0);
        expect(balanceLPAfter).to.equal(balanceLPBefore.sub(100));
        expect(balanceERC20After).to.equal(balanceERC20Before.add(pendingBefore));
      });

      it("Should emit Deposit event", async function() {
        // Given
        await baseSetupTwoPools();

        // Then
        await expect(AllocationStaking.deposit(0, DEFAULT_DEPOSIT))
            .to.emit(AllocationStaking, "Deposit").withArgs(deployer.address, 0, takeFeeFromDeposit(DEFAULT_DEPOSIT));
      });
    });

    describe("Deposit fee", async function() {
      it("Should only redistribute Xava once", async function() {
        // Given
        await baseSetupTwoPools();

        await AllocationStaking.setDepositFee(DEPOSIT_FEE_PERCENT, DEPOSIT_FEE_PRECISION);

        const totalXavaRedistributedBefore = await AllocationStaking.totalXavaRedistributed();

        // When
        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        const amountToDeposit = ethers.BigNumber.from("1000000000");
        await XavaLP1.approve(AllocationStaking.address, amountToDeposit);
        await AllocationStaking.deposit(0, amountToDeposit);

        // Then
        const totalXavaRedistributedAfter = await AllocationStaking.totalXavaRedistributed();
        const depositFee = ethers.BigNumber.from(amountToDeposit).mul(DEPOSIT_FEE_PERCENT).div(DEPOSIT_FEE_PRECISION);
        expect(totalXavaRedistributedAfter).to.equal(totalXavaRedistributedBefore.add(depositFee));
      });

      it("Should redistribute XAVA if deposit after stake ended", async function() {
        // Given
        await baseSetupTwoPools();

        await AllocationStaking.setDepositFee(DEPOSIT_FEE_PERCENT, DEPOSIT_FEE_PRECISION);

        const totalXavaRedistributedBefore = await AllocationStaking.totalXavaRedistributed();

        // When
        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        await ethers.provider.send("evm_increaseTime", [END_TIMESTAMP_DELTA]);
        await ethers.provider.send("evm_mine");

        const amountToDeposit = ethers.BigNumber.from("1000000000");
        await XavaLP1.approve(AllocationStaking.address, amountToDeposit);
        await AllocationStaking.deposit(0, amountToDeposit);

        // Then
        const totalXavaRedistributedAfter = await AllocationStaking.totalXavaRedistributed();
        const depositFee = ethers.BigNumber.from(amountToDeposit).mul(DEPOSIT_FEE_PERCENT).div(DEPOSIT_FEE_PRECISION);
        expect(totalXavaRedistributedAfter).to.equal(totalXavaRedistributedBefore.add(depositFee));
      });

      it("Should redistribute XAVA if deposit at same timestamp", async function() {
        // Given
        await baseSetupTwoPools();

        await AllocationStaking.setDepositFee(DEPOSIT_FEE_PERCENT, DEPOSIT_FEE_PRECISION);

        const totalXavaRedistributedBefore = await AllocationStaking.totalXavaRedistributed();

        // When
        const amountToDeposit = ethers.BigNumber.from("1000000000");
        await XavaLP1.approve(AllocationStaking.address, amountToDeposit);
        await AllocationStaking.deposit(0, amountToDeposit);

        // Then
        const totalXavaRedistributedAfter = await AllocationStaking.totalXavaRedistributed();
        const depositFee = ethers.BigNumber.from(amountToDeposit).mul(DEPOSIT_FEE_PERCENT).div(DEPOSIT_FEE_PRECISION);
        expect(totalXavaRedistributedAfter).to.equal(totalXavaRedistributedBefore.add(depositFee));
      });

      it("Should not redistribute XAVA if pool is empty", async function() {
        // Given
        await baseSetupTwoPools();

        // When
        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        const amountToDeposit = ethers.BigNumber.from("1000000000");
        await XavaLP1.approve(AllocationStaking.address, amountToDeposit);
        await AllocationStaking.deposit(0, amountToDeposit);

        const initialDepositFee = (DEFAULT_DEPOSIT * DEPOSIT_FEE_PERCENT) / DEPOSIT_FEE_PRECISION;
        // console.log(initialDepositFee);
        // Then
        const totalXavaRedistributedAfter = await AllocationStaking.totalXavaRedistributed();
        const depositFee = ethers.BigNumber.from(amountToDeposit).mul(DEPOSIT_FEE_PERCENT).div(DEPOSIT_FEE_PRECISION);
        // console.log(parseInt(amountToDeposit), parseInt(depositFee));
        expect(totalXavaRedistributedAfter).to.equal(depositFee.add(initialDepositFee));
      });

      it("Should get deposited amount from user", async () => {
        // Given
        await baseSetupTwoPools();

        // Then
        let deposits, earnings;
        [deposits, earnings] = await AllocationStaking.getPendingAndDepositedForUsers([deployer.address], 0)
        expect(deposits[0]).to.equal(takeFeeFromDeposit(DEFAULT_DEPOSIT));
        // TODO: Try with time increase and estimate the earnings
        expect(earnings[0]).to.equal(0);
      });
    });
  });

  context("Withdraws", async function() {
    describe("Withdraw", async function() {
      it("Should withdraw user's deposit", async function() {
        // Given
        await baseSetupTwoPools();
        const poolBefore = await AllocationStaking.poolInfo(0);
        const balanceBefore = await XavaLP1.balanceOf(deployer.address);

        const amount = takeFeeFromDeposit(DEFAULT_DEPOSIT);

        // When
        await AllocationStaking.withdraw(
            0,
            amount,
            1,
            sigExp,
            signWithdrawal(deployer.address, 0, amount, 1, sigExp)
        );

        // Then
        const poolAfter = await AllocationStaking.poolInfo(0)
        const balanceAfter = await XavaLP1.balanceOf(deployer.address);
        expect(balanceAfter).to.equal(balanceBefore.add(takeFeeFromDeposit(DEFAULT_DEPOSIT)));
        expect(poolBefore.totalDeposits).to.equal(takeFeeFromDeposit(DEFAULT_DEPOSIT));
        expect(poolAfter.totalDeposits).to.equal(0);
      });

      it("Should now withdraw user's deposit, with used nonce", async function() {
        // Given
        await baseSetupTwoPools();
        const poolBefore = await AllocationStaking.poolInfo(0);
        const balanceBefore = await XavaLP1.balanceOf(deployer.address);

        const amount = takeFeeFromDeposit(DEFAULT_DEPOSIT);

        // When
        await AllocationStaking.withdraw(
            0,
            amount,
            1,
            sigExp,
            signWithdrawal(deployer.address, 0, amount, 1, sigExp)
        );

        // When
        await expect(AllocationStaking.withdraw(
            0,
            amount,
            1,
            sigExp,
            signWithdrawal(deployer.address, 0, amount, 1, sigExp)
        )).to.be.revertedWith("Nonce already used.");
      });

      it("Should now withdraw user's deposit, with used signature", async function() {
        // Given
        await baseSetupTwoPools();
        const poolBefore = await AllocationStaking.poolInfo(0);
        const balanceBefore = await XavaLP1.balanceOf(deployer.address);

        const amount = takeFeeFromDeposit(DEFAULT_DEPOSIT);

        // When
        await AllocationStaking.withdraw(
            0,
            amount,
            1,
            sigExp,
            signWithdrawal(deployer.address, 0, amount, 1, sigExp)
        );

        // When
        await expect(AllocationStaking.withdraw(
            0,
            amount,
            2,
            sigExp,
            signWithdrawal(deployer.address, 0, amount, 1, sigExp)
        )).to.be.revertedWith('Signature already used.');
      });

      it("Should withdraw part of user's deposit", async function() {
        // Given
        await baseSetupTwoPools();
        const balanceBefore = await XavaLP1.balanceOf(deployer.address);

        // When
        const amount = takeFeeFromDeposit(DEFAULT_DEPOSIT) / 2;

        await AllocationStaking.withdraw(
            0,
            amount,
            1,
            sigExp,
            signWithdrawal(deployer.address, 0, amount, 1, sigExp)
        );

        // Then
        const balanceAfter = await XavaLP1.balanceOf(deployer.address);
        expect(balanceAfter).to.equal(balanceBefore.add(takeFeeFromDeposit(DEFAULT_DEPOSIT) / 2));
      });

      it("Should not withdraw more than user's deposit", async function() {
        // Given
        await baseSetupTwoPools();

        const amount = takeFeeFromDeposit(DEFAULT_DEPOSIT) * 2;

        // Then
        await expect(AllocationStaking.withdraw(
            0,
            amount,
            1,
            sigExp,
            signWithdrawal(deployer.address, 0, amount, 1, sigExp)
        )).to.be.revertedWith("withdraw: can't withdraw more than deposit");
      });

      it("Should transfer user's ERC20 share", async function() {
        // Given
        await baseSetupTwoPools();

        // When
        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        await ethers.provider.send("evm_increaseTime", [END_TIMESTAMP_DELTA]);
        await ethers.provider.send("evm_mine");

        const pendingBefore = await AllocationStaking.pending(0, deployer.address);
        const balanceERC20Before = await XavaToken.balanceOf(deployer.address);

        const amount = takeFeeFromDeposit(DEFAULT_DEPOSIT);

        await AllocationStaking.withdraw(
            0,
            amount,
            1,
            sigExp,
            signWithdrawal(deployer.address, 0, amount, 1, sigExp)
        );

        // Then
        const pendingAfter = await AllocationStaking.pending(0, deployer.address);
        const balanceERC20After = await XavaToken.balanceOf(deployer.address);

        expect(balanceERC20After).to.equal(balanceERC20Before.add(pendingBefore));
        expect(pendingAfter).to.equal(0);
        expect(await AllocationStaking.paidOut()).to.equal(pendingBefore);
      });

      it("Should emit Withdraw event", async function() {
        // Given
        await baseSetupTwoPools();

        const amount = takeFeeFromDeposit(DEFAULT_DEPOSIT);

        // Then
        await expect(AllocationStaking.withdraw(
            0,
            amount,
            1,
            sigExp,
            signWithdrawal(deployer.address, 0, amount, 1, sigExp)
        )).to.emit(AllocationStaking, "Withdraw").withArgs(deployer.address, 0, takeFeeFromDeposit(DEFAULT_DEPOSIT));
      });

      it("Should get withdraw fee", async function () {
        // Given
        await baseSetupTwoPools();

        //TODO: get to call getWithdrawFeeInternal

        // Then
        const fees = await AllocationStaking.getWithdrawFee(deployer.address, takeFeeFromDeposit((DEFAULT_DEPOSIT)), 0);
        console.log(fees[0], fees[1]);
      });
    });

    xdescribe("emergencyWithdraw", async function() {
      it("Should withdraw user's deposit only", async function() {
        // Given
        await baseSetupTwoPools();
        const poolBefore = await AllocationStaking.poolInfo(0);
        const balanceLPBefore = await XavaLP1.balanceOf(deployer.address);
        const balanceERC20Before = await XavaToken.balanceOf(deployer.address);

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        await ethers.provider.send("evm_increaseTime", [END_TIMESTAMP_DELTA]);
        await ethers.provider.send("evm_mine");

        // When
        await AllocationStaking.emergencyWithdraw(0);

        // Then
        const poolAfter = await AllocationStaking.poolInfo(0)
        const balanceLPAfter = await XavaLP1.balanceOf(deployer.address);
        const balanceERC20After = await XavaToken.balanceOf(deployer.address);
        expect(balanceLPAfter).to.equal(balanceLPBefore.add(takeFeeFromDeposit(DEFAULT_DEPOSIT)));
        expect(balanceERC20After).to.equal(balanceERC20Before);
      });

      it("Should update pool's total deposit", async function() {
        // Given
        await baseSetupTwoPools();
        const poolBefore = await AllocationStaking.poolInfo(0);

        await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 50]);
        await ethers.provider.send("evm_mine");

        await ethers.provider.send("evm_increaseTime", [END_TIMESTAMP_DELTA]);
        await ethers.provider.send("evm_mine");

        // When
        await AllocationStaking.emergencyWithdraw(0);

        // Then
        const poolAfter = await AllocationStaking.poolInfo(0)
        expect(poolBefore.totalDeposits).to.equal(takeFeeFromDeposit(DEFAULT_DEPOSIT));
        expect(poolAfter.totalDeposits).to.equal(0);
      });

      it("Should emit EmergencyWithdraw event", async function() {
        // Given
        await baseSetupTwoPools();

        // Then
        await expect(AllocationStaking.emergencyWithdraw(0))
            .to.emit(AllocationStaking, "EmergencyWithdraw").withArgs(deployer.address, 0, takeFeeFromDeposit(DEFAULT_DEPOSIT));
      });

      it("Should reset user's amount and debt to 0", async function() {
        // Given
        await baseSetupTwoPools();

        // When
        await AllocationStaking.emergencyWithdraw(0);

        // Then
        const user = await AllocationStaking.userInfo(0, deployer.address);
        expect(user.amount).to.equal(0);
        expect(user.rewardDebt).to.equal(0);
      });
    });
  });

  describe("Compound", function () {
    it("Should compound", async function() {
      // Given
      await baseSetupTwoPools();

      await ethers.provider.send("evm_increaseTime", [START_TIMESTAMP_DELTA + 10]);
      await ethers.provider.send("evm_mine");

      const userInfo = await AllocationStaking.userInfo(0, deployer.address);
      // console.log(BigInt(userInfo[0]))

      // console.log(BigInt(parseInt(await AllocationStaking.pending("0", deployer.address))));

      expect(await AllocationStaking.compound(0)).to.emit(AllocationStaking, "CompoundedEarnings");
    });
  });

  xcontext("General", async function() {
    it("Should allow deposits", async function() {
      // Given
      await XavaToken.approve(AllocationStaking.address, TOKENS_TO_ADD);
      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, false);
      await AllocationStaking.fund(TOKENS_TO_ADD);

      let stakingContractBalanceBefore = await XavaToken.balanceOf(AllocationStaking.address);
      await XavaToken.transfer(alice.address, TOKENS_TO_SEND);
      await XavaToken.connect(alice).approve(AllocationStaking.address, TOKENS_TO_SEND);

      // When
      await AllocationStaking.connect(alice).deposit("0", TOKENS_TO_SEND);

      // Then
      let aliceBalanceAfter = await XavaToken.balanceOf(alice.address);
      let stakingContractBalanceAfter = await XavaToken.balanceOf(AllocationStaking.address);
      let aliceUserInfo = await AllocationStaking.userInfo("0", alice.address);
      let alicePending = await AllocationStaking.pending("0", alice.address);

      expect(stakingContractBalanceAfter.sub(stakingContractBalanceBefore)).to.equal(TOKENS_TO_SEND);
      expect(aliceBalanceAfter).to.equal(0);
      expect(aliceUserInfo.amount).to.equal(TOKENS_TO_SEND);
      expect(aliceUserInfo.rewardDebt).to.equal(0);
      expect(alicePending).to.equal(0);
    });

    xit("Should pay rewards over time", async function() {

      // fund
      const TOKENS_TO_ADD = ethers.utils.parseUnits("100000");
      const ALLOC_POINT = 1000;
      const DEPOSIT_FEE = 100;
      let rewardPerSecond = await AllocationStaking.rewardPerSecond();

      await XavaToken.approve(AllocationStaking.address, TOKENS_TO_ADD);
      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, false);
      await AllocationStaking.fund(TOKENS_TO_ADD);

      // deposit
      const TOKENS_TO_SEND = ethers.utils.parseUnits("1000");

      await XavaToken.transfer(alice.address, TOKENS_TO_SEND);
      await XavaToken.connect(alice).approve(AllocationStaking.address, TOKENS_TO_SEND);
      await AllocationStaking.connect(alice).deposit("0", TOKENS_TO_SEND);

      // test
      let startTimestamp = await AllocationStaking.startTimestamp();
      const DURATION = 600;
      await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTimestamp) + DURATION]);
      await ethers.provider.send("evm_mine");

      let aliceUserInfo = await AllocationStaking.userInfo("0", alice.address);
      let alicePending = await AllocationStaking.pending("0", alice.address);

      expect(aliceUserInfo.amount).to.equal(TOKENS_TO_SEND);
      expect(aliceUserInfo.rewardDebt).to.equal(0);
      expect(alicePending).to.equal(rewardPerSecond.mul(DURATION));
    });

    xit("Should pay rewards immediately after a burn", async function () {
      const { timestamp } = await ethers.provider.getBlock('latest');

      // fund
      const TOKENS_TO_ADD = ethers.utils.parseUnits("100000");
      const ALLOC_POINT = 1000;
      const DEPOSIT_FEE = 100;
      let rewardPerSecond = await AllocationStaking.rewardPerSecond();

      await XavaToken.approve(AllocationStaking.address, TOKENS_TO_ADD);
      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, false);
      await AllocationStaking.fund(TOKENS_TO_ADD);

      // deposit
      const TOKENS_TO_SEND = ethers.utils.parseUnits("1000");

      await XavaToken.transfer(alice.address, TOKENS_TO_SEND);
      await XavaToken.transfer(bob.address, TOKENS_TO_SEND);
      await XavaToken.connect(alice).approve(AllocationStaking.address, TOKENS_TO_SEND);
      await XavaToken.connect(bob).approve(AllocationStaking.address, TOKENS_TO_SEND);
      await AllocationStaking.connect(alice).deposit("0", TOKENS_TO_SEND);
      await AllocationStaking.connect(bob).deposit("0", TOKENS_TO_SEND);

      // test
      let startTimestamp = await AllocationStaking.startTimestamp();
      const DURATION = 600;
      await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTimestamp) + DURATION]);
      await ethers.provider.send("evm_mine");

      let aliceUserInfo = await AllocationStaking.userInfo("0", alice.address);
      let bobUserInfo = await AllocationStaking.userInfo("0", bob.address);
      let alicePending = await AllocationStaking.pending("0", alice.address);
      let bobPending = await AllocationStaking.pending("0", bob.address);
      let poolInfo = await AllocationStaking.poolInfo("0");

      expect(aliceUserInfo.amount).to.equal(bobUserInfo.amount);
      expect(aliceUserInfo.rewardDebt).to.equal(bobUserInfo.rewardDebt);
      expect(alicePending).to.equal(bobPending);
      expect(alicePending).to.equal(rewardPerSecond.mul(DURATION).div(2));
      expect(poolInfo.totalDeposits).to.equal(TOKENS_TO_SEND.mul(2));

      const AMOUNT_TO_BURN = bobUserInfo.amount.div(10);
      await AllocationStaking.burnXavaFromUser("0", bob.address, AMOUNT_TO_BURN);

      await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTimestamp) + DURATION * 2]);
      await ethers.provider.send("evm_mine");

      let aliceUserInfoAfter = await AllocationStaking.userInfo("0", alice.address);
      let bobUserInfoAfter = await AllocationStaking.userInfo("0", bob.address);
      let alicePendingAfter = await AllocationStaking.pending("0", alice.address);
      let bobPendingAfter = await AllocationStaking.pending("0", bob.address);
      let poolInfoAfter = await AllocationStaking.poolInfo("0");

      expect(poolInfoAfter.accERC20PerShare).to.equal(poolInfo.accERC20PerShare.add(
          AMOUNT_TO_BURN.add(rewardPerSecond.mul(poolInfoAfter.lastRewardTimestamp.sub(poolInfo.lastRewardTimestamp)))
              .mul(ethers.utils.parseUnits("1")).mul(ethers.utils.parseUnits("1"))
              .div(poolInfoAfter.totalDeposits))
      );
      expect(poolInfoAfter.totalDeposits).to.equal(poolInfo.totalDeposits.sub(AMOUNT_TO_BURN));

      expect(aliceUserInfoAfter.amount).to.equal(aliceUserInfo.amount);
      expect(bobUserInfoAfter.amount).to.equal(bobUserInfo.amount.sub(AMOUNT_TO_BURN));
      expect(aliceUserInfoAfter.rewardDebt).to.equal(aliceUserInfo.rewardDebt);
      expect(bobUserInfoAfter.rewardDebt).to.equal(bobUserInfo.rewardDebt);
      // expect(alicePendingAfter).to.equal(
      //   alicePending
      //   .add(AMOUNT_TO_BURN.mul(10).div(19))
      //   .add(rewardPerSecond.mul(poolInfoAfter.lastRewardTimestamp.sub(poolInfo.lastRewardTimestamp)).mul(10).div(19))
      // );
      // expect(bobPendingAfter).to.equal(
      //   bobPending
      //   .add(AMOUNT_TO_BURN.mul(9).div(19))
      //   .add(rewardPerSecond.mul(poolInfoAfter.lastRewardTimestamp.sub(poolInfo.lastRewardTimestamp)).mul(9).div(19))
      // );

      await AllocationStaking.burnXavaFromUser("0", alice.address, AMOUNT_TO_BURN);

      await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTimestamp) + DURATION * 3]);
      await ethers.provider.send("evm_mine");

      let aliceUserInfoAfter2 = await AllocationStaking.userInfo("0", alice.address);
      let bobUserInfoAfter2 = await AllocationStaking.userInfo("0", bob.address);
      let alicePendingAfter2 = await AllocationStaking.pending("0", alice.address);
      let bobPendingAfter2 = await AllocationStaking.pending("0", bob.address);
      let poolInfoAfter2 = await AllocationStaking.poolInfo("0");

      expect(aliceUserInfoAfter2.amount).to.equal(bobUserInfoAfter2.amount);
      expect(aliceUserInfoAfter2.rewardDebt).to.equal(bobUserInfoAfter2.rewardDebt);
      expect(alicePendingAfter2).to.equal(bobPendingAfter2);

    });

    xit("Should take a deposit fee", async function () {
      // fund
      const TOKENS_TO_ADD = ethers.utils.parseUnits("100000");
      const ALLOC_POINT = 1000;
      const DEPOSIT_FEE = 100;
      let rewardPerSecond = await AllocationStaking.rewardPerSecond();

      await XavaToken.approve(AllocationStaking.address, TOKENS_TO_ADD);
      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, false);
      await AllocationStaking.fund(TOKENS_TO_ADD);

      // deposit
      const TOKENS_TO_SEND = ethers.utils.parseUnits("1000");

      await XavaToken.transfer(alice.address, TOKENS_TO_SEND);
      await XavaToken.connect(alice).approve(AllocationStaking.address, TOKENS_TO_SEND);
      await AllocationStaking.connect(alice).deposit("0", TOKENS_TO_SEND);

      let aliceUserInfo = await AllocationStaking.userInfo("0", alice.address);
      let poolInfo = await AllocationStaking.poolInfo("0");

      expect(poolInfo.totalDeposits).to.equal(TOKENS_TO_SEND.sub(TOKENS_TO_SEND.mul(DEPOSIT_FEE).div("10000")));
      expect(aliceUserInfo.amount).to.equal(TOKENS_TO_SEND.sub(TOKENS_TO_SEND.mul(DEPOSIT_FEE).div("10000")));
    });

    xit("Should burn if two users burn in the same block timestamp", async function () {

      // fund
      const TOKENS_TO_ADD = ethers.utils.parseUnits("100000");
      const ALLOC_POINT = 1000;
      const DEPOSIT_FEE = 100;

      await XavaToken.approve(AllocationStaking.address, TOKENS_TO_ADD);
      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, false);
      await AllocationStaking.fund(TOKENS_TO_ADD);

      // deposit
      const TOKENS_TO_SEND = ethers.utils.parseUnits("1000");

      await XavaToken.transfer(alice.address, TOKENS_TO_SEND);
      await XavaToken.connect(alice).approve(AllocationStaking.address, TOKENS_TO_SEND);
      await AllocationStaking.connect(alice).deposit("0", TOKENS_TO_SEND);
      await XavaToken.transfer(bob.address, TOKENS_TO_SEND);
      await XavaToken.connect(bob).approve(AllocationStaking.address, TOKENS_TO_SEND);
      await AllocationStaking.connect(bob).deposit("0", TOKENS_TO_SEND);

      // test
      let startTimestamp = await AllocationStaking.startTimestamp();
      await ethers.provider.send("evm_setNextBlockTimestamp", [parseInt(startTimestamp) + 10]);
      await ethers.provider.send("evm_mine");

      const AMOUNT_TO_BURN = TOKENS_TO_SEND.div(10);
      let txForAlice = await AllocationStaking.burnXavaFromUser("0", alice.address, AMOUNT_TO_BURN);
      let txForBob = await AllocationStaking.burnXavaFromUser("0", bob.address, AMOUNT_TO_BURN);
      let txReceiptForAlice = await txForAlice.wait(0);
      let txReceiptForBob = await txForBob.wait(0);

      let poolInfo = await AllocationStaking.poolInfo("0");
      expect((await ethers.provider.getBlock(txReceiptForBob.blockNumber)).timestamp).to.be.eq(parseInt(poolInfo.lastRewardTimestamp));
      expect((await ethers.provider.getBlock(txReceiptForAlice.blockNumber)).timestamp).to.eq((await ethers.provider.getBlock(txReceiptForBob.blockNumber)).timestamp);

      let aliceUserInfoAfter = await AllocationStaking.userInfo("0", alice.address);
      let bobUserInfoAfter = await AllocationStaking.userInfo("0", bob.address);
      let poolInfoAfter = await AllocationStaking.poolInfo("0");
      expect(aliceUserInfoAfter.amount).to.eq(TOKENS_TO_SEND.sub(AMOUNT_TO_BURN));
      expect(bobUserInfoAfter.amount).to.eq(TOKENS_TO_SEND.sub(AMOUNT_TO_BURN));
      expect(poolInfoAfter.totalDeposits).to.eq(TOKENS_TO_SEND.sub(AMOUNT_TO_BURN).mul(2));
    });
  });
});
