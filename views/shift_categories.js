// ── Shift Categories view (admin only) — TSK-41 ───────
// Admin views all shift categories in a table showing shift name,
// start time, end time, and rate multiplier.
// Admin can add a new shift or edit an existing one.

function renderShiftCategories(db, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  function refresh() {
    page.innerHTML = "";
    render();
  }

  async function reloadShifts() {
    try {
      db.shiftCategories = await apiRequest("/shift_categories.php");
      onDbChange(db);
    } catch (err) {
      showToast(err.message || "Could not reload shift categories.", "error");
    }
  }

  function render() {
    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-primary";
    addBtn.innerHTML = `${icons.plus} Add Shift`;
    addBtn.addEventListener("click", () => openShiftModal(null));

    page.appendChild(pageHeader(
      "Shift Categories",
      `${db.shiftCategories.length} shift types`,
      addBtn
    ));

    const card = document.createElement("div");
    card.className = "card";

    const rows = db.shiftCategories.map(s => {
      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-ghost btn-sm";
      editBtn.innerHTML = `${icons.pencil} Edit`;
      editBtn.addEventListener("click", () => openShiftModal(s));

      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-ghost btn-sm";
      delBtn.style.color = "var(--red, #ef4444)";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => deleteShift(s));

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      return [
        `<span class="font-medium text-sm">${s.category_name}</span>`,
        `<span class="mono text-xs">${s.standard_start_time || "—"}</span>`,
        `<span class="mono text-xs">${s.standard_end_time   || "—"}</span>`,
        `<span class="mono text-xs" style="color:#6366f1;font-weight:600">${Number(s.rate_multiplier).toFixed(2)}×</span>`,
        actions,
      ];
    });

    card.appendChild(buildTable(
      ["Shift Name", "Start Time", "End Time", "Rate Multiplier", ""],
      rows,
      "No shift categories defined."
    ));
    page.appendChild(card);
  }

  // ── Delete confirmation modal ─────────────────────────
  function deleteShift(s) {
    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "18px";

    const message = document.createElement("p");
    message.className = "text-sm";
    message.textContent = `Are you sure you want to delete the shift "${s.category_name}"? This will fail if time logs use this shift.`;

    body.appendChild(message);

    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const keepBtn = document.createElement("button");
    keepBtn.className = "btn btn-outline";
    keepBtn.textContent = "Keep Shift";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger";
    deleteBtn.innerHTML = `Delete Shift`;

    footer.appendChild(keepBtn);
    footer.appendChild(deleteBtn);
    body.appendChild(footer);

    const { close } = openModal({
      title: "Delete Shift Category",
      body,
    });

    keepBtn.addEventListener("click", close);

    deleteBtn.addEventListener("click", async () => {
      deleteBtn.disabled = true;

      try {
        await apiRequest(`/shift_categories.php?id=${s.shift_category_id}`, { method: "DELETE" });
        await reloadShifts();
        close();
        showToast("Shift category deleted.", "success");
        refresh();
      } catch (err) {
        showToast(err.message || "Could not delete shift.", "error");
        deleteBtn.disabled = false;
      }
    });
  }

  function openShiftModal(existing) {
    const isEdit = !!existing;
    const data = isEdit ? { ...existing } : {
      category_name: "", rate_multiplier: 1.0,
      standard_start_time: "", standard_end_time: "",
    };

    const body = document.createElement("div");
    body.style.cssText = "display:flex;flex-direction:column;gap:14px";

    const fName  = makeInput("text",   data.category_name,        "e.g. Day Shift");
    const fStart = makeInput("time",   data.standard_start_time || "");
    const fEnd   = makeInput("time",   data.standard_end_time   || "");
    const fMult  = makeInput("number", data.rate_multiplier);
    fMult.step = "0.01";
    fMult.min  = "0.01";

    const grid = document.createElement("div");
    grid.className = "grid-2";
    grid.style.gap = "14px";
    grid.appendChild(buildField("Start Time", fStart));
    grid.appendChild(buildField("End Time", fEnd));

    body.appendChild(buildField("Shift Name", fName));
    body.appendChild(grid);
    body.appendChild(buildField("Rate Multiplier", fMult));

    const hint = document.createElement("div");
    hint.style.cssText = "font-size:0.78rem;color:var(--text-muted)";
    hint.textContent = "Rate multiplier: 1.0 = standard, 1.25 = 25% premium, etc.";
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
    saveBtn.innerHTML = `${icons.check} ${isEdit ? "Save Changes" : "Add Shift"}`;
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    body.appendChild(footer);

    const { close } = openModal({
      title: isEdit ? "Edit Shift Category" : "Add Shift Category",
      body,
    });

    cancelBtn.addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {
      const name = fName.value.trim();
      if (!name) {
        errEl.textContent = "Shift name is required.";
        errEl.style.display = "block";
        return;
      }
      const mult = parseFloat(fMult.value);
      if (!mult || mult <= 0) {
        errEl.textContent = "Rate multiplier must be greater than 0.";
        errEl.style.display = "block";
        return;
      }

      const payload = {
        category_name:       name,
        rate_multiplier:     mult,
        standard_start_time: fStart.value || null,
        standard_end_time:   fEnd.value   || null,
      };
      if (isEdit) payload.shift_category_id = data.shift_category_id;

      errEl.style.display = "none";
      saveBtn.disabled = true;

      try {
        await apiRequest("/shift_categories.php", {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify(payload),
        });
        await reloadShifts();
        close();
        showToast(isEdit ? "Shift updated." : "Shift added.", "success");
        refresh();
      } catch (err) {
        errEl.textContent = err.message || "Could not save shift.";
        errEl.style.display = "block";
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  render();
  return page;
}
