function renderPayroll(db, account, onDbChange) {
  return account.access_level === "admin"
    ? renderAdminPayroll(db, account, onDbChange)
    : renderMyPayHistory(db, account);
}

function renderAdminPayroll(db, account, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  let periods       = [];
  let selectedDept  = "";
  let selectedYear  = new Date().getFullYear();
  let selectedMonth = new Date().getMonth() + 1;
  let loading       = false;

  page.appendChild(pageHeader("Payroll Management",
    "Generate, review, and approve monthly payroll by department"));

  // ── Generate strip ────────────────────────────────
  const genCard = document.createElement("div");
  genCard.className = "card card-padded";
  genCard.style.marginBottom = "20px";

  const genTitle = document.createElement("div");
  genTitle.style.cssText = "font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:14px";
  genTitle.textContent = "Generate New Payroll Period";
  genCard.appendChild(genTitle);

  const genRow = document.createElement("div");
  genRow.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end";

  // Department selector
  const deptOpts = db.departments.map(d => [d.department_id, d.department_name]);
  const fDept = makeSelect([["", "Select Department"], ...deptOpts], selectedDept);
  fDept.style.minWidth = "180px";
  fDept.addEventListener("change", e => { selectedDept = e.target.value; });

  // Year
  const years = [];
  const curY  = new Date().getFullYear();
  for (let y = curY; y >= curY - 3; y--) years.push([y, String(y)]);
  const fYear = makeSelect(years, selectedYear);
  fYear.style.width = "100px";
  fYear.addEventListener("change", e => { selectedYear = parseInt(e.target.value); });

  // Month
  const monthNames = ["January","February","March","April","May","June",
                      "July","August","September","October","November","December"];
  const monthOpts  = monthNames.map((m, i) => [i + 1, m]);
  const fMonth     = makeSelect(monthOpts, selectedMonth);
  fMonth.style.width = "130px";
  fMonth.addEventListener("change", e => { selectedMonth = parseInt(e.target.value); });

  const previewBtn = document.createElement("button");
  previewBtn.className = "btn btn-outline";
  previewBtn.textContent = "Preview";
  previewBtn.addEventListener("click", () => openPreviewModal());

  const genBtn = document.createElement("button");
  genBtn.className = "btn btn-primary";
  genBtn.innerHTML = `${icons.plus} Generate`;
  genBtn.addEventListener("click", () => generatePeriod());

  genRow.appendChild(buildField("Department", fDept));
  genRow.appendChild(buildField("Year",       fYear));
  genRow.appendChild(buildField("Month",      fMonth));
  genRow.appendChild(previewBtn);
  genRow.appendChild(genBtn);
  genCard.appendChild(genRow);
  page.appendChild(genCard);

  // ── Periods table ─────────────────────────────────
  const tableCard = document.createElement("div");
  tableCard.className = "card";

  const tableHeader = document.createElement("div");
  tableHeader.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;padding:20px 24px 0";

  const tableTitle = document.createElement("div");
  tableTitle.style.cssText = "font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted)";
  tableTitle.textContent = "Payroll Periods";
  tableHeader.appendChild(tableTitle);

  // Filters row
  const filtersRow = document.createElement("div");
  filtersRow.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;align-items:center";

  // Department filter
  const filterDept = makeSelect([["", "All Departments"], ...deptOpts], "");
  filterDept.style.width = "160px";

  // Year filter
  const filterYears = [["", "All Years"]];
  for (let y = curY; y >= curY - 3; y--) filterYears.push([y, String(y)]);
  const filterYear = makeSelect(filterYears, "");
  filterYear.style.width = "100px";

  // Month filter
  const filterMonthOpts = [["", "All Months"], ...monthNames.map((m, i) => [i + 1, m])];
  const filterMonth = makeSelect(filterMonthOpts, "");
  filterMonth.style.width = "120px";

  // Status filter
  const filterStatus = makeSelect([["", "All Statuses"], ["Draft", "Draft"], ["Approved", "Approved"]], "");
  filterStatus.style.width = "120px";

  filtersRow.appendChild(filterDept);
  filtersRow.appendChild(filterYear);
  filtersRow.appendChild(filterMonth);
  filtersRow.appendChild(filterStatus);
  tableHeader.appendChild(filtersRow);

  tableCard.appendChild(tableHeader);

  const tableWrap = document.createElement("div");
  tableCard.appendChild(tableWrap);
  page.appendChild(tableCard);

  async function loadPeriods(deptFilter) {
    try {
      periods = await fetchPayrollPeriods(deptFilter || null);
      renderTable();
    } catch (err) {
      showToast(err.message || "Could not load payroll periods.", "error");
    }
  }

  [filterDept, filterYear, filterMonth, filterStatus].forEach(el => {
    el.addEventListener("change", () => {
      loadPeriods(filterDept.value);
    });
  });

  function renderTable() {
    tableWrap.innerHTML = "";
    // Apply client-side year/month/status filters
    const yearVal   = filterYear.value   ? parseInt(filterYear.value)   : null;
    const monthVal  = filterMonth.value  ? parseInt(filterMonth.value)  : null;
    const statusVal = filterStatus.value || null;

    const visible = periods.filter(p => {
      if (yearVal   && p.period_year  !== yearVal)   return false;
      if (monthVal  && p.period_month !== monthVal)  return false;
      if (statusVal && p.status       !== statusVal) return false;
      return true;
    });

    const rows = visible.map(p => {
      const statusColor = p.status === "Approved" ? "#16a34a" : "#d97706";
      const monthLabel  = monthNames[p.period_month - 1];

      const viewBtn = document.createElement("button");
      viewBtn.className = "btn btn-ghost btn-sm";
      viewBtn.innerHTML = `${icons.eye} View Records`;
      viewBtn.addEventListener("click", () => openRecordsModal(p));

      const approveBtn = document.createElement("button");
      if (p.status === "Draft") {
        approveBtn.className = "btn btn-ghost btn-sm";
        approveBtn.style.color = "var(--emerald, #10b981)";
        approveBtn.textContent = "Approve";
        approveBtn.addEventListener("click", () => confirmApprove(p));
      }

      const unapproveBtn = document.createElement("button");
      if (p.status === "Approved") {
        unapproveBtn.className = "btn btn-ghost btn-sm";
        unapproveBtn.style.color = "var(--red, #ef4444)";
        unapproveBtn.textContent = "Unapprove";
        unapproveBtn.addEventListener("click", () => confirmUnapprove(p));
      }

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";
      actions.appendChild(viewBtn);
      if (p.status === "Draft") actions.appendChild(approveBtn);
      if (p.status === "Approved") actions.appendChild(unapproveBtn);

      return [
        `<span class="font-medium text-sm">${p.department_name}</span>`,
        `<span class="mono text-xs">${monthLabel} ${p.period_year}</span>`,
        `<span class="text-xs" style="color:${statusColor};font-weight:600">${p.status}</span>`,
        `<span class="mono text-xs text-gray">${p.generated_at ? fmtDate(p.generated_at) : "—"}</span>`,
        `<span class="mono text-xs text-gray">${p.approved_at ? fmtDate(p.approved_at) : "—"}</span>`,
        actions,
      ];
    });

    tableWrap.appendChild(buildTable(
      ["Department", "Period", "Status", "Generated", "Approved", ""],
      rows,
      "No payroll periods found. Generate one above."
    ));
  }

  async function generatePeriod() {
    if (!selectedDept) { showToast("Please select a department.", "error"); return; }
    if (loading) return;
    loading = true;
    genBtn.disabled = true;
    genBtn.textContent = "Generating…";
    try {
      const result = await generatePayrollRequest(Number(selectedDept), selectedYear, selectedMonth);
      showToast(`Payroll generated: ${result.record_count} employee(s). Review before approving.`, "success");
      await loadPeriods(filterDept.value);
    } catch (err) {
      showToast(err.message || "Could not generate payroll.", "error");
    } finally {
      loading = false;
      genBtn.disabled = false;
      genBtn.innerHTML = `${icons.plus} Generate`;
    }
  }

  // ── Approve confirmation modal ────────────────────
  function confirmApprove(p) {
    const monthLabel = monthNames[p.period_month - 1];

    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "18px";

    const message = document.createElement("p");
    message.className = "text-sm";
    message.textContent = `Are you sure you want to approve payroll for ${p.department_name} — ${monthLabel} ${p.period_year}? This locks all records and cannot be undone.`;
    body.appendChild(message);

    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-outline";
    cancelBtn.textContent = "Cancel";

    const approveBtn = document.createElement("button");
    approveBtn.className = "btn btn-primary";
    approveBtn.innerHTML = `${icons.check} Approve`;

    footer.appendChild(cancelBtn);
    footer.appendChild(approveBtn);
    body.appendChild(footer);

    const { close } = openModal({ title: "Approve Payroll Period", body });
    cancelBtn.addEventListener("click", close);

    approveBtn.addEventListener("click", async () => {
      approveBtn.disabled = true;
      try {
        await approvePayrollPeriodRequest(p.period_id);
        close();
        showToast("Payroll period approved and locked.", "success");
        await loadPeriods(filterDept.value);
      } catch (err) {
        showToast(err.message || "Could not approve period.", "error");
        approveBtn.disabled = false;
      }
    });
  }

  // ── Unapprove confirmation modal ──────────────────
  function confirmUnapprove(p) {
    const monthLabel = monthNames[p.period_month - 1];

    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "18px";

    const message = document.createElement("p");
    message.className = "text-sm";
    message.textContent = `Are you sure you want to revert payroll for ${p.department_name} — ${monthLabel} ${p.period_year} back to Draft? Records will become editable again.`;
    body.appendChild(message);

    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const keepBtn = document.createElement("button");
    keepBtn.className = "btn btn-outline";
    keepBtn.textContent = "Keep Approved";

    const unapproveBtn = document.createElement("button");
    unapproveBtn.className = "btn btn-danger";
    unapproveBtn.textContent = "Unapprove";

    footer.appendChild(keepBtn);
    footer.appendChild(unapproveBtn);
    body.appendChild(footer);

    const { close } = openModal({ title: "Unapprove Payroll Period", body });
    keepBtn.addEventListener("click", close);

    unapproveBtn.addEventListener("click", async () => {
      unapproveBtn.disabled = true;
      try {
        await unapprovePayrollPeriodRequest(p.period_id);
        close();
        showToast("Payroll period reverted to Draft.", "success");
        await loadPeriods(filterDept.value);
      } catch (err) {
        showToast(err.message || "Could not unapprove period.", "error");
        unapproveBtn.disabled = false;
      }
    });
  }

  // ── Preview modal ─────────────────────────────────
  async function openPreviewModal() {
    if (!selectedDept) { showToast("Please select a department.", "error"); return; }
    const monthLabel = monthNames[selectedMonth - 1];

    const overlay = document.createElement("div");
    overlay.style.cssText = "display:flex;align-items:center;justify-content:center;padding:16px";
    overlay.textContent = "Loading preview…";

    const { close } = openModal({
      title: `Payroll Preview — ${monthLabel} ${selectedYear}`,
      body: overlay,
      wide: true,
    });

    try {
      const preview = await previewPayrollRequest(Number(selectedDept), selectedYear, selectedMonth);
      overlay.textContent = "";
      overlay.appendChild(buildRecordsTable(preview.records, false));

      if (preview.already_exists) {
        const warn = document.createElement("div");
        warn.className = "alert-error";
        warn.style.marginTop = "12px";
        warn.textContent = `A ${preview.existing_status} period already exists for this department and month.`;
        overlay.appendChild(warn);
      }
    } catch (err) {
      overlay.textContent = err.message || "Could not load preview.";
    }
  }

  // ── Records modal ─────────────────────────────────
  async function openRecordsModal(period) {
    const monthLabel = monthNames[period.period_month - 1];
    const isApproved = period.status === "Approved";

    const wrap = document.createElement("div");
    wrap.textContent = "Loading…";

    const { close } = openModal({
      title: `${period.department_name} — ${monthLabel} ${period.period_year} (${period.status})`,
      body: wrap,
      wide: true,
    });

    try {
      const data = await fetchPayrollRecords(period.period_id);
      wrap.innerHTML = "";

      // Summary totals
      const totals = data.records.reduce((acc, r) => {
        acc.regular_hours  += r.regular_hours;
        acc.overtime_hours += r.overtime_hours;
        acc.regular_pay    += r.regular_pay;
        acc.overtime_pay   += r.overtime_pay;
        acc.net_pay        += r.net_pay;
        return acc;
      }, { regular_hours: 0, overtime_hours: 0, regular_pay: 0, overtime_pay: 0, net_pay: 0 });

      const summaryStrip = document.createElement("div");
      summaryStrip.style.cssText = "display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap";
      const pills = [
        { label: "Total Regular Hours", value: totals.regular_hours.toFixed(1) + "h", color: "#6366f1" },
        { label: "Total OT Hours",      value: totals.overtime_hours.toFixed(1) + "h",color: "#f97316" },
        { label: "Total Regular Pay",   value: "₱" + totals.regular_pay.toLocaleString("en-PH", {minimumFractionDigits:2}), color: "#6366f1" },
        { label: "Total OT Pay",        value: "₱" + totals.overtime_pay.toLocaleString("en-PH", {minimumFractionDigits:2}), color: "#f97316" },
        { label: "Total Net Pay",       value: "₱" + totals.net_pay.toLocaleString("en-PH", {minimumFractionDigits:2}), color: "#16a34a" },
      ];
      pills.forEach(p => {
        const pill = document.createElement("div");
        pill.style.cssText = `background:#fff;border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:10px 16px;display:flex;align-items:center;gap:10px`;
        pill.innerHTML = `<span style="font-size:1.1rem;font-weight:800;color:${p.color}">${p.value}</span><span style="font-size:0.72rem;color:var(--text-muted);font-weight:500">${p.label}</span>`;
        summaryStrip.appendChild(pill);
      });
      wrap.appendChild(summaryStrip);

      wrap.appendChild(buildRecordsTable(data.records, !isApproved, async (rec, changes) => {
        try {
          await updatePayrollRecordRequest(rec.record_id, changes);
          showToast("Record updated.", "success");
          close();
          openRecordsModal(period);
        } catch (err) {
          showToast(err.message || "Could not update record.", "error");
        }
      }));

      // Footer buttons
      const footer = document.createElement("div");
      footer.className = "modal-footer";
      footer.style.marginTop = "16px";

      const closeBtn = document.createElement("button");
      closeBtn.className = "btn btn-outline";
      closeBtn.textContent = "Close";
      closeBtn.addEventListener("click", close);
      footer.appendChild(closeBtn);

      if (!isApproved) {
        const approveBtn = document.createElement("button");
        approveBtn.className = "btn btn-primary";
        approveBtn.innerHTML = `${icons.check} Approve Period`;
        approveBtn.addEventListener("click", async () => {
          const monthLabel2 = monthNames[period.period_month - 1];
          if (!confirm(`Approve payroll for ${period.department_name} — ${monthLabel2} ${period.period_year}? This locks all records.`)) return;
          try {
            await approvePayrollPeriodRequest(period.period_id);
            showToast("Payroll period approved and locked.", "success");
            close();
            await loadPeriods(filterDept.value);
          } catch (err) {
            showToast(err.message || "Could not approve.", "error");
          }
        });
        footer.appendChild(approveBtn);
      }
      wrap.appendChild(footer);
    } catch (err) {
      wrap.textContent = err.message || "Could not load records.";
    }
  }

  // ── Shared: records table ──────────────────────────
  function buildRecordsTable(records, editable, onEdit) {
    if (!records || !records.length) {
      const empty = document.createElement("div");
      empty.className = "table-empty";
      empty.textContent = "No payroll records found.";
      return empty;
    }

    const headers = ["Employee", "Reg. Hours", "OT Hours", "Reg. Pay", "OT Pay", "Bonus", "Deductions", "Net Pay"];
    if (editable) headers.push("");

    const rows = records.map(r => {
      const fmt = (n) => "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 });
      const baseRow = [
        `<span class="font-medium text-sm">${r.full_name || "—"}</span>`,
        `<span class="mono text-xs">${Number(r.regular_hours).toFixed(2)}h</span>`,
        `<span class="mono text-xs" style="color:${r.overtime_hours > 0 ? "#f97316" : "inherit"}">${Number(r.overtime_hours).toFixed(2)}h</span>`,
        `<span class="mono text-xs">${fmt(r.regular_pay)}</span>`,
        `<span class="mono text-xs">${fmt(r.overtime_pay)}</span>`,
        `<span class="mono text-xs">${fmt(r.bonus)}</span>`,
        `<span class="mono text-xs">${fmt(r.deductions)}</span>`,
        `<span class="mono text-xs font-medium" style="color:#16a34a">${fmt(r.net_pay)}</span>`,
      ];

      if (editable && onEdit) {
        const editBtn = document.createElement("button");
        editBtn.className = "btn btn-ghost btn-sm";
        editBtn.innerHTML = `${icons.pencil} Edit`;
        editBtn.addEventListener("click", () => openRecordEditModal(r, onEdit));
        baseRow.push(editBtn);
      }

      return baseRow;
    });

    return buildTable(headers, rows);
  }

  // ── Record edit modal ─────────────────────────────
  function openRecordEditModal(rec, onSaved) {
    const body = document.createElement("div");
    body.style.cssText = "display:flex;flex-direction:column;gap:14px";

    const grid = document.createElement("div");
    grid.className = "grid-2";
    grid.style.gap = "14px";

    const fBonus      = makeInput("number", rec.bonus,       "0");
    const fDeductions = makeInput("number", rec.deductions,   "0");
    const fRegPay     = makeInput("number", rec.regular_pay);
    const fOtPay      = makeInput("number", rec.overtime_pay);
    const fRegHours   = makeInput("number", rec.regular_hours);
    const fOtHours    = makeInput("number", rec.overtime_hours);

    // Live net pay preview
    const netPreview = document.createElement("div");
    netPreview.style.cssText = "font-size:0.85rem;color:var(--text-muted);padding:8px 12px;background:#f8fafc;border-radius:8px;border:1px solid var(--border)";

    function updateNetPreview() {
      const net = (parseFloat(fRegPay.value)||0) + (parseFloat(fOtPay.value)||0)
                + (parseFloat(fBonus.value)||0)  - (parseFloat(fDeductions.value)||0);
      netPreview.innerHTML = `Computed Net Pay: <strong style="color:#16a34a">₱${net.toLocaleString("en-PH", {minimumFractionDigits:2})}</strong>`;
    }
    [fRegPay, fOtPay, fBonus, fDeductions].forEach(el => el.addEventListener("input", updateNetPreview));
    updateNetPreview();

    grid.appendChild(buildField("Regular Hours", fRegHours));
    grid.appendChild(buildField("Overtime Hours", fOtHours));
    grid.appendChild(buildField("Regular Pay (₱)", fRegPay));
    grid.appendChild(buildField("Overtime Pay (₱)", fOtPay));
    grid.appendChild(buildField("Bonus (₱)", fBonus));
    grid.appendChild(buildField("Deductions (₱)", fDeductions));

    body.appendChild(grid);
    body.appendChild(netPreview);

    const errEl = document.createElement("div");
    errEl.className = "alert-error";
    errEl.style.display = "none";
    body.appendChild(errEl);

    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-outline";
    cancelBtn.textContent = "Cancel";

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-primary";
    saveBtn.innerHTML = `${icons.check} Save Changes`;

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    body.appendChild(footer);

    const { close } = openModal({ title: `Edit Record — ${rec.full_name || "Employee"}`, body });
    cancelBtn.addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {
      const changes = {
        regular_hours:  parseFloat(fRegHours.value) || 0,
        overtime_hours: parseFloat(fOtHours.value)  || 0,
        regular_pay:    parseFloat(fRegPay.value)    || 0,
        overtime_pay:   parseFloat(fOtPay.value)     || 0,
        bonus:          parseFloat(fBonus.value)     || 0,
        deductions:     parseFloat(fDeductions.value)|| 0,
      };
      saveBtn.disabled = true;
      errEl.style.display = "none";
      try {
        await onSaved(rec, changes);
        close();
      } catch (err) {
        errEl.textContent = err.message || "Could not save.";
        errEl.style.display = "block";
        saveBtn.disabled = false;
      }
    });
  }

  // Initial load
  loadPeriods("");
  return page;
}

