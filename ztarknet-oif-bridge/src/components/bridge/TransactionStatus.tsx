import { TransferStatus, TRANSFER_STATUS_LABELS } from '@/types/transfers'
import type { TransferContext } from '@/types/transfers'

interface TransactionStatusProps {
  transfer: TransferContext
  onClose?: () => void
}

const EVM_STATUS_STEPS = [
  { status: TransferStatus.CheckingApproval, label: 'Checking approval' },
  { status: TransferStatus.WaitingApprovalSignature, label: 'Approve tokens' },
  { status: TransferStatus.ApprovalConfirming, label: 'Confirming approval' },
  { status: TransferStatus.WaitingBridgeSignature, label: 'Sign bridge' },
  { status: TransferStatus.BridgeConfirming, label: 'Confirming bridge' },
  { status: TransferStatus.WaitingForFulfillment, label: 'Awaiting solver' },
  { status: TransferStatus.Fulfilled, label: 'Fulfilled' },
]

const STARKNET_STATUS_STEPS = [
  { status: TransferStatus.WaitingBridgeSignature, label: 'Sign bridge' },
  { status: TransferStatus.BridgeConfirming, label: 'Confirming bridge' },
  { status: TransferStatus.WaitingForFulfillment, label: 'Awaiting solver' },
  { status: TransferStatus.Fulfilled, label: 'Fulfilled' },
]

function getStepIndex(status: TransferStatus, isStarknet: boolean): number {
  const steps = isStarknet ? STARKNET_STATUS_STEPS : EVM_STATUS_STEPS
  const idx = steps.findIndex(s => s.status === status)
  if (idx !== -1) return idx

  // Map other statuses to steps
  if (status === TransferStatus.Preparing) return -1
  if (status === TransferStatus.ApprovingToken) return isStarknet ? -1 : 1
  if (status === TransferStatus.SubmittingBridge) return isStarknet ? 0 : 3
  if (status === TransferStatus.Completed || status === TransferStatus.Settled) return steps.length
  return -1
}

function StatusIcon({ status }: { status: 'pending' | 'active' | 'complete' | 'error' }) {
  if (status === 'complete') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    )
  }
  if (status === 'error') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M15 9l-6 6M9 9l6 6"/>
      </svg>
    )
  }
  if (status === 'active') {
    return (
      <div className="status-spinner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
          <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10"/>
        </svg>
      </div>
    )
  }
  return (
    <div className="status-dot pending" />
  )
}

export function TransactionStatus({ transfer, onClose }: TransactionStatusProps) {
  // Check if origin is Starknet based on chain ID
  // Starknet Sepolia: 23448591, Ztarknet: 10066329
  const isStarknet = transfer.originChainId === 23448591 || transfer.originChainId === 10066329
  const steps = isStarknet ? STARKNET_STATUS_STEPS : EVM_STATUS_STEPS
  const currentStepIdx = getStepIndex(transfer.status, isStarknet)
  
  const isComplete = transfer.status === TransferStatus.Completed ||
                     transfer.status === TransferStatus.Fulfilled ||
                     transfer.status === TransferStatus.Settled
  const isFailed = transfer.status === TransferStatus.Failed

  return (
    <div className="tx-status-container">
      <div className="tx-status-header">
        <h3>Transaction Progress</h3>
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      <div className="tx-status-steps">
        {steps.map((step, idx) => {
          let stepStatus: 'pending' | 'active' | 'complete' | 'error' = 'pending'
          if (isFailed && idx === currentStepIdx) {
            stepStatus = 'error'
          } else if (idx < currentStepIdx || isComplete) {
            stepStatus = 'complete'
          } else if (idx === currentStepIdx) {
            stepStatus = 'active'
          }

          return (
            <div key={step.status} className={`tx-step ${stepStatus}`}>
              <StatusIcon status={stepStatus} />
              <span className="step-label">{step.label}</span>
            </div>
          )
        })}
      </div>

      {/* Status message */}
      <div className="tx-status-message">
        {isFailed ? (
          <div className="error-message">
            <span>Transaction failed</span>
            {transfer.error && <p>{transfer.error}</p>}
          </div>
        ) : isComplete ? (
          <div className="success-message">
            <span>Bridge successful!</span>
          </div>
        ) : (
          <div className="pending-message">
            <span>{TRANSFER_STATUS_LABELS[transfer.status]}</span>
          </div>
        )}
      </div>

      {/* Transaction hashes */}
      <div className="tx-hashes">
        {transfer.approvalTxHash && (
          <div className="tx-hash-row">
            <span className="hash-label">Approval:</span>
            <a
              href={`https://sepolia.etherscan.io/tx/${transfer.approvalTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hash-link"
            >
              {transfer.approvalTxHash.slice(0, 10)}...{transfer.approvalTxHash.slice(-8)}
            </a>
          </div>
        )}
        {transfer.originTxHash && (
          <div className="tx-hash-row">
            <span className="hash-label">Bridge TX:</span>
            <a
              href={`https://sepolia.etherscan.io/tx/${transfer.originTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hash-link"
            >
              {transfer.originTxHash.slice(0, 10)}...{transfer.originTxHash.slice(-8)}
            </a>
          </div>
        )}
        {transfer.orderId && (
          <div className="tx-hash-row">
            <span className="hash-label">Order ID:</span>
            <span className="hash-value">
              {transfer.orderId.slice(0, 10)}...{transfer.orderId.slice(-8)}
            </span>
          </div>
        )}
      </div>

      <style>{`
        .tx-status-container {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 12px;
          padding: 1.5rem;
          margin-top: 1rem;
        }
        .tx-status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .tx-status-header h3 {
          margin: 0;
          font-size: 1rem;
          color: #fafafa;
        }
        .close-btn {
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 4px;
        }
        .close-btn:hover {
          color: #fafafa;
        }
        .tx-status-steps {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .tx-step {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem;
          border-radius: 8px;
        }
        .tx-step.active {
          background: rgba(249, 115, 22, 0.1);
        }
        .tx-step.complete {
          opacity: 0.7;
        }
        .tx-step.pending {
          opacity: 0.4;
        }
        .status-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid #555;
        }
        .status-spinner svg {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .step-label {
          color: #ccc;
          font-size: 0.9rem;
        }
        .tx-step.active .step-label {
          color: #f97316;
          font-weight: 500;
        }
        .tx-status-message {
          margin-top: 1.5rem;
          padding: 1rem;
          border-radius: 8px;
          text-align: center;
        }
        .error-message {
          color: #ef4444;
        }
        .success-message {
          color: #22c55e;
        }
        .pending-message {
          color: #f97316;
        }
        .tx-hashes {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #333;
        }
        .tx-hash-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          font-size: 0.85rem;
        }
        .hash-label {
          color: #888;
        }
        .hash-link {
          color: #f97316;
          text-decoration: none;
        }
        .hash-link:hover {
          text-decoration: underline;
        }
        .hash-value {
          color: #ccc;
          font-family: monospace;
        }
      `}</style>
    </div>
  )
}
