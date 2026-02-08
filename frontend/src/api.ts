import axios from "axios";

const request = axios.create({
    baseURL: '/api'
})

export function getInfo(params: { code: string }) {
    return request.get('/getInfo', { params })
}

export function getList(params: { isOnline: 0 | 1 }) {
    return request.get('/list', { params })
}

export function getStockList() {
    return request.get('/getStockList')
}

export function goLog() {
    return request.get('/add?isTemp=1')
}
export function initStockList() {
    return request.get('/init')
}

export function addLog() {
    return request.get('/add')
}

export function getTempList(params: { isOnline: 0 | 1 }) {
    return axios.get('https://stockapi.1168168.xyz/api/data', { params })
}

export function addETF(data: any) {
    return axios.post('/api/etf/create', data)
}
export function queryETf(month: string) {
    return axios.get('/api/etf/month', {
        params: {
            month
        },
    })
}

export function queryETFSeries(params: any) {
    return axios.get('/api/etf/series', {
        params
    })
}