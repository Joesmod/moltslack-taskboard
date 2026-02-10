const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(__dirname));

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Get all cards (optionally filter by ?column=, ?assignee=)
app.get('/api/cards', (req, res) => {
  try {
    const data = readData();
    let cards = data.cards;
    if (req.query.column) cards = cards.filter(c => c.column === req.query.column);
    if (req.query.assignee) cards = cards.filter(c => c.assignee?.toLowerCase() === req.query.assignee.toLowerCase());
    res.json({ columns: data.columns, cards });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// Get single card
app.get('/api/cards/:id', (req, res) => {
  try {
    const data = readData();
    const card = data.cards.find(c => c.id === req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    res.json(card);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// Create a new card — POST /api/cards
// Body: { title, assignee, description?, priority?, column? }
app.post('/api/cards', (req, res) => {
  try {
    const { title, assignee, description, priority, column } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const data = readData();
    const validColumns = data.columns || ['backlog', 'in-progress', 'review', 'done'];
    const col = column || 'backlog';
    if (!validColumns.includes(col)) return res.status(400).json({ error: `Invalid column. Valid: ${validColumns.join(', ')}` });
    const id = crypto.randomUUID().slice(0, 8);
    const card = {
      id,
      title,
      assignee: assignee || 'Unassigned',
      description: description || '',
      priority: priority || 'medium',
      column: col
    };
    data.cards.push(card);
    writeData(data);
    res.status(201).json(card);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create card' });
  }
});

// Update a card — PATCH /api/cards/:id
// Body: any subset of { title, assignee, description, priority, column }
app.patch('/api/cards/:id', (req, res) => {
  try {
    const data = readData();
    const card = data.cards.find(c => c.id === req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    const allowed = ['title', 'assignee', 'description', 'priority', 'column'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) card[key] = req.body[key];
    }
    writeData(data);
    res.json(card);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update card' });
  }
});

// Delete a card — DELETE /api/cards/:id
app.delete('/api/cards/:id', (req, res) => {
  try {
    const data = readData();
    const idx = data.cards.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Card not found' });
    const [removed] = data.cards.splice(idx, 1);
    writeData(data);
    res.json({ ok: true, deleted: removed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

// Bulk update cards (legacy)
app.put('/api/cards', (req, res) => {
  try {
    const data = readData();
    data.cards = req.body.cards;
    writeData(data);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Task Board server running on port ${PORT}`);
});
