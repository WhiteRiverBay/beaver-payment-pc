import { Heading, Pane, TabNavigation, Tab, Button, Dialog, TextInputField, Alert } from 'evergreen-ui'
import React from 'react'
import { Network } from '../model/network'
import { DEFAULT_NETWORKS } from '../config/const'

interface SettingsProps {

}

interface SettingsState {
    tabs: string[],
    selectedTab: number,
    tabMapping: { [key: number]: React.ComponentType<any> },
}

class Settings extends React.Component<SettingsProps, SettingsState> {
    constructor(props: SettingsProps) {
        super(props)
        this.state = {
            tabs: ['Network Settings', 'Server Settings'],
            selectedTab: 0,
            tabMapping: {
                0: NetworkSettings,
                1: ServerSettings,
            },
        }
    }

    render() {
        return (
            <Pane>
                <Heading size={700}>Settings</Heading>
                {/* 顶部列表（Network Settings, ） */}
                <Pane style={{ marginTop: 20 }}>
                    <TabNavigation>
                        {/* for each tab, render a Tab */}
                        {this.state.tabs.map((tab, index) => (
                            <Tab key={tab} title={tab}
                                isSelected={this.state.selectedTab === index}
                                onSelect={() => this.setState({ selectedTab: index })}
                            >
                                {tab}
                            </Tab>
                        ))}
                    </TabNavigation>
                </Pane>

                {/* 内容区域 */}
                <Pane 
                    flex={1} 
                    background="white" 
                    width="100%" 
                    height="calc(100vh - 100px)" 
                    overflow="auto"
                >
                    {React.createElement(this.state.tabMapping[this.state.selectedTab])}
                </Pane>
            </Pane>
        )
    }
}

interface NetworkSettingsState {
    networks: Network[],
    showAddNetwork: boolean,
    showEditNetwork: boolean,
    showDeleteNetwork: boolean,
    selectedNetwork: Network | null,
    message: string,
}

class NetworkSettings extends React.Component<{}, NetworkSettingsState> {
    constructor(props: {}) {
        super(props)
        this.state = {
            networks: [],
            showAddNetwork: false,
            showEditNetwork: false,
            showDeleteNetwork: false,
            selectedNetwork: null,
            message: '',
        }
    }

    componentDidMount() {
        this.loadNetworks()
    }

    saveNetworks = async () => {
        // save networks
        try {
            localStorage.setItem('networks', JSON.stringify(this.state.networks))
        } catch (error) {
            console.error('Failed to save networks:', error)
        }
    }

