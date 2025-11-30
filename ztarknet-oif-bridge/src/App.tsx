import './App.css'
import { WalletButton } from './components/wallet/WalletButton'
import { BridgeForm } from './components/bridge/BridgeForm'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Ztarknet Bridge</h1>
        <WalletButton />
      </header>

      <main className="app-main">
        <div className="bridge-card">
          <BridgeForm />
        </div>
      </main>

    </div>
  )
}

export default App
