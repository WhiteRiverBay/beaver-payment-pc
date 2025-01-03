// 定义交易类型枚举
export enum TradeType {
    DEPOSIT = 'DEPOSIT',
    WITHDRAW_CONFIRM = 'WITHDRAW_CONFIRM',
    WITHDRAW_APPLY = 'WITHDRAW_APPLY',
    WITHDRAW_REJECT = 'WITHDRAW_REJECT',
    PAYMENT = 'PAYMENT',
    REFUND = 'REFUND'
}

// 定义链类型枚举
export enum ChainType {
  ETH = 'ETH',
  TRON = 'TRON',
}

export interface TradeLog {
  id?: number;
  paymentId?: string;
  uid: string;
  amount: string; // 使用string类型来表示BigDecimal，避免JavaScript数字精度问题
  type?: TradeType;
  confirmedBlocks: number;
  memo?: string;
  txHash?: string;
  token?: string;
  chainType?: ChainType;
  chainId?: number;
  txFrom?: string;
  txTo?: string;
  blockNumber?: string;
  createdAt: number;
}
