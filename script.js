"use strict";

/* =====================================================
   KONFIGURASI UTAMA — ubah identitas login di sini.
   ===================================================== */
const CONFIG = {
  username: "bazar123",
  password: "123",
  namaBazar: "Bear Bites Bazar",
  ucapanStruk: "Terima kasih sudah jajan! Sampai jumpa lagi."
};

const STORAGE_KEY = "kasir_bazar_data_v1";
const SESSION_KEY = "kasir_bazar_login";

const DEFAULT_MENUS = [
  { id: "m1", name: "Putri Ayu", category: "Makanan", price: 3000, stock: null },
  { id: "m2", name: "Nugget Korean Spicy", category: "Makanan", price: 10000, stock: null },
  { id: "m3", name: "Milo Coffee", category: "Minuman", price: 8000, stock: null },
  { id: "m4", name: "Electric Blue Lychee Soda", category: "Minuman", price: 10000, stock: null }
];

const $ = id => document.getElementById(id);
const rupiah = value => "Rp " + Math.round(Number(value) || 0).toLocaleString("id-ID");
const number = value => Math.max(0, Math.round(Number(value) || 0));
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);

function uid(prefix = "id") {
  return prefix + "-" + Date.now().toString(36) +
    "-" + Math.random().toString(36).slice(2, 8);
}

function newData() {
  return {
    settings: {
      name: CONFIG.namaBazar,
      thanks: CONFIG.ucapanStruk
    },
    menus: DEFAULT_MENUS.map(menu => ({ ...menu })),
    capital: [],
    expenses: [],
    transactions: [],
    nextTransaction: 1
  };
}

function normalizeData(raw) {
  const base = newData();
  if (!raw || typeof raw !== "object") return base;

  const result = {
    ...base,
    settings: { ...base.settings, ...(raw.settings || {}) },
    menus: Array.isArray(raw.menus) ? raw.menus : base.menus,
    capital: Array.isArray(raw.capital) ? raw.capital : [],
    expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    nextTransaction: Math.max(1, number(raw.nextTransaction) || 1)
  };

  result.menus = result.menus
    .filter(m => m && m.id && typeof m.name === "string")
    .map(m => ({
      id: String(m.id),
      name: m.name,
      category: m.category === "Minuman" ? "Minuman" : "Makanan",
      price: number(m.price),
      stock: m.stock === null || m.stock === undefined || m.stock === ""
        ? null : number(m.stock)
    }));

  result.capital = result.capital.filter(x => x && x.id);
  result.expenses = result.expenses.filter(x => x && x.id);
  result.transactions = result.transactions.filter(x =>
    x && x.id && Array.isArray(x.items)
  );

  return result;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeData(JSON.parse(raw)) : newData();
  } catch (error) {
    console.error("Data tersimpan tidak dapat dibaca:", error);
    return newData();
  }
}

let data = loadData();
let cart = [];
let lastTransactionId = null;
let toastTimer = null;

/* ---------- Penyimpanan dan utilitas ---------- */

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(error);
    toast("Penyimpanan gagal. Periksa ruang penyimpanan browser.");
    return false;
  }
}

function toast(message) {
  const element = $("toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 3000);
}

function sum(list, selector = item => item.amount) {
  return list.reduce((total, item) => total + number(selector(item)), 0);
}

function capitalTotal() {
  return sum(data.capital);
}

function expenseTotal() {
  return sum(data.expenses);
}

function incomeTotal() {
  return sum(data.transactions, transaction => transaction.total);
}

function grossResult() {
  return incomeTotal() - capitalTotal() - expenseTotal();
}

function menuSold(menuId) {
  return sum(data.transactions, transaction =>
    sum(transaction.items.filter(item => item.menuId === menuId), item => item.qty)
  );
}

function getMenu(menuId) {
  return data.menus.find(menu => menu.id === menuId);
}

function transactionById(id) {
  return data.transactions.find(transaction => transaction.id === id);
}

function formatDate(value) {
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

function safeDownload(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function downloadName(prefix, extension) {
  return prefix + "-" + new Date().toISOString().slice(0, 10) + "." + extension;
}

/* ---------- Login dan sesi ---------- */

function showLogin() {
  $("loginPage").hidden = false;
  $("app").hidden = true;
  $("username").value = "";
  $("password").value = "";
  $("loginError").textContent = "";
}

function showApp() {
  $("loginPage").hidden = true;
  $("app").hidden = false;
  renderAll();
}

$("loginBrand").textContent = CONFIG.namaBazar;

$("loginForm").addEventListener("submit", event => {
  event.preventDefault();

  if (
    $("username").value.trim() === CONFIG.username &&
    $("password").value === CONFIG.password
  ) {
    sessionStorage.setItem(SESSION_KEY, "true");
    $("loginError").textContent = "";
    showApp();
  } else {
    $("loginError").textContent = "Username atau password salah.";
  }
});

$("togglePassword").addEventListener("click", () => {
  const input = $("password");
  input.type = input.type === "password" ? "text" : "password";
  $("togglePassword").textContent =
    input.type === "password" ? "Lihat" : "Sembunyikan";
});

$("logoutBtn").addEventListener("click", () => {
  if (!confirm("Logout dari aplikasi kasir?")) return;
  sessionStorage.removeItem(SESSION_KEY);
  showLogin();
});

/* ---------- Navigasi dan dashboard ---------- */

document.querySelectorAll(".tabs button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach(tab =>
      tab.classList.toggle("active", tab === button)
    );
    document.querySelectorAll(".tab-panel").forEach(panel => {
      panel.hidden = panel.id !== "tab-" + button.dataset.tab;
    });
    renderAll();
  });
});

