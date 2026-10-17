import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'boostpay_db.json');

// Ensure data directory and initial database file exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const INITIAL_DB = {
  users: [
    {
      id: "849201",
      balance: 250.00,
      lifetimeProfit: 14.50,
      phrase: "alpha beacon crypto dynamic ember falcon galaxy harbor impact jupiter kinetic legacy",
      password: "user123",
      createdAt: Date.now() - 86400000,
      boostState: {
        isActive: false,
        isPaused: false,
        startedAt: 0,
        pausedAt: 0,
        elapsedMs: 0,
        targetDurationMs: 86400000,
        startingBalance: 250.00,
        accumulatedYield: 0
      }
    }
  ],
  transactions: [
    {
      id: "TX-99014120",
      userId: "849201",
      type: "REWARD",
      amount: 14.50,
      timestamp: Date.now() - 3600000,
      notes: "Compounding reward credited"
    }
  ],
  conversations: [],
  messages: [],
  config: {
    hourlyRatePercent: 1.0,
    minBoostMs: 60000,
    maxBoostMs: 86400000,
    dokploy: {
      host: "boostpay-eoqehk",
      port: 5432,
      database: "boostpaydb",
      user: "boostpaydbuser",
      externalIp: "72.60.42.18",
      dockerHostname: "boostpay-eoqehk",
      isConnected: true,
      lastPingMs: 42
    }
  }
};

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
      return INITIAL_DB;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading db file:', err);
    return INITIAL_DB;
  }
}

function writeDb(data: any) {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error writing db file:', err);
  }
}

// Initial bootstrap check
readDb();

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json({ limit: '10mb' }));

  // API endpoints
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  app.get('/api/db', (_req, res) => {
    const db = readDb();
    res.json(db);
  });

  app.post('/api/sync', (req, res) => {
    try {
      const incoming = req.body;
      const current = readDb();

      // Guard: do not wipe existing users if incoming is empty
      const usersToSave = Array.isArray(incoming.users) && incoming.users.length > 0
        ? incoming.users
        : current.users;

      const transactionsToSave = Array.isArray(incoming.transactions)
        ? incoming.transactions
        : current.transactions;

      const conversationsToSave = Array.isArray(incoming.conversations)
        ? incoming.conversations
        : current.conversations;

      const messagesToSave = Array.isArray(incoming.messages)
        ? incoming.messages
        : current.messages;

      const configToSave = incoming.config || current.config;

      const updatedDb = {
        users: usersToSave,
        transactions: transactionsToSave,
        conversations: conversationsToSave,
        messages: messagesToSave,
        config: configToSave
      };

      writeDb(updatedDb);
      res.json({ success: true, count: usersToSave.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Vite middleware in dev with HMR disabled to avoid WebSocket closed errors in AI Studio iframe
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa'
    });

    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const indexHtmlPath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(indexHtmlPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BoostPay Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start BoostPay server:', err);
});
