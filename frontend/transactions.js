(() => {
  const { supabase } = window.AkunEventSupabase ?? {};
  const auth = window.AkunEventAuth;
  const TRANSACTION_TYPES = ["pendanaan", "pendapatan", "pengeluaran"];
  const EXPENSE_CATEGORIES = ["listrik_air", "operasional", "utang_usaha", "gaji"];

  function toError(error, recordName) {
    if (error?.code === "23503") {
      return new Error(`Tidak dapat menghapus ${recordName} karena masih terikat data lain. Jalankan ulang backend/schema.sql agar relasi ON DELETE CASCADE aktif.`);
    }
    if (error?.code === "42501") {
      return new Error("Akses ditolak oleh kebijakan database (RLS). Periksa role akun Anda.");
    }
    return new Error(error?.message ?? "Operasi database gagal.");
  }

  async function list() {
    const { data, error } = await supabase
      .from("transactions")
      .select("id, event_id, transaction_type, description, amount, payment_type, account_category, related_transaction_id, transaction_date, created_by, events(name), created_by_user:users!transactions_created_by_fkey(email)")
      .order("transaction_date", { ascending: false })
      .order("id", { ascending: false });
    if (error) throw toError(error, "transaksi");
    return data;
  }

  async function insert(values) {
    const user = auth.getUser();
    if (!user) throw new Error("Silakan masuk terlebih dahulu.");

    const eventId = Number(values.event_id);
    const amount = Number(values.amount);
    const description = String(values.description ?? "").trim();
    if (!TRANSACTION_TYPES.includes(values.transaction_type)) throw new Error("Jenis transaksi tidak valid.");
    if (!Number.isInteger(eventId) || eventId <= 0) throw new Error("Pilih acara yang valid.");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Nominal harus berupa angka lebih besar dari nol.");
    if (!description) throw new Error("Uraian wajib diisi.");
    if (!values.transaction_date) throw new Error("Tanggal wajib diisi.");

    const isExpense = values.transaction_type === "pengeluaran";
    if (isExpense && !EXPENSE_CATEGORIES.includes(values.account_category)) throw new Error("Pilih kategori beban.");

    const isRefund = values.payment_type === "refund";
    const relatedId = isRefund ? Number(values.related_transaction_id) : null;
    if (isRefund && (!Number.isInteger(relatedId) || relatedId <= 0)) throw new Error("Pilih transaksi asal untuk refund.");

    const { error } = await supabase.from("transactions").insert({
      event_id: eventId,
      transaction_type: values.transaction_type,
      description,
      amount,
      payment_type: values.transaction_type === "pendapatan" ? values.payment_type : null,
      account_category: isExpense ? values.account_category : null,
      related_transaction_id: relatedId,
      transaction_date: values.transaction_date,
      created_by: user.id,
    });
    if (error) throw toError(error, "transaksi");
  }

  async function update(id, values) {
    if (!auth.isAdmin()) throw new Error("Hanya admin yang dapat mengubah transaksi.");
    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Nominal harus berupa angka lebih besar dari nol.");
    const { error } = await supabase
      .from("transactions")
      .update({ description: String(values.description).trim(), amount, transaction_date: values.transaction_date })
      .eq("id", id);
    if (error) throw toError(error, "transaksi");
  }

  async function remove(id) {
    if (!auth.isAdmin()) throw new Error("Hanya admin yang dapat menghapus transaksi.");
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) throw toError(error, "transaksi");
  }

  async function removeEvent(id) {
    if (!auth.isAdmin()) throw new Error("Hanya admin yang dapat menghapus acara.");
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) throw toError(error, "acara");
  }

  async function listEvents() {
    const { data, error } = await supabase
      .from("events")
      .select("id, category_id, name, client_name, event_date, created_by, categories(name), created_by_user:users!events_created_by_fkey(email)")
      .order("event_date", { ascending: false });
    if (error) throw toError(error, "acara");
    return data;
  }

  async function listCategories() {
    const { data, error } = await supabase.from("categories").select("id, name").order("name");
    if (error) throw toError(error, "kategori");
    return data;
  }

  async function insertEvent(values) {
    const user = auth.getUser();
    if (!user) throw new Error("Silakan masuk terlebih dahulu.");
    const categoryId = Number(values.category_id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) throw new Error("Pilih kategori acara.");
    const { error } = await supabase.from("events").insert({
      category_id: categoryId,
      name: String(values.name).trim(),
      client_name: String(values.client_name).trim(),
      event_date: values.event_date,
      created_by: user.id,
    });
    if (error) throw toError(error, "acara");
  }

  async function updateEvent(id, values) {
    if (!auth.isAdmin()) throw new Error("Hanya admin yang dapat mengubah acara.");
    const { error } = await supabase
      .from("events")
      .update({ name: String(values.name).trim(), client_name: String(values.client_name).trim(), event_date: values.event_date })
      .eq("id", id);
    if (error) throw toError(error, "acara");
  }

  window.AkunEventTransactions = {
    list, insert, update, remove,
    listEvents, listCategories, insertEvent, updateEvent, removeEvent,
  };
})();
