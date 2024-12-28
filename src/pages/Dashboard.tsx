import { Pane, Badge } from 'evergreen-ui'
import React from 'react'
import { Network } from '../model/network'
import { DEFAULT_NETWORKS } from '../config/const'
import { Trend } from '../model/trend'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getStat, getThisYearBegin, getTrends, getWeekBegin, now } from '../api/stat'
import { getTodayBegin } from '../api/stat' 
import DataCard from '../component/DataCard'

interface DashboardProps {
}

enum ServerStatus {
    STARTING = 'Starting',
    RUNNING = 'Running',
    STOPPING = 'Stopping',
    STOPPED = 'Stopped',
    FETCHING = 'Fetching',
}

interface Stat {
    deposit: number
    payment: number
    refund: number
    withdrawal: number
}

interface DashboardState {
    serverStatus: ServerStatus
    serverUrl: string,
    watching: any,
    networks: Network[],
    trendsMap: Map<Network, Trend[]>, 
    todayStat: Stat,
    thisYearStat: Stat,
}

class Dashboard extends React.Component<DashboardProps, DashboardState> {
    constructor(props: DashboardProps) {
        super(props)
        this.state = {
            serverStatus: ServerStatus.FETCHING,
            serverUrl: '',
            watching: null,
            networks: [],
            trendsMap: new Map(),
            todayStat: {
                deposit: 0,
                payment: 0,
                refund: 0,
                withdrawal: 0,
            },
            thisYearStat: {
                deposit: 0,
                payment: 0,
                refund: 0,
                withdrawal: 0,
            },
        }
    }

    componentWillUnmount() {
        if (this.state.watching) {
            clearInterval(this.state.watching)
        }
    }

    loadNetworks = async () => {
        try {
            const networksJson = localStorage.getItem('networks')
            if (networksJson) {
                const networks = JSON.parse(networksJson)
                this.setState({ networks })
                this.loadTrends(networks)
            } else {
                this.setState({ networks: DEFAULT_NETWORKS })
                this.loadTrends(DEFAULT_NETWORKS)
            }
        } catch (error) {
            console.error('Failed to load networks:', error)
        }
    }

    loadTrends = async (networks: Network[]) => {
        const trendsMap = new Map<Network, Trend[]>()
        const serverUrl = localStorage.getItem('serverUrl') 
        if (!serverUrl) {
            return
        }
        const weekBegin = getWeekBegin()
        for (const network of networks) {
            const trends = await getTrends(
                weekBegin,
                now(),
                'DEPOSIT',
                serverUrl
            )

            trendsMap.set(network, trends.reverse()) // Reverse to get chronological order
        }
        this.setState({ trendsMap })
    }

    loadServerUrl = async () => {
        const serverUrl = localStorage.getItem('serverUrl')
        if (serverUrl) {
            this.setState({ serverUrl })
            this.startWatching()
            this.loadStat(serverUrl)
        }
    }

    loadStat = async (serverUrl: string) => {
        const todayBegin = getTodayBegin()
        const thisYearBegin = getThisYearBegin()
        const todayStat = await getStat(todayBegin, thisYearBegin, serverUrl)
        // stat : [{type(int), sum(amount), count(int), avg(amount), max(amount), min(amount)}]
        // type: DEPOSIT 
        // WITHDRAW_CONFIRM 
        // WITHDRAW_APPLY 
        // WITHDRAW_REJECT 
        // PAYMENT 
        // REFUND 
        // MINUS 
        
        const todayStatMap = new Map()
        todayStat.forEach((item: any) => {
            todayStatMap.set(item[0], item)
        })

        this.setState({
            todayStat: {
                deposit: todayStatMap.get('DEPOSIT')?.[1]    || 0,        // DEPOSIT
                withdrawal: todayStatMap.get('WITHDRAW_APPLY')?.[1] || 0,     // WITHDRAW_APPLY  
                payment: todayStatMap.get('PAYMENT')?.[1] || 0,        // PAYMENT
                refund: todayStatMap.get('REFUND')?.[1] || 0,         // REFUND
            }
        })

        const thisYearStat = await getStat(thisYearBegin, todayBegin, serverUrl)

        const thisYearStatMap = new Map()
        thisYearStat.forEach((item: any) => {
            thisYearStatMap.set(item[0], item)
        })

        console.log(thisYearStatMap)

        this.setState({
            thisYearStat: {
                deposit: thisYearStatMap.get('DEPOSIT')?.[1] || 0,        // DEPOSIT
                withdrawal: thisYearStatMap.get('WITHDRAW_APPLY')?.[1] || 0,     // WITHDRAW_APPLY  
                payment: thisYearStatMap.get('PAYMENT')?.[1] || 0,        // PAYMENT
                refund: thisYearStatMap.get('REFUND')?.[1] || 0,         // REFUND
            }
        })

    }   

