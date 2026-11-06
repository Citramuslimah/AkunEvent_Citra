(() => {
  const { isSupabaseConfigured, supabase, configurationMessage } = window.AkunEventSupabase ?? {};
  const isProtectedPage = document.body.dataset.protectedPage === "true";
  const loginForm = document.querySelector("#login-form");
  const loginNotice = document.querySelector("#login-notice");
  const listeners = new Set();
  let currentUser = null;
  let currentProfile = null;
  let initPromise = null;

  function publish(error = null) {
    const state = { user: currentUser, profile: currentProfile, role: currentProfile?.role ?? null, error };
    for (const listener of listeners) listener(state);
  }

  function resetState() {
    localStorage.removeItem("role");
    currentUser = null;
    currentProfile = null;
  }

  function showLoginNotice(message, isError = false) {
    if (!loginNotice) return;
    loginNotice.textContent = message;
    loginNotice.classList.toggle("is-error", isError);
    loginNotice.hidden = !message;
  }

  async function loadProfile(user) {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("email", user.email)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Profil akun belum ada di tabel users. Jalankan backend/schema.sql di Supabase.");
    if (!["admin", "staff"].includes(data.role)) throw new Error("Role akun tidak valid. Gunakan 'admin' atau 'staff'.");

    currentUser = user;
    currentProfile = data;
    localStorage.setItem("role", data.role);
    return data;
  }

  async function handleSession(session) {
    if (!session?.user) {
      resetState();
      publish();
      if (isProtectedPage) window.location.replace("index.html");
      return;
    }

    try {
      await loadProfile(session.user);
      publish();
      if (!isProtectedPage) window.location.replace("dashboard.html");
    } catch (error) {
      currentUser = session.user;
      currentProfile = null;
      localStorage.removeItem("role");
      publish(error);
      showLoginNotice(error.message, true);
    }
  }

  function initialize() {
    if (!initPromise) {
      initPromise = (async () => {
        if (!isSupabaseConfigured) throw new Error(configurationMessage ?? "Konfigurasi Supabase belum siap.");

        supabase.auth.onAuthStateChange((event, session) => {
          if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
          if (event === "SIGNED_IN" && currentProfile && currentUser?.id === session?.user?.id) return;
          // Hindari await Supabase di dalam callback auth agar tidak deadlock.
          window.setTimeout(() => handleSession(session), 0);
        });

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        await handleSession(data.session);
      })();
    }
    return initPromise;
  }

  async function signIn(email, password) {
    const cleanEmail = String(email).trim().toLowerCase();
    console.log("Mencoba login dengan email:", JSON.stringify(cleanEmail));
    await initialize();
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) throw error;
    showLoginNotice("Berhasil masuk. Memuat profil...");
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    resetState();
    publish();
    window.location.replace("index.html");
  }

  window.AkunEventAuth = {
    initialize,
    signIn,
    signOut,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getUser: () => currentUser,
    getProfile: () => currentProfile,
    getRole: () => currentProfile?.role ?? null,
    isAdmin: () => currentProfile?.role === "admin",
  };

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector("[type=submit]");
      const data = new FormData(form);
      button.disabled = true;
      showLoginNotice("Sedang masuk...");
      try {
        await signIn(String(data.get("email")).trim(), String(data.get("password")));
      } catch (error) {
        showLoginNotice(`Login gagal: ${error.message}`, true);
      } finally {
        button.disabled = false;
      }
    });

    initialize().catch((error) => showLoginNotice(error.message, true));
  }
})();
