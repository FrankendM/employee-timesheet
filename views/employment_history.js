function renderEmploymentHistory(db, account, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  const isPrivileged = account && ["system_admin", "payroll_admin"].includes(account.access_level);
  const isSupervisor = account && account.access_level === "supervisor";

  let searchVal = "";
  let filterEmp = "";
  let historyRows = [];
  let loading = false;
  let loadErr = null;

  async function reloadHistory() {
    loading = true;
    loadErr = null;
    page.innerHTML = "";
    const loadingEl = document.createElement("div");
    loadingEl.style.cssText = "padding:32px;text-align:center;color:var(--text-muted);font-size:.85rem;";
    loadingEl.textContent = "Loading history…";
    page.appendChild(loadingEl);

    try {
      const params = new URLSearchParams();
      if (filterEmp) params.set("employee_id", filterEmp);
      historyRows = await apiRequest(`/employment_history.php?${params.toString()}`);
    } catch (err) {
      loadErr = err.message || "Could not load history.";
    }

    loading = false;
    render();
  }

  function render() {
    page.innerHTML = "";

    let addBtn = null;
    if (isPrivileged) {
      addBtn = document.createElement("button");
      addBtn.className = "btn btn-primary";
      addBtn.innerHTML = `${icons.plus} Log Transition`;
      addBtn.addEventListener("click", () => openHistoryModal(null));
    }

    page.appendChild(pageHeader(
      "Employment History",
      "Historical record of department, role, status, and type changes",
      addBtn
    ));

    // Filter bar card
    const filterCard = document.createElement("div");
    filterCard.className = "card";
    filterCard.style.padding = "14px 18px";
    filterCard.style.marginBottom = "16px";

    const filterRow = document.createElement("div");
    filterRow.style.cssText = "display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;";

    // Search bar
    const searchBar = buildSearchBar({
      placeholder: "Search remarks or changed-by…",
      value: searchVal,
      onInput: (v) => { searchVal = v; renderTable(); },
      flex: true
    });
    filterRow.appendChild(searchBar);

    // Employee Filter dropdown
    let visibleEmployees = db.employees || [];
    if (isSupervisor) {
      const deptId = currentDepartmentId();
      visibleEmployees = visibleEmployees.filter(e => e.department_id === deptId);
    }
    const empOpts = [["", "All Employees"], ...visibleEmployees.map(e => [e.employee_id, `${e.first_name} ${e.last_name}`])];
    const empSel = makeSelect(empOpts, filterEmp);
    empSel.addEventListener("change", e => {
      filterEmp = e.target.value;
      reloadHistory();
    });
    filterRow.appendChild(buildField("Filter Employee", empSel));

    // Clear filters
    const clearBtn = document.createElement("button");
    clearBtn.className = "btn btn-outline btn-sm";
    clearBtn.textContent = "Clear filters";
    clearBtn.addEventListener("click", () => {
      filterEmp = "";
      searchVal = "";
      empSel.value = "";
      searchBar.querySelector("input").value = "";
      reloadHistory();
    });
    filterRow.appendChild(clearBtn);

    filterCard.appendChild(filterRow);
    page.appendChild(filterCard);

    // Table container card
    const tableCard = document.createElement("div");
    tableCard.className = "card";
    page.appendChild(tableCard);

    renderTable(tableCard);
  }

  function renderTable(container = page.querySelector(".card:last-child")) {
    if (!container) return;
    
    // Clear previous table
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
    const filtered = historyRows.filter(r => {
      if (!term) return true;
      return (r.remarks || "").toLowerCase().includes(term) ||
             (r.changed_by_username || "").toLowerCase().includes(term) ||
             (r.employee_name || "").toLowerCase().includes(term);
    });

    const rows = filtered.map(r => {
      let actions = "—";
      if (isPrivileged) {
        const editBtn = document.createElement("button");
        editBtn.className = "btn btn-ghost btn-sm";
        editBtn.innerHTML = `${icons.pencil} Edit`;
        editBtn.addEventListener("click", () => openHistoryModal(r));

        const delBtn = document.createElement("button");
        delBtn.className = "btn btn-ghost btn-sm";
        delBtn.style.color = "var(--red, #ef4444)";
        delBtn.textContent = "Delete";
        delBtn.addEventListener("click", () => deleteHistory(r));

        const div = document.createElement("div");
        div.style.cssText = "display:flex;gap:6px";
        div.appendChild(editBtn);
        div.appendChild(delBtn);
        actions = div;
      }

      const activeBadge = r.effective_to 
        ? `<span class="mono text-xs text-gray">${fmtDate(r.effective_from)} to ${fmtDate(r.effective_to)}</span>`
        : `<span class="badge badge-active">Active since ${fmtDate(r.effective_from)}</span>`;

      return [
        `<span class="font-medium text-xs">${r.employee_name}</span>`,
        `<span class="text-xs text-gray">${r.department_name || "—"}</span>`,
        `<span class="text-xs text-gray">${r.role_name || "—"}</span>`,
        `<span class="badge ${badgeClass(r.employment_status)}">${r.employment_status || "—"}</span>`,
        `<span class="text-xs text-gray">${r.employment_type_name || "—"}</span>`,
        activeBadge,
        `<span class="text-xs text-gray" style="display:inline-block;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.remarks || ''}">${r.remarks || "—"}</span>`,
        `<span class="mono text-xs text-gray">${r.changed_by_username || "system"}</span>`,
        actions
      ];
    });

    const tableHeaders = ["Employee", "Department", "Role", "Status", "Type", "Effective Period", "Remarks", "Changed By", ""];
    container.appendChild(buildTable(tableHeaders, rows, "No employment history records found."));
  }

  function deleteHistory(r) {
    openConfirmModal({
      title: "Delete History Log",
      message: `Are you sure you want to delete this history log for "${r.employee_name}" from ${r.effective_from}?`,
      keepLabel: "Keep Log",
      confirmLabel: "Delete Log",
      onConfirm: async () => {
        await apiRequest(`/employment_history.php?id=${r.history_id}`, { method: "DELETE" });
        await reloadHistory();
        showToast("History log deleted successfully.", "success");
      }
    });
  }

  function openHistoryModal(existing) {
    if (!isPrivileged) return;
    const isEdit = !!existing;
    const data = isEdit ? { ...existing } : {
      employee_id: "", department_id: "", role_id: "", employment_status_id: "", employment_type_id: "",
      effective_from: todayStr(), effective_to: "", remarks: ""
    };

    const body = document.createElement("div");
    body.style.cssText = "display:flex;flex-direction:column;gap:14px";

    // Build fields
    let fEmp;
    if (isEdit) {
      fEmp = document.createElement("span");
      fEmp.className = "text-sm font-medium";
      fEmp.textContent = data.employee_name;
    } else {
      const empOpts = [["", "Select Employee"], ...db.employees.map(e => [e.employee_id, `${e.first_name} ${e.last_name}`])];
      fEmp = makeSelect(empOpts, data.employee_id);
    }

    const deptOpts = [["", "No Department"], ...db.departments.map(d => [d.department_id, d.department_name])];
    const fDept = makeSelect(deptOpts, data.department_id || "");

    const roleOpts = [["", "No Role"], ...db.roles.map(r => [r.role_id, r.role_name])];
    const fRole = makeSelect(roleOpts, data.role_id || "");

    const statusOpts = [["", "No Status"], ...db.employmentStatuses.map(s => [s.employment_status_id, s.status_name])];
    const fStatus = makeSelect(statusOpts, data.employment_status_id || "");

    const typeOpts = [["", "No Type"], ...db.employmentTypes.map(t => [t.employment_type_id, t.type_name])];
    const fType = makeSelect(typeOpts, data.employment_type_id || "");

    const fFrom = makeInput("date", data.effective_from);
    const fTo = makeInput("date", data.effective_to || "");
    const fRemarks = makeInput("text", data.remarks, "Reason for transition");

    const grid1 = document.createElement("div");
    grid1.className = "grid-2";
    grid1.style.gap = "14px";
    grid1.appendChild(buildField("Department", fDept));
    grid1.appendChild(buildField("Role", fRole));

    const grid2 = document.createElement("div");
    grid2.className = "grid-2";
    grid2.style.gap = "14px";
    grid2.appendChild(buildField("Employment Status", fStatus));
    grid2.appendChild(buildField("Employment Type", fType));

    const grid3 = document.createElement("div");
    grid3.className = "grid-2";
    grid3.style.gap = "14px";
    grid3.appendChild(buildField("Effective From", fFrom));
    grid3.appendChild(buildField("Effective To (Optional)", fTo));

    body.appendChild(buildField("Employee", fEmp));
    body.appendChild(grid1);
    body.appendChild(grid2);
    body.appendChild(grid3);
    body.appendChild(buildField("Remarks", fRemarks));

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
    saveBtn.innerHTML = `${icons.check} ${isEdit ? "Save Changes" : "Log Transition"}`;
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    body.appendChild(footer);

    const { close } = openModal({
      title: isEdit ? "Edit Transition Record" : "Log Transition Manually",
      body
    });

    cancelBtn.addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {
      const employeeId = isEdit ? data.employee_id : fEmp.value;
      const deptId = fDept.value ? Number(fDept.value) : null;
      const roleId = fRole.value ? Number(fRole.value) : null;
      const statusId = fStatus.value ? Number(fStatus.value) : null;
      const typeId = fType.value ? Number(fType.value) : null;
      const from = fFrom.value;
      const to = fTo.value || null;
      const remarks = fRemarks.value.trim();

      if (!employeeId) { errEl.textContent = "Employee is required."; errEl.style.display = "block"; return; }
      if (!from) { errEl.textContent = "Effective from date is required."; errEl.style.display = "block"; return; }

      const payload = {
        employee_id: Number(employeeId),
        department_id: deptId,
        role_id: roleId,
        employment_status_id: statusId,
        employment_type_id: typeId,
        effective_from: from,
        effective_to: to,
        remarks: remarks
      };
      if (isEdit) payload.history_id = data.history_id;

      errEl.style.display = "none";
      saveBtn.disabled = true;

      try {
        await apiRequest("/employment_history.php", {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify(payload),
        });
        await reloadHistory();
        close();
        showToast(isEdit ? "Transition log updated." : "Transition logged.", "success");
      } catch (err) {
        errEl.textContent = err.message || "Could not save log.";
        errEl.style.display = "block";
        saveBtn.disabled = false;
      }
    });
  }

  reloadHistory();
  return page;
}
