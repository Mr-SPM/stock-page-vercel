import connectDB from '../lib/mongoose.js';
import Models from '../models/Item.js';
import { getAllStockListOnline } from '../lib/request.js'





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