    startWatching = async () => {
        const interval = setInterval(() => {
            const serverUrl = localStorage.getItem('serverUrl')
            if (serverUrl && serverUrl.match(/^https?:\/\/[^\s/$.?#].[^\s]*$/)) {
                // get serverUrl
                fetch(serverUrl)
                    .then(async response => {
                        if (await response.text() === 'ok') {
                            this.setState({ serverStatus: ServerStatus.RUNNING })
                        } else {
                            this.setState({ serverStatus: ServerStatus.STOPPED })
                        }
                    })
            }
        }, 10000)
        this.setState({ watching: interval })
    }

    componentDidMount() {
        this.loadServerUrl()
        this.loadNetworks()
    }

    processTrends = () => {
        const trendsMap = this.state.trendsMap
        // Generate last 7 days in mm-dd format
        const dates = Array.from({length: 7}, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            return `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        }).reverse();

        // Convert trendsMap data into the required format
        const formattedData = dates.map(date => {
            // Start with the date as the base object
            const dataPoint: { [key: string]: string | number } = { name: date }
            
            // For each network in trendsMap, add its value for this date
            trendsMap.forEach((trends, network) => {
                // Find the trend entry for this date
                const trend = trends.find(t => t.date === date)
                // Add the value to the data point, use 0 if no data exists
                dataPoint[network.name] = trend ? trend.value : 0
            })
            
            return dataPoint
        })
        return formattedData
    }

    render() {
        return (
            <Pane>
                <div className='flex flex-row gap-md'>
                    <div>
                        <Badge color={
                            this.state.serverStatus === ServerStatus.RUNNING ? 'green' :
                                this.state.serverStatus === ServerStatus.STARTING ? 'yellow' :
                                    this.state.serverStatus === ServerStatus.STOPPING ? 'yellow' :
                                        this.state.serverStatus === ServerStatus.STOPPED ? 'red' :
                                            'neutral'
                        }>{this.state.serverStatus}</Badge>
                    </div>
                    <div>
                        <Badge color="neutral">
                            {this.state.serverUrl}
                        </Badge>
                    </div>
                </div>
                <div className="margin-top-lg text-gray-500">TOTAL STAT (USD)</div>
                <div className='flex flex-row gap-md justify-evenly'>
                    <DataCard title="Deposit" value={this.state.thisYearStat.deposit} unit="$" color="blue" />
                    <DataCard title="Payment" value={this.state.thisYearStat.payment * -1 } unit="$" color="blue" />
                    <DataCard title="Refund" value={this.state.thisYearStat.refund} unit="$" color="blue" />
                    <DataCard title="Withdrawal" value={this.state.thisYearStat.withdrawal} unit="$" color="blue" /> 
                </div>  
                <div className="margin-top-lg text-gray-500">TODAY STAT (USD)</div>
                <div className='flex flex-row gap-md justify-evenly'>
                    <DataCard title="Deposit" value={this.state.todayStat.deposit} unit="$" color="blue" />
                    <DataCard title="Payment" value={this.state.todayStat.payment} unit="$" color="blue" />
                    <DataCard title="Refund" value={this.state.todayStat.refund} unit="$" color="blue" />
                    <DataCard title="Withdrawal Applied" value={this.state.todayStat.withdrawal} unit="$" color="blue" />
                </div>
                {/* 各条链 deposit trend 趋势图，使用rechart绘制 */}
                <div className="margin-top-lg text-gray-500">DEPOSIT TREND (USD)</div>
                <div className='margin-top-md'>
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={this.processTrends()} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}   >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis unit="$" />
                            <Tooltip />
                            <Legend />
                            {Array.from(this.state.trendsMap.keys()).map((network, index) => (
                                <Bar
                                    key={network.name}
                                    dataKey={network.name}
                                    fill={`hsl(${index * 137.5}, 50%, 50%)`}
                                    barSize={38}
                                    stackId="a"
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Pane>
        )
    }
}

export default Dashboard