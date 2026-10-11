/* =============================================================
   Budget Planner — Application Logic
   ============================================================= */
'use strict';

/* ---------- Configuration ---------- */
const STORAGE_KEY = 'budgetPlanner.v1';      // same key as before, so saved data is kept
const THEME_KEY = 'budgetPlanner.theme';
const MAX_AMOUNT = 1e10;
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

const CATEGORIES = {
  expense: [
    { name: 'Food & Dining',  icon: '🍽️', color: '#f97316' },
    { name: 'Rent & Housing', icon: '🏠', color: '#6366f1' },
    { name: 'Transport',      icon: '🚗', color: '#0ea5e9' },
    { name: 'Utilities',      icon: '💡', color: '#eab308' },
    { name: 'Shopping',       icon: '🛍️', color: '#ec4899' },
    { name: 'Health',         icon: '💊', color: '#14b8a6' },
    { name: 'Entertainment',  icon: '🎬', color: '#a855f7' },
    { name: 'Education',      icon: '🎓', color: '#3b82f6' },
    { name: 'Bills & EMI',    icon: '🧾', color: '#ef4444' },
    { name: 'Other',          icon: '📦', color: '#64748b' }
  ],
  income: [
    { name: 'Salary',       icon: '💼', color: '#10b981' },
    { name: 'Freelance',    icon: '💻', color: '#06b6d4' },
    { name: 'Business',     icon: '🏢', color: '#8b5cf6' },
    { name: 'Investments',  icon: '📈', color: '#22c55e' },
    { name: 'Gifts',        icon: '🎁', color: '#f472b6' },
    { name: 'Other Income', icon: '💰', color: '#84cc16' }
  ]
};

const CATEGORY_MAP = new Map(
  [...CATEGORIES.expense, ...CATEGORIES.income].map((c) => [c.name, c])
);

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const compactCurrency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const ICONS = {
  edit: '<svg class="i" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg class="i" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  success: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
  error: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  info: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
};

/* ---------- DOM references ---------- */
const $ = (id) => document.getElementById(id);

const el = {
  prevMonthBtn: $('prevMonthBtn'),
  nextMonthBtn: $('nextMonthBtn'),
  monthLabelBtn: $('monthLabelBtn'),
  monthLabel: $('monthLabel'),
  exportBtn: $('exportBtn'),
  themeToggle: $('themeToggle'),
  resetBtn: $('resetBtn'),

  greeting: $('greeting'),
  heroMonth: $('heroMonth'),
  remainingValue: $('remainingValue'),
  statusChip: $('statusChip'),
  statusText: $('statusText'),
  progressText: $('progressText'),
  ringWrap: $('ringWrap'),
  ringFill: $('ringFill'),
  ringPercent: $('ringPercent'),

  budgetValue: $('budgetValue'),
  budgetFoot: $('budgetFoot'),
  incomeValue: $('incomeValue'),
  incomeCount: $('incomeCount'),
  expenseValue: $('expenseValue'),
  expenseCount: $('expenseCount'),
  balanceValue: $('balanceValue'),

  budgetForm: $('budgetForm'),
  budgetInput: $('budgetInput'),
  budgetMonthLabel: $('budgetMonthLabel'),
  copyBudgetBtn: $('copyBudgetBtn'),

  txFormCard: $('txFormCard'),
  txForm: $('transactionForm'),
  formTitle: $('formTitle'),
  formSub: $('formSub'),
  amountInput: $('amountInput'),
  categoryChips: $('categoryChips'),
  descInput: $('descInput'),
  dateInput: $('dateInput'),
  formError: $('formError'),
  submitLabel: $('submitLabel'),
  cancelEditBtn: $('cancelEditBtn'),

  breakdown: $('breakdown'),
  donut: $('donut'),
  donutTotal: $('donutTotal'),
  categoryList: $('categoryList'),
  categoryEmpty: $('categoryEmpty'),

  txCount: $('txCount'),
  clearFiltersBtn: $('clearFiltersBtn'),
  searchInput: $('searchInput'),
  filterCategory: $('filterCategory'),
  txList: $('txList'),
  txEmpty: $('txEmpty'),
  txEmptyTitle: $('txEmptyTitle'),
  txEmptyText: $('txEmptyText'),

  fabBtn: $('fabBtn'),
  modal: $('confirmModal'),
  modalTitle: $('modalTitle'),
  modalMessage: $('modalMessage'),
  modalCancel: $('modalCancel'),
  modalConfirm: $('modalConfirm'),
  toastStack: $('toastStack')
};

