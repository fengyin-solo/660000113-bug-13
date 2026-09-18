import { create } from 'zustand';

export type ErrorSource = 'render' | 'api' | 'socket' | 'recovery';

export interface ErrorRecord {
  message: string;
  source: ErrorSource;
  /** 连续失败次数：重试不会清零，只有区域真正恢复或离开区域时才清零 */
  failures: number;
  updatedAt: number;
  /** 已触发重试、等待结果：恢复面板暂时隐藏，但连续失败计数保留 */
  dismissed: boolean;
}

/** 同一区域连续失败达到该次数后退出到安全页面 */
export const MAX_CONSECUTIVE_FAILURES = 3;

export const REGION_LABELS: Record<string, string> = {
  root: '应用',
  dashboard: '工作台',
  board: '画板',
  toolbar: '工具栏',
  canvas: '画布',
  layerPanel: '图层面板',
};

export const getRegionLabel = (region: string): string => REGION_LABELS[region] ?? region;

interface SafeModeState {
  active: boolean;
  reason: string | null;
}

interface ErrorState {
  errors: Record<string, ErrorRecord>;
  safeMode: SafeModeState;
  /** 每个区域的重置信号，ErrorBoundary 订阅后重置自身状态 */
  resetNonce: Record<string, number>;
  /** 每个区域注册的重试动作（如重新拉取接口、恢复画板数据） */
  retryHandlers: Record<string, (() => void) | undefined>;

  reportError: (region: string, message: string, source: ErrorSource) => void;
  clearError: (region: string) => void;
  retryRegion: (region: string) => void;
  registerRetryHandler: (region: string, handler: () => void) => () => void;
  enterSafeMode: (reason: string) => void;
  exitSafeMode: () => void;
}

export const useErrorStore = create<ErrorState>((set, get) => ({
  errors: {},
  safeMode: { active: false, reason: null },
  resetNonce: {},
  retryHandlers: {},

  reportError: (region, message, source) => {
    const existing = get().errors[region];
    const failures = (existing?.failures ?? 0) + 1;
    set((state) => ({
      errors: {
        ...state.errors,
        // 每次上报都刷新说明与时间，区域 fallback 和恢复面板同步更新
        [region]: { message, source, failures, updatedAt: Date.now(), dismissed: false },
      },
    }));
    if (failures >= MAX_CONSECUTIVE_FAILURES) {
      get().enterSafeMode(
        `「${getRegionLabel(region)}」连续 ${failures} 次未能恢复：${message}`
      );
    }
  },

  clearError: (region) => {
    if (!get().errors[region]) return;
    set((state) => {
      const errors = { ...state.errors };
      delete errors[region];
      return { errors };
    });
  },

  retryRegion: (region) => {
    set((state) => {
      const existing = state.errors[region];
      return {
        // 保留 failures 计数：重试再次失败时继续累加，达到阈值进入安全页面
        errors: existing
          ? { ...state.errors, [region]: { ...existing, dismissed: true } }
          : state.errors,
        resetNonce: { ...state.resetNonce, [region]: (state.resetNonce[region] ?? 0) + 1 },
      };
    });
    get().retryHandlers[region]?.();
  },

  registerRetryHandler: (region, handler) => {
    set((state) => ({ retryHandlers: { ...state.retryHandlers, [region]: handler } }));
    return () => {
      set((state) => {
        if (state.retryHandlers[region] !== handler) return state;
        const retryHandlers = { ...state.retryHandlers };
        delete retryHandlers[region];
        return { retryHandlers };
      });
    };
  },

  enterSafeMode: (reason) => {
    if (get().safeMode.active) return;
    set({ safeMode: { active: true, reason } });
  },

  exitSafeMode: () => {
    set({ safeMode: { active: false, reason: null }, errors: {}, resetNonce: {} });
  },
}));
