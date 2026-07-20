// App state
let db            = emptyDb();
let account       = null;
let activeView    = "dashboard";
let loadError     = null;
let checkingSession = true;

const root = document.getElementById("app");

function renderBootScreen() {
  const wrap = document.createElement("div");
  wrap.className = "boot-screen";
  wrap.innerHTML = `
    <div class="boot-screen-icon">${icons.timer}</div>
    <div class="boot-spinner"></div>
  `;
  return wrap;
}

// Access levels
const LEVEL = ACCESS;

// Navigation

const SYSTEM_ADMIN_NAV = [
  {
    label: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: icons.dashboard },
      { id: "reports",   label: "Departments", icon: icons.barChart  },

    ],
  },
  {
    label: "Workforce",
    items: [
      { id: "employees",      label: "Employees",      icon: icons.users    },
      { id: "leave_records",  label: "Leave Records",  icon: icons.fileText },
      { id: "leave_balances", label: "Leave Balances", icon: icons.fileText },
      { id: "time_log_claims", label: "OT Claims",     icon: icons.fileText },
      { id: "incident_reports", label: "Attendance Reports", icon: icons.fileText },
      { id: "employment_history", label: "Employment History", icon: icons.history },
      { id: "employee_exits", label: "Employee Exits", icon: icons.users },
      { id: "clocked_in_now", label: "Clocked In Now", icon: icons.live     },
      { id: "my_logs",        label: "Time Logs",      icon: icons.calendar },
    ],
  },
  {
    label: "Configuration",
    items: [
      { id: "employment_status",   label: "Employment Status",   icon: icons.users     },
      { id: "work_schedules",      label: "Work Schedules",      icon: icons.shift     },
      { id: "employment_types",    label: "Employment Types",    icon: icons.briefcase },
      { id: "holidays",            label: "Holidays",            icon: icons.fileText  },
      { id: "overtime_categories", label: "Overtime Categories", icon: icons.shift     },
      { id: "validation_status",   label: "Validation Status",   icon: icons.check     },
    ],
  },
  {
    label: "System",
    items: [
      { id: "departments", label: "Departments", icon: icons.briefcase },
      { id: "accounts",    label: "Accounts",    icon: icons.userPlus  },
      { id: "audit_log",   label: "Audit Log",   icon: icons.history   },
    ],
  },
];

const HUMAN_RESOURCES_NAV = [
  SYSTEM_ADMIN_NAV[0],
  {
    label: "Workforce",
    items: [
      ...SYSTEM_ADMIN_NAV[1].items,
      { id: "time_logs", label: "Clock In / Out", icon: icons.clock },
    ],
  },
  SYSTEM_ADMIN_NAV[2],
];

const SUPERVISOR_NAV = [
  { id: "dashboard",      label: "Dashboard",      icon: icons.dashboard },
  { id: "employees",      label: "My Department",  icon: icons.users     },
  { id: "clocked_in_now", label: "Clocked In Now", icon: icons.live      },
  { id: "leave_records",  label: "Leave Records",  icon: icons.fileText  },
  { id: "leave_balances", label: "Leave Balances", icon: icons.fileText  },
  { id: "employment_history", label: "Employment History", icon: icons.history },
  { id: "employee_exits", label: "Employee Exits", icon: icons.users     },
  { id: "time_log_claims", label: "OT Claims",    icon: icons.fileText  },
  { id: "incident_reports", label: "Attendance Reports", icon: icons.fileText },
  { id: "time_logs",      label: "Clock In / Out", icon: icons.clock     },
  { id: "my_logs",        label: "My Time Logs",   icon: icons.calendar  },
];

const EMPLOYEE_NAV = [
  { id: "dashboard",     label: "Dashboard",      icon: icons.dashboard },
  { id: "time_logs",     label: "Clock In / Out", icon: icons.clock     },
  { id: "my_logs",       label: "My Time Logs",   icon: icons.calendar  },
  { id: "time_log_claims", label: "OT Claims",    icon: icons.fileText  },
  { id: "incident_reports", label: "Attendance Reports", icon: icons.fileText },
  { id: "leave_records", label: "My Leave",       icon: icons.fileText  },
  { id: "leave_balances", label: "My Leave Balances", icon: icons.fileText  },
  { id: "employment_history", label: "My History", icon: icons.history  },
];

function flattenNavSections(sections) {
  return sections.flatMap(s => s.items);
}

function navSectionsForAccount(acc) {
  switch (accessLevel(acc)) {
    case ACCESS.SYSTEM_ADMIN:    return SYSTEM_ADMIN_NAV;
    case ACCESS.HUMAN_RESOURCES: return HUMAN_RESOURCES_NAV;
    default:                     return null;
  }
}

