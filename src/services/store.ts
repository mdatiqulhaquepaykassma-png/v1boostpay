import { User, Transaction, Conversation, Message, SystemConfig } from '../types';
import { copyToClipboard as clipboardHelper } from '../utils/clipboard';

const STORAGE_USERS = 'boostpay_users_v4';
const STORAGE_CURRENT_USER = 'boostpay_current_user_v4';
const STORAGE_CURRENT_USER_ID = 'boostpay_current_user_id_v4';
const STORAGE_TRANSACTIONS = 'boostpay_transactions_v4';
const STORAGE_CONVERSATIONS = 'boostpay_conversations_v4';
const STORAGE_MESSAGES = 'boostpay_messages_v4';
const STORAGE_CONFIG = 'boostpay_config_v4';

export const MNEMONIC_WORDS = [
  'alpha', 'beacon', 'crypto', 'dynamic', 'ember', 'falcon',
  'galaxy', 'harbor', 'impact', 'jupiter', 'kinetic', 'legacy',
  'matrix', 'nebula', 'orbit', 'plasma', 'quantum', 'ripple',
  'stellar', 'titan', 'uranus', 'vertex', 'zenith', 'vector'
];

export function generateMnemonic(): string {
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = Math.floor(Math.random() * MNEMONIC_WORDS.length);
    words.push(MNEMONIC_WORDS[idx]);
  }
  return words.join(' ');
}

export function generateNumericId(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Foolproof clipboard copy function supporting modern browsers,
 * iframes, mobile WebViews, and desktop.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  return clipboardHelper(text);
}

export function getDefaultConfig(): SystemConfig {
  return {
    hourlyRatePercent: 1.0,
    minBoostMs: 60 * 1000, // 1 minute
    maxBoostMs: 24 * 60 * 60 * 1000, // 24 hours
    dokploy: {
      host: 'boostpay-eoqehk',
      port: 5432,
      database: 'boostpaydb',
      user: 'boostpaydbuser',
      externalIp: '72.60.42.18',
      dockerHostname: 'boostpay-eoqehk',
      isConnected: true,
      lastPingMs: 42
    }
  };
}

export class BoostPayStore {
  private static isSyncing = false;

  /**
   * Initialize and smart-merge with server database
   * Never overwrites or logs out the local user!
   */
  static async initSync(): Promise<void> {
    try {
      const res = await fetch('/api/db');
      if (res.ok) {
        const data = await res.json();
        
        // Smart merge users
        if (data.users && Array.isArray(data.users)) {
          const localUsers = this.getUsers();
          const merged = [...data.users];

          // Preserve any local user not yet on backend
          for (const localU of localUsers) {
            const exists = merged.some(u => u.id === localU.id);
            if (!exists) {
              merged.push(localU);
            }
          }
          localStorage.setItem(STORAGE_USERS, JSON.stringify(merged));
        }

        // Smart merge transactions
        if (data.transactions && Array.isArray(data.transactions)) {
          const localTxs = this.getTransactions();
          const mergedTxs = [...data.transactions];
          for (const ltx of localTxs) {
            if (!mergedTxs.some(t => t.id === ltx.id)) {
              mergedTxs.push(ltx);
            }
          }
          localStorage.setItem(STORAGE_TRANSACTIONS, JSON.stringify(mergedTxs));
        }

        if (data.conversations && Array.isArray(data.conversations)) {
          localStorage.setItem(STORAGE_CONVERSATIONS, JSON.stringify(data.conversations));
        }

        if (data.messages && Array.isArray(data.messages)) {
          localStorage.setItem(STORAGE_MESSAGES, JSON.stringify(data.messages));
        }

        if (data.config) {
          localStorage.setItem(STORAGE_CONFIG, JSON.stringify(data.config));
        }

        // Refresh current user from server state
        const curId = localStorage.getItem(STORAGE_CURRENT_USER_ID);
        if (curId && data.users) {
          const freshUser = data.users.find((u: User) => u.id === curId);
          if (freshUser) {
            this.setCurrentUser(freshUser);
          }
        }
      }
    } catch {
      // Offline fallback: keep existing local cache
    }
  }