/* ---------- State ---------- */
let state = loadState();
let viewMonth = todayMonth();
let editingId = null;
let lastAddedId = null;

/* =============================================================
   Storage
   ============================================================= */
function sanitizeTransaction(t) {
  if (!t || typeof t !== 'object') return null;
  const amount = Number(t.amount);
  if (t.type !== 'income' && t.type !== 'expense') return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (typeof t.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return null;

  return {
    id: t.id ? String(t.id) : generateId(),
    createdAt: Number(t.createdAt) || Date.now(),
    type: t.type,
    amount: round2(amount),
    category: typeof t.category === 'string' && t.category
      ? t.category
      : (t.type === 'income' ? 'Other Income' : 'Other'),
    description: typeof t.description === 'string' ? t.description.slice(0, 60) : '',
    date: t.date
  };
}

function loadState() {
  const empty = { budgets: {}, transactions: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);

    const budgets = {};
    if (parsed && typeof parsed.budgets === 'object' && parsed.budgets !== null) {
      Object.entries(parsed.budgets).forEach(([month, value]) => {
        const amount = Number(value);
        if (/^\d{4}-\d{2}$/.test(month) && Number.isFinite(amount) && amount > 0) {
          budgets[month] = round2(amount);
        }
      });
    }

    const transactions = Array.isArray(parsed?.transactions)
      ? parsed.transactions.map(sanitizeTransaction).filter(Boolean)
      : [];

    return { budgets, transactions };
  } catch (err) {
    console.warn('Could not read saved data:', err);
    return empty;
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Could not save data:', err);
    showToast('Unable to save. Browser storage may be full or blocked.', 'error');
  }
}

/* =============================================================
   Helpers
   ============================================================= */
function round2(n) { return Math.round(n * 100) / 100; }

function sum(list) { return round2(list.reduce((total, t) => total + t.amount, 0)); }

function toLocalISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayISO() { return toLocalISO(new Date()); }
function todayMonth() { return todayISO().slice(0, 7); }

function shiftMonthKey(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function monthName(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long' });
}

function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }

function dayLabel(iso) {
  const today = todayISO();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  if (iso === today) return 'Today';
  if (iso === toLocalISO(yesterdayDate)) return 'Yesterday';

  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short'
  });
}

function formatMoney(value) { return currency.format(value); }

function pluralize(count, one, many) { return `${count} ${count === 1 ? one : many}`; }

function generateId() {
  if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cssEscape(value) {
  return window.CSS && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/"/g, '\\"');
}

function categoryMeta(name) {
  return CATEGORY_MAP.get(name) || { name, icon: '📦', color: '#64748b' };
}

function getMonthTransactions(month) {
  return state.transactions.filter((t) => t.date.startsWith(month));
}

function getSelectedType() {
  return el.txForm.querySelector('input[name="type"]:checked').value;
}

function setSelectedType(type) {
  el.txForm.querySelector(`input[name="type"][value="${type}"]`).checked = true;
}

function getSelectedCategory() {
  const checked = el.categoryChips.querySelector('input[name="category"]:checked');
  return checked ? checked.value : '';
}

function getFilterType() {
  return document.querySelector('input[name="filterType"]:checked').value;
}

function restartAnimation(node, className) {
  node.classList.remove(className);
  void node.offsetWidth; // force reflow so the animation can replay
  node.classList.add(className);
}

/* ---------- Animated number counter ---------- */
function animateValue(node, target) {
  const previous = Number(node.dataset.value);
  const from = Number.isFinite(previous) ? previous : 0;
  node.dataset.value = String(target);
  cancelAnimationFrame(node._raf);

  if (reduceMotion.matches || from === target) {
    node.textContent = formatMoney(target);
    return;
  }

  const duration = 750;
  const start = performance.now();

  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = formatMoney(from + (target - from) * eased);
    if (progress < 1) node._raf = requestAnimationFrame(step);
  };

  node._raf = requestAnimationFrame(step);
}

