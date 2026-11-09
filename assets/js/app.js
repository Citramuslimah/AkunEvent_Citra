import { isSupabaseConfigured } from "./supabase.js";
import { getProducts } from "./services/inventory-service.js";

const statusElement = document.querySelector("#connection-status");
const rowsElement = document.querySelector("#inventory-rows");

function renderProducts(products) {
  rowsElement.replaceChildren();

  if (products.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "Belum ada data barang.";
    row.append(cell);
    rowsElement.append(row);
    return;
  }

  for (const product of products) {
    const row = document.createElement("tr");
    const values = [
      product.name,
      product.categories?.name ?? "-",
      product.suppliers?.name ?? "-",
      "-",
      product.unit,
    ];

    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }

    rowsElement.append(row);
  }

  document.querySelector("#total-products").textContent = products.length;
}

if (isSupabaseConfigured) {
  statusElement.textContent = "Supabase dikonfigurasi";
  getProducts()
    .then(renderProducts)
    .catch((error) => {
      statusElement.textContent = "Gagal memuat data Supabase";
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = error.message;
      row.append(cell);
      rowsElement.replaceChildren(row);
    });
}
