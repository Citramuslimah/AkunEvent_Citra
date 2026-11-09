(() => {
const { isSupabaseConfigured } = window.AkunEventSupabase ?? {};
const auth = window.AkunEventAuth;
const api = window.AkunEventTransactions;

const $ = (selector) => document.querySelector(selector);
const pages = [...document.querySelectorAll(".view-page")];
const navLinks = [...document.querySelectorAll("[data-view]")];
const noticeElement = $("#app-notice");
const statusElement = $("#connection-status");
const roleElement = $("#user-role");
const signoutButton = $("#signout-button");
const eventForm = $("#event-form");
const incomeForm = $("#income-form");
const fundingForm = $("#funding-form");
const expenseForm = $("#expense-form");
const dataForms = [eventForm, incomeForm, fundingForm, expenseForm];

let events = [];
let categories = [];
let transactions = [];
let currentRole = null;

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const compactRupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", notation: "compact", maximumFractionDigits: 2 });

const isAdmin = () => (currentRole ?? localStorage.getItem("role")) === "admin";
const sum = (records, pick = (item) => Number(item.amount)) => records.reduce((total, item) => total + pick(item), 0);
const signedIncome = (item) => (item.payment_type === "refund" ? -Number(item.amount) : Number(item.amount));
const byType = (type) => transactions.filter((item) => item.transaction_type === type);

function typeLabel(item) {
  if (item.transaction_type === "pendanaan") return "Pendanaan";
  if (item.transaction_type === "pengeluaran") return "Pengeluaran";
  return (item.payment_type ?? "Pendapatan").toUpperCase();
}

function showNotice(message, isError = false) {
  noticeElement.textContent = message;
  noticeElement.classList.toggle("is-error", isError);
  noticeElement.hidden = !message;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function setAmount(id, amount) {
  const element = $(`#${id}`);
  element.textContent = compactRupiah.format(amount);
  element.title = rupiah.format(amount);
  element.setAttribute("aria-label", rupiah.format(amount));
}

function setTodayDefaults() {
  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  for (const input of document.querySelectorAll('input[name="transaction_date"]')) {
    if (!input.value) input.value = today;
  }
}

function cell(value, { numeric = false } = {}) {
  const element = document.createElement("td");
  element.textContent = numeric ? rupiah.format(value) : (value ?? "-");
  if (numeric) element.className = "numeric";
  return element;
}

function actionCell(type, id) {
  const element = document.createElement("td");
  element.className = "row-actions";
  for (const [action, label] of [["edit", "Edit"], ["delete", "Hapus"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = action === "delete" ? "row-action is-danger" : "row-action";
    button.dataset.adminAction = action;
    button.dataset.recordType = type;
    button.dataset.recordId = String(id);
    button.textContent = label;
    element.append(button);
  }
  return element;
}

function renderTable(tbodySelector, records, columns, emptyMessage, buildCells, recordType = null) {
  const tbody = $(tbodySelector);
  const showActions = Boolean(recordType) && isAdmin();
  if (records.length === 0) {
    const row = document.createElement("tr");
    const empty = document.createElement("td");
    empty.colSpan = columns + (showActions ? 1 : 0);
    empty.className = "empty-state";
    empty.textContent = emptyMessage;
    row.append(empty);
    tbody.replaceChildren(row);
    return;
  }
  tbody.replaceChildren(...records.map((record) => {
    const row = document.createElement("tr");
    row.append(...buildCells(record));
    if (showActions) row.append(actionCell(recordType, record.id));
    return row;
  }));
}

function applyRoleVisibility() {
  const admin = isAdmin();
  for (const element of document.querySelectorAll(".admin-only")) element.hidden = !admin;
  const role = currentRole ?? localStorage.getItem("role");
  roleElement.hidden = !role;
  roleElement.textContent = role ? role.toUpperCase() : "";
}

function navigate(view) {
  if (!pages.some((page) => page.id === `view-${view}`)) view = "dashboard";
  for (const page of pages) page.hidden = page.id !== `view-${view}`;
  for (const link of navLinks) {
    const active = link.dataset.view === view;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  $("#breadcrumb").textContent = navLinks.find((link) => link.dataset.view === view)?.textContent ?? "Dashboard";
}

function renderCashflowChart() {
  const chart = $("#cashflow-chart");
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, date, funding: 0, income: 0, expense: 0 };
  });
  const byKey = new Map(months.map((month) => [month.key, month]));
  for (const item of transactions) {
    const month = byKey.get(item.transaction_date?.slice(0, 7));
    if (!month) continue;
    if (item.transaction_type === "pendanaan") month.funding += Number(item.amount);
    else if (item.transaction_type === "pengeluaran") month.expense += Number(item.amount);
    else month.income += signedIncome(item);
  }

  const maximum = Math.max(0, ...months.flatMap((month) => [month.funding, Math.abs(month.income), month.expense]));
  const monthName = new Intl.DateTimeFormat("id-ID", { month: "short" });
  const periodName = new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric" });
  chart.replaceChildren(...months.map((month) => {
    const column = document.createElement("div");
    column.className = "cashflow-month";
    const bars = document.createElement("div");
    bars.className = "cashflow-bars";
    for (const series of [
      { name: "Pendanaan", value: month.funding, className: "funding-bar" },
      { name: "Pendapatan bersih", value: month.income, className: month.income < 0 ? "income-bar is-negative" : "income-bar" },
      { name: "Pengeluaran", value: month.expense, className: "expense-bar" },
    ]) {
      const bar = document.createElement("span");
      const height = maximum > 0 && series.value !== 0 ? Math.max(4, (Math.abs(series.value) / maximum) * 100) : 0;
      bar.className = `cashflow-bar ${series.className}`;
      bar.style.height = `${height}%`;
      bar.title = `${series.name} ${monthName.format(month.date)}: ${rupiah.format(series.value)}`;
      bars.append(bar);
    }
    const label = document.createElement("span");
    label.className = "cashflow-month-label";
    label.textContent = monthName.format(month.date);
    column.append(bars, label);
    return column;
  }));

  const funding = sum(months, (month) => month.funding);
  const income = sum(months, (month) => month.income);
  const expense = sum(months, (month) => month.expense);
  $("#cashflow-period").textContent = `${periodName.format(months[0].date)} - ${periodName.format(months[5].date)}`;
  setAmount("cashflow-funding-total", funding);
  setAmount("cashflow-income-total", income);
  setAmount("cashflow-expense-total", expense);
  chart.setAttribute("aria-label", `Grafik enam bulan. Pendanaan ${rupiah.format(funding)}, pendapatan bersih ${rupiah.format(income)}, pengeluaran ${rupiah.format(expense)}.`);
}

function renderAgenda() {
  const agenda = $("#agenda-events");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = events
    .filter((event) => new Date(`${event.event_date}T00:00:00`) >= today)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
  const shown = upcoming.length ? upcoming.slice(0, 4) : [...events].sort((a, b) => b.event_date.localeCompare(a.event_date)).slice(0, 4);
  $("#agenda-description").textContent = upcoming.length ? "Kegiatan yang perlu dipantau" : "Acara terakhir yang tercatat";

  if (!shown.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Belum ada acara.";
    agenda.replaceChildren(empty);
    return;
  }

  const monthName = new Intl.DateTimeFormat("id-ID", { month: "short" });
  agenda.replaceChildren(...shown.map((event) => {
    const date = new Date(`${event.event_date}T00:00:00`);
    const item = document.createElement("article");
    item.className = "agenda-item";

    const badge = document.createElement("div");
    badge.className = "agenda-date";
    const day = document.createElement("strong");
    day.textContent = String(date.getDate());
    const month = document.createElement("span");
    month.textContent = monthName.format(date).replace(".", "").toUpperCase();
    badge.append(day, month);

    const details = document.createElement("div");
    details.className = "agenda-details";
    const name = document.createElement("strong");
    name.textContent = event.name;
    const client = document.createElement("span");
    client.textContent = event.client_name;
    details.append(name, client);

    const status = document.createElement("span");
    status.className = upcoming.length ? "agenda-status" : "agenda-status is-complete";
    status.textContent = upcoming.length ? "Akan datang" : "Selesai";
    item.append(badge, details, status);
    return item;
  }));
}

function fillSelect(select, placeholder, options) {
  const selected = select.value;
  select.replaceChildren(new Option(placeholder, ""), ...options.map(([label, value]) => new Option(label, value)));
  if ([...select.options].some((option) => option.value === selected)) select.value = selected;
}

function populateRefundOptions() {
  const eventId = Number(incomeForm.elements.event_id.value);
  const refunded = new Map();
  for (const item of transactions) {
    if (item.payment_type === "refund" && item.related_transaction_id) {
      refunded.set(item.related_transaction_id, (refunded.get(item.related_transaction_id) ?? 0) + Number(item.amount));
    }
  }
  const options = transactions
    .filter((item) => item.transaction_type === "pendapatan" && ["dp", "pelunasan"].includes(item.payment_type) && item.event_id === eventId)
    .map((item) => [item, Number(item.amount) - (refunded.get(item.id) ?? 0)])
    .filter(([, remaining]) => remaining > 0)
    .map(([item, remaining]) => [`${item.payment_type.toUpperCase()} | ${item.description} | sisa ${rupiah.format(remaining)}`, item.id]);
  fillSelect($("#refund-source"), eventId ? "Pilih transaksi asal" : "Pilih acara terlebih dahulu", options);
}

function renderData() {
  const funding = byType("pendanaan");
  const income = byType("pendapatan");
  const expense = byType("pengeluaran");
  const creator = (record) => record.created_by_user?.email ?? "-";

  renderTable("#events-rows", events, 5, "Belum ada acara.", (event) => [
    cell(event.name), cell(event.categories?.name), cell(event.client_name), cell(formatDate(event.event_date)), cell(creator(event)),
  ], "event");
  renderTable("#income-rows", income, 6, "Belum ada pendapatan.", (item) => [
    cell(formatDate(item.transaction_date)), cell(item.events?.name), cell(typeLabel(item)), cell(item.description),
    cell(Number(item.amount), { numeric: true }), cell(creator(item)),
  ], "transaction");
  renderTable("#funding-rows", funding, 5, "Belum ada pendanaan.", (item) => [
    cell(formatDate(item.transaction_date)), cell(item.events?.name), cell(item.description),
    cell(Number(item.amount), { numeric: true }), cell(creator(item)),
  ], "transaction");
  renderTable("#expense-rows", expense, 5, "Belum ada pengeluaran.", (item) => [
    cell(formatDate(item.transaction_date)), cell(item.events?.name), cell(item.description),
    cell(Number(item.amount), { numeric: true }), cell(creator(item)),
  ], "transaction");
  renderTable("#recent-transactions", transactions.slice(0, 8), 5, "Belum ada transaksi.", (item) => [
    cell(formatDate(item.transaction_date)), cell(item.events?.name), cell(typeLabel(item)), cell(item.description),
    cell(Number(item.amount), { numeric: true }),
  ]);

  const fundingTotal = sum(funding);
  const netIncome = sum(income, signedIncome);
  const expenseTotal = sum(expense);
  const refundOf = (item) => transactions.find((candidate) => candidate.id === item.related_transaction_id);
  const serviceIncome = sum(income, (item) => {
    if (item.payment_type === "pelunasan") return Number(item.amount);
    if (item.payment_type === "refund" && refundOf(item)?.payment_type === "pelunasan") return -Number(item.amount);
    return 0;
  });

  setAmount("metric-funding", fundingTotal);
  setAmount("metric-income", serviceIncome);
  setAmount("metric-expense", expenseTotal);
  setAmount("metric-cash", fundingTotal + netIncome - expenseTotal);
  $("#funding-total").textContent = rupiah.format(fundingTotal);
  $("#income-total").textContent = rupiah.format(netIncome);
  $("#expense-total").textContent = rupiah.format(expenseTotal);
  $("#metric-events").textContent = String(events.length);
  $("#metric-categories").textContent = String(categories.length);

  renderCashflowChart();
  renderAgenda();
  for (const select of document.querySelectorAll("[data-event-options]")) {
    fillSelect(select, "Pilih acara", events.map((event) => [`${event.name} - ${event.client_name}`, event.id]));
  }
  fillSelect($("#event-category"), "Pilih kategori", categories.map((category) => [category.name, category.id]));
  populateRefundOptions();
  applyRoleVisibility();
}

async function loadData() {
  [events, categories, transactions] = await Promise.all([api.listEvents(), api.listCategories(), api.list()]);
  renderData();
}

function clearData() {
  events = [];
  categories = [];
  transactions = [];
  renderData();
}

function resetRefundField() {
  $("#refund-source-field").hidden = true;
  $("#refund-source").required = false;
}

function setFormsEnabled(enabled) {
  for (const form of dataForms) for (const control of form.elements) control.disabled = !enabled;
}

async function submitForm(event, action, successMessage) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form?.querySelector("[type=submit]");
  if (!form || !submit) {
    showNotice("Form tidak ditemukan. Muat ulang halaman lalu coba kembali.", true);
    return;
  }
  submit.disabled = true;
  try {
    await action(new FormData(form));
    form.reset();
    if (form === incomeForm) resetRefundField();
    setTodayDefaults();
    showNotice(successMessage);
    await loadData();
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    submit.disabled = false;
  }
}

const transactionAction = (type, data) => api.insert({
  event_id: data.get("event_id"),
  transaction_type: type,
  description: data.get("description"),
  amount: data.get("amount"),
  payment_type: type === "pendapatan" ? data.get("payment_type") : null,
  account_category: type === "pengeluaran" ? data.get("account_category") : null,
  related_transaction_id: data.get("related_transaction_id"),
  transaction_date: data.get("transaction_date"),
});

async function handleAdminAction(button) {
  if (!isAdmin()) {
    showNotice("Aksi ini hanya tersedia untuk admin.", true);
    return;
  }
  const { adminAction, recordType, recordId } = button.dataset;
  const id = Number(recordId);
  const record = (recordType === "event" ? events : transactions).find((item) => item.id === id);
  if (!record) return;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  try {
    if (adminAction === "delete") {
      const label = recordType === "event" ? "acara beserta seluruh transaksinya" : "transaksi";
      if (!window.confirm(`Hapus ${label}? Tindakan ini tidak dapat dibatalkan.`)) return;
      if (recordType === "event") await api.removeEvent(id);
      else await api.remove(id);
    } else if (recordType === "event") {
      const name = window.prompt("Nama acara", record.name);
      if (name === null) return;
      const clientName = window.prompt("Nama klien", record.client_name);
      if (clientName === null) return;
      const eventDate = window.prompt("Tanggal acara (YYYY-MM-DD)", record.event_date);
      if (eventDate === null) return;
      if (!name.trim() || !clientName.trim() || !datePattern.test(eventDate)) throw new Error("Nama, klien, dan tanggal (YYYY-MM-DD) wajib valid.");
      await api.updateEvent(id, { name, client_name: clientName, event_date: eventDate });
    } else {
      const description = window.prompt("Uraian transaksi", record.description);
      if (description === null) return;
      const amount = window.prompt("Nominal", String(record.amount));
      if (amount === null) return;
      const date = window.prompt("Tanggal transaksi (YYYY-MM-DD)", record.transaction_date);
      if (date === null) return;
      if (!description.trim() || !datePattern.test(date)) throw new Error("Uraian dan tanggal (YYYY-MM-DD) wajib valid.");
      await api.update(id, { description, amount, transaction_date: date });
    }
    showNotice("Perubahan berhasil disimpan.");
    await loadData();
  } catch (error) {
    showNotice(error.message, true);
  }
}

for (const link of document.querySelectorAll("[data-go]")) {
  link.addEventListener("click", () => { window.location.hash = link.dataset.go; });
}
window.addEventListener("hashchange", () => navigate(window.location.hash.slice(1)));
navigate(window.location.hash.slice(1));

eventForm.addEventListener("submit", (event) => submitForm(event, (data) => api.insertEvent({
  category_id: data.get("category_id"),
  name: data.get("name"),
  client_name: data.get("client_name"),
  event_date: data.get("event_date"),
}), "Acara berhasil disimpan."));
incomeForm.addEventListener("submit", (event) => submitForm(event, (data) => transactionAction("pendapatan", data), "Transaksi pendapatan berhasil disimpan."));
fundingForm.addEventListener("submit", (event) => submitForm(event, (data) => transactionAction("pendanaan", data), "Pendanaan berhasil disimpan."));
expenseForm.addEventListener("submit", (event) => submitForm(event, (data) => transactionAction("pengeluaran", data), "Pengeluaran berhasil disimpan."));

$("#payment-type").addEventListener("change", (event) => {
  const isRefund = event.target.value === "refund";
  $("#refund-source-field").hidden = !isRefund;
  $("#refund-source").required = isRefund;
  populateRefundOptions();
});
incomeForm.elements.event_id.addEventListener("change", populateRefundOptions);

signoutButton.addEventListener("click", async () => {
  try { await auth.signOut(); } catch (error) { showNotice(error.message, true); }
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-admin-action]");
  if (button) handleAdminAction(button);
});

async function handleAuthState({ user, role, error }) {
  currentRole = role;
  signoutButton.hidden = !user;
  setFormsEnabled(Boolean(user && role));
  applyRoleVisibility();

  if (error) {
    statusElement.textContent = "Profil pengguna bermasalah";
    showNotice(error.message, true);
    clearData();
    return;
  }
  if (!user || !role) {
    statusElement.textContent = "Mengalihkan ke halaman login";
    clearData();
    return;
  }

  statusElement.textContent = `Terhubung · ${role}`;
  try {
    await loadData();
  } catch (loadError) {
    statusElement.textContent = "Gagal memuat data";
    showNotice(loadError.message, true);
  }
}

setFormsEnabled(false);
setTodayDefaults();
applyRoleVisibility();
if (!auth || !api || !isSupabaseConfigured) {
  statusElement.textContent = "Konfigurasi belum siap";
  showNotice("Periksa backend/supabase.js dan koneksi internet (SDK Supabase dimuat dari CDN).", true);
} else {
  auth.onChange(handleAuthState);
  auth.initialize().catch((error) => {
    statusElement.textContent = "Gagal menginisialisasi";
    showNotice(error.message, true);
  });
}
})();