  /**
   * Push local state to persistent server database
   */
  static async pushToServer(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: this.getUsers(),
          transactions: this.getTransactions(),
          conversations: this.getConversations(),
          messages: this.getMessages(),
          config: this.getConfig()
        })
      });
    } catch {
      // Background retry on next tick
    } finally {
      this.isSyncing = false;
    }
  }

  static getUsers(): User[] {
    const raw = localStorage.getItem(STORAGE_USERS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveUsers(users: User[]): void {
    localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
    this.pushToServer();
  }

  /**
   * Synchronous, instant session retriever - NEVER resets on reload!
   */
  static getCurrentUser(): User | null {
    const raw = localStorage.getItem(STORAGE_CURRENT_USER);
    if (!raw) return null;
    try {
      const parsed: User = JSON.parse(raw);
      // Try to find freshest from local users list
      const users = this.getUsers();
      const fresh = users.find(u => u.id === parsed.id);
      return fresh || parsed;
    } catch {
      return null;
    }
  }

  /**
   * Sets current user session both by object and by ID
   */
  static setCurrentUser(user: User | null): void {
    if (!user) {
      localStorage.removeItem(STORAGE_CURRENT_USER);
      localStorage.removeItem(STORAGE_CURRENT_USER_ID);
    } else {
      localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_CURRENT_USER_ID, user.id);
    }
  }

  /**
   * Real-time server sync for a single user (keeps boost state and balance 100% accurate)
   */
  static async syncUserFromServer(userId: string): Promise<User | null> {
    try {
      const res = await fetch(`/api/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const freshUser: User = data.user;
          // Update in local users array
          const users = this.getUsers();
          const idx = users.findIndex(u => u.id === userId);
          if (idx >= 0) {
            users[idx] = freshUser;
          } else {
            users.push(freshUser);
          }
          localStorage.setItem(STORAGE_USERS, JSON.stringify(users));

          // If this is current user, update session
          const curId = localStorage.getItem(STORAGE_CURRENT_USER_ID);
          if (curId === userId) {
            this.setCurrentUser(freshUser);
          }

          // If transactions returned, update
          if (data.transactions && Array.isArray(data.transactions)) {
            const allTxs = this.getTransactions();
            for (const t of data.transactions) {
              if (!allTxs.some(existing => existing.id === t.id)) {
                allTxs.unshift(t);
              }
            }
            localStorage.setItem(STORAGE_TRANSACTIONS, JSON.stringify(allTxs));
          }

          return freshUser;
        }
      }
    } catch {
      // Return local cache on network error
    }
    return this.getCurrentUser();
  }

  /**
   * Start 24/7 background boost directly on the server
   */
  static async startServerBoost(userId: string): Promise<User | null> {
    try {
      const res = await fetch('/api/boost/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          this.saveSingleUser(data.user);
          return data.user;
        }
      }
    } catch (err) {
      console.warn('startServerBoost network error:', err);
    }

    // Local fallback
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user || user.balance <= 0) return null;

    const targetDuration = this.calculateDynamicDuration(user.balance, users);
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
    this.saveUsers(users);
    this.setCurrentUser(user);
    return user;
  }

  /**
   * Pause boost on the server
   */
  static async pauseServerBoost(userId: string): Promise<User | null> {
    try {
      const res = await fetch('/api/boost/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          this.saveSingleUser(data.user);
          return data.user;
        }
      }
    } catch (err) {
      console.warn('pauseServerBoost network error:', err);
    }

    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return null;
    user.boostState.isPaused = true;
    user.boostState.pausedAt = Date.now();
    this.saveUsers(users);
    this.setCurrentUser(user);
    return user;
  }

  /**
   * Resume boost on the server
   */
  static async resumeServerBoost(userId: string): Promise<User | null> {
    try {
      const res = await fetch('/api/boost/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          this.saveSingleUser(data.user);
          return data.user;
        }
      }
    } catch (err) {
      console.warn('resumeServerBoost network error:', err);
    }

    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return null;
    user.boostState.isPaused = false;
    user.boostState.startedAt = Date.now() - (user.boostState.elapsedMs || 0);
    this.saveUsers(users);
    this.setCurrentUser(user);
    return user;
  }

  private static saveSingleUser(user: User): void {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      users[idx] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
    const curId = localStorage.getItem(STORAGE_CURRENT_USER_ID);
    if (curId === user.id) {
      this.setCurrentUser(user);
    }
  }

  static getConfig(): SystemConfig {
    const raw = localStorage.getItem(STORAGE_CONFIG);
    if (!raw) return getDefaultConfig();
    try {
      return JSON.parse(raw);
    } catch {
      return getDefaultConfig();
    }
  }

  static saveConfig(config: SystemConfig): void {
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(config));
    this.pushToServer();
  }

  static getTransactions(): Transaction[] {
    const raw = localStorage.getItem(STORAGE_TRANSACTIONS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveTransactions(txs: Transaction[]): void {
    localStorage.setItem(STORAGE_TRANSACTIONS, JSON.stringify(txs));
    this.pushToServer();
  }

  static getConversations(): Conversation[] {
    const raw = localStorage.getItem(STORAGE_CONVERSATIONS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveConversations(convs: Conversation[]): void {
    localStorage.setItem(STORAGE_CONVERSATIONS, JSON.stringify(convs));
    this.pushToServer();
  }

  static getMessages(): Message[] {
    const raw = localStorage.getItem(STORAGE_MESSAGES);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveMessages(msgs: Message[]): void {
    localStorage.setItem(STORAGE_MESSAGES, JSON.stringify(msgs));
    this.pushToServer();
  }

  /**
   * Calculates the dynamic duration in milliseconds based on relative balance rank:
   * "jar balance sobcheye besi tar 24 gonta , jar balance kom tar min 1 min"
   * Highest balance in the system receives 24 hours (86,400,000 ms).
   * Lowest balance receives 1 minute (60,000 ms).
   */
  static calculateDynamicDuration(userBalance: number, users: User[]): number {
    const config = this.getConfig();
    const minMs = config.minBoostMs || 60000; // 1 minute
    const maxMs = config.maxBoostMs || 86400000; // 24 hours

    const numBal = Number(userBalance) || 0;

    if (!users || users.length <= 1) {
      if (numBal <= 0) return minMs;
      if (numBal >= 1000) return maxMs;
      return Math.round(minMs + (numBal / 1000) * (maxMs - minMs));
    }

    const balances = users.map(u => Number(u.balance) || 0);
    const minBal = Math.min(...balances);
    const maxBal = Math.max(...balances);

    if (maxBal === minBal) {
      return numBal > 0 ? maxMs : minMs;
    }

    const clamped = Math.max(minBal, Math.min(maxBal, numBal));
    const ratio = (clamped - minBal) / (maxBal - minBal);
    return Math.round(minMs + ratio * (maxMs - minMs));
  }

  /**
   * Create new user with 12-word mnemonic, numeric ID & password
   */
  static registerUser(mnemonic: string, password?: string): User {
    const users = this.getUsers();
    let numericId = generateNumericId();
    while (users.some(u => u.id === numericId)) {
      numericId = generateNumericId();
    }

    const initialDuration = this.calculateDynamicDuration(0, users);

    const newUser: User = {
      id: numericId,
      balance: 0,
      lifetimeProfit: 0,
      phrase: mnemonic.trim().toLowerCase(),
      password: password?.trim() || '',
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

    users.push(newUser);
    this.saveUsers(users);
    this.setCurrentUser(newUser);

    // Also register on server
    fetch('/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newUser.id,
        phrase: newUser.phrase,
        password: newUser.password
      })
    }).catch(() => {});

    return newUser;
  }

  /**
   * Login with 12-word mnemonic or numeric ID, and password verification
   */
  static loginUser(identifier: string, password?: string): { success: boolean; user?: User; error?: string } {
    const users = this.getUsers();
    const clean = identifier.trim().toLowerCase();
    const cleanPass = password?.trim() || '';

    // Check if matching phrase
    let user = users.find(u => u.phrase === clean);
    // Or check if matching numeric ID directly
    if (!user) {
      user = users.find(u => u.id === clean);
    }

    if (!user) {
      return { success: false, error: 'No account found with this phrase or ID.' };
    }

    // Verify password if user set a password
    if (user.password && user.password !== cleanPass) {
      return { success: false, error: 'Incorrect password for this account.' };
    }

    if (user.isBlocked) {
      return { success: false, error: 'This account has been suspended by system administrator.' };
    }

    if (user.isTempLocked) {
      return { success: false, error: 'Account is temporarily locked. Contact support.' };
    }

    this.setCurrentUser(user);
    // Trigger background sync to ensure latest server state
    this.syncUserFromServer(user.id);
    return { success: true, user };
  }

  /**
   * Add a transaction to history and update user balance
   */
  static addTransaction(tx: Omit<Transaction, 'id' | 'timestamp'>): Transaction {
    const transactions = this.getTransactions();
    const newTx: Transaction = {
      ...tx,
      id: 'TX-' + Math.floor(10000000 + Math.random() * 90000000),
      timestamp: Date.now()
    };
    transactions.unshift(newTx);
    this.saveTransactions(transactions);
    return newTx;
  }
}
