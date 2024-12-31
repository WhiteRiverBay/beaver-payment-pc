import { Pane, SelectMenu, Button, Table, Dialog, TextInputField, Overlay, Spinner } from 'evergreen-ui'
import { ethers } from 'ethers'
import { TronWeb } from 'tronweb'
import React from 'react'
import { Network } from '../model/network'
import { DEFAULT_NETWORKS } from '../config/const'
import { ChainType } from '../model/chain'
import { getChains, getWallets } from '../api/api'
import { WalletBalance, WalletType } from '../model/wallet'
import { getProvider } from '../api/web3'
import { batchGetERC20Balances, batchGetETHBalances, batchGetTRONERC20Balances, batchGetTRXBalances } from '../api/multicall'
import DataCard from '../component/DataCard'

interface WalletsProps {
}
interface WalletsState {
    networks: Network[],
    selectedNetwork: Network | null,
    chains: ChainType[],
    wallets: WalletType[],
    showGAInput: boolean,
    gaCode: string,
    page: number,
    pageSize: number,
    total: number,
    loading: boolean,
    totalBalanceByContractAddress: { [key: string]: number },
}

class Wallets extends React.Component<WalletsProps, WalletsState> {
    constructor(props: WalletsProps) {
        super(props)
        this.state = {
            networks: [],
            selectedNetwork: null,
            chains: [],
            wallets: [],
            showGAInput: false,
            gaCode: '',
            page: 1,
            pageSize: 10,
            total: 0,
            loading: false,
            totalBalanceByContractAddress: {}
        }
    }

    componentDidMount() {
        this.loadNetworks()
        this.loadChains()
        this.init()
    }

    loadChains = async () => {
        const serverUrl = localStorage.getItem('serverUrl')
        if (serverUrl) {
            const chains = await getChains(serverUrl)
            this.setState({ chains })
        }
    }

    loadNetworks = async () => {
        try {
            const networksJson = localStorage.getItem('networks')
            if (networksJson) {
                const networks = JSON.parse(networksJson)
                this.setState({ networks })
                // set selected network to the first one
                this.setState({ selectedNetwork: networks[0] })
                this.loadWallets(networks[0])
                this.loadTotalBalance(networks[0])
            } else {
                this.setState({ networks: DEFAULT_NETWORKS })
                // set selected network to the first one
                this.setState({ selectedNetwork: DEFAULT_NETWORKS[0] })
                this.loadWallets(DEFAULT_NETWORKS[0])
                this.loadTotalBalance(DEFAULT_NETWORKS[0])
            }
        } catch (error) {
            console.error('Failed to load networks:', error)
        }
    }

    handleNetworkChange = (chainId: number) => {
        const network = this.state.networks.find(network => network.chainId === chainId)
        if (network) {
            this.setState({ selectedNetwork: network, wallets: [] })
            this.loadWallets(network)
            this.loadTotalBalance(network)
        }
    }

    loadTotalBalance = async (network: Network) => {
        if (window.electron && window.electron.send) {
            window.electron.send('sumWalletBalanceByChainIdAndContractAddress', network.chainId.toString())
        }
    }

