export function render(oldRender: Function) {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js'); // 路径与Workbox生成的文件名一致
    });
  }
  oldRender();
}