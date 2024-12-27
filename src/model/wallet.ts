export interface WalletType {
    address: string
    ecrypedPrivateKey: string
    encryptedAesKey: string
    uid: string
    balances: WalletBalance[] | null
}

export interface WalletBalance {
    address: string
    balance: BigInt
    chainId: string
    contractAddress: string
    lastCollectedAt: string
    lastRefreshedAt: string
}