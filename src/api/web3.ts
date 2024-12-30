import { Network } from "../model/network";
import { ethers } from "ethers";
import { TronWeb } from 'tronweb';
import { AIRDROP_ABI, ERC20_ABI } from "../config/abi";

export const getEvmProvider = (network: Network) => {
    if (network.chainType.toLowerCase() === 'evm') {
        return new ethers.JsonRpcProvider(network.rpc)
    } else {
        throw new Error('Unsupported chain type')
    }
}

export const getTronProvider = (network: Network, privateKey: string | undefined) => {
    const tronApiKey = localStorage.getItem('tronApiKey')
    if (!tronApiKey) {
        throw new Error('Tron API key is not set')
    }
    if (network.chainType.toLowerCase() === 'tron') {
        return new TronWeb({
            fullHost: network.rpc,
            headers: { "TRON-PRO-API-KEY": tronApiKey },
            privateKey: privateKey || undefined
        })
    } else {
        throw new Error('Unsupported chain type')
    }
}

export const getProvider = (network: Network, privateKey: string | undefined) => {
    if (network.chainType.toLowerCase() === 'evm') {
        return getEvmProvider(network)
    } else {
        return getTronProvider(network, privateKey)
    }
}

export const AIRDROP_CONTRACT_ADDRESS_EVM = '0xE9511e55d2AaC1F62D7e3110f7800845dB2a31F1'
export const AIRDROP_CONTRACT_ADDRESS_TRON = 'TNnHipM7aZMYYanXhESgRV9NmjndcgvaXu'

export const airdropETH = async (provider: ethers.JsonRpcProvider, privateKey: string, addresses: string[], amountWei: bigint, gasLimit: number, gasPrice: bigint) => {
    const wallet = new ethers.Wallet(privateKey, provider)
    const contract = new ethers.Contract(AIRDROP_CONTRACT_ADDRESS_EVM, AIRDROP_ABI, wallet)
    const amounts = addresses.map(() => amountWei)
    const fee = await contract.fee();

    const tx = await contract.airdropCoin(addresses, amounts, {
        gasLimit,
        gasPrice,
        value: fee + amountWei * BigInt(addresses.length)
    })
    return tx
}

export const estimateAirdropETH = async (provider: ethers.JsonRpcProvider, addresses: string[], amountWei: bigint): Promise<bigint> => {
    const contract = new ethers.Contract(AIRDROP_CONTRACT_ADDRESS_EVM, AIRDROP_ABI, provider)
    const amounts = addresses.map(() => amountWei)

    const gasLimit = await provider.estimateGas({
        to: AIRDROP_CONTRACT_ADDRESS_EVM,
        data: contract.interface.encodeFunctionData('airdropCoin', [addresses, amounts])
    })
    return gasLimit
}

export const airdropTRX = async (provider: TronWeb, privateKey: string, addresses: string[], amountWei: bigint, gasLimit: number, gasPrice: bigint) => {
    const tron = provider
    tron.setPrivateKey(privateKey)

    const contract = tron.contract(AIRDROP_ABI, AIRDROP_CONTRACT_ADDRESS_TRON)
    const amounts = addresses.map(() => amountWei)
    const fee = await contract.fee().call()

    const tx = await contract.airdropCoin(addresses, amounts).send({
        value: fee + amountWei * BigInt(addresses.length)
    })
    return tx
}