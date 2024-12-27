export interface ChainType {
    chainName: string;
    description: string;
    chainType: string;
    chainId?: number;
    descriptionMap: any;
    usdtContracts: UsdtContract[];
}

export interface UsdtContract {
    symbol: string;
    address: string;
    decimals: number;
}