/* =============================================================
   Toasts & confirm dialog
   ============================================================= */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${ICONS[type] || ICONS.info}</span><span></span>`;
  toast.lastElementChild.textContent = message;
  el.toastStack.appendChild(toast);

  while (el.toastStack.children.length > 3) el.toastStack.firstElementChild.remove();

  setTimeout(() => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 320);
  }, 2800);
}

function confirmDialog({ title, message, confirmText = 'Confirm' }) {
  return new Promise((resolve) => {
    el.modalTitle.textContent = title;
    el.modalMessage.textContent = message;
    el.modalConfirm.textContent = confirmText;

    const previousFocus = document.activeElement;
    el.modal.classList.add('is-open');
    el.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    setTimeout(() => el.modalCancel.focus(), 60);

    const close = (result) => {
      el.modal.classList.remove('is-open');
      el.modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('no-scroll');
      el.modal.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey, true);
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus({ preventScroll: true });
      }
      resolve(result);
    };

    const onClick = (e) => {
      if (e.target.closest('[data-modal-confirm]')) close(true);
      else if (e.target.closest('[data-modal-cancel]')) close(false);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(false);
      } else if (e.key === 'Tab') {
        // keep focus inside the dialog
        const first = el.modalCancel;
        const last = el.modalConfirm;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    el.modal.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey, true);
  });
}

/* =============================================================
   Rendering
   ============================================================= */
function render() {
  const monthTx = getMonthTransactions(viewMonth);
  renderHeader();
  renderSummary(monthTx);
  renderBreakdown(monthTx);
  renderTransactions(monthTx);
}

function renderHeader() {
  el.monthLabel.textContent = monthLabel(viewMonth);
  el.monthLabelBtn.title = viewMonth === todayMonth() ? 'Current month' : 'Jump to current month';

  const hour = new Date().getHours();
  el.greeting.textContent =
    hour < 12 ? 'Good morning 👋' : hour < 17 ? 'Good afternoon 👋' : 'Good evening 👋';
}

function renderSummary(monthTx) {
  const budget = Number(state.budgets[viewMonth]) || 0;
  const incomeTx = monthTx.filter((t) => t.type === 'income');
  const expenseTx = monthTx.filter((t) => t.type === 'expense');
  const income = sum(incomeTx);
  const expenses = sum(expenseTx);
  const balance = round2(income - expenses);

  animateValue(el.budgetValue, budget);
  el.budgetFoot.textContent = budget ? `Set for ${monthName(viewMonth)}` : 'Not set yet';

  animateValue(el.incomeValue, income);
  el.incomeCount.textContent = pluralize(incomeTx.length, 'entry', 'entries');

  animateValue(el.expenseValue, expenses);
  el.expenseCount.textContent = pluralize(expenseTx.length, 'entry', 'entries');

  animateValue(el.balanceValue, balance);
  el.balanceValue.classList.toggle('is-positive', balance > 0);
  el.balanceValue.classList.toggle('is-negative', balance < 0);

  el.heroMonth.textContent = monthLabel(viewMonth);
  el.budgetMonthLabel.textContent = monthLabel(viewMonth);
  if (document.activeElement !== el.budgetInput) {
    el.budgetInput.value = budget ? budget : '';
  }

  renderCopyBudget(budget);
  renderBudgetStatus(budget, expenses);
}

function renderCopyBudget(budget) {
  const prevMonth = shiftMonthKey(viewMonth, -1);
  const prevBudget = Number(state.budgets[prevMonth]) || 0;
  const show = !budget && prevBudget > 0;

  el.copyBudgetBtn.classList.toggle('hidden', !show);
  if (show) {
    el.copyBudgetBtn.textContent = `Use ${monthName(prevMonth)}'s budget (${formatMoney(prevBudget)}) →`;
    el.copyBudgetBtn.dataset.amount = String(prevBudget);
  }
}

