import './App.css'
import { WalletButton } from './components/wallet/WalletButton'
import { AccountDisplay } from './components/wallet/AccountDisplay'
import { NetworkSwitcher } from './components/wallet/NetworkSwitcher'

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
          <AccountDisplay />
          <div className="placeholder">
            <p>Bridge interface coming soon</p>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>Powered by Hyperlane & Starknet</p>
      </footer>
    </div>
  )
}

export default App
