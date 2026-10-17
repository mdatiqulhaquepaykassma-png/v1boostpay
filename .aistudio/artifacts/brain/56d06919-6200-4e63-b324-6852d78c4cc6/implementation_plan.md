# BoostPay — Server-Authoritative 24/7 Boosting, Session Persistence & Robust PWA Experience

Comprehensive plan to resolve session logout on refresh, fix cross-environment clipboard copying, implement gentle deployment reload notifications, enforce dynamic balance-based boosting, ensure one-click PWA installation with direct app launching, decouple the admin portal into a standalone full-stack backend service, and make boosting 100% server-authoritative and continuous even when offline or logged out.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were clarified and confirmed in Phase 1:
> - **Deployment & Update Alert**: Subtle bottom banner with a quick reload button (`window.location.reload()`) whenever a new deployment or update is detected.
> - **PWA Install & Launch**: One-click install triggering the browser's native installation prompt; transitions to "Open" with zero intermediary popups once installed.
> - **Server Boosting Synchronization**: Live continuous synchronization every second (`/api/user/:id` polling) with smooth local millisecond interpolation.

---

## 1. Overview & Core Concept

BoostPay is a modern, high-precision neobank application. This update ensures that:
1. **Never Log Out on Refresh**: User session is persisted in both local storage and server session endpoint (`/api/session` and `/api/user/:id`), so page reloads or app restarts keep the user securely logged in.
2. **Foolproof Clipboard Copy**: Dual-layer copy engine (modern asynchronous `navigator.clipboard` with instant DOM `textarea` fallback supporting iframes, Android WebViews, and iOS Safari) with immediate visual "Copied!" feedback.
3. **Gentle Update Notification**: When a new deployment occurs or a service worker update is detected, a clean, non-intrusive bottom banner gently invites the user to reload the app without interrupting ongoing workflows.
4. **Dynamic Duration Engine**: Boost cycle dynamically scales between 1 minute (for lowest community balance) and 24 hours (for highest community balance).
5. **Server-Authoritative 24/7 Compounding**: Compounding runs entirely on the Express backend (`server.ts`). If the user closes the app, logs out, reloads, or loses internet connectivity, the server continues compounding. Once the cycle finishes, the server commits the reward to the user's main balance and generates a ledger transaction.
6. **Standalone Full-Stack Admin Backend**: The admin portal at `/admin` is completely independent of standard user accounts, communicating via authenticated backend API routes (`/api/admin/*`) for balance adjustments, user management, and rate configuration.

---

## 2. User Experience & Visual Design

### Key User Flows
- **Reload & Resume**: User refreshes the browser or opens the PWA. The app immediately restores the authenticated user state from storage, fetches latest balance and boost progress from the backend server, and renders the Wallet without requiring login.
- **Background Boost & Reward Commit**: User taps "Start Boost". A POST request initializes the boost on the server. The user can close the app or log out. The server processes the boost. When the duration finishes, the server adds the reward to the user's balance. Upon reopening or logging back in, a celebration banner confirms the credited reward.
- **One-Click Install & Open**: User sees "Install" in the bottom navigation. Tapping it invokes the native browser install prompt. Once installed, the button automatically updates to "Open", launching the standalone window without popups.
- **Copying IDs & Passphrases**: Tapping copy buttons on Numeric IDs, seed phrases, or transaction IDs instantly copies the text using a foolproof mechanism and shows a green checkmark confirmation.
- **Update Banner**: When a new build or deploy is detected, a clean bottom toast appears: `"BoostPay updated. Tap to refresh."` with a quick `"Reload"` button.

### Visual Identity & Theme
- **Color Discipline**: 60% deep obsidian neutral canvas (`bg-zinc-950`), 30% structural surfaces (`bg-zinc-900/80`, hairline `border-zinc-800/80`), 10% high-intent gold/amber accents (`text-amber-400`, `bg-amber-500`).
- **Typography & Precision**: Clean neo-grotesque sans-serif with monospace tabular numerals (`font-mono tabular-nums`) displaying balance up to 6 decimal places ($250.000000).

---

## 3. Key Product Decisions & Trade-Offs

- **Server-Authoritative Compounding vs Client Timer**:
  - *Chosen*: Server-authoritative compounding in `server.ts` with 1-second ticker and timestamp differentials (`Date.now() - startedAt`).
  - *Why*: Guarantees boosting runs even if the user logs out, closes their phone, or disconnects. Client-side timers cannot run while the device is sleeping or disconnected.
