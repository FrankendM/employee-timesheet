// Leave Types view (system_admin only)
// Manages the master list of leave types leave applications and leave
// balances draw from: name, whether it's paid, and the default entitlement
// (max_days_per_year) used when a balance row is auto-created on first
// approval.

function renderLeaveTypes(db, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  function refresh() {
    page.innerHTML = "";
    render();
  }

  async function reloadTypes() {
    try {
      db.leaveTypes = await fetchLeaveTypes();
      onDbChange(db);
    } catch (err) {
      showToast(err.message || "Could not reload leave types.", "error");
    }
  }

  function render() {
    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-primary";
    addBtn.innerHTML = `${icons.plus} Add Leave Type`;
    addBtn.addEventListener("click", () => openTypeModal(null));

    page.appendChild(pageHeader(
      "Leave Types",
      `${(db.leaveTypes || []).length} leave type${(db.leaveTypes || []).length === 1 ? "" : "s"} — controls what employees can select when filing leave`,
      addBtn
    ));

    const card = document.createElement("div");
    card.className = "card";

    const rows = (db.leaveTypes || []).map(t => {
      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-ghost btn-sm";
      editBtn.innerHTML = `${icons.pencil} Edit`;
      editBtn.addEventListener("click", () => openTypeModal(t));

      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-ghost btn-sm";
      delBtn.style.color = "var(--red, #ef4444)";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => deleteType(t));

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      const paidBadge = t.is_paid
        ? `<span class="text-xs" style="font-weight:600;color:#16a34a">Paid</span>`
        : `<span class="text-xs" style="font-weight:600;color:var(--text-muted)">Unpaid</span>`;

      return [
        `<span class="font-medium text-sm">${t.leave_name}</span>`,
        paidBadge,
        `<span class="mono text-xs">${Number(t.max_days_per_year).toFixed(1)}d / year</span>`,
        actions,
      ];
    });

    card.appendChild(buildTable(
      ["Leave Type", "Paid?", "Default Entitlement", ""],
      rows,
      "No leave types defined yet."
    ));
    page.appendChild(card);
  }

  function deleteType(t) {
    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "18px";

    const message = document.createElement("p");
    message.className = "text-sm";
    message.textContent = `Are you sure you want to delete "${t.leave_name}"? This will fail if any leave records or balances already reference it.`;
    body.appendChild(message);

    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const keepBtn = document.createElement("button");
    keepBtn.className = "btn btn-outline";
    keepBtn.textContent = "Keep Type";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger";
    deleteBtn.textContent = "Delete Type";

    footer.appendChild(keepBtn);
    footer.appendChild(deleteBtn);
    body.appendChild(footer);

    const { close } = openModal({ title: "Delete Leave Type", body });

    keepBtn.addEventListener("click", close);

    deleteBtn.addEventListener("click", async () => {
      deleteBtn.disabled = true;
      try {
        await deleteLeaveType({ leave_type_id: t.leave_type_id });
        await reloadTypes();
        close();
        showToast("Leave type deleted.", "success");
        refresh();
      } catch (err) {
        showToast(err.message || "Could not delete leave type.", "error");
        deleteBtn.disabled = false;
      }
    });
  }

  function openTypeModal(existing) {
    const isEdit = !!existing;
    const data = isEdit
      ? { ...existing }
      : { leave_name: "", is_paid: true, max_days_per_year: 15 };

    const body = document.createElement("div");
    body.style.cssText = "display:flex;flex-direction:column;gap:14px";

    const fName = makeInput("text", data.leave_name, "e.g. Sick Leave");

    const fMaxDays = makeInput("number", data.max_days_per_year);
    fMaxDays.step = "0.5";
    fMaxDays.min = "0";

    const fPaidWrap = document.createElement("label");
    fPaidWrap.style.cssText = "display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.85rem;";
    const fPaid = document.createElement("input");
    fPaid.type = "checkbox";
    fPaid.checked = !!data.is_paid;
    const fPaidLabel = document.createElement("span");
    fPaidLabel.textContent = "This leave type is paid";
    fPaidWrap.appendChild(fPaid);
    fPaidWrap.appendChild(fPaidLabel);

    body.appendChild(buildField("Leave Type Name", fName));
    body.appendChild(buildField("Default Entitlement (days / year)", fMaxDays));
    body.appendChild(fPaidWrap);

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
    saveBtn.innerHTML = `${icons.check} ${isEdit ? "Save Changes" : "Add Leave Type"}`;
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    body.appendChild(footer);

    const { close } = openModal({
      title: isEdit ? "Edit Leave Type" : "Add Leave Type",
      body,
    });

    cancelBtn.addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {
      const name = fName.value.trim();
      const maxDays = parseFloat(fMaxDays.value);

      if (!name) {
        errEl.textContent = "Leave type name is required.";
        errEl.style.display = "block";
        return;
      }
      if (isNaN(maxDays) || maxDays < 0) {
        errEl.textContent = "Default entitlement must be a non-negative number.";
        errEl.style.display = "block";
        return;
      }

      const payload = {
        leave_name: name,
        is_paid: fPaid.checked,
        max_days_per_year: maxDays,
      };
      if (isEdit) payload.leave_type_id = data.leave_type_id;

      errEl.style.display = "none";
      saveBtn.disabled = true;

      try {
        if (isEdit) {
          await updateLeaveType(payload);
        } else {
          await createLeaveType(payload);
        }
        await reloadTypes();
        close();
        showToast(isEdit ? "Leave type updated." : "Leave type added.", "success");
        refresh();
      } catch (err) {
        errEl.textContent = err.message || "Could not save leave type.";
        errEl.style.display = "block";
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  render();
  return page;
}
