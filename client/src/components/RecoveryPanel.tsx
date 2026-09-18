import React, { useEffect } from 'react';
import { Board } from '../types';
import { useRecoveryStore, DraftMeta } from '../store/recovery';

interface RecoveryPanelProps {
  /** 画板页面传入：只展示该画板的本地副本；工作台入口不传，展示全部草稿 */
  boardId?: string;
  /** 成功读出草稿内容时回调；不可读时回调不会触发 */
  onRestore: (board: Board) => void;
  /** 恢复数据不可读且处于错误恢复语境（embedded）时，退出到安全页面 */
  onUnrecoverable: (message: string) => void;
  /** 面板标题（嵌入异常面板时可隐藏） */
  embedded?: boolean;
}

const formatSavedAt = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '未知时间';
  return date.toLocaleString('zh-CN', { hour12: false });
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 12px',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  marginBottom: '8px',
  textAlign: 'left',
};

export const RecoveryPanel: React.FC<RecoveryPanelProps> = ({
  boardId,
  onRestore,
  onUnrecoverable,
  embedded = false,
}) => {
  const {
    drafts,
    readError,
    hydrated,
    hydrate,
    readDraft,
    discardDraft,
    clearAllDrafts,
  } = useRecoveryStore();

  // 每次打开面板都重新读取，保证工作台入口与画板页面两处内容同步
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const visibleDrafts: DraftMeta[] = boardId
    ? drafts.filter((draft) => draft.boardId === boardId)
    : drafts;

  // 索引整体不可读：
  // - 处于异常恢复语境（embedded）时属于「恢复数据不可读」，升级到安全页面；
  // - 工作台正常入口提供「清除损坏数据」，不让整个应用不可用。
  useEffect(() => {
    if (hydrated && readError && embedded) {
      onUnrecoverable(readError);
    }
  }, [hydrated, readError, embedded, onUnrecoverable]);

  if (!hydrated) return null;

  if (readError && !embedded) {
    return (
      <div>
        <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 600, color: '#1a1a1a' }}>
          ♻️ 本地草稿恢复
        </h3>
        <div style={{ ...cardStyle, flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#991b1b' }}>
            本地恢复数据无法读取，可清除损坏数据后继续使用。
          </span>
          <button
            onClick={() => clearAllDrafts()}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              color: '#991b1b',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            清除损坏的恢复数据
          </button>
        </div>
      </div>
    );
  }

  const handleRestore = (draft: DraftMeta) => {
    const board = readDraft(draft.boardId);
    if (!board) {
      // 用户显式恢复但条目内容不可读
      onUnrecoverable('本地恢复数据不可读');
      return;
    }
    onRestore(board);
  };

  const header = embedded ? (
    <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
      或恢复最近的本地草稿
    </p>
  ) : (
    <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 600, color: '#1a1a1a' }}>
      ♻️ 本地草稿恢复
    </h3>
  );

  if (visibleDrafts.length === 0) {
    return boardId ? null : (
      <div>
        {header}
        <div style={{ ...cardStyle, color: '#9ca3af', fontSize: '13px', justifyContent: 'center' }}>
          暂无本地草稿
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}
      {visibleDrafts.map((draft) => (
        <div key={draft.boardId} style={cardStyle}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#1a1a1a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {draft.name}
            </span>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>
              {draft.corrupted ? '草稿已损坏，无法读取' : `保存于 ${formatSavedAt(draft.savedAt)}`}
            </span>
          </span>
          {draft.corrupted ? (
            <button
              onClick={() => discardDraft(draft.boardId)}
              style={{
                padding: '5px 10px',
                fontSize: '12px',
                color: '#991b1b',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              丢弃
            </button>
          ) : (
            <>
              <button
                onClick={() => handleRestore(draft)}
                style={{
                  padding: '5px 12px',
                  fontSize: '12px',
                  color: '#fff',
                  background: '#059669',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                {boardId ? '恢复本地副本' : '打开'}
              </button>
              <button
                onClick={() => discardDraft(draft.boardId)}
                style={{
                  padding: '5px 10px',
                  fontSize: '12px',
                  color: '#6b7280',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                丢弃
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
};
