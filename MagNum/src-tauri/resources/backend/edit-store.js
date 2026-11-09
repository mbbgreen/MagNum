'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const BASE_DIR = process.env.MAGNUM_DATA_DIR ||
  (process.env.APPDATA ? path.join(process.env.APPDATA, 'MagNum') : path.join(os.homedir(), '.magnum'));
const DB_FILE = path.join(BASE_DIR, 'edits.db');

const MAX_MATRIX_CELLS = 400000;
const MAX_STORED_DIFF_LINES = 400;

let db = null;
let memTable = null;
let memSeq = 1;

function openDb() {
  try {
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(DB_FILE);
  } catch {
    try {
      const Better = require('better-sqlite3');
      return new Better(DB_FILE);
    } catch {
      return null;
    }
  }
}

function ensure() {
  if (db || memTable) return;
  fs.mkdirSync(BASE_DIR, { recursive: true });
  db = openDb();
  if (db) {
    try { db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;'); } catch {}
    db.exec(`
      CREATE TABLE IF NOT EXISTS edits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        message_id INTEGER NOT NULL DEFAULT 0,
        file TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'applied',
        added INTEGER NOT NULL DEFAULT 0,
        deleted INTEGER NOT NULL DEFAULT 0,
        diff TEXT,
        truncated INTEGER NOT NULL DEFAULT 0,
        ts INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_edits_message ON edits(message_id);
      CREATE INDEX IF NOT EXISTS idx_edits_session ON edits(session_id, id);
    `);
  } else {
    memTable = new Map();
  }
}

function computeDiff(search, replace) {
  const a = String(search || '').split('\n');
  const b = String(replace || '').split('\n');
  const n = a.length, m = b.length;
  let lines;
  if ((n + 1) * (m + 1) > MAX_MATRIX_CELLS) {
    lines = [];
    for (const t of a) lines.push({ type: 'del', text: t });
    for (const t of b) lines.push({ type: 'add', text: t });
  } else {
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    lines = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { lines.push({ type: 'ctx', text: a[i] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { lines.push({ type: 'del', text: a[i] }); i++; }
      else { lines.push({ type: 'add', text: b[j] }); j++; }
    }
    while (i < n) lines.push({ type: 'del', text: a[i++] });
    while (j < m) lines.push({ type: 'add', text: b[j++] });
  }
  let truncated = 0;
  if (lines.length > MAX_STORED_DIFF_LINES) { lines = lines.slice(0, MAX_STORED_DIFF_LINES); truncated = 1; }
  let added = 0, deleted = 0;
  for (const l of lines) { if (l.type === 'add') added++; else if (l.type === 'del') deleted++; }
  return { lines, added, deleted, truncated };
}

class EditStore {
  addEdits(sessionId, messageId, edits, status = 'applied') {
    ensure();
    const summaries = [];
    for (const e of edits || []) {
      const d = computeDiff(e.search, e.replace);
      const diffJson = JSON.stringify(d.lines);
      let id;
      if (db) {
        const info = db.prepare(
          'INSERT INTO edits (session_id, message_id, file, status, added, deleted, diff, truncated, ts) VALUES (?,?,?,?,?,?,?,?,?)'
        ).run(sessionId || '', messageId || 0, e.file || '', status, d.added, d.deleted, diffJson, d.truncated, Date.now());
        id = Number(info.lastInsertRowid);
      } else {
        id = memSeq++;
        memTable.set(id, { id, session_id: sessionId || '', message_id: messageId || 0, file: e.file || '', status, added: d.added, deleted: d.deleted, diff: diffJson, truncated: d.truncated, ts: Date.now() });
      }
      summaries.push({ id, file: e.file || '', added: d.added, deleted: d.deleted, status });
    }
    return summaries;
  }

  linkMessage(ids = [], messageId) {
    ensure();
    for (const id of ids) {
      if (db) db.prepare('UPDATE edits SET message_id = ? WHERE id = ?').run(Number(messageId), Number(id));
      else if (memTable) { const r = memTable.get(Number(id)); if (r) r.message_id = Number(messageId); }
    }
  }

  _rowToDetail(r) {
    let diff = [];
    try { diff = JSON.parse(r.diff || '[]'); } catch {}
    return { id: Number(r.id), file: r.file, status: r.status, added: r.added, deleted: r.deleted, truncated: !!r.truncated, diff };
  }

  getDetails(ids = []) {
    ensure();
    const out = [];
    if (db) {
      for (const id of ids) {
        const r = db.prepare('SELECT * FROM edits WHERE id = ?').get(Number(id));
        if (r) out.push(this._rowToDetail(r));
      }
    } else if (memTable) {
      for (const id of ids) { const r = memTable.get(Number(id)); if (r) out.push(this._rowToDetail(r)); }
    }
    return out;
  }

  getDetailsByMessage(messageId) {
    ensure();
    if (db) return db.prepare('SELECT * FROM edits WHERE message_id = ? ORDER BY id').all(Number(messageId)).map(r => this._rowToDetail(r));
    if (memTable) return Array.from(memTable.values()).filter(r => r.message_id === Number(messageId)).map(r => this._rowToDetail(r));
    return [];
  }

  setStatus(ids = [], status = 'applied') {
    ensure();
    for (const id of ids) {
      if (db) db.prepare('UPDATE edits SET status = ? WHERE id = ?').run(status, Number(id));
      else if (memTable) { const r = memTable.get(Number(id)); if (r) r.status = status; }
    }
  }

  clearSession(sessionId) {
    ensure();
    if (db) db.prepare('DELETE FROM edits WHERE session_id = ?').run(sessionId);
    else if (memTable) for (const [k, r] of memTable) if (r.session_id === sessionId) memTable.delete(k);
  }
}
module.exports = new EditStore();
