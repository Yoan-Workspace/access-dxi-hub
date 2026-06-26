// Serveur Express pour la gestion des machines (MP / ACCESS)
// Lit et écrit dans ./data/data.json
//
// Endpoints attendus par le frontend (voir src/lib/api.ts) :
//   GET    /api/machines          -> { machines: Machine[] }
//   PUT    /api/machines/:id      -> Machine (body: Machine complet)
//
// Endpoints utilitaires :
//   GET    /api/health            -> { ok: true }
//   POST   /api/machines          -> crée une nouvelle machine
//   DELETE /api/machines/:id      -> supprime une machine
//
// Lancement : node server.js   (par défaut sur http://localhost:3001)

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_PATH = path.join(__dirname, 'data', 'data.json');

// --- Middlewares ---------------------------------------------------------
app.use(cors());                         // autorise le frontend Vite (port 8080)
app.use(express.json({ limit: '5mb' })); // body JSON volumineux OK
app.use(express.static('public'));

// --- Helpers -------------------------------------------------------------
function ensureDataFile() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ machines: [] }, null, 2));
  }
}

function readDB() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const db = JSON.parse(raw);
  if (!Array.isArray(db.machines)) db.machines = [];
  return db;
}

function writeDB(db) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2), 'utf8');
}

// --- Routes --------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Liste complète des machines
app.get('/api/machines', (_req, res) => {
  try {
    const db = readDB();
    res.json({ machines: db.machines });
  } catch (err) {
    console.error('GET /api/machines', err);
    res.status(500).json({ error: 'read_failed' });
  }
});

// Détail d'une machine
app.get('/api/machines/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const db = readDB();
    const m = db.machines.find((x) => x.id === id);
    if (!m) return res.status(404).json({ error: 'not_found' });
    res.json(m);
  } catch (err) {
    console.error('GET /api/machines/:id', err);
    res.status(500).json({ error: 'read_failed' });
  }
});

// Mise à jour complète d'une machine
app.put('/api/machines/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const db = readDB();
    const idx = db.machines.findIndex((x) => x.id === id);
    if (idx < 0) return res.status(404).json({ error: 'not_found' });
    db.machines[idx] = { ...req.body, id };
    writeDB(db);
    res.json(db.machines[idx]);
  } catch (err) {
    console.error('PUT /api/machines/:id', err);
    res.status(500).json({ error: 'write_failed' });
  }
});

// Création d'une nouvelle machine
app.post('/api/machines', (req, res) => {
  try {
    const db = readDB();
    const id = Date.now();
    const machine = { ...req.body, id };
    db.machines.push(machine);
    writeDB(db);
    res.status(201).json(machine);
  } catch (err) {
    console.error('POST /api/machines', err);
    res.status(500).json({ error: 'write_failed' });
  }
});

// Suppression d'une machine
app.delete('/api/machines/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const db = readDB();
    const before = db.machines.length;
    db.machines = db.machines.filter((x) => x.id !== id);
    if (db.machines.length === before) {
      return res.status(404).json({ error: 'not_found' });
    }
    writeDB(db);
    res.json({ ok: true, id });
  } catch (err) {
    console.error('DELETE /api/machines/:id', err);
    res.status(500).json({ error: 'write_failed' });
  }
});

// --- Démarrage -----------------------------------------------------------
app.listen(PORT, () => {
  console.log(`API machines en écoute sur http://localhost:${PORT}`);
  console.log(`Fichier de données : ${DATA_PATH}`);
});
