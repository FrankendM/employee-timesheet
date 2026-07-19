// Employees view

function employmentStatusId(db, name, fallback = null) {
  const row = (db.employmentStatuses || []).find(s => s.status_name === name);
  return row ? row.employment_status_id : fallback;
}

function renderEmployees(db, account, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  const canCreate = canCreateEmployee(account);
  const canEdit   = canEditEmployee(account);
  const supervisorView = isSupervisor(account);

  let searchVal    = "";
  let filterDeptId = "";

  function refresh() {
    page.innerHTML = "";
    render();
  }

  function render() {
    let addBtn = null;
    if (canCreate) {
      addBtn = document.createElement("button");
      addBtn.className = "btn btn-primary";
      addBtn.innerHTML = `${icons.plus} Add Employee`;
      addBtn.addEventListener("click", () => openEmployeeModal(null));
    }

    const subtitle = supervisorView
      ? "View-only list of employees in your department"
      : canCreate
        ? "Full employee management — add, edit, and deactivate"
        : "Edit existing employees — new hires require System Admin";

    page.appendChild(pageHeader(
      supervisorView ? "My Department" : "Employees",
      subtitle,
      addBtn
    ));

    const card = document.createElement("div");
    card.className = "card";

    if (supervisorView) {
      const note = document.createElement("div");
      note.className = "text-xs text-gray";
      note.style.marginBottom = "10px";
      note.textContent = "Read-only — you cannot add, edit, or deactivate employees.";
      card.appendChild(note);
    } else {
      const toolbar = document.createElement("div");
      toolbar.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:4px";

      const searchBar = document.createElement("div");
      searchBar.className = "search-bar";
      searchBar.style.flex = "1";
      searchBar.innerHTML = `${icons.search}`;
      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.placeholder = "Search by name or email…";
      searchInput.value = searchVal;
      searchInput.addEventListener("input", e => {
        searchVal = e.target.value;
        renderTable(card);
      });
      searchBar.appendChild(searchInput);
      toolbar.appendChild(searchBar);

      const deptOpts = [["", "All Departments"], ...db.departments.map(d => [d.department_id, d.department_name])];
      const deptFilter = makeSelect(deptOpts, filterDeptId);
      deptFilter.style.minWidth = "160px";
      deptFilter.addEventListener("change", e => {
        filterDeptId = e.target.value;
        renderTable(card);
      });
      toolbar.appendChild(deptFilter);

      card.appendChild(toolbar);
    }

    renderTable(card);
    page.appendChild(card);
  }

  async function renderTable(card) {
    const old = card.querySelector(".table-wrap, .table-empty-wrap");
    if (old) old.remove();

    const params = new URLSearchParams();
    if (!supervisorView) {
      if (searchVal)    params.set("search", searchVal);
      if (filterDeptId) params.set("department_id", filterDeptId);
    }
    const filtered = await apiRequest(`/employees.php?${params.toString()}`);

    const oldStrip = card.querySelector(".emp-summary-strip");
    if (oldStrip) oldStrip.remove();

    const activeCount   = filtered.filter(e => e.employment_status === "Active").length;
    const inactiveCount = filtered.length - activeCount;

    const strip = document.createElement("div");
    strip.className = "emp-summary-strip";
    strip.style.cssText = "display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap";
    strip.innerHTML = `
      <div style="background:#f8faff;border:1px solid #e0e7ff;border-radius:10px;padding:8px 16px;display:flex;align-items:center;gap:8px">
        <span style="font-size:1.1rem;font-weight:800;color:#6366f1">${filtered.length}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);font-weight:500">Showing</span>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:8px 16px;display:flex;align-items:center;gap:8px">
        <span style="font-size:1.1rem;font-weight:800;color:#16a34a">${activeCount}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);font-weight:500">Active</span>
      </div>
      ${inactiveCount > 0 ? `
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px 16px;display:flex;align-items:center;gap:8px">
        <span style="font-size:1.1rem;font-weight:800;color:#d97706">${inactiveCount}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);font-weight:500">Not Active</span>
      </div>` : ""}
    `;
    card.insertBefore(strip, card.querySelector(".table-wrap") || null);

    const rows = filtered.map(e => {
      const name = employeeName(e);
      const empCell = document.createElement("div");
      empCell.className = "emp-cell";
      empCell.innerHTML = `
        ${avatarHTML(name, "sm")}
        <div class="emp-cell-info">
          <p>${name}</p>
          <p>${e.email || "—"}</p>
        </div>
      `;

      let actionsCell = `<span class="text-xs text-gray">—</span>`;

      if (canEdit) {
        const editBtn = document.createElement("button");
        editBtn.className = "btn btn-ghost btn-sm";
        editBtn.innerHTML = `${icons.pencil} Edit`;
        editBtn.addEventListener("click", () => openEmployeeModal(e));

        const isActive = e.employment_status === "Active";
        const toggleBtn = document.createElement("button");
        toggleBtn.className = "btn btn-ghost btn-sm";
        toggleBtn.textContent = isActive ? "Deactivate" : "Reactivate";
        toggleBtn.style.color = isActive ? "var(--red, #ef4444)" : "var(--emerald, #10b981)";
        toggleBtn.addEventListener("click", () => toggleEmployeeStatus(e));

        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "6px";
        actions.appendChild(editBtn);
        actions.appendChild(toggleBtn);
        actionsCell = actions;
      }

      return [
        empCell,
        `<span class="text-xs">${e.department_name || "—"}</span>`,
        `<span class="text-xs text-gray">${e.role_name || "—"}</span>`,
        `<span class="text-xs">${e.employment_type_name || "—"}</span>`,
        `<span class="text-xs text-gray">${e.schedule_name || "—"}</span>`,
        badge(e.employment_status || "—"),
        `<span class="mono text-xs text-gray">${fmtDate(e.hire_date)}</span>`,
        actionsCell,
      ];
    });

    const table = buildTable(
      ["Employee", "Department", "Role", "Type", "Schedule", "Status", "Hired", ""],
      rows,
      "No employees match the current filters."
    );
    card.appendChild(table);
  }

  function openEmployeeModal(existing) {
    if (!canEdit && !canCreate) return;
    if (!existing && !canCreate) return;

    const isEdit = !!existing;
    const defaultStatusId = employmentStatusId(db, "Active", 1);
    const blankEmp = {
      department_id: db.departments[0] ? db.departments[0].department_id : null,
      role_id: db.roles[0] ? db.roles[0].role_id : null,
      first_name: "", last_name: "", email: "", contact_no: "",
      hire_date: "",
      employment_status_id: defaultStatusId,
      employment_type_id: db.employmentTypes[0] ? db.employmentTypes[0].employment_type_id : null,
      schedule_id: db.workSchedules[0] ? db.workSchedules[0].schedule_id : null,
    };
    const data = isEdit ? { ...existing } : { ...blankEmp };

    const body = document.createElement("div");
    const formGrid = document.createElement("div");
    formGrid.className = "grid-2";
    formGrid.style.gap = "14px";

    const fFirst   = makeInput("text", data.first_name, "First name");
    const fLast    = makeInput("text", data.last_name, "Last name");
    const fEmail   = makeInput("email", data.email, "email@corp.ph");
    const fContact = makeInput("text", data.contact_no, "+63 9XX XXX XXXX");
    const fHire    = makeInput("date", data.hire_date);

const fRate    = makeInput("number", data.hourly_rate ?? 0, "0.00");
    fRate.step = "0.01"; fRate.min = "0";

    const deptOpts   = db.departments.map(d => [d.department_id, d.department_name]);
    const roleOpts   = db.roles.map(r => [r.role_id, r.role_name]);
    const statusOpts = (db.employmentStatuses || []).map(s => [s.employment_status_id, s.status_name]);
    const typeOpts   = (db.employmentTypes || []).map(t => [t.employment_type_id, t.type_name]);
    const schedOpts  = (db.workSchedules || []).map(s => [s.schedule_id, s.schedule_name]);

    const fDept    = makeSelect(deptOpts, data.department_id);
    const fRole    = makeSelect(roleOpts, data.role_id);
    const fStatus  = makeSelect(statusOpts, data.employment_status_id || defaultStatusId);
    const fType    = makeSelect(typeOpts, data.employment_type_id || "");
    const fSched   = makeSelect(schedOpts, data.schedule_id || "");

    formGrid.appendChild(buildField("First Name", fFirst));
    formGrid.appendChild(buildField("Last Name", fLast));
    formGrid.appendChild(buildField("Email", fEmail));
    formGrid.appendChild(buildField("Contact No", fContact));
    formGrid.appendChild(buildField("Hire Date", fHire));
    formGrid.appendChild(buildField("Hourly Rate (₱)", fRate));
    formGrid.appendChild(buildField("Department", fDept));
    formGrid.appendChild(buildField("Role", fRole));
    formGrid.appendChild(buildField("Employment Status", fStatus));
    formGrid.appendChild(buildField("Employment Type", fType));
    formGrid.appendChild(buildField("Work Schedule", fSched));

    body.appendChild(formGrid);

     // Only relevant when moving an Active employee to any other status —
    // matches the backend's Active -> non-Active exit check.
    const wasActive = isEdit && data.employment_status === "Active";
    const fReason = makeInput("text", "", "e.g. Resigned to pursue further studies");
    const fieldReason = buildField("Exit Reason", fReason);
    fieldReason.style.display = "none";

    const fVoluntary = document.createElement("input");
    fVoluntary.type = "checkbox";
    fVoluntary.checked = true;
    const voluntaryLabel = document.createElement("label");
    voluntaryLabel.style.cssText = "display:flex;align-items:center;gap:6px;font-size:0.78rem;margin-top:8px;color:var(--text-muted)";
    voluntaryLabel.appendChild(fVoluntary);
    voluntaryLabel.append(" Voluntary exit");
    fieldReason.appendChild(voluntaryLabel);

    body.insertBefore(fieldReason, errEl);

    fStatus.addEventListener("change", () => {
      const showReason = wasActive && fStatus.value != defaultStatusId;
      fieldReason.style.display = showReason ? "" : "none";
    });


    const errEl = document.createElement("div");
    errEl.className = "alert-error";
    errEl.style.display = "none";
    errEl.style.marginTop = "12px";
    body.appendChild(errEl);

    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-outline";
    cancelBtn.textContent = "Cancel";

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-primary";
    saveBtn.innerHTML = `${icons.check} ${isEdit ? "Save Changes" : "Add Employee"}`;

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    body.appendChild(footer);

    const { close } = openModal({
      title: isEdit ? "Edit Employee" : "Add Employee",
      body,
      wide: true,
    });

    cancelBtn.addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {
      const firstName = fFirst.value.trim();
      const email     = fEmail.value.trim();
      if (!firstName || !email) {
        errEl.textContent = "First Name and Email are required.";
        errEl.style.display = "block";
        return;
      }

      const payload = {
        department_id:        Number(fDept.value) || null,
        role_id:              Number(fRole.value) || null,
        first_name:           firstName,
        last_name:            fLast.value.trim(),
        email,
        contact_no:           fContact.value.trim(),
        hire_date:            fHire.value,
   hourly_rate:           Number(fRate.value) || 0,
        employment_status_id: Number(fStatus.value) || null,
        employment_type_id:   Number(fType.value) || null,
        schedule_id:          Number(fSched.value) || null,
      };

       if (fieldReason.style.display !== "none") {
        const reason = fReason.value.trim();
        if (!reason) {
          errEl.textContent = "Exit Reason is required when changing status away from Active.";
          errEl.style.display = "block";
          return;
        }
        payload.exit_reason  = reason;
        payload.is_voluntary = fVoluntary.checked ? 1 : 0;
      }

      errEl.style.display = "none";
      saveBtn.disabled = true;

      try {
        if (isEdit) {
          await updateEmployeeRequest(data.employee_id, payload);
        } else {
          await createEmployeeRequest(payload);
        }
        db.employees = await apiRequest("/employees.php");
        onDbChange(db);
        close();
        showToast(isEdit ? "Employee updated." : "Employee added.", "success");
        refresh();
      } catch (err) {
        errEl.textContent = err.message || "Could not save employee.";
        errEl.style.display = "block";
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  function toggleEmployeeStatus(emp) {
    if (!canEdit) return;

    const isActive = emp.employment_status === "Active";
    const newStatusId = isActive
      ? employmentStatusId(db, "Resigned", 2)
      : employmentStatusId(db, "Active", 1);
    const newLabel = isActive ? "Resigned" : "Active";
    const name = employeeName(emp);

    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "18px";

    const message = document.createElement("p");
    message.className = "text-sm";
    message.textContent = isActive
      ? `Are you sure you want to deactivate ${name}? Their status will be set to Resigned.`
      : `Are you sure you want to reactivate ${name}? Their status will be set to Active.`;
    body.appendChild(message);

    let fReason = null;
    let fVoluntary = null;
    if (isActive) {
      fReason = makeInput("text", "", "e.g. Resigned to pursue further studies");
      body.appendChild(buildField("Exit Reason", fReason));

      fVoluntary = makeSelect([["1", "Voluntary"], ["0", "Fired"]], "1");
      body.appendChild(buildField("Exit Type", fVoluntary));
    }

    const errEl = document.createElement("div");
    errEl.className = "alert-error";
    errEl.style.display = "none";
    body.appendChild(errEl);

    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const keepBtn = document.createElement("button");
    keepBtn.className = "btn btn-outline";
    keepBtn.textContent = "Keep as " + (emp.employment_status || "current");

    const confirmBtn = document.createElement("button");
    confirmBtn.className = isActive ? "btn btn-danger" : "btn btn-primary";
    confirmBtn.textContent = isActive ? "Deactivate" : "Reactivate";

    footer.appendChild(keepBtn);
    footer.appendChild(confirmBtn);
    body.appendChild(footer);

    const { close } = openModal({
      title: isActive ? "Deactivate Employee" : "Reactivate Employee",
      body,
    });

    keepBtn.addEventListener("click", close);

    confirmBtn.addEventListener("click", async () => {
       if (isActive) {
        const reason = fReason.value.trim();
        if (!reason) {
          errEl.textContent = "Exit Reason is required.";
          errEl.style.display = "block";
          return;
        }
      }
      confirmBtn.disabled = true;
      try {
        await updateEmployeeRequest(emp.employee_id, {
          ...emp,
          employment_status_id: newStatusId,
          ...(isActive ? { exit_reason: fReason.value.trim(), is_voluntary: Number(fVoluntary.value) } : {}),
        });
        db.employees = await apiRequest("/employees.php");
        onDbChange(db);
        close();
        showToast(`${name} marked as ${newLabel}.`, "success");
        refresh();
      } catch (err) {
        showToast(err.message || "Could not update status.", "error");
        confirmBtn.disabled = false;
      }
    });
  }

  render();
  return page;
}