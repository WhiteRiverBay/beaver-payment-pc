export interface WalletType {
    address: string
    encryptedPrivateKey: string
    encryptedAesKey: string
    uid: string
    balances: WalletBalance[] | null
}

export interface WalletBalance {
    address: string
    balance: bigint
    chainId: string
    contractAddress: string
    lastCollectedAt: string
    lastRefreshedAt: string
}

export interface EthBalance extends WalletBalance {
    ethBalance: bigint
}