    loadNetworks = async () => {
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

    onEdit = (network: Network) => {
        this.setState({ showEditNetwork: true, selectedNetwork: network })
    }

    onDelete = (network: Network) => {
        this.setState({ showDeleteNetwork: true, selectedNetwork: network })
    }

    render() {
        return (
            <Pane className="margin-top-md">
                {/* <Button intent='success' appearance='primary' className="margin-bottom-md" onClick={() => this.setState({ showAddNetwork: true })}>
                    Add Network
                </Button> */}
                <div className="margin-top-md">
                    {this.state.networks.map((network) => (
                        <NetworkSettingItem key={network.chainId} network={network} onEdit={this.onEdit} onDelete={this.onDelete} />
                    ))}
                </div>
                <Dialog
                    title={this.state.message}
                    isShown={this.state.message !== ''}
                    onCloseComplete={() => this.setState({ message: '' })}
                    hasFooter={false}
                >
                    <center>
                        <Button appearance="primary" intent="success" onClick={() => this.setState({ message: '' })}>OK</Button>
                    </center>
                </Dialog>
                {this.state.showDeleteNetwork && this.state.selectedNetwork && (
                    <Dialog
                        isShown={this.state.showDeleteNetwork}
                        title={`Are you sure you want to delete network "${this.state.selectedNetwork.name}"?`}
                        intent="danger"
                        onCloseComplete={() => this.setState({ showDeleteNetwork: false })}
                        confirmLabel="Delete"
                        onConfirm={() => {
                            this.setState(prevState => ({
                                networks: prevState.networks.filter(n => n.chainId !== this.state.selectedNetwork?.chainId),
                                showDeleteNetwork: false
                            }), () => {
                                this.saveNetworks()
                            })
                        }}
                        hasFooter={false}
                    >
                        <center>
                            <Button intent="" marginRight={10} onClick={() => this.setState({ showDeleteNetwork: false })}>Cancel</Button>
                            <Button intent="danger" onClick={() => {
                                this.setState(prevState => ({
                                    networks: prevState.networks.filter(n => n.chainId !== this.state.selectedNetwork?.chainId),
                                    showDeleteNetwork: false
                                }), () => {
                                    this.saveNetworks()
                                })
                            }}>Delete</Button>
                        </center>
                    </Dialog>
                )}
                {this.state.showAddNetwork && (
                    <AddNetwork 
                        show={this.state.showAddNetwork}
                        onClose={() => this.setState({ showAddNetwork: false })}
                        onAdd={(network) => {
                            // if chain id exists , error
                            if (this.state.networks.some(n => n.chainId === network.chainId)) {
                                this.setState({ message: 'Chain ID already exists' })
                                return
                            }
                            this.setState(prevState => ({
                                networks: [...prevState.networks, {...network, chainType: 'EVM'}],
                                showAddNetwork: false
                            }), () => {
                                this.saveNetworks()
                            })
                        }}
                    />
                )}

                {this.state.showEditNetwork && this.state.selectedNetwork && (
                    <EditNetwork
                        network={this.state.selectedNetwork}
                        onClose={() => this.setState({ showEditNetwork: false })}
                        onSave={(network: Network) => {
                            this.setState(prevState => ({
                                networks: prevState.networks.map(n => n.chainId === network.chainId ? network : n),
                                showEditNetwork: false
                            }), () => {
                                this.saveNetworks()
                            })
                        }}
                        show={this.state.showEditNetwork}
                    />
                )}
            </Pane>
        )
    }
}

interface AddNetworkProps {
    onClose: () => void,
    onAdd: (network: {
        chainId: number,
        name: string,
        rpc: string,
        symbol: string,
        decimals: number,
        browser: string
    }) => void,
    show: boolean,
}

interface AddNetworkState {
    name: string,
    rpc: string,
    chainId: number,
    symbol: string,
    decimals: number,
    browser: string,
    error: string,
}

class AddNetwork extends React.Component<AddNetworkProps, AddNetworkState> {
    constructor(props: AddNetworkProps) {
        super(props)
        this.state = {
            name: '',
            rpc: '',
            chainId: 0,
            symbol: '',
            decimals: 0,
            browser: '',
            error: '',
        }
    }
    doAdd = async () => {
        if (!this.state.name) {
            this.setState({ error: 'Network name is required' })
            return
        }
        if (!this.state.rpc) {
            this.setState({ error: 'RPC URL is required' })
            return
        }
        if (!this.state.chainId) {
            this.setState({ error: 'Chain ID is required' })
            return
        }
        if (!this.state.symbol) {
            this.setState({ error: 'Currency symbol is required' })
            return
        }
        if (!this.state.browser) {
            this.setState({ error: 'Block explorer URL is required' })
            return
        }
        if (!this.state.decimals) {
            this.setState({ error: 'Decimals is required' })
            return
        }
        this.props.onAdd(this.state)
    }
    render() {
        return (
            <Pane>
                <Dialog 
                    title="Add Network"
                    preventBodyScrolling
                    hasFooter={false}
                isShown={this.props.show} onCloseComplete={this.props.onClose} >
                    {this.state.error && (
                        <Alert intent="danger" title="Error" marginBottom={16}>
                            {this.state.error}
                        </Alert>
                    )}
                    <form onSubmit={this.doAdd}>
                        <TextInputField
                            label="Network Name"
                            placeholder="e.g. Ethereum"
                            required
                            value={this.state.name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ name: e.target.value })}
                        />
                        <TextInputField
                            label="RPC URL"
                            placeholder="e.g. https://mainnet.infura.io/v3/YOUR-PROJECT-ID" 
                            required
                            value={this.state.rpc}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ rpc: e.target.value })}
                        />
                        <TextInputField
                            label="Chain ID"
                            placeholder="e.g. 1"
                            type="nu    mber"
                            required
                            value={this.state.chainId}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ chainId: parseInt(e.target.value) })}
                        />
                        <TextInputField
                            label="Currency Symbol"
                            placeholder="e.g. ETH"
                            required
                            value={this.state.symbol}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ symbol: e.target.value })}
                        />
                        <TextInputField
                            label="Block Explorer URL"
                            placeholder="e.g. https://etherscan.io"
                            value={this.state.browser}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ browser: e.target.value })}
                        />
                        <TextInputField
                            label="Decimals"
                            placeholder="e.g. 18"
                            type="number"
                            required
                            value={this.state.decimals}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ decimals: parseInt(e.target.value) })}
                        />
                        <Button appearance="primary" intent="success" type="submit">
                            Add Network
                        </Button>
                    </form>
                </Dialog>
            </Pane>
        )
    }
}   

interface EditNetworkProps {
    network: Network,
    onClose: () => void,
    onSave: (network: Network) => void,
    show: boolean,
}

interface EditNetworkState {
    name: string,
    rpc: string,
    chainId: number,
    symbol: string,
    decimals: number,
    browser: string,
    error: string,
}

class EditNetwork extends React.Component<EditNetworkProps, EditNetworkState> {
    constructor(props: EditNetworkProps) {
        super(props)
        this.state = {
            name: props.network.name,
            rpc: props.network.rpc,
            chainId: props.network.chainId,
            symbol: props.network.symbol,
            decimals: props.network.decimals,
            browser: props.network.browser,
            error: '',
        }
    }

