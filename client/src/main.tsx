import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SafePage } from './components/SafePage';
import { useErrorStore } from './store/errorStore';
import { socketService } from './services/socket';

const Root: React.FC = () => {
  const safeMode = useErrorStore((state) => state.safeMode);

  useEffect(() => {
    if (safeMode.active) {
      // 进入安全页面后断开实时连接，确保普通操作与画板数据不会被兜底流程重复提交
      socketService.disconnect();
    }
  }, [safeMode.active]);

  if (safeMode.active) {
    return <SafePage reason={safeMode.reason} />;
  }
  return <App />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 根层兜底：任何未被区域边界捕获的异常都退到安全页面，不再白屏 */}
    <ErrorBoundary region="root" fallback={<SafePage reason="应用发生无法自动恢复的错误" />}>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>,
);
