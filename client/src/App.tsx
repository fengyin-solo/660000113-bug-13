import React, { useState, useEffect } from 'react';
import { WhiteboardCanvas } from './components/WhiteboardCanvas';
import { Toolbar } from './components/Toolbar';
import { LayerPanel } from './components/LayerPanel';
import { CursorOverlay } from './components/CursorOverlay';
import { Dashboard } from './components/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RecoveryPanel } from './components/RecoveryPanel';
import { useWhiteboardStore } from './store/whiteboard';
import { useErrorStore } from './store/errorStore';
import { socketService } from './services/socket';
import { loadRecoverySnapshot, scheduleRecoverySave } from './services/recovery';
import { Board, BoardElement, CursorPosition, Layer, CanvasTransform, ViewType } from './types';

// 画板视图内的区域：进出画板时统一清理，避免异常状态残留
const BOARD_REGIONS = ['board', 'toolbar', 'canvas', 'layerPanel'];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const {
    setBoard, updateCursor, removeCursor, setCursors, username
  } = useWhiteboardStore();
  const reportError = useErrorStore((state) => state.reportError);
  const clearError = useErrorStore((state) => state.clearError);
  const registerRetryHandler = useErrorStore((state) => state.registerRetryHandler);
  const enterSafeMode = useErrorStore((state) => state.enterSafeMode);

  useEffect(() => {
    if (currentView === 'board' && activeBoard) {
      setBoard(activeBoard);

      socketService.connect();
      socketService.joinBoard(activeBoard._id, username);

      socketService.onConnect(() => {
        // 实时连接恢复后，同步清除画板区域与恢复面板中的连接异常
        clearError('board');
      });
      socketService.onConnectError(() => {
        reportError('board', '实时协作连接失败，画布修改可能无法同步', 'socket');
      });
      socketService.onUserJoined((data) => {
        console.log(`${data.username} 加入了白板`);
      });
      socketService.onUserLeft((data) => {
        removeCursor(data.socketId);
      });
      socketService.onActiveUsers((users) => {
        setCursors(users);
      });
      socketService.onCursorUpdate((data: CursorPosition) => {
        updateCursor(data);
      });
      socketService.onElementAdded((data: { element: BoardElement; layerIndex: number }) => {
        const { board: currentBoard } = useWhiteboardStore.getState();
        if (currentBoard) {
          const layers = [...currentBoard.layers];
          layers[data.layerIndex] = {
            ...layers[data.layerIndex],
            elements: [...layers[data.layerIndex].elements, data.element]
          };
          setBoard({ ...currentBoard, layers });
        }
      });
      socketService.onLayersUpdated((data: { layers: Layer[] }) => {
        const { board: currentBoard } = useWhiteboardStore.getState();
        if (currentBoard) {
          setBoard({ ...currentBoard, layers: data.layers });
        }
      });
      socketService.onCanvasTransformed((data: { transform: CanvasTransform }) => {
        useWhiteboardStore.getState().setCanvasTransform(data.transform);
      });

      return () => {
        socketService.disconnect();
      };
    }
  }, [currentView, activeBoard]);

  // 画板数据变化时保存本地恢复快照（防抖），供画板区域出错后恢复
  useEffect(() => {
    const unsubscribe = useWhiteboardStore.subscribe((state, prevState) => {
      if (state.board && state.board !== prevState.board) {
        scheduleRecoverySave(state.board);
      }
    });
    return unsubscribe;
  }, []);

  // 画板区域的重试动作：从本地快照恢复画板数据；
  // 恢复数据不可读时退出到安全页面。恢复只更新本地状态，不重放任何提交。
  useEffect(() => {
    if (!activeBoard) return;
    return registerRetryHandler('board', () => {
      try {
        const restored = loadRecoverySnapshot(activeBoard._id);
        useWhiteboardStore.getState().setBoard(restored);
      } catch (error) {
        enterSafeMode(error instanceof Error ? error.message : '画板恢复数据不可读');
      }
    });
  }, [activeBoard, registerRetryHandler, enterSafeMode]);

  const handleBoardSelect = (boardItem: Board) => {
    BOARD_REGIONS.forEach((region) => clearError(region));
    setActiveBoard(boardItem);
    setCurrentView('board');
  };

  const handleBackToDashboard = () => {
    BOARD_REGIONS.forEach((region) => clearError(region));
    setCurrentView('dashboard');
    setActiveBoard(null);
  };

  if (currentView === 'dashboard') {
    return (
      <>
        <ErrorBoundary region="dashboard" fullPage>
          <Dashboard onBoardSelect={handleBoardSelect} />
        </ErrorBoundary>
        <RecoveryPanel />
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <div style={{
          height: '48px',
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '12px',
        }}>
          <button
            onClick={handleBackToDashboard}
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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f3f4f6';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            返回工作台
          </button>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#1a1a1a',
          }}>
            {activeBoard?.name}
          </div>
        </div>
        <ErrorBoundary
          region="board"
          resetKeys={[activeBoard?._id]}
          onBackToDashboard={handleBackToDashboard}
        >
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <ErrorBoundary region="toolbar" compact onBackToDashboard={handleBackToDashboard}>
              <Toolbar />
            </ErrorBoundary>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
              <ErrorBoundary
                region="canvas"
                resetKeys={[activeBoard?._id]}
                onBackToDashboard={handleBackToDashboard}
              >
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                  <WhiteboardCanvas />
                  <CursorOverlay />
                </div>
              </ErrorBoundary>
            </div>
            <ErrorBoundary region="layerPanel" compact onBackToDashboard={handleBackToDashboard}>
              <LayerPanel />
            </ErrorBoundary>
          </div>
        </ErrorBoundary>
      </div>
      <RecoveryPanel onBackToDashboard={handleBackToDashboard} />
    </>
  );
};

export default App;
