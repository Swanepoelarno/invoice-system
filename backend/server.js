require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const SECRET_KEY = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

// Create tables and default user
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quotes (
      id SERIAL PRIMARY KEY,
      "quoteNumber" TEXT,
      "invoiceNumber" TEXT,
      "clientName" TEXT NOT NULL,
      "serviceDescription" TEXT NOT NULL,
      amount REAL NOT NULL,
      "quoteDate" TEXT,
      status TEXT DEFAULT 'Draft',
      "createdAt" TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `);

  const existing = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
  if (existing.rows.length === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', ['admin', hashedPassword]);
    console.log('Default user created: admin / admin123');
  }

  console.log('Database ready');
}

initDB().catch(console.error);

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

// Login
app.post('/login', async function(req, res) {
  const { username, password } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '8h' });
  res.json({ token });
});

// GET all quotes
app.get('/quotes', authenticateToken, async function(req, res) {
  const result = await pool.query('SELECT * FROM quotes ORDER BY id ASC');
  res.json(result.rows);
});

// POST a new quote
app.post('/quotes', authenticateToken, async function(req, res) {
  const { clientName, serviceDescription, amount, quoteDate } = req.body;
  const quoteNumber = generateNumber('QT', quoteDate);
  const result = await pool.query(
    'INSERT INTO quotes ("quoteNumber", "clientName", "serviceDescription", amount, "quoteDate") VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [quoteNumber, clientName, serviceDescription, amount, quoteDate]
  );
  res.json(result.rows[0]);
});

// PATCH update quote status
app.patch('/quotes/:id', authenticateToken, async function(req, res) {
  const { status } = req.body;
  if (status === 'Invoiced') {
    const quote = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    const invoiceNumber = generateNumber('INV', quote.rows[0].quoteDate || new Date().toISOString());
    await pool.query('UPDATE quotes SET status = $1, "invoiceNumber" = $2 WHERE id = $3', [status, invoiceNumber, req.params.id]);
  } else {
    await pool.query('UPDATE quotes SET status = $1 WHERE id = $2', [status, req.params.id]);
  }
  res.json({ success: true });
});

app.listen(3000, function() {
  console.log('Server running on http://localhost:3000');
});