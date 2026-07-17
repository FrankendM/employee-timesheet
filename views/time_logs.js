// "clock_in_out"  → Clock In / Out panel  (employee only)
// "my_logs"       → Attendance history with day/week/month/year filter
// Admin gets:     → Full log table with edit, same filter controls

// ── Entry point called by app.js 
function renderTimeLogs(db, account, onDbChange) {
  return renderClockInOut(db, account, onDbChange);
}

function renderMyLogs(db, account, onDbChange) {
  return renderLogsView(db, account, onDbChange);
}

// clocked in now
function renderClockedInNow(db, account, onDbChange) {
  return renderClockedInNowView(db, account, onDbChange);
}

// CLOCK IN / OUT VIEW
function renderClockInOut(db, account, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  const level = account ? account.access_level : null;
  // system_admin and payroll_admin are pure HR/admin roles that never clock
  // in. Supervisors do clock in themselves (time_logs.php's clock_in/
  // clock_out actions just require a linked employee_id, same as employees).
  const isPureAdmin = level === "system_admin" || level === "payroll_admin";
  const empId = account ? account.employee_id : null;

  if (isPureAdmin) {
    // Admins don't clock in — show a simple redirect message
    page.appendChild(pageHeader("Clock In / Out", "Admin accounts do not clock in"));
    const info = document.createElement("div");
    info.className = "card";
    info.style.padding = "32px";
    info.style.textAlign = "center";
    info.style.color = "var(--text-muted)";
    info.innerHTML = `<div style="font-size:2rem;margin-bottom:8px">🔒</div><p>Admins do not have a clock-in record. View all logs in <b>Time Logs</b>.</p>`;
    page.appendChild(info);
    return page;
  }

  if (empId == null) {
    page.appendChild(pageHeader("Clock In / Out", "No employee record linked"));
    return page;
  }

  // Use local date (not UTC) so it matches the server-stored PH date.
  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,"0")}-${String(_now.getDate()).padStart(2,"0")}`;
  // Use == (not ===) for employee_id to handle string/integer type mismatch
  // between what the API returns vs what account.employee_id holds.
  let openLog = db.timeLogs.find(
    // eslint-disable-next-line eqeqeq
    l => l.employee_id == empId && l.clock_in.startsWith(today) && !l.clock_out
  ) || null;

  // ── Layout: two columns ──────────────────────────────
  const wrap = document.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gridTemplateColumns = "1fr 340px";
  wrap.style.gap = "20px";
  wrap.style.alignItems = "start";

  // ── Left: Clock panel ────────────────────────────────
  const clockCard = document.createElement("div");
  clockCard.className = "card";
  clockCard.style.padding = "36px 32px";

  // Date label
  const dateLabel = document.createElement("div");
  dateLabel.style.cssText = "font-size:0.78rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px";
  dateLabel.textContent = new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  clockCard.appendChild(dateLabel);

  // Big clock
  const clockDisplay = document.createElement("div");
  clockDisplay.style.cssText = "font-size:4rem;font-weight:800;letter-spacing:-2px;color:var(--text-primary);font-variant-numeric:tabular-nums;line-height:1;margin-bottom:32px";
  clockCard.appendChild(clockDisplay);

  function tick() {
    clockDisplay.textContent = new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  tick();
  const timerRef = setInterval(tick, 1000);
  const obs = new MutationObserver(() => {
    if (!document.body.contains(clockCard)) { clearInterval(timerRef); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  // Status area
  const statusArea = document.createElement("div");
  statusArea.style.cssText = "margin-bottom:24px;min-height:56px";
  clockCard.appendChild(statusArea);

  // Shift selector row
  const shiftRow = document.createElement("div");
  shiftRow.style.cssText = "margin-bottom:24px";
  clockCard.appendChild(shiftRow);

  // Action button
  const actionBtn = document.createElement("button");
  actionBtn.style.cssText = "width:100%;padding:16px;font-size:1rem;font-weight:700;border-radius:12px;border:none;cursor:pointer;transition:all 0.15s;letter-spacing:0.02em";
  clockCard.appendChild(actionBtn);

  // Info line below button
  const infoLine = document.createElement("div");
  infoLine.style.cssText = "margin-top:16px;font-size:0.83rem;color:var(--text-muted);text-align:center;min-height:20px";
  clockCard.appendChild(infoLine);

  const shiftOptions = db.shiftCategories.map(s => [s.shift_category_id, s.category_name]);
  const defaultShift = db.shiftCategories.find(s => s.shift_category_id === 1) ? 1 : (shiftOptions[0]?.[0] ?? 1);

  function refreshClock(currentLog) {
    openLog = currentLog;
    statusArea.innerHTML = "";
    shiftRow.innerHTML = "";
    infoLine.textContent = "";

    if (!currentLog) {
      // Not clocked in state
      const notClockedBadge = document.createElement("div");
      notClockedBadge.style.cssText = "display:inline-flex;align-items:center;gap:8px;background:#f1f5f9;border-radius:8px;padding:10px 16px;font-size:0.85rem;color:var(--text-muted);font-weight:500";
      notClockedBadge.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:#94a3b8;display:inline-block"></span> Not clocked in`;
      statusArea.appendChild(notClockedBadge);

      // Shift selector
      const shiftLabel = document.createElement("label");
      shiftLabel.textContent = "Shift Category";
      shiftLabel.style.cssText = "display:block;font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em";
      const shiftSel = makeSelect(shiftOptions, defaultShift);
      shiftSel.id = "shift-sel-main";
      shiftSel.style.width = "100%";
      shiftRow.appendChild(shiftLabel);
      shiftRow.appendChild(shiftSel);

      actionBtn.textContent = "Clock In";
      actionBtn.style.background = "linear-gradient(135deg,#22c55e,#16a34a)";
      actionBtn.style.color = "#fff";
      actionBtn.style.boxShadow = "0 4px 14px rgba(34,197,94,0.35)";
      actionBtn.onclick = async () => {
        actionBtn.disabled = true;
        actionBtn.textContent = "Clocking in…";
        try {
          const shiftId = parseInt(document.getElementById("shift-sel-main").value);
          const result  = await clockInRequest(shiftId);
          // Normalise employee_id type to match empId so the find() at the top
          // of renderClockInOut always locates this log after a page refresh.
          const normResult = { ...result, employee_id: empId };
          const updated = [normResult, ...db.timeLogs];
          db = { ...db, timeLogs: updated };
          onDbChange(db);
          refreshClock(normResult);
          refreshTodayLogs();
          showToast("Clocked in successfully!", "success");
        } catch (err) {
          showToast(err.message || "Clock-in failed.", "error");
          actionBtn.disabled = false;
          actionBtn.textContent = "Clock In";
        }
      };
    } else {
      // Clocked in state
      const isLate = currentLog.status_label === "Late";
      const statusDot = isLate ? "#f97316" : "#22c55e";
      const statusText = isLate ? "Late" : "On Time";
      const statusBg   = isLate ? "#fff7ed" : "#f0fdf4";
      const statusColor = isLate ? "#c2410c" : "#15803d";

      const statusBadge = document.createElement("div");
      statusBadge.style.cssText = `display:inline-flex;align-items:center;gap:8px;background:${statusBg};border-radius:8px;padding:10px 16px;font-size:0.85rem;color:${statusColor};font-weight:600`;
      statusBadge.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${statusDot};display:inline-block;box-shadow:0 0 0 3px ${statusDot}33"></span> ${statusText} · ${currentLog.category_name || "Day Shift"}`;
      statusArea.appendChild(statusBadge);

      // Duration counter
      const durationEl = document.createElement("div");
      durationEl.style.cssText = "margin-top:12px;font-size:0.85rem;color:var(--text-muted)";
      statusArea.appendChild(durationEl);

      function updateDuration() {
        const diff = Math.floor((Date.now() - new Date(currentLog.clock_in).getTime()) / 1000);
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        durationEl.textContent = `Duration: ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
      }
      updateDuration();
      const durTimer = setInterval(updateDuration, 1000);
      const durObs = new MutationObserver(() => {
        if (!document.body.contains(durationEl)) { clearInterval(durTimer); durObs.disconnect(); }
      });
      durObs.observe(document.body, { childList: true, subtree: true });

      actionBtn.textContent = "Clock Out";
      actionBtn.style.background = "linear-gradient(135deg,#ef4444,#dc2626)";
      actionBtn.style.color = "#fff";
      actionBtn.style.boxShadow = "0 4px 14px rgba(239,68,68,0.35)";
      actionBtn.disabled = false;
      actionBtn.onclick = async () => {
        actionBtn.disabled = true;
        actionBtn.textContent = "Clocking out…";
        try {
          const result  = await clockOutRequest();
          const updated = db.timeLogs.map(l => l.log_id === result.log_id ? result : l);
          db = { ...db, timeLogs: updated };
          onDbChange(db);
          refreshClock(null);
          refreshTodayLogs();
          showToast("Clocked out! Total: " + Number(result.total_hours).toFixed(2) + " hrs", "success");
        } catch (err) {
          showToast(err.message || "Clock-out failed.", "error");
          actionBtn.disabled = false;
          actionBtn.textContent = "Clock Out";
        }
      };

      infoLine.textContent = `Clocked in at ${fmtTime(currentLog.clock_in)}`;
    }
  }

  refreshClock(openLog);

  // ── Right: Today's logs ──────────────────────────────
  const todayCard = document.createElement("div");
  todayCard.className = "card";
  todayCard.style.padding = "20px";

  const todayHeader = document.createElement("div");
  todayHeader.style.cssText = "font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:16px";
  todayHeader.textContent = "Today's Logs";
  todayCard.appendChild(todayHeader);

  const todayLogsEl = document.createElement("div");
  todayCard.appendChild(todayLogsEl);

  function refreshTodayLogs() {
    todayLogsEl.innerHTML = "";
    // eslint-disable-next-line eqeqeq
    const todayLogs = db.timeLogs.filter(
      l => l.employee_id == empId && l.clock_in.startsWith(today)
    );

    if (!todayLogs.length) {
      todayLogsEl.innerHTML = `
        <div style="text-align:center;padding:32px 0;color:var(--text-muted)">
          <div style="font-size:2rem;margin-bottom:8px">⏰</div>
          <div style="font-size:0.83rem">No time logs today</div>
        </div>`;
      return;
    }

    todayLogs.forEach(l => {
      const row = document.createElement("div");
      row.style.cssText = "padding:12px 0;border-bottom:1px solid var(--border-light,#f1f5f9)";
      const isLate = l.status_label === "Late";
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:0.78rem;font-weight:600;color:${isLate?"#c2410c":"#15803d"}">${l.status_label || "—"}</span>
          <span style="font-size:0.75rem;color:var(--text-muted)">${l.category_name || "—"}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.83rem">
          <span>In: <b>${fmtTime(l.clock_in)}</b></span>
          <span>Out: <b>${l.clock_out ? fmtTime(l.clock_out) : "—"}</b></span>
        </div>
        ${l.total_hours != null ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${Number(l.total_hours).toFixed(2)} hrs</div>` : ""}
      `;
      todayLogsEl.appendChild(row);
    });
  }

  refreshTodayLogs();

  wrap.appendChild(clockCard);
  wrap.appendChild(todayCard);

  // Build page header with no subtitle
  const ph = document.createElement("div");
  ph.className = "page-header";
  ph.innerHTML = `<div class="page-header-text"><h1>Clock In / Out</h1><p>Record your attendance for today</p></div>`;
  page.appendChild(ph);
  page.appendChild(wrap);

  return page;
}

// CURRENTLY CLOCKED IN (admin only, today's active clock-ins)
// clocked in now
function renderClockedInNowView(db, account, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  page.appendChild(pageHeader("Currently Clocked In", "Employees who are clocked in right now, today"));

  // Use local date (not UTC) so it matches the server-stored PH date.
  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,"0")}-${String(_now.getDate()).padStart(2,"0")}`;

  // Active = clocked in today and not yet clocked out. Restricting to
  // clock_in.startsWith(today) keeps stale/forgotten open logs from prior
  // days out of this "right now" view.
  const activeNow = db.timeLogs.filter(l => l.clock_in.startsWith(today) && !l.clock_out);

  // ── Filter bar: department + search ───────────────────
  const filterBar = document.createElement("div");
  filterBar.style.cssText = "display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center";

  const deptOptions = [["all", "All Departments"], ...db.departments.map(d => [String(d.department_id), d.department_name])];
  const deptSel = makeSelect(deptOptions, "all");
  deptSel.style.width = "200px";
  filterBar.appendChild(deptSel);

  const searchWrap = document.createElement("div");
  searchWrap.style.cssText = "position:relative;flex:1;min-width:200px;max-width:320px";
  const searchInp = makeInput("text", "", "Search by name…");
  searchInp.style.width = "100%";
  searchInp.style.paddingLeft = "34px";
  const searchIcon = document.createElement("span");
  searchIcon.style.cssText = "position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text-muted);display:flex";
  searchIcon.innerHTML = icons.search;
  searchWrap.appendChild(searchIcon);
  searchWrap.appendChild(searchInp);
  filterBar.appendChild(searchWrap);

  page.appendChild(filterBar);

  const statsStrip = document.createElement("div");
  statsStrip.style.cssText = "display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap";
  page.appendChild(statsStrip);

  const card = document.createElement("div");
  card.className = "card";
  page.appendChild(card);

  let refreshTimer = null;

  function employeeDept(employeeId) {
    const emp = db.employees.find(e => e.employee_id === employeeId);
    return emp ? emp.department_name || "—" : "—";
  }

  function renderList() {
    card.innerHTML = "";
    statsStrip.innerHTML = "";

    const deptVal = deptSel.value;
    const search  = searchInp.value.trim().toLowerCase();

    const filtered = activeNow.filter(l => {
      if (deptVal !== "all") {
        const emp = db.employees.find(e => e.employee_id === l.employee_id);
        if (!emp || String(emp.department_id) !== deptVal) return false;
      }
      if (search && !(l.full_name || "").toLowerCase().includes(search)) return false;
      return true;
    });

    const lateCount = filtered.filter(l => l.status_label === "Late").length;
    const onTimeCount = filtered.length - lateCount;

    const stats = [
      { label: "Clocked In Now", value: filtered.length, color: "#0ea5e9" },
      { label: "On Time",        value: onTimeCount,     color: "#22c55e" },
      { label: "Late",           value: lateCount,        color: "#f97316" },
    ];
    stats.forEach(s => {
      const pill = document.createElement("div");
      pill.style.cssText = "background:#fff;border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:10px 18px;display:flex;align-items:center;gap:10px";
      pill.innerHTML = `
        <span style="font-size:1.3rem;font-weight:800;color:${s.color}">${s.value}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);font-weight:500">${s.label}</span>
      `;
      statsStrip.appendChild(pill);
    });

    if (!filtered.length) {
      card.innerHTML = `
        <div style="text-align:center;padding:48px 0;color:var(--text-muted)">
          <div style="font-size:2rem;margin-bottom:8px">🕒</div>
          <div style="font-size:0.9rem">No one is currently clocked in.</div>
        </div>`;
      return;
    }

    const headers = ["Employee", "Department", "Shift", "Clock In", "Duration", "Status"];
    const rows = filtered.map(l => {
      const empCell = document.createElement("div");
      empCell.className = "emp-cell";
      empCell.innerHTML = `${avatarHTML(l.full_name || "?", "sm")}<span style="margin-left:6px;font-size:0.85rem">${l.full_name || "?"}</span>`;

      const durationCell = document.createElement("span");
      durationCell.dataset.clockIn = l.clock_in;
      durationCell.style.fontVariantNumeric = "tabular-nums";

      return [
        empCell,
        employeeDept(l.employee_id),
        `<span style="font-size:0.78rem">${l.category_name || "—"}</span>`,
        fmtTime(l.clock_in),
        durationCell,
        l.status_label ? badge(l.status_label) : "—",
      ];
    });

    card.appendChild(buildTable(headers, rows, "No one is currently clocked in."));

    function tickDurations() {
      card.querySelectorAll("span[data-clock-in]").forEach(el => {
        const diff = Math.floor((Date.now() - new Date(el.dataset.clockIn).getTime()) / 1000);
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        el.textContent = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
      });
    }
    tickDurations();
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(tickDurations, 1000);
  }

  deptSel.addEventListener("change", renderList);
  searchInp.addEventListener("input", renderList);

  renderList();

  const obs = new MutationObserver(() => {
    if (!document.body.contains(page)) { clearInterval(refreshTimer); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  return page;
}

// MY LOGS / ALL LOGS VIEW
function renderLogsView(db, account, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  const level = account ? account.access_level : null;
  // time_logs.php GET: system_admin/payroll_admin see all logs and can
  // filter by department+employee+search; supervisor is auto-scoped to
  // their own department server-side but can still filter by employee and
  // search within it; a plain employee only ever sees their own logs
  // (backend "else" branch ignores department_id/employee_id/search for
  // that tier — only year/month apply).
  const isCompanyWide = level === "system_admin" || level === "payroll_admin";
  const isDeptScoped  = level === "supervisor";
  // PUT (editing a log) requires requirePayrollAdmin() — system_admin or
  // payroll_admin only. Supervisors can view but not edit.
  const canEdit = isCompanyWide;
  const empId   = account ? account.employee_id : null;

  page.appendChild(pageHeader(
    isCompanyWide ? "Time Logs" : isDeptScoped ? "Department Time Logs" : "My Time Logs",
    isCompanyWide ? "All employee attendance records"
      : isDeptScoped ? "Attendance records for your department"
      : "Your attendance history"
  ));

  // ── Filter bar ───────────────────────────────────────
  const filterBar = document.createElement("div");
  filterBar.style.cssText = "display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center";

  // db.timeLogs is already department-scoped server-side for a supervisor
  // (and self-scoped for a plain employee), so only a plain employee needs
  // an extra client-side filter here.
  const baseSource = (isCompanyWide || isDeptScoped)
    ? db.timeLogs
    : db.timeLogs.filter(l => l.employee_id === empId);

  // Year options — derived from the logs in scope, newest first, plus "All".
  const nowForYear = new Date();
  const yearsInData = Array.from(new Set(baseSource.map(l => new Date(l.clock_in).getFullYear())));
  if (!yearsInData.includes(nowForYear.getFullYear())) yearsInData.push(nowForYear.getFullYear());
  yearsInData.sort((a, b) => b - a);

  const yearOptions = [["all", "All Years"], ...yearsInData.map(y => [String(y), String(y)])];
  let selectedYear = String(nowForYear.getFullYear());
  const yearSel = makeSelect(yearOptions, selectedYear);
  yearSel.style.width = "130px";
  filterBar.appendChild(yearSel);

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const monthOptions = [["all", "All Months"], ...monthNames.map((m, i) => [String(i + 1), m])];
  let selectedMonth = "all";
  const monthSel = makeSelect(monthOptions, selectedMonth);
  monthSel.style.width = "150px";
  filterBar.appendChild(monthSel);

  let selectedDept = "all";
  let selectedEmployee = "all";
  let searchTerm = "";

  if (isCompanyWide || isDeptScoped) {
    let deptSel = null;

    if (isCompanyWide) {
      const deptOptions = [["all", "All Departments"], ...db.departments.map(d => [String(d.department_id), d.department_name])];
      deptSel = makeSelect(deptOptions, selectedDept);
      deptSel.style.width = "200px";
      filterBar.appendChild(deptSel);
    }

    // Employee dropdown — for company-wide roles, options narrow to
    // whichever department is selected. For a supervisor, db.employees is
    // already scoped to their own department, so no extra filtering needed.
    const empOptionsAll = () => {
      const emps = (isCompanyWide && selectedDept !== "all")
        ? db.employees.filter(e => String(e.department_id) === selectedDept)
        : db.employees;
      return [["all", "All Employees"], ...emps
        .slice()
        .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""))
        .map(e => [String(e.employee_id), e.full_name])];
    };
    let empSel = makeSelect(empOptionsAll(), selectedEmployee);
    empSel.style.width = "200px";
    empSel.addEventListener("change", () => { selectedEmployee = empSel.value; renderLogsTable(); });
    filterBar.appendChild(empSel);

    if (isCompanyWide) {
      deptSel.addEventListener("change", () => {
        selectedDept = deptSel.value;
        // Reset + rebuild employee options whenever department changes
        selectedEmployee = "all";
        const freshEmpSel = makeSelect(empOptionsAll(), selectedEmployee);
        freshEmpSel.style.width = "200px";
        freshEmpSel.addEventListener("change", () => { selectedEmployee = freshEmpSel.value; renderLogsTable(); });
        empSel.replaceWith(freshEmpSel);
        empSel = freshEmpSel;
        renderLogsTable();
      });
    }

    const searchWrap = document.createElement("div");
    searchWrap.style.cssText = "position:relative;flex:1;min-width:200px;max-width:280px";
    const searchInp = makeInput("text", "", "Search by name…");
    searchInp.style.width = "100%";
    searchInp.style.paddingLeft = "34px";
    const searchIcon = document.createElement("span");
    searchIcon.style.cssText = "position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text-muted);display:flex";
    searchIcon.innerHTML = icons.search;
    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(searchInp);
    searchInp.addEventListener("input", () => { searchTerm = searchInp.value.trim().toLowerCase(); renderLogsTable(); });
    filterBar.appendChild(searchWrap);
  }

  yearSel.addEventListener("change", () => { selectedYear = yearSel.value; renderLogsTable(); });
  monthSel.addEventListener("change", () => { selectedMonth = monthSel.value; renderLogsTable(); });

  async function applyFilters() {
    // Backend filtering — send all active filter values as query params
    const p = new URLSearchParams();
    if (selectedYear  !== "all") p.set('year',        selectedYear);
    if (selectedMonth !== "all") p.set('month',       selectedMonth);
    if (isCompanyWide && selectedDept !== "all") p.set('department_id', selectedDept);
    if ((isCompanyWide || isDeptScoped) && selectedEmployee !== "all") p.set('employee_id', selectedEmployee);
    if ((isCompanyWide || isDeptScoped) && searchTerm)                 p.set('search',       searchTerm);
    // A plain employee is always scoped to their own logs server-side —
    // time_logs.php's "else" branch ignores employee_id/search for that tier.
    return await apiRequest(`/time_logs.php?${p.toString()}`);
  }

  // Summary stats strip
  const statsStrip = document.createElement("div");
  statsStrip.style.cssText = "display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap";
  page.appendChild(filterBar);
  page.appendChild(statsStrip);

  // Table card
  const card = document.createElement("div");
  card.className = "card";
  page.appendChild(card);

  async function renderLogsTable() {
    card.innerHTML = "";
    statsStrip.innerHTML = "";

    const filtered = await applyFilters();

    // Compute summary stats
    const totalHours = filtered.reduce((s, l) => s + (l.total_hours ? Number(l.total_hours) : 0), 0);
    const presentCount = filtered.filter(l => l.status_label === "Present").length;
    const lateCount    = filtered.filter(l => l.status_label === "Late").length;
    const openCount    = filtered.filter(l => !l.clock_out).length;

    const stats = [
      { label: "Total Hours",  value: totalHours.toFixed(1) + "h", color: "#6366f1" },
      { label: "Present",      value: presentCount,                 color: "#22c55e" },
      { label: "Late",         value: lateCount,                    color: "#f97316" },
      { label: "Active Now",   value: openCount,                    color: "#0ea5e9" },
    ];

    stats.forEach(s => {
      const pill = document.createElement("div");
      pill.style.cssText = `background:#fff;border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:10px 18px;display:flex;align-items:center;gap:10px`;
      pill.innerHTML = `
        <span style="font-size:1.3rem;font-weight:800;color:${s.color}">${s.value}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);font-weight:500">${s.label}</span>
      `;
      statsStrip.appendChild(pill);
    });

    // Table
    const showEmployeeCol = isCompanyWide || isDeptScoped;
    const headers = showEmployeeCol
      ? (canEdit
          ? ["Employee", "Date", "Clock In", "Clock Out", "Hours", "Shift", "Status", ""]
          : ["Employee", "Date", "Clock In", "Clock Out", "Hours", "Shift", "Status"])
      : ["Date", "Clock In", "Clock Out", "Hours", "Shift", "Status"];

    const rows = filtered.map(l => {
      const dateStr     = fmtDate(l.clock_in);
      const clockInStr  = fmtTime(l.clock_in);
      const clockOutStr = l.clock_out ? fmtTime(l.clock_out) : `<span style="color:var(--text-muted)">Active</span>`;
      const hoursStr    = l.total_hours != null ? Number(l.total_hours).toFixed(2) + "h" : `<span style="color:var(--text-muted)">—</span>`;
      const shiftStr    = `<span style="font-size:0.78rem">${l.category_name || "—"}</span>`;
      const statusBadge = l.status_label ? badge(l.status_label) : "—";

      if (showEmployeeCol) {
        const empCell = document.createElement("div");
        empCell.className = "emp-cell";
        empCell.innerHTML = `${avatarHTML(l.full_name || "?", "sm")}<span style="margin-left:6px;font-size:0.85rem">${l.full_name || "?"}</span>`;

        if (canEdit) {
          const actCell = document.createElement("div");
          actCell.style.display = "flex";
          const editBtn = document.createElement("button");
          editBtn.className = "btn btn-ghost btn-sm";
          editBtn.innerHTML = `${icons.pencil} Edit`;
          editBtn.addEventListener("click", () => openEditModal(l, db, (updated) => {
            db = { ...db, timeLogs: db.timeLogs.map(x => x.log_id === updated.log_id ? updated : x) };
            onDbChange(db);
            renderLogsTable();
          }));
          actCell.appendChild(editBtn);

          return [empCell, dateStr, clockInStr, clockOutStr, hoursStr, shiftStr, statusBadge, actCell];
        }

        return [empCell, dateStr, clockInStr, clockOutStr, hoursStr, shiftStr, statusBadge];
      }

      return [dateStr, clockInStr, clockOutStr, hoursStr, shiftStr, statusBadge];
    });

    card.appendChild(buildTable(headers, rows, `No logs for selected period.`));
  }

  renderLogsTable();
  return page;
}

// ── Admin edit modal ──────────────────────────────────
function openEditModal(log, db, onSaved) {
  const shiftOptions  = db.shiftCategories.map(s => [s.shift_category_id, s.category_name]);
  const statusOptions = db.attendanceStatuses.map(s => [s.status_id, s.status_label]);

  // Convert stored datetime to local datetime-local input format
  function toDatetimeLocal(dtStr) {
    if (!dtStr) return "";
    const d = new Date(dtStr);
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const form = document.createElement("div");
  form.className = "form-grid";
  form.style.display = "flex";
  form.style.flexDirection = "column";
  form.style.gap = "14px";

  const fClockIn  = makeInput("datetime-local", toDatetimeLocal(log.clock_in));
  const fClockOut = makeInput("datetime-local", toDatetimeLocal(log.clock_out));
  const shiftSel  = makeSelect(shiftOptions,  log.shift_category_id);
  const statusSel = makeSelect(statusOptions, log.status_id);

  // Live-compute hours preview
  const hoursPreview = document.createElement("div");
  hoursPreview.style.cssText = "font-size:0.82rem;color:var(--text-muted);margin-top:-8px";

  function updateHoursPreview() {
    const inVal  = fClockIn.value;
    const outVal = fClockOut.value;
    if (inVal && outVal) {
      const diff = (new Date(outVal) - new Date(inVal)) / 3600000;
      hoursPreview.textContent = diff > 0
        ? `Computed hours: ${diff.toFixed(2)}h`
        : "⚠ Clock-out must be after clock-in";
    } else {
      hoursPreview.textContent = "";
    }
  }
  fClockIn.addEventListener("change", updateHoursPreview);
  fClockOut.addEventListener("change", updateHoursPreview);

  form.appendChild(buildField("Clock In", fClockIn));
  form.appendChild(buildField("Clock Out (leave blank if active)", fClockOut));
  form.appendChild(hoursPreview);
  form.appendChild(buildField("Shift Category", shiftSel));
  form.appendChild(buildField("Status", statusSel));

  const errEl = document.createElement("div");
  errEl.className = "alert-error";
  errEl.style.display = "none";
  form.appendChild(errEl);

  const footer = document.createElement("div");
  footer.className = "modal-footer";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-outline";
  cancelBtn.textContent = "Cancel";

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.textContent = "Save Changes";

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
  form.appendChild(footer);

  const { close } = openModal({
    title: `Edit Log — ${log.full_name || "Employee"} (${fmtDate(log.clock_in)})`,
    body: form,
  });

  cancelBtn.addEventListener("click", close);

  saveBtn.addEventListener("click", async () => {
    const inVal  = fClockIn.value;
    const outVal = fClockOut.value;

    if (!inVal) {
      errEl.textContent = "Clock-in time is required.";
      errEl.style.display = "block";
      return;
    }
    if (outVal && new Date(outVal) <= new Date(inVal)) {
      errEl.textContent = "Clock-out must be after clock-in.";
      errEl.style.display = "block";
      return;
    }

    // Recompute total_hours client-side so the table updates immediately
    const total_hours = outVal
      ? parseFloat(((new Date(outVal) - new Date(inVal)) / 3600000).toFixed(4))
      : null;

    errEl.style.display = "none";
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    try {
      const updated = await updateTimeLogRequest(log.log_id, {
        clock_in:          inVal,
        clock_out:         outVal || null,
        total_hours,
        shift_category_id: parseInt(shiftSel.value),
        status_id:         parseInt(statusSel.value),
      });
      close();
      onSaved(updated);
      showToast("Log updated.", "success");
    } catch (err) {
      showToast(err.message || "Update failed.", "error");
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
    }
  });

  updateHoursPreview();
}