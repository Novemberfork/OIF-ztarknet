# OIF-Starknet

This repo is a fork, below is the original codebase's README, see [ZTARKNET.md](/ZTARKNET.md) for more details.

A Starknet implementation of the [Open Intents Framework](https://github.com/BootNodeDev/intents-framework/tree/main).

## Overview

This project extends the above repo to support cross-chain order filling between EVM chains and Starknet using the Hyperlane protocol (in Golang instead of Typescript).

## Project Structure

- `solidity/`: Copy of [Open Intent Framework](https://github.com/BootNodeDev/intents-framework/tree/main) Solidity contracts
- `cairo/`: Starknet translation of Solidity contracts
- `solver/`: Hyperlane intent solver implementation - [See detailed README](solver/README.md)

## Documentation

- **Go Solver Implementation**: [solver/README.md](solver/README.md) - Detailed architecture, setup, and development guide
- **Testing Commands**: Run `make help` for complete command reference

## License

Apache-2.0
