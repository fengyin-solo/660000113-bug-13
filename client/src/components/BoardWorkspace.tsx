import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Board, BoardElement, CursorPosition, Layer, CanvasTransform } from '../types';
import { useWhiteboardStore } from '../store/whiteboard';
import { useErrorStore } from '../store/error';
import { useRecoveryStore } from '../store/recovery';
import { socketService } from '../services/socket';
import { boardApi } from '../services/api';
import { WhiteboardCanvas } from './WhiteboardCanvas';
import { Toolbar } from './Toolbar';
import { LayerPanel } from './LayerPanel';
import { CursorOverlay } from './CursorOverlay';
import { RegionBoundary } from './ErrorBoundary';
import { RegionErrorPanel } from './RegionErrorPanel';
import { RecoveryPanel } from './RecoveryPanel';

interface BoardWorkspaceProps {
  /** 从工作台带入的白板信息（列表项或本地草稿） */
  initialBoard: Board;
  /** true 表示来自工作台恢复面板的本地草稿，直接使用本地副本，不请求接口 */
  preferRecovery?: boolean;
  onBackToDashboard: () => void;
}

/**
 * 画板页面：
 * - 独立的加载/失败阶段，接口请求失败只替换画板区域（顶栏保留）；
 * - 加载/连接异常与渲染异常共用区域错误状态；
 * - 异常面板内嵌本地草稿恢复；重试再次失败升级到根层安全页面；
 * - 编辑内容防抖写入本地草稿（兜底不会把这些数据重复提交给服务端）。
 */
