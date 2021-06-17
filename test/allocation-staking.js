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

      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, false);

      let poolLength = await AllocationStaking.poolLength();
      let totalAllocPoint = await AllocationStaking.totalAllocPoint();

      expect(poolLength).to.equal(1);
      expect(totalAllocPoint).to.equal(ALLOC_POINT);
    })

    it("Should fund the farm successfully", async function() {
      const TOKENS_TO_ADD = ethers.utils.parseUnits("100000");
      const ALLOC_POINT = 1000;

      let deployerBalanceBefore = await XavaToken.balanceOf(deployer.address);
      let rewardPerSecond = await AllocationStaking.rewardPerSecond();
      let startTimestamp = await AllocationStaking.startTimestamp();

      await XavaToken.approve(AllocationStaking.address, TOKENS_TO_ADD);
      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, false);
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
    it("Should allow deposits", async function() {

      // fund
      const TOKENS_TO_ADD = ethers.utils.parseUnits("100000");
      const ALLOC_POINT = 1000;

      await XavaToken.approve(AllocationStaking.address, TOKENS_TO_ADD);
      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, false);
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

      expect(stakingContractBalanceAfter.sub(stakingContractBalanceBefore)).to.equal(TOKENS_TO_SEND);
      expect(aliceBalanceAfter).to.equal(0);
      expect(aliceUserInfo.amount).to.equal(TOKENS_TO_SEND);
      expect(aliceUserInfo.rewardDebt).to.equal(0);
    });

    xit("Should pay rewards over time", async function() {
      // todo

      // fund
      const TOKENS_TO_ADD = ethers.utils.parseUnits("100000");
      const ALLOC_POINT = 1000;

      await XavaToken.approve(AllocationStaking.address, TOKENS_TO_ADD);
      await AllocationStaking.add(ALLOC_POINT, XavaToken.address, false);
      await AllocationStaking.fund(TOKENS_TO_ADD);

      // deposit
      const TOKENS_TO_SEND = ethers.utils.parseUnits("1000");

      await XavaToken.transfer(alice.address, TOKENS_TO_SEND);
      await XavaToken.connect(alice).approve(AllocationStaking.address, TOKENS_TO_SEND);
      await AllocationStaking.connect(alice).deposit("0", TOKENS_TO_SEND);

      // test
      const { timestamp } = await ethers.provider.getBlock('latest');
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 21600]);
      await ethers.provider.send("evm_mine");


    });

    xit("Should pay rewards immediately after a burn", async function () {
      // todo
    })
  });
});
