// ── Modal ────────────────────────────────────────────

function openModal({ title, body, wide = false, onClose }) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = `modal${wide ? " modal-wide" : ""}`;

  modal.innerHTML = `
    <div class="modal-header">
      <h3>${title}</h3>
      <button class="modal-close" aria-label="Close">&#x2715;</button>
    </div>
    <div class="modal-body">${typeof body === "string" ? body : ""}</div>
  `;

  if (typeof body !== "string") {
    modal.querySelector(".modal-body").appendChild(body);
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
    if (onClose) onClose();
  }

  modal.querySelector(".modal-close").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  return { overlay, modal, close };
}

// ── Table builder ────────────────────────────────────

function buildTable(headers, rows, emptyMsg = "No records found") {
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";

  if (!rows.length) {
    wrap.innerHTML = `<div class="table-empty">${emptyMsg}</div>`;
    return wrap;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const hRow  = document.createElement("tr");
  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    hRow.appendChild(th);
  });
  thead.appendChild(hRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach(row => {
    const tr = document.createElement("tr");
    row.forEach(cell => {
      const td = document.createElement("td");
      if (cell instanceof HTMLElement) {
        td.appendChild(cell);
      } else {
        td.innerHTML = cell;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

// ── Sidebar ──────────────────────────────────────────

function buildSidebar({ navItems, activeId, onNav, account, emp, onLogout }) {
  const aside = document.createElement("aside");
  aside.className = "sidebar";

  const displayName = emp ? emp.full_name : account.username;

  aside.innerHTML = `
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon">${icons.timer}</div>
      <span>LaborTrack</span>
    </div>
    <nav class="sidebar-nav" id="sidebar-nav"></nav>
    <div class="sidebar-footer">
      <div class="sidebar-user">
        ${avatarHTML(displayName, "sm")}
        <div style="min-width:0">
          <div class="sidebar-user-name">${displayName}</div>
          <div class="sidebar-user-role">${roleLabel(account.access_level)}</div>
        </div>
      </div>
      <button class="logout-btn" id="change-pw-btn" style="margin-bottom:6px">${icons.key} Change Password</button>
      <button class="logout-btn" id="logout-btn">${icons.logout} Sign Out</button>
    </div>
  `;

  const nav = aside.querySelector("#sidebar-nav");
  navItems.forEach(({ id, label, icon }) => {
    const btn = document.createElement("button");
    btn.className = `nav-btn${id === activeId ? " active" : ""}`;
    btn.dataset.id = id;
    btn.innerHTML = `${icon || ""} ${label}`;
    btn.addEventListener("click", () => onNav(id));
    nav.appendChild(btn);
  });

  aside.querySelector("#logout-btn").addEventListener("click", onLogout);
  aside.querySelector("#change-pw-btn").addEventListener("click", openChangePasswordModal);
  return aside;
}

// ── Page header ──────────────────────────────────────

function pageHeader(title, sub, actionEl) {
  const div = document.createElement("div");
  div.className = "page-header";
  div.innerHTML = `
    <div class="page-header-text">
      <h1>${title}</h1>
      ${sub ? `<p>${sub}</p>` : ""}
    </div>
  `;
  if (actionEl) div.appendChild(actionEl);
  return div;
}

// ── Field builder ────────────────────────────────────

function buildField(label, inputEl) {
  const div = document.createElement("div");
  div.className = "field";
  const lbl = document.createElement("label");
  lbl.textContent = label;
  div.appendChild(lbl);
  div.appendChild(inputEl);
  return div;
}

function makeInput(type, value, placeholder) {
  const inp = document.createElement("input");
  inp.type = type || "text";
  inp.value = value || "";
  inp.placeholder = placeholder || "";
  inp.className = "inp";
  return inp;
}

function makeSelect(options, value) {
  const sel = document.createElement("select");
  sel.className = "sel";
  options.forEach(([val, label]) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = label;
    if (String(val) === String(value)) opt.selected = true;
    sel.appendChild(opt);
  });
  return sel;
}
