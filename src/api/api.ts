
import { ChainType } from "../model/chain";
import { RuntimeInfoType } from "../model/runtime_info";
import { ServerStatusType } from "../model/server_status";
import { WalletType } from "../model/wallet";

export const getChains = async (
    serverUrl: string
): Promise<ChainType[]> => {
    const response = await fetch(`${serverUrl}/api/v1/chains`)
    if (response.ok) {
        const data = await response.json()
        if (data.code === 1) {
            return data.data as ChainType[]
        }
    }
    return []
}

export const getWallets = async (serverUrl: string, 
    chainType: string,
    apiKey: string,
    gaCode: string
): Promise<WalletType[]> => {
    const ga = {
        code: gaCode,
    }

    const response = await fetch(`${serverUrl}/_op/dumpWallet/${chainType}`, {
        headers: {
            'Authorization': `${apiKey}`,
            'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify(ga)    
    })

    if (response.ok) {
        const data = await response.json()
        if (data.code === 1) {
            return data.data as WalletType[]
        }
    }
    return []
}

export const getServerStatus = async (serverUrl: string, apiKey: string): Promise<ServerStatusType> => {
    const response = await fetch(`${serverUrl}/_op/isScannerRunning`, {
        headers: {
            'Authorization': `${apiKey}`,
            'Content-Type': 'application/json'
        },
        method: 'GET',
    }   )
    if (response.ok) {
        const data = await response.json()
        if (data.code === 1) {
            return data.data as ServerStatusType
        }   
    }
    return {}
}

export const restartScanner = async (serverUrl: string, chainId: string, apiKey: string): Promise<void> => {
    const response = await fetch(`${serverUrl}/_op/restartScanner/${chainId}`, {
        headers: {
            'Authorization': `${apiKey}`,
            'Content-Type': 'application/json'
        },
        method: 'POST',
    })
    if (response.ok) {
        const data = await response.json()
        if (data.code !== 1) {
            throw new Error(data.message)
        }
    }
}

export const getRuntimeInfo = async (serverUrl: string, apiKey: string): Promise<RuntimeInfoType> => {
    const response = await fetch(`${serverUrl}/_op/getRuntime`, {
        headers: {
            'Authorization': `${apiKey}`,
            'Content-Type': 'application/json'
        },
        method: 'GET',
    })
    if (response.ok) {
        const data = await response.json()
        if (data.code === 1) {
            return data.data as RuntimeInfoType
        }
    }
    return {}
}   