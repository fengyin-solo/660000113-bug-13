import { create } from 'zustand';

export type ErrorRegion = 'dashboard' | 'board' | 'board-socket' | 'canvas';

interface RegionError {
  /** 错误说明，随每次报错更新 */
  message: string;
  /** 错误来源：渲染异常或接口/连接请求 */
  source: 'render' | 'request';
  /** 最近一次报错时间 */
  at: number;
}

interface ErrorState {
  regions: Partial<Record<ErrorRegion, RegionError>>;
  /** 每个区域已经消耗的「重试」次数（成功一次即清零） */
  attempts: Partial<Record<ErrorRegion, number>>;
  /** 根层是否已进入安全屏（连续异常或重试再次失败时升级） */
  fatal: boolean;
  /** 安全屏上展示的说明 */
  fatalMessage: string | null;

  reportError: (region: ErrorRegion, error: unknown, source?: RegionError['source']) => void;
  /** 清除区域异常说明（不重置计数，计数仅在成功后由 resetAttempts 清零） */
  clearError: (region: ErrorRegion) => void;
  /** 重试/恢复成功后单独重置计数（此时可能已无异常记录） */
  resetAttempts: (region: ErrorRegion) => void;
  /**
   * 触发一次「重试当前区域」。
   * 返回 true 表示还可以重试；返回 false 表示连续异常已达到上限，
   * 调用方应退出到安全页面（由 store 自动升级为 fatal）。
   */
  registerRetry: (region: ErrorRegion) => boolean;
  escalateToFatal: (message?: string) => void;
  exitFatal: () => void;
}

/** 同一区域最多重试 1 次；「重试再次失败」即升级到安全页面 */
export const MAX_REGION_RETRIES = 1;

const toMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return '未知异常，请稍后重试';
};

export const useErrorStore = create<ErrorState>((set, get) => ({
  regions: {},
  attempts: {},
  fatal: false,
  fatalMessage: null,

  reportError: (region, error, source = 'request') => {
    const message = toMessage(error);
    set((state) => ({
      regions: {
        ...state.regions,
        [region]: { message, source, at: Date.now() },
      },
    }));
    // 已经消耗过重试机会后再次报错：连续异常 / 重试再次失败，升级到安全页面
    if ((get().attempts[region] ?? 0) >= MAX_REGION_RETRIES) {
      get().escalateToFatal(message);
    }
  },

  clearError: (region) => {
    set((state) => {
      if (!state.regions[region]) return state;
      const regions = { ...state.regions };
      delete regions[region];
      return { regions };
    });
  },

  resetAttempts: (region) => {
    set((state) => ({ ...state, attempts: { ...state.attempts, [region]: 0 } }));
  },

  registerRetry: (region) => {
    const used = get().attempts[region] ?? 0;
    if (used >= MAX_REGION_RETRIES) {
      const message = get().regions[region]?.message;
      get().escalateToFatal(message ?? '多次重试后仍然失败');
      return false;
    }
    set((state) => ({
      attempts: { ...state.attempts, [region]: used + 1 },
    }));
    return true;
  },

  escalateToFatal: (message) => {
    set({ fatal: true, fatalMessage: message ?? '应用连续出现异常' });
  },

  exitFatal: () => set({ fatal: false, fatalMessage: null, regions: {}, attempts: {} }),
}));
