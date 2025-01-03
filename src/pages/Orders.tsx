import { Pane, TextInput, Select, Button, Table, Pagination, IconButton, EyeOnIcon, EyeOffIcon, InfoSignIcon, } from 'evergreen-ui'
import React from 'react'
import { TradeLog } from '../model/trade_log'

interface IOrdersProps {
}

interface IOrdersState {
  orders: TradeLog[]
  page: number
  totalPages: number
  txId: string
  toAddress: string
  txHash: string
  type: string
  uid: string
}

class Orders extends React.Component<IOrdersProps, IOrdersState> {
  constructor(props: IOrdersProps) {
    super(props)
    this.state = {
      orders: [],
      page: 1,
      totalPages: 1,
      txId: '',
      toAddress: '',
      txHash: '',
      type: '',
      uid: '',
    }
  }

  componentDidMount() {
    this.handleFilter()
  }

  handleFilter = async () => {
    const params = new URLSearchParams()
    if (this.state.page) {
      params.append('page', (this.state.page - 1).toString())
    }
    if (this.state.txId) {
      params.append('paymentId', this.state.txId)
    }
    if (this.state.toAddress) {
      params.append('txTo', this.state.toAddress)
    }
    if (this.state.txHash) {
      params.append('txHash', this.state.txHash)
    }
    if (this.state.type) {
      params.append('type', this.state.type)
    }
    if (this.state.uid) {
      params.append('uid', this.state.uid)
    }
    const serverUrl = localStorage.getItem('serverUrl')
    if (!serverUrl) {
      return
    }
    const url = `${serverUrl}/_op/getTradeLogs?${params.toString()}`
    const apiToken = localStorage.getItem('apiToken')
    const res = await fetch(url, {
      headers: {
        'Authorization': `${apiToken}`
      }
    })
    const data = await res.json()
    if (data.code === 1) {
      const totalElements = data.data.totalElements
      const totalPages = Math.ceil(totalElements / 10)
      this.setState({ totalPages, orders: data.data.content })
    } else {
      this.setState({ orders: [] })
    }
  }

  handleReset = () => {
    this.setState({
      txId: '',
      toAddress: '',
      txHash: '',
      type: '',
      uid: '',
      page: 1,
      totalPages: 1,
      orders: [],

    })
  }

  render() {
    return (
      <Pane>
        <Pane background="tint2" border="muted" borderRadius={4} padding={16} className="flex gap-md flex-column" >
          <div>Filter</div>
          <div className="flex gap-md justify-evenly">
            <TextInput placeholder="Payment ID" name="txId" width="33%" value={this.state.txId} onChange={
              (e: React.ChangeEvent<HTMLInputElement>) => this.setState({ txId: e.target.value })
            } />
            <TextInput placeholder="To Address" name="toAddress" width="33%" value={this.state.toAddress} onChange={
              (e: React.ChangeEvent<HTMLInputElement>) => this.setState({ toAddress: e.target.value })
            } />
            <TextInput placeholder="UID" name="uid" width="33%" value={this.state.uid} onChange={
              (e: React.ChangeEvent<HTMLInputElement>) => this.setState({ uid: e.target.value })
            } />
          </div>
          <div className="flex gap-md justify-evenly">
            <TextInput placeholder="Tx Hash" name="txHash" value={this.state.txHash} onChange={
              (e: React.ChangeEvent<HTMLInputElement>) => this.setState({ txHash: e.target.value })
            } />
            <Select name="type" width="280px" value={this.state.type} onChange={
              (e: React.ChangeEvent<HTMLSelectElement>) => this.setState({ type: e.target.value })
            }>
              <option value="">All</option>
              <option value="DEPOSIT">Deposit</option>
              <option value="WITHDRAW_CONFIRM">Withdraw Confirm</option>
              <option value="WITHDRAW_APPLY">Withdraw Apply</option>
              <option value="WITHDRAW_REJECT">Withdraw Reject</option>
              <option value="PAYMENT">Payment</option>
              <option value="REFUND">Refund</option>
            </Select>
            <Button intent="success" onClick={this.handleFilter}>Filter</Button>
            <Button intent="" onClick={this.handleReset}>Reset</Button>
          </div>
        </Pane>
        <Pane className="margin-top-md">
          <Table>
            <Table.Head>
              <Table.HeaderCell>Tx ID</Table.HeaderCell>
              <Table.HeaderCell>Memo</Table.HeaderCell>
              <Table.HeaderCell>Amount</Table.HeaderCell>
              <Table.HeaderCell flexBasis={100} flexShrink={0} flexGrow={0}>Type</Table.HeaderCell>
              <Table.HeaderCell>Created At</Table.HeaderCell>
              <Table.HeaderCell flexBasis={100} flexShrink={0} flexGrow={0}>Action</Table.HeaderCell>
            </Table.Head>
            <Table.Body height="calc(100vh - 310px)">
              {this.state.orders.map((order) => (
                <Table.Row key={order.id} intent={order.type === 'DEPOSIT' ? 'success' : order.type === 'PAYMENT' ? 'warning' : order.type === 'WITHDRAW_CONFIRM' ? 'danger' : 'none'}>
                  <Table.TextCell>{order.paymentId}</Table.TextCell>
                  <Table.TextCell>{order.memo}</Table.TextCell>
                  <Table.TextCell>$ {order.amount}</Table.TextCell>
                  <Table.TextCell flexBasis={100} flexShrink={0} flexGrow={0}>{order.type}</Table.TextCell>
                  <Table.TextCell>{
                    new Date(order.createdAt).toLocaleString()
                  }</Table.TextCell>
                  <Table.TextCell flexBasis={100} flexShrink={0} flexGrow={0}>
                    <IconButton icon={InfoSignIcon} intent='success' />
                  </Table.TextCell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Pane>
        <Pane className="flex justify-center">
          <Pagination page={this.state.page} totalPages={this.state.totalPages}
            onPageChange={(page: number) => {
              this.setState({ page }, () => {
                this.handleFilter()
              })
            }}
            onNextPage={() => {
              this.setState({ page: this.state.page + 1 }, () => {
                this.handleFilter()
              })
            }}
            onPreviousPage={() => {
              this.setState({ page: this.state.page - 1 })
              this.handleFilter()
            }}
          />
        </Pane>
      </Pane>
    )
  }
}

export default Orders