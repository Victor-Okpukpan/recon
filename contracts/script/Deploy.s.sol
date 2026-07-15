// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ReconAccess} from "../src/ReconAccess.sol";

/// @notice Deploys ReconAccess to Monad testnet.
/// Run with a keystore account, e.g.:
///   forge script script/Deploy.s.sol --rpc-url monad_testnet --account monad-deployer --broadcast
/// Requires PRICE_USD_CENTS in the environment (no default — the unlock price is a
/// product decision, not something this script should guess).
contract Deploy is Script {
    // Monad testnet Pyth contract (upgraded address, per Pyth's official EVM contract list).
    address constant PYTH_TESTNET = 0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379;
    // MON/USD price feed id, Pyth Stable channel (matches PYTH_TESTNET's price sources).
    bytes32 constant MON_USD_FEED_ID = 0x31491744e2dbf6df7fcf4ac0820d18a609b49076d45066d3568424e62f686cd1;

    function run() external returns (ReconAccess recon) {
        uint256 priceUsdCents = vm.envUint("PRICE_USD_CENTS");

        vm.startBroadcast();
        recon = new ReconAccess(PYTH_TESTNET, MON_USD_FEED_ID, priceUsdCents, msg.sender);
        vm.stopBroadcast();

        console.log("ReconAccess deployed to:", address(recon));
        console.log("Owner:", msg.sender);
        console.log("Price (USD cents):", priceUsdCents);
    }
}
