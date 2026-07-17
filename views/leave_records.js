// ── Leave Records view ────────────────────────────────
// Admin: sees all, can approve/reject/delete
// Employee: sees own, can file new, edit/cancel pending

function renderLeaveRecords(db, account, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  // Valid access_level values: system_admin, payroll_admin, supervisor, employee.
  // Privileged = sees all/dept records + approve/reject (system_admin, payroll_admin, supervisor —
  // matches leave_records.php PUT, which allows all three, minus approving one's own request).
  // Full admin = can also hard-delete any record (system_admin, payroll_admin only, per DELETE route).
  const isAdmin      = ["system_admin", "payroll_admin", "supervisor"].includes(account.access_level);
  const isFullAdmin  = ["system_admin", "payroll_admin"].includes(account.access_level);
  let searchVal = "";
  let filterStatus = "";

  function refresh() {
    page.innerHTML = "";
    render();
  }

  async function reloadLeaves() {
    try {
      db.leaveRecords = await apiRequest("/leave_records.php");
      onDbChange(db);
    } catch (err) {
      showToast(err.message || "Could not reload leave records.", "error");
    }
  }

  function render() {
    // ── Header ──────────────────────────────────────
    const actionEl = document.createElement("div");
    actionEl.style.display = "flex";
    actionEl.style.gap = "8px";

    if (!isAdmin) {
      const fileBtn = document.createElement("button");
      fileBtn.className = "btn btn-primary";
      fileBtn.innerHTML = `${icons.plus} File Leave`;
      fileBtn.addEventListener("click", () => openLeaveModal(null));
      actionEl.appendChild(fileBtn);
    }

    // db.leaveRecords already comes back role-scoped from the backend
    // (all records / own department / own records only) — no need to
    // re-filter by employee_id here.
    const myLeaves = db.leaveRecords;

    page.appendChild(pageHeader(
      "Leave Records",
      isAdmin ? `${myLeaves.length} total records` : `${myLeaves.length} my requests`,
      actionEl.children.length ? actionEl : null
    ));

    // ── Filters card ─────────────────────────────────
    const card = document.createElement("div");
    card.className = "card";

    const toolbar = document.createElement("div");
    toolbar.style.display = "flex";
    toolbar.style.gap = "10px";
    toolbar.style.flexWrap = "wrap";
    toolbar.style.marginBottom = "4px";

    // Search
    const searchBar = document.createElement("div");
    searchBar.className = "search-bar";
    searchBar.style.flex = "1";
    searchBar.innerHTML = `${icons.search}`;
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = isAdmin ? "Search by employee or leave type…" : "Search by leave type…";
    searchInput.value = searchVal;
    searchInput.addEventListener("input", e => {
      searchVal = e.target.value;
      renderTable(card);
    });
    searchBar.appendChild(searchInput);
    toolbar.appendChild(searchBar);

    // Status filter
    const statusFilter = makeSelect(
      [["", "All Statuses"], ["Pending", "Pending"], ["Approved", "Approved"], ["Rejected", "Rejected"]],
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

    // Backend filtering — search and status sent as query params
    const leaveParams = new URLSearchParams();
    if (searchVal)    leaveParams.set('search', searchVal);
    if (filterStatus) leaveParams.set('status', filterStatus);
    const filtered = await apiRequest(`/leave_records.php?${leaveParams.toString()}`);

    const headers = isAdmin
      ? ["Employee", "Leave Type", "From", "To", "Status", "Remarks", ""]
      : ["Leave Type", "From", "To", "Status", "Remarks", ""];

    const rows = filtered.map(l => {
      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";

      if (isAdmin) {
        const viewBtn = document.createElement("button");
        viewBtn.className = "btn btn-ghost btn-sm";
        viewBtn.innerHTML = `${icons.eye} View`;
        viewBtn.addEventListener("click", () => openLeaveDetailsModal(l));
        actions.appendChild(viewBtn);

        // Approve/Reject — backend blocks a supervisor approving their own request
        const isOwnAsSupervisor = account.access_level === "supervisor" && l.employee_id === account.employee_id;
        if (l.leave_status === "Pending" && !isOwnAsSupervisor) {
          const approveBtn = document.createElement("button");
          approveBtn.className = "btn btn-ghost btn-sm";
          approveBtn.style.color = "var(--emerald, #10b981)";
          approveBtn.textContent = "Approve";
          approveBtn.addEventListener("click", () => updateStatus(l, "Approved"));
          actions.appendChild(approveBtn);

          const rejectBtn = document.createElement("button");
          rejectBtn.className = "btn btn-ghost btn-sm";
          rejectBtn.style.color = "var(--red, #ef4444)";
          rejectBtn.textContent = "Reject";
          rejectBtn.addEventListener("click", () => updateStatus(l, "Rejected"));
          actions.appendChild(rejectBtn);
        }

        if (isFullAdmin) {
          const delBtn = document.createElement("button");
          delBtn.className = "btn btn-ghost btn-sm";
          delBtn.style.color = "var(--red, #ef4444)";
          delBtn.textContent = "Delete";
          delBtn.addEventListener("click", () => deleteLeave(l));
          actions.appendChild(delBtn);
        }

      } else {
        // Employee: edit/cancel only if pending
        if (l.leave_status === "Pending") {
          const editBtn = document.createElement("button");
          editBtn.className = "btn btn-ghost btn-sm";
          editBtn.innerHTML = `${icons.pencil} Edit`;
          editBtn.addEventListener("click", () => openLeaveModal(l));
          actions.appendChild(editBtn);

          const cancelBtn = document.createElement("button");
          cancelBtn.className = "btn btn-ghost btn-sm";
          cancelBtn.style.color = "var(--red, #ef4444)";
          cancelBtn.textContent = "Cancel";
          cancelBtn.addEventListener("click", () => openCancelModal(l));
          actions.appendChild(cancelBtn);
        }
      }

      const baseRow = [
        `<span class="text-xs">${l.leave_type}</span>`,
        `<span class="mono text-xs">${fmtDate(l.date_from)}</span>`,
        `<span class="mono text-xs">${fmtDate(l.date_to)}</span>`,
        badge(l.leave_status),
        `<span class="text-xs text-gray">${l.remarks || "—"}</span>`,
        actions,
      ];

      if (isAdmin) {
        const empCell = document.createElement("div");
        empCell.className = "emp-cell";
        empCell.style.cursor = "pointer";
        empCell.title = "View full details";
        empCell.innerHTML = l.full_name
          ? `${avatarHTML(l.full_name, "sm")}<span class="text-sm font-medium">${l.full_name}</span>`
          : `<span class="text-xs text-gray">Unknown</span>`;
        empCell.addEventListener("click", () => openLeaveDetailsModal(l));
        return [empCell, ...baseRow];
      }

      return baseRow;
    });

    card.appendChild(buildTable(headers, rows, "No leave records found."));
  }

  // ── Admin: update status ─────────────────────────────
  async function updateStatus(leave, newStatus) {
    try {
      await apiRequest("/leave_records.php", {
        method: "PUT",
        body: JSON.stringify({ leave_id: leave.leave_id, leave_status: newStatus }),
      });
      await reloadLeaves();
      showToast(`Leave ${newStatus.toLowerCase()}.`, "success");
      refresh();
    } catch (err) {
      showToast(err.message || "Could not update status.", "error");
    }
  }

  // ── Admin: delete confirmation modal ──────────────────
  function deleteLeave(leave) {
    const name = leave.full_name || "this employee";

    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "18px";

    const message = document.createElement("p");
    message.className = "text-sm";
    message.textContent = `Are you sure you want to delete this leave record for ${name}? This action cannot be undone.`;

    body.appendChild(message);

    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const keepBtn = document.createElement("button");
    keepBtn.className = "btn btn-outline";
    keepBtn.textContent = "Keep Record";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger";
    deleteBtn.innerHTML = `Delete Record`;

    footer.appendChild(keepBtn);
    footer.appendChild(deleteBtn);
    body.appendChild(footer);

    const { close } = openModal({
      title: "Delete Leave Record",
      body,
    });

    keepBtn.addEventListener("click", close);

    deleteBtn.addEventListener("click", async () => {
      deleteBtn.disabled = true;

      try {
        await apiRequest(`/leave_records.php?id=${leave.leave_id}`, {
          method: "DELETE",
        });

        await reloadLeaves();
        close();
        showToast("Leave record removed.", "success");
        refresh();
      } catch (err) {
        showToast(err.message || "Could not delete record.", "error");
        deleteBtn.disabled = false;
      }
    });
  }

  // ── Employee: cancel confirmation modal ───────────────
  function openCancelModal(leave) {
    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "18px";

    const message = document.createElement("p");
    message.className = "text-sm";
    message.textContent =
      "Are you sure you want to cancel this leave request? This action cannot be undone.";

    body.appendChild(message);

    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const keepBtn = document.createElement("button");
    keepBtn.className = "btn btn-outline";
    keepBtn.textContent = "Keep Request";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-danger";
    cancelBtn.innerHTML = `Cancel Request`;

    footer.appendChild(keepBtn);
    footer.appendChild(cancelBtn);
    body.appendChild(footer);

    const { close } = openModal({
      title: "Cancel Leave Request",
      body,
    });

    keepBtn.addEventListener("click", close);

    cancelBtn.addEventListener("click", async () => {
      cancelBtn.disabled = true;

      try {
        await apiRequest(`/leave_records.php?id=${leave.leave_id}`, {
          method: "DELETE",
        });

        await reloadLeaves();
        close();
        showToast("Leave request cancelled.", "success");
        refresh();
      } catch (err) {
        showToast(err.message || "Could not cancel leave request.", "error");
        cancelBtn.disabled = false;
      }
    });
  }

  // ── Admin: full leave details modal ──────────────────
  function openLeaveDetailsModal(leave) {
    const emp = db.employees.find(e => e.employee_id === leave.employee_id) || null;
    const name = leave.full_name || (emp ? emp.full_name : "Unknown Employee");

    const body = document.createElement("div");

    // Employee info
    const empSection = document.createElement("div");
    empSection.innerHTML = `<div class="detail-section-title">Employee</div>`;

    const empHeader = document.createElement("div");
    empHeader.className = "detail-employee";
    const subParts = [emp?.role_name, emp?.department_name].filter(Boolean);
    empHeader.innerHTML = `
      ${avatarHTML(name, "md")}
      <div>
        <div class="detail-employee-name">${name}</div>
        <div class="detail-employee-sub">${subParts.length ? subParts.join(" · ") : "—"}</div>
      </div>
    `;
    empSection.appendChild(empHeader);

    const empGrid = document.createElement("div");
    empGrid.className = "detail-grid";
    empGrid.appendChild(detailItem("Department", emp?.department_name || "—"));
    empGrid.appendChild(detailItem("Role", emp?.role_name || "—"));
    empGrid.appendChild(detailItem("Email", emp?.email || "—"));
    empGrid.appendChild(detailItem("Contact No.", emp?.contact_no || "—"));
    empSection.appendChild(empGrid);
    body.appendChild(empSection);

    const divider = document.createElement("div");
    divider.className = "detail-divider";
    body.appendChild(divider);

    // Leave request info
    const leaveSection = document.createElement("div");
    leaveSection.innerHTML = `<div class="detail-section-title">Leave Request</div>`;

    const days = leaveDayCount(leave.date_from, leave.date_to);
    const leaveGrid = document.createElement("div");
    leaveGrid.className = "detail-grid";
    leaveGrid.appendChild(detailItem("Leave Type", leave.leave_type));
    leaveGrid.appendChild(detailItem("Status", badge(leave.leave_status)));
    leaveGrid.appendChild(detailItem("From", fmtDate(leave.date_from)));
    leaveGrid.appendChild(detailItem("To", fmtDate(leave.date_to)));
    leaveGrid.appendChild(detailItem("Duration", `${days} day${days === 1 ? "" : "s"}`));
    leaveGrid.appendChild(detailItem("Request ID", `#${leave.leave_id}`));
    leaveSection.appendChild(leaveGrid);

    const reasonWrap = document.createElement("div");
    reasonWrap.style.marginTop = "16px";
    const reasonLabel = document.createElement("div");
    reasonLabel.className = "detail-item-label";
    reasonLabel.style.marginBottom = "6px";
    reasonLabel.textContent = "Reason / Remarks";
    const reasonBox = document.createElement("div");
    reasonBox.className = "detail-reason-box";
    reasonBox.textContent = leave.remarks || "No reason provided.";
    reasonWrap.appendChild(reasonLabel);
    reasonWrap.appendChild(reasonBox);
    leaveSection.appendChild(reasonWrap);

    body.appendChild(leaveSection);

    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-outline";
    closeBtn.textContent = "Close";
    footer.appendChild(closeBtn);

    if (leave.leave_status === "Pending") {
      const rejectBtn = document.createElement("button");
      rejectBtn.className = "btn btn-ghost";
      rejectBtn.style.color = "var(--red, #ef4444)";
      rejectBtn.textContent = "Reject";
      rejectBtn.addEventListener("click", async () => { await updateStatus(leave, "Rejected"); close(); });
      footer.appendChild(rejectBtn);

      const approveBtn = document.createElement("button");
      approveBtn.className = "btn btn-primary";
      approveBtn.innerHTML = `${icons.check} Approve`;
      approveBtn.addEventListener("click", async () => { await updateStatus(leave, "Approved"); close(); });
      footer.appendChild(approveBtn);
    }

    body.appendChild(footer);

    const { close } = openModal({ title: "Leave Request Details", body, wide: true });
    closeBtn.addEventListener("click", close);
  }

  function detailItem(label, value) {
    const div = document.createElement("div");
    const l = document.createElement("div");
    l.className = "detail-item-label";
    l.textContent = label;
    const v = document.createElement("div");
    v.className = "detail-item-value";
    v.innerHTML = value;
    div.appendChild(l);
    div.appendChild(v);
    return div;
  }

  function leaveDayCount(dateFrom, dateTo) {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const diff = Math.round((to - from) / 86400000) + 1;
    return diff > 0 ? diff : 1;
  }

  // ── File / edit leave modal ──────────────────────────
  function openLeaveModal(existing) {
    const isEdit = !!existing;
    const data = isEdit ? { ...existing } : {
      leave_type: "",
      date_from: "",
      date_to: "",
      remarks: "",
    };

    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "14px";

    // Leave types from database instead of hardcoded
    const leaveTypeOptions = (db.leaveTypes && db.leaveTypes.length)
      ? db.leaveTypes.map(t => [t.leave_name, t.leave_name])
      : [
          ["Sick Leave",      "Sick Leave"],
          ["Vacation Leave",  "Vacation Leave"],
          ["Emergency Leave", "Emergency Leave"],
          ["Maternity Leave", "Maternity Leave"],
          ["Paternity Leave", "Paternity Leave"],
          ["Unpaid Leave",    "Unpaid Leave"],
        ];
    const leaveTypes = [
      ["Sick Leave",       "Sick Leave"],
      ["Vacation Leave",   "Vacation Leave"],
      ["Emergency Leave",  "Emergency Leave"],
      ["Maternity Leave",  "Maternity Leave"],
      ["Paternity Leave",  "Paternity Leave"],
      ["Unpaid Leave",     "Unpaid Leave"],
    ];

    const fType    = makeSelect(leaveTypeOptions, data.leave_type || (leaveTypeOptions[0] && leaveTypeOptions[0][0]) || "");
    const fFrom    = makeInput("date", data.date_from);
    const fTo      = makeInput("date", data.date_to);
    const fRemarks = makeInput("text", data.remarks, "Optional remarks…");

    const grid = document.createElement("div");
    grid.className = "grid-2";
    grid.style.gap = "14px";
    grid.appendChild(buildField("From", fFrom));
    grid.appendChild(buildField("To", fTo));

    body.appendChild(buildField("Leave Type", fType));
    body.appendChild(grid);
    body.appendChild(buildField("Remarks (optional)", fRemarks));

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
    saveBtn.innerHTML = `${icons.check} ${isEdit ? "Save Changes" : "Submit Request"}`;

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    body.appendChild(footer);

    const { close } = openModal({
      title: isEdit ? "Edit Leave Request" : "File Leave Request",
      body,
    });

    cancelBtn.addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {
      const dateFrom = fFrom.value;
      const dateTo   = fTo.value;

      if (!dateFrom) { errEl.textContent = "Start date is required."; errEl.style.display = "block"; return; }
      if (!dateTo)   { errEl.textContent = "End date is required.";   errEl.style.display = "block"; return; }
      if (dateTo < dateFrom) { errEl.textContent = "End date must be on or after start date."; errEl.style.display = "block"; return; }

      const payload = {
        leave_type: fType.value,
        date_from:  dateFrom,
        date_to:    dateTo,
        remarks:    fRemarks.value.trim() || null,
      };

      if (isEdit) payload.leave_id = data.leave_id;

      errEl.style.display = "none";
      saveBtn.disabled = true;

      try {
        await apiRequest("/leave_records.php", {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify(payload),
        });
        await reloadLeaves();
        close();
        showToast(isEdit ? "Leave request updated." : "Leave request submitted.", "success");
        refresh();
      } catch (err) {
        errEl.textContent = err.message || "Could not save leave request.";
        errEl.style.display = "block";
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  render();
  return page;
}