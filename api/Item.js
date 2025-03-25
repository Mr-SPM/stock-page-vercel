import mongoose from 'mongoose';

const stockSchema = new mongoose.Schema({

    code: String,

    name: String,

    open: String,

    yestclose: Number,

    price: Number,

    low: Number,

    high: Number,

    volume: Number,

    amount: Number,
    date: String,
    time: String,

    percent: String,

});

const BaseSchema = new mongoose.Schema({
    name: String,
    value: String,
    type: String,
})

export default {
    Stocks: mongoose.model('Stocks', stockSchema),
    TempStocks: mongoose.model('tempStocks', stockSchema),
    LastStocks: mongoose.model('lastStocks', stockSchema),
    BaseSchema: mongoose.model('stockList', BaseSchema),
} 