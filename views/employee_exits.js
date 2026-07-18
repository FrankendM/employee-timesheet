function renderEmployeeExits(db, account, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  const isPrivileged = account && ["system_admin", "payroll_admin"].includes(account.access_level);
  const isSupervisor = account && account.access_level === "supervisor";

  let searchVal = "";
  let exitRows = [];
  let loading = false;
  let loadErr = null;

  async function reloadExits() {
    loading = true;
    loadErr = null;
    page.innerHTML = "";
    const loadingEl = document.createElement("div");
    loadingEl.style.cssText = "padding:32px;text-align:center;color:var(--text-muted);font-size:.85rem;";
    loadingEl.textContent = "Loading exit records…";
    page.appendChild(loadingEl);

    try {
      exitRows = await apiRequest("/employee_exits.php");
    } catch (err) {
      loadErr = err.message || "Could not load exits.";
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
      addBtn.innerHTML = `${icons.plus} Record Exit`;
      addBtn.addEventListener("click", () => openExitModal(null));
    }

    page.appendChild(pageHeader(
      "Employee Exits",
      "Process employee resignations, retirements, and separations",
      addBtn
    ));

    // Table container card
    const card = document.createElement("div");
    card.className = "card";

    // Search bar
    const searchBar = buildSearchBar({
      placeholder: "Search by employee name or reason…",
      value: searchVal,
      onInput: (v) => { searchVal = v; renderTable(); },
      flex: false
    });
    searchBar.style.padding = "14px 18px 0";
    card.appendChild(searchBar);

    page.appendChild(card);
    renderTable(card);
  }

  function renderTable(container = page.querySelector(".card")) {
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
    const filtered = exitRows.filter(r => {
      if (!term) return true;
      return (r.employee_name || "").toLowerCase().includes(term) ||
             (r.exit_reason || "").toLowerCase().includes(term) ||
             (r.remarks || "").toLowerCase().includes(term);
    });

    const rows = filtered.map(r => {
      let actions = "—";
      if (isPrivileged) {
        const editBtn = document.createElement("button");
        editBtn.className = "btn btn-ghost btn-sm";
        editBtn.innerHTML = `${icons.pencil} Edit`;
        editBtn.addEventListener("click", () => openExitModal(r));

        const delBtn = document.createElement("button");
        delBtn.className = "btn btn-ghost btn-sm";
        delBtn.style.color = "var(--red, #ef4444)";
        delBtn.textContent = "Delete";
        delBtn.addEventListener("click", () => deleteExit(r));

        const div = document.createElement("div");
        div.style.cssText = "display:flex;gap:6px";
        div.appendChild(editBtn);
        div.appendChild(delBtn);
        actions = div;
      }

      return [
        `<span class="font-medium text-sm">${r.employee_name}</span>`,
        `<span class="text-xs text-gray">${r.department_name || "—"}</span>`,
        `<span class="mono text-xs">${fmtDate(r.exit_date)}</span>`,
        `<span class="text-xs font-semibold text-gray">${r.exit_reason}</span>`,
        r.is_voluntary 
          ? `<span class="badge badge-active">Voluntary</span>` 
          : `<span class="badge badge-inactive">Involuntary</span>`,
        `<span class="text-xs text-gray" style="display:inline-block;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.remarks || ''}">${r.remarks || "—"}</span>`,
        `<span class="mono text-xs text-gray">${r.processed_by_username || "system"}</span>`,
        actions
      ];
    });

    const headers = ["Employee", "Department", "Exit Date", "Reason", "Type", "Remarks", "Processed By", ""];
    container.appendChild(buildTable(headers, rows, "No employee exits recorded."));
  }

  function deleteExit(r) {
    openConfirmModal({
      title: "Delete Exit Record",
      message: `Delete exit record for "${r.employee_name}"? Note: This deletes the log, but does not revert the employee's status.`,
      keepLabel: "Keep Log",
      confirmLabel: "Delete Log",
      onConfirm: async () => {
        await apiRequest(`/employee_exits.php?id=${r.exit_id}`, { method: "DELETE" });
        await reloadExits();
        showToast("Exit record deleted successfully.", "success");
      }
    });
  }

  function openExitModal(existing) {
    if (!isPrivileged) return;
    const isEdit = !!existing;
    const data = isEdit ? { ...existing } : {
      employee_id: "", exit_date: todayStr(), exit_reason: "Resigned", is_voluntary: true, remarks: "", inactive_status_id: 2
    };

    const body = document.createElement("div");
    body.style.cssText = "display:flex;flex-direction:column;gap:14px";

    let fEmp;
    if (isEdit) {
      fEmp = document.createElement("span");
      fEmp.className = "text-sm font-medium";
      fEmp.textContent = data.employee_name;
    } else {
      // List active/current employees to choose from
      const activeEmps = db.employees.filter(e => {
        // filter out employees that already have an exit logged, or list all
        return !exitRows.some(ex => ex.employee_id === e.employee_id);
      });
      const empOpts = [["", "Select Employee"], ...activeEmps.map(e => [e.employee_id, `${e.first_name} ${e.last_name}`])];
      fEmp = makeSelect(empOpts, data.employee_id);
    }

    const fDate = makeInput("date", data.exit_date);
    
    const reasonOpts = [
      ["Resigned", "Resigned"],
      ["Retired", "Retired"],
      ["Terminated", "Terminated"],
      ["Separated", "Separated"],
      ["End of Contract", "End of Contract"],
      ["Other", "Other"]
    ];
    const fReason = makeSelect(reasonOpts, data.exit_reason);

    // Voluntary checkbox
    const checkWrap = document.createElement("label");
    checkWrap.style.cssText = "display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.875rem";
    const fVoluntary = document.createElement("input");
    fVoluntary.type = "checkbox";
    fVoluntary.checked = !!data.is_voluntary;
    fVoluntary.style.width = "16px";
    fVoluntary.style.height = "16px";
    checkWrap.appendChild(fVoluntary);
    checkWrap.appendChild(document.createTextNode("Voluntary Exit (Self-initiated)"));

    // Status target dropdown (admins only, on POST)
    const statusList = (db.employmentStatuses || []).filter(s => s.status_name !== "Active");
    const statusOpts = statusList.map(s => [s.employment_status_id, s.status_name]);
    const fStatus = makeSelect(statusOpts, data.inactive_status_id || 2);

    const fRemarks = makeInput("text", data.remarks || "", "Optional details");

    const grid = document.createElement("div");
    grid.className = "grid-2";
    grid.style.gap = "14px";
    grid.appendChild(buildField("Exit Date", fDate));
    grid.appendChild(buildField("Exit Reason", fReason));

    body.appendChild(buildField("Employee", fEmp));
    body.appendChild(grid);
    body.appendChild(checkWrap);
    
    // Only display target status selection for new exits (on POST)
    if (!isEdit) {
      body.appendChild(buildField("Update Employee Status To", fStatus));
    }
    
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
    saveBtn.innerHTML = `${icons.check} ${isEdit ? "Save Changes" : "Process Exit"}`;
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    body.appendChild(footer);

    const { close } = openModal({
      title: isEdit ? "Edit Exit Details" : "Record Employee Separation",
      body
    });

    cancelBtn.addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {
      const employeeId = isEdit ? data.employee_id : fEmp.value;
      const date = fDate.value;
      const reason = fReason.value;
      const voluntary = fVoluntary.checked ? 1 : 0;
      const remarks = fRemarks.value.trim();

      if (!employeeId) { errEl.textContent = "Employee selection is required."; errEl.style.display = "block"; return; }
      if (!date) { errEl.textContent = "Exit date is required."; errEl.style.display = "block"; return; }

      const payload = {
        employee_id: Number(employeeId),
        exit_date: date,
        exit_reason: reason,
        is_voluntary: voluntary,
        remarks: remarks
      };
      
      if (isEdit) {
        payload.exit_id = data.exit_id;
      } else {
        payload.inactive_status_id = Number(fStatus.value);
      }

      errEl.style.display = "none";
      saveBtn.disabled = true;

      try {
        await apiRequest("/employee_exits.php", {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify(payload),
        });
        
        // Reload employee details from DB so cache is fresh
        if (!isEdit && onDbChange) {
          const updatedEmployees = await apiRequest("/employees.php");
          db.employees = updatedEmployees;
          onDbChange(db);
        }

        await reloadExits();
        close();
        showToast(isEdit ? "Exit details updated." : "Employee exit successfully processed.", "success");
      } catch (err) {
        errEl.textContent = err.message || "Could not save exit record.";
        errEl.style.display = "block";
        saveBtn.disabled = false;
      }
    });
  }

  reloadExits();
  return page;
}
