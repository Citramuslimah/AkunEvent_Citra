import { supabase } from "../supabase.js";

export async function getProducts() {
  if (!supabase) {
    throw new Error("Konfigurasi Supabase belum diisi.");
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, unit, categories(name), suppliers(name)")
    .order("name");

  if (error) {
    throw error;
  }

  return data;
}
