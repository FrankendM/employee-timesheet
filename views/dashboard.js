// ── Dashboard view ────────────────────────────────────
// account param is passed so employee dashboard can be personalised.
// Stats come from db.dashboardStats (backend/routes/dashboard.php), which is
// loaded as part of the bulk fetchAllData() call in data.js. If that call
// failed for some reason, fall back to computing rough stats from the rest
// of `db` so the page still renders something useful.

function renderDashboard(db, account) {
  const page = document.createElement("div");
  page.className = "page";

  const isAdmin = account && account.access_level === "admin";
  const stats = db.dashboardStats;

  if (isAdmin) {
    page.appendChild(pageHeader("Dashboard", "Overview of workforce attendance and activity"));

    if (stats && stats.headcount) {
      page.appendChild(buildAdminStatGrid(stats));
      page.appendChild(buildAdminDetailGrid(stats));
    } else {
      page.appendChild(buildAdminStatGridFallback(db));
      const note = document.createElement("div");
      note.className = "alert-error";
      note.style.margin = "12px 0 0";
      note.textContent = "Live dashboard stats are unavailable right now — showing estimates from cached data.";
      page.appendChild(note);
    }
  } else {
    const emp = account && account.employee_id != null
      ? db.employees.find(e => e.employee_id === account.employee_id)
      : null;
    const displayName = emp ? emp.full_name : (account ? account.username : "Employee");

    page.appendChild(pageHeader(`Welcome, ${displayName}`, "Your personal overview"));

    if (stats) {
      page.appendChild(buildEmployeeStatGrid(stats, emp));
    } else {
      page.appendChild(buildEmployeeStatGridFallback(db, account, emp));
    }
  }

  return page;
}

// ═════════════════════════════════════════════════════
// ADMIN — server-stats version
// ═════════════════════════════════════════════════════
function buildAdminStatGrid(stats) {
  const h = stats.headcount;
  const grid = document.createElement("div");
  grid.className = "stat-grid";
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Active Employees</div>
      <div class="stat-value indigo">${h.active_employees}</div>
      <div class="stat-sub">of ${h.total_employees} total</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Present Today</div>
      <div class="stat-value emerald">${h.present_today}</div>
      <div class="stat-sub">${h.late_today} arrived late</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">On Leave Today</div>
      <div class="stat-value amber">${h.on_leave_today}</div>
      <div class="stat-sub">${stats.pending_leaves} pending requests</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Not Clocked In</div>
      <div class="stat-value sky">${h.not_clocked_in}</div>
      <div class="stat-sub">active employees today</div>
    </div>
  `;
  return grid;
}

function buildAdminDetailGrid(stats) {
  const grid = document.createElement("div");
  grid.className = "grid-3";

  // ── Department breakdown ──────────────────────────
  const deptCard = document.createElement("div");
  deptCard.className = "card";
  deptCard.innerHTML = `<div class="card-header">Department Attendance Today</div>`;

  if (!stats.departments || !stats.departments.length) {
    deptCard.innerHTML += `<div class="table-empty">No departments found</div>`;
  } else {
    stats.departments.forEach(d => {
      const item = document.createElement("div");
      item.className = "pending-item";
      item.innerHTML = `
        <div class="pending-item-top">
          <span class="pending-item-name">${d.department_name}</span>
        </div>
        <div class="pending-dates">
          ${d.present_today}/${d.employee_count} present
          ${d.late_today ? ` · ${d.late_today} late` : ""}
        </div>
      `;
      deptCard.appendChild(item);
    });
  }
  grid.appendChild(deptCard);

  // ── Recent clock-ins ───────────────────────────────
  const recentCard = document.createElement("div");
  recentCard.className = "card";
  recentCard.innerHTML = `<div class="card-header">Recent Clock-Ins</div>`;

  const recent = stats.recent_clock_ins || [];
  if (!recent.length) {
    recentCard.innerHTML += `<div class="table-empty">No recent activity</div>`;
  } else {
    recent.slice(0, 5).forEach(r => {
      const item = document.createElement("div");
      item.className = "pending-item";
      item.innerHTML = `
        <div class="pending-item-top">
          ${avatarHTML(r.full_name || "?", "sm")}
          <span class="pending-item-name">${r.full_name || "Unknown"}</span>
        </div>
        <div class="pending-type">${r.category_name || "—"}${r.status_label ? ` · ${r.status_label}` : ""}</div>
        <div class="pending-dates">
          ${fmtTime(r.clock_in)}${r.clock_out ? ` → ${fmtTime(r.clock_out)}` : " (clocked in)"}
        </div>
      `;
      recentCard.appendChild(item);
    });
  }


  grid.appendChild(recentCard);

  // ── Weekly Attendance Chart ────────────────────────
  grid.appendChild(buildWeeklyAttendanceChart(stats));

  return grid;
}

function buildWeeklyAttendanceChart(stats) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<div class="card-header">Weekly Attendance (This Week)</div>`;

  const week = stats.weekly_attendance || [];

  if (!week.length) {
    card.innerHTML += `<div class="table-empty">No weekly data available</div>`;
    return card;
  }

  const maxVal = Math.max(...week.map(d => (d.present || 0) + (d.late || 0) + (d.absent || 0)), 1);

  const chartWrap = document.createElement("div");
  chartWrap.style.cssText = "display:flex;align-items:flex-end;gap:10px;height:140px;padding:8px 4px 0;";

  week.forEach(day => {
    const present = day.present || 0;
    const late    = day.late    || 0;
    const absent  = day.absent  || 0;
    const total   = present + late + absent;

    const col = document.createElement("div");
    col.style.cssText = "flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;";
    col.title = `${day.day_label}: ${present} present, ${late} late, ${absent} absent`;

    const barWrap = document.createElement("div");
    barWrap.style.cssText = "width:100%;display:flex;flex-direction:column-reverse;gap:1px;border-radius:6px;overflow:hidden;";
    barWrap.style.height = `${Math.round((total / maxVal) * 100)}px`;

    if (absent > 0) {
      const seg = document.createElement("div");
      seg.style.cssText = `flex:${absent};background:#f87171;min-height:4px;`;
      barWrap.appendChild(seg);
    }
    if (late > 0) {
      const seg = document.createElement("div");
      seg.style.cssText = `flex:${late};background:#fb923c;min-height:4px;`;
      barWrap.appendChild(seg);
    }
    if (present > 0) {
      const seg = document.createElement("div");
      seg.style.cssText = `flex:${present};background:#34d399;min-height:4px;`;
      barWrap.appendChild(seg);
    }

    const label = document.createElement("div");
    label.style.cssText = "font-size:0.7rem;color:var(--text-muted);font-weight:600;margin-top:4px;";
    label.textContent = day.day_label || "—";

    col.appendChild(barWrap);
    col.appendChild(label);
    chartWrap.appendChild(col);
  });

  const legend = document.createElement("div");
  legend.style.cssText = "display:flex;gap:14px;margin-top:10px;padding:0 4px;";
  legend.innerHTML = `
    <span style="font-size:0.75rem;display:flex;align-items:center;gap:5px;color:var(--text-muted)">
      <span style="width:10px;height:10px;border-radius:3px;background:#34d399;display:inline-block"></span>Present
    </span>
    <span style="font-size:0.75rem;display:flex;align-items:center;gap:5px;color:var(--text-muted)">
      <span style="width:10px;height:10px;border-radius:3px;background:#fb923c;display:inline-block"></span>Late
    </span>
    <span style="font-size:0.75rem;display:flex;align-items:center;gap:5px;color:var(--text-muted)">
      <span style="width:10px;height:10px;border-radius:3px;background:#f87171;display:inline-block"></span>Absent
    </span>
  `;

  card.appendChild(chartWrap);
  card.appendChild(legend);
  return card;
}

