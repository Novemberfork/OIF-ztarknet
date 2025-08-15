# 🚀 Implementation Status - Hyperlane7683 Go Solver

## ✅ COMPLETE

### **🏗️ Environment Setup**

- [x] **Network management** - Start/stop networks with logs
  - Runs local forks of eth sepolia, optimism sepolia, arbitrum sepolia, base sepolia, and starknet sepolia

### **🔍 Tools**

- [x] **Makefile** - Simplified commands for common tasks including:

  - Starting/stopping local forks

  - Initializing forks (deploying contracts, funding accounts, set allowances, etc.)

  - Opening orders

  - Running the solver

### **🏁 Milestones**

- [x] **EVM Solver** - The solver backfills and listens for new Open events on EVM networks, decodes them, and fills orders by sending transactions to the destination chain.
- [ ] **Starknet Solver** - The solver backfills and listens for new Open events on EVM networks, decodes them, and fills orders by sending transactions to the destination chain.

## 🚧 **IN PROGRESS - NEXT PRIORITY**

- [x] **Fork sepolia locally**
- [x] **Deploy Hyperlane7883**
- [x] **Open orders from Starknet**
- [ ] **Open orders to Starknet**
- [ ] **Starknet event listening**
- [ ] **Fill orders to/from Starknet**
