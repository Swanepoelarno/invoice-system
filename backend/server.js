const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
const db = new Database('invoices.db');

app.use(cors());
app.use(express.json());

// Create the quotes table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientName TEXT NOT NULL,
    serviceDescription TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'Draft',
    createdAt TEXT DEFAULT (datetime('now'))
  )
`);

// GET all quotes
app.get('/quotes', function(req, res) {
  const quotes = db.prepare('SELECT * FROM quotes').all();
  res.json(quotes);
});

// POST a new quote
app.post('/quotes', function(req, res) {
  const { clientName, serviceDescription, amount } = req.body;
  const result = db.prepare(
    'INSERT INTO quotes (clientName, serviceDescription, amount) VALUES (?, ?, ?)'
  ).run(clientName, serviceDescription, amount);
  res.json({ id: result.lastInsertRowid, clientName, serviceDescription, amount, status: 'Draft' });
});

// PATCH update quote status
app.patch('/quotes/:id', function(req, res) {
  const { status } = req.body;
  db.prepare('UPDATE quotes SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// Start the server
app.listen(3000, function() {
  console.log('Server running on http://localhost:3000');
});