# SnapPay ACH Return Mock

Mock service for testing jBilling's **SnapPay ACH reject** settlement flow. Simulates `POST /api/interop/GetTransaction` with no HMAC/auth validation.

---

## Quick start

```bash
cd snappay-ach-mock
npm install
npm start
```

- **UI:** http://localhost:8089/
- **Health:** `curl http://localhost:8089/health`

Stop: `Ctrl+C` or `lsof -i :8089 -t | xargs kill`

---

## Prerequisites

- Node.js 18+
- jBilling ACH SnapPay payment in DB with matching `payment_authorization.transaction_id`
- jBilling server must reach the mock host on port `8089` (or your `PORT`)

---

## Web UI

Register transactions at `http://<host>:8089/`

| Field | Required | Default |
|-------|----------|---------|
| Transaction ID | Yes | — |
| Amount | Yes | — |
| Return reason code | No | `R29` |
| Return reason description | No | empty `""` |
| Transaction date | No | current time (refreshed on page load) |

The table supports **search**, **sort**, **pagination** (25/page), row delete, and **Clear all** at the bottom.

All controls use `data-testid` for Cypress (e.g. `input-transaction-id`, `btn-register`, `btn-clear-all`).

---

## jBilling setup

Set in **SoA configuration**:

| Config | Value |
|--------|--------|
| Snap Pay Base Url | `http://<mock-host>:8089/` |
| Snap Pay Hmac Secret Key | any valid Base64 (e.g. `dGVzdA==`) |
| Other SnapPay creds | dummy values |

**Use `http://` (two slashes).** Restart jBilling after changing the URL (SnapPay client cached ~5h).

Then:

1. Register txn IDs in the mock (must match jBilling `transaction_id`)
2. Run **SnapPay ACH Settlement File Generator**

---

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/transactions` | Register txn |
| GET | `/api/transactions` | List all |
| DELETE | `/api/transactions/:id` | Remove one |
| DELETE | `/api/transactions/all` | Clear all |
| POST | `/api/interop/GetTransaction` | SnapPay response (what jBilling calls) |

**Register example:**

```bash
curl -X POST http://localhost:8089/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"transactionId":"202784935080","amount":85,"returnReasonCode":"R29"}'
```

**GetTransaction** (jBilling sends only `transactionid`):

```bash
curl -X POST http://localhost:8089/api/interop/GetTransaction \
  -H "Content-Type: application/json" \
  -d '{"transactionid":"202784935080"}'
```

| Register result | HTTP |
|-----------------|------|
| Success | 201 + `record` |
| Duplicate transaction ID | 409 + existing `record` (not updated) |
| Validation error | 400 |

| GetTransaction result | HTTP |
|-----------------------|------|
| Registered txn (ACH return mock) | 200 + `transactionstatus: Failed` |
| Unknown / unregistered txn | 200 + `transactionstatus: Success` (settlement job skips) |
| Missing txn id | 400 |

Data persists in `data/transactions.json`.

---

## Config (optional)

```bash
PORT=8090 SNAPPAY_ACCOUNT_ID=1002424079 npm start
```

| Variable | Default |
|----------|---------|
| `PORT` | `8089` |
| `SNAPPAY_ACCOUNT_ID` | `1002424079` |
| `DATA_FILE` | `data/transactions.json` |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Port in use | `lsof -i :8089 -t \| xargs kill` |
| `http:/localhost` error | Use `http://` (two slashes) in Base Url |
| jBilling can't reach mock | Use server IP, not `localhost`, if on different host |
| Settlement job errors on GetTransaction | Register return txn IDs in mock; unregistered txns return Success (not 404) |
| `DateTimeParseException` | Date must be `M/d/yyyy hh:mm:ss a` with zero-padded hour |

---

## Copying to another repo or folder

The mock is self-contained — no hardcoded paths to jBilling or a specific parent directory. You can drop it anywhere (e.g. `jbilling-soa-cypress-automation/snappay-ach-mock/`).

After copying:

1. Run `npm install` in the new location (don’t rely on a copied `node_modules`)
2. Run `npm start` from that folder
3. Point jBilling **Snap Pay Base Url** at `http://<host>:8089/` (directory name doesn’t matter)

Each copy keeps its own `data/transactions.json`. For Cypress, start the service with `cwd` set to the mock folder.

---

## What this does not mock

Card payments, refunds, `TransactionHistory`, tokenize/charge/refund APIs, or auto-registration from jBilling runs.

---

## Project layout

```text
snappay-ach-mock/
├── public/          # Web UI
├── src/             # Express server + routes
├── data/            # transactions.json (registry)
└── package.json
```

Internal test tool — not for production.

For **soa-qa-infra server** deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md).
