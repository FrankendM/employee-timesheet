// Leave Records view

function renderLeaveRecords(db, account, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  const approverView = isLeaveApprover(account);
  const fullAdmin    = isLeaveFullAdmin(account);
  const employeeView = isEmployee(account);
  const supervisorView = isSupervisor(account);

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
    const actionEl = document.createElement("div");
    actionEl.style.display = "flex";
    actionEl.style.gap = "8px";

    if (employeeView) {
      const fileBtn = document.createElement("button");
      fileBtn.className = "btn btn-primary";
      fileBtn.innerHTML = `${icons.plus} File Leave`;
      fileBtn.addEventListener("click", () => openLeaveModal(null));
      actionEl.appendChild(fileBtn);
    }

    const pageTitle = employeeView ? "My Leave" : "Leave Records";
    const pageSub = employeeView
      ? "File, view, and cancel your leave requests"
      : supervisorView
        ? "Review and approve leave for your department — you cannot approve your own requests"
        : "Company-wide leave management — approve or reject any request";

    page.appendChild(pageHeader(
      pageTitle,
      pageSub,
      actionEl.children.length ? actionEl : null
    ));

    if (supervisorView) {
      const scope = scopeBannerProps(db, account);
      if (scope) page.appendChild(buildScopeBanner(scope));
    } else if (fullAdmin) {
      page.appendChild(buildScopeBanner(scopeBannerProps(db, account)));
    } else if (employeeView) {
      page.appendChild(buildScopeBanner({
        variant: "personal",
        title: "Your leave requests",
        detail: "You can file new leave, edit pending requests, and cancel before approval.",
      }));
    }

    // Filters card
    const card = document.createElement("div");
    card.className = "card";

    const toolbar = document.createElement("div");
    toolbar.style.display = "flex";
    toolbar.style.gap = "10px";
    toolbar.style.flexWrap = "wrap";
    toolbar.style.marginBottom = "4px";

    // Search
    toolbar.appendChild(buildSearchBar({
      placeholder: approverView ? "Search by employee or leave type…" : "Search by leave type…",
      value: searchVal,
      onInput: (val) => { searchVal = val; renderTable(card); },
    }));

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

    const leaveParams = new URLSearchParams();
    if (searchVal)    leaveParams.set('search', searchVal);
    if (filterStatus) leaveParams.set('status', filterStatus);
    const filtered = await apiRequest(`/leave_records.php?${leaveParams.toString()}`);

    const headers = approverView
      ? ["Employee", "Leave Type", "From", "To", "Status", "Remarks", ""]
      : ["Leave Type", "From", "To", "Status", "Remarks", ""];

    const rows = filtered.map(l => {
      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";

      if (approverView) {
        const viewBtn = document.createElement("button");
        viewBtn.className = "btn btn-ghost btn-sm";
        viewBtn.innerHTML = `${icons.eye} View`;
        viewBtn.addEventListener("click", () => openLeaveDetailsModal(l));
        actions.appendChild(viewBtn);

        // Approve/Rejects
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

        if (fullAdmin) {
          const delBtn = document.createElement("button");
          delBtn.className = "btn btn-ghost btn-sm";
          delBtn.style.color = "var(--red, #ef4444)";
          delBtn.textContent = "Delete";
          delBtn.addEventListener("click", () => deleteLeave(l));
          actions.appendChild(delBtn);
        }

      } else {
        // Employee only possible edit/cancel only if pending
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

      if (approverView) {
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

  // Admin - update status
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

  // Admin - delete confirmation modal
  function deleteLeave(leave) {
    const name = leave.full_name || "this employee";
    openConfirmModal({
      title: "Delete Leave Record",
      message: `Are you sure you want to delete this leave record for ${name}? This action cannot be undone.`,
      keepLabel: "Keep Record",
      confirmLabel: "Delete Record",
      onConfirm: async () => {
        await apiRequest(`/leave_records.php?id=${leave.leave_id}`, { method: "DELETE" });
        await reloadLeaves();
        showToast("Leave record removed.", "success");
        refresh();
      },
    });
  }

  function openCancelModal(leave) {
    openConfirmModal({
      title: "Cancel Leave Request",
      message: "Are you sure you want to cancel this leave request? This action cannot be undone.",
      keepLabel: "Keep Request",
      confirmLabel: "Cancel Request",
      onConfirm: async () => {
        await apiRequest(`/leave_records.php?id=${leave.leave_id}`, { method: "DELETE" });
        await reloadLeaves();
        showToast("Leave request cancelled.", "success");
        refresh();
      },
    });
  }

  // Admin - full leave details modal
  function openLeaveDetailsModal(leave) {
    const emp = db.employees.find(e => e.employee_id === leave.employee_id) || null;
    const name = leave.full_name || employeeName(emp);

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
    const leaveTypeMeta = (db.leaveTypes || []).find(t => t.leave_type_id === leave.leave_type_id);
    const paidLabel = leaveTypeMeta
      ? (leaveTypeMeta.is_paid ? `<span style="color:#16a34a;font-weight:600">Paid</span>` : `<span style="color:var(--text-muted);font-weight:600">Unpaid</span>`)
      : "—";

    leaveGrid.appendChild(detailItem("Leave Type", leave.leave_type));
    leaveGrid.appendChild(detailItem("Paid?", paidLabel));
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

  // File / edit leave modal
  function openLeaveModal(existing) {
    const isEdit = !!existing;
    const data = isEdit ? { ...existing } : {
      leave_type_id: db.leaveTypes[0] ? db.leaveTypes[0].leave_type_id : "",
      date_from: "",
      date_to: "",
      remarks: "",
    };

    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "14px";

    const leaveTypeOptions = (db.leaveTypes && db.leaveTypes.length)
      ? db.leaveTypes.map(t => [t.leave_type_id, t.leave_name])
      : [];

    const resolvedTypeId = data.leave_type_id
      || (db.leaveTypes.find(t => t.leave_name === data.leave_type) || {}).leave_type_id
      || "";

    const fType    = makeSelect(leaveTypeOptions, resolvedTypeId);
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
        leave_type_id: Number(fType.value),
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
