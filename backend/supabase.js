(() => {
  const SUPABASE_URL = "https://dhplzdnnjulqkvkprwxq.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_8QpbPs6VEpP3_fkRSZnDWg_jq2hA6yo";
  const hasValidProjectUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL.trim());
  const supabaseKey = SUPABASE_ANON_KEY.trim();
  const hasValidKey =
    /^sb_publishable_[a-zA-Z0-9_-]+$/.test(supabaseKey) ||
    /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(supabaseKey);
  const createClient = window.supabase?.createClient;
  const isSupabaseConfigured = hasValidProjectUrl && hasValidKey && typeof createClient === "function";

  window.AkunEventSupabase = {
    isSupabaseConfigured,
    supabase: isSupabaseConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null,
    configurationMessage: !hasValidProjectUrl || !hasValidKey
      ? "Periksa URL proyek dan publishable/anon key di backend/supabase.js."
      : "SDK Supabase tidak termuat. Periksa koneksi internet atau akses CDN.",
  };
})();