function setRing(percentShown) {
  const offset = RING_CIRCUMFERENCE * (1 - percentShown / 100);
  el.ringFill.style.strokeDasharray = RING_CIRCUMFERENCE.toFixed(2);
  el.ringFill.style.strokeDashoffset = offset.toFixed(2);
  el.ringWrap.setAttribute('aria-valuenow', String(Math.round(percentShown)));
}

function setStatus(kind, text) {
  el.statusChip.className = `status-chip is-${kind}`;
  el.statusText.textContent = text;
  el.ringFill.classList.remove('is-empty', 'is-warn', 'is-over');
  if (kind === 'none') el.ringFill.classList.add('is-empty');
  if (kind === 'warn') el.ringFill.classList.add('is-warn');
  if (kind === 'over') el.ringFill.classList.add('is-over');
}

function paceText(remaining) {
  const current = todayMonth();
  if (viewMonth < current) return 'This month has ended.';
  if (viewMonth > current) return 'You are planning ahead for an upcoming month.';
  if (remaining <= 0) return '';

  const [y, m] = viewMonth.split('-').map(Number);
  const daysLeft = daysInMonth(y, m) - new Date().getDate() + 1;
  return `That's about ${formatMoney(remaining / daysLeft)} a day for the next ${pluralize(daysLeft, 'day', 'days')}.`;
}

function renderBudgetStatus(budget, expenses) {
  const hero = el.remainingValue;

  // No budget: don't show a misleading negative "remaining" figure
  if (budget <= 0) {
    cancelAnimationFrame(hero._raf);
    delete hero.dataset.value;
    hero.textContent = 'Not set';
    hero.classList.add('is-empty');
    hero.classList.remove('is-negative');

    setStatus('none', 'No budget set');
    setRing(0);
    el.ringPercent.textContent = '—';
    el.progressText.textContent = expenses > 0
      ? `You've spent ${formatMoney(expenses)} so far. Set a budget to track your limit.`
      : 'Set a monthly budget to start tracking your spending.';
    return;
  }

  const remaining = round2(budget - expenses);
  const percent = (expenses / budget) * 100;

  hero.classList.remove('is-empty');
  hero.classList.toggle('is-negative', remaining < 0);
  animateValue(hero, remaining);

  setRing(Math.min(percent, 100));
  el.ringPercent.textContent = `${Math.round(percent)}%`;

  const pace = paceText(remaining);

  if (percent >= 100) {
    setStatus('over', 'Over budget');
    el.progressText.textContent =
      `You've gone ${formatMoney(Math.abs(remaining))} over your ${formatMoney(budget)} budget. ${pace}`.trim();
  } else if (percent >= 75) {
    setStatus('warn', 'Nearing limit');
    el.progressText.textContent =
      `${formatMoney(expenses)} of ${formatMoney(budget)} spent. ${pace}`.trim();
  } else {
    setStatus('ok', 'On track');
    el.progressText.textContent =
      `${formatMoney(expenses)} of ${formatMoney(budget)} spent. ${pace}`.trim();
  }
}

function renderBreakdown(monthTx) {
  const expenses = monthTx.filter((t) => t.type === 'expense');
  const total = sum(expenses);

  const totals = new Map();
  expenses.forEach((t) => totals.set(t.category, round2((totals.get(t.category) || 0) + t.amount)));
  const rows = [...totals].sort((a, b) => b[1] - a[1]);
  const hasData = rows.length > 0;

  el.breakdown.classList.toggle('hidden', !hasData);
  el.categoryEmpty.classList.toggle('hidden', hasData);
  el.breakdown.classList.remove('has-active');

  if (!hasData) {
    el.donut.innerHTML = '';
    el.categoryList.innerHTML = '';
    return;
  }

  el.donutTotal.textContent = compactCurrency.format(total);
  el.donutTotal.title = formatMoney(total);

  const gap = rows.length > 1 ? 0.8 : 0;
  let cumulative = 0;

  const segments = rows.map(([name, amount], i) => {
    const pct = (amount / total) * 100;
    const dash = Math.max(pct - gap, 0.01);
    const offset = 25 - cumulative; // start drawing at 12 o'clock
    cumulative += pct;
    const meta = categoryMeta(name);
    return `<circle class="donut-seg" data-index="${i}" cx="21" cy="21" r="15.9155"
      stroke="${meta.color}" stroke-dasharray="${dash.toFixed(3)} ${(100 - dash).toFixed(3)}"
      stroke-dashoffset="${offset.toFixed(3)}" style="animation-delay:${i * 60}ms">
      <title>${escapeHTML(name)}: ${formatMoney(amount)} (${pct.toFixed(1)}%)</title></circle>`;
  });

  el.donut.innerHTML =
    '<circle class="donut-track" cx="21" cy="21" r="15.9155"></circle>' + segments.join('');

  el.categoryList.innerHTML = rows
    .map(([name, amount], i) => {
      const pct = (amount / total) * 100;
      const meta = categoryMeta(name);
      return `
        <li class="legend-item" data-index="${i}" style="--c:${meta.color}">
          <span class="legend-icon" aria-hidden="true">${meta.icon}</span>
          <div>
            <div class="legend-top">
              <span class="legend-name">${escapeHTML(name)}</span>
              <span class="legend-amount">${formatMoney(amount)}</span>
            </div>
            <div class="legend-bar"><span style="width:${pct.toFixed(2)}%; animation-delay:${i * 60}ms"></span></div>
          </div>
          <span class="legend-pct">${pct.toFixed(0)}%</span>
        </li>`;
    })
    .join('');
}

