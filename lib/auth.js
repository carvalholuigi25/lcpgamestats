import fs from 'fs';
import path from 'path';
// Try to use bcryptjs if available; otherwise fall back to Node crypto
let bcrypt;
try {
  // dynamic import for compatibility when module is installed
  // eslint-disable-next-line import/no-unresolved
  bcrypt = (await import('bcryptjs')).default;
} catch (e) {
  const crypto = await import('node:crypto');
  bcrypt = {
    hashSync: (pw) => crypto.createHash('sha256').update(pw).digest('hex'),
    compareSync: (pw, hash) => crypto.createHash('sha256').update(pw).digest('hex') === hash
  };
}

// Minimal JWT implementation fallback (HMAC-SHA256) to avoid external dependency
import { createHmac } from 'node:crypto';
function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateTokenPayload(payload, secret, expiresIn = '7d') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  let exp = now + 7 * 24 * 3600;
  // support simple '7d' format only
  if (typeof expiresIn === 'string' && expiresIn.endsWith('d')) {
    const days = Number(expiresIn.slice(0, -1)) || 7;
    exp = now + days * 24 * 3600;
  }
  const body = { ...payload, iat: now, exp };
  const toSign = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
  const sig = createHmac('sha256', secret).update(toSign).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${toSign}.${sig}`;
}

function verifyTokenPayload(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h64, p64, sig] = parts;
    const toSign = `${h64}.${p64}`;
    const expected = createHmac('sha256', secret).update(toSign).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (expected !== sig) return null;
    const payload = JSON.parse(Buffer.from(p64, 'base64').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

// Try to load jsonwebtoken if available
let jwt;
try {
  jwt = (await import('jsonwebtoken')).default;
} catch (e) {
  jwt = null;
}

const DB_FILE = path.join(process.cwd(), 'data', 'lcp.db');
const JSON_FILE = path.join(process.cwd(), 'data', 'users.json');
let db;
let useSqlite = false;

function ensureDataDir() {
  const dir = path.join(process.cwd(), 'data');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    // ignore
  }
}

async function init() {
  if (db) return db;
  ensureDataDir();

  // Try to use better-sqlite3 if available; otherwise fallback to JSON file store.
  try {
    const sqliteModule = await import('better-sqlite3');
    const Database = sqliteModule.default || sqliteModule;
    db = new Database(DB_FILE);
    try { db.pragma('journal_mode = WAL'); } catch (e) { /* ignore */ }

    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      displayName TEXT,
      email TEXT,
      avatar TEXT,
      createdAt INTEGER NOT NULL
    )`).run();

    useSqlite = true;
    return db;
  } catch (err) {
    // fallback to JSON file
    useSqlite = false;
    if (!fs.existsSync(JSON_FILE)) {
      fs.writeFileSync(JSON_FILE, JSON.stringify({ users: [], lastId: 0 }, null, 2));
    }
    return null;
  }
}

function createUser({ username, password, role = 'user', displayName = '', email = '', avatar = '' }) {
  init();
  const passwordHash = bcrypt.hashSync(password, 10);
  const now = Math.floor(Date.now() / 1000);
  if (useSqlite && db) {
    try {
      const info = db.prepare('INSERT INTO users (username, passwordHash, role, displayName, email, avatar, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)').run(username, passwordHash, role, displayName, email, avatar, now);
      return getUserById(info.lastInsertRowid);
    } catch (err) {
      if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        const e = new Error('User already exists');
        e.code = 'USER_EXISTS';
        throw e;
      }
      throw err;
    }
  }

  // JSON fallback
  const raw = fs.readFileSync(JSON_FILE, 'utf8');
  const store = JSON.parse(raw || '{"users":[],"lastId":0}');
  if (store.users.some((u) => u.username === username)) {
    const e = new Error('User already exists');
    e.code = 'USER_EXISTS';
    throw e;
  }
  const id = (store.lastId || 0) + 1;
  const user = { id, username, passwordHash, role, displayName, email, avatar, createdAt: now };
  store.users.push(user);
  store.lastId = id;
  fs.writeFileSync(JSON_FILE, JSON.stringify(store, null, 2));
  return { id, username, role, displayName, email, avatar, createdAt: now };
}

