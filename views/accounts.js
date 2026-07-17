// ── Accounts view (admin only) ────────────────────────

function renderAccounts(db, onDbChange) {
  const page = document.createElement("div");
  page.className = "page";

  let searchVal = "";

  function refresh() {
    page.innerHTML = "";
    render();
  }

  function render() {
    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-primary";
    addBtn.innerHTML = `${icons.plus} Add Account`;
    addBtn.addEventListener("click", () => openAccountModal(null));
    page.appendChild(pageHeader("Accounts", `${db.accounts.length} accounts`, addBtn));

    const card = document.createElement("div");
    card.className = "card";

    const searchBar = document.createElement("div");
    searchBar.className = "search-bar";
    searchBar.innerHTML = `${icons.search}`;
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search by username or employee…";
    searchInput.value = searchVal;
    searchInput.addEventListener("input", e => {
      searchVal = e.target.value;
      renderTable(card);
    });
    searchBar.appendChild(searchInput);
    card.appendChild(searchBar);

    renderTable(card);
    page.appendChild(card);
  }

  async function renderTable(card) {
    const old = card.querySelector(".table-wrap, .table-empty-wrap");
    if (old) old.remove();

    const acctParams = new URLSearchParams();
    if (searchVal) acctParams.set('search', searchVal);
    const filtered = await apiRequest(`/accounts.php?${acctParams.toString()}`);

    const rows = filtered.map(a => {
      const empCell = document.createElement("div");
      empCell.className = "emp-cell";
      empCell.innerHTML = a.full_name
        ? `${avatarHTML(a.full_name, "sm")}<div class="emp-cell-info"><p>${a.full_name}</p><p>${a.email || ""}</p></div>`
        : `<span class="text-xs text-gray">— No linked employee —</span>`;

      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-ghost btn-sm";
      editBtn.innerHTML = `${icons.pencil} Edit`;
      editBtn.addEventListener("click", () => openAccountModal(a));

      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-ghost btn-sm";
      delBtn.style.color = "var(--red, #ef4444)";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => confirmDelete(a));

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      return [
        empCell,
        `<span class="mono text-xs font-medium">${a.username}</span>`,
        badge(a.access_level),
        actions,
      ];
    });

    card.appendChild(buildTable(["Employee", "Username", "Access Level", ""], rows));
  }

  // ── Delete confirmation modal ─────────────────────────
  function confirmDelete(a) {
    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "18px";

    const message = document.createElement("p");
    message.className = "text-sm";
    message.textContent = `Are you sure you want to delete the account "${a.username}"? This action cannot be undone.`;

    body.appendChild(message);

    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const keepBtn = document.createElement("button");
    keepBtn.className = "btn btn-outline";
    keepBtn.textContent = "Keep Account";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger";
    deleteBtn.innerHTML = `Delete Account`;

    footer.appendChild(keepBtn);
    footer.appendChild(deleteBtn);
    body.appendChild(footer);

    const { close } = openModal({
      title: "Delete Account",
      body,
    });

    keepBtn.addEventListener("click", close);

    deleteBtn.addEventListener("click", async () => {
      deleteBtn.disabled = true;

      try {
        await deleteAccountRequest(a.account_id);
        db.accounts = await apiRequest("/accounts.php");
        onDbChange(db);
        close();
        showToast("Account deleted.", "success");
        refresh();
      } catch (err) {
        showToast(err.message || "Could not delete account.", "error");
        deleteBtn.disabled = false;
      }
    });
  }

  function openAccountModal(existing) {
    const isEdit = !!existing;
    const data = isEdit ? { ...existing } : {
      employee_id: null,
      username: "",
      email: "",
      access_level: "employee",
    };

    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "14px";

    // Only show employees that don't already have an account (or the current one)
    const takenIds = new Set(
      db.accounts
        .filter(a => a.employee_id != null && a.account_id !== (existing && existing.account_id))
        .map(a => a.employee_id)
    );
    const availableEmps = db.employees.filter(e => !takenIds.has(e.employee_id));

    const empOpts = [["", "— No linked employee —"], ...availableEmps.map(e => [e.employee_id, e.full_name])];
    const fEmp = makeSelect(empOpts, data.employee_id ?? "");
    const fUser = makeInput("text", data.username, "username");
    const fEmail = makeInput("email", data.email, "email@corp.ph");
    const fPw = makeInput("password", "", "password");
    const fAccess = makeSelect([["system_admin", "System Admin"], ["employee", "Employee"],["payroll_admin", "Payroll Admin"],["supervisor", "Supervisor"]], data.access_level);

    body.appendChild(buildField("Linked Employee (optional)", fEmp));
    body.appendChild(buildField("Username", fUser));
    body.appendChild(buildField("Email", fEmail));
    body.appendChild(buildField(isEdit ? "New Password (leave blank to keep)" : "Password", fPw));
    body.appendChild(buildField("Access Level", fAccess));

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
    saveBtn.innerHTML = `${icons.check} ${isEdit ? "Save Changes" : "Create Account"}`;

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    body.appendChild(footer);

    const { close } = openModal({ title: isEdit ? "Edit Account" : "Add Account", body });

    cancelBtn.addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {
      const username = fUser.value.trim();
      const email = fEmail.value.trim();
      const pw = fPw.value.trim();

      if (!username) { errEl.textContent = "Username is required."; errEl.style.display = "block"; return; }
      if (!email) { errEl.textContent = "Email is required."; errEl.style.display = "block"; return; }
      if (!isEdit && !pw) { errEl.textContent = "Password is required."; errEl.style.display = "block"; return; }
      if (pw && pw.length < 6) { errEl.textContent = "Password must be at least 6 characters."; errEl.style.display = "block"; return; }

      const employeeId = fEmp.value === "" ? null : Number(fEmp.value);

      const payload = {
        employee_id: employeeId,
        username,
        email,
        access_level: fAccess.value,
      };
      if (pw) payload.password = pw;

      errEl.style.display = "none";
      saveBtn.disabled = true;

      try {
        if (isEdit) {
          await updateAccountRequest(data.account_id, payload);
        } else {
          await createAccountRequest(payload);
        }
        db.accounts = await apiRequest("/accounts.php");
        onDbChange(db);
        close();
        showToast(isEdit ? "Account updated." : "Account created.", "success");
        refresh();
      } catch (err) {
        errEl.textContent = err.message || "Could not save account.";
        errEl.style.display = "block";
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  render();
  return page;
}