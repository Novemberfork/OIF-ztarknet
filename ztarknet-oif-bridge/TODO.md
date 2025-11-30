# Starknet OIF Bridge - TODO List

## Completed ✅

- [x] Install Starknet dependencies (starknet, @starknet-react/core, @starknet-react/chains)
- [x] Configure TypeScript path aliases in tsconfig
- [x] Update vite.config.ts with path aliases
- [x] Setup Starknet provider in main.tsx
- [x] Create wallet connection components
  - [x] WalletButton.tsx
  - [x] AccountDisplay.tsx
  - [x] NetworkSwitcher.tsx
- [x] Create chain and contract configuration files
  - [x] src/config/chains.ts
  - [x] src/config/contracts.ts
  - [x] src/types/contracts.ts
- [x] Create placeholder ABIs for contracts
  - [x] src/abis/ERC20.json
- [x] Create contract interaction hooks
  - [x] src/hooks/useERC20.ts
  - [x] src/hooks/useTransactionStatus.ts

## In Progress 🚧

None currently

## Pending 📋

### Phase 6: Bridge UI Components
- [ ] Create IntentForm component (src/components/bridge/IntentForm.tsx)
  - [ ] Destination chain selector
  - [ ] Amount input with balance display
  - [ ] Recipient address input
  - [ ] Submit button with loading states
- [ ] Create TransactionStatus component (src/components/bridge/TransactionStatus.tsx)
  - [ ] Transaction hash display
  - [ ] Status indicator (pending/success/failed)
  - [ ] Link to block explorer
  - [ ] Close button
- [ ] Update App.tsx to include bridge form

### Phase 7: Styling & Polish
- [ ] Add basic styling to bridge components
- [ ] Create .env.example file
- [ ] Add environment variables for contract addresses
- [ ] Update config files to use env vars

### Phase 8: Testing & Validation
- [ ] Test wallet connection (Argent X, Braavos)
- [ ] Test network switching
- [ ] Verify balance displays correctly
- [ ] Test form validation
- [ ] Test transaction submission flow

### Phase 9: Contract Integration
- [ ] Get deployed Hyperlane7683 contract addresses from /cairo/ deployment
- [ ] Update src/config/contracts.ts with real addresses
- [ ] Extract full Cairo contract ABIs
  - [ ] Hyperlane7683.json
  - [ ] Permit2.json
- [ ] Create useHyperlane7683 hook for intent submission
- [ ] Test contract interactions on Sepolia testnet

### Phase 10: Documentation & Deployment
- [ ] Create README.md with setup instructions
- [ ] Document environment variables
- [ ] Test production build
- [ ] Deploy to Vercel/Netlify
- [ ] Verify deployed app works

## Notes

### Stack
- **starknet.js**: v8.9.1
- **@starknet-react/core**: v5.0.3 (includes built-in connectors)
- **@starknet-react/chains**: v5.0.3
- **React**: v18.3.1

### TODOs in Code
Search for `TODO:` comments in the codebase:
- `src/main.tsx`: Update ztarknet chain ID
- `src/config/contracts.ts`: Fill in deployed contract addresses
- Contract ABIs need to be extracted from Cairo deployments

### Next Steps
1. Get deployed contract addresses from `/cairo/` directory
2. Build bridge UI components (Phase 6)
3. Test wallet connection and basic flow
4. Submit first test transaction on Sepolia