function getUserByUsername(username) {
  init();
  if (useSqlite && db) {
    const row = db.prepare('SELECT id, username, role, displayName, email, avatar, createdAt FROM users WHERE username = ?').get(username);
    return row || null;
  }
  const raw = fs.readFileSync(JSON_FILE, 'utf8');
  const store = JSON.parse(raw || '{"users":[],"lastId":0}');
  const row = store.users.find((u) => u.username === username);
  if (!row) return null;
  const { passwordHash, ...rest } = row; // omit hash
  return rest;
}

function getUserWithHashByUsername(username) {
  init();
  if (useSqlite && db) {
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    return row || null;
  }
  const raw = fs.readFileSync(JSON_FILE, 'utf8');
  const store = JSON.parse(raw || '{"users":[],"lastId":0}');
  const row = store.users.find((u) => u.username === username);
  return row || null;
}

function getUserById(id) {
  init();
  if (useSqlite && db) {
    const row = db.prepare('SELECT id, username, role, displayName, email, avatar, createdAt FROM users WHERE id = ?').get(id);
    return row || null;
  }
  const raw = fs.readFileSync(JSON_FILE, 'utf8');
  const store = JSON.parse(raw || '{"users":[],"lastId":0}');
  const row = store.users.find((u) => Number(u.id) === Number(id));
  if (!row) return null;
  const { passwordHash, ...rest } = row;
  return rest;
}

function verifyPassword(userRow, password) {
  if (!userRow) return false;
  return bcrypt.compareSync(password, userRow.passwordHash);
}

function generateToken(user) {
  const secret = process.env.JWT_SECRET || 'changemejwt';
  const payload = { id: user.id, username: user.username, role: user.role };
  if (jwt && typeof jwt.sign === 'function') {
    return jwt.sign(payload, secret, { expiresIn: '7d' });
  }
  return generateTokenPayload(payload, secret, '7d');
}

function verifyToken(token) {
  const secret = process.env.JWT_SECRET || 'changemejwt';
  if (jwt && typeof jwt.verify === 'function') {
    try {
      return jwt.verify(token, secret);
    } catch (err) {
      return null;
    }
  }
  return verifyTokenPayload(token, secret);
}

function updateUserProfile(id, { displayName, email, avatar, password }) {
  init();
  if (useSqlite && db) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return null;
    const newDisplay = displayName !== undefined ? displayName : user.displayName;
    const newEmail = email !== undefined ? email : user.email;
    const newAvatar = avatar !== undefined ? avatar : user.avatar;
    let passwordHash = user.passwordHash;
    if (password) {
      passwordHash = bcrypt.hashSync(password, 10);
    }
    db.prepare('UPDATE users SET displayName = ?, email = ?, avatar = ?, passwordHash = ? WHERE id = ?').run(newDisplay, newEmail, newAvatar, passwordHash, id);
    return getUserById(id);
  }

  const raw = fs.readFileSync(JSON_FILE, 'utf8');
  const store = JSON.parse(raw || '{"users":[],"lastId":0}');
  const idx = store.users.findIndex((u) => Number(u.id) === Number(id));
  if (idx === -1) return null;
  const user = store.users[idx];
  user.displayName = displayName !== undefined ? displayName : user.displayName;
  user.email = email !== undefined ? email : user.email;
  user.avatar = avatar !== undefined ? avatar : user.avatar;
  if (password) user.passwordHash = bcrypt.hashSync(password, 10);
  store.users[idx] = user;
  fs.writeFileSync(JSON_FILE, JSON.stringify(store, null, 2));
  const { passwordHash, ...rest } = user;
  return rest;
}

function listUsers() {
  init();
  if (useSqlite && db) {
    return db.prepare('SELECT id, username, role, displayName, email, avatar, createdAt FROM users ORDER BY id DESC').all();
  }
  const raw = fs.readFileSync(JSON_FILE, 'utf8');
  const store = JSON.parse(raw || '{"users":[],"lastId":0}');
  return store.users.map((u) => {
    const { passwordHash, ...rest } = u;
    return rest;
  }).reverse();
}

export default {
  init,
  createUser,
  getUserByUsername,
  getUserWithHashByUsername,
  verifyPassword,
  generateToken,
  verifyToken,
  getUserById,
  updateUserProfile,
  listUsers
};
