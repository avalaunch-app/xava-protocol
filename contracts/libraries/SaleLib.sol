// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/IERC20Metadata.sol";

library SaleLib {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct Sale {
        // Token being sold
        IERC20 token;
        // Is sale created
        bool isCreated;
        // Are earnings withdrawn
        bool earningsWithdrawn;
        // Is leftover withdrawn
        bool leftoverWithdrawn;
        // Have tokens been deposited
        bool tokensDeposited;
        // Address of sale owner
        address saleOwner;
        // Price of the token quoted in AVAX
        uint256 tokenPriceInAVAX;
        // Amount of tokens to sell
        uint256 amountOfTokensToSell;
        // Total tokens being sold
        uint256 totalTokensSold;
        // Total AVAX Raised
        uint256 totalAVAXRaised;
        // Sale end time
        uint256 saleEnd;
        // Price of the token quoted in USD
        uint256 tokenPriceInUSD;
        // Price update percent threshold
        uint8 updateTokenPriceInAVAXPercentageThreshold;
        // Price update time limit
        uint256 updateTokenPriceInAVAXTimeLimit;
        // Token price in AVAX latest update timestamp
        // uint256 updateTokenPriceInAVAXLastCallTimestamp;
    }

    function deposit(Sale storage sale) public {
        // Require that setSaleParams was called
        require(sale.amountOfTokensToSell > 0, "Sale parameters not set.");

        // Require that tokens are not deposited
        require(!sale.tokensDeposited, "Tokens already deposited.");

        // Mark that tokens are deposited
        sale.tokensDeposited = true;

        // Perform safe transfer
        sale.token.safeTransferFrom(msg.sender, address(this), sale.amountOfTokensToSell);
    }

    function setParams(
        Sale storage sale,
        address _token,
        address _saleOwner,
        uint256 _tokenPriceInAVAX,
        uint256 _amountOfTokensToSell,
        uint256 _saleEnd,
        uint256 _stakingRoundId,
        uint256 _tokenPriceInUSD
    ) public {
        require(!sale.isCreated, "setSaleParams: Sale is already created.");
        require(_saleOwner != address(0), "setSaleParams: Sale owner address can not be 0.");
        require(
            _tokenPriceInAVAX != 0 && _amountOfTokensToSell != 0 && _saleEnd > block.timestamp && _tokenPriceInUSD != 0,
            "setSaleParams: Bad input"
        );
        require(_stakingRoundId > 0, "Staking round ID can not be 0.");

        // Set params
        sale.token = IERC20(_token);
        sale.isCreated = true;
        sale.saleOwner = _saleOwner;
        sale.tokenPriceInAVAX = _tokenPriceInAVAX;
        sale.amountOfTokensToSell = _amountOfTokensToSell;
        sale.saleEnd = _saleEnd;
        sale.tokenPriceInUSD = _tokenPriceInUSD;
    }

    function setToken(Sale storage sale, address saleToken) public {
        sale.token = IERC20(saleToken);
    }

    function purchase(
        Sale storage sale,
        uint256 amountAVAX,
        uint256 amount
    ) public returns (uint256) {
        // Compute the amount of tokens user is buying
        uint256 amountOfTokensBuying = (amountAVAX)
            .mul(uint256(10)**IERC20Metadata(address(sale.token)).decimals())
            .div(sale.tokenPriceInAVAX);

        // Must buy more than 0 tokens
        require(amountOfTokensBuying > 0, "Can't buy 0 tokens");

        // Check in terms of user allo
        require(amountOfTokensBuying <= amount, "Trying to buy more than allowed.");

        // Require that amountOfTokensBuying is less than sale token leftover cap
        require(
            amountOfTokensBuying <= sale.amountOfTokensToSell.sub(sale.totalTokensSold),
            "Trying to buy more than contract has."
        );

        sale.totalTokensSold = sale.totalTokensSold.add(amountOfTokensBuying);

        // Increase amount of AVAX raised
        sale.totalAVAXRaised = sale.totalAVAXRaised.add(amountAVAX);

        return amountOfTokensBuying;
    }

    function updateTokenPrice(
        Sale storage sale,
        uint256 price,
        uint256 updateTokenPriceInAVAXLastCallTimestamp
    ) public returns (uint256) {
        if (sale.tokenPriceInAVAX != 0) {
            // Require that function params are properly set
            require(
                sale.updateTokenPriceInAVAXTimeLimit != 0 && sale.updateTokenPriceInAVAXPercentageThreshold != 0,
                "Function params not set."
            );

            // Require that the price does not differ more than 'N%' from previous one
            uint256 maxPriceChange = sale.tokenPriceInAVAX.mul(sale.updateTokenPriceInAVAXPercentageThreshold).div(100);
            require(
                price < sale.tokenPriceInAVAX.add(maxPriceChange) && price > sale.tokenPriceInAVAX.sub(maxPriceChange),
                "Price differs too much from the previous."
            );

            // Require that 'N' time has passed since last call
            require(
                updateTokenPriceInAVAXLastCallTimestamp.add(sale.updateTokenPriceInAVAXTimeLimit) < block.timestamp,
                "Not enough time passed since last call."
            );
        }

        // Allowing oracle to run and change the sale value
        sale.tokenPriceInAVAX = price;
    }

    function setUpdateTokenPriceParams(
        Sale storage sale,
        uint8 _updateTokenPriceInAVAXPercentageThreshold,
        uint256 _updateTokenPriceInAVAXTimeLimit
    ) public returns (uint256) {
        // Require that arguments don't equal zero
        require(
            _updateTokenPriceInAVAXTimeLimit != 0 && _updateTokenPriceInAVAXPercentageThreshold != 0,
            "Cannot set zero value."
        );
        // Require that percentage threshold is less or equal 100%
        require(_updateTokenPriceInAVAXPercentageThreshold <= 100, "Percentage threshold cannot be higher than 100%");
        // Set new values
        sale.updateTokenPriceInAVAXPercentageThreshold = _updateTokenPriceInAVAXPercentageThreshold;
        sale.updateTokenPriceInAVAXTimeLimit = _updateTokenPriceInAVAXTimeLimit;
    }

    function withdrawLeftover(Sale storage sale) public {
        // Make sure sale ended
        require(block.timestamp >= sale.saleEnd);

        // Make sure owner can't withdraw twice
        require(!sale.leftoverWithdrawn);
        sale.leftoverWithdrawn = true;

        // Amount of tokens which are not sold
        uint256 leftover = sale.amountOfTokensToSell.sub(sale.totalTokensSold);

        if (leftover > 0) {
            sale.token.safeTransfer(msg.sender, leftover);
        }
    }

    function performChecksToCloseGate(Sale storage sale) public view {
        // Require that sale is created
        require(sale.isCreated, "closeGate: Sale not created.");
        // Require that sale token is set
        require(address(sale.token) != address(0), "closeGate: Token not set.");
        // Require that tokens were deposited
        require(sale.tokensDeposited, "closeGate: Tokens not deposited.");
        // Require that token price updating params are set
        require(
            sale.updateTokenPriceInAVAXPercentageThreshold != 0 && sale.updateTokenPriceInAVAXTimeLimit != 0,
            "closeGate: Params for updateTokenPriceInAvax not set."
        );
    }

    function setEarningsWithdrawn(Sale storage sale) public returns (uint256) {
        // Make sure sale ended
        require(block.timestamp >= sale.saleEnd);
        // Make sure owner can't withdraw twice
        require(!sale.earningsWithdrawn);
        sale.earningsWithdrawn = true;
        // Earnings amount of the owner in AVAX
        return sale.totalAVAXRaised;
    }

    function removeStuckTokens(
        Sale storage sale,
        address token,
        address beneficiary
    ) public {
        // Require that token address does not match with sale token
        require(token != address(sale.token), "Cannot withdraw official sale token.");
        // Safe transfer token from sale contract to beneficiary
        IERC20(token).safeTransfer(beneficiary, IERC20(token).balanceOf(address(this)));
    }

    function transferAVAX(address to, uint256 value) public {
        (bool success, ) = to.call{ value: value }(new bytes(0));
        require(success);
    }
}
