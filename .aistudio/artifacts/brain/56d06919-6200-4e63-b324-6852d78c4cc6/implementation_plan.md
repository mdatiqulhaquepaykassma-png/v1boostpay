# BoostPay — Leaderboard Integration & 4-Tab Mobile Navigation

Implementation plan to re-introduce the real-time Leaderboard into BoostPay, integrated into a 4-tab mobile bottom navigation bar alongside Wallet, Install App, and Messenger.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The user confirmed the following specifications through Phase 1:
> - **Navigation Layout**: 4-tab mobile bottom bar featuring **Wallet**, **Leaderboard**, **Install App** (compact center-right), and **Messenger**.
> - **Rankings & Display**: Ranked dynamically by main balance; displays rank index, Numeric User ID (e.g., `#849201`), main balance with decimal precision, lifetime yield profit, and a direct **Chat** button to open a conversation thread.
> - **Peer Chat Flow**: Tapping the chat button on any user in the leaderboard initiates or opens the peer conversation thread in the Messenger tab.
> - **Mobile-Only Framing**: Sits inside the Android mobile app viewport (`max-w-[430px]`) with smooth scrolling and high-contrast typography.

---

## 1. Overview & Core Concept

- **What It Does**: Provides a real-time community ranking of verified BoostPay accounts based on their active USD balances. Users can view their relative ranking, inspect top earners' lifetime yield, and connect via direct peer messaging.
- **Target Persona**: Mobile fintech users who want transparency into system balances and easy peer-to-peer discovery for financial transfers and communication.
- **Key Value**: Healthy balance transparency, real-time dynamic rank updates, and seamless one-tap transition from community ranking into direct peer messaging.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Navigating to Leaderboard**:
   - The user taps the **Leaderboard** tab (`Trophy` icon) in the bottom navigation bar.
   - The app smoothly displays the mobile Leaderboard view showing the user's current rank card at the top ("Your Rank: #1") with balance and total profit.
2. **Browsing the Community**:
   - Scrollable list of registered community accounts sorted in descending order of main balance.
   - Top 3 ranks feature subtle typographic accents (Gold, Silver, Bronze badges) without tacky gradient pills.
   - Each card displays:
     - Rank position (`#1`, `#2`, `#3`, etc.)
     - Numeric User ID (`#849201`) with tap-to-copy
     - Active Balance with high-precision decimals (`$250.0000`)
     - Lifetime Compounding Profit (`+$14.5000`)
3. **One-Tap Peer Messaging**:
   - Each leaderboard row has a compact message button.
   - Tapping the button switches directly to the **Messenger** tab with an active conversation initialized for that specific peer ID.
   - Includes a quiet safety awareness banner reminding users not to share credentials or recovery phrases.

### Visual Identity & Theme
- **Color Discipline**: Dominant deep dark canvas (`#09090b`), structural card surfaces (`#18181b`), and clean warm amber accents (`#f59e0b`).
- **Typographic Precision**: Monospace tabular numerals (`tabular-nums font-mono`) for all financial amounts and numeric IDs.
- **Touch Ergonomics**: All row action buttons maintain a minimum interactive hitbox of $44 \times 44\text{px}$.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: 4-Tab Bottom Navigation**:
  - *Chosen Approach*: 4 balanced navigation slots across the bottom bar (`Wallet`, `Leaderboard`, `Install App`, `Messenger`).
  - *Why*: Accommodates both discovery (Leaderboard) and core utility (Wallet, Install, Messenger) without cluttering the screen or requiring hidden menus.
- **Decision 2: Direct Chat Transition**:
  - *Chosen Approach*: Direct one-tap conversation opener that transitions to the Messenger view and focuses the selected peer thread.
  - *Why*: Eliminates the friction of copying user IDs and manually typing them into the Messenger search box.
- **Decision 3: Zero Mock Data**:
  - *Chosen Approach*: Pulls directly from `BoostPayStore.getUsers()`, backed by the persistent server database (`data/boostpay_db.json`).
  - *Why*: Reflects real accounts and live balances across the full-stack database.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                 Mobile Android Shell (430px)                │
│                                                             │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────┐  │
│  │  Wallet View  │ │  Leaderboard  │ │  Messenger View   │  │
│  │ ───────────── │ │ ───────────── │ │ ───────────────── │  │
│  │ Balance & Dyn │ │ Balance Rank  │ │ Peer & Support    │  │
│  │ Yield Engine  │ │ 1-Tap Chat ───┼─► Conversation Chat │  │
│  └───────▲───────┘ └───────▲───────┘ └─────────▲─────────┘  │
│          │                 │                   │            │
│  ┌───────┴─────────────────┴───────────────────┴─────────┐  │
│  │     4-Tab Mobile Navigation: [W] [L] [Install] [M]    │  │
│  └─────────────────────────▲─────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│            BoostPayStore & Persistent File Database         │
│               (data/boostpay_db.json & REST API)            │
└─────────────────────────────────────────────────────────────┘
```

### Component & File Mapping
- `src/components/LeaderboardView.tsx`: Clean mobile Leaderboard component displaying user rank card, top rank rows, balance and profit metrics, and direct peer chat action.
- `src/App.tsx`:
  - Update `activeTab` union type: `'WALLET' | 'LEADERBOARD' | 'MESSENGER'`.
  - Update bottom navigation bar with 4 evenly spaced tabs: Wallet, Leaderboard, Install App, and Messenger.
  - Wire `handleOpenPeerChatFromLeaderboard(peerId: string)` to create/select the conversation and transition to `'MESSENGER'`.
- `prompt.md`: Append Prompt 29 documenting the Leaderboard re-integration.