function statCard(label, value) {
  return `<div class="stat-card">
    <div class="stat-label">${escapeHTML(label)}</div>
    <strong>${escapeHTML(value)}</strong>
  </div>`;
}

function renderDashboard() {
  const best = data.menus
    .map(menu => ({ ...menu, sold: menuSold(menu.id) }))
    .sort((a, b) => b.sold - a.sold)[0];

  const bestText = best && best.sold > 0
    ? `${best.name} (${best.sold})`
    : "Belum ada penjualan";

  $("dashboard").innerHTML = [
    statCard("Modal awal", rupiah(capitalTotal())),
    statCard("Pemasukan", rupiah(incomeTotal())),
    statCard("Laba / rugi", rupiah(grossResult())),
    statCard("Jumlah transaksi", String(data.transactions.length)),
    statCard("Menu terlaris", bestText)
  ].join("");

  $("currentDate").textContent = new Date().toLocaleDateString("id-ID", {
    weekday: "short", day: "numeric", month: "short", year: "numeric"
  });

  $("brandName").textContent = data.settings.name;
  $("loginBrand").textContent = data.settings.name;
  document.title = "Kasir - " + data.settings.name;
}

/* ---------- Kasir dan keranjang ---------- */

function cartTotal() {
  return sum(cart, item => item.price * item.qty);
}

function addToCart(menuId) {
  const menu = getMenu(menuId);
  if (!menu) return;

  const currentQty = cart.find(item => item.menuId === menuId)?.qty || 0;
  if (menu.stock !== null && currentQty >= menu.stock) {
    toast("Stok menu tersebut tidak mencukupi.");
    return;
  }

  const existing = cart.find(item => item.menuId === menuId);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      menuId: menu.id,
      name: menu.name,
      price: menu.price,
      qty: 1
    });
  }

  renderCart();
}

function changeCartQty(menuId, delta) {
  const item = cart.find(row => row.menuId === menuId);
  if (!item) return;

  if (delta > 0) {
    const menu = getMenu(menuId);
    if (menu?.stock !== null && menu?.stock !== undefined &&
        item.qty >= menu.stock) {
      toast("Stok tidak mencukupi.");
      return;
    }
  }

  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(row => row.menuId !== menuId);
  renderCart();
}

function renderMenus() {
  const groups = ["Makanan", "Minuman"];
  $("menuButtons").innerHTML = groups.map(category => {
    const menus = data.menus.filter(menu => menu.category === category);
    if (!menus.length) return "";

    return `<div class="menu-category" style="grid-column:1/-1">
      <h3>${category}</h3>
    </div>` + menus.map(menu => {
      const sold = cart.find(item => item.menuId === menu.id)?.qty || 0;
      const stockText = menu.stock === null
        ? "Stok tidak dibatasi"
        : menu.stock === 0
          ? "HABIS"
          : menu.stock <= 5
            ? `Stok hampir habis: ${menu.stock}`
            : `Stok: ${menu.stock}`;

      return `<button class="menu-button" data-add-menu="${escapeHTML(menu.id)}"
          ${menu.stock !== null && menu.stock <= sold ? "disabled" : ""}>
        <strong>${escapeHTML(menu.name)}</strong>
        <span class="menu-price">${rupiah(menu.price)}</span>
        <span class="stock-label">${escapeHTML(stockText)}</span>
      </button>`;
    }).join("");
  }).join("") || `<p class="empty">Belum ada menu. Tambahkan di Pengaturan.</p>`;

  $("menuButtons").querySelectorAll("[data-add-menu]").forEach(button => {
    button.addEventListener("click", () => addToCart(button.dataset.addMenu));
  });
}

