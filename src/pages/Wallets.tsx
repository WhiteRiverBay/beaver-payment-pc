import { Pane, SelectMenu, Button, Table, Dialog, TextInputField } from 'evergreen-ui'
import { ethers } from 'ethers'
import React from 'react'
import { Network } from '../model/network'
import { DEFAULT_NETWORKS } from '../config/const'
import { ChainType } from '../model/chain'
import { getChains, getWallets } from '../api/api'
import { WalletBalance, WalletType } from '../model/wallet'
import { getProvider } from '../api/web3'
import { batchGetERC20Balances, batchGetETHBalances } from '../api/multicall'

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
    total: number
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
            total: 0
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
            } else {
                this.setState({ networks: DEFAULT_NETWORKS })
                // set selected network to the first one
                this.setState({ selectedNetwork: DEFAULT_NETWORKS[0] })
                this.loadWallets(DEFAULT_NETWORKS[0])
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
            console.log('loadWallets:', network.chainType)
            window.electron.send('getWallets', network.chainType)
        } else {
            console.error('window.electron is not defined or does not have a send method')
        }
    }
    // load wallet balances
    loadWalletBalances = async (network: Network, wallets: WalletType[]) => {
        const provider = getProvider(network)
        if (network.chainType.toLowerCase() === 'evm') {
            batchGetETHBalances(
                provider as ethers.JsonRpcProvider, 
                network.chainId.toString(),
                wallets.map(wallet => wallet.address), 
                (balances) => {
                    // save balances to db
                    window.electron.send('saveWalletBalances', balances)
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
                        }
                    )
                }   
            }
        } else {
        }   
    }

    init = async () => {
        if (window.electron && window.electron.on) {
            window.electron.on('getWallets', (_event: any, wallets: WalletType[]) => {
                console.log('wallets:', wallets)
                this.setState({ wallets })
            })  
            window.electron.on('saveOrUpdateWalletBalance', (_event: any, walletBalance: WalletBalance) => {
                console.log('walletBalance:', walletBalance)
                // load wallets
                if (this.state.selectedNetwork) { 
                    this.loadWallets(this.state.selectedNetwork)
                }
            })
        } else {
            console.error('window.electron is not defined or does not have a send method')
        }
    }

    getBalance = (wallet: WalletType, chainId: string | undefined, contractAddress: string, decimals: number) => {
        if (!chainId) return 0;
        const balance = wallet.balances?.find(balance => balance.chainId === chainId && balance.contractAddress === contractAddress)
        return balance ? ethers.formatUnits(balance.balance + "", decimals) : 0
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
                        <Button appearance='primary' size='large' intent='success' marginRight={10}>Airdrop</Button>
                        <Button appearance='primary' size='large' intent='success' marginRight={10}>Collect</Button>
                        <Button size='large' intent='none' marginRight={10} onClick={() => {
                            if (this.state.selectedNetwork && this.state.wallets) {
                                this.loadWalletBalances(this.state.selectedNetwork, this.state.wallets)
                            }
                        }}>Refresh</Button>
                    </div>
                </Pane>
                <Pane className='margin-top-md'>

                    <Table>
                        <Table.Head>
                            <Table.TextHeaderCell>Address</Table.TextHeaderCell>
                            <Table.TextHeaderCell textAlign='right'>ETH</Table.TextHeaderCell>
                            {this.state.selectedNetwork && this.state.chains?.find(chain => chain.chainId === this.state.selectedNetwork?.chainId)?.usdtContracts?.map(contract => (
                                <Table.TextHeaderCell textAlign='right' key={contract.symbol}>{contract.symbol}</Table.TextHeaderCell>
                            ))}
                        </Table.Head>
                        <Table.Body>
                            {this.state.wallets.map((wallet, index) => (
                                <Table.Row key={index}>
                                    <Table.TextCell color='gray'>{wallet.address.slice(0,8)}...{wallet.address.slice(-6)}</Table.TextCell>
                                    <Table.TextCell color='gray' textAlign='right'>
                                        {this.getBalance(wallet, this.state.selectedNetwork?.chainId.toString(), '', 18)}
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
            </Pane>
        )
    }
}

export default Wallets