import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './components/ThemeProvider';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

console.log('=== 应用开始加载 ===');
console.log('当前 URL:', window.location.href);
console.log('文档状态:', document.readyState);

try {
  const rootElement = document.getElementById('root');
  
  console.log('Root 元素:', rootElement);
  
  if (!rootElement) {
    console.error('❌ 找不到 root 元素');
    document.body.innerHTML = `
      <div style="padding: 20px; color: red; font-family: sans-serif;">
        <h2>❌ 错误：找不到 root 元素</h2>
        <p>页面加载失败，请刷新页面重试</p>
        <button onclick="window.location.reload()" style="padding: 10px 20px; cursor: pointer;">
          刷新页面
        </button>
      </div>
    `;
  } else {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
    
    console.log('✅ React 应用已成功挂载');
  }
} catch (error) {
  console.error('❌ 应用初始化错误:', error);
  console.error('错误堆栈:', error instanceof Error ? error.stack : '无堆栈信息');
  
  document.body.innerHTML = `
    <div style="padding: 20px; color: red; font-family: sans-serif;">
      <h2>❌ 应用初始化错误</h2>
      <p><strong>错误信息:</strong> ${error instanceof Error ? error.message : String(error)}</p>
      <pre style="background: #fee2e2; padding: 10px; border-radius: 4px; overflow: auto; font-size: 12px;">
        ${error instanceof Error ? error.stack : '无堆栈信息'}
      </pre>
      <button onclick="window.location.reload()" style="padding: 10px 20px; cursor: pointer; margin-top: 10px;">
        刷新页面
      </button>
    </div>
  `;
}

console.log('=== 应用加载脚本执行完毕 ===');
