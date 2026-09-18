import React from 'react';
import { useErrorStore, getRegionLabel, MAX_CONSECUTIVE_FAILURES } from '../store/errorStore';

interface ErrorBoundaryProps {
  /** 区域标识，异常会上报到共享 store，与恢复面板保持同步 */
  region: string;
  children: React.ReactNode;
  /** 关键数据（如当前白板 id）变化时自动重置，避免异常状态残留到新视图 */
  resetKeys?: unknown[];
  /** 提供后 fallback 会显示「回到工作台」入口 */
  onBackToDashboard?: () => void;
  /** 窄小区域（工具栏/图层面板）使用紧凑样式 */
  compact?: boolean;
  /** 整页区域（工作台）的 fallback 占满视口 */
  fullPage?: boolean;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface RegionFallbackProps {
  region: string;
  error: Error | null;
  compact?: boolean;
  fullPage?: boolean;
  onRetry: () => void;
  onBackToDashboard?: () => void;
}

const RegionFallback: React.FC<RegionFallbackProps> = ({
  region,
  error,
  compact,
  fullPage,
  onRetry,
  onBackToDashboard,
}) => {
  // 订阅共享异常状态：渲染/接口/连接等来源的最新说明会同步显示在这里和恢复面板
  const record = useErrorStore((state) => state.errors[region]);
  const label = getRegionLabel(region);
  const message = record?.message || error?.message || '页面加载时出现问题';
  const failures = record?.failures ?? 1;

  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '12px',
          alignSelf: 'stretch',
          minHeight: '80px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#b91c1c',
          textAlign: 'center',
        }}
      >
        <span>⚠ {label}出现异常</span>
        <button
          onClick={onRetry}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            color: '#fff',
            background: '#667eea',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        alignSelf: 'stretch',
        width: '100%',
        minHeight: fullPage ? '100vh' : '240px',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        background: '#f9fafb',
      }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2"
        style={{ marginBottom: '16px' }}
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>
        {label}暂时无法显示
      </h3>
      <p
        style={{
          margin: '0 0 4px',
          fontSize: '13px',
          color: '#6b7280',
          maxWidth: '420px',
          textAlign: 'center',
          wordBreak: 'break-word',
        }}
      >
        {message}
      </p>
      {failures > 1 && (
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#d97706' }}>
          已连续失败 {failures} 次，达到 {MAX_CONSECUTIVE_FAILURES} 次将切换到安全页面
        </p>
      )}
      <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
        <button
          onClick={onRetry}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#fff',
            background: '#667eea',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          重试当前区域
        </button>
        {onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
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
        )}
      </div>
    </div>
  );
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private unsubscribeStore: (() => void) | null = null;
  private lastResetNonce: number;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.lastResetNonce = useErrorStore.getState().resetNonce[props.region] ?? 0;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.region}]`, error, errorInfo);
    useErrorStore
      .getState()
      .reportError(this.props.region, error.message || '页面渲染出现异常', 'render');
  }

  componentDidMount() {
    // 恢复面板等外部入口触发重试时，通过 resetNonce 通知本边界重置
    this.unsubscribeStore = useErrorStore.subscribe((state) => {
      const nonce = state.resetNonce[this.props.region] ?? 0;
      if (nonce !== this.lastResetNonce) {
        this.lastResetNonce = nonce;
        if (this.state.hasError) this.reset();
      }
    });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const nextKeys = this.props.resetKeys;
    const prevKeys = prevProps.resetKeys;
    if (!this.state.hasError || !nextKeys || !prevKeys) return;
    const changed =
      nextKeys.length !== prevKeys.length ||
      nextKeys.some((key, index) => !Object.is(key, prevKeys[index]));
    if (changed) this.reset();
  }

  componentWillUnmount() {
    this.unsubscribeStore?.();
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleRetry = () => {
    // 统一走 store：标记重试、广播重置信号、执行区域注册的重试动作
    useErrorStore.getState().retryRegion(this.props.region);
    this.reset();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <RegionFallback
          region={this.props.region}
          error={this.state.error}
          compact={this.props.compact}
          fullPage={this.props.fullPage}
          onRetry={this.handleRetry}
          onBackToDashboard={this.props.onBackToDashboard}
        />
      );
    }
    return this.props.children;
  }
}
