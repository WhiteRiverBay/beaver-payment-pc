export const SERVER_API_URL = 'http://localhost:8080'

export const DEFAULT_NETWORKS = [
    {
        chainId: 1,
        name: "Ethereum", 
        rpc: "https://ethereum-rpc.publicnode.com",
        symbol: "ETH",
        decimals: 18,
        browser: "https://etherscan.io",
        chainType: "EVM"
    }, {
        chainId: 56,
        name: "Binance Smart Chain",
        rpc: "https://bsc-dataseed.binance.org",
        symbol: "BNB",
        decimals: 18,
        browser: "https://bscscan.com",
        chainType: "EVM"
    }, {
        chainId: 137,
        name: "Polygon",
        rpc: "https://polygon-rpc.com",
        symbol: "MATIC",
        decimals: 18,
        browser: "https://polygonscan.com",
        chainType: "EVM"
    }, 
    {
        chainId: 8453,
        name: "Base",
        rpc: "https://mainnet.base.org",
        symbol: "ETH",
        decimals: 18,
        browser: "https://basescan.org",
        chainType: "EVM"
    },
    {
        chainId: 42161,
        name: "Arbitrum One",
        rpc: "https://arb1.arbitrum.io/rpc",
        symbol: "ETH",
        decimals: 18,
        browser: "https://arbiscan.io",
        chainType: "EVM"
    },
    // tron
    {
        chainId: 728126428,
        name: "Tron",
        rpc: "https://api.trongrid.io",
        symbol: "TRX",
        decimals: 6,
        browser: "https://tronscan.org",
        chainType: "TRON"
    }
]
