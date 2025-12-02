# OIF-Ztarknet

This project forks Nethermind's [OIF-starknet](https://github.com/NethermindEth/OIF-starknet) to add support for Ztarknet. 

# Demo 

A demo of this application is hosted [here](https://oif-demo.novemberfork.io/).

## What is supported? 

This demo allows anyone to create a cross-chain intent (basic bridge order) on an origin chain and have it filled on a desired destination chain. 4 EVM and 2 **CairoVM** networks are supported (Sepolia: Ethereum, Base, Arbitrum, Optimism, **Starknet**, and **Ztarknet**), and orders can go any direction (origin and destination chains must be different, i.e, Ethereum -> Base is valid, but Ethereum -> Ethereum is not). All order paths can be filled (ZK<>EVM<>STRK<>ZK).

Orders are filled on destination chains as soon as they are detected on origin chains. This means when Alice opens an order on Starknet, it will be filled almost immediately.

For simplicity, this demo only bridges "Dog Coins"; however, the protocol is capable of bridging any input token for any output token (allowing for cross-chain-bridge-swaps). Each Dog Coin contract (ERC-20) exposes a public mint function, you will need Dog Coins on the origin chain you are bridging from (the UI can assist with this as well).

#### Dog Coin Addresses (Sepolia)

- [Ethereum](https://sepolia.etherscan.io/address/0x76878654a2D96dDdF8cF0CFe8FA608aB4CE0D499#writeContract#F4)
- [Arbitrum](https://sepolia.arbiscan.io/address/0x1083B934AbB0be83AaE6579c6D5FD974D94e8EA5#writeContract#F4)
- [Base](https://sepolia.basescan.org/address/0xB844EEd1581f3fB810FFb6Dd6C5E30C049cF23F4#writeContract#F4)
- [Optimism](https://sepolia-optimism.etherscan.io/address/0xe2f9C9ECAB8ae246455be4810Cac8fC7C5009150#writeContract#F4)
- [Starknet](https://sepolia.voyager.online/contract/0x0312be4cb8416dda9e192d7b4d42520e3365f71414aefad7ccd837595125f503#writeContract)
- [Ztarknet](https://explorer-zstarknet.d.karnot.xyz/contract/0x067c9b63ecb6a191e369a461ab05cf9a4d08093129e5ac8eedb71d4908e4cc5b#writeContract)

## OIF Overview 

OIF (Open Intent Framework) allows Alice to open an intent on an origin chain, and have it filled on the destination chain. An example intent is bridging a token or bridge-swapping a token. 

Intent-based bridges usually allow for faster bridging (for end users) compared to traditional bridges. In a traditional bridge Alice will lock tokens into a contract on the origin chain, then she waits for the origin chain to send a message to the destination chain, then finally, the tokens are sent to her on the destination chain. This process can sometimes take several minutes to a few hours, depending on the inter-chain messaging setup. 

Instead of waiting for the inter-chain message, Alice could receive her tokens almost immediately using intents. Another party, say Bob (the solver/anyone) could send Alice her desired tokens on the destination chain right after she locks the input tokens into the origin chain contract. He can then collect his profits after the fact. Hyperlane7683 manages the logic of opening, filling, and settling intents ([eip-7683](https://eips.ethereum.org/EIPS/eip-7683)).

### Flow 

- Alice opens an order on the origin chain (EVM or CairoVM). This will lock the input token into the Hyperlane7683 contract (on the origin chain). She specifies things like:
	- The destination chain (EVM or CairoVM)
	- The origin token she’s inputting
	- The destination token she wants outputted
	- Amounts, timelines, etc. 
- Bob (the solver) listens for order opened events and decides if he wants to fill them (i.e will he net any profit after txn fees? If it’s a bridge-swap, is the trade logical/profitable?)
- If the intent is worth it, Bob (or anyone) will proceed with filling it. This will send Alice’s desired tokens to her on the destination chain (from Bob). 
- After the necessary calls/Hyperlane messaging, the settlement can be dispatched to Bob (the filler). This is how Bob receives the tokens Alice locked originally. 

> **NOTE**: The `fill()` call on the destination chain can only be called once. After filling the order, anyone can start the settlement dispatchment through Hyperlane (releasing the input tokens to the filler) 

> **NOTE**: Alice receives her desired tokens on the destination chain as soon as the order is filled; however, Bob will have some latency in the retrieval of his profits (there is some time required for the Hyperlane messaging, plus it usually makes more sense for Bob to dispatch settlements in batches rather than individually). 

## What is not supported?

- Bob (the solver) is not able to collect his profits in this PoC. In order for him to do so, the hyperlane protocol/stack (not just the Hyperlane7683 contract) needs to be deployed onto Ztarknet. The good news is that we are running a solver for this demo, so as long as it stays funded, it should keep filling orders.
