// Incident Reports
// Employee files a report on a time log then Supervisor/HR/Admin investigates

const REPORT_REASONS = [
  "No Show",
  "Unauthorized Attendance",
  "System Error",
  "Attendance Fraud",
  "Other",
];

function renderIncidentReports(db, account, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  const validatorView = isReportValidator(account);
  const supervisorView = isSupervisor(account);

  let filterStatus = "";

  function refresh() {
    page.innerHTML = "";
    render();
  }

  async function reloadReports() {
    try {
      db.incidentReports = await fetchIncidentReports();
      onDbChange(db);
    } catch (err) {
      showToast(err.message || "Could not reload reports.", "error");
    }
  }

  function render() {
    const actionEl = document.createElement("div");
    const fileBtn = document.createElement("button");
    fileBtn.className = "btn btn-primary";
    fileBtn.innerHTML = `${icons.plus} File Report`;
    fileBtn.addEventListener("click", () => openReportModal());
    actionEl.appendChild(fileBtn);

    page.appendChild(pageHeader(
      validatorView ? "Attendance Reports" : "My Attendance Reports",
      validatorView
        ? (supervisorView
            ? "Review and investigate attendance incidents for your department"
            : "Company-wide attendance incident reports")
        : "Report attendance incidents such as buddy punching or a no-show",
      actionEl
    ));

    const card = document.createElement("div");
    card.className = "card";

    const toolbar = document.createElement("div");
    toolbar.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px";

    const statusFilter = makeSelect(
      [["", "All Statuses"], ["Pending", "Pending"], ["Confirmed", "Confirmed"], ["Dismissed", "Dismissed"], ["Supervisor Approved", "Supervisor Approved"]],
      filterStatus
    );
    statusFilter.addEventListener("change", e => {
      filterStatus = e.target.value;
      renderTable(card);
    });
    toolbar.appendChild(statusFilter);
    card.appendChild(toolbar);

    renderTable(card);
    page.appendChild(card);
  }

  async function renderTable(card) {
    const old = card.querySelector(".table-wrap, .table-empty-wrap");
    if (old) old.remove();

    const params = new URLSearchParams();
    if (filterStatus === "Pending")   params.set("validation_status_id", "1");
    if (filterStatus === "Confirmed") params.set("validation_status_id", "2");
    if (filterStatus === "Dismissed") params.set("validation_status_id", "3");
    if (filterStatus === "Supervisor Approved") params.set("validation_status_id", "4");

    let reports;
    try {
      reports = await fetchIncidentReports(params.toString());
    } catch (err) {
      card.appendChild(buildTable([], [], err.message || "Could not load reports."));
      return;
    }

    const headers = validatorView
      ? ["Employee", "Work Date", "Reason", "Description", "Status", "Reported By", ""]
      : ["Work Date", "Reason", "Description", "Status", ""];

    const rows = reports.map(r => {
      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";

      const viewBtn = document.createElement("button");
      viewBtn.className = "btn btn-ghost btn-sm";
      viewBtn.innerHTML = `${icons.eye} View`;
      viewBtn.addEventListener("click", () => openReportDetailsModal(r));
      actions.appendChild(viewBtn);

      const isOwnReport = r.reported_by_account_id === account.account_id;
      // 1 = Pending, 4 = Supervisor Approved (see validation_status table / PUT handler in incident_reports.php)
      const canAct = validatorView && (r.validation_status_id === 1 || r.validation_status_id === 4) && !isOwnReport;
      if (canAct) {
        if (isSupervisor(account) && r.validation_status_id === 1) {
          // Supervisors recommend (→4), not final confirm
          const recBtn = document.createElement("button");
          recBtn.className = "btn btn-ghost btn-sm";
          recBtn.style.color = "var(--red, #ef4444)";
          recBtn.textContent = "Recommend";
          recBtn.addEventListener("click", () => resolveReport(r, 4));
          actions.appendChild(recBtn);
        } else if (!isSupervisor(account)) {
          // HR/Admin can final confirm
          const confirmBtn = document.createElement("button");
          confirmBtn.className = "btn btn-ghost btn-sm";
          confirmBtn.style.color = "var(--red, #ef4444)";
          confirmBtn.textContent = "Confirm";
          confirmBtn.addEventListener("click", () => resolveReport(r, 2));
          actions.appendChild(confirmBtn);
        }

        const dismissBtn = document.createElement("button");
        dismissBtn.className = "btn btn-ghost btn-sm";
        dismissBtn.style.color = "var(--text-muted, #6b7280)";
        dismissBtn.textContent = "Dismiss";
        dismissBtn.addEventListener("click", () => resolveReport(r, 3));
        actions.appendChild(dismissBtn);
      }

      const base = [
        `<span class="mono text-xs">${fmtDate(r.work_date)}</span>`,
        `<span class="text-xs">${r.report_reason}</span>`,
        `<span class="text-xs text-gray">${(r.description || "").slice(0, 60)}${(r.description || "").length > 60 ? "…" : ""}</span>`,
        badge(r.validation_status || "Pending"),
        actions,
      ];

      if (validatorView) {
        const empCell = document.createElement("div");
        empCell.className = "emp-cell";
        empCell.innerHTML = `${avatarHTML(r.employee_name || "?", "sm")}<span class="text-sm">${r.employee_name || "?"}</span>`;
        return [empCell, base[0], base[1], base[2], base[3], `<span class="text-xs text-gray">${r.reported_by_username || "—"}</span>`, base[4]];
      }

      return base;
    });

    card.appendChild(buildTable(headers, rows, "No reports found."));
  }

  async function resolveReport(report, statusId) {
    const label = statusId === 2 ? "Confirmed" : "Dismissed";
    const remarks = prompt(`Investigation remarks for ${label.toLowerCase()} report (optional):`) || null;
    try {
      await validateIncidentReportRequest({
        report_id: report.report_id,
        validation_status_id: statusId,
        remarks,
      });
      await reloadReports();
      showToast(`Report ${label.toLowerCase()}.`, "success");
      refresh();
    } catch (err) {
      showToast(err.message || "Could not update report.", "error");
    }
  }

  function openReportDetailsModal(report) {
    const body = document.createElement("div");
    body.className = "detail-grid";
    body.style.gridTemplateColumns = "1fr 1fr";
    body.style.gap = "12px";

    [
      ["Employee", report.employee_name || "—"],
      ["Work Date", fmtDate(report.work_date)],
      ["Clock In", fmtTime(report.clock_in)],
      ["Clock Out", report.clock_out ? fmtTime(report.clock_out) : "—"],
      ["Reason", report.report_reason],
      ["Status", badge(report.validation_status || "Pending")],
      ["Reported By", report.reported_by_username || "—"],
      ["Investigated By", report.validated_by_username || "—"],
    ].forEach(([label, value]) => {
      const item = document.createElement("div");
      item.innerHTML = `<div class="detail-item-label">${label}</div><div class="detail-item-value">${value}</div>`;
      body.appendChild(item);
    });

    const desc = document.createElement("div");
    desc.style.gridColumn = "1 / -1";
    desc.innerHTML = `<div class="detail-item-label">Description</div><div class="detail-reason-box">${report.description || "—"}</div>`;
    body.appendChild(desc);

    if (report.remarks) {
      const res = document.createElement("div");
      res.style.gridColumn = "1 / -1";
      res.innerHTML = `<div class="detail-item-label">Investigation Remarks</div><div class="detail-reason-box">${report.remarks}</div>`;
      body.appendChild(res);
    }

    const { close } = openModal({ title: "Report Details", body, wide: true });
    void close;
  }

  function openReportModal() {
    // You're reporting an incident about someone else's attendance — never your own.
    const reportableEmps = db.employees.filter(e => e.employee_id !== account.employee_id);

    const body = document.createElement("div");
    body.style.cssText = "display:flex;flex-direction:column;gap:14px";

    const empOptions = reportableEmps.map(e => [e.employee_id, employeeName(e)]);
    const fEmp = makeSelect(empOptions, (empOptions[0] && empOptions[0][0]) || "");
    const fDate = makeInput("date", "");
    const fReason = makeSelect(REPORT_REASONS.map(r => [r, r]), REPORT_REASONS[0]);
    const fDesc = document.createElement("textarea");
    fDesc.className = "input";
    fDesc.rows = 4;
    fDesc.placeholder = "Describe what happened…";

    body.appendChild(buildField("Employee", fEmp));
    body.appendChild(buildField("Date", fDate));
    body.appendChild(buildField("Reason", fReason));
    body.appendChild(buildField("Description", fDesc));

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
    saveBtn.innerHTML = `${icons.check} Submit Report`;
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    body.appendChild(footer);

    const { close } = openModal({ title: "File Attendance Report", body, wide: true });
    cancelBtn.addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {
      if (!fEmp.value) {
        errEl.textContent = "Select an employee.";
        errEl.style.display = "block";
        return;
      }
      if (!fDate.value) {
        errEl.textContent = "Select a date.";
        errEl.style.display = "block";
        return;
      }
      if (!fDesc.value.trim()) {
        errEl.textContent = "Description is required.";
        errEl.style.display = "block";
        return;
      }

      errEl.style.display = "none";
      saveBtn.disabled = true;

      try {
        await createIncidentReportRequest({
          employee_id: Number(fEmp.value),
          work_date: fDate.value,
          report_reason: fReason.value,
          description: fDesc.value.trim(),
        });
        await reloadReports();
        close();
        showToast("Report submitted.", "success");
        refresh();
      } catch (err) {
        errEl.textContent = err.message || "Could not submit report.";
        errEl.style.display = "block";
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  render();
  return page;
}