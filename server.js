import express from "express";
import fs from "fs";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

const DATA_PATH = "./data/data.json";

const clients = [];

function readData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function isMpMachine(machine) {
  return !machine.name.toLowerCase().startsWith("access");
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function maybeResetMonthlyMaint() {
  const now = new Date();
  const today = todayKey(now);
  const thisMonth = monthKey(now);
  const data = readData();

  // Évite une double RAZ le même jour
  if (data.lastMonthlyMaintReset === today) {
    return { performed: false, reason: "already-reset-today" };
  }

  // Déjà fait ce mois-ci (le 1er ou en rattrapage les 3, 4, 5…)
  const lastReset = data.lastMonthlyMaintReset ?? "";
  if (lastReset.startsWith(thisMonth)) {
    return { performed: false, reason: "already-reset-this-month" };
  }

  let resetCount = 0;

  for (const machine of data.machines) {
    if (isMpMachine(machine) && machine.monthlyMaint === "done") {
      machine.monthlyMaint = "not_done";
      resetCount++;
    }
  }

  data.lastMonthlyMaintReset = today;
  writeData(data);

  if (resetCount > 0) {
    console.log(
      `Maintenance mensuelle MP réinitialisée (${resetCount} machine(s)) — ${today}`,
    );
    notifyClients();
  } else {
    console.log(
      `Reset mensuel enregistré — ${today} (aucune MP « faite » à réinitialiser)`,
    );
  }

  return { performed: true, resetCount, date: today };
}

function scheduleMonthlyMaintCheck() {
  setInterval(() => {
    maybeResetMonthlyMaint();
  }, 60 * 60 * 1000);
}

function notifyClients() {
  clients.forEach((client) => {
    client.write(
      `data: ${JSON.stringify({
        type: "machines-updated",
      })}\n\n`
    );
  });
}

app.get("/api/events", (req, res) => {
  console.log("Client SSE connecté");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  clients.push(res);

  req.on("close", () => {
    console.log("Client SSE déconnecté");

    const index = clients.indexOf(res);

    if (index !== -1) {
      clients.splice(index, 1);
    }
  });
});


function setupDataWatch() {
  const dataDir = path.dirname(DATA_PATH);
  const fileName = path.basename(DATA_PATH);

  const onChange = () => {
    console.log("data.json modifié");
    notifyClients();
  };

  const startPolling = () => {
    console.warn("Surveillance par polling (fs.watch indisponible sur ce système)");

    let lastMtime = 0;
    try {
      lastMtime = fs.statSync(DATA_PATH).mtimeMs;
    } catch {
      console.warn(`${DATA_PATH} introuvable — surveillance désactivée`);
      return;
    }

    setInterval(() => {
      try {
        const mtime = fs.statSync(DATA_PATH).mtimeMs;
        if (mtime !== lastMtime) {
          lastMtime = mtime;
          onChange();
        }
      } catch {
        /* fichier temporairement inaccessible */
      }
    }, 2000);
  };

  if (!fs.existsSync(DATA_PATH)) {
    console.warn(`${DATA_PATH} introuvable — surveillance désactivée`);
    return;
  }

  try {
    const watcher = fs.watch(dataDir, (event, name) => {
      if (!name || name === fileName) onChange();
    });

    watcher.on("error", (err) => {
      console.warn("fs.watch interrompu:", err.message);
      watcher.close();
      startPolling();
    });
  } catch (err) {
    console.warn("fs.watch indisponible:", err.message);
    startPolling();
  }
}

setupDataWatch();

//
// API
//

app.get("/api/machines", (req, res) => {
  maybeResetMonthlyMaint();

  const data = readData();

  res.json({
    machines: data.machines,
  });
});

app.put("/api/machines/:id", (req, res) => {
  const data = readData();

  const id = Number(req.params.id);

  const index = data.machines.findIndex(
    (m) => m.id === id
  );

  if (index === -1) {
    return res.status(404).json({
      error: "Machine introuvable",
    });
  }

  data.machines[index] = req.body;

  writeData(data);

  // 🔔 Notification aux clients connectés
  notifyClients();

  res.json(data.machines[index]);
});

app.post("/api/machines", (req, res) => {
  const data = readData();

  const maxId = data.machines.reduce(
    (max, machine) => Math.max(max, machine.id),
    0
  );

  const newMachine = {
    ...req.body,
    id: maxId + 1,
  };

  if (!newMachine.name?.trim()) {
    return res.status(400).json({
      error: "Le nom de la machine est requis",
    });
  }

  if (
    data.machines.some(
      (machine) =>
        machine.name.toLowerCase() === newMachine.name.trim().toLowerCase()
    )
  ) {
    return res.status(409).json({
      error: "Une machine avec ce nom existe déjà",
    });
  }

  data.machines.push(newMachine);

  writeData(data);

  notifyClients();

  res.status(201).json(newMachine);
});

app.delete("/api/machines/:id", (req, res) => {
  const data = readData();

  const id = Number(req.params.id);
  const index = data.machines.findIndex((m) => m.id === id);

  if (index === -1) {
    return res.status(404).json({
      error: "Machine introuvable",
    });
  }

  data.machines.splice(index, 1);

  writeData(data);

  notifyClients();

  res.json({ ok: true });
});

//
// Front React compilé
//

app.use(express.static(path.join(__dirname, "dist")));

app.get("/{*splat}", (req, res) => {
  res.sendFile(
    path.join(__dirname, "dist", "index.html")
  );
});

app.listen(3000, () => {
  console.log(
    "Serveur lancé sur http://localhost:3000"
  );

  const reset = maybeResetMonthlyMaint();
  if (reset.performed) {
    console.log(
      `Vérification maintenance mensuelle au démarrage: ${reset.resetCount} MP réinitialisée(s)`,
    );
  }

  scheduleMonthlyMaintCheck();
});