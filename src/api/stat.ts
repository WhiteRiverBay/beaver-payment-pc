import { Trend } from "../model/trend"

export const getTodayBegin = (): number => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now.getTime()
}

export const now = (): number => {
    const now = new Date()
    return now.getTime()
}

export const getWeekBegin = (): number => {
    const now = new Date()
    now.setDate(now.getDate() - 7)
    return now.getTime()
}

export const getThisYearBegin = (): number => {
    const now = new Date()
    now.setMonth(0, 1)
    now.setHours(0, 0, 0, 0)
    return now.getTime()
}

export const getStat = async (
    begin: number,
    end: number,
    serverUrl: string
) => {

    const apiToken   = localStorage.getItem('apiToken')
    const response = await fetch(
        `${serverUrl}/_stat/sum?begin=${begin}&end=${end}`,
        {
            headers: {
                'Authorization': `${apiToken}`
            }
        }
    )
    if (!response.ok) {
        throw new Error(response.statusText)
    }
    const data = await response.json()
    if (data.code !== 1) {
        throw new Error(data.message)
    }
    return data.data
}

export const getTrends = async (
    begin: number,
    end: number,
    type : string,
    serverUrl: string
): Promise<Trend[]> => {
    const apiToken = localStorage.getItem('apiToken')       
    const response = await fetch(
        `${serverUrl}/_stat/trend?begin=${begin}&end=${end}&type=${type}`,
        {
            headers: {
                'Authorization': `${apiToken}`
            }
        }
    )
    if (!response.ok) {
        throw new Error(response.statusText)
    }
    const data = await response.json()
    if (data.code !== 1) {
        throw new Error(data.message)
    }
    
    return data.data.map((item: [string, number]) => ({
        date: item[0],
        value: item[1]
    }))
}