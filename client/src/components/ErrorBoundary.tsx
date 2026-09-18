import React from 'react';
import { RegionErrorPanel } from './RegionErrorPanel';
import { FatalScreen } from './FatalScreen';
import { ErrorRegion, useErrorStore } from '../store/error';

interface RegionBoundaryProps {
  region: ErrorRegion;
  title?: string;
  /** 回到工作台入口 */
  onExit?: () => void;
  /** 异常面板中的附加内容（如本地草稿恢复） */
  fallbackExtra?: React.ReactNode;
  children: React.ReactNode;
}

interface RegionBoundaryState {
  hasError: boolean;
  /** 本次崩溃的错误对象，保证异常说明随每次崩溃即时更新、不残留旧信息 */
  error: Error | null;
}

/**
 * 区域级异常边界：
 * - 子树渲染崩溃时只替换该区域，不影响应用其他部分；
 * - 「重试当前区域」通过更换 key 整体重挂子树，成功后清掉异常与计数；
 * - 连续异常 / 重试再次失败时由错误 store 升级到根层安全页面；
 * - 错误信息保存在组件 state，fallback 首帧即可读到最新说明。
 */
export class RegionBoundary extends React.Component<RegionBoundaryProps, RegionBoundaryState> {
  state: RegionBoundaryState = { hasError: false, error: null };
  private retrySeq = 0;

  static getDerivedStateFromError(error: Error): RegionBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[RegionBoundary:${this.props.region}]`, error, errorInfo);
    // 同步到统一错误 store：重试计数耗尽时自动升级到安全页面
    useErrorStore.getState().reportError(this.props.region, error, 'render');
  }

  componentDidUpdate(_: RegionBoundaryProps, prevState: RegionBoundaryState) {
    if (prevState.hasError && !this.state.hasError) {
      // 重挂后渲染成功，清除本区域异常与重试计数
      const store = useErrorStore.getState();
      store.clearError(this.props.region);
      store.resetAttempts(this.props.region);
    }
  }

  private handleRetry = () => {
    const store = useErrorStore.getState();
    // 返回 false 表示连续异常已达上限，store 已升级到根层安全页面
    if (!store.registerRetry(this.props.region)) return;
    this.retrySeq += 1;
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <RegionErrorPanel
          title={this.props.title}
          message={this.state.error?.message}
          source="render"
          onRetry={this.handleRetry}
          onExit={this.props.onExit}
        >
          {this.props.fallbackExtra}
        </RegionErrorPanel>
      );
    }
    return <React.Fragment key={this.retrySeq}>{this.props.children}</React.Fragment>;
  }
}

interface RootBoundaryState {
  hasError: boolean;
  message: string | null;
}

/**
 * 应用根层边界：只兜底区域边界之外的致命渲染崩溃，覆盖整个应用根层，
 * 避免白屏。此层级不依赖应用内状态，直接提供刷新/回到工作台（重新加载）。
 */
export class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  RootBoundaryState
> {
  state: RootBoundaryState = { hasError: false, message: null };

  static getDerivedStateFromError(error: Error): RootBoundaryState {
    return { hasError: true, message: error?.message ?? null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[RootErrorBoundary]', error, errorInfo);
  }

  private reloadToSafePage = () => {
    window.location.assign(window.location.origin + window.location.pathname);
  };

  render() {
    if (this.state.hasError) {
      return <FatalScreen message={this.state.message} onExitToDashboard={this.reloadToSafePage} />;
    }
    return this.props.children;
  }
}
