function renderHolidays(db, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  let selectedYear = new Date().getFullYear();

  function refresh() {
    page.innerHTML = "";
    render();
  }

  async function reloadHolidays() {
    try {
      db.holidays = await apiRequest(`/holidays.php?year=${selectedYear}`);
      onDbChange(db);
    } catch (err) {
      showToast(err.message || "Could not reload holidays.", "error");
    }
  }

  function render() {
    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-primary";
    addBtn.innerHTML = `${icons.plus} Add Holiday`;
    addBtn.addEventListener("click", () => openHolidayModal(null));

    page.appendChild(pageHeader(
      "Holidays",
      `${(db.holidays || []).length} holidays in ${selectedYear}`,
      addBtn
    ));

    // Year filter
    const filterRow = document.createElement("div");
    filterRow.style.cssText = "display:flex;align-items:center;gap:10px;margin-bottom:16px";

    const yearLabel = document.createElement("span");
    yearLabel.className = "text-sm";
    yearLabel.textContent = "Year:";

    const yearSelect = document.createElement("select");
    yearSelect.className = "input";
    yearSelect.style.width = "120px";
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 1; y <= currentYear + 2; y++) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      if (y === selectedYear) opt.selected = true;
      yearSelect.appendChild(opt);
    }
    yearSelect.addEventListener("change", async () => {
      selectedYear = parseInt(yearSelect.value);
      await reloadHolidays();
      refresh();
    });

    filterRow.appendChild(yearLabel);
    filterRow.appendChild(yearSelect);
    page.appendChild(filterRow);

    const card = document.createElement("div");
    card.className = "card";

    const rows = (db.holidays || []).map(h => {
      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-ghost btn-sm";
      editBtn.innerHTML = `${icons.pencil} Edit`;
      editBtn.addEventListener("click", () => openHolidayModal(h));

      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-ghost btn-sm";
      delBtn.style.color = "var(--red, #ef4444)";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => deleteHoliday(h));

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      const typeBadge = `<span class="text-xs" style="font-weight:600;color:${h.holiday_type === 'Regular' ? '#dc2626' : '#d97706'}">${h.holiday_type}</span>`;

      return [
        `<span class="mono text-xs">${h.holiday_date}</span>`,
        `<span class="font-medium text-sm">${h.holiday_name}</span>`,
        typeBadge,
        actions,
      ];
    });

    card.appendChild(buildTable(
      ["Date", "Holiday Name", "Type", ""],
      rows,
      "No holidays found for this year."
    ));
    page.appendChild(card);
  }

  function deleteHoliday(h) {
    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "18px";

    const message = document.createElement("p");
    message.className = "text-sm";
    message.textContent = `Are you sure you want to delete "${h.holiday_name}" (${h.holiday_date})?`;
    body.appendChild(message);

    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const keepBtn = document.createElement("button");
    keepBtn.className = "btn btn-outline";
    keepBtn.textContent = "Keep Holiday";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger";
    deleteBtn.textContent = "Delete Holiday";

    footer.appendChild(keepBtn);
    footer.appendChild(deleteBtn);
    body.appendChild(footer);

    const { close } = openModal({ title: "Delete Holiday", body });

    keepBtn.addEventListener("click", close);

    deleteBtn.addEventListener("click", async () => {
      deleteBtn.disabled = true;
      try {
        await apiRequest(`/holidays.php?id=${h.holiday_id}`, { method: "DELETE" });
        await reloadHolidays();
        close();
        showToast("Holiday deleted.", "success");
        refresh();
      } catch (err) {
        showToast(err.message || "Could not delete holiday.", "error");
        deleteBtn.disabled = false;
      }
    });
  }

  function openHolidayModal(existing) {
    const isEdit = !!existing;
    const data = isEdit ? { ...existing } : {
      holiday_date: "", holiday_name: "", holiday_type: "Regular",
    };

    const body = document.createElement("div");
    body.style.cssText = "display:flex;flex-direction:column;gap:14px";

    const fDate = makeInput("date", data.holiday_date || "");
    const fName = makeInput("text", data.holiday_name,  "e.g. Christmas Day");

    const fType = document.createElement("select");
    fType.className = "input";
    ["Regular", "Special"].forEach(t => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      if (t === data.holiday_type) opt.selected = true;
      fType.appendChild(opt);
    });

    body.appendChild(buildField("Date", fDate));
    body.appendChild(buildField("Holiday Name", fName));
    body.appendChild(buildField("Holiday Type", fType));

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
    saveBtn.innerHTML = `${icons.check} ${isEdit ? "Save Changes" : "Add Holiday"}`;
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    body.appendChild(footer);

    const { close } = openModal({
      title: isEdit ? "Edit Holiday" : "Add Holiday",
      body,
    });

    cancelBtn.addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {
      const date = fDate.value;
      const name = fName.value.trim();
      const type = fType.value;

      if (!date) { errEl.textContent = "Date is required."; errEl.style.display = "block"; return; }
      if (!name) { errEl.textContent = "Holiday name is required."; errEl.style.display = "block"; return; }

      const payload = { holiday_date: date, holiday_name: name, holiday_type: type };
      if (isEdit) payload.holiday_id = data.holiday_id;

      errEl.style.display = "none";
      saveBtn.disabled = true;

      try {
        await apiRequest("/holidays.php", {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify(payload),
        });
        await reloadHolidays();
        close();
        showToast(isEdit ? "Holiday updated." : "Holiday added.", "success");
        refresh();
      } catch (err) {
        errEl.textContent = err.message || "Could not save holiday.";
        errEl.style.display = "block";
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  render();
  return page;
}