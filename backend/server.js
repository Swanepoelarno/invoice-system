require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const db = new Database('invoices.db');
const SECRET_KEY = process.env.JWT_SECRET || 'invoice-system-secret-key';

app.use(cors());
app.use(express.json());

db.exec(`
  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quoteNumber TEXT,
    invoiceNumber TEXT,
    clientName TEXT NOT NULL,
    serviceDescription TEXT NOT NULL,
    amount REAL NOT NULL,
    quoteDate TEXT,
    status TEXT DEFAULT 'Draft',
    createdAt TEXT DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    dueDate TEXT,
    startTime TEXT,
    endTime TEXT,
    priority TEXT DEFAULT 'Medium',
    category TEXT,
    tags TEXT,
    recurrence TEXT DEFAULT 'none',
    attachments TEXT,
    reminderAt TEXT,
    status TEXT DEFAULT 'Pending',
    createdAt TEXT DEFAULT (datetime('now')),
    completedAt TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    taskId INTEGER NOT NULL,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  )
`);

const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!existingUser) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', hashedPassword);
  console.log('Default user created: admin / admin123');
}

function generateNumber(prefix, date) {
  const d = new Date(date);
  const datePart = d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 900000) + 100000);
  return `${prefix}-${datePart}-${random}`;
}

function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    const verified = jwt.verify(token, SECRET_KEY);
    req.user = verified;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/login', function(req, res) {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '8h' });
  res.json({ token });
});

// Simple personal-use tasks API
app.get('/tasks', authenticateToken, function(req, res) {
  const tasks = db
    .prepare('SELECT * FROM tasks ORDER BY dueDate IS NULL, dueDate ASC, createdAt DESC')
    .all();
  const subtasks = db.prepare('SELECT * FROM subtasks').all();
  res.json({ tasks, subtasks });
});

app.post('/tasks', authenticateToken, function(req, res) {
  const {
    title,
    description,
    dueDate,
    startTime,
    endTime,
    priority,
    category,
    tags,
    recurrence,
    attachments,
    reminderAt,
    subtasks
  } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const stmt = db.prepare(
    'INSERT INTO tasks (title, description, dueDate, startTime, endTime, priority, category, tags, recurrence, attachments, reminderAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const info = stmt.run(title, description || '', dueDate || null);
  const taskId = info.lastInsertRowid;

  if (Array.isArray(subtasks)) {
    const subStmt = db.prepare('INSERT INTO subtasks (taskId, title, completed) VALUES (?, ?, ?)');
    subtasks.forEach(function(st) {
      if (st && st.title) {
        subStmt.run(taskId, st.title, st.completed ? 1 : 0);
      }
    });
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  const createdSubtasks = db.prepare('SELECT * FROM subtasks WHERE taskId = ?').all(taskId);
  res.json({ task, subtasks: createdSubtasks });
});

app.patch('/tasks/:id', authenticateToken, function(req, res) {
  const {
    title,
    description,
    dueDate,
    startTime,
    endTime,
    priority,
    category,
    tags,
    recurrence,
    attachments,
    reminderAt,
    status,
    subtasks
  } = req.body;
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const updated = {
    title: title !== undefined ? title : existing.title,
    description: description !== undefined ? description : existing.description,
    dueDate: dueDate !== undefined ? dueDate : existing.dueDate,
    startTime: startTime !== undefined ? startTime : existing.startTime,
    endTime: endTime !== undefined ? endTime : existing.endTime,
    priority: priority !== undefined ? priority : existing.priority,
    category: category !== undefined ? category : existing.category,
    tags: tags !== undefined ? tags : existing.tags,
    recurrence: recurrence !== undefined ? recurrence : existing.recurrence,
    attachments: attachments !== undefined ? attachments : existing.attachments,
    reminderAt: reminderAt !== undefined ? reminderAt : existing.reminderAt,
    status: status !== undefined ? status : existing.status
  };
  const completedAt =
    updated.status === 'Completed' && !existing.completedAt
      ? new Date().toISOString()
      : updated.status !== 'Completed'
      ? null
      : existing.completedAt;

  db.prepare(
    'UPDATE tasks SET title = ?, description = ?, dueDate = ?, startTime = ?, endTime = ?, priority = ?, category = ?, tags = ?, recurrence = ?, attachments = ?, reminderAt = ?, status = ?, completedAt = ? WHERE id = ?'
  ).run(
    updated.title,
    updated.description,
    updated.dueDate,
    updated.startTime,
    updated.endTime,
    updated.priority,
    updated.category,
    updated.tags,
    updated.recurrence,
    updated.attachments,
    updated.reminderAt,
    updated.status,
    completedAt,
    req.params.id
  );

  if (Array.isArray(subtasks)) {
    const taskId = Number(req.params.id);
    db.prepare('DELETE FROM subtasks WHERE taskId = ?').run(taskId);
    const subStmt = db.prepare('INSERT INTO subtasks (taskId, title, completed) VALUES (?, ?, ?)');
    subtasks.forEach(function(st) {
      if (st && st.title) {
        subStmt.run(taskId, st.title, st.completed ? 1 : 0);
      }
    });
  }

  const saved = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  const savedSubtasks = db.prepare('SELECT * FROM subtasks WHERE taskId = ?').all(req.params.id);
  res.json({ task: saved, subtasks: savedSubtasks });
});

app.listen(3000, function() {
  console.log('Server running on http://localhost:3000');
});