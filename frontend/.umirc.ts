import { defineConfig } from "umi";

export default defineConfig({
  routes: [
    { path: "/", component: "list" },
    // { path: "/list", component: "list" },
  ],
  base: '/',
  publicPath: '/',
  outputPath: '../public', // 构建后的文件存放到 Vercel 静态目录
  npmClient: 'pnpm',
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      'changeOrigin': true,
    }
  }

});
