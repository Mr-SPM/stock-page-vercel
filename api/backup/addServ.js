import connectDB from '../../lib/mongoose.js';
import { getAllStockListOnline } from '../../lib/request.js'
import Models from '../../models/Item.js'
import { isTradingDay } from '../../lib/request.js'


const targetMap = {
    temp: Models.TempStocks,
    history: Models.Stocks,
    last: Models.LastStocks,
}

const batchSize = 1000;

async function batchInsert(target, list) {
    for (let i = 0; i < list.length; i += batchSize) {
        const batch = list.slice(i, i + batchSize);
        await target.insertMany(batch);
        console.log(`成功插入第 ${i / batchSize + 1} 批数据`);
    }
}

/**
 * list 数据源
 * type temp 临时数据 history 历史数据 last 上一个交易日最新数据
 */
async function insert(list, type) {
    try {
        const target = targetMap[type]

        await target.deleteMany({})

        await batchInsert(target, list)

        if (type === 'history') {
            // 额外存一个缓存数据
            await batchInsert(Models.LastStocks, list)
        }
        console.log('全量插入完成')
        // while (list.length > 0) {

        //     const part = list.length > 500 ? list.splice(0, 100) : list.splice(0, list.length)s

        //     const insertedUsers = await Stocks.create(part)

        //     console.log('insertedUsers', insertedUsers)

        // }
    } catch (err) {
        console.warn('批量插入数据失败', err)
    }
}


export default async function handler(req, res) {
    const { type = 'history' } = req.query;
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
        let result = ''

        if (await isTradingDay()) {
            const allList = await getAllStockListOnline()
            await insert(allList, type)
            result = `记录${type}日志成功`
        } else {
            result = '非交易日,不执行任务'
        }
        res.status(200).json(result);

    } catch (error) {
        console.error('数据库操作失败:', error);
        res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
