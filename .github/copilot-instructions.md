# Repository Guidelines

## Build, Run, and Test

- Requires Node.js 18 or newer. Install dependencies with `npm install`.
- Start the service with `npm start`; use `npm run dev` for Node's watch mode. There are no build or lint scripts.
- Run the functional checks with the server already running: `MOCK_BASE_URL=http://localhost:8089 node test/functional-test-runner.js`. Set `MOCK_BASE_URL` when testing another local instance.
- The runner executes TC-001 through TC-030 as one batch; it has no per-case selector. It clears the transaction registry and leaves it empty, so run it against disposable test data. For a single endpoint smoke check, for example, use `curl -fsS http://localhost:8089/health`.

## Architecture

- `src/server.js` creates the Express app, serves `public/`, and mounts the version metadata, transaction-management API, and SnapPay interop route. `src/routes/transactions.js` handles registration/list/delete; `src/routes/getTransaction.js` implements `POST /api/interop/GetTransaction`.
- Registration input is normalized and validated at the route/store boundary. `src/store.js` owns the transaction registry and persists records as JSON (default `data/transactions.json`; configurable through `DATA_FILE`). `src/dateUtil.js` normalizes dates to SnapPay's `M/d/yyyy hh:mm:ss a` format.
- The interop route looks up registered IDs and delegates response construction to `src/templates/achReturnResponse.js` or `src/templates/achSuccessResponse.js`. Shared account, payment-method, transaction defaults, and environment-backed settings live in `src/config.js`; `src/logger.js` writes service messages to the console and the configured log file.
- `public/index.html`, `public/version.html`, `public/app.js`, and `public/styles.css` form browser pages served directly by Express. The version page reports package metadata from `GET /api/version`; no frontend build step is required.

## Repository Conventions

- Use CommonJS (`require`/`module.exports`) and keep HTTP behavior in the existing Express routers; mount new API paths in `src/server.js`.
- Keep internal transaction records camel-cased. API registration accepts documented camelCase and snake_case aliases, while SnapPay response payloads use the provider's lowercase field names.
- Preserve the settlement contract: a registered transaction returns `transactionstatus: "Failed"` with its configured return details; an unknown ID returns HTTP 200 with `transactionstatus: "Success"` so the settlement job skips it. Duplicate registrations return 409 without replacing the original record.
- Keep SnapPay response constants centralized in `src/config.js` and response shapes in the dedicated template modules. Keep UI `data-testid` attributes stable for functional/browser automation.
- The functional runner is a standalone Node script using the running service and `fetch`; it is not a test-framework suite. Its test cases are labeled `TC-###`, and it mutates the server's persistent registry.

See [README.md](../README.md) for API examples, configuration, and local jBilling setup; see [DEPLOYMENT.md](../DEPLOYMENT.md) for deployment details.
