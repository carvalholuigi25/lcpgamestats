import fs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';

function ensureDataDir() {
  const dir = path.join(process.cwd(), 'data');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ignore */ }
}

function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex');
}

function readStore() {
  ensureDataDir();
  const file = path.join(process.cwd(), 'data', 'users.json');
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ users: [], lastId: 0 }, null, 2));
  const raw = fs.readFileSync(file, 'utf8') || '{"users":[],"lastId":0}';
  return { file, store: JSON.parse(raw) };
}

function writeStore(file, store) {
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
}

async function main() {
  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASS || 'changeme';
  const displayName = process.env.ADMIN_DISPLAY || 'Administrator';

  try {
    const { file, store } = readStore();
    const existing = store.users.find((u) => u.username === username);
    if (existing) {
      console.log('User exists:', existing.username, 'role:', existing.role);
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        writeStore(file, store);
        console.log('Elevated user to admin.');
      } else {
        console.log('User already has admin role.');
      }
      process.exit(0);
    }

    const id = (store.lastId || 0) + 1;
    const user = {
      id,
      username,
      passwordHash: hashPassword(password),
      role: 'admin',
      displayName,
      email: '',
      avatar: '',
      createdAt: Math.floor(Date.now() / 1000)
    };
    store.users.push(user);
    store.lastId = id;
    writeStore(file, store);
    console.log('Created admin user:', username);
    process.exit(0);
  } catch (err) {
    console.error('Failed to create admin user:', err.message || err);
    process.exit(1);
  }
}

main();