export const BoardWorkspace: React.FC<BoardWorkspaceProps> = ({
  initialBoard,
  preferRecovery = false,
  onBackToDashboard,
}) => {
  const {
    setBoard,
    updateCursor,
    removeCursor,
    setCursors,
    username,
  } = useWhiteboardStore();

  const boardError = useErrorStore((s) => s.regions.board);
  const boardAttempts = useErrorStore((s) => s.attempts.board ?? 0);
  const socketError = useErrorStore((s) => s.regions['board-socket']);
  const socketAttempts = useErrorStore((s) => s.attempts['board-socket'] ?? 0);

  const [loading, setLoading] = useState(!preferRecovery);
  /** 离线本地副本（恢复而来）：不 join 房间、不重发任何画板数据 */
  const [offline, setOffline] = useState(preferRecovery);
  const offlineRef = useRef(preferRecovery);
  const mountedRef = useRef(true);
  const loadSeqRef = useRef(0);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 协作连接（仅在线白板）。socket 懒创建，因此数据事件必须在 connect()
  // 之后注册；所有 handler 只更新本地状态，不回发，不会重复提交。
  const connectedRef = useRef(false);
  const connectCollab = useCallback(() => {
    if (connectedRef.current || offlineRef.current) return;
    connectedRef.current = true;
    socketService.connect();

    socketService.onUserJoined((data) => {
      console.log(`${data.username} 加入了白板`);
    });
    socketService.onUserLeft((data) => {
      removeCursor(data.socketId);
    });
    socketService.onActiveUsers((users: CursorPosition[]) => {
      setCursors(users);
    });
    socketService.onCursorUpdate((data: CursorPosition) => {
      updateCursor(data);
    });
    socketService.onElementAdded((data: { element: BoardElement; layerIndex: number }) => {
      const { board: current } = useWhiteboardStore.getState();
      if (!current || data.layerIndex >= current.layers.length) return;
      const layers = [...current.layers];
      layers[data.layerIndex] = {
        ...layers[data.layerIndex],
        elements: [...layers[data.layerIndex].elements, data.element],
      };
      setBoard({ ...current, layers });
    });
    socketService.onLayersUpdated((data: { layers: Layer[] }) => {
      const { board: current } = useWhiteboardStore.getState();
      if (current) setBoard({ ...current, layers: data.layers });
    });
    socketService.onCanvasTransformed((data: { transform: CanvasTransform }) => {
      useWhiteboardStore.getState().setCanvasTransform(data.transform);
    });

    socketService.joinBoard(initialBoard._id, username);
  }, [initialBoard._id, username, setBoard, updateCursor, removeCursor, setCursors]);

  const applyBoard = useCallback(
    (board: Board, isOffline: boolean) => {
      offlineRef.current = isOffline;
      setOffline(isOffline);
      setBoard(board);
      if (!isOffline) {
        // 数据就绪后再建立协作连接；组件已卸载则不再发起，避免离开后残留连接
        queueMicrotask(() => {
          if (mountedRef.current) connectCollab();
        });
      }
    },
    [setBoard, connectCollab]
  );

  const loadBoard = useCallback(
    async (mode: 'initial' | 'retry') => {
      if (mode === 'retry') {
        // 计数达上限会自动升级到安全页面；达到上限则不再发起请求
        if (!useErrorStore.getState().registerRetry('board')) return;
      }

      const seq = ++loadSeqRef.current;
      setLoading(true);
      try {
        const fresh = await boardApi.getBoard(initialBoard._id);
        if (seq !== loadSeqRef.current) return; // 已被更新的请求取代，丢弃结果
        if (fresh) {
          applyBoard(fresh, false);
        } else {
          // 接口未取到详情时，退回到工作台带入的数据（不触发新请求）
          applyBoard(initialBoard, false);
        }
        const errors = useErrorStore.getState();
        errors.clearError('board');
        errors.resetAttempts('board');
      } catch (error) {
        if (seq !== loadSeqRef.current) return;
        // 若这是重试后的再次失败，reportError 会自动升级到根层安全页面
        useErrorStore.getState().reportError('board', error, 'request');
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    },
    [initialBoard, applyBoard]
  );

  // 初始加载；工作台草稿入口直接恢复本地副本
  useEffect(() => {
    if (preferRecovery) {
      applyBoard(initialBoard, true);
      setLoading(false);
      return;
    }
    void loadBoard('initial');
  }, [preferRecovery, initialBoard, applyBoard, loadBoard]);

  // 连接失败回调与断开在会话级管理；数据事件在 connectCollab 中随 socket 建立注册
  useEffect(() => {
    mountedRef.current = true;
    const offFailure = socketService.onConnectionFailure(({ message }) => {
      useErrorStore.getState().reportError('board-socket', message, 'request');
    });

    return () => {
      mountedRef.current = false;
      offFailure();
      connectedRef.current = false;
      socketService.disconnect();
    };
  }, []);

  // 防抖自动保存本地草稿；仅写 localStorage，不经过接口/socket
  const board = useWhiteboardStore((s) => s.board);
  useEffect(() => {
    if (!board || loading) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      useRecoveryStore.getState().saveDraft(board);
    }, 500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [board, loading]);

  const handleRestore = useCallback(
    (restored: Board) => {
      // 恢复只替换当前区域数据，不发请求、不发 socket，普通操作不会被重复提交
      loadSeqRef.current += 1;
      const errors = useErrorStore.getState();
      errors.clearError('board');
      errors.resetAttempts('board');
      applyBoard(restored, true);
      setLoading(false);
    },
    [applyBoard]
  );

  const handleUnrecoverable = useCallback((message: string) => {
    useErrorStore.getState().escalateToFatal(message);
  }, []);

  const retrySocket = () => {
    const canRetry = useErrorStore.getState().registerRetry('board-socket');
    if (!canRetry) return;
    useErrorStore.getState().clearError('board-socket');
    // 仅重建传输层并重新加入房间；不重放任何画板数据/普通操作
    socketService.reconnect();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '48px',
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBackToDashboard}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#374151',
            background: '#f3f4f6',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          返回工作台
        </button>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>
          {initialBoard.name}
        </div>
        {offline && (
          <span
            style={{
              fontSize: '12px',
              color: '#065f46',
              background: '#d1fae5',
              padding: '2px 8px',
              borderRadius: '10px',
            }}
          >
            本地副本（离线）
          </span>
        )}
      </div>

      {/* 实时连接异常：紧凑横幅，不替换画板内容；重试再失败升级到安全页面 */}
      {socketError && !loading && !boardError && (
        <RegionErrorPanel
          compact
          message={socketError.message}
          onRetry={retrySocket}
          retryDisabled={socketAttempts >= 1}
          onExit={onBackToDashboard}
        />
      )}

      <div style={{ position: 'relative', display: 'flex', flex: 1, overflow: 'hidden' }}>
        {loading ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              background: '#f9fafb',
              color: '#6b7280',
              fontSize: '14px',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#667eea"
              strokeWidth="2"
              style={{ animation: 'wb-spin 1s linear infinite' }}
            >
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M4 12a8 8 0 018-8" />
            </svg>
            正在加载白板…
            <style>{`@keyframes wb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : boardError ? (
          <RegionErrorPanel
            title="白板加载失败"
            message={boardError.message}
            source={boardError.source}
            onRetry={() => void loadBoard('retry')}
            retryDisabled={boardAttempts >= 1}
            onExit={onBackToDashboard}
          >
            <RecoveryPanel
              boardId={initialBoard._id}
              onRestore={handleRestore}
              onUnrecoverable={handleUnrecoverable}
              embedded
            />
          </RegionErrorPanel>
        ) : (
          <RegionBoundary region="canvas" onExit={onBackToDashboard}>
            <Toolbar />
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <WhiteboardCanvas />
              <CursorOverlay />
            </div>
            <LayerPanel />
          </RegionBoundary>
        )}
      </div>
    </div>
  );
};
