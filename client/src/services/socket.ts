import { io, Socket } from 'socket.io-client';
import { CursorPosition, BoardElement, Layer, CanvasTransform } from '../types';

const SERVER_URL = '/';

type ConnectionListener = (data: { phase: 'connect_error' | 'reconnect_failed'; message: string }) => void;

class SocketService {
  private socket: Socket | null = null;
  private boardId: string | null = null;
  private username: string | null = null;
  /** 已经成功加入过的房间标记，保证 join 幂等、不重复提交 */
  private joined = false;
  /** 同一次连接生命周期内终态失败只上报一次，避免重复触发兜底 */
  private terminalReported = false;
  private connectionListeners = new Set<ConnectionListener>();

  connect(): Socket {
    if (!this.socket) {
      this.socket = io(SERVER_URL, {
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 2000,
        timeout: 10000,
      });

      // 首次连接失败（含握手错误）
      this.socket.on('connect_error', (err: Error) => {
        if (this.socket && this.socket.active) return; // 仍会自动重连，不报错打断
        if (this.terminalReported) return;
        this.terminalReported = true;
        this.emitConnectionFailure('connect_error', err?.message || '无法连接到协作服务');
      });

      // 自动重连次数耗尽
      this.socket.io.on('reconnect_failed', () => {
        if (this.terminalReported) return;
        this.terminalReported = true;
        this.emitConnectionFailure('reconnect_failed', '实时连接已断开，重连失败');
      });

      // 连接（重新）建立：重置上报标记
      this.socket.on('connect', () => {
        this.terminalReported = false;
      });

      // 重连成功后需要重新加入房间（新 socket 会话），但只发一次
      this.socket.io.on('reconnect', () => {
        this.joined = false;
        if (this.boardId && this.username) {
          this.joinBoard(this.boardId, this.username);
        }
      });
    }
    this.socket.connect();
    return this.socket;
  }

  private emitConnectionFailure(phase: 'connect_error' | 'reconnect_failed', message: string) {
    this.connectionListeners.forEach((listener) => listener({ phase, message }));
  }

  onConnectionFailure(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.io.off('reconnect_failed');
      this.socket.io.off('reconnect');
      this.socket.disconnect();
      this.socket = null;
    }
    this.boardId = null;
    this.username = null;
    this.joined = false;
    this.connectionListeners.clear();
  }

  /**
   * 手动重连（异常横幅的「重试」）：只重建传输层，
   * 保留失败订阅与房间信息，不触碰本地数据，因此不会重复提交任何操作。
   */
  reconnect(): void {
    this.joined = false;
    this.terminalReported = false; // 允许本次重试再次上报失败
    if (this.socket) {
      this.socket.disconnect();
      this.socket.connect();
    } else {
      this.connect();
    }
    if (this.boardId && this.username) {
      this.joinBoard(this.boardId, this.username);
    }
  }

  joinBoard(boardId: string, username: string): void {
    // 幂等：同一房间不重复 join，避免重试导致的重复提交
    if (this.joined && this.boardId === boardId) return;
    this.boardId = boardId;
    this.username = username;
    this.socket?.emit('join-board', { boardId, username });
    this.joined = true;
  }

  moveCursor(x: number, y: number): void {
    if (this.boardId && this.joined) {
      this.socket?.emit('cursor-move', { boardId: this.boardId, x, y });
    }
  }

  drawElement(element: BoardElement, layerIndex: number): void {
    if (this.boardId && this.joined) {
      this.socket?.emit('draw-element', { boardId: this.boardId, element, layerIndex });
    }
  }

  updateElement(elementId: string, updates: Partial<BoardElement>, layerIndex: number): void {
    if (this.boardId && this.joined) {
      this.socket?.emit('update-element', { boardId: this.boardId, elementId, updates, layerIndex });
    }
  }

  deleteElement(elementId: string, layerIndex: number): void {
    if (this.boardId && this.joined) {
      this.socket?.emit('delete-element', { boardId: this.boardId, elementId, layerIndex });
    }
  }

  addStickyNote(note: BoardElement, layerIndex: number): void {
    if (this.boardId && this.joined) {
      this.socket?.emit('add-sticky-note', { boardId: this.boardId, note, layerIndex });
    }
  }

  addShape(shape: BoardElement, layerIndex: number): void {
    if (this.boardId && this.joined) {
      this.socket?.emit('add-shape', { boardId: this.boardId, shape, layerIndex });
    }
  }

  updateLayers(layers: Layer[]): void {
    if (this.boardId && this.joined) {
      this.socket?.emit('layer-update', { boardId: this.boardId, layers });
    }
  }

  canvasTransform(transform: CanvasTransform): void {
    if (this.boardId && this.joined) {
      this.socket?.emit('canvas-transform', { boardId: this.boardId, transform });
    }
  }

  onUserJoined(callback: (data: { socketId: string; username: string }) => void): void {
    this.socket?.on('user-joined', callback);
  }

  onUserLeft(callback: (data: { socketId: string; username: string }) => void): void {
    this.socket?.on('user-left', callback);
  }

  onActiveUsers(callback: (users: CursorPosition[]) => void): void {
    this.socket?.on('active-users', callback);
  }

  onCursorUpdate(callback: (data: CursorPosition) => void): void {
    this.socket?.on('cursor-update', callback);
  }

  onElementAdded(callback: (data: { element: BoardElement; layerIndex: number }) => void): void {
    this.socket?.on('element-added', callback);
  }

  onElementUpdated(callback: (data: { elementId: string; updates: Partial<BoardElement>; layerIndex: number }) => void): void {
    this.socket?.on('element-updated', callback);
  }

  onElementDeleted(callback: (data: { elementId: string; layerIndex: number }) => void): void {
    this.socket?.on('element-deleted', callback);
  }

  onStickyNoteAdded(callback: (data: { note: BoardElement; layerIndex: number }) => void): void {
    this.socket?.on('sticky-note-added', callback);
  }

  onShapeAdded(callback: (data: { shape: BoardElement; layerIndex: number }) => void): void {
    this.socket?.on('shape-added', callback);
  }

  onLayersUpdated(callback: (data: { layers: Layer[] }) => void): void {
    this.socket?.on('layers-updated', callback);
  }

  onCanvasTransformed(callback: (data: { transform: CanvasTransform }) => void): void {
    this.socket?.on('canvas-transformed', callback);
  }

  off(event: string, callback?: (...args: unknown[]) => void): void {
    this.socket?.off(event, callback);
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();