    doSave = async () => {
        if (!this.state.name) {
            this.setState({ error: 'Network name is required' })
            return
        }
        if (!this.state.rpc) {
            this.setState({ error: 'RPC URL is required' })
            return
        }   
        if (!this.state.chainId) {
            this.setState({ error: 'Chain ID is required' })
            return
        }   
        if (!this.state.symbol) {
            this.setState({ error: 'Currency symbol is required' })
            return
        }
        if (!this.state.browser) {
            this.setState({ error: 'Block explorer URL is required' })
            return
        }   
        if (!this.state.decimals) {
            this.setState({ error: 'Decimals is required' })
            return
        }
        const network: Network = {
            ...this.state,
            chainType: this.props.network.chainType
        }
        this.props.onSave(network)
    }

    render() {
        return (
            <Pane>
                <Dialog title="Edit Network" isShown={this.props.show} onCloseComplete={this.props.onClose} hasFooter={false}   >
                    {this.state.error && (
                        <Alert intent="danger" title="Error" marginBottom={16}>
                            {this.state.error}
                        </Alert>
                    )}
                    <form onSubmit={this.doSave}>
                        <TextInputField label="Network Name" value={this.state.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ name: e.target.value })} />
                        <TextInputField label="RPC URL" value={this.state.rpc} onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ rpc: e.target.value })} />
                        <TextInputField label="Chain ID" value={this.state.chainId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ chainId: parseInt(e.target.value) })} />
                        <TextInputField label="Currency Symbol" value={this.state.symbol} onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ symbol: e.target.value })} />
                        <TextInputField label="Block Explorer URL" value={this.state.browser} onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ browser: e.target.value })} />
                        <TextInputField label="Decimals" value={this.state.decimals} onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ decimals: parseInt(e.target.value) })} />
                        <Button appearance="primary" intent="success" type="submit">
                            Save
                        </Button>
                    </form>
                </Dialog>
            </Pane>
        )
    }
}


interface NetworkSettingItemProps {
    network: Network
    onEdit: (network: Network) => void,
    onDelete: (network: Network) => void,
}

class NetworkSettingItem extends React.Component<NetworkSettingItemProps, {}> {
    render() {
        return (
            <Pane className="flex justify-between items-center text-gray-700 border-radius-md border padding-md margin-bottom-md">
                <div>
                    <div className='text-lg'>{this.props.network.name}</div>
                    <div className='text-sm text-gray-500'>{this.props.network.rpc}</div>
                    <div className='text-sm text-gray-500'>{this.props.network.symbol}</div>
                </div>
                <div>
                    <Button intent='success' marginRight={10} onClick={() => this.props.onEdit(this.props.network)}>Edit</Button>
                    {/* <Button intent='danger' onClick={() => this.props.onDelete(this.props.network)}>Delete</Button> */}
                </div>
            </Pane>
        )
    }
}

interface ServerSettingsProps {

}

interface ServerSettingsState {
    serverUrl: string,
    apiToken: string,
    tronApiKey: string,
    error: string,
}

class ServerSettings extends React.Component<ServerSettingsProps, ServerSettingsState> {
    constructor(props: ServerSettingsProps) {
        super(props)
        this.state = {
            serverUrl: '',
            apiToken: '',
            tronApiKey: '',
            error: '',
        }
    }
    
    loadServerUrl = async () => {
        const serverUrl = localStorage.getItem('serverUrl')
        if (serverUrl) {
            this.setState({ serverUrl })
        }
    }

    loadApiToken = async () => {
        const apiToken = localStorage.getItem('apiToken')
        if (apiToken) {
            this.setState({ apiToken })
        }
    }   

    loadTronApiKey = async () => {
        const tronApiKey = localStorage.getItem('tronApiKey')
        if (tronApiKey) {
            this.setState({ tronApiKey })
        }
    }

    saveServerUrl = async () => {
        localStorage.setItem('serverUrl', this.state.serverUrl)
    }

    saveApiToken = async () => {
        localStorage.setItem('apiToken', this.state.apiToken)
    }

    saveTronApiKey = async () => {
        localStorage.setItem('tronApiKey', this.state.tronApiKey)
    }

    doUpdate = async () => {
        this.saveServerUrl()
        this.saveApiToken()
        this.saveTronApiKey()
    }

    componentDidMount() {
        this.loadServerUrl()
        this.loadApiToken()
        this.loadTronApiKey()
    }

    render() {
        return (
            <Pane className='margin-top-md'>
                <form onSubmit={this.doUpdate}>
                    <TextInputField label="Server URL" value={this.state.serverUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ serverUrl: e.target.value })} />
                    <TextInputField label="API Token" value={this.state.apiToken} onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ apiToken: e.target.value })} type="password"     />
                    <TextInputField label="Tron API Key" value={this.state.tronApiKey} onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.setState({ tronApiKey: e.target.value })} type="password"     />  
                    <Button appearance="primary" intent="success" type="submit">
                        Update
                    </Button>
                </form>
            </Pane>
        )
    }
}

export default Settings