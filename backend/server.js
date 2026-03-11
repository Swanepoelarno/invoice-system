const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
const db = new Database('invoices.db');

app.use(cors());
app.use(express.json());

db.exec(`
  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientName TEXT NOT NULL,
    serviceDescription TEXT NOT NULL,
    amount REAL NOT NULL,
    quoteDate TEXT,
    status TEXT DEFAULT 'Draft',
    createdAt TEXT DEFAULT (datetime('now'))
  )
`);

app.get('/quotes', function(req, res) {
  const quotes = db.prepare('SELECT * FROM quotes').all();
  res.json(quotes);
});

app.post('/quotes', function(req, res) {
  const { clientName, serviceDescription, amount, quoteDate } = req.body;
  const result = db.prepare(
    'INSERT INTO quotes (clientName, serviceDescription, amount, quoteDate) VALUES (?, ?, ?, ?)'
  ).run(clientName, serviceDescription, amount, quoteDate);
  res.json({ id: result.lastInsertRowid, clientName, serviceDescription, amount, quoteDate, status: 'Draft' });
});

app.patch('/quotes/:id', function(req, res) {
  const { status } = req.body;
  db.prepare('UPDATE quotes SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

app.listen(3000, function() {
  console.log('Server running on http://localhost:3000');
});