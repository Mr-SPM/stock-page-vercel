import axios from 'axios';

const calcFixedPriceNumber = (

    open,

    yestclose,

    price,

    high,

    low

) => {

    let reg = /0+$/g;

    open = open.replace(reg, '');

    yestclose = yestclose.replace(reg, '');

    price = price.replace(reg, '');

    high = high.replace(reg, '');

    low = low.replace(reg, '');

    let o = open.indexOf('.') === -1 ? 0 : open.length - open.indexOf('.') - 1;

    let yc = yestclose.indexOf('.') === -1 ? 0 : yestclose.length - yestclose.indexOf('.') - 1;

    let p = price.indexOf('.') === -1 ? 0 : price.length - price.indexOf('.') - 1;

    let h = high.indexOf('.') === -1 ? 0 : high.length - high.indexOf('.') - 1;

    let l = low.indexOf('.') === -1 ? 0 : low.length - low.indexOf('.') - 1;

    let max = Math.max(o, yc, p, h, l);

    if (max > 3) {

        max = 2; // 接口返回的指数数值的小数位为4，但习惯两位小数 

    }

    return max;

};

const randHeader = () => {

    const head_connection = ['Keep-Alive', 'close'];

    const head_accept = ['text/html, application/xhtml+xml, */*'];

    const head_accept_language = [

        'zh-CN,fr-FR;q=0.5',

        'en-US,en;q=0.8,zh-Hans-CN;q=0.5,zh-Hans;q=0.3',

    ];

    const head_user_agent = [

        'Opera/8.0 (Macintosh; PPC Mac OS X; U; en)',

        'Opera/9.27 (Windows NT 5.2; U; zh-cn)',

        'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Win64; x64; Trident/4.0)',

        'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)',

        'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; WOW64; Trident/6.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; InfoPath.2; .NET4.0C; .NET4.0E)',

        'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; WOW64; Trident/6.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; InfoPath.2; .NET4.0C; .NET4.0E; QQBrowser/7.3.9825.400)',

        'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; WOW64; Trident/6.0; BIDUBrowser 2.x)',

        'Mozilla/5.0 (Windows; U; Windows NT 5.1) Gecko/20070309 Firefox/2.0.0.3',

        'Mozilla/5.0 (Windows; U; Windows NT 5.1) Gecko/20070803 Firefox/1.5.0.12',

        'Mozilla/5.0 (Windows; U; Windows NT 5.2) Gecko/2008070208 Firefox/3.0.1',

        'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.8.1.12) Gecko/20080219 Firefox/2.0.0.12 Navigator/9.0.0.6',

        'Mozilla/5.0 (Windows NT 5.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.95 Safari/537.36',

        'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C; rv:11.0) like Gecko)',

        'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:21.0) Gecko/20100101 Firefox/21.0 ',

        'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.1 (KHTML, like Gecko) Maxthon/4.0.6.2000 Chrome/26.0.1410.43 Safari/537.1 ',

        'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.1 (KHTML, like Gecko) Chrome/21.0.1180.92 Safari/537.1 LBBROWSER',

        'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.75 Safari/537.36',

        'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/536.11 (KHTML, like Gecko) Chrome/20.0.1132.11 TaoBrowser/3.0 Safari/536.11',

        'Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko',

        'Mozilla/5.0 (Macintosh; PPC Mac OS X; U; en) Opera 8.0',

    ];

    const result = {

        Connection: head_connection[0],

        Accept: head_accept[0],

        'Accept-Language': head_accept_language[1],

        'User-Agent': head_user_agent[Math.floor(Math.random() * 10)],

    };

    return result;

};

const formatNumber = (val = 0, fixed = 2, format = true) => {

    const num = +val;

    if (format) {

        if (num > 1000 * 10000) {

            return (num / (10000 * 10000)).toFixed(fixed) + '亿';

        } else if (num > 1000) {

            return (num / 10000).toFixed(fixed) + '万';

        }

    }

    return `${num.toFixed(fixed)}`;

};

const calValue = (val = 0, fixed = 2, format = true) => {
    const num = +val;
    return format ? Number((num / 10000).toFixed(fixed)) : Number(num.toFixed(2))
};

// 判断是否是工作日（周一到周五）
function isWeekday() {
    const dayOfWeek = dayjs().day(); // 0: 周日, 1: 周一, ..., 6: 周六
    return dayOfWeek >= 1 && dayOfWeek <= 5; // 判断是否是工作日
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

// 检查今天是否是 A 股的交易日
async function isTradingDay() {
    if (!isWeekday()) {
        console.log('今天是周末，不是交易日');
        return false;
    }

    // 检查是否是工作日，并通过新浪财经获取某只股票的数据来验证
    const stockCode = 'sh600519'; // 可以替换成任意的股票代码
    const result = await checkIfTradingDay(stockCode);
    return result;
}

export default {
    formatNumber,
    calValue,
    randHeader,
    calcFixedPriceNumber,
    isTradingDay,
}