- **Dual-Layer Clipboard Copy Helper**:
  - *Chosen*: `try { await navigator.clipboard.writeText(...) } catch { execCommand('copy') }` with an off-screen `<textarea>` element.
  - *Why*: Google AI Studio preview runs inside sandboxed iframes where direct `navigator.clipboard` access is often blocked by permissions policies. The fallback ensures 100% reliability across all browsers and iframes.
- **Session Restoration Hierarchy**:
  - *Chosen*: Store `boostpay_active_user_id` and full user cache in `localStorage`, plus server-side user lookup via `GET /api/user/:id`.
  - *Why*: Fast instant paint on reload followed by immediate server data reconciliation.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT (React SPA)                              │
│                                                                             │
│   Navbar (ID Copy)   ◄───►   WalletView (Live Reward Ticker)                │
│         │                               │                                   │
│   AuthGate (Phrases)         AdminPortal (/admin, Standalone)               │
│         │                               │                                   │
│   BottomNav [Wallet | Leaderboard | Install/Open | Messenger]               │
│         ▲                               ▲                                   │
│         └───────────────┬───────────────┘                                   │
│                         ▼                                                   │
│             BoostPayStore & Session Controller                              │
│         - Persists activeUserId across browser reloads                      │
│         - Robust copyToClipboard helper (clipboard + execCommand)           │
│         - 1-second continuous server poll (/api/user/:id)                   │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │ HTTP REST APIs
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FULL-STACK BACKEND (server.ts)                       │
│                                                                             │
│   GET  /api/user/:id       ── Return fresh balance & server boost progress  │
│   POST /api/boost/start    ── Authoritative start (sets startedAt, rate)    │
│   POST /api/boost/pause    ── Authoritative pause (freezes elapsedMs)       │
│   POST /api/boost/resume   ── Authoritative resume                          │
│   GET  /api/version        ── Deployment ID for update notification banner  │
│   POST /api/admin/*        ── Standalone admin actions & balance adjustment │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │               Server-Side Background Compounding Engine             │   │
│   │  Runs 24/7 every second: calculates elapsed time, updates yield,    │   │
│   │  and auto-commits reward to user balance upon cycle completion.     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│                     data/boostpay_db.json (Disk Storage)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component & Handler Action Plan

1. **`server.ts` Enhancements**:
   - Add `GET /api/version` returning server deployment timestamp.
   - Add `GET /api/user/:id` for instant single-user synchronization.
   - Add `POST /api/boost/start`, `POST /api/boost/pause`, `POST /api/boost/resume` endpoints to handle server-side boost state authoritatively.
   - Upgrade background interval (runs every 1000ms): commits rewards, creates `REWARD` transactions, and saves to `boostpay_db.json`.

2. **`src/services/store.ts` Enhancements**:
   - Fix `copyToClipboard`: Async `navigator.clipboard` with immediate `document.execCommand('copy')` fallback using an off-screen `<textarea>`.
   - Add robust session persistence storing both `boostpay_active_user_id` and cached profile so browser reloads never trigger logout.
   - Add API wrappers: `startServerBoost`, `pauseServerBoost`, `resumeServerBoost`, `fetchUserServerState`.

3. **`src/App.tsx` Enhancements**:
   - Maintain user session on reload; immediately re-authenticate using stored user ID and sync with server.
   - Add subtle bottom update notification banner polling `/api/version` (and listening to PWA service worker updates) with a one-tap reload action.
   - Update install button in bottom navigation: displays "Install" before installation; updates to "Open" after installation, navigating or focusing the standalone PWA cleanly without popups.

4. **`src/components/WalletView.tsx` Enhancements**:
   - Connect boost buttons directly to server boost endpoints (`/api/boost/start`, `/api/boost/pause`).
   - Poll server every 1000ms to synchronize live authoritative compounding yield and elapsed progress.
   - Calculate dynamic target duration based on community balance ranking (lowest = 1m, highest = 24h).
   - Show celebratory completion banner when a server boost finishes.

5. **`src/components/AdminPortal.tsx` Enhancements**:
   - Ensure the admin portal operates completely independently of any user identity.
   - Use direct backend API endpoints (`/api/admin/adjust`, `/api/admin/rate`, `/api/admin/user-status`) so all changes persist instantly to disk.
   - Implement copy buttons for user recovery phrases and security passwords with instant visual confirmation.

6. **Documentation & Verification**:
   - Update `prompt.md` with Prompt 33 capturing all directives.
   - Run `compile_applet` and `lint_applet` to verify clean compilation.
