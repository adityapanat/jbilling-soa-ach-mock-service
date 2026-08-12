# Deployment Guide — SnapPay ACH Return Mock

**Audience:** Sysadmin / infrastructure team  
**Target host:** **soa-qa-infra server**  
**Environment:** Internal QA only — not for production

---

## Goal (for sysadmin team)

We need a small **Node.js mock service** running on the **soa-qa-infra server** so the QA team can test **jBilling SnapPay ACH reject/return** settlement without calling the real SnapPay gateway.

### What the service does

- Simulates SnapPay `POST /api/interop/GetTransaction`
- Returns a **Failed** ACH transaction response for transaction IDs that QA registers in advance
- Provides a web UI and REST API to register and manage those transaction IDs
- Does **not** validate HMAC or real SnapPay credentials (QA internal tool only)

### Why it must run on the soa-qa-infra server

jBilling runs on the **soa-qa-infra server**. When the **SnapPay ACH Settlement File Generator** job runs, the jBilling application (server-side) reads **Snap Pay Base Url** from SoA configuration and calls the mock over HTTP from **that same server**.

The mock must be **reachable from jBilling on the soa-qa-infra server** at the URL configured in SoA. The recommended deployment is **co-located on the soa-qa-infra server** (same host as jBilling).

### What this enables for QA

1. Register ACH transaction IDs in the mock (matching jBilling `payment_authorization.transaction_id`)
2. Run the ACH settlement job on the **soa-qa-infra server**
3. jBilling receives a mock “failed/returned” SnapPay response and processes the ACH reject flow
4. Cypress tests (run from developer machines against the **soa-qa-infra server**) can automate registration and settlement scenarios

---

## Architecture

```text
Developer laptop (Cypress)
  │
  ├─► jBilling UI on soa-qa-infra server     (trigger settlement, UI tests)
  │
  └─► http://snappay-ach-mock:8089/          (register txn in mock — use hostname, NOT localhost)

soa-qa-infra server
  │
  ├─► jBilling application
  │     └─► ACH settlement job
  │           └─► SoA Snap Pay Base Url → mock GetTransaction
  │
  └─► snappay-ach-mock (Node.js, port 8089)
        └─► data/transactions.json
```

### Two different callers (important)

| Caller | Runs on | URL used | Notes |
|--------|---------|----------|-------|
| **jBilling ACH settlement job** | soa-qa-infra server | SoA **Snap Pay Base Url** | Server-side HTTP from jBilling JVM |
| **QA / Cypress** (register txn) | Developer laptop | Mock URL in Cypress or browser | Browser runs locally — `localhost` means the **laptop**, not the soa-qa-infra server |

**SoA `localhost` is not the developer’s machine.** If SoA on the soa-qa-infra server is `http://localhost:8089/`, jBilling calls port 8089 **on the soa-qa-infra server**.

---

## Deployment requirements

| Item | Requirement |
|------|-------------|
| Host | **soa-qa-infra server** (same host as jBilling) |
| Runtime | Node.js **18+** |
| Package manager | npm |
| Port | **8089** (default; configurable via `PORT` env var) |
| Process manager | systemd, pm2, or equivalent — service must survive reboot |
| Persistence | `data/transactions.json` under the app directory |
| Network | jBilling on soa-qa-infra server must reach the mock on port 8089 |
| Optional | Internal DNS/hosts so QA workstations can reach the mock UI/API |

---

## Install steps (soa-qa-infra server)

```bash
# Example path — adjust per your standards
sudo mkdir -p /opt/qa/snappay-ach-mock
cd /opt/qa/snappay-ach-mock

# Deploy from git (preferred) or copy application files
# git clone <repo-url> . && cd snappay-ach-mock   # if in a monorepo subdirectory

npm install
npm start
```

### Verify on the soa-qa-infra server

```bash
curl -s http://localhost:8089/health
```

Expected: HTTP **200**

```bash
curl -s -X POST http://localhost:8089/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"transactionId":"test-txn-001","amount":10.00,"returnReasonCode":"R29"}'

curl -s -X POST http://localhost:8089/api/interop/GetTransaction \
  -H "Content-Type: application/json" \
  -d '{"transactionid":"test-txn-001"}'
```

Expected: GetTransaction returns `transactionstatus: Failed`

### Recommended: run as a managed service

Example expectations (implement per your standards):

- Start on boot
- Restart on failure
- Log stdout/stderr to your standard log location
- Run as a non-root service account

**Start command:** `npm start` (runs `node src/server.js`)

---

## URL configuration

The mock listens on port **8089** by default.

### Option A — localhost (minimal setup)

| Setting | Value |
|---------|--------|
| SoA on soa-qa-infra server | `http://localhost:8089/` |
| Works for jBilling | Yes (mock and jBilling on same host) |
| Works for Cypress on developer laptop | **No** — use Option B for browser/Cypress access |

