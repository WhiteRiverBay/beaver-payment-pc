import { Network } from "../model/network";
import { ethers } from "ethers";
import {TronWeb} from 'tronweb';

export const getEvmProvider = (network: Network) => {
    if (network.chainType.toLowerCase() === 'evm') {
        return new ethers.JsonRpcProvider(network.rpc)
    } else {
        throw new Error('Unsupported chain type')
    }
}

export const getTronProvider = (network: Network) => {
    const tronApiKey = localStorage.getItem('tronApiKey')
    if (!tronApiKey) {
        throw new Error('Tron API key is not set')
    }
    if (network.chainType.toLowerCase() === 'tron') {
        return new TronWeb({
            fullHost: network.rpc,
            headers: { "TRON-PRO-API-KEY": tronApiKey }
        })
    } else {
        throw new Error('Unsupported chain type')
    }
}

export const getProvider = (network: Network) => {
    if (network.chainType.toLowerCase() === 'evm') {
        return getEvmProvider(network)
    } else {
        return getTronProvider(network)
    }
}   