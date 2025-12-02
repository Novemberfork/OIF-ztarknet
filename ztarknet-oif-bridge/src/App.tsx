import './App.css'
import { WalletButton } from './components/wallet/WalletButton'
import { BridgeForm } from './components/bridge/BridgeForm'
import { useGlobalBridgeStats } from './hooks/useGlobalBridgeStats'

function App() {
  const { bridgesPerHour, isLoading: isStatsLoading } = useGlobalBridgeStats()

  return (
    <div className="app">
      {/* Animated background elements */}
      <div className="bg-grid" />
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />

      {/* Floating particles */}
      <div className="particles">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${10 + Math.random() * 20}s`
          }} />
        ))}
      </div>

      {/* Top status bar */}
      <header className="status-bar">
        <div className="status-left">
          <div className="status-indicator online" />
          <span className="status-text">SECURE CONNECTION</span>
        </div>
        <div className="logo-container">
          <div className="logo-hex" />
          <h1 className="logo-text">ZTARKNET</h1>
          <span className="logo-subtitle">OPEN INTENT FRAMEWORK</span>
        </div>
        <div className="status-right">
          <WalletButton />
        </div>
      </header>

      {/* Main interface */}
      <main className="command-center">
        {/* Left decorative panel */}
        <aside className="side-panel left-panel">
          <div className="panel-header">
            <span className="panel-title">NETWORK</span>
          </div>
          <div className="data-readout">
            <div className="readout-line">
              <span className="readout-label">PROTOCOL</span>
              <span className="readout-value">HYPERLANE-7683</span>
            </div>
            <div className="readout-line">
              <span className="readout-label">SUPPORTED VMs</span>
              <span className="readout-value">EVM & CairoVM</span>
            </div>
            <div className="readout-line">
              <span className="readout-label">STATUS</span>
              <span className="readout-value status-active">OPERATIONAL</span>
            </div>
          </div>
          <div className="panel-header">
            <span className="panel-title">DEMO</span>
          </div>
          <div className="data-readout">
            <div className="readout-line">
              <span className="readout-label">INTENT</span>
              <span className="readout-value">SIMPLE BRIDGE</span>
            </div>
            <div className="readout-line">
              <span className="readout-label">TOKEN</span>
              <span className="readout-value">DOG COIN</span>
            </div>
            <div className="readout-line">
              <span className="readout-label">MINT</span>
              <span className="readout-value status-active">HERE</span>
            </div>
          </div>

          <div className="signal-bars">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="signal-bar" style={{
                height: `${20 + i * 10}%`,
                animationDelay: `${i * 0.1}s`
              }} />
            ))}
          </div>
        </aside>


        {/* Central bridge interface */}
        <div className="bridge-interface">
          <div className="interface-frame">
            <div className="frame-corner tl" />
            <div className="frame-corner tr" />
            <div className="frame-corner bl" />
            <div className="frame-corner br" />
            <div className="frame-line top" />
            <div className="frame-line bottom" />
            <div className="frame-line left" />
            <div className="frame-line right" />

            <BridgeForm />
          </div>
        </div>

        {/* Right decorative panel */}
        <aside className="side-panel right-panel">
          <div className="panel-header">
            <span className="panel-title">ACTIVITY</span>
          </div>
          <div className="activity-monitor">
            <div className="monitor-wave">
              <svg viewBox="0 0 100 40" preserveAspectRatio="none">
                <path className="wave-path" d="M0,20 Q25,5 50,20 T100,20" />
              </svg>
            </div>
            <div className="activity-stats">
              <div className="stat">
                <span className="stat-value">
                  {isStatsLoading ? (
                    <span className="loading-dots">...</span>
                  ) : bridgesPerHour !== null ? (
                    bridgesPerHour
                  ) : (
                    '--'
                  )}
                </span>
                <span className="stat-label">BRIDGES/HR</span>
              </div>
              <div className="stat">
                <span className="stat-value">99.9%</span>
                <span className="stat-label">UPTIME</span>
              </div>
            </div>
          </div>
          <div className="hex-grid">
            {[...Array(12)].map((_, i) => (
              <div key={i} className={`hex ${i % 3 === 0 ? 'active' : ''}`} />
            ))}
          </div>
        </aside>
      </main>


      {/* Bottom info bar */}
      <footer className="info-bar">
        <div className="info-section">
          <span className="info-label">BLOCK</span>
          <span className="info-value">███████</span>
        </div>
        <div className="info-section center">
          <div className="transmission-indicator">
            <div className="transmission-dot" />
            <div className="transmission-dot" />
            <div className="transmission-dot" />
          </div>
          <span className="info-text">CROSS-CHAIN TRANSMISSION READY</span>
        </div>
        <div className="info-section">
          <span className="info-label">LATENCY</span>
          <span className="info-value">&lt;100ms</span>
        </div>
      </footer>
    </div>
  )
}

export default App
