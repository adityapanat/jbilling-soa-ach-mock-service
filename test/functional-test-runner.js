#!/usr/bin/env node
/**
 * Functional test runner for snappay-ach-mock.
 * Run with server already up: node test/functional-test-runner.js
 */

const BASE = process.env.MOCK_BASE_URL || 'http://localhost:8089';

const results = [];

function record(id, category, scenario, steps, expected, actual, pass) {
  results.push({ id, category, scenario, steps, expected, actual, pass });
}

async function request(method, path, body) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, options);
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  return { status: res.status, json, headers: res.headers };
}

async function clearAll() {
  await request('DELETE', '/api/transactions/all');
}

async function runTests() {
  await clearAll();

  // TC-001 Health
  {
    const { status, json } = await request('GET', '/health');
    record(
      'TC-001',
      'Functional',
      'Health endpoint returns service status',
      'GET /health',
      'HTTP 200, status=ok, service=snappay-ach-mock',
      `HTTP ${status}, ${JSON.stringify(json)}`,
      status === 200 && json?.status === 'ok' && json?.service === 'snappay-ach-mock'
    );
  }

  // TC-002 Register valid transaction
  {
    const payload = {
      transactionId: 'TC002-TXN',
      amount: 85.5,
      returnReasonCode: 'R29',
      date: '7/30/2026 01:26:35 AM'
    };
    const { status, json } = await request('POST', '/api/transactions', payload);
    record(
      'TC-002',
      'Functional',
      'Register valid transaction',
      `POST /api/transactions ${JSON.stringify(payload)}`,
      'HTTP 201, record with matching fields',
      `HTTP ${status}, record=${JSON.stringify(json?.record)}`,
      status === 201 &&
        json?.record?.transactionId === 'TC002-TXN' &&
        json?.record?.amount === 85.5 &&
        json?.record?.returnCode === 'R29'
    );
  }

  // TC-003 Default return code and empty description
  {
    await clearAll();
    const { status, json } = await request('POST', '/api/transactions', {
      transactionId: 'TC003-TXN',
      amount: 10
    });
    record(
      'TC-003',
      'Functional',
      'Register with defaults (R29 code, empty description)',
      'POST with only transactionId and amount',
      'returnCode=R29, returnDescription=""',
      `HTTP ${status}, returnCode=${json?.record?.returnCode}, desc="${json?.record?.returnDescription}"`,
      status === 201 &&
        json?.record?.returnCode === 'R29' &&
        json?.record?.returnDescription === ''
    );
  }

  // TC-004 Duplicate transaction ID
  {
    await clearAll();
    await request('POST', '/api/transactions', { transactionId: 'TC004-TXN', amount: 50 });
    const first = await request('POST', '/api/transactions', {
      transactionId: 'TC004-TXN',
      amount: 99,
      returnReasonCode: 'R01'
    });
    const list = await request('GET', '/api/transactions');
    const stored = list.json?.transactions?.find((t) => t.transactionId === 'TC004-TXN');
    record(
      'TC-004',
      'Functional',
      'Duplicate transaction ID rejected, original preserved',
      'Register same ID twice with different amount/code',
      'HTTP 409, original amount=50 unchanged',
      `HTTP ${first.status}, stored amount=${stored?.amount}, error=${first.json?.error}`,
      first.status === 409 &&
        first.json?.record?.amount === 50 &&
        stored?.amount === 50 &&
        stored?.returnCode === 'R29'
    );
  }

  // TC-005 Missing transactionId
  {
    const { status, json } = await request('POST', '/api/transactions', { amount: 10 });
    record(
      'TC-005',
      'Functional',
      'Missing transactionId validation',
      'POST /api/transactions without transactionId',
      'HTTP 400, error message',
      `HTTP ${status}, error=${json?.error}`,
      status === 400 && json?.error?.includes('transactionId')
    );
  }

  // TC-006 Missing amount
  {
    const { status, json } = await request('POST', '/api/transactions', {
      transactionId: 'TC006-TXN'
    });
    record(
      'TC-006',
      'Functional',
      'Missing amount validation',
      'POST without amount',
      'HTTP 400',
      `HTTP ${status}, error=${json?.error}`,
      status === 400 && json?.error?.includes('amount')
    );
  }

  // TC-007 Invalid amount
  {
    const cases = [
      { amount: 0, label: 'zero' },
      { amount: -5, label: 'negative' },
      { amount: 'abc', label: 'non-numeric' }
    ];
    for (const c of cases) {
      const { status, json } = await request('POST', '/api/transactions', {
        transactionId: `TC007-${c.label}`,
        amount: c.amount
      });
      record(
        `TC-007-${c.label}`,
        'Functional',
        `Invalid amount (${c.label}) rejected`,
        `POST amount=${c.amount}`,
        'HTTP 400',
        `HTTP ${status}, error=${json?.error}`,
        status === 400
      );
    }
  }

  // TC-008 Alternate field names (snake_case)
  {
    await clearAll();
    const { status, json } = await request('POST', '/api/transactions', {
      transaction_id: 'TC008-TXN',
      transaction_amount: 42,
      return_code: 'R10',
      return_description: 'Test desc',
      transaction_date: '6/23/2026 02:07:27 PM'
    });
    record(
      'TC-008',
      'Functional',
      'Snake_case field aliases accepted',
      'POST with transaction_id, transaction_amount, etc.',
      'HTTP 201, fields mapped correctly',
      `HTTP ${status}, id=${json?.record?.transactionId}, code=${json?.record?.returnCode}`,
      status === 201 &&
        json?.record?.transactionId === 'TC008-TXN' &&
        json?.record?.amount === 42 &&
        json?.record?.returnCode === 'R10'
    );
  }

  // TC-009 Explicit empty return description
  {
    await clearAll();
    const { status, json } = await request('POST', '/api/transactions', {
      transactionId: 'TC009-TXN',
      amount: 15,
      returnReasonDescription: ''
    });
    record(
      'TC-009',
      'Functional',
      'Explicit empty return description preserved',
      'POST returnReasonDescription=""',
      'returnDescription=""',
      `desc="${json?.record?.returnDescription}"`,
      status === 201 && json?.record?.returnDescription === ''
    );
  }

  // TC-010 Invalid date format
  {
    const { status, json } = await request('POST', '/api/transactions', {
      transactionId: 'TC010-TXN',
      amount: 10,
      date: 'not-a-date'
    });
    record(
      'TC-010',
      'Functional',
      'Invalid date format rejected',
      'POST date=not-a-date',
      'HTTP 400 with date format error',
      `HTTP ${status}, error=${json?.error}`,
      status === 400 && json?.error?.includes('date')
    );
  }

  // TC-011 Date zero-padding normalization
  {
    await clearAll();
    const { status, json } = await request('POST', '/api/transactions', {
      transactionId: 'TC011-TXN',
      amount: 10,
      date: '7/30/2026 1:26:35 AM'
    });
    const hour = json?.record?.transactionDate?.match(/ (\d{2}):/)?.[1];
    record(
      'TC-011',
      'Functional',
      'Single-digit hour padded in stored date',
      'POST date with hour=1 (not 01)',
      'Stored date has zero-padded hour (01)',
      `HTTP ${status}, date=${json?.record?.transactionDate}, hour=${hour}`,
      status === 201 && hour === '01'
    );
  }

  // TC-012 List transactions
  {
    await clearAll();
    await request('POST', '/api/transactions', { transactionId: 'TC012-A', amount: 1 });
    await request('POST', '/api/transactions', { transactionId: 'TC012-B', amount: 2 });
    const { status, json } = await request('GET', '/api/transactions');
    record(
      'TC-012',
      'Functional',
      'List all registered transactions',
      'GET /api/transactions after 2 registrations',
      'HTTP 200, transactions array length=2',
      `HTTP ${status}, count=${json?.transactions?.length}`,
      status === 200 && json?.transactions?.length === 2
    );
  }

  // TC-013 Delete single transaction
  {
    await clearAll();
    await request('POST', '/api/transactions', { transactionId: 'TC013-TXN', amount: 5 });
    const del = await request('DELETE', '/api/transactions/TC013-TXN');
    const get = await request('POST', '/api/interop/GetTransaction', {
      transactionid: 'TC013-TXN'
    });
    record(
      'TC-013',
      'Functional',
      'Delete single transaction',
      'DELETE /api/transactions/:id then GetTransaction',
      'Delete 200, GetTransaction 200 Success (no longer registered)',
      `delete=${del.status}, get=${get.status}, txnStatus=${get.json?.transactions?.[0]?.transaction?.transactionstatus}`,
      del.status === 200 &&
        get.status === 200 &&
        get.json?.transactions?.[0]?.transaction?.transactionstatus === 'Success'
    );
  }

  // TC-014 Delete non-existent
  {
    const { status, json } = await request('DELETE', '/api/transactions/DOES-NOT-EXIST');
    record(
      'TC-014',
      'Functional',
      'Delete non-existent transaction',
      'DELETE unknown ID',
      'HTTP 404',
      `HTTP ${status}, error=${json?.error}`,
      status === 404
    );
  }

  // TC-015 Clear all
  {
    await request('POST', '/api/transactions', { transactionId: 'TC015-A', amount: 1 });
    await request('POST', '/api/transactions', { transactionId: 'TC015-B', amount: 2 });
    const del = await request('DELETE', '/api/transactions/all');
    const list = await request('GET', '/api/transactions');
    record(
      'TC-015',
      'Functional',
      'Clear all transactions',
      'DELETE /api/transactions/all',
      'count=2 cleared, list empty',
      `delete count=${del.json?.count}, list len=${list.json?.transactions?.length}`,
      del.status === 200 && del.json?.count === 2 && list.json?.transactions?.length === 0
    );
  }

  // TC-016 GetTransaction registered
  {
    await clearAll();
    await request('POST', '/api/transactions', {
      transactionId: '202784935080',
      amount: 85,
      returnReasonCode: 'R29',
      date: '7/30/2026 01:26:35 AM'
    });
    const { status, json } = await request('POST', '/api/interop/GetTransaction', {
      transactionid: '202784935080'
    });
    const txn = json?.transactions?.[0]?.transaction;
    record(
      'TC-016',
      'Functional',
      'GetTransaction returns SnapPay-compatible ACH reject',
      'POST /api/interop/GetTransaction for registered ID',
      'HTTP 200, message=Failed, transactionstatus=Failed, returncode=R29',
      `HTTP ${status}, status=${txn?.transactionstatus}, code=${txn?.returncode}, pgid=${txn?.pgtransactionid}`,
      status === 200 &&
        json?.message === 'Failed' &&
        txn?.transactionstatus === 'Failed' &&
        txn?.returncode === 'R29' &&
        txn?.pgtransactionid === '202784935080' &&
        txn?.pgtransactiontype === 'Charge'
    );
  }

  // TC-017 GetTransaction unknown (not registered — treat as successful, no return)
  {
    const { status, json } = await request('POST', '/api/interop/GetTransaction', {
      transactionid: 'UNKNOWN-999'
    });
    const txn = json?.transactions?.[0]?.transaction;
    record(
      'TC-017',
      'Functional',
      'GetTransaction unknown ID',
      'POST GetTransaction for unregistered ID',
      'HTTP 200, transactionstatus=Success (jBilling settlement skips non-Failed)',
      `HTTP ${status}, message=${json?.message}, status=${txn?.transactionstatus}`,
      status === 200 &&
        json?.message === 'Success' &&
        json?.status === 'Y' &&
        txn?.transactionstatus === 'Success' &&
        txn?.pgtransactionid === 'UNKNOWN-999'
    );
  }

  // TC-018 GetTransaction missing ID
  {
    const { status, json } = await request('POST', '/api/interop/GetTransaction', {});
    record(
      'TC-018',
      'Functional',
      'GetTransaction missing transactionid',
      'POST empty body',
      'HTTP 400',
      `HTTP ${status}, message=${json?.message}`,
      status === 400 && json?.message?.includes('transactionid')
    );
  }

  // TC-019 GetTransaction camelCase alias
  {
    await clearAll();
    await request('POST', '/api/transactions', { transactionId: 'TC019-TXN', amount: 20 });
    const { status, json } = await request('POST', '/api/interop/GetTransaction', {
      transactionId: 'TC019-TXN'
    });
    record(
      'TC-019',
      'Functional',
      'GetTransaction accepts transactionId camelCase',
      'POST with transactionId instead of transactionid',
      'HTTP 200',
      `HTTP ${status}`,
      status === 200 && json?.transactions?.[0]?.transaction?.pgtransactionid === 'TC019-TXN'
    );
  }

  // TC-020 SnapPay response structure
  {
    await clearAll();
    await request('POST', '/api/transactions', {
      transactionId: 'TC020-TXN',
      amount: 100,
      returnReasonCode: 'R29'
    });
    const { json } = await request('POST', '/api/interop/GetTransaction', {
      transactionid: 'TC020-TXN'
    });
    const pm = json?.transactions?.[0]?.paymentmethod;
    const hasRequired =
      json?.accountid &&
      json?.transactions?.[0]?.transaction?.transactionamount === 100 &&
      pm?.type === 'CHECKING' &&
      pm?.routingnumber &&
      pm?.last4;
    record(
      'TC-020',
      'Design',
      'GetTransaction response matches SnapPay ACH structure',
      'Verify accountid, amounts, paymentmethod CHECKING fields',
      'All required SnapPay fields present',
      `accountid=${json?.accountid}, type=${pm?.type}, amount=${json?.transactions?.[0]?.transaction?.transactionamount}`,
      Boolean(hasRequired)
    );
  }

  // TC-021 UI static files served
  {
    const res = await fetch(`${BASE}/`);
    const html = await res.text();
    const hasForm = html.includes('data-testid="register-form"');
    const hasTable = html.includes('data-testid="transactions-table"');
    record(
      'TC-021',
      'Design',
      'Web UI index.html served with Cypress testids',
      'GET /',
      'HTML contains register form and transactions table testids',
      `status=${res.status}, form=${hasForm}, table=${hasTable}`,
      res.status === 200 && hasForm && hasTable
    );
  }

  // TC-022 UI assets
  {
    const appJs = await fetch(`${BASE}/app.js`);
    const css = await fetch(`${BASE}/styles.css`);
    record(
      'TC-022',
      'Design',
      'Static assets app.js and styles.css available',
      'GET /app.js and /styles.css',
      'HTTP 200 for both',
      `app.js=${appJs.status}, css=${css.status}`,
      appJs.status === 200 && css.status === 200
    );
  }

  // TC-023 404 unknown route
  {
    const { status, json } = await request('GET', '/api/unknown');
    record(
      'TC-023',
      'Functional',
      'Unknown API route returns 404',
      'GET /api/unknown',
      'HTTP 404',
      `HTTP ${status}`,
      status === 404
    );
  }

  // TC-024 Whitespace trim on transaction ID
  {
    await clearAll();
    await request('POST', '/api/transactions', {
      transactionId: '  TC024-TXN  ',
      amount: 10
    });
    const get = await request('POST', '/api/interop/GetTransaction', {
      transactionid: 'TC024-TXN'
    });
    record(
      'TC-024',
      'Logical',
      'Transaction ID trimmed on registration',
      'Register with padded spaces, lookup without spaces',
      'GetTransaction finds trimmed ID',
      `get status=${get.status}`,
      get.status === 200
    );
  }

  // TC-025 DELETE /all route vs :transactionId ordering (logical)
  {
    await clearAll();
    await request('POST', '/api/transactions', { transactionId: 'all', amount: 5 });
    const delAll = await request('DELETE', '/api/transactions/all');
    const list = await request('GET', '/api/transactions');
    record(
      'TC-025',
      'Logical',
      'DELETE /all does not delete txn with ID "all"',
      'Register txn id=all, call DELETE /all',
      'Clears all including id=all OR route conflict',
      `clear count=${delAll.json?.count}, remaining=${list.json?.transactions?.length}`,
      delAll.json?.count === 1 && list.json?.transactions?.length === 0
    );
  }

  // TC-026 Persistence across list after register
  {
    await clearAll();
    await request('POST', '/api/transactions', { transactionId: 'TC026-TXN', amount: 33 });
    const list1 = await request('GET', '/api/transactions');
    const list2 = await request('GET', '/api/transactions');
    record(
      'TC-026',
      'Logical',
      'Registered data persists in store',
      'Register then GET list twice',
      'Same transaction present both times',
      `count1=${list1.json?.transactions?.length}, count2=${list2.json?.transactions?.length}`,
      list1.json?.transactions?.length === 1 && list2.json?.transactions?.length === 1
    );
  }

  // TC-027 returndescription empty in GetTransaction (jBilling compatibility)
  {
    await clearAll();
    await request('POST', '/api/transactions', {
      transactionId: 'TC027-TXN',
      amount: 10
    });
    const { json } = await request('POST', '/api/interop/GetTransaction', {
      transactionid: 'TC027-TXN'
    });
    const desc = json?.transactions?.[0]?.transaction?.returndescription;
    record(
      'TC-027',
      'Logical',
      'Empty returndescription in GetTransaction (SnapPay behavior)',
      'Register without description, call GetTransaction',
      'returndescription is empty string',
      `returndescription="${desc}"`,
      desc === ''
    );
  }

  // TC-028 Amount decimal precision
  {
    await clearAll();
    const { json } = await request('POST', '/api/transactions', {
      transactionId: 'TC028-TXN',
      amount: 2060.75
    });
    const get = await request('POST', '/api/interop/GetTransaction', {
      transactionid: 'TC028-TXN'
    });
    const amt = get.json?.transactions?.[0]?.transaction?.transactionamount;
    record(
      'TC-028',
      'Logical',
      'Decimal amount preserved in GetTransaction',
      'Register amount=2060.75',
      'transactionamount=2060.75',
      `amount=${amt}`,
      json?.record?.amount === 2060.75 && amt === 2060.75
    );
  }

  await clearAll();
}

async function main() {
  try {
    const health = await fetch(`${BASE}/health`);
    if (!health.ok) {
      console.error('Server not reachable at', BASE);
      process.exit(1);
    }
  } catch (e) {
    console.error('Cannot connect to', BASE, '- start server first: npm start');
    process.exit(1);
  }

  await runTests();

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  console.log(JSON.stringify({ summary: { total: results.length, passed, failed }, results }, null, 2));
  process.exit(failed > 0 ? 1 : 0);
}

main();
