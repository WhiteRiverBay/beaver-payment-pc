import { Button, Dialog, FilePicker, Pane, SelectField, TextInputField, toaster } from "evergreen-ui";
import React from "react";
import { ChainType, UsdtContract } from "../model/chain";
import { Network } from "../model/network";
import { WalletBalance, WalletType } from "../model/wallet";
import { getChains } from "../api/api";
import { DEFAULT_NETWORKS } from "../config/const";
import { ethers } from "ethers";

interface CollectLog {
    message: string,
    timestamp: number,
    type: "info" | "error" | "success"
}

interface CollectProps {
}

interface CollectState {
    chains: ChainType[],
    networks: Network[],
    selectedChain: ChainType | null,
    selectedToken: UsdtContract | null,
    minimalAmountThreshold: number,
    toAddress: string,
    isCollecting: boolean,
    logs: CollectLog[],
    wallets: WalletType[]
    lastToAddress: string,

    totalJobs: number,
    completedJobs: number,
    errorJobs: number,
    ignoredJobs: number,

    showAdminPrivateKey: boolean,
    adminPrivateKey: string,
}

class Collect extends React.Component<CollectProps, CollectState> {
    constructor(props: CollectProps) {
        super(props);
        this.state = {
            chains: [],
            networks: [],
            selectedChain: null,
            selectedToken: null,
            minimalAmountThreshold: 1,
            toAddress: "",
            isCollecting: false,
            logs: [],
            wallets: [],
            lastToAddress: "",

            totalJobs: 0,
            completedJobs: 0,
            errorJobs: 0,
            ignoredJobs: 0,

            showAdminPrivateKey: false,
            adminPrivateKey: "",
        };
    }

    loadChains = async () => {
        const serverUrl = localStorage.getItem("serverUrl");
        if (!serverUrl) {
            return;
        }
        const chains = await getChains(serverUrl);
        this.setState({ chains, selectedChain: chains[0], selectedToken: chains[0].usdtContracts[0] });
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

    handleChainChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const chainId = parseInt(event.target.value);
        const chain = this.state.chains.find(chain => chain.chainId === chainId) || null;
        if (chain) {
            this.setState({ selectedChain: chain });
            this.setState({ selectedToken: chain.usdtContracts[0] });
        } else {
            toaster.danger("Failed to load chain");
        }
    }

    handleTokenChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const tokenAddress = event.target.value;
        const token = this.state.selectedChain?.usdtContracts.find(token => token.address === tokenAddress) || null;
        if (token) {
            this.setState({ selectedToken: token });
        }
    }

    startCollect = async () => {
        if (!this.state.adminPrivateKey) {
            toaster.danger("Admin private key is required");
            return;
        }
        this.setState({ isCollecting: true });
        this.setState({
            logs: [
                { message: "Start collecting task", type: "info", timestamp: Date.now() }
            ]
        });
        this.setState({ wallets: [] });
        try {
            window.electron.send("getWalletBalanceByChainIdAndContractAddressAndBalanceMoreThan", {
                chainId: this.state.selectedChain?.chainId + "",
                contractAddress: this.state.selectedToken?.address,
                balance: ethers.parseUnits(this.state.minimalAmountThreshold.toString(), this.state.selectedToken?.decimals || 18) + ""
            });
        } catch (error) {
            this.setState({ logs: [{ message: "Failed to get wallets", type: "error", timestamp: Date.now() }] });
        }
    }

    init = () => {
        if (window && window.electron) {
            window.electron.on("getWalletBalanceByChainIdAndContractAddressAndBalanceMoreThan", this.onWalletsLoaded);
            window.electron.on("getWalletByAddress", this.transfer);
        }
    }

    transfer = (_event: any, wallet: WalletType) => {
        // TODO: transfer
        const { logs } = this.state;
        logs.push({ message: "Transferring " + wallet.address, type: "info", timestamp: Date.now() });
        this.setState({ logs });
        
    }

    onWalletsLoaded = (_event: any, wallets: WalletBalance[], _total: number, _sumBalance: number) => {
        const total = wallets.length;
        this.setState({ totalJobs: total });
        this.setState({ completedJobs: 0 });
        this.setState({ errorJobs: 0 });
        this.setState({ ignoredJobs: 0 });
        this.setState({ logs: [{ message: "Start collecting task", type: "info", timestamp: Date.now() }] });

        wallets.forEach(wallet => {
            setTimeout(() => {
                window.electron.send("getWalletByAddress", wallet.address);
            }, 200 * wallets.indexOf(wallet));
        });
        this.setState({ isCollecting: false });
    }

    resetCollect = () => {
        this.setState({ isCollecting: false });
        this.setState({ logs: [] });
        this.setState({ wallets: [] });
        this.setState({ toAddress: "" });
        this.setState({ minimalAmountThreshold: 1 });
    }

    componentDidMount(): void {
        this.loadLocalNetworks();
        this.loadChains();
        const _last = localStorage.getItem("lastToAddress");
        if (_last) {
            this.setState({ lastToAddress: _last });
        }
        this.init();
    }

    componentWillUnmount(): void {
        window.electron.removeAllListeners("getWalletBalanceByChainIdAndContractAddressAndBalanceMoreThan");
        window.electron.removeAllListeners("getWalletByAddress");
    }
    render() {
        return <Pane>
            <Pane className="flex gap-md flex-column">
                <Pane background="tint2" border="muted" borderRadius={4} padding={16}>
                    <form>
                        <TextInputField label="Collect To" name="toAddress"
                            required
                            value={this.state.toAddress}
                            placeholder="The address to collect tokens to."
                            description={"Last to address: " + this.state.lastToAddress}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => this.setState({ toAddress: event.target.value })}
                        />
                        <SelectField required label="Chain" name="chain" onChange={this.handleChainChange}>
                            {this.state.chains.map((chain: ChainType) => (
                                <option key={chain.chainId} value={chain.chainId}>{chain.chainName}</option>
                            ))}
                        </SelectField>
                        <SelectField required label="Token" name="token" onChange={this.handleTokenChange}>
                            {this.state.selectedChain?.usdtContracts.map((token: UsdtContract) => (
                                <option key={token.address} value={token.address}>{token.symbol}</option>
                            ))}
                        </SelectField>
                        <TextInputField required label={'Minimal Amount Threshold (' + this.state.selectedToken?.symbol + ')'} description="The minimal amount of tokens to collect" placeholder="The minimal amount of tokens to collect" name="chain" value={this.state.minimalAmountThreshold} onChange={(event: React.ChangeEvent<HTMLInputElement>) => this.setState({ minimalAmountThreshold: parseInt(event.target.value) })} />
                        <Button marginRight={16} appearance="primary" intent="success" disabled={this.state.isCollecting} onClick={
                            () => {
                                this.setState({ showAdminPrivateKey: true });
                            }
                        } type="submit">Start Collect</Button>
                        <Button disabled={this.state.isCollecting} onClick={this.resetCollect} >Reset</Button>
                    </form>
                </Pane>
                <Pane background="tint2" border="muted" borderRadius={4} padding={16}>
                    <div style={{
                        height: "calc(100vh - 520px)",
                        overflow: "auto"
                    }}>
                        {this.state.logs.map((log, index) => (
                            <div key={index} className={log.type === "info" ? "text-info" : log.type === "error" ? "text-danger" : "text-success"}>{log.message}</div>
                        ))}
                    </div>
                </Pane>
                <Dialog
                    isShown={this.state.showAdminPrivateKey}
                    title="Select Admin Private Key"
                    onCloseComplete={() => this.setState({ showAdminPrivateKey: false })}
                    confirmLabel="Start Collect"
                    onConfirm={this.startCollect}
                >
                    <FilePicker
                        placeholder="Select Private Key"
                        required
                    >
                        <Button>Select Private Key</Button>
                    </FilePicker>
                </Dialog>
            </Pane>
        </Pane>
    }
}

export default Collect