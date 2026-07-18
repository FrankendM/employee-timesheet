// ── Reports view (admin only) ──────────────────────────
// Two read-only labor-cost reports, both driven by backend/routes/reports.php:
//   - Department Labor Cost: total_hours × current_hourly_rate, grouped by dept
//   - Employee Earnings:     total_hours × current_hourly_rate, grouped by employee
//
// These use the employee's *current* hourly rate, not the rate snapshotted at
// payroll time — see reports.php header comment for why that can differ from
// the Payroll page's numbers.

function renderReports(db, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  page.appendChild(pageHeader("Reports", "Time log counts and hours worked, based on logged hours"));

  const now = new Date();
  let filterDept  = "";
  let filterYear  = now.getFullYear();
  let filterMonth = "";
  let activeTab   = "department"; // "department" | "employee"

  let deptRows  = [];
  let empRows   = [];
  let loading   = false;
  let loadErr   = null;

  const monthNames = ["January","February","March","April","May","June",
                      "July","August","September","October","November","December"];

  // ── Filter bar ────────────────────────────────────────
  const filterCard = document.createElement("div");
  filterCard.className = "card";
  filterCard.style.padding = "14px 18px";

  const filterRow = document.createElement("div");
  filterRow.style.cssText = "display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;";

  const deptOpts = [["", "All Departments"], ...db.departments.map(d => [d.department_id, d.department_name])];
  const deptSel  = makeSelect(deptOpts, filterDept);
  deptSel.addEventListener("change", e => { filterDept = e.target.value; loadReports(); });

  const monthOpts = [["", "All Months"], ...monthNames.map((m, i) => [i + 1, m])];
  const monthSel  = makeSelect(monthOpts, filterMonth);
  monthSel.addEventListener("change", e => { filterMonth = e.target.value; loadReports(); });

  const yearInp = makeInput("number", filterYear, "Year");
  yearInp.min = 2020;
  yearInp.max = 2099;
  yearInp.style.width = "90px";
  yearInp.addEventListener("change", e => { filterYear = Number(e.target.value); loadReports(); });

  const clearBtn = document.createElement("button");
  clearBtn.className = "btn btn-outline btn-sm";
  clearBtn.textContent = "Clear filters";
  clearBtn.addEventListener("click", () => {
    filterDept = ""; filterMonth = ""; filterYear = now.getFullYear();
    deptSel.value = ""; monthSel.value = ""; yearInp.value = filterYear;
    loadReports();
  });

  filterRow.appendChild(buildField("Department", deptSel));
  filterRow.appendChild(buildField("Month", monthSel));
  filterRow.appendChild(buildField("Year", yearInp));
  filterRow.appendChild(clearBtn);

  filterCard.appendChild(filterRow);
  page.appendChild(filterCard);

  // ── Tabs ──────────────────────────────────────────────
  const tabRow = document.createElement("div");
  tabRow.style.cssText = "display:flex;gap:8px;margin:14px 0 10px;";

  const deptTabBtn = document.createElement("button");
  const empTabBtn  = document.createElement("button");
  deptTabBtn.textContent = "By Department";
  empTabBtn.textContent  = "By Employee";
  [deptTabBtn, empTabBtn].forEach(b => { b.className = "btn btn-sm"; });

  function refreshTabStyles() {
    deptTabBtn.className = "btn btn-sm " + (activeTab === "department" ? "btn-primary" : "btn-outline");
    empTabBtn.className  = "btn btn-sm " + (activeTab === "employee"   ? "btn-primary" : "btn-outline");
  }
  refreshTabStyles();

  deptTabBtn.addEventListener("click", () => { activeTab = "department"; refreshTabStyles(); renderTable(); });
  empTabBtn.addEventListener("click",  () => { activeTab = "employee";   refreshTabStyles(); renderTable(); });

  tabRow.appendChild(deptTabBtn);
  tabRow.appendChild(empTabBtn);
  page.appendChild(tabRow);

  // ── Table card ────────────────────────────────────────
  const tableCard = document.createElement("div");
  tableCard.className = "card";
  page.appendChild(tableCard);

  function money(n) {
    return `₱${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

    if (activeTab === "department") {
      const totalLogs  = deptRows.reduce((s, r) => s + r.total_time_logs, 0);
      const totalHours = deptRows.reduce((s, r) => s + r.total_hours_logged, 0);

      const rows = deptRows.map(r => {
        const dept = db.departments.find(d => d.department_id === r.department_id);
        return [
          `<span class="text-xs font-medium">${r.department_name}</span>`,
          `<span class="text-xs text-gray">${dept?.department_code ?? "—"}</span>`,
          `<span class="mono text-xs">${r.employee_count}</span>`,
          `<span class="mono text-xs">${r.total_time_logs}</span>`,
          `<span class="mono text-xs font-medium">${Number(r.total_hours_logged).toFixed(2)}h</span>`,
        ];
      });

      tableCard.appendChild(
        buildTable(["Department", "Code", "Employees", "Time Logs", "Total Hours"], rows,
          "No time logs found for the selected filters.")
      );

      if (deptRows.length) {
        const summary = document.createElement("div");
        summary.style.cssText = "padding:12px 18px;border-top:1px solid var(--border,#e5e7eb);font-size:.8rem;display:flex;justify-content:space-between;";
        summary.innerHTML = `
          <span class="text-gray">${deptRows.length} department${deptRows.length !== 1 ? "s" : ""}</span>
          <span class="font-medium">Total: ${totalLogs} logs · ${totalHours.toFixed(2)}h</span>
        `;
        tableCard.appendChild(summary);
      }
    } else {
      const totalLogs  = empRows.reduce((s, r) => s + r.shifts_logged, 0);
      const totalHours = empRows.reduce((s, r) => s + r.total_hours_worked, 0);

      const rows = empRows.map(r => [
        `<span class="text-xs font-medium">${r.full_name}</span>`,
        `<span class="text-xs text-gray">${r.department_name || "—"}</span>`,
        `<span class="mono text-xs">${r.shifts_logged}</span>`,
        `<span class="mono text-xs font-medium">${Number(r.total_hours_worked).toFixed(2)}h</span>`,
      ]);

      tableCard.appendChild(
        buildTable(["Employee", "Department", "Time Logs", "Total Hours"], rows,
          "No time logs found for the selected filters.")
      );

      if (empRows.length) {
        const summary = document.createElement("div");
        summary.style.cssText = "padding:12px 18px;border-top:1px solid var(--border,#e5e7eb);font-size:.8rem;display:flex;justify-content:space-between;";
        summary.innerHTML = `
          <span class="text-gray">${empRows.length} employee${empRows.length !== 1 ? "s" : ""}</span>
          <span class="font-medium">Total: ${totalLogs} logs · ${totalHours.toFixed(2)}h</span>
        `;
        tableCard.appendChild(summary);
      }
    }
  }

  function currentFilters() {
    return { departmentId: filterDept || null, year: filterYear || null, month: filterMonth || null };
  }

  async function loadReports() {
    loading = true;
    loadErr = null;
    renderTable();
    try {
      const filters = currentFilters();
      const [dept, emp] = await Promise.all([
        fetchDepartmentLaborCostReport(filters),
        fetchEmployeeEarningsReport(filters),
      ]);
      deptRows = dept;
      empRows  = emp;
    } catch (err) {
      deptRows = [];
      empRows  = [];
      loadErr  = err.message || "Could not load reports.";
    }
    loading = false;
    renderTable();
  }

  loadReports();
  return page;
}