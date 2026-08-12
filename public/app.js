const PAGE_SIZE = 25;

const form = document.getElementById('registerForm');
const formMessage = document.getElementById('formMessage');
const transactionsBody = document.getElementById('transactionsBody');
const healthStatus = document.getElementById('healthStatus');
const baseUrlExample = document.getElementById('baseUrlExample');
const dateInput = document.getElementById('date');
const resetBtn = document.getElementById('resetBtn');
const searchInput = document.getElementById('searchInput');
const sortField = document.getElementById('sortField');
const sortDirection = document.getElementById('sortDirection');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const paginationInfo = document.getElementById('paginationInfo');
const clearAllBtn = document.getElementById('clearAllBtn');
const clearAllMessage = document.getElementById('clearAllMessage');

const state = {
  allTransactions: [],
  currentPage: 1,
  searchQuery: '',
  sortField: 'registeredAt',
  sortDirection: 'desc',
  highlightTransactionId: null
};

baseUrlExample.textContent = `${window.location.origin}/`;

function formatSnapPayDate(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) {
    hours = 12;
  }
  const paddedHours = String(hours).padStart(2, '0');

  return `${month}/${day}/${year} ${paddedHours}:${minutes}:${seconds} ${ampm}`;
}

function setCurrentDateTime() {
  dateInput.value = formatSnapPayDate(new Date());
}

function showMessage(element, text, type) {
  element.textContent = text;
  element.className = `message ${type}`;
  element.hidden = false;
}

function hideMessage(element) {
  element.hidden = true;
  element.textContent = '';
}

function formatDescription(value) {
  if (value === null || value === undefined || value === '') {
    return '(empty)';
  }
  return value;
}

function formatRecordSummary(record) {
  return [
    `ID: ${record.transactionId}`,
    `Amount: ${record.amount}`,
    `Return code: ${record.returnCode || ''}`,
    `Description: ${formatDescription(record.returnDescription)}`,
    `Date: ${record.transactionDate || ''}`
  ].join(' | ');
}

