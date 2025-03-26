import axios from 'axios';
import dayjs from 'dayjs';
import utils from './utils.js';
import a from 'iconv-lite';
import stocks from '../models/stocks.js'

const { calValue, randHeader, calcFixedPriceNumber } = utils

// 判断是否是工作日（周一到周五）
function isWeekday() {
    const dayOfWeek = dayjs().day(); // 0: 周日, 1: 周一, ..., 6: 周六
    return dayOfWeek >= 1 && dayOfWeek <= 5; // 判断是否是工作日
}


// 检查今天是否是 A 股的交易日
export async function isTradingDay() {
    if (!isWeekday()) {
        console.log('今天是周末，不是交易日');
        return false;
    }

    // 检查是否是工作日，并通过新浪财经获取某只股票的数据来验证
    const stockCode = 'sh600519'; // 可以替换成任意的股票代码
    const result = await checkIfTradingDay(stockCode);
    return result;
}

// 请求新浪财经的股票数据
async function checkIfTradingDay(stockCode) {
    try {
        // 新浪财经的 URL
        const url = `https://hq.sinajs.cn/list=${stockCode}`;

        // 发送 GET 请求
        const response = await axios.get(url, {
            // axios 乱码解决 
            responseType: 'arraybuffer',
            transformResponse: [
                (data) => {
                    const body = a.decode(data, 'GB18030');
                    return body;
                }
            ],

            headers: {
                ...randHeader(),
                Referer: 'http://finance.sina.com.cn/',
            }
        });

        // 从响应数据中提取股票数据
        const data = response.data;

        // 判断是否包含 "今日休市" 或类似的休市信息
        if (data.includes("今日休市") || data.includes("停牌")) {
            console.log('今天是休市日');
            return false; // 今天不是交易日
        }

        console.log('今天是交易日');
        return true; // 今天是交易日

    } catch (error) {
        console.error('请求新浪财经接口失败:', error);
        return false; // 请求失败，认为不是交易日
    }
}


export async function getStockList(datas) {
    const stockList = datas.map(item => `${item.type.toLocaleLowerCase()}${item.value}`)
    const getList = async (part) => {
        const url = `https://hq.sinajs.cn/list=${part.join(',')}`;
        const resp = await axios.get(url, {
            // axios 乱码解决 
            responseType: 'arraybuffer',
            transformResponse: [
                (data) => {
                    const body = a.decode(data, 'GB18030');
                    return body;
                }
            ],

            headers: {
                ...randHeader(),
                Referer: 'http://finance.sina.com.cn/',
            },

        })
        const splitData = resp.data.split(';\n');
        const list = []
        for (let i = 0; i < splitData.length - 1; i++) {
            const code = splitData[i].split('="')[0].split('var hq_str_')[1];
            const params = splitData[i].split('="')[1].split(',');
            let type = code.substr(0, 2) || 'sh';
            let symbol = code.substr(2);
            let stockItem;
            let fixedNumber = 2;
            if (params.length > 1) {
                if (/^(sh|sz)/.test(code)) {
                    // A股 
                    let open = params[1];
                    let yestclose = params[2];
                    let price = params[3];
                    let high = params[4];
                    let low = params[5];
                    fixedNumber = calcFixedPriceNumber(open, yestclose, price, high, low);
                    stockItem = {
                        code,
                        name: params[0],
                        open: calValue(open, fixedNumber, false),
                        yestclose: calValue(yestclose, fixedNumber, false),
                        price: calValue(price, fixedNumber, false),
                        low: calValue(low, fixedNumber, false),
                        high: calValue(high, fixedNumber, false),
                        volume: calValue(params[8], 2),
                        amount: calValue(params[9], 2),
                        date: params[30],
                        time: `${params[30]} ${params[31]}`,
                        percent: '',

                    };
                }

            }

            stockItem && list.push(stockItem)

        }
        return list
    }

    let resList = []
    let count = 0
    try {
        while (stockList.length > 0) {
            const part = stockList.length > 500 ? stockList.splice(0, 500) : stockList.splice(0, stockList.length)
            console.log(`抓取${count++}次`)
            const list = await getList(part)
            resList = resList.concat(list)
        }
    }
    catch (err) {
        console.warn(err)
    }
    console.log('抓取完毕')
    return resList
}

/**
 * 获取所有股票线上数据
 * @returns 
 */
export async function getAllStockListOnline() {
    const shList = await getStockList(stocks.sh)
    const szList = await getStockList(stocks.sz)
    return shList.concat(szList)
}