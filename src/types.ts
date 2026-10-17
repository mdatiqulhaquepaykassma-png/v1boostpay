export interface User {
  id: string; // Pure numeric ID (e.g. "849201")
  balance: number; // Main balance in USD
  lifetimeProfit: number;
  phrase: string; // 12-word recovery mnemonic
  password?: string; // Account security password
  createdAt: number;
  isBlocked?: boolean;
  isTempLocked?: boolean;
  boostState: {
    isActive: boolean;
    isPaused: boolean;
    startedAt: number;
    pausedAt: number;
    elapsedMs: number;
    targetDurationMs: number; // Dynamic based on relative balance (1m - 24h)
    startingBalance: number;
    accumulatedYield: number; // Accrued reward
  };
}

export type TransactionType = 'REWARD' | 'TRANSFER_SENT' | 'TRANSFER_RECEIVED' | 'ADMIN_CREDIT' | 'ADMIN_DEBIT';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  timestamp: number;
  recipientId?: string;
  senderId?: string;
  notes?: string;
  conversationId?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string; // numeric ID or 'ADMIN_SUPPORT'
  senderRole: 'USER' | 'ADMIN';
  text: string;
  timestamp: number;
}

export interface Conversation {
  id: string; // Format: "CONV-XXXXXX"
  participants: string[]; // [userId1, userId2] or [userId, 'ADMIN_SUPPORT']
  lastMessage: string;
  lastMessageAt: number;
  hasUnread?: boolean;
}

export interface DokployConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  externalIp: string;
  dockerHostname: string;
  isConnected: boolean;
  lastPingMs: number;
}

export interface SystemConfig {
  hourlyRatePercent: number; // Default 1.000% per hour
  minBoostMs: number; // 60,000 ms (1 minute)
  maxBoostMs: number; // 86,400,000 ms (24 hours)
  dokploy: DokployConfig;
}
