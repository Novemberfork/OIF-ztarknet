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
              <span className="readout-label">INTENT</span>
              <span className="readout-value">SIMPLE BRIDGE</span>
            </div>
            <div className="readout-line">
              <span className="readout-label">SUPPORTED VMs</span>
              <span className="readout-value">ETHEREUM & CAIRO</span>
            </div>
          </div>
          <div className="panel-header">
            <span className="panel-title">DEMO</span>
          </div>
          <div className="readout-line">
            <span className="readout-label">STATUS</span>
            <span className="readout-value status-active">OPERATIONAL</span>
          </div>
          <div className="readout-line">
            <span className="readout-label">TOKEN</span>
            <span className="readout-value">DOG COIN</span>
          </div>

          <div className="data-readout">
            <div className="readout-line">
              <span className="readout-label">TRBUTLER4</span>
              <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                <a href="https://github.com/trbutler4" target="_blank" className="readout-value" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </a>
                <a href="https://x.com/trb_iv" target="_blank" className="readout-value" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
          <div className="readout-line">
            <span className="readout-label">0xDEGENDEVELOPER</span>
            <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
              <a href="https://x.com/degendeveloper" target="_blank" className="readout-value" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="https://github.com/0xDegenDeveloper" target="_blank" className="readout-value" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
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
          <a href="https://novemberfork.io" target="_blank" className="info-text">POWERED BY NOVEMBERFORK</a>
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