// ── Fallback (client-computed) — used only if dashboard.php call failed ──
function buildAdminStatGridFallback(db) {
  const activeEmp = db.employees.filter(e => e.employment_status === "Active").length;
  const pending   = db.leaveRecords.filter(l => l.leave_status === "Pending").length;
  const clockedInToday = db.timeLogs.filter(l => isToday(l.clock_in)).length;

  const grid = document.createElement("div");
  grid.className = "stat-grid";
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Active Employees</div>
      <div class="stat-value indigo">${activeEmp}</div>
      <div class="stat-sub">across all departments</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Clocked In Today</div>
      <div class="stat-value emerald">${clockedInToday}</div>
      <div class="stat-sub">time logs today</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Pending Leaves</div>
      <div class="stat-value amber">${pending}</div>
      <div class="stat-sub">awaiting approval</div>
    </div>
  `;
  return grid;
}

// ═════════════════════════════════════════════════════
// EMPLOYEE — server-stats version
// ═════════════════════════════════════════════════════
function buildEmployeeStatGrid(stats, emp) {
  const grid = document.createElement("div");
  grid.className = "stat-grid";
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Today's Status</div>
      <div class="stat-value ${stats.clocked_in ? "emerald" : "sky"}">
        ${stats.clocked_in ? "Clocked In" : "Not Clocked In"}
      </div>
      <div class="stat-sub">${stats.status_label || "—"}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Hours Today</div>
      <div class="stat-value indigo">${stats.hours_today != null ? stats.hours_today.toFixed(1) : "—"}</div>
      <div class="stat-sub">${stats.clock_in ? fmtTime(stats.clock_in) : "no clock-in yet"}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Pending Leaves</div>
      <div class="stat-value amber">${stats.pending_leaves}</div>
      <div class="stat-sub">awaiting approval</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Approved This Month</div>
      <div class="stat-value emerald">${stats.approved_leaves_this_month}</div>
      <div class="stat-sub">leave days</div>
    </div>
    ${emp ? `
    <div class="stat-card">
      <div class="stat-label">Hourly Rate</div>
      <div class="stat-value indigo">₱${Number(emp.current_hourly_rate).toFixed(2)}</div>
      <div class="stat-sub">current rate</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Status</div>
      <div class="stat-value sky">${emp.employment_status}</div>
      <div class="stat-sub">${emp.department_name || "No department"}</div>
    </div>` : ""}
  `;
  return grid;
}

// ── Fallback (client-computed) — used only if dashboard.php call failed ──
function buildEmployeeStatGridFallback(db, account, emp) {
  const myLeaves = db.leaveRecords.filter(l => l.employee_id === (account && account.employee_id));
  const pending  = myLeaves.filter(l => l.leave_status === "Pending").length;
  const approved = myLeaves.filter(l => l.leave_status === "Approved").length;

  const grid = document.createElement("div");
  grid.className = "stat-grid";
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">My Pending Leaves</div>
      <div class="stat-value amber">${pending}</div>
      <div class="stat-sub">awaiting approval</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">My Approved Leaves</div>
      <div class="stat-value emerald">${approved}</div>
      <div class="stat-sub">this year</div>
    </div>
    ${emp ? `
    <div class="stat-card">
      <div class="stat-label">Hourly Rate</div>
      <div class="stat-value indigo">₱${Number(emp.current_hourly_rate).toFixed(2)}</div>
      <div class="stat-sub">current rate</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Status</div>
      <div class="stat-value sky">${emp.employment_status}</div>
      <div class="stat-sub">${emp.department_name || "No department"}</div>
    </div>` : ""}
  `;
  return grid;
}