function setActiveSegment(index) {
  el.breakdown.classList.toggle('has-active', index !== null);
  el.donut.querySelectorAll('.donut-seg').forEach((seg) =>
    seg.classList.toggle('is-active', seg.dataset.index === index)
  );
  el.categoryList.querySelectorAll('.legend-item').forEach((li) =>
    li.classList.toggle('is-active', li.dataset.index === index)
  );
}

function transactionHTML(t) {
  const meta = categoryMeta(t.category);
  const sign = t.type === 'income' ? '+' : '−';
  const classes = ['tx-item', t.type];
  if (t.id === lastAddedId) classes.push('is-new');
  if (t.id === editingId) classes.push('is-editing');

  const title = t.description || t.category;
  const subtitle = t.description ? escapeHTML(t.category) : '';

  return `
    <li class="${classes.join(' ')}" data-id="${escapeHTML(t.id)}" style="--c:${meta.color}">
      <span class="tx-icon" aria-hidden="true">${meta.icon}</span>
      <div class="tx-info">
        <p class="tx-title">${escapeHTML(title)}</p>
        <p class="tx-meta"><span class="tx-type">${t.type}</span>${subtitle}</p>
      </div>
      <div class="tx-right">
        <span class="tx-amount">${sign}${formatMoney(t.amount)}</span>
        <div class="tx-actions">
          <button type="button" class="icon-btn" data-action="edit" aria-label="Edit ${escapeHTML(title)}" title="Edit">${ICONS.edit}</button>
          <button type="button" class="icon-btn delete" data-action="delete" aria-label="Delete ${escapeHTML(title)}" title="Delete">${ICONS.trash}</button>
        </div>
      </div>
    </li>`;
}

function renderTransactions(monthTx) {
  const query = el.searchInput.value.trim().toLowerCase();
  const type = getFilterType();
  const category = el.filterCategory.value;
  const filtersActive = Boolean(query) || type !== 'all' || category !== 'all';

  const filtered = monthTx
    .filter((t) => type === 'all' || t.type === type)
    .filter((t) => category === 'all' || t.category === category)
    .filter((t) =>
      !query ||
      t.description.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query) ||
      String(t.amount).includes(query)
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  el.txCount.textContent = filtered.length;
  el.clearFiltersBtn.classList.toggle('hidden', !filtersActive);

  const hasItems = filtered.length > 0;
  el.txEmpty.classList.toggle('hidden', hasItems);
  if (!hasItems) {
    if (monthTx.length) {
      el.txEmptyTitle.textContent = 'No matching transactions';
      el.txEmptyText.textContent = 'Try a different search term or clear your filters.';
    } else {
      el.txEmptyTitle.textContent = 'No transactions yet';
      el.txEmptyText.textContent = `Nothing recorded for ${monthLabel(viewMonth)}. Add your first one to get started.`;
    }
  }

  // Group by date
  const groups = new Map();
  filtered.forEach((t) => {
    if (!groups.has(t.date)) groups.set(t.date, []);
    groups.get(t.date).push(t);
  });

  el.txList.innerHTML = [...groups]
    .map(([date, items]) => {
      const net = round2(items.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0));
      const netClass = net > 0 ? 'is-positive' : net < 0 ? 'is-negative' : '';
      const netText = `${net > 0 ? '+' : net < 0 ? '−' : ''}${formatMoney(Math.abs(net))}`;
      return `
        <section class="tx-group">
          <header class="tx-group-head"><span>${dayLabel(date)}</span><span class="${netClass}">${netText}</span></header>
          <ul class="tx-list">${items.map(transactionHTML).join('')}</ul>
        </section>`;
    })
    .join('');
}

