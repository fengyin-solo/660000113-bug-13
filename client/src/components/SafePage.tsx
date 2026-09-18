import React from 'react';
import { clearAllRecoverySnapshots } from '../services/recovery';

interface SafePageProps {
  reason?: string | null;
}

/**
 * 安全页面：连续异常、重试再次失败或恢复数据不可读时的最终兜底。
 * 页面不渲染任何业务组件、不发起任何操作，
 * 确保普通操作与画板数据不会被兜底流程重复提交。
 */
export const SafePage: React.FC<SafePageProps> = ({ reason }) => {
  const handleReload = () => {
    window.location.reload();
  };

  const handleClearAndReload = () => {
    clearAllRecoverySnapshots();
    window.location.reload();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: '440px',
          width: '100%',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
          padding: '40px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: '#fef3c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <h2 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 600, color: '#1a1a1a' }}>
          已切换到安全页面
        </h2>
        <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#6b7280', lineHeight: 1.6 }}>
          {reason || '应用连续出现异常，为保护你的数据已暂停当前会话。'}
        </p>
        <p style={{ margin: '0 0 28px', fontSize: '13px', color: '#9ca3af', lineHeight: 1.6 }}>
          安全页面不会执行任何操作，画板数据不会被重复提交。
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={handleReload}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#fff',
              background: '#667eea',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            重新加载应用
          </button>
          <button
            onClick={handleClearAndReload}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#b91c1c',
              background: '#fff',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            清除恢复数据并重新加载
          </button>
        </div>
      </div>
    </div>
  );
};
