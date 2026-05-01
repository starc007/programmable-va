// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {SplitForwarder} from "../src/SplitForwarder.sol";

contract DeployScript is Script {
    function run() external {
        address operator = vm.envAddress("OPERATOR_ADDRESS");
        bytes32 salt = bytes32(vm.envBytes32("REGISTRATION_SALT"));

        vm.startBroadcast();

        SplitForwarder forwarder = new SplitForwarder(operator);
        console.log("SplitForwarder deployed at:", address(forwarder));

        bytes4 mid = forwarder.register(salt);
        console.log("Registered masterId:");
        console.logBytes4(mid);

        vm.stopBroadcast();
    }
}
