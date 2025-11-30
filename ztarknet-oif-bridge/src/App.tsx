import './App.css'
import { WalletButton } from './components/wallet/WalletButton'
import { NetworkSwitcher } from './components/wallet/NetworkSwitcher'
import { BridgeForm } from './components/bridge/BridgeForm'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>zStarknet Bridge</h1>
        <div className="header-actions">
          <NetworkSwitcher />
          <WalletButton />
        </div>
      </header>

      <main className="app-main">
        <div className="bridge-card">
          <BridgeForm />
        </div>
      </main>

      <footer className="app-footer">
        <p>Powered by Hyperlane & Starknet</p>
      </footer>
    </div>
  )
}

export default App
