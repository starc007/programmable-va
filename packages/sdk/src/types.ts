import type { Address, Hex } from 'viem'

export type Recipient = {
  addr: Address
  percentBps: number // basis points, sum must equal 10000
}

export type SplitRule = {
  recipients: Recipient[]
  createdAt: bigint
  active: boolean
}

export type DepositEvent = {
  userTag: Hex
  token: Address
  amount: bigint
  depositId: Hex
  blockNumber: bigint
  txHash: Hex
  logIndex: number
}
