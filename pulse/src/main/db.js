const path = require('path');

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.warn('[db] better-sqlite3 not available, using in-memory stub:', e.message);
}

const DB_PATH = process.env.PULSE_DB_PATH || path.join(__dirname, '../../pulse.db');

let db;

// In-memory stub when SQLite is unavailable
const memStore = { profiles: {}, events: [], sessions: {}, settings: {} };
const stub = {
  pragma: () => {},
  exec: () => {},
  prepare: (sql) => ({
    run: (...args) => {
      const s = sql.trim().toUpperCase();
      if (s.startsWith('INSERT INTO PROFILES') || s.startsWith('INSERT INTO PROFILES'.slice(0,22))) {
        const obj = args[0] || {};
        if (obj.id) memStore.profiles[obj.id] = { ...obj };
      }
      if (s.startsWith('DELETE FROM PROFILES')) {
        const id = args[0];
        if (id) delete memStore.profiles[id];
      }
      if (s.startsWith('INSERT INTO SETTINGS') || s.startsWith('INSERT INTO SETTINGS'.slice(0,22))) {
        const [key, val] = args;
        if (key) memStore.settings[key] = val;
      }
    },
    all: (...args) => {
      const s = sql.trim().toUpperCase();
      if (s.includes('FROM PROFILES')) return Object.values(memStore.profiles);
      if (s.includes('FROM EVENTS')) return memStore.events;
      if (s.includes('FROM SESSIONS')) return Object.values(memStore.sessions);
      return [];
    },
    get: (...args) => {
      const s = sql.trim().toUpperCase();
      if (s.includes('FROM SETTINGS')) {
        const key = args[0];
        return memStore.settings[key] != null ? { value: memStore.settings[key] } : null;
      }
      return null;
    },
  }),
};

function init() {
  if (!Database) { db = stub; return stub; }
  try {
    db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      process     TEXT NOT NULL,
      hfThreshold REAL DEFAULT 0.65,
      priorityMap TEXT NOT NULL,
      enabledCats TEXT NOT NULL,
      patterns    TEXT NOT NULL,
      createdAt   INTEGER NOT NULL,
      updatedAt   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id          TEXT PRIMARY KEY,
      sessionId   TEXT NOT NULL,
      timestamp   INTEGER NOT NULL,
      category    TEXT NOT NULL,
      direction   TEXT NOT NULL,
      confidence  REAL NOT NULL,
      priority    INTEGER NOT NULL,
      transmitted INTEGER NOT NULL,
      latencyMs   REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id               TEXT PRIMARY KEY,
      profileId        TEXT NOT NULL,
      startedAt        INTEGER NOT NULL,
      endedAt          INTEGER,
      totalEvents      INTEGER DEFAULT 0,
      suppressedEvents INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
    return db;
  } catch (e) {
    console.warn('[db] SQLite unavailable, using in-memory stub:', e.message);
    db = stub;
    return stub;
  }
}

function getDb() {
  if (!db) init();
  return db;
}

// --- Profiles ---
function listProfiles() {
  return getDb().prepare('SELECT * FROM profiles').all();
}

function saveProfile(profile) {
  const now = Date.now();
  const stmt = getDb().prepare(`
    INSERT INTO profiles (id, name, process, hfThreshold, priorityMap, enabledCats, patterns, createdAt, updatedAt)
    VALUES (@id, @name, @process, @hfThreshold, @priorityMap, @enabledCats, @patterns, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, process=excluded.process, hfThreshold=excluded.hfThreshold,
      priorityMap=excluded.priorityMap, enabledCats=excluded.enabledCats,
      patterns=excluded.patterns, updatedAt=excluded.updatedAt
  `);
  stmt.run({
    ...profile,
    priorityMap: JSON.stringify(profile.priorityMap),
    enabledCats: JSON.stringify(profile.enabledCats),
    patterns: JSON.stringify(profile.patterns),
    createdAt: profile.createdAt || now,
    updatedAt: now,
  });
}

function deleteProfile(id) {
  getDb().prepare('DELETE FROM profiles WHERE id=?').run(id);
}

// --- Events ---
function insertEvent(event) {
  try {
    getDb().prepare(`
      INSERT INTO events (id, sessionId, timestamp, category, direction, confidence, priority, transmitted, latencyMs)
      VALUES (@id, @sessionId, @timestamp, @category, @direction, @confidence, @priority, @transmitted, @latencyMs)
    `).run(event);
  } catch (err) {
    console.error('[db] insertEvent error:', err.message);
  }
}

function queryEvents({ sessionId, filters = {} }) {
  try {
    let sql = 'SELECT * FROM events WHERE sessionId=?';
    const params = [sessionId];
    if (filters.category) { sql += ' AND category=?'; params.push(filters.category); }
    if (filters.direction) { sql += ' AND direction=?'; params.push(filters.direction); }
    if (filters.minConfidence != null) { sql += ' AND confidence>=?'; params.push(filters.minConfidence); }
    if (filters.transmittedOnly) { sql += ' AND transmitted=1'; }
    sql += ' ORDER BY timestamp DESC LIMIT 5000';
    return getDb().prepare(sql).all(...params);
  } catch (err) {
    console.error('[db] queryEvents error:', err.message);
    return [];
  }
}

// --- Sessions ---
function startSession(session) {
  try {
    getDb().prepare(`
      INSERT INTO sessions (id, profileId, startedAt) VALUES (@id, @profileId, @startedAt)
    `).run(session);
  } catch (err) {
    console.error('[db] startSession error:', err.message);
  }
}

function endSession(id) {
  try {
    getDb().prepare('UPDATE sessions SET endedAt=? WHERE id=?').run(Date.now(), id);
  } catch (err) {
    console.error('[db] endSession error:', err.message);
  }
}

function incrementSessionEvents(id, suppressed = false) {
  try {
    if (suppressed) {
      getDb().prepare('UPDATE sessions SET totalEvents=totalEvents+1, suppressedEvents=suppressedEvents+1 WHERE id=?').run(id);
    } else {
      getDb().prepare('UPDATE sessions SET totalEvents=totalEvents+1 WHERE id=?').run(id);
    }
  } catch (err) {
    console.error('[db] incrementSessionEvents error:', err.message);
  }
}

// --- Settings ---
function getSetting(key) {
  try {
    const row = getDb().prepare('SELECT value FROM settings WHERE key=?').get(key);
    return row ? row.value : null;
  } catch (err) {
    console.error('[db] getSetting error:', err.message);
    return null;
  }
}

function setSetting(key, value) {
  try {
    getDb().prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
  } catch (err) {
    console.error('[db] setSetting error:', err.message);
  }
}

function clearEvents() {
  try {
    getDb().prepare('DELETE FROM events').run();
  } catch (err) {
    console.error('[db] clearEvents error:', err.message);
  }
}

module.exports = {
  init, getDb,
  listProfiles, saveProfile, deleteProfile,
  insertEvent, queryEvents,
  startSession, endSession, incrementSessionEvents,
  getSetting, setSetting, clearEvents,
};
