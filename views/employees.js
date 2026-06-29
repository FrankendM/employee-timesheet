// ── Employees view ────────────────────────────────────

function renderEmployees(db, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  let searchVal = "";

  function refresh() {
    page.innerHTML = "";
    render();
  }

  function render() {
    // Header
    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-primary";
    addBtn.innerHTML = `${icons.plus} Add Employee`;
    addBtn.addEventListener("click", () => openEmployeeModal(null));
    page.appendChild(pageHeader("Employees", `${db.employees.length} total`, addBtn));

    // Card
    const card = document.createElement("div");
    card.className = "card";

    // Search
    const searchBar = document.createElement("div");
    searchBar.className = "search-bar";
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
    card.appendChild(searchBar);

    renderTable(card);
    page.appendChild(card);
  }

  function renderTable(card) {
    const old = card.querySelector(".table-wrap, .table-empty-wrap");
    if (old) old.remove();

    const filtered = db.employees.filter(e =>
      e.full_name.toLowerCase().includes(searchVal.toLowerCase()) ||
      (e.email || "").toLowerCase().includes(searchVal.toLowerCase())
    );

    const rows = filtered.map(e => {
      // employees.php already joins department_name / role_name onto each row.
      const empCell = document.createElement("div");
      empCell.className = "emp-cell";
      empCell.innerHTML = `
        ${avatarHTML(e.full_name, "sm")}
        <div class="emp-cell-info">
          <p>${e.full_name}</p>
          <p>${e.email || "—"}</p>
        </div>
      `;

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

        return [
          empCell,
          `<span class="text-xs">${e.department_name || "—"}</span>`,
          `<span class="text-xs text-gray">${e.role_name || "—"}</span>`,
          `<span class="mono text-xs">₱${e.current_hourly_rate}/hr</span>`,
          badge(e.employment_status),
          `<span class="mono text-xs text-gray">${fmtDate(e.hire_date)}</span>`,
          actions,
        ];
        });

    const table = buildTable(["Employee", "Department", "Role", "Hourly Rate", "Status", "Hired", ""], rows);
    card.appendChild(table);
  }

  function openEmployeeModal(existing) {
    const isEdit = !!existing;
    const blankEmp = {
      department_id: db.departments[0] ? db.departments[0].department_id : null,
      role_id: db.roles[0] ? db.roles[0].role_id : null,
      full_name: "", email: "", contact_no: "",
      hire_date: "", current_hourly_rate: 0, employment_status: "Active"
    };
    const data = isEdit ? { ...existing } : { ...blankEmp };

    const body = document.createElement("div");

    const formGrid = document.createElement("div");
    formGrid.className = "grid-2";
    formGrid.style.gap = "14px";

    // Fields
    const fName     = makeInput("text",   data.full_name,          "Full name");
    const fEmail    = makeInput("email",  data.email,              "email@corp.ph");
    const fContact  = makeInput("text",   data.contact_no,         "+63 9XX XXX XXXX");
    const fHire     = makeInput("date",   data.hire_date);
    const fRate     = makeInput("number", data.current_hourly_rate);

    const deptOpts  = db.departments.map(d => [d.department_id, d.department_name]);
    const roleOpts  = db.roles.map(r => [r.role_id, r.role_name]);
    const statOpts  = [["Active","Active"],["Inactive","Inactive"],["On Leave","On Leave"]];

    const fDept     = makeSelect(deptOpts, data.department_id);
    const fRole     = makeSelect(roleOpts, data.role_id);
    const fStatus   = makeSelect(statOpts, data.employment_status);

    formGrid.appendChild(buildField("Full Name", fName));
    formGrid.appendChild(buildField("Email", fEmail));
    formGrid.appendChild(buildField("Contact No", fContact));
    formGrid.appendChild(buildField("Hire Date", fHire));
    formGrid.appendChild(buildField("Department", fDept));
    formGrid.appendChild(buildField("Role", fRole));
    formGrid.appendChild(buildField("Hourly Rate (₱)", fRate));
    formGrid.appendChild(buildField("Status", fStatus));

    body.appendChild(formGrid);

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
      const name = fName.value.trim();
      const email = fEmail.value.trim();
      if (!name || !email) {
        errEl.textContent = "Full Name and Email are required.";
        errEl.style.display = "block";
        return;
      }

      const payload = {
        department_id:       Number(fDept.value) || null,
        role_id:              Number(fRole.value) || null,
        full_name:            name,
        email:                email,
        contact_no:           fContact.value.trim(),
        hire_date:            fHire.value,
        current_hourly_rate:  Number(fRate.value) || 0,
        employment_status:    fStatus.value,
      };

      errEl.style.display = "none";
      saveBtn.disabled = true;

      try {
        // employees.php returns { employee_id, message } on create and just
        // { message } on update — not the full row — so we re-fetch the
        // employee list afterwards to get back in sync (including any
        // department_name / role_name joins).
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

    async function toggleEmployeeStatus(emp) {
      const isActive = emp.employment_status === "Active";
      const newStatus = isActive ? "Inactive" : "Active";
      const msg = isActive
        ? `Deactivate ${emp.full_name}? They will be marked Inactive.`
        : `Reactivate ${emp.full_name}? They will be marked Active.`;
      if (!confirm(msg)) return;
      try {
        await updateEmployeeRequest(emp.employee_id, { ...emp, employment_status: newStatus });
        db.employees = await apiRequest("/employees.php");
        onDbChange(db);
        showToast(`${emp.full_name} marked as ${newStatus}.`, "success");
        refresh();
      } catch (err) {
        showToast(err.message || "Could not update status.", "error");
      }
    }


  render();
  return page;
}
