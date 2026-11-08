(() => {
  const { isSupabaseConfigured } = window.AkunEventSupabase ?? {};
  const auth = window.AkunEventAuth;
  const api = window.AkunEventTransactions;
  const statusElement = document.querySelector("#connection-status");
  const noticeElement = document.querySelector("#app-notice");
  const roleElement = document.querySelector("#user-role");
  const signoutButton = document.querySelector("#signout-button");
  const rowsElement = document.querySelector("#journal-rows");
  const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
  const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });

  const EXPENSE_ACCOUNTS = {
    listrik_air: "Beban Listrik & Air",
    operasional: "Beban Operasional",
    utang_usaha: "Utang Usaha",
    gaji: "Beban Gaji",
  };

  function showNotice(message, isError = false) {
    noticeElement.textContent = message;
    noticeElement.classList.toggle("is-error", isError);
    noticeElement.hidden = !message;
  }

  function showMessage(message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.className = "empty-state";
    cell.textContent = message;
    row.append(cell);
    rowsElement.replaceChildren(row);
  }

  function accountsFor(transaction, byId) {
    if (transaction.transaction_type === "pendanaan") return ["Kas", "Pendanaan/Modal"];
    if (transaction.transaction_type === "pengeluaran") {
      return [EXPENSE_ACCOUNTS[transaction.account_category] ?? "Beban Operasional", "Kas"];
    }
    if (transaction.payment_type === "dp") return ["Kas", "Pendapatan Diterima Dimuka"];
    if (transaction.payment_type === "pelunasan") return ["Kas", "Pendapatan Jasa"];
    if (transaction.payment_type === "refund") {
      const original = byId.get(transaction.related_transaction_id);
      return [original?.payment_type === "dp" ? "Pendapatan Diterima Dimuka" : "Retur Pendapatan", "Kas"];
    }
    return null;
  }

  function buildEntries(transactions) {
    const byId = new Map(transactions.map((transaction) => [transaction.id, transaction]));
    return transactions.flatMap((transaction) => {
      const accounts = accountsFor(transaction, byId);
      if (!accounts) return [];
      const amount = Number(transaction.amount);
      const common = {
        date: transaction.transaction_date,
        id: transaction.id,
        description: transaction.description,
        createdBy: transaction.created_by_user?.email ?? "-",
      };
      return [
        { ...common, account: accounts[0], debit: amount, credit: 0 },
        { ...common, account: accounts[1], debit: 0, credit: amount },
      ];
    });
  }

  function render(entries) {
    if (entries.length === 0) {
      showMessage("Belum ada transaksi untuk dijurnal.");
    } else {
      rowsElement.replaceChildren(...entries.map((entry) => {
        const row = document.createElement("tr");
        const values = [
          entry.date ? dateFormatter.format(new Date(`${entry.date}T00:00:00`)) : "-",
          `#${entry.id}`,
          entry.description,
          entry.account,
          entry.debit ? rupiah.format(entry.debit) : "-",
          entry.credit ? rupiah.format(entry.credit) : "-",
          entry.createdBy,
        ];
        values.forEach((value, index) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          if (index === 4 || index === 5) cell.className = "numeric";
          row.append(cell);
        });
        return row;
      }));
    }
    document.querySelector("#journal-total-debit").textContent = rupiah.format(entries.reduce((total, entry) => total + entry.debit, 0));
    document.querySelector("#journal-total-credit").textContent = rupiah.format(entries.reduce((total, entry) => total + entry.credit, 0));
  }

  async function handleAuthState({ user, role, error }) {
    signoutButton.hidden = !user;
    roleElement.hidden = !role;
    roleElement.textContent = role ? role.toUpperCase() : "";

    if (error) {
      statusElement.textContent = "Profil pengguna bermasalah";
      showNotice(error.message, true);
      showMessage("Profil pengguna tidak dapat dimuat.");
      return;
    }
    if (!user || !role) {
      statusElement.textContent = "Mengalihkan ke halaman login";
      return;
    }

    statusElement.textContent = `Terhubung · ${role}`;
    try {
      render(buildEntries(await api.list()));
      showNotice("");
    } catch (loadError) {
      statusElement.textContent = "Gagal memuat jurnal";
      showNotice(loadError.message, true);
      showMessage("Jurnal tidak dapat dimuat.");
    }
  }

  signoutButton.addEventListener("click", async () => {
    try { await auth.signOut(); } catch (error) { showNotice(error.message, true); }
  });

  if (!auth || !api || !isSupabaseConfigured) {
    statusElement.textContent = "Konfigurasi belum siap";
    showNotice("Periksa backend/supabase.js dan koneksi internet (SDK Supabase dimuat dari CDN).", true);
    showMessage("Konfigurasi Supabase belum siap.");
  } else {
    auth.onChange(handleAuthState);
    auth.initialize().catch((error) => {
      statusElement.textContent = "Gagal menginisialisasi";
      showNotice(error.message, true);
      showMessage("Jurnal tidak dapat dimuat.");
    });
  }
})();
