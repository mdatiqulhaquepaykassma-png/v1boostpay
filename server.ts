import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'boostpay_db.json');

// Server startup version for update/deployment detection
const SERVER_BOOT_TIME = Date.now();
const SERVER_VERSION = `v1.2.${Math.floor(SERVER_BOOT_TIME / 1000)}`;

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
    minBoostMs: 60000, // 1 minute minimum
    maxBoostMs: 86400000, // 24 hours maximum
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
    const parsed = JSON.parse(raw);
    if (!parsed.users) parsed.users = INITIAL_DB.users;
    if (!parsed.transactions) parsed.transactions = INITIAL_DB.transactions;
    if (!parsed.conversations) parsed.conversations = [];
    if (!parsed.messages) parsed.messages = [];
    if (!parsed.config) parsed.config = INITIAL_DB.config;
    return parsed;
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

/**
 * Dynamic duration formula:
 * jar balance sobcheye besi tar 24 gonta (86,400,000 ms)
 * jar balance kom tar min 1 min (60,000 ms)
 */
function calculateDynamicDuration(userBalance: number, users: any[], config: any): number {
  const minMs = config?.minBoostMs || 60000; // 1 min
  const maxMs = config?.maxBoostMs || 86400000; // 24 hours

  const numBal = Number(userBalance) || 0;
  if (!users || users.length <= 1) {
    if (numBal <= 0) return minMs;
    if (numBal >= 1000) return maxMs;
    return Math.round(minMs + (numBal / 1000) * (maxMs - minMs));
  }

  const balances = users.map((u: any) => Number(u.balance) || 0);
  const minBal = Math.min(...balances);
  const maxBal = Math.max(...balances);

  if (maxBal === minBal) {
    return numBal > 0 ? maxMs : minMs;
  }

  const clamped = Math.max(minBal, Math.min(maxBal, numBal));
  const ratio = (clamped - minBal) / (maxBal - minBal);
  return Math.round(minMs + ratio * (maxMs - minMs));
}

