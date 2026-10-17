# Nixpacks Caddy Conflict Fix Plan

Remove Caddy from `nixpacks.toml` to prevent package file conflicts during Nixpacks build on Dokploy, allowing the application to run exclusively via the Node.js/Express server.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Caddy Removal**: Remove `caddy` from `nixPkgs` in `nixpacks.toml`.
> - **Server Execution**: The app runs fully via `server.ts` (Node.js + Express + Vite middleware / static).

---

## 1. Overview & Core Concept

- **Problem**: Nixpacks attempted to install Caddy alongside Node.js and Bun, causing a file path conflict (`caddy.service`).
- **Solution**: Update `nixpacks.toml` to contain only `nodejs_20` and `bun`.

---

## 2. Technical Implementation

- Update `nixpacks.toml`:
  ```toml
  [phases.setup]
  nixPkgs = ["nodejs_20", "bun"]
  ```
- Verify compilation with `compile_applet`.
