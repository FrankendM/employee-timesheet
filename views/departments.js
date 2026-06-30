// ── Departments view (admin only) ─────────────────────
// TSK-33: Department & Labor Cost Page — table showing each department's
//         name, employee headcount, and TOTAL SALARY (sum of all employees'
//         net pay from the most recent approved payroll period).
//         Admin can add and edit departments.

function renderDepartments(db, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  let searchVal   = "";
  let deptSalaries = {}; // department_id → total net_pay from latest approved period

  function refresh() {
    page.innerHTML = "";
    render();
  }

  async function reloadDepartments() {
    try {
      db.departments = await apiRequest("/departments.php");
      onDbChange(db);
    } catch (err) {
      showToast(err.message || "Could not reload departments.", "error");
    }
  }

  // Fetch the most recent approved payroll period per department and sum net_pay
  async function loadDeptSalaries() {
    try {
      // Get all approved periods
      const periods = await fetchPayrollPeriods(null);
      const approved = periods.filter(p => p.status === "Approved");

      // For each department, find its most recent approved period
      const latestPerDept = {};
      approved.forEach(p => {
        const key = p.department_id;
        if (!latestPerDept[key] ||
            p.period_year > latestPerDept[key].period_year ||
            (p.period_year === latestPerDept[key].period_year &&
             p.period_month > latestPerDept[key].period_month)) {
          latestPerDept[key] = p;
        }
      });

      // Fetch records for each latest period and sum net_pay
      const fetches = Object.values(latestPerDept).map(async p => {
        try {
          const data = await fetchPayrollRecords(p.period_id);
          const total = data.records.reduce((s, r) => s + Number(r.net_pay), 0);
          return { department_id: p.department_id, total, period: p };
        } catch {
          return { department_id: p.department_id, total: 0, period: p };
        }
      });

      const results = await Promise.all(fetches);
      deptSalaries = {};
      results.forEach(r => {
        deptSalaries[r.department_id] = { total: r.total, period: r.period };
      });
    } catch {
      deptSalaries = {};
    }
  }

  function render() {
    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-primary";
    addBtn.innerHTML = `${icons.plus} Add Department`;
    addBtn.addEventListener("click", () => openDepartmentModal(null));

    page.appendChild(pageHeader(
      "Departments",
      `${db.departments.length} departments`,
      addBtn
    ));

    const card = document.createElement("div");
    card.className = "card";

    // Loading state — show spinner while salaries load
    const loadingEl = document.createElement("div");
    loadingEl.style.cssText = "padding:12px 0;font-size:0.82rem;color:var(--text-muted);display:flex;align-items:center;gap:8px";
    loadingEl.innerHTML = `<span style="display:inline-block;width:14px;height:14px;border:2px solid #e5e7eb;border-top-color:#6366f1;border-radius:50%;animation:spin 0.7s linear infinite"></span> Loading salary totals…`;
    card.appendChild(loadingEl);

    // Search bar
    const searchBar = document.createElement("div");
    searchBar.className = "search-bar";
    searchBar.innerHTML = `${icons.search}`;
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search by department name or code…";
    searchInput.value = searchVal;
    searchInput.addEventListener("input", e => {
      searchVal = e.target.value;
      renderTable(card);
    });
    searchBar.appendChild(searchInput);
    card.appendChild(searchBar);

    page.appendChild(card);

    // Load salaries then render table
    loadDeptSalaries().then(() => {
      loadingEl.remove();
      renderTable(card);
    });
  }

  function renderTable(card) {
    const old = card.querySelector(".table-wrap, .table-empty-wrap");
    if (old) old.remove();

    const filtered = db.departments.filter(d =>
      d.department_name.toLowerCase().includes(searchVal.toLowerCase()) ||
      (d.department_code || "").toLowerCase().includes(searchVal.toLowerCase())
    );

    // Summary strip
    const totalEmployees  = filtered.reduce((s, d) => s + (d.employee_count || 0), 0);
    const totalSalary     = filtered.reduce((s, d) => {
      const sal = deptSalaries[d.department_id];
      return s + (sal ? sal.total : 0);
    }, 0);
    const hasSalaryData   = Object.keys(deptSalaries).length > 0;

    const oldStrip = card.querySelector(".dept-summary-strip");
    if (oldStrip) oldStrip.remove();

    const strip = document.createElement("div");
    strip.className = "dept-summary-strip";
    strip.style.cssText = "display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap";
    strip.innerHTML = `
      <div style="background:#f8faff;border:1px solid #e0e7ff;border-radius:10px;padding:10px 18px;display:flex;align-items:center;gap:10px">
        <span style="font-size:1.2rem;font-weight:800;color:#6366f1">${totalEmployees}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);font-weight:500">Total Employees</span>
      </div>
      ${hasSalaryData ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 18px;display:flex;align-items:center;gap:10px">
        <span style="font-size:1.2rem;font-weight:800;color:#16a34a">₱${totalSalary.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);font-weight:500">Total Salary Paid (Latest Periods)</span>
      </div>` : `
      <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;padding:10px 18px;display:flex;align-items:center;gap:10px">
        <span style="font-size:0.78rem;color:var(--text-muted)">No approved payroll yet — generate payroll to see totals</span>
      </div>`}
    `;
    card.insertBefore(strip, card.querySelector(".table-wrap") || null);

    const fmt = n => "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 });

    const rows = filtered.map(d => {
      const salData = deptSalaries[d.department_id];
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

      let salaryCell;
      if (salData) {
        const periodLabel = `${monthNames[salData.period.period_month - 1]} ${salData.period.period_year}`;
        salaryCell = `
          <div>
            <span class="mono text-xs font-medium" style="color:#16a34a">${fmt(salData.total)}</span>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px">${periodLabel}</div>
          </div>`;
      } else {
        salaryCell = `<span class="text-xs text-gray">—</span>`;
      }

      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-ghost btn-sm";
      editBtn.innerHTML = `${icons.pencil} Edit`;
      editBtn.addEventListener("click", () => openDepartmentModal(d));

      return [
        `<span class="font-medium text-sm">${d.department_name}</span>`,
        `<span class="mono text-xs">${d.department_code || "—"}</span>`,
        `<span class="text-sm">${d.employee_count || 0}</span>`,
        salaryCell,
        editBtn,
      ];
    });

    const table = buildTable(
      ["Department", "Code", "Headcount", "Total Salary (Latest Payroll)", ""],
      rows,
      "No departments found."
    );
    card.appendChild(table);
  }

  // ── Add / Edit modal ──────────────────────────────
  function openDepartmentModal(existing) {
    const isEdit = !!existing;
    const data = isEdit ? { ...existing } : {
      department_name: "",
      department_code: "",
      labor_cost_allocation: 0,
    };

    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "14px";

    const fName   = makeInput("text",   data.department_name,       "e.g. Human Resources");
    const fCode   = makeInput("text",   data.department_code,       "e.g. HR");
    const fBudget = makeInput("number", data.labor_cost_allocation);

    body.appendChild(buildField("Department Name", fName));
    body.appendChild(buildField("Department Code", fCode));
    body.appendChild(buildField("Labor Cost Budget (₱)", fBudget));

    const hint = document.createElement("div");
    hint.style.cssText = "font-size:0.78rem;color:var(--text-muted);margin-top:-8px";
    hint.textContent = "The budget field is for planning. Actual salary totals are computed from approved payroll records.";
    body.appendChild(hint);

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
    saveBtn.innerHTML = `${icons.check} ${isEdit ? "Save Changes" : "Add Department"}`;

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    body.appendChild(footer);

    const { close } = openModal({
      title: isEdit ? "Edit Department" : "Add Department",
      body,
    });

    cancelBtn.addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {
      const name   = fName.value.trim();
      const code   = fCode.value.trim();
      const budget = Number(fBudget.value) || 0;

      if (!name) { errEl.textContent = "Department name is required."; errEl.style.display = "block"; return; }
      if (!code) { errEl.textContent = "Department code is required."; errEl.style.display = "block"; return; }

      const payload = {
        department_name:       name,
        department_code:       code.toUpperCase(),
        labor_cost_allocation: budget,
      };
      if (isEdit) payload.department_id = data.department_id;

      errEl.style.display = "none";
      saveBtn.disabled = true;

      try {
        await apiRequest("/departments.php", {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify(payload),
        });
        await reloadDepartments();
        close();
        showToast(isEdit ? "Department updated." : "Department added.", "success");
        refresh();
      } catch (err) {
        errEl.textContent = err.message || "Could not save department.";
        errEl.style.display = "block";
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  render();
  return page;
}
