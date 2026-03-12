require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
const db = new Database('invoices.db');
const SECRET_KEY = process.env.JWT_SECRET || 'invoice-system-secret-key';

app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.MAIL_PORT || 587),
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

function sendTaskEmail(to, task) {
  if (!to || !task) return Promise.reject(new Error('Missing to or task'));
  const subject = `Task: ${task.title || 'Untitled task'}`;
  const lines = [];
  lines.push(`Title: ${task.title || 'Untitled task'}`);
  if (task.description) lines.push(`Description: ${task.description}`);
  if (task.dueDate) lines.push(`Due date: ${task.dueDate}`);
  lines.push(`Status: ${task.status || 'Pending'}`);
  const text = lines.join('\n');
  return transporter.sendMail({
    from: `"Personal Dashboard" <${process.env.MAIL_USER}>`,
    to,
    subject,
    text
  });
}

async function fetchCurrentWeather(lat, lon) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENWEATHER_API_KEY is not set');
  }
  const url =
    'https://api.openweathermap.org/data/2.5/weather?lat=' +
    encodeURIComponent(lat) +
    '&lon=' +
    encodeURIComponent(lon) +
    '&units=metric&appid=' +
    encodeURIComponent(apiKey);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('OpenWeather error: ' + res.status);
  }
  return res.json();
}

async function fetchWeatherByCity(city) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENWEATHER_API_KEY is not set');
  }
  const url =
    'https://api.openweathermap.org/data/2.5/weather?q=' +
    encodeURIComponent(city) +
    '&units=metric&appid=' +
    encodeURIComponent(apiKey);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('OpenWeather error: ' + res.status);
  }
  return res.json();
}

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
    subtasks
  } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const stmt = db.prepare(
    'INSERT INTO tasks (title, description, dueDate) VALUES (?, ?, ?)'
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

app.delete('/tasks', authenticateToken, function(req, res) {
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM subtasks').run();
  res.json({ success: true });
});

app.post('/tasks/:id/email', authenticateToken, function(req, res) {
  const { to } = req.body;
  const targetEmail = to || process.env.NOTIFY_EMAIL || process.env.MAIL_USER;
  if (!targetEmail) {
    return res.status(400).json({ error: 'No destination email configured' });
  }
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  sendTaskEmail(targetEmail, task)
    .then(function() {
      res.json({ success: true });
    })
    .catch(function(err) {
      console.error('Email error', err.message || err);
      res.status(500).json({ error: 'Failed to send email' });
    });
});

app.get('/weather', authenticateToken, async function(req, res) {
  const { lat, lon, city } = req.query;
  try {
    let data;
    if (city) {
      data = await fetchWeatherByCity(city);
    } else if (lat && lon) {
      data = await fetchCurrentWeather(lat, lon);
    } else {
      return res.status(400).json({ error: 'city or lat/lon are required' });
    }

    res.json({
      name: data.name,
      temp: data.main && data.main.temp,
      description: data.weather && data.weather[0] && data.weather[0].description,
      icon: data.weather && data.weather[0] && data.weather[0].icon
    });
  } catch (err) {
    console.error('Weather error', err.message || err);
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
});

app.patch('/tasks/:id', authenticateToken, function(req, res) {
  const { status } = req.body;
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const nextStatus = status !== undefined ? status : existing.status;
  const completedAt =
    nextStatus === 'Completed' && !existing.completedAt
      ? new Date().toISOString()
      : nextStatus !== 'Completed'
      ? null
      : existing.completedAt;

  db.prepare('UPDATE tasks SET status = ?, completedAt = ? WHERE id = ?').run(
    nextStatus,
    completedAt,
    req.params.id
  );

  const saved = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  const savedSubtasks = db.prepare('SELECT * FROM subtasks WHERE taskId = ?').all(req.params.id);
  res.json({ task: saved, subtasks: savedSubtasks });
});

app.listen(3000, function() {
  console.log('Server running on http://localhost:3000');
});