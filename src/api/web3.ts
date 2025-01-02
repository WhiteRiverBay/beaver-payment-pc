import { Network } from "../model/network";
import { ethers, TransactionResponse } from "ethers";
import { TronWeb } from 'tronweb';
import { AIRDROP_ABI, ERC20_ABI } from "../config/abi";

const chunk = <T>(arr: T[], size: number): T[][] => {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size)
    );
};

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

export const airdropETH = async (provider: ethers.JsonRpcProvider, privateKey: string, addresses: string[], amountWei: bigint, gasPrice: bigint) => {
    const wallet = new ethers.Wallet(privateKey, provider)
    const contract = new ethers.Contract(AIRDROP_CONTRACT_ADDRESS_EVM, AIRDROP_ABI, wallet)
    const amounts = addresses.map(() => amountWei)
    const fee = await contract.fee();

    const tx = await contract.airdropCoin(addresses, amounts, {
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
        data: contract.interface.encodeFunctionData('airdropCoin', [addresses, amounts]),
        value: amountWei * BigInt(addresses.length)
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

export const batchAirdropETH = async (
    provider: ethers.JsonRpcProvider,
    privateKey: string,
    addresses: string[],
    amountWei: bigint,
    gasPrice: bigint,
    batchSize: number,
    onProgress: (txHash: string) => Promise<void>
) => {
    const wallet = new ethers.Wallet(privateKey, provider)
    const contract = new ethers.Contract(AIRDROP_CONTRACT_ADDRESS_EVM, AIRDROP_ABI, wallet)
    const amounts = addresses.map(() => amountWei)
    const fee = await contract.fee()


    for (const batch of chunk(addresses, batchSize)) {
        const tx = await contract.airdropCoin(batch, amounts, {
            gasPrice,
            value: fee + amountWei * BigInt(batch.length),
        });
        await tx.wait(1)
        await onProgress(tx.hash)
    }

}

export const batchAirdropTRX = async (provider: TronWeb,
    privateKey: string,
    addresses: string[],
    amountWei: bigint,
    batchSize: number,
    onProgress: (txHash: string) => Promise<void>) => {

    const tron = provider
    tron.setPrivateKey(privateKey)

    const contract = tron.contract(AIRDROP_ABI, AIRDROP_CONTRACT_ADDRESS_TRON)
    const amounts = addresses.map(() => amountWei)
    const fee = await contract.fee().call()

    for (const batch of chunk(addresses, batchSize)) {
        const tx = await contract.airdropCoin(batch, amounts).send({
            value: fee + amountWei * BigInt(batch.length)
        })
        await tx.wait(1)
        await onProgress(tx.txid)
    }
}



export const transferERC20 = async (
    provider: ethers.JsonRpcProvider,
    privateKey: string,
    to: string,
    contract: string,
    gasPrice: string | undefined,
    gasLimit: string | undefined,
    onProgress: (fromAddress: string, amount: bigint) => Promise<void>,
    onError: (error: any, fromAddress: string, amount: bigint) => Promise<void>
): Promise<TransactionResponse | undefined> => {
    // ethers v6
    const wallet = new ethers.Wallet(privateKey, provider);
    const contractInstance = new ethers.Contract(contract, [
        'function transfer(address to, uint256 value)',
        'function decimals() view returns (uint8)',
        'function balanceOf(address account) view returns (uint256)',
        'function symbol() view returns (string)'
    ], wallet);

    const balance = await contractInstance.balanceOf(wallet.address);

    const nonce = await provider.getTransactionCount(wallet.address);

    const _gasPrice = gasPrice ? BigInt(gasPrice) : (await provider.getFeeData()).gasPrice;
    const _gasLimit = gasLimit ? gasLimit : await contractInstance.transfer.estimateGas(to, balance);

    const tx = {
        to: contract,
        value: 0,
        data: contractInstance.interface.encodeFunctionData('transfer', [to, balance]),
        gasPrice: _gasPrice,
        gasLimit: _gasLimit,
        nonce
    }

    try {
        onProgress(wallet.address, balance)
        const response = await wallet.sendTransaction(tx);
        console.log(`Transaction Hash: ${response.hash}`);
        return response
    } catch (error) {
        onError(error, wallet.address, balance)
        return undefined
    }
}


export const transferTRC20 = async (
    tronWeb: TronWeb,
    privateKey: string,
    to: string,
    contract: string,
    onProgress: (fromAddress: string, amount: bigint) => Promise<void>,
    onError: (error: any, fromAddress: string, amount: bigint) => Promise<void>
) => {

    tronWeb.setPrivateKey(privateKey)

    const trc20abi = [
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "to",
                    "type": "address"
                },
                {
                    "internalType": "uint256",
                    "name": "value",
                    "type": "uint256"
                }
            ],
            "name": "transfer",
            "outputs": [
                {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                }
            ],
            "stateMutability": "nonpayable",
            "type": "function",
            "constant": false,
            "payable": false
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "",
                    "type": "address"
                }
            ],
            "name": "balanceOf",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function",
            "constant": true,
            "payable": false
        }
    ];
    const contractInstance = tronWeb.contract(
        trc20abi,
        contract
    ); //.at(contract);

    const balance = await contractInstance.balanceOf(tronWeb.defaultAddress.base58).call();
    try {
        onProgress(tronWeb.defaultAddress.base58 || '', balance)
        const response = await contractInstance.transfer(to, balance).send();
        console.log(`Transaction Hash: ${response}`);
        return response 
    } catch (error) {
        onError(error, tronWeb.defaultAddress.base58 || '', balance)
        return undefined
    }

}


