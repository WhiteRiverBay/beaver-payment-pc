import React from "react";
import { Pane, Heading, Select, Group, TextInput, IconButton, SearchIcon, Spinner, Button, toaster, Table, Dialog, TextInputField, Alert } from "evergreen-ui";
import { ChainType, UsdtContract } from "../model/chain";
import { Network } from "../model/network";
import DataCard from "../component/DataCard";
import { EthBalance, WalletBalance } from "../model/wallet";
import { getChains } from "../api/api";
import { DEFAULT_NETWORKS } from "../config/const";
import { ethers } from "ethers";

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
            showAirdropDialog: true,
            batchSize: 250,
            privateKey: '',
            fromAddress: '',
            fromAddressBalance: 0n
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

    render() {
        const { isLoading } = this.state
        return <Pane>
            <Heading size={700}>Airdrop</Heading>
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
                    <Table.Body>
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
                title="Airdrop"
            >
                <Pane>
                    <TextInputField label={`Each airdrop amount (${this.state.selectedChain?.chainId === 56 ? 'BNB' :
                        this.state.selectedChain?.chainId === 728126428 ? 'TRX' :
                            'ETH'
                        })`} placeholder="Amount" value={this.state.amountEach} onChange={(e) => this.setState({ amountEach: Number(e.target.value) })} />
                    <TextInputField label="Gas Price(Gwei)" placeholder="Gas Price" value={this.state.gasPrice} onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ gasPrice: Number(e.target.value) })} />
                    <TextInputField
                        label="Private Key (System will not save this private key anywhere)"
                        placeholder="Enter private key"
                        type="password"
                    />
                    <Alert intent="none" title="Airdrop Task Information">
                        <p>
                            <div>From address: {this.state.fromAddress}  </div>
                            <div>Balance: {this.state.fromAddressBalance ? ethers.formatUnits(this.state.fromAddressBalance, this.currentDecimals()) : 0}</div>
                            <div>Total amount: {this.state.totalWallets * this.state.amountEach}</div>
                            <div>Estimated cost: {this.state.estimatedCost ? ethers.formatUnits(this.state.estimatedCost, this.currentDecimals()) : 0}</div>
                            <div>Total transactions: {Math.ceil(this.state.totalWallets / this.state.batchSize)}</div>
                        </p>
                    </Alert>
                </Pane>
            </Dialog>
        </Pane>
    }
}

export default Airdrop  