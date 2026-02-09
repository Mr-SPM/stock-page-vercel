// import VConsole from 'vconsole';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

if (!NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
  throw new Error('Add your Clerk Publishable Key to the .env file')
}


// const vConsole = new VConsole();
export function render(oldRender: Function) {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js'); // 路径与Workbox生成的文件名一致
    });
  }
  oldRender();
}