import React from 'react';

interface FatalScreenProps {
  message?: string | null;
  /** 应用内直接切回工作台（不经过服务端，也不会重发任何画板操作） */
  onExitToDashboard: () => void;
}

/**
 * 根层安全页面：连续异常、重试再次失败或恢复数据不可读时展示，
 * 覆盖应用根层，避免整页白屏。
 */
export const FatalScreen: React.FC<FatalScreenProps> = ({ message, onExitToDashboard }) => {
  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#f9fafb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛟</div>
      <h1 style={{ margin: '0 0 12px', fontSize: '22px', fontWeight: 700, color: '#1a1a1a' }}>
        应用遇到了无法自动恢复的问题
      </h1>
      <p
        style={{
          margin: '0 0 8px',
          fontSize: '14px',
          color: '#6b7280',
          maxWidth: '460px',
          wordBreak: 'break-word',
        }}
      >
        {message || '连续出现异常，为安全起见已停止当前操作。'}
      </p>
      <p style={{ margin: '0 0 28px', fontSize: '13px', color: '#9ca3af' }}>
        你的普通操作不会被重复提交，可返回工作台继续其他白板。
      </p>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={onExitToDashboard}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 22px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#fff',
            background: '#667eea',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          回到工作台
        </button>
        <button
          onClick={() => window.location.assign(window.location.origin + window.location.pathname)}
          style={{
            padding: '10px 22px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#374151',
            background: '#f3f4f6',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          刷新应用
        </button>
      </div>
    </div>
  );
};