    syncWallets = async () => {
        const gaCode = this.state.gaCode
        if (!gaCode) {
            return
        }

        const serverUrl = localStorage.getItem('serverUrl')
        const apiToken = localStorage.getItem('apiToken')
        const network = this.state.selectedNetwork
        if (serverUrl && apiToken && network) {
            const wallets = await getWallets(serverUrl, network.chainType, apiToken, gaCode)
            // save wallets to db
            window.electron.send('saveWallets', wallets.map(wallet => ({
                ...wallet,
                chainType: network.chainType
            })))
            this.loadWallets(network)
        }
        this.setState({ showGAInput: false })
    }
    // load wallets from db
    loadWallets = async (network: Network) => {
        if (window.electron && window.electron.send) {
            window.electron.send('getWallets', network.chainType)
        } else {
            console.error('window.electron is not defined or does not have a send method')
        }
    }
    // load wallet balances
    loadWalletBalances = async (network: Network, wallets: WalletType[]) => {
        this.setState({ loading: true })
        const provider = getProvider(network, '01')
        if (network.chainType.toLowerCase() === 'evm') {
            batchGetETHBalances(
                provider as ethers.JsonRpcProvider,
                network.chainId.toString(),
                wallets.map(wallet => wallet.address),
                (balances) => {
                    // save balances to db
                    window.electron.send('saveWalletBalances', balances)
                    this.setState({ loading: false })
                }
            )

            const usdtContracts = this.state.chains?.find(chain => chain.chainId === network.chainId)?.usdtContracts
            if (usdtContracts) {
                for (const contract of usdtContracts) {
                    batchGetERC20Balances(
                        provider as ethers.JsonRpcProvider,
                        wallets.map(wallet => wallet.address),
                        network.chainId.toString(),
                        contract.address,
                        (balances: WalletBalance[]) => {
                            // save balances to db
                            window.electron.send('saveWalletBalances', balances)
                            this.setState({ loading: false })
                        }
                    )
                }
            }
        } else if (network.chainType.toLowerCase() === 'tron') {
            batchGetTRXBalances(
                provider as TronWeb,
                wallets.map(wallet => wallet.address),
                (balances) => {
                    // save balances to db
                    window.electron.send('saveWalletBalances', balances)
                    this.setState({ loading: false })
                }
            )
            const usdtContracts = this.state.chains?.find(chain => chain.chainId === network.chainId)?.usdtContracts
            if (usdtContracts) {
                for (const contract of usdtContracts) {
                    batchGetTRONERC20Balances(
                        provider as TronWeb,
                        contract.address,
                        wallets.map(wallet => wallet.address),
                        (balances) => {
                            // save balances to db
                            window.electron.send('saveWalletBalances', balances)
                            this.setState({ loading: false })
                        }
                    )
                }
            }
        }
    }

    onGetWallets = (_event: any, wallets: WalletType[]) => {
        this.setState({ wallets })
    }

    onSaveOrUpdateWalletBalance = (_event: any, _walletBalance: WalletBalance) => {
        // load wallets
        if (this.state.selectedNetwork) {
            this.loadWallets(this.state.selectedNetwork)
        }
    }

    onSumWalletBalanceByChainIdAndContractAddress = (_event: any, balanceRows: any[]) => {
        const balanceMap = Object.values(balanceRows).reduce((acc: { [key: string]: number }, row: any) => {
            acc[row.contractAddress] = Number(row['SUM(balance)'])
            return acc
        }, {})
        this.setState({ totalBalanceByContractAddress: balanceMap })
    }

    init = async () => {
        if (window.electron && window.electron.on) {
            window.electron.on('getWallets', this.onGetWallets)
            window.electron.on('saveOrUpdateWalletBalance', this.onSaveOrUpdateWalletBalance)
            window.electron.on('sumWalletBalanceByChainIdAndContractAddress', this.onSumWalletBalanceByChainIdAndContractAddress)
        } else {
            console.error('window.electron is not defined or does not have a send method')
        }
    }
    componentWillUnmount() {
        if (window.electron && window.electron.removeAllListeners) {
            window.electron.removeAllListeners('getWallets')
            window.electron.removeAllListeners('saveOrUpdateWalletBalance')
            window.electron.removeAllListeners('sumWalletBalanceByChainIdAndContractAddress')
        }
    }

    getBalance = (wallet: WalletType, chainId: string | undefined, contractAddress: string, decimals: number) => {
        if (!chainId) return 0;
        const balance = wallet.balances?.find(balance => balance.chainId === chainId && balance.contractAddress === contractAddress)
        return balance ? ethers.formatUnits(balance.balance + "", decimals) : 0
    }

    formatBalance = (balance: number, decimals: number) => {
        if (balance === 0) return 0
        return ethers.formatUnits(balance + "", decimals)
    }

