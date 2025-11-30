import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Address } from 'viem'
import {
  type TransferContext,
  type FeeQuote,
  TransferStatus,
  createTransferContext,
} from '@/types/transfers'

interface BridgeState {
  // Current transfer in progress
  currentTransfer: TransferContext | null

  // Transfer history
  transfers: TransferContext[]

  // UI state
  isTransferLoading: boolean
  showHistory: boolean
  showReview: boolean

  // Fee quote for current transfer
  feeQuote: FeeQuote | null

  // Actions
  setCurrentTransfer: (transfer: TransferContext | null) => void
  updateTransferStatus: (status: TransferStatus, updates?: Partial<TransferContext>) => void
  addTransfer: (transfer: TransferContext) => void
  updateTransfer: (id: string, updates: Partial<TransferContext>) => void
  removeTransfer: (id: string) => void
  clearHistory: () => void

  setTransferLoading: (loading: boolean) => void
  setShowHistory: (show: boolean) => void
  setShowReview: (show: boolean) => void
  setFeeQuote: (quote: FeeQuote | null) => void

  // Initialize a new transfer
  initTransfer: (params: {
    originChain: string
    originChainId: number
    destinationChain: string
    destinationChainId: number
    originToken: Address
    destinationToken: string
    amount: string
    amountRaw: string
    sender: Address
    recipient: string
  }) => TransferContext

  // Reset current transfer
  resetCurrentTransfer: () => void
}

export const useBridgeStore = create<BridgeState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentTransfer: null,
      transfers: [],
      isTransferLoading: false,
      showHistory: false,
      showReview: false,
      feeQuote: null,

      // Set current transfer
      setCurrentTransfer: (transfer) => set({ currentTransfer: transfer }),

      // Update current transfer status
      updateTransferStatus: (status, updates = {}) => {
        const current = get().currentTransfer
        if (!current) return

        const updated: TransferContext = {
          ...current,
          ...updates,
          status,
          updatedAt: Date.now(),
          ...(status === TransferStatus.Completed ||
            status === TransferStatus.Failed ||
            status === TransferStatus.Refunded
            ? { completedAt: Date.now() }
            : {}),
        }

        set({ currentTransfer: updated })

        // Also update in history
        set((state) => ({
          transfers: state.transfers.map((t) =>
            t.id === updated.id ? updated : t
          ),
        }))
      },

      // Add transfer to history
      addTransfer: (transfer) =>
        set((state) => ({
          transfers: [transfer, ...state.transfers].slice(0, 50), // Keep last 50
        })),

      // Update a transfer in history
      updateTransfer: (id, updates) =>
        set((state) => ({
          transfers: state.transfers.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
          ),
        })),

      // Remove transfer from history
      removeTransfer: (id) =>
        set((state) => ({
          transfers: state.transfers.filter((t) => t.id !== id),
        })),

      // Clear all history
      clearHistory: () => set({ transfers: [] }),

      // UI state setters
      setTransferLoading: (loading) => set({ isTransferLoading: loading }),
      setShowHistory: (show) => set({ showHistory: show }),
      setShowReview: (show) => set({ showReview: show }),
      setFeeQuote: (quote) => set({ feeQuote: quote }),

      // Initialize a new transfer
      initTransfer: (params) => {
        const transfer = createTransferContext(params)
        set({
          currentTransfer: transfer,
          showReview: false,
          feeQuote: null,
        })
        // Add to history immediately
        get().addTransfer(transfer)
        return transfer
      },

      // Reset current transfer
      resetCurrentTransfer: () =>
        set({
          currentTransfer: null,
          showReview: false,
          feeQuote: null,
          isTransferLoading: false,
        }),
    }),
    {
      name: 'ztarknet-bridge-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist transfers history
      partialize: (state) => ({
        transfers: state.transfers,
      }),
      version: 1,
    }
  )
)

// Selector hooks for common use cases
export const useCurrentTransfer = () =>
  useBridgeStore((state) => state.currentTransfer)

export const useTransferHistory = () =>
  useBridgeStore((state) => state.transfers)

export const useIsTransferLoading = () =>
  useBridgeStore((state) => state.isTransferLoading)

export const useFeeQuote = () =>
  useBridgeStore((state) => state.feeQuote)
