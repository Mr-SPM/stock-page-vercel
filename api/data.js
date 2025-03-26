import axios from 'axios';
import connectDB from './mongoose.js';
import Models from './Item.js';
import stocks from './stocks.js'
import utils from '../lib/request.js';
import a from 'iconv-lite'

const { calValue, randHeader, calcFixedPriceNumber } = utils

async function getStockList(datas) {
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
                if (/^(sh|sz|bj)/.test(code)) {
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

            list.push(stockItem)

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
    return resList
}

/**
 * 获取所有股票线上数据
 * @returns 
 */
async function getAllStockListOnline() {
    const shList = await getStockList(stocks.sh)
    const szList = await getStockList(stocks.sz)
    return shList.concat(szList)
}

export default async function handler(req, res) {
    const { isOnline } = req.query;
    // 允许 Cloudflare Pages 访问
    res.setHeader("Access-Control-Allow-Origin", "*"); // 允许所有域（不安全）
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); // 允许的方法
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // 处理 OPTIONS 预检请求
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    try {
        // 建立数据库连接
        await connectDB();
        let stocksToday = []
        if (isOnline === '0') {
            // 使用 Mongoose 查询
            stocksToday = await Models.TempStocks.find().lean(); // 转换为普通 JS 对象
            if (stocksToday.length === 0) {
                return res.status(404).send('没有盘前日志');
            }
        } else {
            stocksToday = await getAllStockListOnline();
        }

        const stocksYesterday = await Models.LastStocks.find().lean();
        const result = [];

        // 对比今天和昨天的数据
        stocksToday.forEach(todayStock => {
            // 排除ST
            if (todayStock.name.startsWith('ST') || todayStock.name.startsWith('*')) {
                return
            }
            // 查找昨天相同name的股票数据
            const yesterdayStock = stocksYesterday.find(yesterdayStock => yesterdayStock.name === todayStock.name);

            if (yesterdayStock) {
                // 计算amount的增长
                const amountIncrease = todayStock.amount / yesterdayStock.amount * 100;

                // 如果amount增长超过9%，则记录该数据
                if (amountIncrease > 9) {
                    result.push({
                        name: todayStock.name,
                        todayAmount: (todayStock.amount / 10000).toFixed(2),
                        yesterdayAmount: (yesterdayStock.amount / 10000).toFixed(2),
                        amountIncrease: ((todayStock.price - todayStock.yestclose) / todayStock.yestclose * 100).toFixed(2),
                        date: todayStock.date,
                        time: todayStock.time
                    });
                }
            }
        });

        res.status(200).json(result);
    } catch (error) {
        console.error('数据库操作失败:', error);
        res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}