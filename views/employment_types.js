function renderEmploymentTypes(db, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  function refresh() {
    page.innerHTML = "";
    render();
  }

  async function reloadTypes() {
    try {
      db.employmentTypes = await apiRequest("/employment_types.php");
      onDbChange(db);
    } catch (err) {
      showToast(err.message || "Could not reload employment types.", "error");
    }
  }

  function render() {
    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-primary";
    addBtn.innerHTML = `${icons.plus} Add Type`;
    addBtn.addEventListener("click", () => openTypeModal(null));

    page.appendChild(pageHeader(
      "Employment Types",
      `${(db.employmentTypes || []).length} types`,
      addBtn
    ));

    const card = document.createElement("div");
    card.className = "card";

    const rows = (db.employmentTypes || []).map(t => {
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

      return [
        `<span class="font-medium text-sm">${t.type_name}</span>`,
        actions,
      ];
    });

    card.appendChild(buildTable(
      ["Type Name", ""],
      rows,
      "No employment types defined."
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
    message.textContent = `Are you sure you want to delete "${t.type_name}"?`;
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

    const { close } = openModal({ title: "Delete Employment Type", body });

    keepBtn.addEventListener("click", close);

    deleteBtn.addEventListener("click", async () => {
      deleteBtn.disabled = true;
      try {
        await apiRequest(`/employment_types.php?id=${t.employment_type_id}`, { method: "DELETE" });
        await reloadTypes();
        close();
        showToast("Employment type deleted.", "success");
        refresh();
      } catch (err) {
        showToast(err.message || "Could not delete type.", "error");
        deleteBtn.disabled = false;
      }
    });
  }

  function openTypeModal(existing) {
    const isEdit = !!existing;
    const data = isEdit ? { ...existing } : { type_name: "" };

    const body = document.createElement("div");
    body.style.cssText = "display:flex;flex-direction:column;gap:14px";

    const fName = makeInput("text", data.type_name, "e.g. Regular");
    body.appendChild(buildField("Type Name", fName));

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
    saveBtn.innerHTML = `${icons.check} ${isEdit ? "Save Changes" : "Add Type"}`;
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    body.appendChild(footer);

    const { close } = openModal({
      title: isEdit ? "Edit Employment Type" : "Add Employment Type",
      body,
    });

    cancelBtn.addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {
      const name = fName.value.trim();
      if (!name) {
        errEl.textContent = "Type name is required.";
        errEl.style.display = "block";
        return;
      }

      const payload = {
        type_name: name,
      };
      if (isEdit) payload.employment_type_id = data.employment_type_id;

      errEl.style.display = "none";
      saveBtn.disabled = true;

      try {
        await apiRequest("/employment_types.php", {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify(payload),
        });
        await reloadTypes();
        close();
        showToast(isEdit ? "Type updated." : "Type added.", "success");
        refresh();
      } catch (err) {
        errEl.textContent = err.message || "Could not save type.";
        errEl.style.display = "block";
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  render();
  return page;
}