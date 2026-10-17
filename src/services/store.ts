import { User, Transaction, Conversation, Message, SystemConfig } from '../types';

const STORAGE_USERS = 'boostpay_users_v3';
const STORAGE_CURRENT_USER = 'boostpay_current_user_v3';
const STORAGE_TRANSACTIONS = 'boostpay_transactions_v3';
const STORAGE_CONVERSATIONS = 'boostpay_conversations_v3';
const STORAGE_MESSAGES = 'boostpay_messages_v3';
const STORAGE_CONFIG = 'boostpay_config_v3';

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

export function getDefaultConfig(): SystemConfig {
  return {
    hourlyRatePercent: 1.0,
    minBoostMs: 60 * 1000,
    maxBoostMs: 24 * 60 * 60 * 1000,
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

  // Initialize and synchronize with server database
  static async initSync(): Promise<void> {
    try {
      const res = await fetch('/api/db');
      if (res.ok) {
        const data = await res.json();
        if (data.users && Array.isArray(data.users) && data.users.length > 0) {
          localStorage.setItem(STORAGE_USERS, JSON.stringify(data.users));
        }
        if (data.transactions && Array.isArray(data.transactions)) {
          localStorage.setItem(STORAGE_TRANSACTIONS, JSON.stringify(data.transactions));
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
      }
    } catch {
      // Server offline fallback to local cache
    }
  }

  // Push local cache updates to persistent backend
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
      // Ignore background network error
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

  static getCurrentUser(): User | null {
    const raw = localStorage.getItem(STORAGE_CURRENT_USER);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const fresh = this.getUsers().find(u => u.id === parsed.id);
      return fresh || parsed;
    } catch {
      return null;
    }
  }

  static setCurrentUser(user: User | null): void {
    if (!user) {
      localStorage.removeItem(STORAGE_CURRENT_USER);
    } else {
      localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(user));
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
   * Highest balance in the system receives 24 hours (86,400,000 ms).
   * Lowest balance receives 1 minute (60,000 ms).
   */
  static calculateDynamicDuration(userBalance: number, users: User[]): number {
    const config = this.getConfig();
    const minMs = config.minBoostMs;
    const maxMs = config.maxBoostMs;

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
