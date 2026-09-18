import { create } from 'zustand';
import { Board, BoardElement, CursorPosition, CanvasTransform, ToolType, Layer } from '../types';
import { socketService } from '../services/socket';

interface WhiteboardState {
  board: Board | null;
  activeTool: ToolType;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  activeLayerIndex: number;
  cursors: Map<string, CursorPosition>;
  canvasTransform: CanvasTransform;
  username: string;

  // Actions
  setBoard: (board: Board) => void;
  setActiveTool: (tool: ToolType) => void;
  setStrokeColor: (color: string) => void;
  setFillColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setActiveLayerIndex: (index: number) => void;
  addElement: (element: BoardElement) => void;
  updateElement: (elementId: string, updates: Partial<BoardElement>) => void;
  deleteElement: (elementId: string) => void;
  addLayer: (name: string) => void;
  toggleLayerVisibility: (index: number) => void;
  toggleLayerLock: (index: number) => void;
  setCanvasTransform: (transform: CanvasTransform) => void;
  updateCursor: (cursor: CursorPosition) => void;
  removeCursor: (socketId: string) => void;
  setCursors: (cursors: CursorPosition[]) => void;
  setUsername: (name: string) => void;
  /** 离开画板 / 退出到安全页面时重置会话，避免异常状态残留到下一次进入 */
  resetSession: () => void;
}

export const useWhiteboardStore = create<WhiteboardState>((set, get) => ({
  board: null,
  activeTool: 'pen',
  strokeColor: '#000000',
  fillColor: 'transparent',
  strokeWidth: 2,
  activeLayerIndex: 0,
  cursors: new Map(),
  canvasTransform: { scale: 1, translateX: 0, translateY: 0 },
  username: `User_${Math.random().toString(36).substr(2, 6)}`,

  setBoard: (board) => set({ board }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setStrokeColor: (color) => set({ strokeColor: color }),
  setFillColor: (color) => set({ fillColor: color }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),
  setActiveLayerIndex: (index) => set({ activeLayerIndex: index }),

  addElement: (element) => {
    const { board, activeLayerIndex } = get();
    if (!board) return;
    const layers = [...board.layers];
    layers[activeLayerIndex] = {
      ...layers[activeLayerIndex],
      elements: [...layers[activeLayerIndex].elements, element]
    };
    set({ board: { ...board, layers } });
    socketService.drawElement(element, activeLayerIndex);
  },

  updateElement: (elementId, updates) => {
    const { board, activeLayerIndex } = get();
    if (!board) return;
    const layers = [...board.layers];
    const elements = layers[activeLayerIndex].elements.map(el =>
      el.id === elementId ? { ...el, ...updates } : el
    );
    layers[activeLayerIndex] = { ...layers[activeLayerIndex], elements };
    set({ board: { ...board, layers } });
    socketService.updateElement(elementId, updates, activeLayerIndex);
  },

  deleteElement: (elementId) => {
    const { board, activeLayerIndex } = get();
    if (!board) return;
    const layers = [...board.layers];
    const elements = layers[activeLayerIndex].elements.filter(el => el.id !== elementId);
    layers[activeLayerIndex] = { ...layers[activeLayerIndex], elements };
    set({ board: { ...board, layers } });
    socketService.deleteElement(elementId, activeLayerIndex);
  },

  addLayer: (name) => {
    const { board } = get();
    if (!board) return;
    const newLayer: Layer = { name, visible: true, locked: false, order: board.layers.length, elements: [] };
    const layers = [...board.layers, newLayer];
    set({ board: { ...board, layers }, activeLayerIndex: layers.length - 1 });
    socketService.updateLayers(layers);
  },

  toggleLayerVisibility: (index) => {
    const { board } = get();
    if (!board) return;
    const layers = [...board.layers];
    layers[index] = { ...layers[index], visible: !layers[index].visible };
    set({ board: { ...board, layers } });
    socketService.updateLayers(layers);
  },

  toggleLayerLock: (index) => {
    const { board } = get();
    if (!board) return;
    const layers = [...board.layers];
    layers[index] = { ...layers[index], locked: !layers[index].locked };
    set({ board: { ...board, layers } });
    socketService.updateLayers(layers);
  },

  setCanvasTransform: (transform) => {
    set({ canvasTransform: transform });
    socketService.canvasTransform(transform);
  },

  updateCursor: (cursor) => {
    const cursors = new Map(get().cursors);
    cursors.set(cursor.socketId, cursor);
    set({ cursors });
  },

  removeCursor: (socketId) => {
    const cursors = new Map(get().cursors);
    cursors.delete(socketId);
    set({ cursors });
  },

  setCursors: (cursorsList) => {
    const cursors = new Map();
    cursorsList.forEach(c => cursors.set(c.socketId, c));
    set({ cursors });
  },

  setUsername: (name) => set({ username: name }),

  resetSession: () =>
    set({
      board: null,
      activeTool: 'pen',
      activeLayerIndex: 0,
      cursors: new Map(),
      canvasTransform: { scale: 1, translateX: 0, translateY: 0 },
    }),
}));
