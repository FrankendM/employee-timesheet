// ── Audit Log view (admin only, read-only) ────────────
// Backend: backend/routes/audit_log.php
// Tracks who created/updated/deleted accounts, and who approved/unapproved
// payroll periods. Categorized into tabs by target_type so admins can jump
// straight to "who touched accounts" vs "who approved payroll".

const AUDIT_TABS = [
  {
    id: "all",
    label: "All Activity",
    targetType: null,
    actions: null,
  },
  {
    id: "accounts",
    label: "Account Changes",
    targetType: "account",
    actions: [
      ["", "All"],
      ["account_create", "Created"],
      ["account_update", "Updated"],
      ["account_delete", "Deleted"],
    ],
  },
  {
    id: "payroll",
    label: "Payroll Approvals",
    targetType: "payroll_period",
    actions: [
      ["", "All"],
      ["payroll_approve", "Approved"],
      ["payroll_unapprove", "Unapproved"],
    ],
  },
];

const AUDIT_ACTION_META = {
  account_create:     { label: "Account Created",     badge: "badge-approved" },
  account_update:     { label: "Account Updated",      badge: "badge-info"     },
  account_delete:     { label: "Account Deleted",      badge: "badge-rejected" },
  payroll_approve:    { label: "Payroll Approved",      badge: "badge-approved" },
  payroll_unapprove:  { label: "Payroll Unapproved",    badge: "badge-late"     },
};

const AUDIT_FIELD_LABELS = {
  username: "Username", email: "Email", access_level: "Access Level",
  employee_id: "Employee", password: "Password",
  department_id: "Department", period_year: "Year", period_month: "Month",
  previously_approved_by: "Previously Approved By",
};

const AUDIT_MONTH_NAMES = ["", "January","February","March","April","May","June",
  "July","August","September","October","November","December"];

