# OIF-Ztarknet

This project forks Nethermind's [OIF-starknet](https://github.com/NethermindEth/OIF-starknet) to add support for Ztarknet. 

## Todos

- [x] targets to create all order types 

- [ ] UI

- [ ] project description/disclaimer

## What is supported? 

- Alice is able to lock tokens into the input chain and receive tokens on the destination chain for all order paths (ZTRK<>EVM<>STRK<>ZKRK). 

## What is not supported?

- Bob (the solver) is not able to collect his profits in this PoC. In order for him to do so, the hyperlane protocol/stack (not just the Hyperlane7683 contract) needs to be deployed onto Ztarknet.

## OIF Overview 

OIF (Open Intent Framework) allows Alice to open an intent on an origin chain, and have it filled on the destination chain. An example intent is bridging a token or bridge-swapping a token. 

Intent-based bridges usually allows for faster bridging (for end users) compared to traditional bridges. In a traditional bridge Alice will lock tokens into a contract on the origin chain, then she waits for the origin chain to send a message to the destination chain, then finally, the tokens are sent to her on the destination chain. This process can sometimes take up to several minutes to a few hours depending on the inter-chain messaging setup. 

Instead of waiting for the inter-chain message, Alice could receive her tokens almost immediately using intents. Another party, say Bob (the solver/anyone) could send Alice her desired tokens on the destination chain right after she locks the input tokens into the origin chain contract. He can then collect his profits after the fact. Hyperlane7683 manages the logic of opening, filling, and settling bridge and bridge swap intents ([eip-7683](https://eips.ethereum.org/EIPS/eip-7683))

### Flow 

- Alice opens an order on the origin chain (EVM or CairoVM). This will lock the input token into the Hyperlane7683 contract (on the origin chain). She specifies things like:
	- The destination chain (EVM or CairoVM)
	- The origin token she’s inputting
	- The destination token she wants outputted
	- Amounts, timelines, etc. 
- Bob (the solver) listens for order opened events and decides if he wants to fill them (i.e will he net any profit after txn fees? If it’s a bridge swap, is the trade logical/profitable?)
- If the intent is worth it, Bob (or anyone) will proceed with filling it. This will send Alice’s desired tokens to her on the destination chain (from Bob). 
- After the necessary calls/hyperlane messaging, the settlement can be dispatched to Bob (the filler). This is how Bob receives the tokens Alice locked originally. 

> **NOTE**: The `fill()` call on the destination chain can only be called once. After filling the order, anyone can start the settlement dispatchment through hyperlane (releasing the input tokens to the filler) 

> **NOTE**: Alice receives her desired tokens on the destination chain as soon as the order is filled; however, Bob will have some latency in the retrieval of his profits (there is some time required for the hyperlane messaging, plus it usually makes more sense for Bob to dispatch settlements in batches rather than individually). 


