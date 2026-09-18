import { create } from 'zustand';
import { Board } from '../types';

/**
 * 本地草稿恢复。
 *
 * 工作台入口（Dashboard 的恢复面板）与画板页面（加载失败后的恢复面板）
 * 读取同一份 localStorage 数据，任一处恢复或丢弃后两处通过 storage 事件
 * 自动保持同步。
 */

const INDEX_KEY = 'wb:drafts';
const DRAFT_PREFIX = 'wb:draft:';

export interface DraftMeta {
  boardId: string;
  name: string;
  savedAt: string;
  /** 内容条目读取是否失败（损坏/不可解析），仅可丢弃不可恢复 */
  corrupted?: boolean;
}

interface RecoveryState {
  drafts: DraftMeta[];
  /** 最近一次读取失败的说明（如索引整体不可读） */
  readError: string | null;
  hydrated: boolean;

  hydrate: () => void;
  saveDraft: (board: Board) => void;
  /** 读取草稿内容；不可读时返回 null 并标记该条目 corrupted */
  readDraft: (boardId: string) => Board | null;
  discardDraft: (boardId: string) => void;
  /** 索引整体不可读时，清除全部恢复数据（用户在面板中显式操作） */
  clearAllDrafts: () => void;
}

interface DraftIndexItem {
  boardId: string;
  name: string;
  savedAt: string;
}

const isDraftIndex = (value: unknown): value is DraftIndexItem[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof (item as DraftIndexItem).boardId === 'string' &&
      typeof (item as DraftIndexItem).name === 'string'
  );

const isBoard = (value: unknown): value is Board => {
  if (!value || typeof value !== 'object') return false;
  const board = value as Board;
  return (
    typeof board._id === 'string' &&
    typeof board.name === 'string' &&
    Array.isArray(board.layers)
  );
};

const readIndex = (): { items: DraftIndexItem[]; error: string | null } => {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return { items: [], error: null };
    const parsed: unknown = JSON.parse(raw);
    if (!isDraftIndex(parsed)) {
      return { items: [], error: '本地恢复数据格式不正确' };
    }
    return { items: parsed, error: null };
  } catch {
    return { items: [], error: '本地恢复数据无法读取' };
  }
};

const writeIndex = (items: DraftIndexItem[]) => {
  localStorage.setItem(INDEX_KEY, JSON.stringify(items));
};

const buildMeta = (item: DraftIndexItem): DraftMeta => {
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${item.boardId}`);
    if (!raw) return { ...item, corrupted: true };
    if (!isBoard(JSON.parse(raw))) return { ...item, corrupted: true };
    return { ...item };
  } catch {
    return { ...item, corrupted: true };
  }
};

export const useRecoveryStore = create<RecoveryState>((set, get) => ({
  drafts: [],
  readError: null,
  hydrated: false,

  hydrate: () => {
    const { items, error } = readIndex();
    set({
      drafts: items.map(buildMeta).sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
      readError: error,
      hydrated: true,
    });
  },

  saveDraft: (board) => {
    const { items } = readIndex();
    const savedAt = new Date().toISOString();
    const next = items.filter((item) => item.boardId !== board._id);
    next.unshift({ boardId: board._id, name: board.name, savedAt });
    try {
      localStorage.setItem(`${DRAFT_PREFIX}${board._id}`, JSON.stringify(board));
      writeIndex(next);
    } catch {
      // 存储空间不足等写入失败不影响正常使用
      return;
    }
    get().hydrate();
  },

  readDraft: (boardId) => {
    try {
      const raw = localStorage.getItem(`${DRAFT_PREFIX}${boardId}`);
      if (!raw) throw new Error('empty');
      const parsed: unknown = JSON.parse(raw);
      if (!isBoard(parsed)) throw new Error('invalid');
      return parsed;
    } catch {
      // 恢复数据不可读：标记条目并通知调用方退出到安全页面
      set((state) => ({
        drafts: state.drafts.map((draft) =>
          draft.boardId === boardId ? { ...draft, corrupted: true } : draft
        ),
      }));
      return null;
    }
  },

  discardDraft: (boardId) => {
    const { items } = readIndex();
    writeIndex(items.filter((item) => item.boardId !== boardId));
    localStorage.removeItem(`${DRAFT_PREFIX}${boardId}`);
    get().hydrate();
  },

  clearAllDrafts: () => {
    // 即使索引已损坏无法解析，也要清理内容键并强制删除索引键
    const { items } = readIndex();
    items.forEach((item) => localStorage.removeItem(`${DRAFT_PREFIX}${item.boardId}`));
    // 索引损坏时枚举不到内容键，按前缀兜底扫描
    const orphanKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DRAFT_PREFIX)) orphanKeys.push(key);
    }
    orphanKeys.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(INDEX_KEY);
    get().hydrate();
  },
}));

// 跨标签页 / 同页其他入口操作后的同步
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === INDEX_KEY || event.key?.startsWith(DRAFT_PREFIX)) {
      useRecoveryStore.getState().hydrate();
    }
  });
}
