# Dokploy Nixpacks Node.js Version Fix Plan

Fix the Nixpacks build failure on Dokploy caused by Node.js 18 reaching End-Of-Life by introducing a `nixpacks.toml` configuration file specifying Node.js 20.x LTS.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Node.js Version**: Configured to use Node.js 20.x LTS via `nixpacks.toml`.
> - **Build Commands**: Standard `bun` and `vite` build pipeline preserved.

---

## 1. Overview & Core Concept

- **Problem**: Dokploy default Nixpacks builder attempted to use Node.js 18, which has reached End-Of-Life and has been removed from nixpkgs.
- **Solution**: Add a `nixpacks.toml` file at the root of the repository specifying `NODE_VERSION="20"`.

---

## 2. Technical Implementation

- Create `nixpacks.toml`:
  ```toml
  [phases.setup]
  nixPkgs = ["nodejs_20", "bun", "caddy"]
  ```
- Verify build with `compile_applet`.
