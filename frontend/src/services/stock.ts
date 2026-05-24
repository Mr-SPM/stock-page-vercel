import axios from 'axios';  
import { decode } from 'iconv-lite';
import { randHeader, calcFixedPriceNumber, formatNumber } from './utils';
import { message } from 'antd'
export default async function getStockData(codes: Array<string>): Promise<Array<any>> {
    if ((codes && codes.length === 0) || !codes) {
      return [];
    }
    let aStockCount = 0;
    let noDataStockCount = 0;
    let stockList: Array<any> = [];

    const url = `https://hq.sinajs.cn/list=${codes
      .map((code) => code.replace('.', '$')) // 新浪接口中点号替换为$
      .join(',')}`;
    try {
      const resp = await axios.get(url, {
        // axios 乱码解决
        responseType: 'arraybuffer',
        transformResponse: [
          (data) => {
            const body = decode(data, 'GB18030');
            return body;
          },
        ],
        headers: {
          ...randHeader(),
          Referer: 'http://finance.sina.com.cn/',
        },
      });
      if (/FAILED/.test(resp.data)) {
        if (codes.length === 1) {
          message.error(
            `fail: error Stock code in ${codes}, please delete error Stock code.`
          );
          return [];
        }
        for (const code of codes) {
          stockList = stockList.concat(await getStockData(new Array(code)));
        }
      } else {
        const splitData = resp.data.split('";\n');
        const stockPrice: {
          [key: string]: {
            amount: number;
            earnings: number;
            name: string;
            price: string;
            unitPrice: number;
            todayUnitPrice: number;
            isSellOut: boolean;
          };
        } = {}

        for (let i = 0; i < splitData.length - 1; i++) {
          let code = splitData[i].split('="')[0].split('var hq_str_')[1];
          if (code.includes('$')) {
            code = code.replace('$', '.'); // 新浪接口中$替换回点号,否则会造成无法匹配删除的结果
          }
          const params = splitData[i].split('="')[1].split(',');
          let type = code.substr(0, 2) || 'sh';
          let symbol = code.substr(2);
          let stockItem: any;
          let fixedNumber = 2;
          if (params.length > 1) {
            if (/^(sh|sz|bj)/.test(code)) {
              // A股
              let open = params[1];
              let yestclose = params[2];
              let price = params[3];
              if (Number(price) === 0) {
                const buy1 = params[6];
                if (Number(buy1) !== 0) {
                  price = buy1;
                } else {
                  price = yestclose;
                }
              }
              let high = params[4];
              let low = params[5];
              fixedNumber = calcFixedPriceNumber(open, yestclose, price, high, low);
              if (
                Number(price) === 0 &&
                Number(high) === 0 &&
                Number(low) === 0 &&
                Number(yestclose) === 0
              ) {
                noDataStockCount += 1;
                const stockItemTemp = {
                  code: code,
                  name: `接口不支持该股票 ${params[0] ? params[0] : code}`,
                  showLabel: false,
                  isStock: true,
                  percent: '',
                  type: 'nodata',
                  contextValue: 'nodata',
                };
                stockList.push(stockItemTemp);
              } else {
                stockItem = {
                  code,
                  name: params[0],
                  open: formatNumber(open, fixedNumber, false),
                  yestclose: formatNumber(yestclose, fixedNumber, false),
                  price: formatNumber(price, fixedNumber, false),
                  low: formatNumber(low, fixedNumber, false),
                  high: formatNumber(high, fixedNumber, false),
                  volume: formatNumber(params[8], 2),
                  amount: formatNumber(params[9], 2),
                  time: `${params[30]} ${params[31]}`,
                  percent: '',
                  contextValue: 'aStock',
                };
                aStockCount += 1;
              }
            } 
          } else {
            // 接口不支持的
            noDataStockCount += 1;
            stockItem = {
              code: code,
              name: `接口不支持该股票 ${code}`,
              showLabel: false,
              isStock: true,
              percent: '',
              type: 'nodata',
              contextValue: 'nodata',
            };
            stockList.push(stockItem);
          }
        }
      }
    } catch (err) {
      console.info(url);
      console.error(err);
      message.error(String(err))
    }
    return stockList;
  }