function renderCart() {
  $("cartItems").innerHTML = cart.length ? cart.map(item => `
    <div class="cart-row">
      <div>
        <strong>${escapeHTML(item.name)}</strong>
        <small>${rupiah(item.price)} × ${item.qty} = ${rupiah(item.price * item.qty)}</small>
      </div>
      <div class="cart-controls">
        <button data-minus="${escapeHTML(item.menuId)}" aria-label="Kurangi">−</button>
        <strong>${item.qty}</strong>
        <button data-plus="${escapeHTML(item.menuId)}" aria-label="Tambah">+</button>
        <button class="remove-item" data-remove="${escapeHTML(item.menuId)}"
                aria-label="Hapus item">×</button>
      </div>
    </div>`).join("") : `<p class="empty">Keranjang masih kosong.</p>`;

  $("cartItems").querySelectorAll("[data-minus]").forEach(button =>
    button.addEventListener("click", () => changeCartQty(button.dataset.minus, -1))
  );
  $("cartItems").querySelectorAll("[data-plus]").forEach(button =>
    button.addEventListener("click", () => changeCartQty(button.dataset.plus, 1))
  );
  $("cartItems").querySelectorAll("[data-remove]").forEach(button =>
    button.addEventListener("click", () => {
      cart = cart.filter(item => item.menuId !== button.dataset.remove);
      renderCart();
    })
  );

  const total = cartTotal();
  const paid = number($("paidAmount").value);
  $("cartTotal").textContent = rupiah(total);
  $("changeAmount").textContent = rupiah(Math.max(0, paid - total));
  $("checkoutBtn").disabled = cart.length === 0;
  renderMenus();
}

$("paidAmount").addEventListener("input", renderCart);

document.querySelectorAll("[data-money]").forEach(button => {
  button.addEventListener("click", () => {
    $("paidAmount").value = number($("paidAmount").value) +
      Number(button.dataset.money);
    renderCart();
  });
});

$("exactMoney").addEventListener("click", () => {
  $("paidAmount").value = cartTotal();
  renderCart();
});

$("clearCartBtn").addEventListener("click", () => {
  if (!cart.length) return;
  if (confirm("Kosongkan seluruh keranjang?")) {
    cart = [];
    renderCart();
  }
});

/* ---------- Pembayaran dan nomor transaksi ---------- */

function makeTransactionNumber() {
  const date = new Date();
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("");
  return "TRX-" + day + "-" + String(data.nextTransaction).padStart(4, "0");
}

$("checkoutBtn").addEventListener("click", () => {
  const total = cartTotal();
  if (!cart.length || total <= 0) return;

  const method = $("paymentMethod").value;
  const paid = method === "QRIS" ? total : number($("paidAmount").value);

  if (paid < total) {
    $("paymentMessage").textContent = "Uang dibayar masih kurang.";
    toast("Pembayaran belum mencukupi.");
    return;
  }

  for (const item of cart) {
    const menu = getMenu(item.menuId);
    if (!menu) {
      toast("Ada menu yang sudah dihapus. Periksa keranjang.");
      return;
    }
    if (menu.stock !== null && item.qty > menu.stock) {
      toast(`Stok ${menu.name} tidak mencukupi.`);
      return;
    }
  }

  const transaction = {
    id: uid("trx"),
    number: makeTransactionNumber(),
    date: new Date().toISOString(),
    items: cart.map(item => ({ ...item })),
    total,
    paid,
    change: Math.max(0, paid - total),
    method
  };

  // Kurangi stok hanya ketika transaksi selesai.
  transaction.items.forEach(item => {
    const menu = getMenu(item.menuId);
    if (menu && menu.stock !== null) menu.stock -= item.qty;
  });

  data.transactions.unshift(transaction);
  data.nextTransaction++;
  lastTransactionId = transaction.id;

  if (!saveData()) {
    // Pulihkan kondisi jika penyimpanan gagal.
    data.transactions = data.transactions.filter(t => t.id !== transaction.id);
    transaction.items.forEach(item => {
      const menu = getMenu(item.menuId);
      if (menu && menu.stock !== null) menu.stock += item.qty;
    });
    data.nextTransaction = Math.max(1, data.nextTransaction - 1);
    lastTransactionId = null;
    return;
  }

  cart = [];
  $("paidAmount").value = "";
  $("paymentMessage").textContent = "Transaksi berhasil disimpan.";
  $("lastReceiptActions").hidden = false;

  renderAll();
  toast("Pembayaran berhasil: " + transaction.number);
});

