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

function generateNumber(prefix, date) {
  const d = new Date(date);
  const datePart = d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 900000) + 100000);
  return `${prefix}-${datePart}-${random}`;
}

app.get('/quotes', function(req, res) {
  const quotes = db.prepare('SELECT * FROM quotes').all();
  res.json(quotes);
});

app.post('/quotes', function(req, res) {
  const { clientName, serviceDescription, amount, quoteDate } = req.body;
  const quoteNumber = generateNumber('QT', quoteDate);
  const result = db.prepare(
    'INSERT INTO quotes (quoteNumber, clientName, serviceDescription, amount, quoteDate) VALUES (?, ?, ?, ?, ?)'
  ).run(quoteNumber, clientName, serviceDescription, amount, quoteDate);
  res.json({ id: result.lastInsertRowid, quoteNumber, clientName, serviceDescription, amount, quoteDate, status: 'Draft' });
});

app.patch('/quotes/:id', function(req, res) {
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