// ═════════════════════════════════════════════════════
// EMPLOYEE: MY PAY HISTORY (TSK-39)
// ═════════════════════════════════════════════════════
function renderMyPayHistory(db, account) {
  const page = document.createElement("div");
  page.className = "page";

  page.appendChild(pageHeader("My Pay History", "Your approved payroll records"));

  const card = document.createElement("div");
  card.className = "card";
  card.style.padding = "32px";
  card.style.textAlign = "center";
  card.style.color = "var(--text-muted)";
  card.textContent = "Loading…";
  page.appendChild(card);

  (async () => {
    try {
      const records = await fetchMyPayrollHistory();
      card.innerHTML = "";
      card.style.padding = "";
      card.style.textAlign = "";
      card.style.color = "";

      if (!records || !records.length) {
        card.style.padding = "40px";
        card.style.textAlign = "center";
        card.style.color = "var(--text-muted)";
        card.textContent = "No approved payroll records yet.";
        return;
      }

      const monthNames = ["January","February","March","April","May","June",
                          "July","August","September","October","November","December"];
      const fmt = (n) => "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 });

      const rows = records.map(r => [
        `<span class="mono text-xs">${monthNames[r.period_month - 1]} ${r.period_year}</span>`,
        `<span class="text-xs">${r.department_name || "—"}</span>`,
        `<span class="mono text-xs">${Number(r.regular_hours).toFixed(2)}h</span>`,
        `<span class="mono text-xs" style="color:${r.overtime_hours > 0 ? "#f97316" : "inherit"}">${Number(r.overtime_hours).toFixed(2)}h</span>`,
        `<span class="mono text-xs">${fmt(r.regular_pay)}</span>`,
        `<span class="mono text-xs">${fmt(r.overtime_pay)}</span>`,
        `<span class="mono text-xs">${fmt(r.bonus)}</span>`,
        `<span class="mono text-xs">${fmt(r.deductions)}</span>`,
        `<span class="mono text-sm font-medium" style="color:#16a34a">${fmt(r.net_pay)}</span>`,
      ]);

      card.appendChild(buildTable(
        ["Period", "Department", "Reg. Hours", "OT Hours", "Reg. Pay", "OT Pay", "Bonus", "Deductions", "Net Pay"],
        rows,
        "No payroll records."
      ));
    } catch (err) {
      card.textContent = err.message || "Could not load pay history.";
    }
  })();

  return page;
}
