import axios from 'axios';
import utils from './utils.js';
import a from 'iconv-lite'

const { calValue, randHeader, calcFixedPriceNumber } = utils

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