/* =============================================================
   Category inputs
   ============================================================= */
function renderCategoryChips(type, selected = '') {
  const list = CATEGORIES[type];
  const active = list.some((c) => c.name === selected) ? selected : list[0].name;

  el.categoryChips.innerHTML = list
    .map((c) => `
      <label class="chip">
        <input type="radio" name="category" value="${escapeHTML(c.name)}" ${c.name === active ? 'checked' : ''}>
        <span><span aria-hidden="true">${c.icon}</span>${escapeHTML(c.name)}</span>
      </label>`)
    .join('');
}

function populateFilterCategories() {
  const previous = el.filterCategory.value || 'all';
  const type = getFilterType();
  const list = type === 'all' ? [...CATEGORIES.expense, ...CATEGORIES.income] : CATEGORIES[type];

  el.filterCategory.innerHTML =
    '<option value="all">All categories</option>' +
    list.map((c) => `<option value="${escapeHTML(c.name)}">${c.icon} ${escapeHTML(c.name)}</option>`).join('');

  el.filterCategory.value = list.some((c) => c.name === previous) ? previous : 'all';
}

/* =============================================================
   Budget
   ============================================================= */
function saveBudget(value) {
  if (value === 0) delete state.budgets[viewMonth];
  else state.budgets[viewMonth] = round2(value);
  saveState();
  render();
}

function handleBudgetSubmit(event) {
  event.preventDefault();
  const value = parseFloat(el.budgetInput.value);

  if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) {
    el.budgetInput.classList.add('is-invalid');
    restartAnimation(el.budgetForm, 'shake');
    showToast('Please enter a valid budget amount.', 'error');
    return;
  }

  el.budgetInput.classList.remove('is-invalid');
  el.budgetInput.blur();
  saveBudget(value);
  showToast(value === 0
    ? `Budget removed for ${monthLabel(viewMonth)}.`
    : `Budget saved for ${monthLabel(viewMonth)}.`);
}

/* =============================================================
   Transactions
   ============================================================= */
function updateSubmitLabel() {
  if (editingId) {
    el.submitLabel.textContent = 'Save changes';
  } else {
    el.submitLabel.textContent = getSelectedType() === 'income' ? 'Add income' : 'Add expense';
  }
}

function defaultDateForMonth() {
  const today = todayISO();
  return today.startsWith(viewMonth) ? today : `${viewMonth}-01`;
}

function clearFieldErrors() {
  [el.amountInput, el.dateInput].forEach((f) => f.classList.remove('is-invalid'));
  el.formError.textContent = '';
}

function validateTransaction() {
  clearFieldErrors();
  const errors = [];
  const amount = parseFloat(el.amountInput.value);

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push('Enter an amount greater than zero.');
    el.amountInput.classList.add('is-invalid');
  } else if (amount > MAX_AMOUNT) {
    errors.push('That amount is too large.');
    el.amountInput.classList.add('is-invalid');
  }

  if (!getSelectedCategory()) errors.push('Choose a category.');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(el.dateInput.value)) {
    errors.push('Pick a valid date.');
    el.dateInput.classList.add('is-invalid');
  }

  el.formError.textContent = errors.join(' ');
  return errors.length === 0;
}

