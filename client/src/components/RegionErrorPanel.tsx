import React from 'react';

interface RegionErrorPanelProps {
  title?: string;
  message?: string;
  /** 错误来源：接口请求 / 渲染异常 */
  source?: 'render' | 'request';
  onRetry: () => void;
  /** 回到工作台入口；工作台区域自身出错时可不传 */
  onExit?: () => void;
  retryLabel?: string;
  /** 重试已再次失败时禁用，交由外层升级到安全页面 */
  retryDisabled?: boolean;
  /** 紧凑样式（如连接异常横幅） */
  compact?: boolean;
  /** 附加内容（如本地草稿恢复面板） */
  children?: React.ReactNode;
}

const buttonBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '9px 18px',
  fontSize: '14px',
  fontWeight: 500,
  borderRadius: '8px',
  cursor: 'pointer',
  border: 'none',
};

export const RegionErrorPanel: React.FC<RegionErrorPanelProps> = ({
  title = '当前区域加载失败',
  message,
  source,
  onRetry,
  onExit,
  retryLabel = '重试当前区域',
  retryDisabled = false,
  compact = false,
  children,
}) => {
  if (compact) {
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 16px',
          background: '#fef2f2',
          borderBottom: '1px solid #fecaca',
          color: '#991b1b',
          fontSize: '13px',
          zIndex: 20,
        }}
      >
        <span style={{ flexShrink: 0 }}>⚠️</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {message || '实时连接中断'}
        </span>
        <button
          onClick={onRetry}
          disabled={retryDisabled}
          style={{
            ...buttonBase,
            padding: '5px 12px',
            color: '#fff',
            background: retryDisabled ? '#9ca3af' : '#dc2626',
            cursor: retryDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {retryLabel}
        </button>
        {onExit && (
          <button
            onClick={onExit}
            style={{
              ...buttonBase,
              padding: '5px 12px',
              color: '#991b1b',
              background: '#fff',
              border: '1px solid #fecaca',
            }}
          >
            回到工作台
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      style={{
        position: 'absolute',
        inset: 0,
        background: '#f9fafb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        textAlign: 'center',
        overflow: 'auto',
      }}
    >
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>😵</div>
      <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: '#1a1a1a' }}>
        {title}
      </h2>
      <p
        data-testid="region-error-message"
        style={{
          margin: '0 0 4px',
          fontSize: '14px',
          color: '#6b7280',
          maxWidth: '420px',
          wordBreak: 'break-word',
        }}
      >
        {message || '页面加载时出现问题'}
      </p>
      {source && (
        <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#9ca3af' }}>
          {source === 'request' ? '（接口请求异常）' : '（页面渲染异常）'}
        </p>
      )}
      <div style={{ display: 'flex', gap: '12px', marginBottom: children ? '20px' : 0 }}>
        <button
          onClick={onRetry}
          disabled={retryDisabled}
          style={{
            ...buttonBase,
            color: '#fff',
            background: retryDisabled ? '#9ca3af' : '#667eea',
            cursor: retryDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          {retryLabel}
        </button>
        {onExit && (
          <button
            onClick={onExit}
            style={{
              ...buttonBase,
              color: '#374151',
              background: '#f3f4f6',
            }}
          >
            回到工作台
          </button>
        )}
      </div>
      {children && <div style={{ width: '100%', maxWidth: '420px' }}>{children}</div>}
    </div>
  );
};
