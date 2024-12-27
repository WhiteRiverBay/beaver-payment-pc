import { ethers } from 'ethers'
import { TronWeb } from 'tronweb'
import { WalletBalance } from '../model/wallet'
export const MULTICALL_ABI = [
    {
      "type": "function",
      "name": "getBlockHash",
      "inputs": [
        {
          "name": "blockNumber",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "blockHash",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getBlockNumber",
      "inputs": [],
      "outputs": [
        {
          "name": "blockNumber",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getCurrentBlockCoinbase",
      "inputs": [],
      "outputs": [
        {
          "name": "coinbase",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getCurrentBlockGasLimit",
      "inputs": [],
      "outputs": [
        {
          "name": "gaslimit",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getCurrentBlockRandomNumber",
      "inputs": [],
      "outputs": [
        {
          "name": "randomNumber",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getCurrentBlockTimestamp",
      "inputs": [],
      "outputs": [
        {
          "name": "timestamp",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getEthBalance",
      "inputs": [
        {
          "name": "addr",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "balance",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getLastBlockHash",
      "inputs": [],
      "outputs": [
        {
          "name": "blockHash",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "multicall",
      "inputs": [
        {
          "name": "calls",
          "type": "tuple[]",
          "internalType": "struct Call[]",
          "components": [
            {
              "name": "target",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "callData",
              "type": "bytes",
              "internalType": "bytes"
            }
          ]
        }
      ],
      "outputs": [
        {
          "name": "blockNumber",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "results",
          "type": "bytes[]",
          "internalType": "bytes[]"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "multicallView",
      "inputs": [
        {
          "name": "calls",
          "type": "tuple[]",
          "internalType": "struct Call[]",
          "components": [
            {
              "name": "target",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "callData",
              "type": "bytes",
              "internalType": "bytes"
            }
          ]
        }
      ],
      "outputs": [
        {
          "name": "blockNumber",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "results",
          "type": "bytes[]",
          "internalType": "bytes[]"
        }
      ],
      "stateMutability": "view"
    }
  ]
  


export const MULTICALL_ADDRESS_EVM = '0x058C6121efBF3e7C1f856928f7e9ecBC71c5772a'
export const MULTICALL_ADDRESS_TRON = 'TS4cnF8dF7GeEgLZVrCexRK5sfZ3u235by'

export const getEVMBalances = async (provider: ethers.JsonRpcProvider, addresses: string[]) => {
    const multicallAddress = MULTICALL_ADDRESS_EVM
    const multicall = new ethers.Contract(multicallAddress, MULTICALL_ABI, provider)
    const multicallData = createMulticallData(addresses)
    return multicall.multicallView(multicallData)
}

export const getTRONBalances = async (provider: TronWeb, addresses: string[]) => {
    const multicallAddress = MULTICALL_ADDRESS_TRON
    const tron = provider

    const constractInstance = await tron.contract(MULTICALL_ABI).at(multicallAddress)
    const result = await constractInstance.multicall(addresses.map(address => ({ target: address, callData: '0x' })))
    return result
}

// get evm erc20 balances
export const getEVMERC20Balances = async (provider: ethers.JsonRpcProvider, addresses: string[], tokenAddress: string) => {
    const multicallData = createMulticallDataERC20(addresses, tokenAddress)
    const multicall = new ethers.Contract(MULTICALL_ADDRESS_EVM, MULTICALL_ABI, provider)
    return multicall.multicallView(multicallData)
}

// get tron erc20 balances
export const getTRONERC20Balances = async (provider: TronWeb, addresses: string[]) => {
    const tron = provider
    const constractInstance = await tron.contract(MULTICALL_ABI).at(MULTICALL_ADDRESS_TRON)
    const result = await constractInstance.multicall(addresses.map(address => ({ target: address, callData: '0x' })))
    return result
}


// Batch get ETH balances, process in groups of 255 addresses with 1 second delay between groups
export const batchGetETHBalances = async (
    provider: ethers.JsonRpcProvider,
    chainId: string,
    addresses: string[],
    callback: (result: WalletBalance[]) => void
) => {
    // Split addresses into groups of 255
    const chunkSize = 255;
    const addressGroups = [];
    for (let i = 0; i < addresses.length; i += chunkSize) {
        addressGroups.push(addresses.slice(i, i + chunkSize));
    }

    // Process each group with delay
    for (let i = 0; i < addressGroups.length; i++) {
        const group = addressGroups[i];

        try {
            const results = await getEVMBalances(provider, group);
            const formattedResults = group.map((address, index) => ({
                address,
                balance: results.results[index] === '0x' ? BigInt(0) :  BigInt(results.results[index]),
                chainId: chainId,
                contractAddress: '',
                lastCollectedAt: new Date().toISOString(),
                lastRefreshedAt: new Date().toISOString()
            }));

            callback(formattedResults);

            // Add 1 second delay if not the last group
            if (i < addressGroups.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error(`Error processing group ${i}:`, error);
        }
    }
}

// batch get evm erc20 balances
export const batchGetERC20Balances = async (
    provider: ethers.JsonRpcProvider, 
    addresses: string[],
    chainId: string,
    tokenAddress: string,
    callback: (result: WalletBalance[]) => void
) => {
    // Split addresses into groups of 255
    const chunkSize = 255;
    const addressGroups = [];
    for (let i = 0; i < addresses.length; i += chunkSize) {
        addressGroups.push(addresses.slice(i, i + chunkSize));
    }

    // Process each group with delay
    for (let i = 0; i < addressGroups.length; i++) {
        const group = addressGroups[i];

        try {
            // Create multicall data for ERC20 balanceOf
            const multicallData = createMulticallDataERC20(group, tokenAddress);
            const multicall = new ethers.Contract(MULTICALL_ADDRESS_EVM, MULTICALL_ABI, provider);
            
            // Use multicallView instead of multicall
            const results = await multicall.multicallView(multicallData);

            console.log('results:', results)
            const formattedResults = group.map((address, index) => ({
                address,
                balance: results.results[index] === '0x' ? BigInt(0) : BigInt(results.results[index]),
                chainId: chainId,
                contractAddress: tokenAddress,
                lastCollectedAt: new Date().toISOString(),
                lastRefreshedAt: new Date().toISOString()
            }));

            callback(formattedResults);

            // Add 1 second delay if not the last group
            if (i < addressGroups.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error(`Error processing group ${i}:`, error);
        }
    }
}


// Helper function to encode the function call
const encodeGetEthBalanceCall = (address: string) => {
    const functionSignature = '0x70a08231'; // keccak256('getEthBalance(address)') first 4 bytes
    const paddedAddress = address.toLowerCase().replace('0x', '').padStart(64, '0');
    return functionSignature + paddedAddress;
};

const createMulticallData = (addresses: string[]) => {
    return addresses.map(address => ({
        target: address,
        callData: encodeGetEthBalanceCall(address)
    }))
}

const encodeBalanceOfCall = (address: string) => {
    // balanceOf(address) selector: 0x70a08231
    const functionSignature = '0x70a08231';
    // Remove '0x' prefix and pad to 64 characters (32 bytes)
    const encodedAddress = ethers.zeroPadValue(address, 32).slice(2);
    return functionSignature + encodedAddress;
}

const createMulticallDataERC20 = (addresses: string[], tokenAddress: string): { target: string, callData: string }[] => {
    return addresses.map(address => ({
        target: tokenAddress,  // token contract address
        callData: encodeBalanceOfCall(address)  // encoded balanceOf(address) call
    }));
}