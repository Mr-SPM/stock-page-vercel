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
    return request.get('/temp')
}

export function getTempList(params: { isOnline: 0 | 1 }) {
    return axios.get('https://stockapi.1168168.xyz/api/data', { params })
}