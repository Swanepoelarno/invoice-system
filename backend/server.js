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

app.get('/quotes', authenticateToken, function(req, res) {
  const quotes = db.prepare('SELECT * FROM quotes').all();
  res.json(quotes);
});

app.post('/quotes', authenticateToken, function(req, res) {
  const { clientName, serviceDescription, amount, quoteDate } = req.body;
  const quoteNumber = generateNumber('QT', quoteDate);
  const result = db.prepare(
    'INSERT INTO quotes (quoteNumber, clientName, serviceDescription, amount, quoteDate) VALUES (?, ?, ?, ?, ?)'
  ).run(quoteNumber, clientName, serviceDescription, amount, quoteDate);
  res.json({ id: result.lastInsertRowid, quoteNumber, clientName, serviceDescription, amount, quoteDate, status: 'Draft' });
});

app.patch('/quotes/:id', authenticateToken, function(req, res) {
  const { status } = req.body;
  if (status === 'Invoiced') {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    const invoiceNumber = generateNumber('INV', quote.quoteDate || new Date().toISOString());
    db.prepare('UPDATE quotes SET status = ?, invoiceNumber = ? WHERE id = ?').run(status, invoiceNumber, req.params.id);
  } else {
    db.prepare('UPDATE quotes SET status = ? WHERE id = ?').run(status, req.params.id);
  }
  res.json({ success: true });
});

app.listen(3000, function() {
  console.log('Server running on http://localhost:3000');
});