// Background server-side boosting ticker (runs continuously every 1 second 24/7)
// Even if the user is offline, closes the app, or logs out, this ticker runs and credits rewards!
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
        const target = user.boostState.targetDurationMs || calculateDynamicDuration(user.balance, db.users, config);

        if (elapsed >= target) {
          // Cycle completed on server!
          const startingBal = Number(user.boostState.startingBalance ?? user.balance);
          const finalYield = startingBal * (Math.pow(1 + ratePerMs, target) - 1);
          
          user.balance = (Number(user.balance) || 0) + finalYield;
          user.lifetimeProfit = (Number(user.lifetimeProfit) || 0) + finalYield;

          const rewardTx = {
            id: 'TX-' + Math.floor(10000000 + Math.random() * 90000000),
            userId: user.id,
            type: 'REWARD',
            amount: finalYield,
            timestamp: now,
            notes: 'Server background compounding reward completed'
          };
          db.transactions.unshift(rewardTx);

          // Calculate new duration based on latest balance
          const nextDuration = calculateDynamicDuration(user.balance, db.users, config);

          user.boostState = {
            isActive: false,
            isPaused: false,
            startedAt: 0,
            pausedAt: 0,
            elapsedMs: 0,
            targetDurationMs: nextDuration,
            startingBalance: user.balance,
            accumulatedYield: 0,
            justCompletedReward: finalYield
          };
          updated = true;
        } else {
          user.boostState.elapsedMs = elapsed;
          const startingBal = Number(user.boostState.startingBalance ?? user.balance);
          user.boostState.accumulatedYield = startingBal * (Math.pow(1 + ratePerMs, elapsed) - 1);
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

  // 1. Version / Deployment Detection endpoint
  app.get('/api/version', (_req, res) => {
    res.json({
      version: SERVER_VERSION,
      bootTime: SERVER_BOOT_TIME,
      timestamp: Date.now()
    });
  });

  // 2. Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: SERVER_VERSION, timestamp: Date.now() });
  });

  // 3. Database snapshot
  app.get('/api/db', (_req, res) => {
    const db = readDb();
    res.json(db);
  });

  // 4. Single-user fetch endpoint (fast, keeps session synced without large payload)
  app.get('/api/users/:id', (req, res) => {
    const db = readDb();
    const user = db.users.find((u: any) => u.id === req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userTxs = db.transactions.filter((t: any) => t.userId === user.id);
    res.json({ user, transactions: userTxs });
  });

  // 5. User registration endpoint
  app.post('/api/users/register', (req, res) => {
    try {
      const { id, phrase, password } = req.body;
      const db = readDb();
      
      let userId = id;
      if (!userId) {
        userId = Math.floor(100000 + Math.random() * 900000).toString();
        while (db.users.some((u: any) => u.id === userId)) {
          userId = Math.floor(100000 + Math.random() * 900000).toString();
        }
      }

      const existing = db.users.find((u: any) => u.id === userId || (phrase && u.phrase === phrase.trim().toLowerCase()));
      if (existing) {
        return res.status(400).json({ error: 'User already exists' });
      }

      const initialDuration = calculateDynamicDuration(0, db.users, db.config);
      const newUser = {
        id: userId,
        balance: 0,
        lifetimeProfit: 0,
        phrase: (phrase || '').trim().toLowerCase(),
        password: (password || '').trim(),
        createdAt: Date.now(),
        boostState: {
          isActive: false,
          isPaused: false,
          startedAt: 0,
          pausedAt: 0,
          elapsedMs: 0,
          targetDurationMs: initialDuration,
          startingBalance: 0,
          accumulatedYield: 0
        }
      };

      db.users.push(newUser);
      writeDb(db);
      res.json({ success: true, user: newUser });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Direct Server-Side Boost Endpoints (authoritative state!)
  app.post('/api/boost/start', (req, res) => {
    try {
      const { userId } = req.body;
      const db = readDb();
      const user = db.users.find((u: any) => u.id === userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (Number(user.balance) <= 0) {
        return res.status(400).json({ error: 'Cannot boost with zero balance' });
      }

      const targetDuration = calculateDynamicDuration(user.balance, db.users, db.config);
      user.boostState = {
        isActive: true,
        isPaused: false,
        startedAt: Date.now(),
        pausedAt: 0,
        elapsedMs: 0,
        targetDurationMs: targetDuration,
        startingBalance: user.balance,
        accumulatedYield: 0
      };

      writeDb(db);
      res.json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/boost/pause', (req, res) => {
    try {
      const { userId } = req.body;
      const db = readDb();
      const user = db.users.find((u: any) => u.id === userId);
      if (!user || !user.boostState) {
        return res.status(404).json({ error: 'User not found' });
      }

      user.boostState.isPaused = true;
      user.boostState.pausedAt = Date.now();
      writeDb(db);
      res.json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/boost/resume', (req, res) => {
    try {
      const { userId } = req.body;
      const db = readDb();
      const user = db.users.find((u: any) => u.id === userId);
      if (!user || !user.boostState) {
        return res.status(404).json({ error: 'User not found' });
      }

      user.boostState.isPaused = false;
      user.boostState.startedAt = Date.now() - (user.boostState.elapsedMs || 0);
      user.boostState.pausedAt = 0;
      writeDb(db);
      res.json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/boost/status/:userId', (req, res) => {
    const db = readDb();
    const user = db.users.find((u: any) => u.id === req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      user,
      boostState: user.boostState,
      balance: user.balance,
      lifetimeProfit: user.lifetimeProfit
    });
  });

  // 7. General sync endpoint
  app.post('/api/sync', (req, res) => {
    try {
      const incoming = req.body;
      const current = readDb();

      // Merge users safely rather than blind overwrite
      let mergedUsers = [...current.users];
      if (Array.isArray(incoming.users)) {
        for (const incUser of incoming.users) {
          const idx = mergedUsers.findIndex(u => u.id === incUser.id);
          if (idx >= 0) {
            // Preserve active server boostState if running on server
            const serverBoost = mergedUsers[idx].boostState;
            mergedUsers[idx] = {
              ...incUser,
              boostState: (serverBoost && serverBoost.isActive) ? serverBoost : incUser.boostState,
              balance: Math.max(mergedUsers[idx].balance, incUser.balance)
            };
          } else {
            mergedUsers.push(incUser);
          }
        }
      }

      const transactionsToSave = Array.isArray(incoming.transactions) && incoming.transactions.length > 0
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
        users: mergedUsers,
        transactions: transactionsToSave,
        conversations: conversationsToSave,
        messages: messagesToSave,
        config: configToSave
      };

      writeDb(updatedDb);
      res.json({ success: true, count: mergedUsers.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Full-Stack Admin API endpoints (Completely decoupled from user sessions)
  app.post('/api/admin/login', (req, res) => {
    try {
      const { email, password } = req.body;
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanPass = (password || '').trim();

      if (cleanEmail === 'admin@gmail.com' && (cleanPass === '123456' || cleanPass === 'admin786')) {
        const token = 'admin_sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        return res.json({
          success: true,
          token,
          email: 'admin@gmail.com',
          role: 'SUPER_ADMIN',
          loginTime: Date.now()
        });
      }
      return res.status(401).json({ error: 'Invalid administrator credentials' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/stats', (_req, res) => {
    const db = readDb();
    const totalUsers = db.users.length;
    const totalLiquidity = db.users.reduce((acc: number, u: any) => acc + (Number(u.balance) || 0), 0);
    const totalProfitPaid = db.users.reduce((acc: number, u: any) => acc + (Number(u.lifetimeProfit) || 0), 0);
    const activeBoosters = db.users.filter((u: any) => u.boostState && u.boostState.isActive && !u.boostState.isPaused).length;
    const pausedBoosters = db.users.filter((u: any) => u.boostState && u.boostState.isActive && u.boostState.isPaused).length;
    const totalTransactions = db.transactions.length;

    res.json({
      totalUsers,
      totalLiquidity,
      totalProfitPaid,
      activeBoosters,
      pausedBoosters,
      totalTransactions,
      config: db.config,
      dokployStatus: {
        host: db.config?.dokploy?.host || 'boostpay-eoqehk',
        port: db.config?.dokploy?.port || 5432,
        database: db.config?.dokploy?.database || 'boostpaydb',
        isConnected: true,
        lastPingMs: 28
      }
    });
  });

  app.get('/api/admin/users', (_req, res) => {
    const db = readDb();
    res.json({ users: db.users, config: db.config });
  });

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
        user.balance = (Number(user.balance) || 0) + numAmount;
        db.transactions.unshift({
          id: 'TX-' + Math.floor(10000000 + Math.random() * 90000000),
          userId: user.id,
          type: 'ADMIN_CREDIT',
          amount: numAmount,
          timestamp: Date.now(),
          notes: notes || 'Admin Treasury Credit'
        });
      } else if (type === 'DEBIT') {
        user.balance = Math.max(0, (Number(user.balance) || 0) - numAmount);
        db.transactions.unshift({
          id: 'TX-' + Math.floor(10000000 + Math.random() * 90000000),
          userId: user.id,
          type: 'ADMIN_DEBIT',
          amount: numAmount,
          timestamp: Date.now(),
          notes: notes || 'Admin Treasury Debit'
        });
      }

      // Recalculate dynamic duration for user
      if (user.boostState && !user.boostState.isActive) {
        user.boostState.targetDurationMs = calculateDynamicDuration(user.balance, db.users, db.config);
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

  app.post('/api/admin/users/password', (req, res) => {
    try {
      const { userId, newPassword } = req.body;
      const db = readDb();
      const user = db.users.find((u: any) => u.id === userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      user.password = (newPassword || '').trim();
      writeDb(db);
      res.json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/users/delete', (req, res) => {
    try {
      const { userId } = req.body;
      const db = readDb();
      const idx = db.users.findIndex((u: any) => u.id === userId);
      if (idx < 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      db.users.splice(idx, 1);
      // Remove associated transactions
      db.transactions = db.transactions.filter((t: any) => t.userId !== userId);
      writeDb(db);
      res.json({ success: true, deletedUserId: userId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/users/boost-override', (req, res) => {
    try {
      const { userId, action } = req.body; // 'START' | 'PAUSE' | 'RESUME' | 'RESET'
      const db = readDb();
      const user = db.users.find((u: any) => u.id === userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const targetDuration = calculateDynamicDuration(user.balance, db.users, db.config);

      if (action === 'START') {
        user.boostState = {
          isActive: true,
          isPaused: false,
          startedAt: Date.now(),
          pausedAt: 0,
          elapsedMs: 0,
          targetDurationMs: targetDuration,
          startingBalance: user.balance,
          accumulatedYield: 0
        };
      } else if (action === 'PAUSE' && user.boostState) {
        user.boostState.isPaused = true;
        user.boostState.pausedAt = Date.now();
      } else if (action === 'RESUME' && user.boostState) {
        user.boostState.isPaused = false;
        user.boostState.startedAt = Date.now() - (user.boostState.elapsedMs || 0);
        user.boostState.pausedAt = 0;
      } else if (action === 'RESET') {
        user.boostState = {
          isActive: false,
          isPaused: false,
          startedAt: 0,
          pausedAt: 0,
          elapsedMs: 0,
          targetDurationMs: targetDuration,
          startingBalance: user.balance,
          accumulatedYield: 0
        };
      }

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
      const parsedRate = parseFloat(hourlyRatePercent);
      if (!isNaN(parsedRate) && parsedRate >= 0) {
        db.config.hourlyRatePercent = parsedRate;
        writeDb(db);
      }
      res.json({ success: true, config: db.config });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/config', (req, res) => {
    try {
      const incomingConfig = req.body;
      const db = readDb();
      db.config = {
        ...db.config,
        ...incomingConfig
      };
      writeDb(db);
      res.json({ success: true, config: db.config });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/backup', (_req, res) => {
    const db = readDb();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=boostpay_backup_${Date.now()}.json`);
    res.send(JSON.stringify(db, null, 2));
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
    console.log(`BoostPay Server listening on port ${PORT} [Version: ${SERVER_VERSION}]`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start BoostPay server:', err);
});
