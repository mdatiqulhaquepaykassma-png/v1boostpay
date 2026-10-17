# BoostPay — Full-Stack Backend Boosting & Fixes Implementation Plan

Comprehensive implementation plan addressing all 10 user requirements for robust copy action, session persistence, PWA install/open states, full-stack admin backend, and server-side background compounding ticks for offline/logged out users.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Server-Side Background Boosting**: `server.ts` will run a periodic background loop (every 1 second) that checks all active user boosts, computes elapsed time from `startedAt`, accrues yield based on the community balance rank and admin compounding rate, and automatically commits completed cycles to main balance and ledger history.
> - **Session Persistence**: App auto-restores current user session on reload without logging out.
> - **Copy Reliability**: Robust clipboard helper supporting both `navigator.clipboard.writeText` and `document.execCommand('copy')` fallback.
> - **PWA Install / Open**: When installed, button shows "Open" and launches the app directly.
> - **Full-Stack Admin Backend**: Admin operations (credits, debits, user blocks, phrase inspection, rate configuration) are routed through dedicated Express API endpoints `/api/admin/...`.

---

## 1. Overview & Core Concept

- **Problem Addressed**:
  1. Copy buttons failing in some environments.
  2. Reloading the app logging the user out.
  3. PWA install button not handling installed state / "Open" correctly.
  4. Boosting stopping when offline or logged out.
  5. Admin portal relying on local state rather than full-stack server endpoints.
- **Solution**:
  - Implement a backend interval loop in `server.ts` that continuously processes active boosts in real time, even when users are offline or logged out.
  - Add robust clipboard fallback utilities.
  - Persist session cleanly.
  - Implement full backend API routes for admin actions.

---

## 2. Technical Architecture & Data Strategy

### Backend Background Ticker (`server.ts`)
- Every 1000ms, the server reads `boostpay_db.json`, iterates over all users with `boostState.isActive === true && !boostState.isPaused`, calculates elapsed time `Date.now() - startedAt`, computes accumulated yield, and checks if `elapsedMs >= targetDurationMs`.
- If completed, the reward is automatically added to `balance` and `lifetimeProfit`, a `REWARD` transaction is recorded, and `boostState` is reset.
- Updates are saved atomically to disk.

### Client-Server Synchronization
- `BoostPayStore` syncs automatically with `/api/db` on load and pushes changes via `/api/sync` or specific admin/action REST endpoints.
