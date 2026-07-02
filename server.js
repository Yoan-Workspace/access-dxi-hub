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


// Surveillance du fichier JSON partagé
fs.watch(DATA_PATH, () => {
  console.log("data.json modifié");

  notifyClients();
});

//
// API
//

app.get("/api/machines", (req, res) => {
  const data = JSON.parse(
    fs.readFileSync(DATA_PATH, "utf8")
  );

  res.json({
    machines: data.machines,
  });
});

app.put("/api/machines/:id", (req, res) => {
  const data = JSON.parse(
    fs.readFileSync(DATA_PATH, "utf8")
  );

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

  fs.writeFileSync(
    DATA_PATH,
    JSON.stringify(data, null, 2)
  );

  // 🔔 Notification aux clients connectés
  notifyClients();

  res.json(data.machines[index]);
});

app.post("/api/machines", (req, res) => {
  const data = JSON.parse(
    fs.readFileSync(DATA_PATH, "utf8")
  );

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

  fs.writeFileSync(
    DATA_PATH,
    JSON.stringify(data, null, 2)
  );

  notifyClients();

  res.status(201).json(newMachine);
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
});