// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";

library VestingLib {
    using SafeMath for uint256;

    struct VestingConfig {
        // Times when portions are getting unlocked
        uint256[] vestingPortionsUnlockTime;
        // Percent of the participation user can withdraw
        uint256[] vestingPercentPerPortion;
        //Precision for percent for portion vesting
        uint256 portionVestingPrecision;
        // Max vesting time shift
        uint256 maxVestingTimeShift;
    }

    /// @notice  If sale supports early withdrawals to Dexalot.
    function setParams(
        VestingConfig storage vestingConfig,
        uint256[] memory _unlockingTimes,
        uint256[] memory _percents,
        uint256 _maxVestingTimeShift,
        uint256 saleEndTime
    ) external {
        require(
            vestingConfig.vestingPercentPerPortion.length == 0 && vestingConfig.vestingPortionsUnlockTime.length == 0
        );
        require(_unlockingTimes.length == _percents.length);
        require(vestingConfig.portionVestingPrecision > 0, "Safeguard for making sure setSaleParams get first called.");
        require(_maxVestingTimeShift <= 30 days, "Maximal shift is 30 days.");

        // Set max vesting time shift
        vestingConfig.maxVestingTimeShift = _maxVestingTimeShift;

        uint256 sum;

        // Require that locking times are later than sale end
        require(_unlockingTimes[0] > saleEndTime, "Unlock time must be after the sale ends.");

        // Set vesting portions percents and unlock times
        for (uint256 i = 0; i < _unlockingTimes.length; i++) {
            if (i > 0) {
                require(_unlockingTimes[i] > _unlockingTimes[i - 1], "Unlock time must be greater than previous.");
            }
            vestingConfig.vestingPortionsUnlockTime.push(_unlockingTimes[i]);
            vestingConfig.vestingPercentPerPortion.push(_percents[i]);
            sum = sum.add(_percents[i]);
        }

        require(sum == vestingConfig.portionVestingPrecision, "Percent distribution issue.");
    }

    function shiftUnlockingTimes(VestingConfig storage vestingConfig, uint256 timeToShift) external {
        require(
            timeToShift > 0 && timeToShift < vestingConfig.maxVestingTimeShift,
            "Shift must be nonzero and smaller than maxVestingTimeShift."
        );
        // Time can be shifted only once.
        vestingConfig.maxVestingTimeShift = 0;
        // Shift the unlock time
        for (uint256 i = 0; i < vestingConfig.vestingPortionsUnlockTime.length; i++) {
            vestingConfig.vestingPortionsUnlockTime[i] = vestingConfig.vestingPortionsUnlockTime[i].add(timeToShift);
        }
    }

    function setPrecision(VestingConfig storage vestingConfig, uint256 _portionVestingPrecision) external {
        require(_portionVestingPrecision >= 100, "Should be at least 100");
        vestingConfig.portionVestingPrecision = _portionVestingPrecision;
    }
}
