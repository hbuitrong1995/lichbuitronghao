import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
const IMAGES_FILE = path.join(DATA_DIR, "images.json");

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    // Initialize files if they don't exist
    try {
      await fs.access(TASKS_FILE);
    } catch {
      await fs.writeFile(TASKS_FILE, JSON.stringify([]));
    }
    try {
      await fs.access(IMAGES_FILE);
    } catch {
      await fs.writeFile(IMAGES_FILE, JSON.stringify({}));
    }
  } catch (err) {
    console.error("Error creating data directory", err);
  }
}

async function startServer() {
  await ensureDataDir();
  
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/tasks", async (req, res) => {
    try {
      const data = await fs.readFile(TASKS_FILE, "utf-8");
      res.json(JSON.parse(data));
    } catch (err) {
      res.status(500).json({ error: "Failed to read tasks" });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const tasks = req.body;
      await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save tasks" });
    }
  });

  app.get("/api/images", async (req, res) => {
    try {
      const data = await fs.readFile(IMAGES_FILE, "utf-8");
      res.json(JSON.parse(data));
    } catch (err) {
      res.status(500).json({ error: "Failed to read images" });
    }
  });

  app.post("/api/images", async (req, res) => {
    try {
      const images = req.body;
      await fs.writeFile(IMAGES_FILE, JSON.stringify(images, null, 2));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save images" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
