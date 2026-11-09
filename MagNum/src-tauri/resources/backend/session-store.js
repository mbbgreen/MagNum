'use strict';





const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const BASE_DIR = process.env.MAGNUM_DATA_DIR ||
  (process.env.APPDATA ? path.join(process.env.APPDATA, 'MagNum') : path.join(os.homedir(), '.magnum'));
const DB_FILE = path.join(BASE_DIR, 'magnum.db');
const LEGACY_DIR = path.join(BASE_DIR, 'sessions');
const MIGRATION_MARKER = path.join(BASE_DIR, '.json_migrated_to_sqlite');

let db = null;

function openDatabase(file) {
  try {
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(file);
  } catch (e1) {
    try {
      const BetterSqlite = require('better-sqlite3');
      return new BetterSqlite(file);
    } catch (e2) {
      throw new Error(
        'No SQLite driver available. Use Node >= 22.13 (built-in node:sqlite) or run: npm install better-sqlite3'
      );
    }
  }
}

function ensureSchema() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS sessions (
      id             TEXT PRIMARY KEY,
      title          TEXT NOT NULL DEFAULT 'New Mission',
      workspace_path TEXT NOT NULL DEFAULT '',
      deepseek_url   TEXT,
      provider       TEXT,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL,
      message_count  INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'agent',
      text       TEXT NOT NULL DEFAULT '',
      thought    TEXT,
      action     TEXT,
      skill      TEXT,
      edits      TEXT,
      files      TEXT,
      ts         INTEGER NOT NULL DEFAULT 0,
      timestamp  TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);
    CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
  `);

  // ── Migration: add provider column for existing DBs ──
  try {
    db.prepare('SELECT provider FROM sessions LIMIT 1').get();
  } catch {
    try { db.exec('ALTER TABLE sessions ADD COLUMN provider TEXT'); } catch {}
  }
}

function safeParse(json) {
  try { return JSON.parse(json); } catch { return undefined; }
}

function rowToMessage(r) {
  return {
    id: String(r.id),
    role: r.role,
    text: r.text || '',
    thought: r.thought || undefined,
    action: r.action || undefined,
    skill: r.skill || undefined,
    edits: r.edits ? safeParse(r.edits) : undefined,
    files: r.files ? safeParse(r.files) : undefined,
    isError: false,
    ts: r.ts,
    timestamp: r.timestamp || undefined
  };
}

function rowToSessionMeta(r) {
  return {
    id: r.id,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    messageCount: r.message_count,
    workspacePath: r.workspace_path || undefined,
    deepseekUrl: r.deepseek_url || undefined,
    provider: r.provider || undefined
  };
}


function migrateLegacyJsonIfNeeded() {
  if (fs.existsSync(MIGRATION_MARKER)) return;
  if (!fs.existsSync(LEGACY_DIR)) {
    fs.writeFileSync(MIGRATION_MARKER, new Date().toISOString());
    return;
  }
  const now = new Date().toISOString();
  try {
    const files = fs.readdirSync(LEGACY_DIR).filter(f => f.endsWith('.json') && f !== 'sessions_index.json');
    const insertSession = db.prepare(
      'INSERT OR IGNORE INTO sessions (id, title, workspace_path, deepseek_url, provider, created_at, updated_at, message_count) VALUES (?,?,?,?,?,?,?,?)'
    );
    const insertMsg = db.prepare(
      'INSERT INTO messages (session_id, role, text, thought, action, skill, edits, files, ts, timestamp) VALUES (?,?,?,?,?,?,?,?,?,?)'
    );
    db.exec('BEGIN');
    for (const f of files) {
      let sess = null;
      try { sess = JSON.parse(fs.readFileSync(path.join(LEGACY_DIR, f), 'utf-8')); } catch { continue; }
      if (!sess || !sess.id) continue;
      const msgs = Array.isArray(sess.messages) ? sess.messages : [];
      insertSession.run(
        sess.id,
        String(sess.title || 'New Mission').slice(0, 50),
        sess.workspacePath || '',
        sess.deepseekUrl || null,
        sess.provider || null,
        sess.createdAt || now,
        sess.updatedAt || now,
        msgs.length
      );
      for (const m of msgs) {
        insertMsg.run(
          sess.id,
          m.role || 'agent',
          typeof m.text === 'string' ? m.text : '',
          m.thought ?? null,
          m.action ?? null,
          m.skill ?? null,
          Array.isArray(m.edits) ? JSON.stringify(m.edits) : null,
          Array.isArray(m.files) ? JSON.stringify(m.files) : null,
          typeof m.ts === 'number' ? m.ts : Date.now(),
          m.timestamp ?? null
        );
      }
    }
    db.exec('COMMIT');
    fs.renameSync(LEGACY_DIR, path.join(BASE_DIR, 'sessions_json_backup'));
    console.log('[session-store] Legacy JSON sessions migrated to SQLite.');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch {}
    console.error('[session-store] JSON migration failed:', e.message);
  }
  fs.writeFileSync(MIGRATION_MARKER, new Date().toISOString());
}

class SessionStore {
  constructor() {
    this.ready = false;
  }

  ensure() {
    if (this.ready) return;
    fs.mkdirSync(BASE_DIR, { recursive: true });
    db = openDatabase(DB_FILE);
    ensureSchema();
    migrateLegacyJsonIfNeeded();
    this.ready = true;
  }

  
  getSessions() {
    this.ensure();
    return db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all().map(rowToSessionMeta);
  }

  purgeEmptySessions() {
    this.ensure();
    db.prepare(
      'DELETE FROM sessions WHERE id IN (SELECT s.id FROM sessions s LEFT JOIN messages m ON m.session_id = s.id WHERE m.id IS NULL)'
    ).run();
    return this.getSessions();
  }

  createSession(title = 'New Mission', extraMeta = {}) {
    this.ensure();
    const id = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();
    const cleanTitle = (title || 'New Mission').slice(0, 50);
    db.prepare(
      'INSERT INTO sessions (id, title, workspace_path, deepseek_url, provider, created_at, updated_at, message_count) VALUES (?,?,?,?,?,?,?,0)'
    ).run(id, cleanTitle, extraMeta.workspacePath || '', null, extraMeta.provider || null, now, now);
    return {
      id,
      title: cleanTitle,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      messages: [],
      compactSummary: '',
      ...extraMeta
    };
  }

  
  loadSession(sessionId, limit = null, offset = 0) {
    this.ensure();
    const meta = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    if (!meta) return null;
    const total = db.prepare('SELECT COUNT(*) AS c FROM messages WHERE session_id = ?').get(sessionId).c;
    if (limit && Number.isFinite(limit)) {
      const rows = db.prepare(
        'SELECT * FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ? OFFSET ?'
      ).all(sessionId, limit, offset);
      rows.reverse();
      return {
        ...rowToSessionMeta(meta),
        messages: rows.map(rowToMessage),
        hasMore: (offset + limit) < total,
        totalMessageCount: total
      };
    }
    const rows = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC').all(sessionId);
    return { ...rowToSessionMeta(meta), messages: rows.map(rowToMessage), hasMore: false, totalMessageCount: total };
  }

  
  appendMessage(sessionId, message) {
    this.ensure();
    const meta = db.prepare('SELECT id, message_count FROM sessions WHERE id = ?').get(sessionId);
    if (!meta) return null;
    const payload = { ...message };
    if (typeof payload.ts !== 'number') payload.ts = Date.now();
    if (typeof payload.text === 'string' && payload.text.length > 50000) {
      payload.text = payload.text.slice(0, 50000) + '\n... [truncated for storage]';
    }
    if (typeof payload.thought === 'string' && payload.thought.length > 10000) {
      payload.thought = payload.thought.slice(0, 10000) + '...';
    }
    if (Array.isArray(payload.edits)) {
      payload.edits = payload.edits.slice(0, 50).map(h => ({
        id: typeof h.id === 'number' ? h.id : h.id,
        file: h.file,
        added: typeof h.added === 'number' ? h.added : 0,
        deleted: typeof h.deleted === 'number' ? h.deleted : 0,
        status: h.status
      }));
    }
    const now = new Date().toISOString();
    const info = db.prepare(
      'INSERT INTO messages (session_id, role, text, thought, action, skill, edits, files, ts, timestamp) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(
      sessionId,
      payload.role || 'agent',
      typeof payload.text === 'string' ? payload.text : '',
      payload.thought ?? null,
      payload.action ?? null,
      payload.skill ?? null,
      Array.isArray(payload.edits) ? JSON.stringify(payload.edits) : null,
      Array.isArray(payload.files) ? JSON.stringify(payload.files) : null,
      payload.ts,
      payload.timestamp ?? null
    );
    const newTitle = (meta.message_count === 0 && payload.role === 'user')
      ? ((payload.text || '').slice(0, 40).replace(/\n/g, ' ') || 'Coding Task')
      : null;
    if (newTitle) {
      db.prepare('UPDATE sessions SET updated_at = ?, message_count = message_count + 1, title = ? WHERE id = ?')
        .run(now, newTitle, sessionId);
    } else {
      db.prepare('UPDATE sessions SET updated_at = ?, message_count = message_count + 1 WHERE id = ?')
        .run(now, sessionId);
    }
    return { ...payload, id: String(Number(info.lastInsertRowid)) };
  }

  deleteSession(sessionId) {
    this.ensure();
    db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
    const info = db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return Number(info.changes) > 0;
  }

  
  saveSession(session) {
    this.ensure();
    if (!session || !session.id) return null;
    db.prepare(
      'UPDATE sessions SET title = ?, updated_at = ?, message_count = ?, deepseek_url = ?, workspace_path = ?, provider = ? WHERE id = ?'
    ).run(
      session.title || 'New Mission',
      session.updatedAt || new Date().toISOString(),
      typeof session.messageCount === 'number' ? session.messageCount : 0,
      session.deepseekUrl ?? null,
      session.workspacePath ?? null,
      session.provider ?? null,
      session.id
    );
    return session;
  }
}

module.exports = new SessionStore();
