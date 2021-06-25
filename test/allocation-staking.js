const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("AllocationStaking", function() {

  let XavaToken;
  let AllocationStaking;
  let deployer, alice, bob;

  beforeEach(async function() {
    const accounts = await ethers.getSigners();
    deployer = accounts[0];
    alice = accounts[1];
    bob = accounts[2];
    
    const XavaTokenFactory = await ethers.getContractFactory("XavaToken");
    XavaToken = await XavaTokenFactory.deploy("Xava", "XAVA", ethers.utils.parseUnits("100000000"), 18);

    const AllocationStakingRewardsFactory = await ethers.getContractFactory("AllocationStaking");
    const rewardsPerSecond = ethers.utils.parseUnits("0.1");
    const stakingStartTime = parseInt(new Date() / 1000) + 600; // 10 minutes from now

    AllocationStaking = await AllocationStakingRewardsFactory.deploy(XavaToken.address, rewardsPerSecond, stakingStartTime);
  });

  context("Setup", async function() {
    it("Should setup the token correctly", async function() {
      let decimals = await XavaToken.decimals();
      let totalSupply = await XavaToken.totalSupply();
      let deployerBalance = await XavaToken.balanceOf(deployer.address);
  
      expect(decimals).to.equal(18);
      expect(totalSupply).to.equal(ethers.utils.parseUnits("100000000"));
      expect(totalSupply).to.equal(deployerBalance);
    });

    it("Should setup the reward contract with no pools", async function() {
      let poolLength = await AllocationStaking.poolLength();
      let rewardPerSecond = await AllocationStaking.rewardPerSecond();
      let owner = await AllocationStaking.owner();
      let totalRewards = await AllocationStaking.totalRewards();

      expect(poolLength).to.equal(0);
      expect(rewardPerSecond).to.equal(ethers.utils.parseUnits("0.1"));
      expect(owner).to.equal(deployer.address);
      expect(totalRewards).to.equal(0);
    });

    it("Should add a pool successfully", async function() {
      const ALLOC_POINT = 1000;
      const DEPOSIT_FEE = 100;

      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, DEPOSIT_FEE, false);

      let poolLength = await AllocationStaking.poolLength();
      let totalAllocPoint = await AllocationStaking.totalAllocPoint();

      expect(poolLength).to.equal(1);
      expect(totalAllocPoint).to.equal(ALLOC_POINT);
    })

    it("Should fund the farm successfully", async function() {
      const TOKENS_TO_ADD = ethers.utils.parseUnits("100000");
      const ALLOC_POINT = 1000;
      const DEPOSIT_FEE = 100;

      let deployerBalanceBefore = await XavaToken.balanceOf(deployer.address);
      let rewardPerSecond = await AllocationStaking.rewardPerSecond();
      let startTimestamp = await AllocationStaking.startTimestamp();

      await XavaToken.approve(AllocationStaking.address, TOKENS_TO_ADD);
      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, DEPOSIT_FEE, false);
      await AllocationStaking.fund(TOKENS_TO_ADD);

      let deployerBalanceAfter = await XavaToken.balanceOf(deployer.address);
      let contractBalanceAfter = await XavaToken.balanceOf(AllocationStaking.address);
      let endTimestampAfter = await AllocationStaking.endTimestamp();
      let totalRewardsAfter = await AllocationStaking.totalRewards();

      expect(deployerBalanceBefore.sub(deployerBalanceAfter)).to.equal(TOKENS_TO_ADD);
      expect(contractBalanceAfter).to.equal(TOKENS_TO_ADD);
      expect(endTimestampAfter).to.equal(startTimestamp.add(ethers.BigNumber.from(TOKENS_TO_ADD).div(rewardPerSecond)));
      expect(totalRewardsAfter).to.equal(TOKENS_TO_ADD);
    })
  });

  context("User Deposits", async function() {
    xit("Should allow deposits", async function() {

      // fund
      const TOKENS_TO_ADD = ethers.utils.parseUnits("100000");
      const ALLOC_POINT = 1000;
      const DEPOSIT_FEE = 100;

      await XavaToken.approve(AllocationStaking.address, TOKENS_TO_ADD);
      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, DEPOSIT_FEE, false);
      await AllocationStaking.fund(TOKENS_TO_ADD);

      // test
      const TOKENS_TO_SEND = ethers.utils.parseUnits("1000");

      let stakingContractBalanceBefore = await XavaToken.balanceOf(AllocationStaking.address);

      await XavaToken.transfer(alice.address, TOKENS_TO_SEND);
      await XavaToken.connect(alice).approve(AllocationStaking.address, TOKENS_TO_SEND);
      await AllocationStaking.connect(alice).deposit("0", TOKENS_TO_SEND);

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
      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, DEPOSIT_FEE, false);
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
      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, DEPOSIT_FEE, false);
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
      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, DEPOSIT_FEE, false);
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

    it("Should burn if two users burn in the same block timestamp", async function () {

      // fund
      const TOKENS_TO_ADD = ethers.utils.parseUnits("100000");
      const ALLOC_POINT = 1000;
      const DEPOSIT_FEE = 100;

      await XavaToken.approve(AllocationStaking.address, TOKENS_TO_ADD);
      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, DEPOSIT_FEE, false);
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
