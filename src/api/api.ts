
import { ChainType } from "../model/chain";
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