function renderWorkSchedules(db, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  function refresh() {
    page.innerHTML = "";
    render();
  }

  async function reloadSchedules() {
    try {
      db.workSchedules = await apiRequest("/work_schedules.php");
      onDbChange(db);
    } catch (err) {
      showToast(err.message || "Could not reload work schedules.", "error");
    }
  }

  function render() {
    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-primary";
    addBtn.innerHTML = `${icons.plus} Add Schedule`;
    addBtn.addEventListener("click", () => openScheduleModal(null));

    page.appendChild(pageHeader(
      "Work Schedules",
      `${(db.workSchedules || []).length} schedules`,
      addBtn
    ));

    const card = document.createElement("div");
    card.className = "card";

    const rows = (db.workSchedules || []).map(s => {
      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-ghost btn-sm";
      editBtn.innerHTML = `${icons.pencil} Edit`;
      editBtn.addEventListener("click", () => openScheduleModal(s));

      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-ghost btn-sm";
      delBtn.style.color = "var(--red, #ef4444)";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => deleteSchedule(s));

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      return [
        `<span class="font-medium text-sm">${s.schedule_name}</span>`,
        `<span class="mono text-xs">${s.start_time || "—"} - ${s.end_time || "—"}</span>`,
        `<span class="mono text-xs">${s.break_minutes || 0} min</span>`,
        `<span class="mono text-xs">${Number(s.required_hours || 0).toFixed(2)}h</span>`,
        `<span class="mono text-xs">${s.grace_minutes || 0}m grace / ${s.late_after_minutes || 0}m late</span>`,
        `<span class="text-xs font-medium">${s.rest_day || "—"}</span>`,
        `<span class="mono text-xs">${s.employee_count || 0}</span>`,
        actions,
      ];
    });

    card.appendChild(buildTable(
      ["Schedule Name", "Shift Time", "Break", "Req. Hours", "Late Tolerance", "Rest Day", "Employees", ""],
      rows,
      "No work schedules defined."
    ));
    page.appendChild(card);
  }

  function deleteSchedule(s) {
    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "18px";

    const message = document.createElement("p");
    message.className = "text-sm";
    message.textContent = `Are you sure you want to delete "${s.schedule_name}"?`;
    body.appendChild(message);

    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const keepBtn = document.createElement("button");
    keepBtn.className = "btn btn-outline";
    keepBtn.textContent = "Keep Schedule";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger";
    deleteBtn.textContent = "Delete Schedule";

    footer.appendChild(keepBtn);
    footer.appendChild(deleteBtn);
    body.appendChild(footer);

    const { close } = openModal({ title: "Delete Work Schedule", body });

    keepBtn.addEventListener("click", close);

    deleteBtn.addEventListener("click", async () => {
      deleteBtn.disabled = true;
      try {
        await apiRequest(`/work_schedules.php?id=${s.schedule_id}`, { method: "DELETE" });
        await reloadSchedules();
        close();
        showToast("Work schedule deleted.", "success");
        refresh();
      } catch (err) {
        showToast(err.message || "Could not delete schedule.", "error");
        deleteBtn.disabled = false;
      }
    });
  }

  function openScheduleModal(existing) {
    const isEdit = !!existing;
    const data = isEdit ? { ...existing } : {
      schedule_name: "", start_time: "", end_time: "",
      break_minutes: 60, required_hours: 8.00, grace_minutes: 15, late_after_minutes: 15, rest_day: "Sunday"
    };

    const body = document.createElement("div");
    body.style.cssText = "display:flex;flex-direction:column;gap:14px";

    const fName  = makeInput("text", data.schedule_name, "e.g. Morning Shift");
    const fStart = makeInput("time", data.start_time || "");
    const fEnd   = makeInput("time", data.end_time   || "");
    const fBreak = makeInput("number", data.break_minutes ?? 60, "e.g. 60");
    const fRequired = makeInput("number", data.required_hours ?? 8.00, "e.g. 8.0");
    fRequired.step = "0.5";
    fRequired.min = "0";
    const fGrace = makeInput("number", data.grace_minutes ?? 15, "e.g. 15");
    const fLate = makeInput("number", data.late_after_minutes ?? 15, "e.g. 15");

    const dayOpts = [
      ["Sunday", "Sunday"],
      ["Monday", "Monday"],
      ["Tuesday", "Tuesday"],
      ["Wednesday", "Wednesday"],
      ["Thursday", "Thursday"],
      ["Friday", "Friday"],
      ["Saturday", "Saturday"]
    ];
    const fRest = makeSelect(dayOpts, data.rest_day || "Sunday");

    const grid1 = document.createElement("div");
    grid1.className = "grid-2";
    grid1.style.gap = "14px";
    grid1.appendChild(buildField("Start Time", fStart));
    grid1.appendChild(buildField("End Time",   fEnd));

    const grid2 = document.createElement("div");
    grid2.className = "grid-2";
    grid2.style.gap = "14px";
    grid2.appendChild(buildField("Break Minutes", fBreak));
    grid2.appendChild(buildField("Required Hours", fRequired));

    const grid3 = document.createElement("div");
    grid3.className = "grid-2";
    grid3.style.gap = "14px";
    grid3.appendChild(buildField("Grace Minutes", fGrace));
    grid3.appendChild(buildField("Late After Minutes", fLate));

    body.appendChild(buildField("Schedule Name", fName));
    body.appendChild(grid1);
    body.appendChild(grid2);
    body.appendChild(grid3);
    body.appendChild(buildField("Rest Day", fRest));

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
    saveBtn.innerHTML = `${icons.check} ${isEdit ? "Save Changes" : "Add Schedule"}`;
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    body.appendChild(footer);

    const { close } = openModal({
      title: isEdit ? "Edit Work Schedule" : "Add Work Schedule",
      body,
    });

    cancelBtn.addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {
      const name  = fName.value.trim();
      const start = fStart.value;
      const end   = fEnd.value;
      const breakMin = parseInt(fBreak.value) || 60;
      const reqHours = parseFloat(fRequired.value) || 8.00;
      const graceMin = parseInt(fGrace.value) || 15;
      const lateMin  = parseInt(fLate.value) || 15;
      const restDay  = fRest.value;

      if (!name) {
        errEl.textContent = "Schedule name is required.";
        errEl.style.display = "block";
        return;
      }
      if (!start) {
        errEl.textContent = "Start time is required.";
        errEl.style.display = "block";
        return;
      }
      if (!end) {
        errEl.textContent = "End time is required.";
        errEl.style.display = "block";
        return;
      }

      const payload = {
        schedule_name: name,
        start_time: start,
        end_time: end,
        break_minutes: breakMin,
        required_hours: reqHours,
        grace_minutes: graceMin,
        late_after_minutes: lateMin,
        rest_day: restDay
      };
      if (isEdit) payload.schedule_id = data.schedule_id;

      errEl.style.display = "none";
      saveBtn.disabled = true;

      try {
        await apiRequest("/work_schedules.php", {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify(payload),
        });
        await reloadSchedules();
        close();
        showToast(isEdit ? "Schedule updated." : "Schedule added.", "success");
        refresh();
      } catch (err) {
        errEl.textContent = err.message || "Could not save schedule.";
        errEl.style.display = "block";
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  render();
  return page;
}