function renderAuditLog(db, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  page.appendChild(pageHeader(
    "Audit Log",
    "Every account change and payroll approval, tracked automatically"
  ));

  let activeTabId  = "all";
  let subAction    = "";
  let filterFrom   = "";
  let filterTo     = "";
  let filterAccId  = "";
  let limit         = 25;
  let offset        = 0;

  let entries = [];
  let total   = 0;
  let loading = false;
  let loadErr = null;

  // ── Tabs ──────────────────────────────────────────────
  const tabsRow = document.createElement("div");
  tabsRow.className = "audit-tabs";
  page.appendChild(tabsRow);

  // ── Filter bar ────────────────────────────────────────
  const filterCard = document.createElement("div");
  filterCard.className = "card";
  filterCard.style.padding = "14px 18px";
  page.appendChild(filterCard);

  const filterRow = document.createElement("div");
  filterRow.style.cssText = "display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;";
  filterCard.appendChild(filterRow);

  let subActionSel = null; // rebuilt per-tab

  const fromInp = makeInput("date", filterFrom);
  fromInp.addEventListener("change", e => { filterFrom = e.target.value; offset = 0; load(); });

  const toInp = makeInput("date", filterTo);
  toInp.addEventListener("change", e => { filterTo = e.target.value; offset = 0; load(); });

  const accOpts = [["", "All Admins"], ...db.accounts
    .filter(a => a.access_level === "admin")
    .map(a => [a.account_id, a.username])];
  const accSel = makeSelect(accOpts, filterAccId);
  accSel.addEventListener("change", e => { filterAccId = e.target.value; offset = 0; load(); });

  const clearBtn = document.createElement("button");
  clearBtn.className = "btn btn-outline btn-sm";
  clearBtn.textContent = "Clear filters";
  clearBtn.addEventListener("click", () => {
    filterFrom = ""; filterTo = ""; filterAccId = ""; subAction = ""; offset = 0;
    fromInp.value = ""; toInp.value = ""; accSel.value = "";
    if (subActionSel) subActionSel.value = "";
    load();
  });

  const dateFromField = buildField("From", fromInp);
  const dateToField    = buildField("To", toInp);
  const accField        = buildField("Performed By", accSel);
  const subActionSlot  = document.createElement("div"); // sub-action select goes here, per tab

  filterRow.appendChild(dateFromField);
  filterRow.appendChild(dateToField);
  filterRow.appendChild(accField);
  filterRow.appendChild(subActionSlot);
  filterRow.appendChild(clearBtn);

  function rebuildSubAction() {
    subActionSlot.innerHTML = "";
    subActionSel = null;
    const tab = AUDIT_TABS.find(t => t.id === activeTabId);
    if (!tab || !tab.actions) return;
    subActionSel = makeSelect(tab.actions, subAction);
    subActionSel.addEventListener("change", e => { subAction = e.target.value; offset = 0; load(); });
    subActionSlot.appendChild(buildField("Action", subActionSel));
  }

  // ── Table card ────────────────────────────────────────
  const tableCard = document.createElement("div");
  tableCard.className = "card";
  page.appendChild(tableCard);

  function renderTabs() {
    tabsRow.innerHTML = "";
    AUDIT_TABS.forEach(tab => {
      const btn = document.createElement("button");
      btn.className = `audit-tab${tab.id === activeTabId ? " active" : ""}`;
      btn.innerHTML = `${tab.label}`;
      btn.addEventListener("click", () => {
        if (activeTabId === tab.id) return;
        activeTabId = tab.id;
        subAction = "";
        offset = 0;
        rebuildSubAction();
        renderTabs();
        load();
      });
      tabsRow.appendChild(btn);
    });
  }

  // ── Helpers to resolve human-readable labels ──────────
  function accountLabel(entry) {
    if (entry.username_snapshot) return entry.username_snapshot;
    const acc = db.accounts.find(a => a.account_id === entry.account_id);
    return acc ? acc.username : (entry.account_id ? `#${entry.account_id}` : "System");
  }

  function targetLabel(entry) {
    if (entry.target_type === "account") {
      const acc = db.accounts.find(a => a.account_id === entry.target_id);
      let uname = acc && acc.username;
      const d = entry.details;
      if (d && d.username) {
        // account_update stores { from, to }; create/delete store a plain string
        uname = (d.username && typeof d.username === "object" && "to" in d.username)
          ? d.username.to
          : d.username;
      }
      return uname ? `Account "${uname}"` : `Account #${entry.target_id ?? "—"}`;
    }
    if (entry.target_type === "payroll_period") {
      const d = entry.details || {};
      const dept = db.departments.find(dp => dp.department_id === d.department_id);
      const deptName = dept ? dept.department_name : (d.department_id ? `Dept #${d.department_id}` : "");
      const period = d.period_month ? `${AUDIT_MONTH_NAMES[d.period_month]} ${d.period_year}` : "";
      return [deptName, period].filter(Boolean).join(" — ") || `Payroll #${entry.target_id ?? "—"}`;
    }
    return `${entry.target_type || "—"} #${entry.target_id ?? "—"}`;
  }

  function fieldLabel(key) {
    return AUDIT_FIELD_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  function fieldValue(key, val) {
    if (val === null || val === undefined || val === "") return "—";
    if (key === "employee_id") {
      const emp = db.employees.find(e => e.employee_id === val);
      return emp ? emp.full_name : `#${val}`;
    }
    if (key === "department_id") {
      const dept = db.departments.find(d => d.department_id === val);
      return dept ? dept.department_name : `#${val}`;
    }
    if (key === "period_month") return AUDIT_MONTH_NAMES[val] || val;
    if (key === "previously_approved_by") {
      const acc = db.accounts.find(a => a.account_id === val);
      return acc ? acc.username : `#${val}`;
    }
    return String(val);
  }

  // Builds the expandable details panel content for a single entry
  function buildDetailPanel(entry) {
    const panel = document.createElement("div");
    panel.className = "audit-detail-panel";

    const d = entry.details;
    if (!d || Object.keys(d).length === 0) {
      panel.innerHTML = `<span class="text-gray">No additional details recorded.</span>`;
      return panel;
    }

    if (entry.action === "account_update") {
      // Shape: { field: { from, to }, ... }
      Object.entries(d).forEach(([key, change]) => {
        const row = document.createElement("div");
        row.className = "audit-detail-row";
        const isFromTo = change && typeof change === "object" && "from" in change && "to" in change;
        row.innerHTML = `
          <span class="audit-detail-key">${fieldLabel(key)}</span>
          <span class="audit-detail-val">
            ${isFromTo
              ? `${fieldValue(key, change.from)}<span class="audit-detail-arrow">&rarr;</span>${fieldValue(key, change.to)}`
              : fieldValue(key, change)}
          </span>`;
        panel.appendChild(row);
      });
    } else {
      Object.entries(d).forEach(([key, val]) => {
        const row = document.createElement("div");
        row.className = "audit-detail-row";
        row.innerHTML = `
          <span class="audit-detail-key">${fieldLabel(key)}</span>
          <span class="audit-detail-val">${fieldValue(key, val)}</span>`;
        panel.appendChild(row);
      });
    }
    return panel;
  }

  function renderTable() {
    tableCard.innerHTML = "";

    if (loading) {
      const loadingEl = document.createElement("div");
      loadingEl.style.cssText = "padding:32px;text-align:center;color:var(--text-muted,#9ca3af);font-size:.85rem;";
      loadingEl.textContent = "Loading…";
      tableCard.appendChild(loadingEl);
      return;
    }

    if (loadErr) {
      const errBox = document.createElement("div");
      errBox.className = "alert-error";
      errBox.style.margin = "14px";
      errBox.textContent = loadErr;
      tableCard.appendChild(errBox);
      return;
    }

    const rows = entries.map(entry => {
      const meta = AUDIT_ACTION_META[entry.action] || { label: entry.action, badge: "badge-employee" };

      const actionCell = `<span class="badge ${meta.badge}">${meta.label}</span>`;

      const actorCell = document.createElement("div");
      actorCell.className = "audit-row-actor";
      actorCell.innerHTML = `${avatarHTML(accountLabel(entry), "sm")}<span class="text-sm font-medium">${accountLabel(entry)}</span>`;

      const targetCell = `<span class="text-sm">${targetLabel(entry)}</span>`;
      const whenCell    = `<span class="mono text-xs text-gray">${fmtDT(entry.created_at)}</span>`;

      // Details toggle cell
      const detailsCell = document.createElement("div");
      const hasDetails = entry.details && Object.keys(entry.details).length > 0;
      if (hasDetails) {
        const toggleBtn = document.createElement("button");
        toggleBtn.className = "audit-detail-toggle";
        toggleBtn.innerHTML = `${icons.chevronRightSm} Details`;
        let open = false;
        let panel = null;
        toggleBtn.addEventListener("click", () => {
          open = !open;
          if (open) {
            panel = buildDetailPanel(entry);
            detailsCell.appendChild(panel);
            toggleBtn.innerHTML = `${icons.chevronDown} Hide`;
          } else {
            if (panel) panel.remove();
            toggleBtn.innerHTML = `${icons.chevronRightSm} Details`;
          }
        });
        detailsCell.appendChild(toggleBtn);
      } else {
        detailsCell.innerHTML = `<span class="text-xs text-gray">—</span>`;
      }

      return [whenCell, actionCell, actorCell, targetCell, detailsCell];
    });

    tableCard.appendChild(
      buildTable(["When", "Action", "Performed By", "Target", "Details"], rows,
        "No audit entries found for the selected filters.")
    );

    // ── Pagination ──────────────────────────────────────
    if (total > 0) {
      const start = offset + 1;
      const end   = Math.min(offset + limit, total);

      const pag = document.createElement("div");
      pag.className = "audit-pagination";

      const info = document.createElement("span");
      info.textContent = `Showing ${start}–${end} of ${total}`;

      const btns = document.createElement("div");
      btns.className = "audit-pagination-btns";

      const prevBtn = document.createElement("button");
      prevBtn.className = "btn btn-outline btn-sm";
      prevBtn.innerHTML = `${icons.chevronLeft} Prev`;
      prevBtn.disabled = offset === 0;
      prevBtn.addEventListener("click", () => { offset = Math.max(0, offset - limit); load(); });

      const nextBtn = document.createElement("button");
      nextBtn.className = "btn btn-outline btn-sm";
      nextBtn.innerHTML = `Next ${icons.chevronRightSm}`;
      nextBtn.disabled = end >= total;
      nextBtn.addEventListener("click", () => { offset = offset + limit; load(); });

      btns.appendChild(prevBtn);
      btns.appendChild(nextBtn);
      pag.appendChild(info);
      pag.appendChild(btns);
      tableCard.appendChild(pag);
    }
  }

  function currentFilters() {
    const tab = AUDIT_TABS.find(t => t.id === activeTabId);
    return {
      targetType: tab.targetType || null,
      action:     subAction || null,
      accountId:  filterAccId || null,
      from:       filterFrom || null,
      to:         filterTo || null,
      limit,
      offset,
    };
  }

  async function load() {
    loading = true;
    loadErr = null;
    renderTable();
    try {
      const res = await fetchAuditLog(currentFilters());
      entries = res.entries;
      total   = res.total;
    } catch (err) {
      entries = [];
      total   = 0;
      loadErr = err.message || "Could not load the audit log.";
    }
    loading = false;
    renderTable();
  }

  rebuildSubAction();
  renderTabs();
  load();
  return page;
}