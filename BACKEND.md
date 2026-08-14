# Backend Express attendu

Le frontend appelle un serveur Node.js / Express via la variable d'environnement
`VITE_API_URL` (sans slash final).

Exemple `.env.local` :

```
VITE_API_URL=http://localhost:3000
```

Sans cette variable, le frontend lit `public/machines.json` en lecture seule (mode démo).

Le serveur de référence est `server.js` à la racine (port **3000**, données dans `data/data.json`).

## Notifications Teams (nouveau ticket → canal)

Quand un ticket est ouvert, le serveur poste un message dans un **canal Teams**
via l’URL de webhook (`TEAMS_WEBHOOK_URL`). Gratuit, sans licence Premium.
La création du ticket n’échoue pas si Teams est indisponible.

1. Dans Teams, créer un canal (ex. **Tickets**).
2. Menu du canal (**…**) → **Workflows** → **Post to a channel when a webhook request is received**
   (en français : publier sur un canal lorsqu’une demande de webhook est reçue).
   Si **Connecteurs** / Incoming Webhook est encore disponible, ça marche aussi.
3. Copier l’URL dans `.env` à la racine du projet :

```
TEAMS_WEBHOOK_URL=https://...
APP_PUBLIC_URL=http://IP-DE-LA-BOX:3000
```

4. Redémarrer `node server.js`.

Les membres du canal reçoivent la notification (ordinateur et téléphone via l’app
Teams). Pour être sûr d’être alerté, activer les notifications du canal.

## Endpoints

### `GET /api/machines`

Réponse :

```json
{ "machines": [ /* Machine[] */ ] }
```

### `POST /api/machines`

Body : un objet `Machine` sans `id` (voir `src/lib/types.ts`).

Réponse : la `Machine` créée (status `201`). L'`id` est attribué automatiquement.

### `PUT /api/machines/:id`

Body : un objet `Machine` complet (voir `src/lib/types.ts`).

Réponse : la `Machine` mise à jour.

### `GET /api/events`

Flux SSE : notifie le frontend quand `data/data.json` est modifié.

## Exemple minimal de serveur Express

```js
import express from "express";
import cors from "cors";
import fs from "node:fs/promises";

const DB = "./machines-status.json";
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

async function read() {
  return JSON.parse(await fs.readFile(DB, "utf8"));
}
async function write(data) {
  await fs.writeFile(DB, JSON.stringify(data, null, 2));
}

app.get("/api/machines", async (_req, res) => {
  res.json(await read());
});

app.put("/api/machines/:id", async (req, res) => {
  const id = Number(req.params.id);
  const db = await read();
  const idx = db.machines.findIndex((m) => m.id === id);
  if (idx < 0) return res.status(404).json({ error: "not found" });
  db.machines[idx] = { ...req.body, id };
  await write(db);
  res.json(db.machines[idx]);
});

app.listen(3001, () => console.log("API on :3001"));
```
