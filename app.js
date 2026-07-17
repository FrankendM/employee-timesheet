// ── App state ─────────────────────────────────────────
let db          = emptyDb();
let account     = null;
let activeView  = "dashboard";
let loadError   = null;
let checkingSession = true;

const root = document.getElementById("app");

// ── Icons ─────────────────────────────────────────────
const clockIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
const liveIcon  = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>`;
const logsIcon  = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
const payIcon   = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`;
const shiftIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><line x1="2" y1="2" x2="22" y2="22" stroke-width="1.5"/></svg>`;

// ── Boot screen ───────────────────────────────────────
function renderBootScreen() {
  const wrap = document.createElement("div");
  wrap.className = "boot-screen";
  wrap.innerHTML = `
    <div class="boot-screen-icon">${icons.timer}</div>
    <div class="boot-spinner"></div>
  `;
  return wrap;
}

// ── Access levels ─────────────────────────────────────
// Mirrors middleware/helpers.php: employee, supervisor, payroll_admin, system_admin
const LEVEL = {
  SYSTEM_ADMIN:  "system_admin",
  PAYROLL_ADMIN: "payroll_admin",
  SUPERVISOR:    "supervisor",
  EMPLOYEE:      "employee",
};

// ── Navigation, per role ────────────────────────────────
// Each nav's items only include views that role's backend routes actually
// allow. Button-level permissions (e.g. who can Add/Edit/Delete) are handled
// inside the individual view files using `account.access_level`.

const navSystemAdmin = [
  { id: "dashboard",         label: "Dashboard",         icon: icons.dashboard  },
  { id: "employees",         label: "Employees",         icon: icons.users      },
  { id: "departments",       label: "Departments",       icon: icons.briefcase  },
  { id: "accounts",          label: "Accounts",          icon: icons.userPlus   },
  { id: "leave_records",     label: "Leave Records",     icon: icons.fileText   },
  { id: "clocked_in_now",    label: "Clocked In Now",    icon: liveIcon         },
  { id: "my_logs",           label: "Time Logs",         icon: logsIcon         },
  { id: "payroll",           label: "Payroll",           icon: payIcon          },
  { id: "shift_categories",  label: "Shift Categories",  icon: shiftIcon        },
  { id: "employment_status", label: "Employment Status", icon: icons.users      },
  { id: "work_schedules",    label: "Work Schedules",    icon: shiftIcon        },
  { id: "employment_types",  label: "Employment Types",  icon: icons.briefcase  },
  { id: "holidays",          label: "Holidays",          icon: icons.fileText   },
  { id: "reports",           label: "Reports",           icon: icons.barChart   },
  { id: "audit_log",         label: "Audit Log",         icon: icons.history    },
];

// payroll_admin: everything system_admin has EXCEPT Departments, Accounts,
// and Audit Log (those routes hard-require system_admin in the backend).
const navPayrollAdmin = navSystemAdmin.filter(
  n => !["departments", "accounts", "audit_log"].includes(n.id)
);

// supervisor: dept-scoped Employees + their own operational views. No admin
// configuration pages (those never accept a "supervisor" access level).
const navSupervisor = [
  { id: "dashboard",       label: "Dashboard",      icon: icons.dashboard },
  { id: "employees",       label: "My Department",  icon: icons.users     },
  { id: "clocked_in_now",  label: "Clocked In Now", icon: liveIcon        },
  { id: "leave_records",   label: "Leave Records",  icon: icons.fileText  },
  { id: "time_logs",       label: "Clock In / Out", icon: clockIcon       },
  { id: "my_logs",         label: "My Time Logs",   icon: logsIcon        },
  { id: "payroll",         label: "My Pay",         icon: payIcon         },
];

// employee: self-service only.
const navEmployee = [
  { id: "dashboard",     label: "Dashboard",      icon: icons.dashboard },
  { id: "time_logs",     label: "Clock In / Out",  icon: clockIcon      },
  { id: "my_logs",       label: "My Time Logs",    icon: logsIcon       },
  { id: "leave_records", label: "My Leave",        icon: icons.fileText },
  { id: "payroll",       label: "My Pay",          icon: payIcon        },
];

function navForAccount(acc) {
  switch (acc && acc.access_level) {
    case LEVEL.SYSTEM_ADMIN:  return navSystemAdmin;
    case LEVEL.PAYROLL_ADMIN: return navPayrollAdmin;
    case LEVEL.SUPERVISOR:    return navSupervisor;
    case LEVEL.EMPLOYEE:      return navEmployee;
    default:                  return navEmployee; // safest fallback
  }
}

// ── Data load ─────────────────────────────────────────
async function loadDb() {
  try {
    db = await fetchAllData();
    loadError = null;
  } catch (err) {
    loadError = err.message || "Failed to load data.";
  }
}

// ── Render app ────────────────────────────────────────
async function renderApp() {
  root.innerHTML = "";

  if (checkingSession) {
    root.appendChild(renderBootScreen());
    return;
  }

  if (!account) {
    root.appendChild(renderLogin(async acc => {
      account = acc;
      activeView = "dashboard";
      await loadDb();
      renderApp();
    }));
    return;
  }

  if (loadError) {
    const errBox = document.createElement("div");
    errBox.className = "alert-error";
    errBox.style.margin = "24px";
    errBox.textContent = `Could not load data from the server: ${loadError}`;
    root.appendChild(errBox);
    return;
  }

  const level   = account.access_level;
  const navItems = navForAccount(account);
  const allowed  = navItems.map(n => n.id);

  if (!allowed.includes(activeView)) activeView = "dashboard";

  const emp = account.employee_id != null
    ? db.employees.find(e => e.employee_id === account.employee_id)
    : null;

  const layout = document.createElement("div");
  layout.className = "layout";

  const sidebar = buildSidebar({
    navItems,
    activeId: activeView,
    onNav: (id) => {
      if (!allowed.includes(id)) return;
      activeView = id;
      renderApp();
    },
    account,
    emp,
    onLogout: async () => {
      try { await logoutRequest(); } catch (_) {}
      account    = null;
      activeView = "dashboard";
      renderApp();
    },
  });

  const main = document.createElement("main");
  main.className = "main";

  const dbChangeHandler = (updated) => { db = updated; };

  // System Admin / Payroll Admin — full admin-side config pages.
  // These backend routes never accept "supervisor" or "employee".
  const isAdminConfigLevel = level === LEVEL.SYSTEM_ADMIN || level === LEVEL.PAYROLL_ADMIN;

  let view;
  switch (activeView) {
    case "employees":
      // employees.php GET allows system_admin/payroll_admin/supervisor
      // (each scoped differently server-side). renderEmployees uses
      // `account` to decide which buttons (Add/Edit/Deactivate) to show.
      view = allowed.includes("employees")
        ? renderEmployees(db, account, dbChangeHandler)
        : renderDashboard(db, account);
      break;
    case "departments":
      // departments.php write ops are system_admin only.
      view = level === LEVEL.SYSTEM_ADMIN
        ? renderDepartments(db, account, dbChangeHandler)
        : renderDashboard(db, account);
      break;
    case "accounts":
      // accounts.php is system_admin only, full stop.
      view = level === LEVEL.SYSTEM_ADMIN
        ? renderAccounts(db, dbChangeHandler)
        : renderDashboard(db, account);
      break;
    case "leave_records":
      view = renderLeaveRecords(db, account, dbChangeHandler);
      break;
    case "clocked_in_now":
      view = allowed.includes("clocked_in_now")
        ? renderClockedInNow(db, account, dbChangeHandler)
        : renderDashboard(db, account);
      break;
    case "time_logs":
      view = renderTimeLogs(db, account, dbChangeHandler);
      break;
    case "my_logs":
      view = renderMyLogs(db, account, dbChangeHandler);
      break;
    case "payroll":
      view = renderPayroll(db, account, dbChangeHandler);
      break;
    case "shift_categories":
      view = isAdminConfigLevel ? renderShiftCategories(db, dbChangeHandler) : renderDashboard(db, account);
      break;
    case "employment_status":
      view = isAdminConfigLevel ? renderEmploymentStatus(db, dbChangeHandler) : renderDashboard(db, account);
      break;
    case "work_schedules":
      view = isAdminConfigLevel ? renderWorkSchedules(db, dbChangeHandler) : renderDashboard(db, account);
      break;
    case "employment_types":
      view = isAdminConfigLevel ? renderEmploymentTypes(db, dbChangeHandler) : renderDashboard(db, account);
      break;
    case "holidays":
      view = isAdminConfigLevel ? renderHolidays(db, dbChangeHandler) : renderDashboard(db, account);
      break;
    case "reports":
      view = isAdminConfigLevel ? renderReports(db, dbChangeHandler) : renderDashboard(db, account);
      break;
    case "audit_log":
      // audit_log.php is system_admin only, full stop.
      view = level === LEVEL.SYSTEM_ADMIN
        ? renderAuditLog(db, dbChangeHandler)
        : renderDashboard(db, account);
      break;
    default:
      view = renderDashboard(db, account);
  }

  main.appendChild(view);
  layout.appendChild(sidebar);
  layout.appendChild(main);
  root.appendChild(layout);
}

// ── Change Password Modal ─────────────────────────────
// Self-service: any logged-in user can change their own password.

function openChangePasswordModal() {
  const body = document.createElement("div");
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.gap = "14px";

  const fCurrent = makeInput("password", "", "Enter current password");
  const fNew     = makeInput("password", "", "At least 6 characters");
  const fConfirm = makeInput("password", "", "Re-enter new password");

  body.appendChild(buildField("Current Password", fCurrent));
  body.appendChild(buildField("New Password",     fNew));
  body.appendChild(buildField("Confirm New Password", fConfirm));

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
  saveBtn.innerHTML = `${icons.check} Change Password`;

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
  body.appendChild(footer);

  const { close } = openModal({ title: "Change Password", body });

  cancelBtn.addEventListener("click", close);

  saveBtn.addEventListener("click", async () => {
    const currentPassword = fCurrent.value;
    const newPassword     = fNew.value;
    const confirmPassword = fConfirm.value;

    if (!currentPassword) {
      errEl.textContent = "Please enter your current password.";
      errEl.style.display = "block";
      return;
    }
    if (newPassword.length < 6) {
      errEl.textContent = "New password must be at least 6 characters.";
      errEl.style.display = "block";
      return;
    }
    if (newPassword !== confirmPassword) {
      errEl.textContent = "New passwords do not match.";
      errEl.style.display = "block";
      return;
    }

    errEl.style.display = "none";
    saveBtn.disabled = true;

    try {
      await apiRequest("/auth.php?action=change_password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password:     newPassword,
        }),
      });
      close();
      showToast("Password changed successfully.", "success");
    } catch (err) {
      errEl.textContent = err.message || "Could not change password.";
      errEl.style.display = "block";
    } finally {
      saveBtn.disabled = false;
    }
  });
}

// ── Boot ──────────────────────────────────────────────
async function boot() {
  renderApp();

  try {
    account = await apiRequest("/auth.php?action=me");
  } catch (err) {
    account = null;
  }

  if (account) {
    await loadDb();
  }

  checkingSession = false;
  renderApp();
}

boot();