Use `http://` with **two slashes**. A typo like `http:/localhost` breaks jBilling.

### Option B — hostname (recommended for QA + Cypress)

| Setting | Value |
|---------|--------|
| Internal DNS or hosts entry | `snappay-ach-mock` → IP of **soa-qa-infra server** |
| SoA on soa-qa-infra server | `http://snappay-ach-mock:8089/` **or** `http://localhost:8089/` (both work if mock is on same host) |
| Cypress / browser from developer laptop | `http://snappay-ach-mock:8089/` |
| Firewall | Allow port **8089** from QA workstation network to **soa-qa-infra server** |

On the **soa-qa-infra server**, `/etc/hosts` can include:

```text
127.0.0.1   snappay-ach-mock
```

For developer machines, point `snappay-ach-mock` to the **soa-qa-infra server** IP (internal DNS preferred).

### Option C — hostname on port 80 (optional)

If you prefer `http://snappay-ach-mock/` without a port:

- Configure a reverse proxy (nginx/Apache) on port **80** → `http://127.0.0.1:8089/`
- SoA: `http://snappay-ach-mock/`
- Cypress: `http://snappay-ach-mock/`

Without a proxy, `http://snappay-ach-mock/` implies port **80**, not **8089**.

---

## Sysadmin checklist

- [ ] Node.js 18+ installed on **soa-qa-infra server**
- [ ] Application deployed to agreed path (e.g. `/opt/qa/snappay-ach-mock`)
- [ ] `npm install` completed successfully
- [ ] Service running on port **8089** and enabled on boot
- [ ] `curl http://localhost:8089/health` returns 200 on **soa-qa-infra server**
- [ ] Port **8089** not blocked for local jBilling → mock traffic
- [ ] (Recommended) Internal DNS: `snappay-ach-mock` → **soa-qa-infra server**
- [ ] (Recommended) Firewall allows QA workstations → **soa-qa-infra server:8089**
- [ ] Document install path, service name, and restart procedure for QA team

---

## Security notes

- **No authentication** on this mock — QA internal use only
- Do not expose to the public internet
- Restrict port 8089 to internal QA network if exposed beyond localhost
- Dummy SnapPay credentials in jBilling SoA are sufficient; the mock does not validate HMAC

---

## What QA will configure after deployment

On the **soa-qa-infra server** jBilling SoA configuration:

| Config | Value |
|--------|--------|
| Snap Pay Base Url | `http://localhost:8089/` or `http://snappay-ach-mock:8089/` |
| Snap Pay Hmac Secret Key | Any valid Base64 string (e.g. `dGVzdA==`) |
| Other SnapPay fields | Dummy values acceptable |

**Restart jBilling** after changing Snap Pay Base Url (SnapPay client may be cached for several hours).

### QA workflow

1. Create or identify an ACH SnapPay payment on the **soa-qa-infra server** jBilling instance
2. Register the same `transaction_id` in the mock (UI or API)
3. Run **SnapPay ACH Settlement File Generator** on the **soa-qa-infra server**
4. Confirm settlement file / payment reject behavior

### Cypress (developer laptops)

- Target jBilling on the **soa-qa-infra server** (existing Cypress setup)
- Register mock transactions at `http://snappay-ach-mock:8089/` — **do not use `localhost:8089`** in Cypress when tests run locally
- Settlement still executes server-side on the **soa-qa-infra server** using SoA config

---

## Environment variables (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8089` | Listen port |
| `SNAPPAY_ACCOUNT_ID` | `1002424079` | Account ID in mock responses |
| `DATA_FILE` | `data/transactions.json` | Transaction registry file |

---

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Connection refused on soa-qa-infra server | Mock not running | Start/restart service; check port 8089 |
| jBilling GetTransaction not found | Txn not registered in mock | Register transaction ID in mock if you need a Failed ACH reject response |
| Cypress cannot open mock UI | Using `localhost:8089` from laptop | Use `http://snappay-ach-mock:8089/`; verify DNS and firewall |
| jBilling URL error | Malformed Base Url | Use `http://` with two slashes |
| `DateTimeParseException` in jBilling | Bad date format in mock | Date must be `M/d/yyyy hh:mm:ss a` with zero-padded hour |
| SoA change not picked up | Client cache | Restart jBilling on **soa-qa-infra server** |

---

## Deliverables requested from sysadmin team

Please confirm back to QA:

1. Install path on **soa-qa-infra server**
2. Service name and how to start / stop / restart
3. SoA URL to use: `http://localhost:8089/` and/or `http://snappay-ach-mock:8089/`
4. Whether `snappay-ach-mock` DNS is configured for QA workstations
5. Whether port 8089 is reachable from developer machines for Cypress

---

## Related documentation

- [README.md](./README.md) — application usage, API reference, web UI
