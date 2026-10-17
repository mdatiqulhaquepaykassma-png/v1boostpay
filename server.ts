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

// Helper to calculate dynamic duration
function calculateDynamicDuration(userBalance: number, users: any[], config: any): number {
  const minMs = config.minBoostMs || 60000;
  const maxMs = config.maxBoostMs || 86400000;

  if (users.length <= 1) {
    return userBalance >= 1000 ? maxMs : Math.max(minMs, Math.min(maxMs, (userBalance / 1000) * maxMs));
  }

  const balances = users.map(u => u.balance);
  const minBal = Math.min(...balances);
  const maxBal = Math.max(...balances);

  if (maxBal === minBal) {
    return userBalance > 0 ? (minMs + maxMs) / 2 : minMs;
  }

  const clamped = Math.max(minBal, Math.min(maxBal, userBalance));
  const ratio = (clamped - minBal) / (maxBal - minBal);
  return Math.round(minMs + ratio * (maxMs - minMs));
}

// Background server-side boosting ticker (runs every 1 second)
setInterval(() => {
  try {
    const db = readDb();
    let updated = false;
    const now = Date.now();
    const config = db.config || INITIAL_DB.config;
    const ratePerMs = (config.hourlyRatePercent / 100) / 3600000;

    for (const user of db.users) {
      if (user.boostState && user.boostState.isActive && !user.boostState.isPaused) {
        if (!user.boostState.startedAt) {
          user.boostState.startedAt = now - (user.boostState.elapsedMs || 0);
        }

        const elapsed = now - user.boostState.startedAt;
        const target = user.boostState.targetDurationMs || 86400000;

        if (elapsed >= target) {
          // Cycle completed on server!
          const finalYield = user.balance * (Math.pow(1 + ratePerMs, target) - 1);
          user.balance += finalYield;
          user.lifetimeProfit += finalYield;

          db.transactions.unshift({
            id: 'TX-' + Math.floor(10000000 + Math.random() * 90000000),
            userId: user.id,
            type: 'REWARD',
            amount: finalYield,
            timestamp: now,
            notes: 'Server background compounding reward completed'
          });

          user.boostState = {
            isActive: false,
            isPaused: false,
            startedAt: 0,
            pausedAt: 0,
            elapsedMs: 0,
            targetDurationMs: calculateDynamicDuration(user.balance, db.users, config),
            startingBalance: user.balance,
            accumulatedYield: 0
          };
          updated = true;
        } else {
          user.boostState.elapsedMs = elapsed;
          user.boostState.accumulatedYield = user.balance * (Math.pow(1 + ratePerMs, elapsed) - 1);
          updated = true;
        }
      }
    }

    if (updated) {
      writeDb(db);
    }
  } catch (err) {
    console.error('Background booster ticker error:', err);
  }
}, 1000);

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

  // Full-Stack Admin API endpoints
  app.post('/api/admin/adjust', (req, res) => {
    try {
      const { userId, type, amount, notes } = req.body;
      const db = readDb();
      const user = db.users.find((u: any) => u.id === userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      if (type === 'CREDIT') {
        user.balance += numAmount;
        db.transactions.unshift({
          id: 'TX-' + Math.floor(10000000 + Math.random() * 90000000),
          userId: user.id,
          type: 'ADMIN_CREDIT',
          amount: numAmount,
          timestamp: Date.now(),
          notes: notes || 'Admin Treasury Credit'
        });
      } else if (type === 'DEBIT') {
        user.balance = Math.max(0, user.balance - numAmount);
        db.transactions.unshift({
          id: 'TX-' + Math.floor(10000000 + Math.random() * 90000000),
          userId: user.id,
          type: 'ADMIN_DEBIT',
          amount: numAmount,
          timestamp: Date.now(),
          notes: notes || 'Admin Treasury Debit'
        });
      }

      writeDb(db);
      res.json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/status', (req, res) => {
    try {
      const { userId, action } = req.body; // action: 'BLOCK' | 'UNBLOCK' | 'LOCK' | 'UNLOCK'
      const db = readDb();
      const user = db.users.find((u: any) => u.id === userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (action === 'BLOCK') user.isBlocked = true;
      if (action === 'UNBLOCK') user.isBlocked = false;
      if (action === 'LOCK') user.isTempLocked = true;
      if (action === 'UNLOCK') user.isTempLocked = false;

      writeDb(db);
      res.json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/rate', (req, res) => {
    try {
      const { hourlyRatePercent } = req.body;
      const db = readDb();
      db.config.hourlyRatePercent = parseFloat(hourlyRatePercent);
      writeDb(db);
      res.json({ success: true, config: db.config });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
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