$("printLastBtn").addEventListener("click", () => {
  if (lastTransactionId) printReceipt(lastTransactionId);
});

$("rawbtLastBtn").addEventListener("click", () => {
  if (lastTransactionId) sendRawBT(lastTransactionId);
});

/* ---------- Modal dan pengeluaran tambahan ---------- */

function renderEntryList(elementId, list, type) {
  const element = $(elementId);
  if (!list.length) {
    element.innerHTML = `<p class="empty">Belum ada data.</p>`;
    return;
  }

  element.innerHTML = list.map(item => `
    <div class="entry-row">
      <div>
        <strong>${escapeHTML(item.note)}</strong>
        <div class="muted">${formatDate(item.date)}</div>
        <strong>${rupiah(item.amount)}</strong>
      </div>
      <div class="entry-actions">
        <button class="secondary" data-edit-entry="${escapeHTML(item.id)}">Edit</button>
        <button class="danger" data-delete-entry="${escapeHTML(item.id)}">Hapus</button>
      </div>
    </div>`).join("");

  element.querySelectorAll("[data-edit-entry]").forEach(button => {
    button.addEventListener("click", () => editEntry(type, button.dataset.editEntry));
  });
  element.querySelectorAll("[data-delete-entry]").forEach(button => {
    button.addEventListener("click", () => deleteEntry(type, button.dataset.deleteEntry));
  });
}

function editEntry(type, id) {
  const list = type === "capital" ? data.capital : data.expenses;
  const item = list.find(row => row.id === id);
  if (!item) return;

  const note = prompt("Ubah keterangan:", item.note);
  if (note === null) return;
  if (!note.trim()) return toast("Keterangan tidak boleh kosong.");

  const amountText = prompt("Ubah nominal (angka rupiah):", String(item.amount));
  if (amountText === null) return;
  if (!/^\d+$/.test(amountText.trim()) || number(amountText) <= 0) {
    return toast("Nominal tidak valid.");
  }

  item.note = note.trim();
  item.amount = number(amountText);
  item.editedAt = new Date().toISOString();
  saveData();
  renderAll();
}

function deleteEntry(type, id) {
  const list = type === "capital" ? data.capital : data.expenses;
  const item = list.find(row => row.id === id);
  if (!item || !confirm(`Hapus "${item.note}" dari catatan?`)) return;

  if (type === "capital") data.capital = data.capital.filter(row => row.id !== id);
  else data.expenses = data.expenses.filter(row => row.id !== id);

  saveData();
  renderAll();
}

$("capitalForm").addEventListener("submit", event => {
  event.preventDefault();
  const note = $("capitalNote").value.trim();
  const amount = number($("capitalAmount").value);
  if (!note || amount <= 0) return toast("Isi keterangan dan nominal yang valid.");

  data.capital.push({ id: uid("modal"), note, amount, date: new Date().toISOString() });
  saveData();
  event.target.reset();
  renderAll();
  toast("Modal berhasil dicatat.");
});

$("expenseForm").addEventListener("submit", event => {
  event.preventDefault();
  const note = $("expenseNote").value.trim();
  const amount = number($("expenseAmount").value);
  if (!note || amount <= 0) return toast("Isi keterangan dan nominal yang valid.");

  data.expenses.push({
    id: uid("expense"), note, amount, date: new Date().toISOString()
  });
  saveData();
  event.target.reset();
  renderAll();
  toast("Pengeluaran berhasil dicatat.");
});

/* ---------- Riwayat dan pembatalan transaksi ---------- */

function renderHistory() {
  const element = $("historyList");
  if (!data.transactions.length) {
    element.innerHTML = `<p class="empty">Belum ada transaksi.</p>`;
    return;
  }

  element.innerHTML = data.transactions.map(transaction => `
    <div class="history-card">
      <div class="history-head">
        <div>
          <strong>${escapeHTML(transaction.number)}</strong>
          <div class="muted">${formatDate(transaction.date)}</div>
        </div>
        <div>
          <strong>${rupiah(transaction.total)}</strong>
          <div class="muted">${escapeHTML(transaction.method || "Tunai")}</div>
        </div>
      </div>
      <div class="history-items">
        ${transaction.items.map(item =>
          `${escapeHTML(item.name)} × ${item.qty} (${rupiah(item.price * item.qty)})`
        ).join("<br>")}
      </div>
      <div class="muted">
        Bayar: ${rupiah(transaction.paid)} ·
        Kembalian: ${rupiah(transaction.change)}
      </div>
      <div class="entry-actions" style="justify-content:flex-start;margin-top:10px">
        <button class="primary" data-print="${escapeHTML(transaction.id)}">Cetak Ulang</button>
        <button class="secondary" data-rawbt="${escapeHTML(transaction.id)}">RawBT</button>
        <button class="danger" data-delete-trx="${escapeHTML(transaction.id)}">Batalkan / Hapus</button>
      </div>
    </div>`).join("");

  element.querySelectorAll("[data-print]").forEach(button =>
    button.addEventListener("click", () => printReceipt(button.dataset.print))
  );
  element.querySelectorAll("[data-rawbt]").forEach(button =>
    button.addEventListener("click", () => sendRawBT(button.dataset.rawbt))
  );
  element.querySelectorAll("[data-delete-trx]").forEach(button =>
    button.addEventListener("click", () => deleteTransaction(button.dataset.deleteTrx))
  );
}

