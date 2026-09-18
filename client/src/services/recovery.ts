import { Board } from '../types';

const RECOVERY_PREFIX = 'whiteboard:recovery:';
const RECOVERY_VERSION = 1;
const SAVE_DEBOUNCE_MS = 800;

export class RecoveryDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecoveryDataError';
  }
}

interface RecoverySnapshot {
  version: number;
  boardId: string;
  savedAt: string;
  board: Board;
}

const isValidBoard = (board: unknown): board is Board => {
  if (!board || typeof board !== 'object') return false;
  const candidate = board as Partial<Board>;
  return (
    typeof candidate._id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.layers) &&
    candidate.layers.every(
      (layer) =>
        !!layer &&
        typeof layer === 'object' &&
        typeof (layer as { name?: unknown }).name === 'string' &&
        Array.isArray((layer as { elements?: unknown }).elements)
    )
  );
};

export const saveRecoverySnapshot = (board: Board): void => {
  try {
    const snapshot: RecoverySnapshot = {
      version: RECOVERY_VERSION,
      boardId: board._id,
      savedAt: new Date().toISOString(),
      board,
    };
    localStorage.setItem(RECOVERY_PREFIX + board._id, JSON.stringify(snapshot));
  } catch (error) {
    // 存储不可用（容量满/隐私模式）时静默失败，不影响正常协作
    console.warn('[Recovery] 无法保存画板恢复数据:', error);
  }
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingBoard: Board | null = null;

/** 画板数据变化频繁，防抖后再写入本地快照 */
export const scheduleRecoverySave = (board: Board): void => {
  pendingBoard = board;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (pendingBoard) saveRecoverySnapshot(pendingBoard);
    pendingBoard = null;
    saveTimer = null;
  }, SAVE_DEBOUNCE_MS);
};

/**
 * 读取并校验恢复快照。
 * 数据缺失、JSON 损坏、版本不兼容或结构不符时抛出 RecoveryDataError，
 * 由调用方决定退出到安全页面。
 */
export const loadRecoverySnapshot = (boardId: string): Board => {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(RECOVERY_PREFIX + boardId);
  } catch {
    throw new RecoveryDataError('无法读取本地恢复数据');
  }
  if (!raw) {
    throw new RecoveryDataError('没有找到可恢复的画板数据');
  }
  let snapshot: RecoverySnapshot;
  try {
    snapshot = JSON.parse(raw) as RecoverySnapshot;
  } catch {
    throw new RecoveryDataError('画板恢复数据已损坏，无法解析');
  }
  if (
    !snapshot ||
    snapshot.version !== RECOVERY_VERSION ||
    snapshot.boardId !== boardId ||
    !isValidBoard(snapshot.board)
  ) {
    throw new RecoveryDataError('画板恢复数据版本不兼容或结构已损坏');
  }
  return snapshot.board;
};

export const clearRecoverySnapshot = (boardId: string): void => {
  try {
    localStorage.removeItem(RECOVERY_PREFIX + boardId);
  } catch {
    /* 忽略存储异常 */
  }
};

export const clearAllRecoverySnapshots = (): void => {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(RECOVERY_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* 忽略存储异常 */
  }
};