    render() {
        return (
            <Pane>
                <Pane className=''>
                    <SelectMenu
                        options={this.state.networks.map(network => ({
                            label: network.name,
                            value: network.chainId
                        }))}
                        hasFilter={false}
                        onSelect={(item) => this.handleNetworkChange(item.value as number)}
                    >
                        <Button>
                            {this.state.selectedNetwork?.name}
                        </Button>
                    </SelectMenu>
                </Pane>
                <Pane className='margin-top-md'>
                    <div>
                        <Button appearance='primary' size='large' intent='primary' marginRight={10}
                            onClick={() => this.setState({ showGAInput: true })}
                        >Sync</Button>
                        <Button size='large' intent='none' marginRight={10} onClick={() => {
                            if (this.state.selectedNetwork && this.state.wallets) {
                                this.loadWalletBalances(this.state.selectedNetwork, this.state.wallets)
                            }
                        }}>Refresh Balance</Button>
                    </div>
                </Pane>
                <Pane>
                    <div className='flex gap-md justify-evenly'>
                        <DataCard
                            title={this.state.selectedNetwork?.symbol ?? ''}
                            value={this.formatBalance(this.state.totalBalanceByContractAddress[''] ?? 0, this.state.selectedNetwork?.decimals ?? 18)}
                            unit=""
                            color="blue"
                        />
                        {this.state.selectedNetwork && this.state.chains?.find(chain => chain.chainId === this.state.selectedNetwork?.chainId)?.usdtContracts?.map(contract => (
                            <DataCard key={contract.symbol} title={contract.symbol} value={this.formatBalance(this.state.totalBalanceByContractAddress[contract.address] ?? 0, contract.decimals)} unit="" color="blue" />
                        ))}
                    </div>
                </Pane>
                <Pane className='margin-top-md'>

                    <Table>
                        <Table.Head>
                            <Table.TextHeaderCell>Address</Table.TextHeaderCell>
                            <Table.TextHeaderCell textAlign='right'>
                                {this.state.selectedNetwork?.symbol}
                            </Table.TextHeaderCell>
                            {this.state.selectedNetwork && this.state.chains?.find(chain => chain.chainId === this.state.selectedNetwork?.chainId)?.usdtContracts?.map(contract => (
                                <Table.TextHeaderCell textAlign='right' key={contract.symbol}>{contract.symbol}</Table.TextHeaderCell>
                            ))}
                        </Table.Head>
                        <Table.Body height="calc(100vh - 300px)">
                            {this.state.wallets.map((wallet, index) => (
                                <Table.Row key={index}>
                                    <Table.TextCell color='gray'>
                                        {wallet.address}
                                    </Table.TextCell>
                                    <Table.TextCell color='gray' textAlign='right'>
                                        {this.getBalance(wallet, this.state.selectedNetwork?.chainId.toString(), '', this.state.selectedNetwork?.decimals ?? 18)}
                                    </Table.TextCell>
                                    {this.state.selectedNetwork && this.state.chains?.find(chain => chain.chainId === this.state.selectedNetwork?.chainId)?.usdtContracts?.map(contract => (
                                        <Table.TextCell color='gray' textAlign='right' key={contract.symbol}>
                                            {this.getBalance(wallet, this.state.selectedNetwork?.chainId.toString(), contract.address, contract.decimals)}
                                        </Table.TextCell>
                                    ))}
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </Pane>
                <Dialog
                    title="Google Authenticator Code"
                    isShown={this.state.showGAInput}
                    onCloseComplete={() => this.setState({ showGAInput: false })}
                    onConfirm={this.syncWallets}
                >
                    <form onSubmit={this.syncWallets}>
                        <TextInputField
                            label="Please enter the Google Authenticator code"
                            placeholder="GA Code"
                            value={this.state.gaCode}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ gaCode: e.target.value })}
                        />
                    </form>
                </Dialog>
                <Overlay isShown={this.state.loading}>
                    <Pane display='flex' justifyContent='center' alignItems='center' height='100%'>
                        <Spinner size={40} />
                    </Pane>
                </Overlay>
            </Pane>
        )
    }
}

export default Wallets