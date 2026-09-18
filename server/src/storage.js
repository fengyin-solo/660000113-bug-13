const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../data');
const BOARDS_FILE = path.join(DATA_DIR, 'boards.json');

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const readBoards = () => {
  ensureDataDir();
  if (!fs.existsSync(BOARDS_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(BOARDS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[Storage] Error reading boards file:', error);
    return [];
  }
};

const writeBoards = (boards) => {
  ensureDataDir();
  try {
    fs.writeFileSync(BOARDS_FILE, JSON.stringify(boards, null, 2), 'utf8');
  } catch (error) {
    console.error('[Storage] Error writing boards file:', error);
    throw error;
  }
};

class LocalBoard {
  constructor(data) {
    this._id = data._id || uuidv4();
    this.name = data.name || 'Untitled Board';
    this.ownerId = data.ownerId;
    this.collaborators = data.collaborators || [];
    this.layers = data.layers || [{ name: 'Layer 1', visible: true, locked: false, order: 0, elements: [] }];
    this.width = data.width || 3000;
    this.height = data.height || 2000;
    this.backgroundColor = data.backgroundColor || '#ffffff';
    this.idempotencyKey = data.idempotencyKey || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  toObject() {
    return {
      _id: this._id,
      name: this.name,
      ownerId: this.ownerId,
      collaborators: this.collaborators,
      layers: this.layers,
      width: this.width,
      height: this.height,
      backgroundColor: this.backgroundColor,
      idempotencyKey: this.idempotencyKey,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  async save() {
    this.updatedAt = new Date().toISOString();
    const boards = readBoards();
    const existingIndex = boards.findIndex((b) => b._id === this._id);

    if (existingIndex >= 0) {
      boards[existingIndex] = this.toObject();
    } else {
      boards.unshift(this.toObject());
    }

    writeBoards(boards);
    console.log(`[Storage] Saved board: ${this._id}, name: ${this.name}`);
    return this.toObject();
  }

  static find(query = {}) {
    const boards = readBoards();
    let result = [...boards];

    if (query.$or) {
      result = result.filter((board) => {
        return query.$or.some((condition) => {
          if (condition.ownerId !== undefined) {
            return board.ownerId === condition.ownerId;
          }
          if (condition.collaborators !== undefined) {
            return board.collaborators && board.collaborators.includes(condition.collaborators);
          }
          return true;
        });
      });
    } else if (query.ownerId !== undefined) {
      result = result.filter((b) => b.ownerId === query.ownerId);
    } else if (query._id !== undefined) {
      result = result.filter((b) => b._id === query._id);
    }

    result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return {
      sort: () => ({
        exec: async () => result,
        then: (resolve) => Promise.resolve(result).then(resolve),
      }),
      exec: async () => result,
      then: (resolve) => Promise.resolve(result).then(resolve),
    };
  }

  static async findById(id) {
    const boards = readBoards();
    const board = boards.find((b) => b._id === id);
    return board || null;
  }

  static async findByIdempotencyKey(key) {
    if (!key) return null;
    const boards = readBoards();
    return boards.find((b) => b.idempotencyKey && b.idempotencyKey === key) || null;
  }

  static async findByIdAndUpdate(id, updates, options = {}) {
    const boards = readBoards();
    const index = boards.findIndex((b) => b._id === id);

    if (index < 0) {
      return null;
    }

    boards[index] = {
      ...boards[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    writeBoards(boards);
    console.log(`[Storage] Updated board: ${id}`);
    return options.new ? boards[index] : null;
  }

  static async findByIdAndDelete(id) {
    const boards = readBoards();
    const index = boards.findIndex((b) => b._id === id);

    if (index < 0) {
      return null;
    }

    const deleted = boards[index];
    boards.splice(index, 1);
    writeBoards(boards);
    console.log(`[Storage] Deleted board: ${id}`);
    return deleted;
  }
}

const initStorage = () => {
  ensureDataDir();
  console.log(`[Storage] Initialized with data directory: ${DATA_DIR}`);
  const count = readBoards().length;
  console.log(`[Storage] Loaded ${count} boards from local storage`);
};

module.exports = {
  Board: LocalBoard,
  initStorage,
};
