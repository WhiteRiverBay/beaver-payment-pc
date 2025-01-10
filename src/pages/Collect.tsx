import { Button, Dialog, Pane, SelectField, TextInputField, toaster } from "evergreen-ui";
import React from "react";
import { ChainType, UsdtContract } from "../model/chain";
import { Network } from "../model/network";
import { WalletBalance, WalletType } from "../model/wallet";
import { getChains } from "../api/api";
import { DEFAULT_NETWORKS } from "../config/const";
import { ethers, JsonRpcProvider } from "ethers";
import { getProvider, transferERC20, transferTRC20 } from "../api/web3";
import { TronWeb } from "tronweb";

interface CollectLog {
    message: string,
    timestamp: number,
    fromAddress: string | undefined,
    amount: bigint | undefined,
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
    gasPrice: string,
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
            gasPrice: "0",
        };
    }

    loadChains = async () => {
        const serverUrl = localStorage.getItem("serverUrl");
        if (!serverUrl) {
            return;
        }
        const chains = await getChains(serverUrl);
        this.setState({ chains, selectedChain: chains[0], selectedToken: chains[0].usdtContracts[0] });
        this.loadGasPrice(chains[0]);
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

    handleChainChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
        const chainId = parseInt(event.target.value);
        const chain = this.state.chains.find(chain => chain.chainId === chainId) || null;
        if (chain) {
            this.setState({ selectedChain: chain });
            this.setState({ selectedToken: chain.usdtContracts[0] });
            this.setState({ gasPrice: "0" });
            this.loadGasPrice(chain);
        } else {
            toaster.danger("Failed to load chain");
        }
    }

    loadGasPrice = async (chain: ChainType) => {
        const network = this.state.networks.find(network => network.chainId === chain.chainId);
        if (network) {
            const provider = getProvider(network, undefined);
            if (provider instanceof JsonRpcProvider) {
                const feeData = await provider.getFeeData();
                const gasPrice = feeData.gasPrice || 0n;
                this.setState({ gasPrice: ethers.formatUnits(gasPrice, "gwei") });
            } else {
                // For TronWeb, gas price is fixed at 420 sun (0.00042 TRX)
                this.setState({ gasPrice: provider.fromSun(420).toString() });
            }
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
        this.setState({ isCollecting: true, showAdminPrivateKey: false });
        this.setState({
            logs: [
                {
                    message: "Start collecting task",
                    type: "info",
                    timestamp: Date.now(),
                    fromAddress: undefined,
                    amount: undefined
                }
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
            this.setState({
                logs: [
                    {
                        message: "Failed to get wallets",
                        type: "error",
                        timestamp: Date.now(),
                        fromAddress: undefined,
                        amount: undefined
                    }
                ]
            });
        }
    }

    init = () => {
        if (window && window.electron) {
            window.electron.on("getWalletBalanceByChainIdAndContractAddressAndBalanceMoreThan", this.onWalletsLoaded);
            window.electron.on("getWalletByAddressWithPrivateKey", this.transfer);
            window.electron.on("selectedPrivateKeyFile", this.onReadFile);
        }
    }

    onReadFile = (_event: any, fileContent: string) => {
        this.setState({ adminPrivateKey: fileContent });
    }

    transfer = async (_event: any, wallet: WalletType, privateKey: string) => {
        // TODO: transfer
        const { logs } = this.state;

        if (!wallet.encryptedPrivateKey) {
            logs.push({
                message: "Wallet private key not found",
                type: "error",
                timestamp: Date.now(),
                fromAddress: wallet.address,
                amount: undefined
            });
            this.setState({ logs });
            return;
        }

        const network = this.state.networks.find(network => network.chainId === this.state.selectedChain?.chainId);
        if (!network) {
            logs.push({
                message: "Network not found",
                type: "error",
                timestamp: Date.now(),
                fromAddress: wallet.address,
                amount: undefined
            });
            this.setState({ logs });
            return;
        }

        const provider = getProvider(network, privateKey);
        const that = this;

        const onProcess = async (
            fromAddress: string, amount: bigint
        ): Promise<void> => {
            logs.push({
                message: "Transferring " + fromAddress + " " + amount,
                type: "info",
                timestamp: Date.now(),
                fromAddress: fromAddress,
                amount: amount
            });
            that.setState({ logs });
        }

        const onError = async (error: any, fromAddress: string, amount: bigint): Promise<void> => {
            logs.push({
                message: "Failed to transfer " + fromAddress + " " + amount + ": " + error,
                type: "error",
                timestamp: Date.now(),
                fromAddress: fromAddress,
                amount: amount
            });
            that.setState({ logs });
        }

        if (provider instanceof JsonRpcProvider) {
            const tx = await transferERC20(
                provider,
                privateKey,
                this.state.toAddress,
                this.state.selectedToken?.address || '',
                ethers.parseUnits(this.state.gasPrice, "gwei"),
                undefined,
                onProcess,
                onError
            );
            if (tx) {
                await tx.wait(1)
            }
        } else if (provider instanceof TronWeb) {
            const tx = await transferTRC20(
                provider,
                privateKey,
                this.state.toAddress,
                this.state.selectedToken?.address || '',
                onProcess,
                onError
            );
            if (tx) {
                await tx.wait(1)
            }
        }


        logs.push({
            message: "Transferring " + wallet.address,
            type: "info",
            timestamp: Date.now(),
            fromAddress: wallet.address,
            amount: undefined
        });
        this.setState({ logs });

    }

    onWalletsLoaded = (_event: any, wallets: WalletBalance[], _total: number, _sumBalance: number) => {
        const total = wallets.length;
        this.setState({ totalJobs: total });
        this.setState({ completedJobs: 0 });
        this.setState({ errorJobs: 0 });
        this.setState({ ignoredJobs: 0 });
        this.setState({
            logs: [{
                message: "Start collecting task",
                type: "info",
                timestamp: Date.now(),
                fromAddress: undefined,
                amount: undefined
            }]
        });

        wallets.forEach(wallet => {
            setTimeout(() => {
                window.electron.send("getWalletByAddressWithPrivateKey", { address: wallet.address, adminPrivateKey: this.state.adminPrivateKey });
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
        window.electron.removeAllListeners("getWalletByAddressWithPrivateKey");
        window.electron.removeAllListeners("selectedPrivateKeyFile");
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
                        <TextInputField required label={
                            this.state.selectedChain?.chainId === 728126428 ? "Energy Price (TRX)" : "Gas Price (Gwei)"
                        }
                            disabled={this.state.selectedChain?.chainId === 728126428}
                            placeholder="The gas price to use" name="gasPrice" value={this.state.gasPrice.toString()} onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                const value = event.target.value;
                                if (value === "") {
                                    this.setState({ gasPrice: "0" });
                                } else {
                                    this.setState({ gasPrice: value });
                                }
                            }} />
                        <Button marginRight={16} appearance="primary" intent="success" disabled={this.state.isCollecting} onClick={
                            () => {
                                this.setState({ showAdminPrivateKey: true });
                            }
                        } type="button">Start Collect</Button>
                        <Button disabled={this.state.isCollecting} onClick={this.resetCollect} type="reset" >Reset</Button>
                    </form>
                </Pane>
                <Pane background="tint2" border="muted" borderRadius={4} padding={16}>
                    <div style={{
                        height: "calc(100vh - 600px)",
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
                    isConfirmDisabled={!this.state.adminPrivateKey || this.state.adminPrivateKey === ""}
                >
                    <Button onClick={() => {
                        window.electron.send("openPrivateKeyFileDialog");
                    }}>Select Private Key</Button>
                    <div style={{
                        marginTop: 16,
                        color: this.state.adminPrivateKey ? 'green' : 'red'
                    }}>
                        {this.state.adminPrivateKey ? 'Loaded' : 'Not loaded'}
                    </div>
                </Dialog>
            </Pane>
        </Pane>
    }
}

export default Collect