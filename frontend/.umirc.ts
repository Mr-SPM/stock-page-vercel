import { defineConfig } from "umi";
import { GenerateSW } from "workbox-webpack-plugin";

export default defineConfig({
  routes: [
    { path: "/", component: "list" },
    { path: "/etf", component: "etf" },
    { path: "/charts/:month/:code", component: "charts" },
    { path: "/all/:month", component: "all" },
    { path: "/dashboard", component: "dashboardPro" },
    { path: "/x", component: "dashboardX" },
  ],

  base: "/",
  publicPath: "/",
  outputPath: "../public", // 构建后的文件存放到 Vercel 静态目录

  npmClient: "pnpm",

  proxy: {
    "/api": {
      target: "http://localhost:3000",
      changeOrigin: true,
    },
  },

  define: {
    TOKEN: process.env.TOKEN,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  },

  // ⚡ PWA: 保留 manifest.json 支持，但避免缓存行为
  links: [{ rel: "manifest", href: "/manifest.json" }],

  // ⚡ Remove default SW caching
  chainWebpack(memo) {
    memo.plugin("workbox").use(GenerateSW, [
      {
        // 生成空 Service Worker，让浏览器认为 PWA 已注册
        swDest: "service-worker.js",

        skipWaiting: false, // 可不启用立即激活
        clientsClaim: false,

        // 不 precache 任何东西
        exclude: [/.*/],

        // 不对任何请求进行缓存
        runtimeCaching: [
          {
            urlPattern: /.*/, // 匹配所有
            handler: "NetworkOnly", // 不缓存
          },
        ],
      },
    ]);
  },

  // ⚠ 从 scripts 中移除原来的 SW 注册逻辑，改用简化版本
  scripts: [
    `
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('SW registered', reg))
            .catch(err => console.log('SW failed', err));
        });
      }
    `,
  ],

  esbuildMinifyIIFE: true,
});
