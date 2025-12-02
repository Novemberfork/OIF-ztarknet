import { useState, useRef, useEffect } from 'react'

export interface ChainOption {
  id: string
  name: string
  chainId: number
  type: 'evm' | 'starknet' | 'ztarknet'
  logo?: string
  isPrivate?: boolean
}

interface ChainSelectorProps {
  label: string
  selectedChain: ChainOption | null
  chains: ChainOption[]
  onSelect: (chain: ChainOption) => void
  disabled?: boolean
  excludeChainId?: number
}

export function ChainSelector({
  label,
  selectedChain,
  chains,
  onSelect,
  disabled = false,
  excludeChainId,
}: ChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter out excluded chain
  const availableChains = chains.filter(c => c.chainId !== excludeChainId)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (chain: ChainOption) => {
    onSelect(chain)
    setIsOpen(false)
  }

  return (
    <div className="chain-selector" ref={dropdownRef}>
      <span className="chain-selector-label">{label}</span>
      <button
        className={`chain-selector-button ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        type="button"
      >
        {selectedChain ? (
          <div className="chain-selector-selected">
            <span className={`chain-type-badge ${selectedChain.id === 'ztarknet' ? 'ztarknet' : selectedChain.type}`}>
              {selectedChain.type === 'evm' ? 'EVM' : selectedChain.id === 'ztarknet' ? 'ZK' : 'SN'}
            </span>
            <span className="chain-name">{selectedChain.name}</span>
            {selectedChain.isPrivate && (
              <span className="private-badge">Private</span>
            )}
          </div>
        ) : (
          <span className="chain-placeholder">Select chain</span>
        )}
        <svg
          className={`chain-selector-arrow ${isOpen ? 'open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="chain-selector-dropdown">
          {availableChains.map((chain) => (
            <button
              key={chain.id}
              className={`chain-option ${selectedChain?.id === chain.id ? 'selected' : ''}`}
              onClick={() => handleSelect(chain)}
              type="button"
            >
              <span className={`chain-type-badge ${chain.id === 'ztarknet' ? 'ztarknet' : chain.type}`}>
                {chain.type === 'evm' ? 'EVM' : chain.id === 'ztarknet' ? 'ZK' : 'SN'}
              </span>
              <span className="chain-name">{chain.name}</span>
              {chain.isPrivate && (
                <span className="private-badge">Private</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