function navigateToTransaction(transactionId) {
  state.highlightTransactionId = transactionId;
  state.searchQuery = String(transactionId);
  searchInput.value = state.searchQuery;

  const filtered = filterAndSortTransactions();
  const index = filtered.findIndex((txn) => txn.transactionId === transactionId);
  if (index >= 0) {
    state.currentPage = Math.floor(index / PAGE_SIZE) + 1;
  }

  renderTransactionsTable();

  window.requestAnimationFrame(() => {
    const row = transactionsBody.querySelector(
      `[data-transaction-id="${CSS.escape(String(transactionId))}"]`
    );
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

function resetFormDefaults() {
  form.reset();
  setCurrentDateTime();
  hideMessage(formMessage);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseSnapPayDate(value) {
  if (!value) {
    return 0;
  }
  const match = String(value).trim().match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/i
  );
  if (!match) {
    return 0;
  }

  const [, month, day, year, hour, minute, second, ampm] = match;
  let hours = Number(hour) % 12;
  if (ampm.toUpperCase() === 'PM') {
    hours += 12;
  }

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    hours,
    Number(minute),
    Number(second)
  ).getTime();
}

function getSortValue(txn, field) {
  switch (field) {
    case 'amount':
      return Number(txn.amount) || 0;
    case 'transactionId':
      return String(txn.transactionId || '').toLowerCase();
    case 'transactionDate':
      return parseSnapPayDate(txn.transactionDate);
    case 'registeredAt':
    default:
      return new Date(txn.registeredAt || 0).getTime();
  }
}

function filterAndSortTransactions() {
  const query = state.searchQuery.trim().toLowerCase();

  let results = state.allTransactions.filter((txn) => {
    if (!query) {
      return true;
    }
    return String(txn.transactionId).toLowerCase().includes(query);
  });

  results.sort((left, right) => {
    const leftValue = getSortValue(left, state.sortField);
    const rightValue = getSortValue(right, state.sortField);

    if (leftValue < rightValue) {
      return state.sortDirection === 'asc' ? -1 : 1;
    }
    if (leftValue > rightValue) {
      return state.sortDirection === 'asc' ? 1 : -1;
    }
    return 0;
  });

  return results;
}

function renderTransactionsTable() {
  const filtered = filterAndSortTransactions();
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }

  const startIndex = (state.currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  if (totalItems === 0) {
    const emptyMessage = state.searchQuery
      ? 'No transactions match your search.'
      : 'No transactions registered yet.';
    transactionsBody.innerHTML = `<tr><td colspan="6" class="empty" data-testid="transactions-empty">${emptyMessage}</td></tr>`;
  } else {
    transactionsBody.innerHTML = pageItems
      .map((txn) => {
        const isHighlighted = state.highlightTransactionId === txn.transactionId;
        const rowClass = isHighlighted ? ' class="row-highlight"' : '';
        return `
        <tr${rowClass} data-testid="transaction-row" data-transaction-id="${escapeHtml(txn.transactionId)}">
          <td><code>${escapeHtml(txn.transactionId)}</code></td>
          <td data-testid="transaction-amount">${escapeHtml(String(txn.amount))}</td>
          <td data-testid="transaction-return-code">${escapeHtml(txn.returnCode || '')}</td>
          <td data-testid="transaction-return-description">${escapeHtml(formatDescription(txn.returnDescription))}</td>
          <td data-testid="transaction-date">${escapeHtml(txn.transactionDate || '')}</td>
          <td>
            <button
              type="button"
              class="btn danger"
              data-testid="btn-delete-transaction"
              data-delete="${escapeHtml(txn.transactionId)}"
              aria-label="Delete transaction ${escapeHtml(txn.transactionId)}"
            >Delete</button>
          </td>
        </tr>
      `;
      })
      .join('');
  }

  paginationInfo.textContent = totalItems === 0
    ? 'Showing 0 of 0'
    : `Page ${state.currentPage} of ${totalPages} (${totalItems} total)`;

  prevPageBtn.disabled = state.currentPage <= 1;
  nextPageBtn.disabled = state.currentPage >= totalPages;
}

async function checkHealth() {
  try {
    const response = await fetch('/health');
    if (!response.ok) {
      throw new Error('Health check failed');
    }
    healthStatus.textContent = 'Service running';
    healthStatus.className = 'status-pill ok';
  } catch (_error) {
    healthStatus.textContent = 'Service unavailable';
    healthStatus.className = 'status-pill error';
  }
}

async function loadTransactions() {
  transactionsBody.innerHTML = '<tr><td colspan="6" class="empty">Loading…</td></tr>';

  try {
    const response = await fetch('/api/transactions');
    const data = await response.json();
    state.allTransactions = data.transactions || [];
    renderTransactionsTable();
  } catch (_error) {
    transactionsBody.innerHTML = '<tr><td colspan="6" class="empty">Failed to load transactions.</td></tr>';
    paginationInfo.textContent = 'Page 1 of 1';
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;
  }
}

async function clearAllTransactions() {
  if (!window.confirm('Delete all registered transactions?')) {
    return;
  }

  try {
    const response = await fetch('/api/transactions/all', { method: 'DELETE' });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Clear all failed');
    }

    showMessage(clearAllMessage, `Cleared ${data.count} transaction(s).`, 'success');
    state.currentPage = 1;
    await loadTransactions();
  } catch (error) {
    showMessage(clearAllMessage, error.message, 'error');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage(formMessage);

  const formData = new FormData(form);
  const payload = {
    transactionId: formData.get('transactionId')?.toString().trim(),
    amount: Number(formData.get('amount'))
  };

  const returnReasonCode = formData.get('returnReasonCode')?.toString().trim();
  const returnReasonDescription = formData.get('returnReasonDescription')?.toString();
  const date = formData.get('date')?.toString().trim();

  if (returnReasonCode) {
    payload.returnReasonCode = returnReasonCode;
  }

  if (formData.get('returnReasonDescription') !== null) {
    payload.returnReasonDescription = returnReasonDescription.trim();
  }

  if (date) {
    payload.date = date;
  }

  try {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (response.status === 409 && data.record) {
      showMessage(
        formMessage,
        `${data.error}. Existing record: ${formatRecordSummary(data.record)}`,
        'error'
      );
      await loadTransactions();
      navigateToTransaction(data.record.transactionId);
      return;
    }

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    state.highlightTransactionId = null;

    showMessage(formMessage, `Registered transaction ${payload.transactionId}.`, 'success');
    resetFormDefaults();
    state.currentPage = 1;
    await loadTransactions();
  } catch (error) {
    showMessage(formMessage, error.message, 'error');
  }
});

resetBtn.addEventListener('click', () => {
  window.setTimeout(resetFormDefaults, 0);
});

searchInput.addEventListener('input', (event) => {
  state.searchQuery = event.target.value;
  state.highlightTransactionId = null;
  state.currentPage = 1;
  renderTransactionsTable();
});

sortField.addEventListener('change', (event) => {
  state.sortField = event.target.value;
  state.currentPage = 1;
  renderTransactionsTable();
});

sortDirection.addEventListener('change', (event) => {
  state.sortDirection = event.target.value;
  state.currentPage = 1;
  renderTransactionsTable();
});

prevPageBtn.addEventListener('click', () => {
  if (state.currentPage > 1) {
    state.currentPage -= 1;
    renderTransactionsTable();
  }
});

nextPageBtn.addEventListener('click', () => {
  state.currentPage += 1;
  renderTransactionsTable();
});

transactionsBody.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete]');
  if (!button) {
    return;
  }

  const transactionId = button.getAttribute('data-delete');
  if (!window.confirm(`Delete registration for ${transactionId}?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/transactions/${encodeURIComponent(transactionId)}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Delete failed');
    }
    await loadTransactions();
  } catch (error) {
    showMessage(formMessage, error.message, 'error');
  }
});

document.getElementById('refreshBtn').addEventListener('click', loadTransactions);
clearAllBtn.addEventListener('click', clearAllTransactions);

setCurrentDateTime();
checkHealth();
loadTransactions();