function handleTransactionSubmit(event) {
  event.preventDefault();

  if (!validateTransaction()) {
    restartAnimation(el.txFormCard, 'shake');
    const firstInvalid = el.txForm.querySelector('.is-invalid');
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  const data = {
    type: getSelectedType(),
    amount: round2(parseFloat(el.amountInput.value)),
    category: getSelectedCategory(),
    description: el.descInput.value.trim().slice(0, 60),
    date: el.dateInput.value
  };
  const targetMonth = data.date.slice(0, 7);
  const otherMonth = targetMonth !== viewMonth;

  if (editingId) {
    const tx = state.transactions.find((t) => t.id === editingId);
    if (tx) Object.assign(tx, data);
    lastAddedId = editingId;
    showToast(otherMonth ? `Updated and moved to ${monthLabel(targetMonth)}.` : 'Transaction updated.');
  } else {
    const id = generateId();
    state.transactions.push({ id, createdAt: Date.now(), ...data });
    lastAddedId = id;
    showToast(otherMonth
      ? `Added to ${monthLabel(targetMonth)}.`
      : `${data.type === 'income' ? 'Income' : 'Expense'} of ${formatMoney(data.amount)} added.`,
      otherMonth ? 'info' : 'success');
  }

  saveState();
  resetTransactionForm();
  render();
  lastAddedId = null;
}

function resetTransactionForm() {
  editingId = null;
  el.txForm.reset();
  setSelectedType('expense');
  renderCategoryChips('expense');
  el.dateInput.value = defaultDateForMonth();
  clearFieldErrors();

  el.formTitle.textContent = 'Add transaction';
  el.formSub.textContent = 'Record income or an expense';
  el.cancelEditBtn.classList.add('hidden');
  el.txFormCard.classList.remove('is-editing');
  updateSubmitLabel();
}

function startEdit(id) {
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx) return;

  editingId = id;
  clearFieldErrors();
  setSelectedType(tx.type);
  renderCategoryChips(tx.type, tx.category);
  el.amountInput.value = tx.amount;
  el.descInput.value = tx.description;
  el.dateInput.value = tx.date;

  el.formTitle.textContent = 'Edit transaction';
  el.formSub.textContent = 'Update the details and save';
  el.cancelEditBtn.classList.remove('hidden');
  el.txFormCard.classList.add('is-editing');
  updateSubmitLabel();
  render();

  focusForm();
}

function cancelEdit() {
  resetTransactionForm();
  render();
}

async function deleteTransaction(id) {
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx) return;

  const ok = await confirmDialog({
    title: 'Delete transaction?',
    message: `"${tx.description || tx.category}" (${formatMoney(tx.amount)}) will be permanently removed.`,
    confirmText: 'Delete'
  });
  if (!ok) return;

  const finish = () => {
    state.transactions = state.transactions.filter((t) => t.id !== id);
    if (editingId === id) resetTransactionForm();
    saveState();
    render();
    showToast('Transaction deleted.');
  };

  const node = el.txList.querySelector(`[data-id="${cssEscape(id)}"]`);
  if (node && !reduceMotion.matches) {
    node.classList.add('is-removing');
    setTimeout(finish, 280);
  } else {
    finish();
  }
}

function handleListClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = button.closest('.tx-item');
  if (!item) return;

  const id = item.dataset.id;
  if (button.dataset.action === 'edit') startEdit(id);
  if (button.dataset.action === 'delete') deleteTransaction(id);
}

function clearFilters() {
  el.searchInput.value = '';
  $('filterAll').checked = true;
  populateFilterCategories();
  el.filterCategory.value = 'all';
  render();
}

/* =============================================================
   Month navigation, theme, export, reset
   ============================================================= */
function changeMonth(delta) {
  viewMonth = delta === 0 ? todayMonth() : shiftMonthKey(viewMonth, delta);
  if (!editingId) el.dateInput.value = defaultDateForMonth();
  restartAnimation(el.monthLabelBtn, 'is-flip');
  render();
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  el.themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#070a14' : '#f5f6fb');
}

function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
}

