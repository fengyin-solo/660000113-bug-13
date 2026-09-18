import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { BoardWorkspace } from './components/BoardWorkspace';
import { FatalScreen } from './components/FatalScreen';
import { useWhiteboardStore } from './store/whiteboard';
import { useErrorStore } from './store/error';
import { useRecoveryStore } from './store/recovery';
import { Board, ViewType } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [preferRecovery, setPreferRecovery] = useState(false);

  const fatal = useErrorStore((s) => s.fatal);
  const fatalMessage = useErrorStore((s) => s.fatalMessage);
  const resetSession = useWhiteboardStore((s) => s.resetSession);

  // 恢复面板的数据在两个入口共享，启动时读取一次（之后面板自身会同步）
  useEffect(() => {
    useRecoveryStore.getState().hydrate();
  }, []);

  const handleBoardSelect = (boardItem: Board, options?: { preferRecovery?: boolean }) => {
    // 进入新画板前清掉上一次的区域异常与残留会话状态
    useErrorStore.getState().exitFatal();
    resetSession();
    setActiveBoard(boardItem);
    setPreferRecovery(options?.preferRecovery ?? false);
    setCurrentView('board');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setActiveBoard(null);
    setPreferRecovery(false);
    resetSession();
    useErrorStore.getState().exitFatal();
  };

  const handleFatalExit = () => {
    // 不刷新页面、不发任何请求：只做本地状态回退，普通操作不会被重复提交
    handleBackToDashboard();
  };

  return (
    <>
      {currentView === 'dashboard' || !activeBoard ? (
        <Dashboard onBoardSelect={handleBoardSelect} />
      ) : (
        <BoardWorkspace
          key={activeBoard._id}
          initialBoard={activeBoard}
          preferRecovery={preferRecovery}
          onBackToDashboard={handleBackToDashboard}
        />
      )}

      {/* 连续异常 / 重试再次失败 / 恢复数据不可读：覆盖应用根层的安全页面 */}
      {fatal && <FatalScreen message={fatalMessage} onExitToDashboard={handleFatalExit} />}
    </>
  );
};

export default App;