function deleteTransaction(id) {
  const transaction = transactionById(id);
  if (!transaction) return;

  if (!confirm(
    `Batalkan transaksi ${transaction.number} senilai ${rupiah(transaction.total)}?\n` +
    "Pemasukan akan berkurang dan stok akan dikembalikan."
  )) return;

  transaction.items.forEach(item => {
    const menu = getMenu(item.menuId);
    if (menu && menu.stock !== null) menu.stock += item.qty;
  });

  data.transactions = data.transactions.filter(row => row.id !== id);
  if (lastTransactionId === id) lastTransactionId = null;

  saveData();
  renderAll();
  toast("Transaksi dibatalkan.");
}

/* ---------- Logo dari variabel CSS ---------- */

// Ambil nilai --logo-img dari CSS. Hanya Data URI yang dapat disematkan
// langsung ke PDF/cetak; gambar URL biasa tidak otomatis tersedia offline.
function getLogoDataURI() {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--logo-img").trim();

  const match = value.match(/^url\((['"]?)(.*?)\1\)$/i);
  if (!match) return null;

  const uri = match[2];
  if (/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(uri)) return uri;
  return null;
}

/* ---------- Cetak struk 58 mm ---------- */

function receiptHTML(transaction) {
  const logo = getLogoDataURI();
  const logoHTML = logo
    ? `<img class="receipt-logo" src="${logo}" alt="Logo">`
    : `<div style="font-weight:bold;text-align:center;margin:3mm 0">[ LOGO ]</div>`;

  const rows = transaction.items.map(item => `
    <tr>
      <td colspan="2">${escapeHTML(item.name)}</td>
    </tr>
    <tr>
      <td>${item.qty} × ${rupiah(item.price)}</td>
      <td>${rupiah(item.qty * item.price)}</td>
    </tr>`).join("");

  return `<div class="receipt">
    <div class="receipt-header">
      ${logoHTML}
      <h2>${escapeHTML(data.settings.name)}</h2>
      <p>${formatDate(transaction.date)}</p>
      <p>No: ${escapeHTML(transaction.number)}</p>
      <p>Metode: ${escapeHTML(transaction.method || "Tunai")}</p>
    </div>
    <hr>
    <table class="receipt-table"><tbody>${rows}</tbody></table>
    <hr>
    <div class="receipt-total"><span>TOTAL</span><strong>${rupiah(transaction.total)}</strong></div>
    <div class="receipt-total"><span>Bayar</span><span>${rupiah(transaction.paid)}</span></div>
    <div class="receipt-total"><span>Kembalian</span><span>${rupiah(transaction.change)}</span></div>
    <hr>
    <p class="receipt-thanks">${escapeHTML(data.settings.thanks)}</p>
    <p class="receipt-thanks">Simpan struk ini sebagai bukti transaksi.</p>
  </div>`;
}

function printReceipt(id) {
  const transaction = transactionById(id);
  if (!transaction) return toast("Transaksi tidak ditemukan.");

  $("receiptPrint").innerHTML = receiptHTML(transaction);
  window.print();
}

/* RawBT: membuka aplikasi Android jika terpasang. */
function sendRawBT(id) {
  const transaction = transactionById(id);
  if (!transaction) return toast("Transaksi tidak ditemukan.");

  const textReceipt = [
    data.settings.name,
    formatDate(transaction.date),
    "No: " + transaction.number,
    "------------------------------",
    ...transaction.items.map(item =>
      `${item.name}\n${item.qty} x ${rupiah(item.price)} = ${rupiah(item.qty * item.price)}`
    ),
    "------------------------------",
    "TOTAL: " + rupiah(transaction.total),
    "Bayar: " + rupiah(transaction.paid),
    "Kembalian: " + rupiah(transaction.change),
    transaction.method || "Tunai",
    data.settings.thanks
  ].join("\n");

  // RawBT mendukung skema rawbt:base64, untuk teks ESC/POS sederhana.
  // Aplikasi/printer tertentu mungkin memerlukan pengaturan tambahan.
  const base64 = btoa(unescape(encodeURIComponent(textReceipt)));
  window.location.href = "rawbt:base64," + base64;
}

/* ---------- Pengaturan menu dan identitas ---------- */

$("settingsForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("settingName").value.trim();
  const thanks = $("settingThanks").value.trim();

  if (!name || !thanks) return toast("Isi nama bazar dan ucapan struk.");

  data.settings.name = name;
  data.settings.thanks = thanks;
  saveData();
  renderAll();
  toast("Pengaturan berhasil disimpan.");
});

$("menuForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("newMenuName").value.trim();
  const category = $("newMenuCategory").value;
  const price = number($("newMenuPrice").value);
  const stockText = $("newMenuStock").value.trim();

  if (!name || price <= 0) return toast("Nama menu dan harga harus valid.");

  const duplicate = data.menus.some(menu =>
    menu.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) return toast("Nama menu sudah digunakan.");

  const stock = stockText === "" ? null : number(stockText);

  data.menus.push({
    id: uid("menu"), name, category, price, stock
  });

  saveData();
  event.target.reset();
  renderAll();
  toast("Menu berhasil ditambahkan.");
});

function renderSettingsMenus() {
  $("settingsMenuList").innerHTML = data.menus.length
    ? data.menus.map(menu => `
      <div class="entry-row">
        <div>
          <strong>${escapeHTML(menu.name)}</strong>
          <div class="muted">${escapeHTML(menu.category)}</div>
          <div>${rupiah(menu.price)} · ${
            menu.stock === null ? "Stok bebas" : `Stok: ${menu.stock}`
          }</div>
        </div>
        <div class="entry-actions">
          <button class="secondary" data-edit-menu="${escapeHTML(menu.id)}">Edit</button>
          <button class="danger" data-delete-menu="${escapeHTML(menu.id)}">Hapus</button>
        </div>
      </div>`).join("")
    : `<p class="empty">Belum ada menu.</p>`;

  $("settingsMenuList").querySelectorAll("[data-edit-menu]").forEach(button => {
    button.addEventListener("click", () => editMenu(button.dataset.editMenu));
  });
  $("settingsMenuList").querySelectorAll("[data-delete-menu]").forEach(button => {
    button.addEventListener("click", () => deleteMenu(button.dataset.deleteMenu));
  });
}

function editMenu(id) {
  const menu = getMenu(id);
  if (!menu) return;

  const name = prompt("Nama menu:", menu.name);
  if (name === null) return;
  if (!name.trim()) return toast("Nama menu tidak boleh kosong.");

  const priceText = prompt("Harga jual (angka rupiah):", String(menu.price));
  if (priceText === null) return;
  if (!/^\d+$/.test(priceText.trim()) || number(priceText) <= 0) {
    return toast("Harga tidak valid.");
  }

  const stockText = prompt(
    "Stok saat ini (isi angka atau kosong untuk stok bebas):",
    menu.stock === null ? "" : String(menu.stock)
  );
  if (stockText === null) return;
  if (stockText.trim() !== "" && !/^\d+$/.test(stockText.trim())) {
    return toast("Stok tidak valid.");
  }

  const duplicate = data.menus.some(other =>
    other.id !== id && other.name.toLowerCase() === name.trim().toLowerCase()
  );
  if (duplicate) return toast("Nama menu sudah digunakan.");

  menu.name = name.trim();
  menu.price = number(priceText);
  menu.stock = stockText.trim() === "" ? null : number(stockText);

  // Perubahan harga tidak mengubah harga transaksi yang sudah tercatat.
  cart = cart.filter(item => {
    if (item.menuId !== id) return true;
    item.name = menu.name;
    item.price = menu.price;
    return true;
  });

  saveData();
  renderAll();
  toast("Menu berhasil diperbarui.");
}

function deleteMenu(id) {
  const menu = getMenu(id);
  if (!menu) return;

  if (cart.some(item => item.menuId === id)) {
    return toast("Hapus menu ini dari keranjang terlebih dahulu.");
  }

  if (!confirm(`Hapus menu "${menu.name}" dari daftar menu?`)) return;

  // Transaksi lama tetap menyimpan nama dan harga pada saat transaksi.
  data.menus = data.menus.filter(item => item.id !== id);
  saveData();
  renderAll();
  toast("Menu dihapus.");
}

/* ---------- Rekap laporan ---------- */

function renderReports() {
  $("reportSummary").innerHTML = [
    statCard("Total modal awal", rupiah(capitalTotal())),
    statCard("Pemasukan", rupiah(incomeTotal())),
    statCard("Pengeluaran tambahan", rupiah(expenseTotal())),
    statCard("Laba / rugi", rupiah(grossResult())),
    statCard("Transaksi", String(data.transactions.length))
  ].join("");

  const methods = ["Tunai", "QRIS"];
  $("paymentSummary").innerHTML = methods.map(method => {
    const transactions = data.transactions.filter(t => t.method === method);
    return `<div class="entry-row">
      <span>${method} (${transactions.length} transaksi)</span>
      <strong>${rupiah(sum(transactions, t => t.total))}</strong>
    </div>`;
  }).join("");

  $("salesSummary").innerHTML = data.menus.length
    ? data.menus.map(menu => {
      const soldItems = data.transactions.flatMap(t => t.items)
        .filter(item => item.menuId === menu.id);
      const qty = sum(soldItems, item => item.qty);
      const subtotal = sum(soldItems, item => item.qty * item.price);

      return `<div class="entry-row">
        <div><strong>${escapeHTML(menu.name)}</strong><div class="muted">${qty} terjual</div></div>
        <strong>${rupiah(subtotal)}</strong>
      </div>`;
    }).join("")
    : `<p class="empty">Belum ada menu.</p>`;
}

/* ---------- Logo dan laporan PDF dengan jsPDF ---------- */

function addPdfLogo(doc, x, y, width = 22) {
  const logo = getLogoDataURI();
  if (!logo) return false;

  try {
    const format = /^data:image\/png/i.test(logo) ? "PNG" :
      /^data:image\/jpe?g/i.test(logo) ? "JPEG" :
      /^data:image\/webp/i.test(logo) ? "WEBP" : null;
    if (!format) return false;

    doc.addImage(logo, format, x, y, width, width);
    return true;
  } catch (error) {
    console.warn("Logo tidak dapat disematkan ke PDF:", error);
    return false;
  }
}

function pdfText(doc, text, x, y, maxWidth = 180, lineHeight = 5) {
  const lines = doc.splitTextToSize(String(text), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function downloadPDF() {
  $("pdfMessage").textContent = "";

  if (!window.jspdf || !window.jspdf.jsPDF) {
    $("pdfMessage").textContent =
      "Library PDF belum tersedia. Periksa internet, lalu muat ulang halaman.";
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const left = 14;
    const right = 196;
    const width = right - left;
    let y = 15;

    if (addPdfLogo(doc, left, y, 22)) {
      y += 26;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    y = pdfText(doc, data.settings.name, left, y, width, 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    y = pdfText(doc, "Laporan Keuangan Bazar", left, y + 1);
    y = pdfText(doc, "Dibuat: " + formatDate(new Date().toISOString()), left, y + 5);
    y += 3;

    function ensureSpace(height = 12) {
      if (y + height > 280) {
        doc.addPage();
        y = 15;
      }
    }

    function heading(title) {
      ensureSpace(12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      y = pdfText(doc, title, left, y + 2, width, 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
    }

    function line(label, value) {
      ensureSpace(7);
      doc.text(String(label), left, y);
      doc.text(String(value), right, y, { align: "right" });
      y += 6;
    }

    heading("Rincian Modal Awal");
    if (!data.capital.length) line("Belum ada catatan modal", "-");
    data.capital.forEach(item => line(item.note, rupiah(item.amount)));
    line("TOTAL MODAL", rupiah(capitalTotal()));

    heading("Pengeluaran Tambahan");
    if (!data.expenses.length) line("Belum ada pengeluaran", "-");
    data.expenses.forEach(item => line(item.note, rupiah(item.amount)));
    line("TOTAL PENGELUARAN", rupiah(expenseTotal()));

    heading("Penjualan per Menu");
    data.menus.forEach(menu => {
      const items = data.transactions.flatMap(t => t.items)
        .filter(item => item.menuId === menu.id);
      line(`${menu.name} (${sum(items, item => item.qty)} terjual)`,
        rupiah(sum(items, item => item.qty * item.price)));
    });

    heading("Ringkasan Keuangan");
    line("Total pemasukan", rupiah(incomeTotal()));
    line("Modal awal", rupiah(capitalTotal()));
    line("Pengeluaran tambahan", rupiah(expenseTotal()));
    line("LABA / RUGI", rupiah(grossResult()));

    heading("Rekap Pembayaran");
    ["Tunai", "QRIS"].forEach(method => {
      const list = data.transactions.filter(t => t.method === method);
      line(method + " (" + list.length + " transaksi)",
        rupiah(sum(list, t => t.total)));
    });

    heading("Riwayat Transaksi");
    if (!data.transactions.length) line("Belum ada transaksi", "-");

    data.transactions.forEach(transaction => {
      ensureSpace(22);
      doc.setFont("helvetica", "bold");
      y = pdfText(doc,
        `${transaction.number} · ${formatDate(transaction.date)}`,
        left, y, width, 4.5);
      doc.setFont("helvetica", "normal");

      transaction.items.forEach(item => {
        y = pdfText(doc,
          `${item.name} × ${item.qty} @ ${rupiah(item.price)} = ${rupiah(item.qty * item.price)}`,
          left + 3, y, width - 3, 4.5);
        ensureSpace(6);
      });

      y = pdfText(doc,
        `Total ${rupiah(transaction.total)} | Bayar ${rupiah(transaction.paid)} | ` +
        `Kembalian ${rupiah(transaction.change)} | ${transaction.method || "Tunai"}`,
        left + 3, y, width - 3, 4.5);
      y += 2;
    });

    // Nomor halaman di setiap halaman.
    const pageCount = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page);
      doc.setFontSize(8);
      doc.text(`Halaman ${page} dari ${pageCount}`, right, 288, { align: "right" });
    }

    doc.save(downloadName("laporan-bazar", "pdf"));
    $("pdfMessage").textContent = "Laporan PDF berhasil dibuat.";
  } catch (error) {
    console.error(error);
    $("pdfMessage").textContent =
      "PDF gagal dibuat. Periksa gambar logo dan coba lagi.";
  }
}

$("downloadPdfBtn").addEventListener("click", downloadPDF);

/* ---------- Backup dan pemulihan JSON ---------- */

$("exportBtn").addEventListener("click", () => {
  const backup = {
    app: "Kasir Bazar",
    version: 1,
    exportedAt: new Date().toISOString(),
    data
  };

  safeDownload(
    JSON.stringify(backup, null, 2),
    downloadName("backup-bazar", "json"),
    "application/json"
  );
});

$("importFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const textContent = await file.text();
    const parsed = JSON.parse(textContent);
    const imported = normalizeData(parsed.data || parsed);

    if (!Array.isArray(imported.menus) ||
        !Array.isArray(imported.transactions)) {
      throw new Error("Format backup tidak valid.");
    }

    if (!confirm(
      "Impor backup akan mengganti seluruh data bazar saat ini. Lanjutkan?"
    )) {
      event.target.value = "";
      return;
    }

    data = imported;
    cart = [];
    lastTransactionId = null;

    if (saveData()) {
      renderAll();
      toast("Backup berhasil dipulihkan.");
    }
  } catch (error) {
    console.error(error);
    toast("File JSON tidak valid atau tidak dapat dibaca.");
  } finally {
    event.target.value = "";
  }
});

/* ---------- Reset semua data ---------- */

$("resetBtn").addEventListener("click", () => {
  if (!confirm("PERINGATAN: semua transaksi, modal, menu, dan pengaturan akan dihapus. Lanjutkan?")) {
    return;
  }

  const confirmation = prompt('Ketik RESET untuk konfirmasi terakhir:');
  if (confirmation !== "RESET") {
    toast("Reset dibatalkan.");
    return;
  }

  const previous = data;
  data = newData();
  cart = [];
  lastTransactionId = null;

  if (saveData()) {
    renderAll();
    toast("Data bazar berhasil direset.");
  } else {
    data = previous;
    renderAll();
  }
});

/* ---------- Render seluruh tampilan ---------- */

function renderAll() {
  renderDashboard();
  renderMenus();
  renderCart();

  $("capitalTotal").textContent = rupiah(capitalTotal());
  $("expenseTotal").textContent = rupiah(expenseTotal());

  renderEntryList("capitalList", data.capital, "capital");
  renderEntryList("expenseList", data.expenses, "expenses");
  renderHistory();
  renderReports();
  renderSettingsMenus();

  $("settingName").value = data.settings.name;
  $("settingThanks").value = data.settings.thanks;
}

function init() {
  if (!localStorage.getItem(STORAGE_KEY)) saveData();

  if (sessionStorage.getItem(SESSION_KEY) === "true") {
    showApp();
  } else {
    showLogin();
  }

  // Logo pada halaman login menggunakan CSS yang sama.
  renderAll();
}

init();