function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // prevent spreadsheet formula injection
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCSV() {
  if (!state.transactions.length) {
    showToast('No transactions to export yet.', 'info');
    return;
  }

  const header = ['Date', 'Type', 'Category', 'Description', 'Amount (INR)'];
  const rows = [...state.transactions]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .map((t) => [t.date, t.type, t.category, t.description, t.amount.toFixed(2)]);

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `budget-transactions-${todayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  showToast(`Exported ${pluralize(rows.length, 'transaction', 'transactions')}.`);
}

async function handleReset() {
  const ok = await confirmDialog({
    title: 'Reset all data?',
    message: 'All budgets and transactions for every month will be permanently deleted. This cannot be undone.',
    confirmText: 'Delete everything'
  });
  if (!ok) return;

  state = { budgets: {}, transactions: [] };
  saveState();
  resetTransactionForm();
  clearFilters();
  showToast('All data has been cleared.');
}

function focusForm() {
  el.txFormCard.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
  setTimeout(() => el.amountInput.focus({ preventScroll: true }), 350);
}

/* =============================================================
   Init
   ============================================================= */
function bindEvents() {
  // Month navigation
  el.prevMonthBtn.addEventListener('click', () => changeMonth(-1));
  el.nextMonthBtn.addEventListener('click', () => changeMonth(1));
  el.monthLabelBtn.addEventListener('click', () => changeMonth(0));

  // Header actions
  el.themeToggle.addEventListener('click', toggleTheme);
  el.exportBtn.addEventListener('click', exportCSV);
  el.resetBtn.addEventListener('click', handleReset);

  // Budget
  el.budgetForm.addEventListener('submit', handleBudgetSubmit);
  el.budgetInput.addEventListener('input', () => el.budgetInput.classList.remove('is-invalid'));
  el.copyBudgetBtn.addEventListener('click', () => {
    const amount = Number(el.copyBudgetBtn.dataset.amount);
    if (amount > 0) {
      saveBudget(amount);
      showToast(`Budget of ${formatMoney(amount)} set for ${monthLabel(viewMonth)}.`);
    }
  });

  // Transaction form
  el.txForm.addEventListener('submit', handleTransactionSubmit);
  el.cancelEditBtn.addEventListener('click', cancelEdit);
  el.txForm.querySelectorAll('input[name="type"]').forEach((radio) =>
    radio.addEventListener('change', () => {
      renderCategoryChips(getSelectedType());
      updateSubmitLabel();
    })
  );
  el.amountInput.addEventListener('input', () => el.amountInput.classList.remove('is-invalid'));
  el.dateInput.addEventListener('input', () => el.dateInput.classList.remove('is-invalid'));

  // List & filters
  el.txList.addEventListener('click', handleListClick);
  el.searchInput.addEventListener('input', render);
  document.querySelectorAll('input[name="filterType"]').forEach((radio) =>
    radio.addEventListener('change', () => {
      populateFilterCategories();
      render();
    })
  );
  el.filterCategory.addEventListener('change', render);
  el.clearFiltersBtn.addEventListener('click', clearFilters);

  // Donut / legend highlighting
  const highlight = (e) => {
    const item = e.target.closest('[data-index]');
    setActiveSegment(item ? item.dataset.index : null);
  };
  el.categoryList.addEventListener('mouseover', highlight);
  el.donut.addEventListener('mouseover', highlight);
  el.breakdown.addEventListener('mouseleave', () => setActiveSegment(null));

  // Mobile floating button
  el.fabBtn.addEventListener('click', focusForm);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      ([entry]) => el.fabBtn.classList.toggle('is-hidden', entry.isIntersecting),
      { threshold: 0.25 }
    );
    observer.observe(el.txFormCard);
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (el.modal.classList.contains('is-open')) return;

    if (e.key === 'Escape' && editingId) {
      cancelEdit();
      return;
    }

    const target = e.target;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === '/') {
      e.preventDefault();
      el.searchInput.focus();
    } else if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      focusForm();
    } else if (e.key === 'ArrowLeft') {
      changeMonth(-1);
    } else if (e.key === 'ArrowRight') {
      changeMonth(1);
    }
  });

  // Keep multiple open tabs in sync
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      state = loadState();
      if (editingId && !state.transactions.some((t) => t.id === editingId)) resetTransactionForm();
      render();
    }
  });
}

function init() {
  applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
  renderCategoryChips('expense');
  populateFilterCategories();
  el.dateInput.value = defaultDateForMonth();
  updateSubmitLabel();
  bindEvents();
  render();
}

document.addEventListener('DOMContentLoaded', init);