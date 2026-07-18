function renderLeaveBalances(db, account, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  const isPrivileged = account && ["system_admin", "payroll_admin"].includes(account.access_level);
  const isSupervisor = account && account.access_level === "supervisor";

  let searchVal = "";
  let filterType = "";
  let filterYear = new Date().getFullYear();
  let balanceRows = [];
  let loading = false;
  let loadErr = null;

  async function reloadBalances() {
    loading = true;
    loadErr = null;
    page.innerHTML = "";
    const loadingEl = document.createElement("div");
    loadingEl.style.cssText = "padding:32px;text-align:center;color:var(--text-muted);font-size:.85rem;";
    loadingEl.textContent = "Loading leave balances…";
    page.appendChild(loadingEl);

    try {
      const params = new URLSearchParams();
      if (filterYear) params.set("year", filterYear);
      balanceRows = await apiRequest(`/leave_balances.php?${params.toString()}`);
    } catch (err) {
      loadErr = err.message || "Could not load leave balances.";
    }

    loading = false;
    render();
  }

  function render() {
    page.innerHTML = "";

    let headerActions = null;
    if (isPrivileged) {
      headerActions = document.createElement("div");
      headerActions.style.cssText = "display:flex;gap:8px;";

      const rolloverBtn = document.createElement("button");
      rolloverBtn.className = "btn btn-outline";
      rolloverBtn.innerHTML = `${icons.history || ""} Roll Over to New Year`;
      rolloverBtn.addEventListener("click", () => openRolloverModal());
      headerActions.appendChild(rolloverBtn);

      const addBtn = document.createElement("button");
      addBtn.className = "btn btn-primary";
      addBtn.innerHTML = `${icons.plus} Grant Leave Balance`;
      addBtn.addEventListener("click", () => openBalanceModal(null));
      headerActions.appendChild(addBtn);
    }

    page.appendChild(pageHeader(
      "Leave Balances",
      "Manage employee leave entitlements and tracking",
      headerActions
    ));

    // Filter card
    const filterCard = document.createElement("div");
    filterCard.className = "card";
    filterCard.style.padding = "14px 18px";
    filterCard.style.marginBottom = "16px";

    const filterRow = document.createElement("div");
    filterRow.style.cssText = "display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;";

    // Search bar
    const searchBar = buildSearchBar({
      placeholder: "Search employee…",
      value: searchVal,
      onInput: (v) => { searchVal = v; renderTable(); },
      flex: true
    });
    filterRow.appendChild(searchBar);

    // Leave Type Filter
    const typeOpts = [["", "All Leave Types"], ...db.leaveTypes.map(t => [t.leave_type_id, t.leave_name])];
    const typeSel = makeSelect(typeOpts, filterType);
    typeSel.addEventListener("change", e => {
      filterType = e.target.value;
      renderTable();
    });
    filterRow.appendChild(buildField("Leave Type", typeSel));

    // Year Input Filter
    const yearInp = makeInput("number", filterYear, "Year");
    yearInp.style.width = "90px";
    yearInp.addEventListener("change", e => {
      filterYear = Number(e.target.value) || new Date().getFullYear();
      reloadBalances();
    });
    filterRow.appendChild(buildField("Year", yearInp));

    // Clear filters
    const clearBtn = document.createElement("button");
    clearBtn.className = "btn btn-outline btn-sm";
    clearBtn.textContent = "Clear filters";
    clearBtn.addEventListener("click", () => {
      filterType = "";
      filterYear = new Date().getFullYear();
      searchVal = "";
      typeSel.value = "";
      yearInp.value = filterYear;
      searchBar.querySelector("input").value = "";
      reloadBalances();
    });
    filterRow.appendChild(clearBtn);

    filterCard.appendChild(filterRow);
    page.appendChild(filterCard);

    // Table card
    const tableCard = document.createElement("div");
    tableCard.className = "card";
    page.appendChild(tableCard);

    renderTable(tableCard);
  }

  function renderTable(container = page.querySelector(".card:last-child")) {
    if (!container) return;

    const oldTable = container.querySelector(".table-wrap, .table-empty-wrap, .alert-error");
    if (oldTable) oldTable.remove();

    if (loadErr) {
      const errBox = document.createElement("div");
      errBox.className = "alert-error";
      errBox.style.margin = "14px";
      errBox.textContent = loadErr;
      container.appendChild(errBox);
      return;
    }

    const term = searchVal.toLowerCase().trim();
    const filtered = balanceRows.filter(r => {
      if (filterType && String(r.leave_type_id) !== String(filterType)) return false;
      if (!term) return true;
      return (r.employee_name || "").toLowerCase().includes(term);
    });

    const rows = filtered.map(r => {
      let actions = "—";
      if (isPrivileged) {
        const editBtn = document.createElement("button");
        editBtn.className = "btn btn-ghost btn-sm";
        editBtn.innerHTML = `${icons.pencil} Edit`;
        editBtn.addEventListener("click", () => openBalanceModal(r));

        const delBtn = document.createElement("button");
        delBtn.className = "btn btn-ghost btn-sm";
        delBtn.style.color = "var(--red, #ef4444)";
        delBtn.textContent = "Delete";
        delBtn.addEventListener("click", () => deleteBalance(r));

        const div = document.createElement("div");
        div.style.cssText = "display:flex;gap:6px";
        div.appendChild(editBtn);
        div.appendChild(delBtn);
        actions = div;
      }

      return [
        `<span class="font-medium text-sm">${r.employee_name}</span>`,
        `<span class="text-xs text-gray font-medium">${r.leave_type_name}</span>`,
        `<span class="mono text-xs">${r.year}</span>`,
        `<span class="mono text-xs">${Number(r.entitled_days).toFixed(1)}d</span>`,
        `<span class="mono text-xs">${Number(r.carried_over_days).toFixed(1)}d</span>`,
        `<span class="mono text-xs font-semibold text-gray">${Number(r.used_days).toFixed(1)}d</span>`,
        `<span class="mono text-sm font-bold" style="color: ${r.remaining_days > 0 ? '#16a34a' : 'var(--red, #ef4444)'}">${Number(r.remaining_days).toFixed(1)}d</span>`,
        actions
      ];
    });

    const headers = ["Employee", "Leave Type", "Year", "Entitled", "Carried Over", "Used", "Remaining", ""];
    container.appendChild(buildTable(headers, rows, "No leave balances found for this selection."));
  }

  function deleteBalance(r) {
    openConfirmModal({
      title: "Delete Leave Balance",
      message: `Are you sure you want to delete the ${r.year} ${r.leave_type_name} balance for "${r.employee_name}"?`,
      keepLabel: "Keep Balance",
      confirmLabel: "Delete Balance",
      onConfirm: async () => {
        await apiRequest(`/leave_balances.php?id=${r.balance_id}`, { method: "DELETE" });
        await reloadBalances();
        showToast("Leave balance record deleted successfully.", "success");
      }
    });
  }

  function openRolloverModal() {
    const thisYear = new Date().getFullYear();
    const body = document.createElement("div");
    body.style.cssText = "display:flex;flex-direction:column;gap:14px";

    const note = document.createElement("p");
    note.className = "text-sm text-gray";
    note.textContent = "Creates next year's balance rows for every employee/leave-type combo that has a balance in the source year. Unused remaining days carry over as \"carried over days\"; entitled days reset to each leave type's default. Employees who already have a balance for the target year are skipped.";
    body.appendChild(note);

    const fFrom = makeInput("number", thisYear - 1);
    const fTo = makeInput("number", thisYear);

    const fCap = makeInput("number", "");
    fCap.placeholder = "No cap (optional)";
    fCap.min = "0";
    fCap.step = "0.5";

    const grid = document.createElement("div");
    grid.className = "grid-2";
    grid.style.gap = "14px";
    grid.appendChild(buildField("From Year", fFrom));
    grid.appendChild(buildField("To Year", fTo));

    body.appendChild(grid);
    body.appendChild(buildField("Max Carry-Over Days (optional cap)", fCap));

    const errEl = document.createElement("div");
    errEl.className = "alert-error";
    errEl.style.display = "none";
    body.appendChild(errEl);

    const footer = document.createElement("div");
    footer.className = "modal-footer";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-outline";
    cancelBtn.textContent = "Cancel";
    const runBtn = document.createElement("button");
    runBtn.className = "btn btn-primary";
    runBtn.innerHTML = `${icons.check} Run Rollover`;
    footer.appendChild(cancelBtn);
    footer.appendChild(runBtn);
    body.appendChild(footer);

    const { close } = openModal({ title: "Roll Over Leave Balances", body });
    cancelBtn.addEventListener("click", close);

    runBtn.addEventListener("click", async () => {
      const fromYear = Number(fFrom.value);
      const toYear = Number(fTo.value);
      const cap = fCap.value === "" ? null : parseFloat(fCap.value);

      if (!fromYear || !toYear) {
        errEl.textContent = "Both years are required.";
        errEl.style.display = "block";
        return;
      }
      if (toYear <= fromYear) {
        errEl.textContent = "To Year must be after From Year.";
        errEl.style.display = "block";
        return;
      }

      errEl.style.display = "none";
      runBtn.disabled = true;

      try {
        const result = await apiRequest("/leave_balances.php?action=rollover", {
          method: "POST",
          body: JSON.stringify({ from_year: fromYear, to_year: toYear, carry_over_cap: cap }),
        });
        close();
        showToast(result.message || "Rollover complete.", "success");
        filterYear = toYear;
        await reloadBalances();
      } catch (err) {
        errEl.textContent = err.message || "Could not run rollover.";
        errEl.style.display = "block";
      } finally {
        runBtn.disabled = false;
      }
    });
  }

  function openBalanceModal(existing) {
    if (!isPrivileged) return;
    const isEdit = !!existing;
    const data = isEdit ? { ...existing } : {
      employee_id: "", leave_type_id: "", year: new Date().getFullYear(), entitled_days: 15.0, carried_over_days: 0.0, used_days: 0.0
    };

    const body = document.createElement("div");
    body.style.cssText = "display:flex;flex-direction:column;gap:14px";

    let fEmp;
    if (isEdit) {
      fEmp = document.createElement("span");
      fEmp.className = "text-sm font-medium";
      fEmp.textContent = data.employee_name;
    } else {
      const empOpts = [["", "Select Employee"], ...db.employees.map(e => [e.employee_id, `${e.first_name} ${e.last_name}`])];
      fEmp = makeSelect(empOpts, data.employee_id);
    }

    let fType;
    if (isEdit) {
      fType = document.createElement("span");
      fType.className = "text-xs font-semibold text-gray";
      fType.textContent = data.leave_type_name;
    } else {
      const typeOpts = [["", "Select Leave Type"], ...db.leaveTypes.map(t => [t.leave_type_id, t.leave_name])];
      fType = makeSelect(typeOpts, data.leave_type_id);
    }

    const fYear = makeInput("number", data.year, "Year");
    
    // Numbers
    const fEntitled = makeInput("number", data.entitled_days);
    fEntitled.step = "0.5";
    fEntitled.min = "0";

    const fCarried = makeInput("number", data.carried_over_days);
    fCarried.step = "0.5";
    fCarried.min = "0";

    const fUsed = makeInput("number", data.used_days);
    fUsed.step = "0.5";
    fUsed.min = "0";

    // Auto calculate helper label
    const calcEl = document.createElement("div");
    calcEl.style.cssText = "font-size:0.75rem;font-weight:600;color:var(--text-muted);margin-top:2px;";
    
    function updateCalc() {
      const ent = parseFloat(fEntitled.value) || 0.0;
      const car = parseFloat(fCarried.value) || 0.0;
      const usd = parseFloat(fUsed.value) || 0.0;
      const rem = ent + car - usd;
      calcEl.innerHTML = `Calculated Remaining: <span style="color: ${rem >= 0 ? '#16a34a' : 'var(--red, #ef4444)'}">${rem.toFixed(1)} days</span>`;
    }
    
    [fEntitled, fCarried, fUsed].forEach(inp => inp.addEventListener("input", updateCalc));
    updateCalc();

    const grid1 = document.createElement("div");
    grid1.className = "grid-2";
    grid1.style.gap = "14px";
    grid1.appendChild(buildField("Leave Type", fType));
    grid1.appendChild(buildField("Year", fYear));

    const grid2 = document.createElement("div");
    grid2.className = "grid-3";
    grid2.style.gap = "10px";
    grid2.appendChild(buildField("Entitled Days", fEntitled));
    grid2.appendChild(buildField("Carried Over", fCarried));
    grid2.appendChild(buildField("Used Days", fUsed));

    body.appendChild(buildField("Employee", fEmp));
    body.appendChild(grid1);
    body.appendChild(grid2);
    body.appendChild(calcEl);

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
    saveBtn.innerHTML = `${icons.check} ${isEdit ? "Save Changes" : "Grant Entitlement"}`;
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    body.appendChild(footer);

    const { close } = openModal({
      title: isEdit ? "Modify Leave Balance" : "Grant Employee Leave Balance",
      body
    });

    cancelBtn.addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {
      const employeeId = isEdit ? data.employee_id : fEmp.value;
      const leaveTypeId = isEdit ? data.leave_type_id : fType.value;
      const year = fYear.value;
      const entitled = parseFloat(fEntitled.value) || 0.0;
      const carried = parseFloat(fCarried.value) || 0.0;
      const used = parseFloat(fUsed.value) || 0.0;

      if (!employeeId) { errEl.textContent = "Employee is required."; errEl.style.display = "block"; return; }
      if (!leaveTypeId) { errEl.textContent = "Leave type is required."; errEl.style.display = "block"; return; }
      if (!year) { errEl.textContent = "Year is required."; errEl.style.display = "block"; return; }

      const payload = {
        employee_id: Number(employeeId),
        leave_type_id: Number(leaveTypeId),
        year: Number(year),
        entitled_days: entitled,
        carried_over_days: carried,
        used_days: used
      };
      if (isEdit) payload.balance_id = data.balance_id;

      errEl.style.display = "none";
      saveBtn.disabled = true;

      try {
        await apiRequest("/leave_balances.php", {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify(payload),
        });
        await reloadBalances();
        close();
        showToast(isEdit ? "Leave balance updated." : "Leave balance granted.", "success");
      } catch (err) {
        errEl.textContent = err.message || "Could not save leave balance.";
        errEl.style.display = "block";
        saveBtn.disabled = false;
      }
    });
  }

  reloadBalances();
  return page;
}
