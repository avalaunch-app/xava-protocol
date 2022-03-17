// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IERC20Metadata.sol";
import "../interfaces/IDexalotPortfolio.sol";

library DexalotLib {
    struct DexalotConfig {
        // Pointer to dexalot portfolio smart-contract
        IDexalotPortfolio dexalotPortfolio;
        // If Dexalot Withdrawals are supported
        bool supportsDexalotWithdraw;
        // Represent amount of seconds before 0 portion unlock users can at earliest move their tokens to dexalot
        uint256 dexalotUnlockTime;
    }

    /// @notice  If sale supports early withdrawals to Dexalot.
    function setParams(
        DexalotConfig storage dexa,
        address _dexalotPortfolio,
        uint256 _dexalotUnlockTime
    ) external {
        require(
            address(dexa.dexalotPortfolio) == address(0x0),
            "Dexalot Portfolio already set."
        );
        require(
            _dexalotPortfolio != address(0x0),
            "Cannot set zero address as Dexalot Portfolio."
        );
        dexa.dexalotPortfolio = IDexalotPortfolio(_dexalotPortfolio);
        dexa.dexalotUnlockTime = _dexalotUnlockTime;
        dexa.supportsDexalotWithdraw = true;
    }

    function performChecks(DexalotConfig storage dexa)
        external
        view
        returns (bool)
    {
        require(
            dexa.supportsDexalotWithdraw,
            "Dexalot Portfolio withdrawal not supported."
        );
        require(
            block.timestamp >= dexa.dexalotUnlockTime,
            "Dexalot Portfolio withdrawal not unlocked."
        );
    }

    function getTokenSymbolBytes32(IERC20 _token)
        external
        view
        returns (bytes32 _symbol)
    {
        // get token symbol as string memory
        string memory symbol = IERC20Metadata(address(_token)).symbol();
        // parse token symbol to bytes32 format - to fit dexalot function interface
        assembly {
            _symbol := mload(add(symbol, 32))
        }
    }
}
