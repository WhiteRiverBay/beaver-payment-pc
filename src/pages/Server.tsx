import { Badge, Button, Pane, Table, toaster } from 'evergreen-ui'
import React from 'react'
import { ServerStatusType } from '../model/server_status'
import { getChains, getRuntimeInfo, getServerStatus, restartScanner } from '../api/api'
import { ChainType } from '../model/chain'
import { RuntimeInfoType } from '../model/runtime_info'
import DataCard from '../component/DataCard'
interface ServerProps {
}

interface ServerState {
  serverStatus: ServerStatusType
  chains: ChainType[]
  runtimeInfo: RuntimeInfoType
  serverUrl: string
}

class Server extends React.Component<ServerProps, ServerState> {

  constructor(props: ServerProps) {
    super(props)
    this.state = {
      serverStatus: {},
      chains: [],
      runtimeInfo: {},
      serverUrl: ''
    }
  }

  async componentDidMount() {
    await this.loadServerStatus()
    await this.loadChains()
    await this.loadRuntimeInfo()
    this.setState({ serverUrl: localStorage.getItem('serverUrl') || '' })
  }

  async loadRuntimeInfo() {
    const serverUrl = localStorage.getItem('serverUrl')
    const apiToken = localStorage.getItem('apiToken')
    if (serverUrl && apiToken) {
      const runtimeInfo = await getRuntimeInfo(serverUrl, apiToken)
      this.setState({ runtimeInfo })
    }
  }

  async loadServerStatus() {
    const serverUrl = localStorage.getItem('serverUrl')
    const apiToken = localStorage.getItem('apiToken')
    if (serverUrl && apiToken) {
      const serverStatus = await getServerStatus(serverUrl, apiToken)
      this.setState({ serverStatus })
    }
  }

  async loadChains() {
    const serverUrl = localStorage.getItem('serverUrl')
    if (serverUrl) {
      const chains = await getChains(serverUrl)
      this.setState({ chains })
    }
  }

  async restartScanner(chainId: string) {
    const serverUrl = localStorage.getItem('serverUrl')
    const apiToken = localStorage.getItem('apiToken')
    if (serverUrl && apiToken) {
      try { 
        await restartScanner(serverUrl, chainId, apiToken)
        toaster.success('Restart scanner success')
        await this.loadServerStatus()
      } catch (error) {
        toaster.danger('Restart scanner failed')
      }
    }
  }   

  render() {
    return (
      <Pane>
        <Pane className=''>
          <Badge>{this.state.serverUrl}</Badge>
        </Pane>
        <Pane>
          <div className='flex gap-md justify-evenly'>
            <DataCard title='CPUs' value={this.state.runtimeInfo['cpu_cores']} color='green' />
            <DataCard title='Max Memory' value={this.state.runtimeInfo['jvm_max_memory_mb']} color='orange' unit='MB' />
            <DataCard title='System Load' value={this.state.runtimeInfo['system_load_average']} color='blue' />
            <DataCard title='Free Disk Space' value={this.state.runtimeInfo['free_disk_space_gb']} color='purple' unit='GB' />
          </div>
        </Pane>
        <Pane className='margin-top-md'>
          <Table>
            <Table.Head>
              <Table.TextCell>Engine</Table.TextCell>
              <Table.TextCell>Watching</Table.TextCell>
              <Table.TextCell>Status</Table.TextCell>
              <Table.TextCell>Action</Table.TextCell>
            </Table.Head>
            <Table.Body>
              {this.state.chains.map(chain => (
                <Table.Row key={chain.chainId}>
                  <Table.TextCell>
                    <div>{chain.chainName}</div>

                  </Table.TextCell>
                  <Table.TextCell>
                    <div className='flex flex-wrap gap-sm'>
                      {chain.usdtContracts?.map(contract => (
                        <Badge color='purple' key={contract.address}>{contract.symbol}</Badge>
                      ))}
                    </div>
                  </Table.TextCell>
                  <Table.TextCell>
                    <Badge color={this.state.serverStatus[chain.chainId?.toString() || ''] ? 'green' : 'red'}>
                      {this.state.serverStatus[chain.chainId?.toString() || ''] ? 'RUNNING' : 'STOPPED'}
                    </Badge>
                  </Table.TextCell>
                  <Table.TextCell>
                    <Button intent="danger"
                      disabled={this.state.serverStatus[chain.chainId?.toString() || '']}
                      onClick={() => this.restartScanner(chain.chainId?.toString() || '')}
                    >
                      Restart
                    </Button>
                  </Table.TextCell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Pane>
      </Pane>
    )
  }
}

export default Server