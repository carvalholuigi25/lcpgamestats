import fs from 'fs';
import path from 'path';

const FEEDBACK_FILE = path.join(process.cwd(), 'data', 'feedback.json');

function ensureDataDir() {
  const dir = path.join(process.cwd(), 'data');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    // ignore
  }
}

function readAll() {
  try {
    const raw = fs.readFileSync(FEEDBACK_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function save(entry) {
  ensureDataDir();
  const all = readAll();
  all.push(entry);
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(all, null, 2), 'utf8');
  return entry;
}

export default { save, readAll };
