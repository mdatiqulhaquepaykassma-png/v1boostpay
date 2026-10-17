# BoostPay Admin & PWA Installation Enhancement Plan

This plan details the implementation for a fully decoupled, standalone Admin Portal with independent server token authentication and action auditing, as well as a robust PWA installation flow with guided modal fallbacks.

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Decoupled Admin Portal**: Completely isolated from user sessions. Admin sessions persist independently on the backend and localStorage via dedicated tokens.
> - **Resilient PWA Installation**: Supports direct native browser prompts with an intelligent fallback guided modal for restricted environments or iOS devices.
> - **Server-Authoritative Audit Logging**: All administrative actions (user balance adjustment, tier overrides, broadcasting) are logged on the backend database (`db.json`).

- **Confirmed Decision 1**: Independent admin credentials and dedicated server tokens.
- **Confirmed Decision 2**: Direct browser prompt with guided install modal fallback.
- **Confirmed Decision 3**: Persistent JSON database with real-time admin action logs.

---

## 1. Overview & Core Concept

- **What It Does**: Provides an uncompromised administrative control center and bulletproof PWA installation capability for mobile and desktop users.
- **Key Value**: Ensures admin actions and reloads never interfere with regular user sessions, and guarantees 100% installability across all browsers.

---

## 2. User Experience & Visual Design

- **Aesthetic Direction**: Sleek fintech dark mode (zinc-950 background, amber accents, emerald success indicators).
- **Admin Flow**: Accessed via `/admin` hash/path. Independent login modal with secure credential verification against the backend. Dashboard tabs for Users, Financial Metrics, Live Boosters, Support Messenger, and Dokploy Engine Settings.
- **PWA Installation Flow**: One-click install button in Navbar and Bottom Nav. If the native prompt is unavailable or restricted in an iframe, a clean modal guide appears with step-by-step instructions.

---

## 3. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   Frontend Client                      │
│  (App.tsx / AdminPortal.tsx / usePWAInstall hook)      │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
        [REST /api/admin/*]      [PWA Manifest & SW]
                ▼                        ▼
┌────────────────────────────────────────────────────────┐
│                   Express Backend                      │
│              (server.ts & db.json storage)             │
└────────────────────────────────────────────────────────┘
```

- **Admin Session**: Stored in `localStorage` under `boostpay_admin_session_v4`. Validated against server token verification.
- **PWA Support**: Fully configured manifest, icons, service worker registration, and installation state tracking.
- **Action Auditing**: Server maintains `adminLogs` array in `db.json` recording every adjustment and settings change.
