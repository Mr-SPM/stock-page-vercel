import { defineConfig } from "umi";
import { GenerateSW } from 'workbox-webpack-plugin';

export default defineConfig({
  routes: [
    { path: "/", component: "list" },
    { path: "/etf", component: "etf" },
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
  },
  define: {
    TOKEN: process.env.TOKEN
  },
  links: [{ rel: 'manifest', href: '/manifest.json' }],
  chainWebpack(memo) {
    memo.plugin('workbox').use(GenerateSW, [{
      skipWaiting: true, // 跳过等待，立即激活新的 Service Worker
      clientsClaim: true, // 立即控制页面
      swDest: 'service-worker.js', // 输出的 Service Worker 文件名
      // globPatterns: ['**/*.{html,js,css,png,jpg}'], // 需要缓存的文件模式
      runtimeCaching: [
        // 运行时缓存策略
        {
          urlPattern: /.*\.(js|css)$/,
          handler: 'StaleWhileRevalidate',
        },
      ],
    }]);
  },
    scripts: [
    `
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/service-worker.js').then(registration => {
            console.log('SW registered: ', registration);
          }).catch(registrationError => {
            console.log('SW registration failed: ', registrationError);
          });
        });
      }
    `,
  ],
     esbuildMinifyIIFE: true
});
