import React from 'react';
import { useErrorStore, getRegionLabel, ErrorSource } from '../store/errorStore';

interface RecoveryPanelProps {
  /** 处于画板视图时提供「回到工作台」入口 */
  onBackToDashboard?: () => void;
}

const SOURCE_LABELS: Record<ErrorSource, string> = {
  render: '页面渲染',
  api: '接口请求',
  socket: '实时连接',
  recovery: '数据恢复',
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/**
 * 全局恢复面板：与各区域 fallback 读取同一份异常状态，
 * 无论异常发生在工作台入口还是画板页面，两处显示保持同步。
 */
export const RecoveryPanel: React.FC<RecoveryPanelProps> = ({ onBackToDashboard }) => {
  const errors = useErrorStore((state) => state.errors);
  const retryRegion = useErrorStore((state) => state.retryRegion);

  const visibleErrors = Object.entries(errors).filter(([, record]) => !record.dismissed);
  if (visibleErrors.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        width: '320px',
        maxWidth: 'calc(100vw - 48px)',
        background: '#fff',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.16)',
        borderLeft: '4px solid #ef4444',
        zIndex: 2000,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f3f4f6',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>
          异常恢复（{visibleErrors.length}）
        </span>
      </div>

      <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
        {visibleErrors.map(([region, record]) => (
          <div
            key={region}
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #f3f4f6',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '4px',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                {getRegionLabel(region)} · {SOURCE_LABELS[record.source]}
              </span>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                {formatTime(record.updatedAt)}
              </span>
            </div>
            <p
              style={{
                margin: '0 0 8px',
                fontSize: '12px',
                color: '#6b7280',
                lineHeight: 1.5,
                wordBreak: 'break-word',
              }}
            >
              {record.message}
              {record.failures > 1 && `（已连续失败 ${record.failures} 次）`}
            </p>
            <button
              onClick={() => retryRegion(region)}
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#fff',
                background: '#667eea',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              重试当前区域
            </button>
          </div>
        ))}
      </div>

      {onBackToDashboard && (
        <div style={{ padding: '12px 16px', background: '#f9fafb' }}>
          <button
            onClick={onBackToDashboard}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#374151',
              background: '#e5e7eb',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            回到工作台
          </button>
        </div>
      )}
    </div>
  );
};
