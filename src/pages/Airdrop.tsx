import React from "react";
import { Pane, Heading, Select, Group, TextInput, Button, toaster, Table, Dialog, TextInputField, Alert, Spinner, Overlay } from "evergreen-ui";
import { ChainType, UsdtContract } from "../model/chain";
import { Network } from "../model/network";
import DataCard from "../component/DataCard";
import { EthBalance } from "../model/wallet";
import { getChains } from "../api/api";
import { DEFAULT_NETWORKS } from "../config/const";
import { ethers } from "ethers";
import { airdropETH, batchAirdropETH, batchAirdropTRX, estimateAirdropETH, getProvider } from "../api/web3";
import { TronWeb } from "tronweb";

interface AirdropProps {
}

interface AirdropState {
    amountThreshold: number
    chains: ChainType[]
    selectedChain: ChainType | null
    networks: Network[]
    amountEach: number
    usdtContract: UsdtContract | null
    isLoading: boolean
    walletsBalance: EthBalance[]
    totalWallets: number
    gasPrice: number
    estimatedCost: bigint
    sumBalance: bigint
    ethBalance: Map<string, bigint>
    showAirdropDialog: boolean
    batchSize: number
    privateKey: string
    fromAddress: string
    fromAddressBalance: bigint
    airdroping: boolean
    currentAirdropTx: string
}

class Airdrop extends React.Component<AirdropProps, AirdropState> {
    constructor(props: AirdropProps) {
        super(props)
        this.state = {
            amountThreshold: 1,
            chains: [],
            selectedChain: null,
            networks: [],
            amountEach: 0.0001,
            usdtContract: null,
            isLoading: false,
            walletsBalance: [],
            totalWallets: 0,
            gasPrice: 0,
            estimatedCost: 0n,
            sumBalance: 0n,
            ethBalance: new Map(),
            showAirdropDialog: false,
            batchSize: 250,
            privateKey: '',
            fromAddress: '',
            fromAddressBalance: 0n,
            airdroping: false,
            currentAirdropTx: ''
        }
    }

    componentDidMount() {
        this.init()
        this.loadLocalNetworks()
        this.loadChains()
    }

    componentWillUnmount() {
        if (window.electron && window.electron.removeAllListeners) {
            window.electron.removeAllListeners('getWalletBalanceByChainIdAndContractAddressAndBalanceMoreThan')
        }
    }

    loadLocalNetworks = () => {
        try {
            const networksJson = localStorage.getItem('networks')
            if (networksJson) {
                const networks = JSON.parse(networksJson)
                this.setState({ networks })
            } else {
                this.setState({ networks: DEFAULT_NETWORKS })
            }
        } catch (error) {
            console.error('Failed to load networks:', error)
        }
    }

    loadChains = async () => {
        const serverUrl = localStorage.getItem("serverUrl")
        if (!serverUrl) {
            return
        }
        const chains = await getChains(serverUrl)
        this.setState({ chains, selectedChain: chains[0], usdtContract: chains[0].usdtContracts[0] }, () => {
            this.getGasPrice()
        })
    }

    doQuery = async () => {
        const { selectedChain, amountThreshold, usdtContract } = this.state
        if (!selectedChain || !usdtContract) {
            return
        }
        if (amountThreshold <= 0) {
            return
        }
        const _amountThreshold = ethers.parseUnits(amountThreshold.toString(), usdtContract.decimals)
        if (!selectedChain.chainId) {
            return
        }
        window.electron.send('getWalletBalanceByChainIdAndContractAddressAndBalanceMoreThan', { chainId: selectedChain.chainId.toString(), contractAddress: usdtContract.address, balance: _amountThreshold.toString() })
    }

    init = async () => {
        if (window.electron && window.electron.on) {
            window.electron.on('getWalletBalanceByChainIdAndContractAddressAndBalanceMoreThan', (_event: any, wallets: EthBalance[], totalWallets: { total: number | 0 }, sumBalance: { total: bigint | 0n }) => {
                console.log('wallets', wallets)
                this.setState({ walletsBalance: wallets, totalWallets: totalWallets.total, sumBalance: sumBalance.total })
            })
        } else {
            console.error('window.electron is not defined or does not have a send method')
        }
    }

    currentDecimals = () => {
        const { selectedChain, networks } = this.state
        const network = networks.find(n => n.chainId === selectedChain?.chainId)
        if (!network) {
            return 18
        }
        return network.decimals
    }

    getGasPrice = async () => {
        const { selectedChain } = this.state
        if (!selectedChain) {
            return
        }

        // For EVM chains, get gas price
        if (selectedChain.chainType.toLowerCase() === 'evm') {
            try {
                const network = this.state.networks.find(n => n.chainId === selectedChain.chainId)
                if (!network?.rpc) {
                    toaster.danger('No RPC URL found for chain: ' + selectedChain.chainName)
                    return
                }
                const provider = new ethers.JsonRpcProvider(network.rpc)
                const gasPrice = await provider.getFeeData()
                this.setState({ gasPrice: Number(ethers.formatUnits(gasPrice.gasPrice || 0n, 'gwei')) })

            } catch (error) {
                console.error(error)
            }
        }
        return
    }

    onPrivateKeyChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const currentNetwork = this.state.networks.find(n => n.chainId === this.state.selectedChain?.chainId)
        if (!currentNetwork) {
            return
        }
        const provider = getProvider(currentNetwork, e.target.value || undefined)
        if (!provider) {
            return
        }
        try {
            if (provider instanceof ethers.JsonRpcProvider) {
                const wallet = new ethers.Wallet(e.target.value, provider)
                const balance = await provider.getBalance(wallet.address)
                this.setState({ fromAddress: wallet.address, fromAddressBalance: balance })

                // Estimate gas cost for EVM chains
                if (this.state.walletsBalance.length > 0 && this.state.amountEach > 0) {
                    try {
                        const addresses = this.state.walletsBalance.map(w => w.address)
                        const amountEach = ethers.parseUnits(this.state.amountEach.toString(), this.state.usdtContract?.decimals || 18)
                        const gasLimit = await estimateAirdropETH(provider, addresses, amountEach)
                        this.setState({ estimatedCost: gasLimit * ethers.parseUnits(this.state.gasPrice.toString(), 'gwei') })
                    } catch (error) {
                        console.error('Failed to estimate gas:', error)
                        toaster.danger('Failed to estimate gas')
                    }
                }

            } else if (provider instanceof TronWeb) {
                const wallet = provider
                const balance = await wallet.trx.getBalance(wallet.defaultAddress?.base58)
                if (wallet.defaultAddress?.base58) {
                    this.setState({ fromAddress: wallet.defaultAddress.base58, fromAddressBalance: BigInt(balance) })
                }
            }
        } catch (error) {
            console.error(error)
        }
    }

    doAirdrop = async () => {
        const { fromAddress, privateKey, amountEach, gasPrice, estimatedCost, walletsBalance, usdtContract } = this.state
        if (!fromAddress || !privateKey || !amountEach || !gasPrice || !estimatedCost || !walletsBalance || !usdtContract) {
            toaster.danger('Please fill all fields')
            return
        }
        const currentNetwork = this.state.networks.find(n => n.chainId === this.state.selectedChain?.chainId)
        if (!currentNetwork) {
            return
        }
        const provider = getProvider(currentNetwork, privateKey)
        if (!provider) {
            return
        }
        const addresses = walletsBalance.map(w => w.address)
        const _gasPrice = ethers.parseUnits(gasPrice.toString(), 'gwei')
        const _amountEach = ethers.parseUnits(this.state.amountEach.toString(), currentNetwork.decimals || 18)
        if (provider instanceof ethers.JsonRpcProvider) {
            this.setState({ airdroping: true })
            try {
                batchAirdropETH(provider,
                    privateKey,
                    addresses,
                    _amountEach,
                    _gasPrice,
                    this.state.batchSize,
                    async (txHash: string) => {
                        console.log('tx', txHash)
                        this.setState({ currentAirdropTx: txHash, })
                    })
            } catch (error) {
                console.error('Failed to airdrop:', error)
                toaster.danger('Failed to airdrop')
            } finally {
                this.setState({ airdroping: false })
            }
        } else if (provider instanceof TronWeb) {
            this.setState({ airdroping: true })
            try {
                batchAirdropTRX(provider,
                    privateKey,
                    addresses,
                    _amountEach,
                    this.state.batchSize,
                    async (txHash: string) => {
                        console.log('tx', txHash)
                        this.setState({ currentAirdropTx: txHash })
                    })
            } catch (error) {
                console.error('Failed to airdrop:', error)
                toaster.danger('Failed to airdrop')
            } finally {
                this.setState({ airdroping: false })
            }
        }

    }

    render() {
        const { isLoading } = this.state
        return <Pane>
            <Heading size={700}>Airdrop Gas</Heading>
            <Pane className="margin-top-md">
                <Group className="items-center">
                    <Select marginRight={16} width="150px" onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        this.setState({
                            selectedChain: this.state.chains.find(chain =>
                                chain.chainId === parseInt(e.target.value)
                            ) || null,
                            usdtContract: this.state.chains.find(chain =>
                                chain.chainId === parseInt(e.target.value)
                            )?.usdtContracts[0] || null
                        }, () => {
                            this.getGasPrice()
                            this.doQuery()
                        })}
                    >
                        {this.state.chains.map(chain => (
                            <option key={chain.chainId} value={chain.chainId}>
                                {chain.chainName}
                            </option>
                        ))}
                    </Select>
                    <Select marginRight={16} width="150px" onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        this.setState({
                            usdtContract: this.state.chains.find(chain =>
                                chain.chainId === parseInt(e.target.value)
                            )?.usdtContracts?.find(contract =>
                                contract.address === e.target.value
                            ) || null
                        }, () => {
                            this.getGasPrice()
                            this.doQuery()
                        })
                    }}
                    >
                        {this.state.selectedChain?.usdtContracts?.map(contract => (
                            <option key={contract.address} value={contract.address}>
                                {contract.symbol}
                            </option>
                        ))}
                    </Select>
                    <span className="text-gray-500 margin-right-sm text-sm ">More Than ($):</span>
                    <TextInput width="100px" type="number" placeholder="Amount more than " value={this.state.amountThreshold} onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ amountThreshold: Number(e.target.value) })} marginRight={16} />
                    {/* <IconButton icon={isLoading ? Spinner : SearchIcon} isLoading={isLoading} intent="success" onClick={this.doQuery} /> */}
                    <Button marginRight={16} intent="success" onClick={this.doQuery}>Filter</Button>
                </Group>
            </Pane>
            <Pane className="margin-top-md">
                <div className='flex gap-md justify-evenly'>
                    <DataCard
                        title="Gas Price"
                        value={this.state.gasPrice}
                        unit="Gwei"
                        color="orange"
                    />
                    <DataCard
                        title="Addresses"
                        value={this.state.totalWallets}
                        unit="addresses"
                        color="blue"
                    />
                    <DataCard
                        title="Total USDT"
                        value={this.state.sumBalance ? ethers.formatUnits(this.state.sumBalance.toString(), this.state.usdtContract?.decimals || 18) : 0}
                        unit="USDT"
                        color="green"
                    />
                </div>
                <div className="margin-top-md">
                    <Button appearance="primary" intent="success" onClick={() => this.setState({ showAirdropDialog: true })} disabled={this.state.walletsBalance.length === 0}>Execute Airdrop</Button>
                </div>
            </Pane>
            <Pane className="margin-top-md">
                <Table>
                    <Table.Head>
                        <Table.TextHeaderCell>Address</Table.TextHeaderCell>
                        <Table.TextHeaderCell>
                            {this.state.selectedChain?.chainId === 56 ? 'BNB' : this.state.selectedChain?.chainId === 728126428 ? 'TRX' : 'ETH'}
                        </Table.TextHeaderCell>
                        <Table.TextHeaderCell> {this.state.usdtContract?.symbol}
                        </Table.TextHeaderCell>
                    </Table.Head>
                    <Table.Body height="calc(100vh - 350px)">
                        {this.state.walletsBalance.map((wallet: EthBalance) => (
                            <Table.Row key={wallet.address}>
                                <Table.TextCell>{wallet.address}</Table.TextCell>
                                <Table.TextCell>{
                                    wallet.ethBalance ? ethers.formatUnits(wallet.ethBalance, this.currentDecimals()) : 0
                                }</Table.TextCell>
                                <Table.TextCell><span className="text-green-500">{
                                    ethers.formatUnits(wallet.balance, this.state.usdtContract?.decimals || 18)
                                }</span>
                                </Table.TextCell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </Pane>
            <Dialog
                isShown={this.state.showAirdropDialog}
                onCloseComplete={() => this.setState({ showAirdropDialog: false })}
                onConfirm={() => this.doAirdrop()}
                title="Airdrop"
            >
                <Pane>
                    <TextInputField 
                        required
                        label={`Each airdrop amount (${this.state.selectedChain?.chainId === 56 ? 'BNB' :
                        this.state.selectedChain?.chainId === 728126428 ? 'TRX' :
                            'ETH'
                        })`} placeholder="Amount" value={this.state.amountEach} onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ amountEach: Number(e.target.value) })} />
                    <TextInputField
                        required
                        label="Gas Price(Gwei)" placeholder="Gas Price" value={this.state.gasPrice} onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ gasPrice: Number(e.target.value) })} />
                    <TextInputField
                        required
                        label="Private Key"
                        placeholder="Enter private key"
                        type="password"
                        onChange={this.onPrivateKeyChange}
                        description="The private key of the wallet that will be used to airdrop."
                    />
                    <Alert intent="none" title="Airdrop Task Information">
                        <p className="text-sm">
                            <div>From: {this.state.fromAddress}  </div>
                            <div>Balance: {this.state.fromAddressBalance ? ethers.formatUnits(this.state.fromAddressBalance, this.currentDecimals()) : 0}</div>
                            <div>Total amount: {this.state.totalWallets * this.state.amountEach} {this.state.selectedChain?.chainId === 56 ? 'BNB' :
                                this.state.selectedChain?.chainId === 728126428 ? 'TRX' :
                                    'ETH'
                            }   </div>
                            <div>Each tx gas: {this.state.estimatedCost ? ethers.formatUnits(this.state.estimatedCost, this.currentDecimals()) : 0} {this.state.selectedChain?.chainId === 56 ? 'BNB' :
                                this.state.selectedChain?.chainId === 728126428 ? 'TRX' :
                                    'ETH'
                            }</div>
                            <div>Total transactions: {Math.ceil(this.state.totalWallets / this.state.batchSize)}</div>
                        </p>
                    </Alert>
                </Pane>
            </Dialog>

            <Overlay isShown={this.state.airdroping}>
                <Pane display='flex' justifyContent='center' alignItems='center' height='100%'>
                    <Spinner size={40} marginRight={16}  />
                    <div>Processing...{this.state.currentAirdropTx}</div>
                </Pane>
            </Overlay>
        </Pane>
    }
}

export default Airdrop  