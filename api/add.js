import pkg from 'pg';
import axios from "axios";
import utils from './utils.js'


const { Pool } = pkg
// Neon PostgreSQL 连接信息 

const pool = new Pool({

    connectionString: process.env.DATABASE_URL, // 在Vercel环境变量中配置 DATABASE_URL 

    ssl: { rejectUnauthorized: false }, // Neon 需要 SSL 

});

async function getStockList(datas) {
    const stockList = datas.map(item => `${item.type.toLocaleLowerCase()}${item.value}`)
    console.log(stockList);
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
                ...utils.randHeader(),
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
                    fixedNumber = utils.calcFixedPriceNumber(open, yestclose, price, high, low);
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
            console.log(`抓取${++count}次`)
            const list = await getList(part)
            console.log(`抓取${count}完毕`);
            resList = resList.concat(list)
        }
    }
    catch (err) {
        console.warn(err)
    }
    return resList
}

export default async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const result = await client.query('SELECT * FROM stock_list');
        console.log(result.rows);
        const data = getStockList(result.rows)

        // 创建表（如果不存在） 

        await client.query(` 

      CREATE TABLE IF NOT EXISTS history ( 

        id SERIAL PRIMARY KEY, 

        code TEXT NOT NULL, 

        name TEXT NOT NULL, 

        open NUMERIC, 

        yestclose NUMERIC, 

        price NUMERIC, 

        low NUMERIC, 

        high NUMERIC, 

        volume NUMERIC, 

        amount NUMERIC, 

        date DATE, 

        time TIMESTAMP 

      ) 

    `);



        // 清空表数据 

        await client.query("TRUNCATE TABLE history");



        // 批量插入数据 

        const insertQuery = ` 

      INSERT INTO history (code, name, open, yestclose, price, low, high, volume, amount, date, time) 

      VALUES ${data

                .map(

                    (_, i) =>

                        `($${i * 11 + 1}, $${i * 11 + 2}, $${i * 11 + 3}, $${i * 11 + 4}, $${i * 11 + 5}, $${i * 11 + 6}, $${i * 11 + 7}, $${i * 11 + 8}, $${i * 11 + 9}, $${i * 11 + 10}, $${i * 11 + 11})`

                )

                .join(",")} 

    `;



        const values = data.flatMap((item) => [

            item.code,

            item.name,

            item.open,

            item.yestclose,

            item.price,

            item.low,

            item.high,

            item.volume,

            item.amount,

            item.date,

            item.time,

        ]);



        await client.query(insertQuery, values);



        await client.query("COMMIT");

        res.status(200).json({ success: true, message: "Data inserted successfully" });

    } catch (error) {

        await client.query("ROLLBACK");

        res.status(500).json({ error: "Database error", details: error.message });

    } finally {

        client.release();

    }

}; 