function navForAccount(acc) {
  const sections = navSectionsForAccount(acc);
  if (sections) return flattenNavSections(sections);
  if (accessLevel(acc) === ACCESS.SUPERVISOR) return SUPERVISOR_NAV;
  return EMPLOYEE_NAV;
}

// Data load
async function loadDb() {
  try {
    db = await fetchAllData();
    loadError = null;
  } catch (err) {
    loadError = err.message || "Failed to load data.";
  }
}

// View routing
function renderView(viewId, db, account, onDbChange) {
  const adminConfig = isAdminConfig(account);

  switch (viewId) {
    case "employees":
      return canViewEmployees(account)
        ? renderEmployees(db, account, onDbChange)
        : renderDashboard(db, account);
    case "departments":
      return isSystemAdmin(account)
        ? renderDepartments(db, account, onDbChange)
        : renderDashboard(db, account);
    case "accounts":
      return isSystemAdmin(account)
        ? renderAccounts(db, onDbChange)
        : renderDashboard(db, account);
    case "leave_records":
      return renderLeaveRecords(db, account, onDbChange);
    case "time_log_claims":
      return renderTimeLogClaims(db, account, onDbChange);
    case "incident_reports":
      return renderIncidentReports(db, account, onDbChange);
    case "clocked_in_now":
      return canViewClockedInNow(account)
        ? renderClockedInNow(db, account, onDbChange)
        : renderDashboard(db, account);
    case "time_logs":
      return renderTimeLogs(db, account, onDbChange);
    case "my_logs":
      return renderMyLogs(db, account, onDbChange);
    case "leave_balances":
      return renderLeaveBalances(db, account, onDbChange);
    case "employment_history":
      return renderEmploymentHistory(db, account, onDbChange);
    case "employee_exits":
      return (isSystemAdmin(account) || isHumanResources(account) || isSupervisor(account))
        ? renderEmployeeExits(db, account, onDbChange)
        : renderDashboard(db, account);
    case "employment_status":
      return adminConfig ? renderEmploymentStatus(db, onDbChange) : renderDashboard(db, account);
    case "work_schedules":
      return adminConfig ? renderWorkSchedules(db, onDbChange) : renderDashboard(db, account);
    case "employment_types":
      return adminConfig ? renderEmploymentTypes(db, onDbChange) : renderDashboard(db, account);
    case "holidays":
      return adminConfig ? renderHolidays(db, onDbChange) : renderDashboard(db, account);
    case "overtime_categories":
      return adminConfig ? renderOvertimeCategories(db, onDbChange) : renderDashboard(db, account);
    case "pay_differentials":
      return adminConfig ? renderPayDifferentials(db, onDbChange) : renderDashboard(db, account);
    case "validation_status":
      return adminConfig ? renderValidationStatus(db, onDbChange) : renderDashboard(db, account);
    case "reports":
      return adminConfig ? renderReports(db, onDbChange) : renderDashboard(db, account);
    case "audit_log":
      return isSystemAdmin(account)
        ? renderAuditLog(db, onDbChange)
        : renderDashboard(db, account);
    default:
      return renderDashboard(db, account);
  }
}

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

  const navItems    = navForAccount(account);
  const navSections = navSectionsForAccount(account);
  const allowed     = navItems.map(n => n.id);

  if (!allowed.includes(activeView)) activeView = "dashboard";

  const emp = linkedEmployee(db, account);

  const layout = document.createElement("div");
  layout.className = "layout";

  const sidebar = buildSidebar({
    navSections,
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

  const onDbChange = (updated) => { db = updated; };
  main.appendChild(renderView(activeView, db, account, onDbChange));

  layout.appendChild(sidebar);
  layout.appendChild(main);
  root.appendChild(layout);
}

// Change Password Modal
function openChangePasswordModal() {
  const body = document.createElement("div");
  body.style.cssText = "display:flex;flex-direction:column;gap:14px";

  const fCurrent = makeInput("password", "", "Enter current password");
  const fNew     = makeInput("password", "", "At least 6 characters");
  const fConfirm = makeInput("password", "", "Re-enter new password");

  body.appendChild(buildField("Current Password", fCurrent));
  body.appendChild(buildField("New Password", fNew));
  body.appendChild(buildField("Confirm New Password", fConfirm));

  const { errEl, cancelBtn, saveBtn } = appendModalFooter(body, {
    isEdit: false,
    saveLabel: () => "Change Password",
    onSave: null,
  });

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
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
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

async function boot() {
  renderApp();

  try {
    account = await apiRequest("/auth.php?action=me");
  } catch (_) {
    account = null;
  }

  if (account) await loadDb();

  checkingSession = false;
  renderApp();
}

boot();
