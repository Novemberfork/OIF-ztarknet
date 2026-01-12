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
            <span className="panel-title">DETAILS</span>
          </div>
          <div className="data-readout">
            <div className="readout-line">
              <span className="readout-label">INTENT</span>
              <span className="readout-value">SIMPLE BRIDGE</span>
            </div>
            <div className="readout-line">
              <span className="readout-label">PROTOCOL</span>
              <span className="readout-value">HYPERLANE-7683</span>
            </div>
            <div className="readout-line">
              <span className="readout-label">TOKEN</span>
              <span className="readout-value">DOG COIN</span>
            </div>


            <div className="readout-line">
              <span className="readout-label">SUPPORTED VMs</span>
              <span className="readout-value">ETHEREUM & CAIRO</span>
            </div>
            <div className="readout-line">
              <span className="readout-label">DOCS</span>
              <a href="https://github.com/novemberfork/OIF-ztarknet/blob/main/ZTARKNET.md" target="_blank" className="readout-value" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </div>
          <div className="panel-header">
            <span className="panel-title">ZYPERPUNK HACKATHON</span>
          </div>
          <div className="readout-line">
            <span className="readout-label">DEMO</span>
            <span className="readout-value status-not-active">OFFLINE</span>
          </div>
          <div className="readout-line">
            <span className="readout-label">SUBMISSION</span>
            <a href="https://devfolio.co/projects/oifztarknet-7ca4" target="_blank" className="readout-value" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
          <div className="data-readout">
            <div className="readout-line">
              <span className="readout-label">SUFFIX LABS</span>
              <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                {
                  <a href="https://github.com/Suffix-Labs" target="_blank" className="readout-value" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                  </a>
                }
                <a href="https://x.com/trb_iv" target="_blank" className="readout-value" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
          <div className="readout-line">
            <span className="readout-label">NOVEMBERFORK</span>
            <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
              <a href="https://x.com/degendeveloper" target="_blank" className="readout-value" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              {
                <a href="https://github.com/0xDegenDeveloper" target="_blank" className="readout-value" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </a>
              }
            </div>
          </div>

          {
            //          <div className="readout-line">
            //            <span className="readout-label">RESULTS</span>
            //            <a href="../public/results.png" target="_blank" className="readout-value" rel="noopener noreferrer">
            //              <svg width="16" height="16" style={{ display: 'inline-block', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            //                <path d="M12 15C8.68629 15 6 12.3137 6 9V3.44444C6 3.0306 6 2.82367 6.06031 2.65798C6.16141 2.38021 6.38021 2.16141 6.65798 2.06031C6.82367 2 7.0306 2 7.44444 2H16.5556C16.9694 2 17.1763 2 17.342 2.06031C17.6198 2.16141 17.8386 2.38021 17.9397 2.65798C18 2.82367 18 3.0306 18 3.44444V9C18 12.3137 15.3137 15 12 15ZM12 15V18M18 4H20.5C20.9659 4 21.1989 4 21.3827 4.07612C21.6277 4.17761 21.8224 4.37229 21.9239 4.61732C22 4.80109 22 5.03406 22 5.5V6C22 6.92997 22 7.39496 21.8978 7.77646C21.6204 8.81173 20.8117 9.62038 19.7765 9.89778C19.395 10 18.93 10 18 10M6 4H3.5C3.03406 4 2.80109 4 2.61732 4.07612C2.37229 4.17761 2.17761 4.37229 2.07612 4.61732C2 4.80109 2 5.03406 2 5.5V6C2 6.92997 2 7.39496 2.10222 7.77646C2.37962 8.81173 3.18827 9.62038 4.22354 9.89778C4.60504 10 5.07003 10 6 10M7.44444 22H16.5556C16.801 22 17 21.801 17 21.5556C17 19.5919 15.4081 18 13.4444 18H10.5556C8.59188 18 7 19.5919 7 21.5556C7 21.801 7.19898 22 7.44444 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            //              </svg>
            //            </a>
            //          </div>
          }
          <div className="signal-bars">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="signal-bar" style={{
                height: `${20 + i * 10}%`,
                animationDelay: `${i * 0.1}s`
              }} />
            ))}
          </div>

          {/* Mobile message */}
          <div className="mobile-message">
            <div className="panel-header">
              <span className="panel-title">NOTICE</span>
            </div>
            <div className="data-readout">
              <div className="readout-line">
                <span className="readout-label"></span>
                <span className="readout-value"></span>
              </div>
              <div className="readout-line">
                <span className="readout-label">NOTICE</span>
                <span className="readout-value">Interface only available on desktop</span>
              </div>
            </div>
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
            {[...Array(12)].map((_, i) => {
              // Create variety: some active, some dim, some fade, some disappear
              // Use deterministic "randomness" based on index for consistency
              const seed = (i * 7 + 13) % 100 / 100;
              let hexClass = 'hex';
              const animationDelay = i * 0.15 + (i % 2) * 0.3;
              const animationDuration = 3 + (i % 4) * 1.2;

              if (seed < 0.25) {
                hexClass += ' active'; // Full orange pulsing
              } else if (seed < 0.45) {
                hexClass += ' dim'; // Dim orange
              } else if (seed < 0.65) {
                hexClass += ' fade'; // Fades to dark/transparent
              } else if (seed < 0.8) {
                hexClass += ' glow'; // Glowing effect
              }
              // else: base transparent state

              return (
                <div
                  key={i}
                  className={hexClass}
                  style={{
                    animationDelay: `${animationDelay}s`,
                    animationDuration: `${animationDuration}s`
                  }}
                />
              );
            })}
          </div>
        </aside>
      </main>


      {/* Bottom info bar */}
      <footer className="info-bar">
        <div className="info-section">
          <a target="_blank" href="https://www.starknet.io/" className="info-label">STARKNET</a>
          <div className="transmission-indicator">
            <div className="transmission-dot" />
            <div className="transmission-dot" />
            <div className="transmission-dot" />
          </div>
        </div>
        <div className="info-section center">
          <div className="transmission-indicator">
            <div className="transmission-dot" />
            <div className="transmission-dot" />
            <div className="transmission-dot" />
          </div>
          <span className="info-text">
            <a href="https://novemberfork.io" target="_blank" className="info-text">NOVEMBERFORK</a>
            <span className="info-text"> x </span>
            <a href="https://suffixlabs.xyz/" target="_blank" className="info-text">SUFFIX LABS</a>
          </span>
        </div>
        <div className="info-section">
          <div className="transmission-indicator">
            <div className="transmission-dot" />
            <div className="transmission-dot" />
            <div className="transmission-dot" />
          </div>
          <a target="_blank" href="https://www.ztarknet.cash/" className="info-label">ZTARKNET</a>
        </div>
      </footer>
    </div>
  )
}

export default App
