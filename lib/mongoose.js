import mongoose from 'mongoose';

// 从环境变量中获取数据库连接信息
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbName = process.env.DB_NAME;

// 在 Serverless 环境中复用连接
let cached = global.mongoose;
if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        // 构建数据库连接字符串
        const uri = `mongodb://${dbHost}:${dbPort}/${dbName}`;

        const dbOptions = {
            user: dbUser,
            pass: dbPassword,
            dbName: dbName,
            useNewUrlParser: true,
            useUnifiedTopology: true,
            bufferCommands: false,
            connectTimeoutMS: 200000,
        }
        cached.promise = mongoose.connect(uri, dbOptions).then(mongoose => mongoose);
        try {
            cached.conn = await cached.promise;
        } catch (e) {
            cached.promise = null;
            throw e;
        }

        return cached.conn;
    }
}

export default connectDB