import { useEvmChainStats, useStarknetChainStats } from '@/hooks/useChainStats'
import type { ChainOption } from './ChainSelector'

interface ChainStatsProps {
  chain: ChainOption | null
  position: 'origin' | 'destination'
}

export function ChainStats({ chain, position }: ChainStatsProps) {
  const evmStats = useEvmChainStats(
    chain?.type === 'evm' ? chain.chainId : undefined,
    chain?.type === 'evm'
  )
  const starknetStats = useStarknetChainStats(
    chain?.type === 'starknet' ? chain.chainId : undefined,
    chain?.type === 'starknet'
  )

  if (!chain) return null

  const stats = chain.type === 'evm' ? evmStats : starknetStats
  const isPrivate = chain.isPrivate

  return (
    <div className={`chain-stats ${position} ${isPrivate ? 'private' : ''}`}>
      <div className="stats-header">
        <div className="chain-indicator">
          <div className={`indicator-dot ${stats.isLoading ? 'loading' : stats.error ? 'error' : 'active'}`} />
          <span className="chain-short-name">{chain.name.split(' ')[0]}</span>
        </div>
        {isPrivate && (
          <div className="privacy-shield">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
          </div>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18"/>
              <path d="M9 21V9"/>
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-label">BLOCK</span>
            <span className="stat-value">
              {stats.isLoading ? (
                <span className="loading-bar" />
              ) : stats.blockNumber ? (
                stats.blockNumber.toLocaleString()
              ) : (
                '---'
              )}
            </span>
          </div>
        </div>

        {chain.type === 'evm' && (
          <div className="stat-item">
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2v20"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div className="stat-content">
              <span className="stat-label">GAS</span>
              <span className="stat-value">
                {stats.isLoading ? (
                  <span className="loading-bar" />
                ) : stats.gasPrice ? (
                  `${Number(stats.gasPrice).toFixed(2)} Gwei`
                ) : (
                  '---'
                )}
              </span>
            </div>
          </div>
        )}

        {chain.type === 'starknet' && stats.tps !== null && (
          <div className="stat-item">
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div className="stat-content">
              <span className="stat-label">TXS/BLK</span>
              <span className="stat-value">{stats.tps}</span>
            </div>
          </div>
        )}

        <div className="stat-item">
          <div className="stat-icon latency">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-label">LATENCY</span>
            <span className={`stat-value ${stats.latency && stats.latency < 200 ? 'good' : stats.latency && stats.latency < 500 ? 'medium' : 'slow'}`}>
              {stats.isLoading ? (
                <span className="loading-bar" />
              ) : stats.latency ? (
                `${stats.latency}ms`
              ) : (
                '---'
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Visual activity indicator */}
      <div className="activity-bar">
        <div className={`activity-pulse ${stats.isLoading ? 'loading' : 'active'}`} />
      </div>
    </div>
  )
}
