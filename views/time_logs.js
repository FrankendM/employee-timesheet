// ── Time Logs: two views ──────────────────────────────
// "clock_in_out"  → Clock In / Out panel  (employee only)
// "my_logs"       → Attendance history with day/week/month/year filter
// Admin gets:     → Full log table with edit, same filter controls

// ── Entry point called by app.js ─────────────────────
function renderTimeLogs(db, account, onDbChange) {
  return renderClockInOut(db, account, onDbChange);
}

function renderMyLogs(db, account, onDbChange) {
  return renderLogsView(db, account, onDbChange);
}

// ═════════════════════════════════════════════════════
// CLOCK IN / OUT VIEW
// ═════════════════════════════════════════════════════
function renderClockInOut(db, account, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  const isAdmin = account && account.access_level === "admin";
  const empId   = account ? account.employee_id : null;

  if (isAdmin) {
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

  const today = new Date().toISOString().split("T")[0];
  let openLog = db.timeLogs.find(
    l => l.employee_id === empId && l.clock_in.startsWith(today) && !l.clock_out
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
          const updated = [result, ...db.timeLogs];
          db = { ...db, timeLogs: updated };
          onDbChange(db);
          refreshClock(result);
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
    const todayLogs = db.timeLogs.filter(
      l => l.employee_id === empId && l.clock_in.startsWith(today)
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

// ═════════════════════════════════════════════════════
// MY LOGS / ALL LOGS VIEW
// ═════════════════════════════════════════════════════
function renderLogsView(db, account, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  const isAdmin = account && account.access_level === "admin";
  const empId   = account ? account.employee_id : null;

  page.appendChild(pageHeader(
    isAdmin ? "Time Logs" : "My Time Logs",
    isAdmin ? "All employee attendance records" : "Your attendance history"
  ));

  // ── Filter bar ───────────────────────────────────────
  const filterBar = document.createElement("div");
  filterBar.style.cssText = "display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center";

  // Period tabs
  const periods = ["Day", "Week", "Month", "Year", "All"];
  let activePeriod = "Week";

  const tabsWrap = document.createElement("div");
  tabsWrap.style.cssText = "display:flex;gap:4px;background:var(--gray-100,#f3f4f6);border-radius:8px;padding:3px";

  function filterByPeriod(logs) {
    const now = new Date();
    if (activePeriod === "All") return logs;
    return logs.filter(l => {
      const d = new Date(l.clock_in);
      if (activePeriod === "Day") {
        return d.toDateString() === now.toDateString();
      } else if (activePeriod === "Week") {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0,0,0,0);
        return d >= weekStart;
      } else if (activePeriod === "Month") {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else if (activePeriod === "Year") {
        return d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }

  const tabBtns = {};
  periods.forEach(p => {
    const btn = document.createElement("button");
    btn.textContent = p;
    btn.style.cssText = "padding:5px 14px;border:none;border-radius:6px;font-size:0.8rem;font-weight:600;cursor:pointer;transition:all 0.15s";
    btn.onclick = () => {
      activePeriod = p;
      periods.forEach(pp => {
        tabBtns[pp].style.background = pp === p ? "#fff" : "transparent";
        tabBtns[pp].style.color = pp === p ? "var(--text-primary)" : "var(--text-muted)";
        tabBtns[pp].style.boxShadow = pp === p ? "0 1px 3px rgba(0,0,0,0.1)" : "none";
      });
      renderLogsTable();
    };
    btn.style.background = p === activePeriod ? "#fff" : "transparent";
    btn.style.color = p === activePeriod ? "var(--text-primary)" : "var(--text-muted)";
    btn.style.boxShadow = p === activePeriod ? "0 1px 3px rgba(0,0,0,0.1)" : "none";
    tabBtns[p] = btn;
    tabsWrap.appendChild(btn);
  });

  filterBar.appendChild(tabsWrap);

  // Summary stats strip
  const statsStrip = document.createElement("div");
  statsStrip.style.cssText = "display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap";
  page.appendChild(filterBar);
  page.appendChild(statsStrip);

  // Table card
  const card = document.createElement("div");
  card.className = "card";
  page.appendChild(card);

  function renderLogsTable() {
    card.innerHTML = "";
    statsStrip.innerHTML = "";

    const source = isAdmin
      ? db.timeLogs
      : db.timeLogs.filter(l => l.employee_id === empId);

    const filtered = filterByPeriod(source);

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
    const headers = isAdmin
      ? ["Employee", "Date", "Clock In", "Clock Out", "Hours", "Shift", "Status", ""]
      : ["Date", "Clock In", "Clock Out", "Hours", "Shift", "Status"];

    const rows = filtered.map(l => {
      const dateStr     = fmtDate(l.clock_in);
      const clockInStr  = fmtTime(l.clock_in);
      const clockOutStr = l.clock_out ? fmtTime(l.clock_out) : `<span style="color:var(--text-muted)">Active</span>`;
      const hoursStr    = l.total_hours != null ? Number(l.total_hours).toFixed(2) + "h" : `<span style="color:var(--text-muted)">—</span>`;
      const shiftStr    = `<span style="font-size:0.78rem">${l.category_name || "—"}</span>`;
      const statusBadge = l.status_label ? badge(l.status_label) : "—";

      if (isAdmin) {
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

        const empCell = document.createElement("div");
        empCell.className = "emp-cell";
        empCell.innerHTML = `${avatarHTML(l.full_name || "?", "sm")}<span style="margin-left:6px;font-size:0.85rem">${l.full_name || "?"}</span>`;

        return [empCell, dateStr, clockInStr, clockOutStr, hoursStr, shiftStr, statusBadge, actCell];
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
