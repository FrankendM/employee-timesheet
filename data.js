// ── Data layer ───────────────────────────────────────
// Backend layout: backend/{config,middleware,routes}/ — all route files
// (auth.php, employees.php, etc.) live in backend/routes/.
const API_BASE_URL = "https://labortrack-api.dcism.org/backend/routes";

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });

  let body = null;
  try { body = await res.json(); } catch {}

  if (!res.ok || !body || body.success === false) {
    const message = (body && body.error) || `Request failed: ${res.status}`;
    throw new Error(message);
  }

  return body.data;
}

// ── Auth ──────────────────────────────────────────────
async function loginRequest(username, password) {
  return apiRequest("/auth.php?action=login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

async function logoutRequest() {
  return apiRequest("/auth.php?action=logout", { method: "POST" });
}

// ── Bulk fetch ────────────────────────────────────────
async function fetchAllData() {
  const safe = (p) => p.catch(() => []);

  const [employees, departments, roles, shiftCategories, attendanceStatuses, leaveRecords, accounts, timeLogs, dashboardStats] =
    await Promise.all([
      apiRequest("/employees.php"),
      apiRequest("/departments.php"),
      apiRequest("/roles.php"),
      apiRequest("/shift_categories.php"),
      safe(apiRequest("/attendance_status.php")),
      safe(apiRequest("/leave_records.php")),
      safe(apiRequest("/accounts.php")), // admin only
      safe(apiRequest("/time_logs.php")),
      safe(apiRequest("/dashboard.php")),
    ]);

  return {
    employees,
    departments,
    roles,
    shiftCategories,
    attendanceStatuses,
    timeLogs,
    leaveRecords,
    accounts,
    dashboardStats,
  };
}

// ── Employees ─────────────────────────────────────────
async function createEmployeeRequest(employee) {
  return apiRequest("/employees.php", { method: "POST", body: JSON.stringify(employee) });
}
async function updateEmployeeRequest(employeeId, employee) {
  return apiRequest("/employees.php", {
    method: "PUT",
    body: JSON.stringify({ ...employee, employee_id: employeeId }),
  });
}

// ── Accounts ──────────────────────────────────────────
async function createAccountRequest(account) {
  return apiRequest("/accounts.php", { method: "POST", body: JSON.stringify(account) });
}
async function updateAccountRequest(accountId, account) {
  return apiRequest("/accounts.php", {
    method: "PUT",
    body: JSON.stringify({ ...account, account_id: accountId }),
  });
}
async function deleteAccountRequest(accountId) {
  return apiRequest(`/accounts.php?id=${accountId}`, { method: "DELETE" });
}

// ── Time Logs ─────────────────────────────────────────
async function clockInRequest(shiftCategoryId) {
  return apiRequest("/time_logs.php?action=clock_in", {
    method: "POST",
    body: JSON.stringify({ shift_category_id: shiftCategoryId }),
  });
}
async function clockOutRequest() {
  return apiRequest("/time_logs.php?action=clock_out", { method: "POST" });
}
async function updateTimeLogRequest(logId, data) {
  return apiRequest("/time_logs.php", {
    method: "PUT",
    body: JSON.stringify({ ...data, log_id: logId }),
  });
}

// ── Dashboard ─────────────────────────────────────────
// Server-computed summary stats (headcount, attendance, dept breakdown,
// recent clock-ins for admin; personal clock/leave summary for employee).
// Shape documented in backend/routes/dashboard.php.
async function fetchDashboardStats() {
  return apiRequest("/dashboard.php");
}

// ── Payroll (admin unless noted) ─────────────────────
async function fetchPayrollPeriods(departmentId = null, extraParams = "") {
  const qs = departmentId ? `&department_id=${departmentId}` : "";
  const extra = extraParams ? `&${extraParams}` : "";
  return apiRequest(`/payroll.php?action=periods${qs}${extra}`);
}
async function previewPayrollRequest(departmentId, year, month) {
  return apiRequest(
    `/payroll.php?action=preview&department_id=${departmentId}&year=${year}&month=${month}`
  );
}
async function generatePayrollRequest(departmentId, year, month) {
  return apiRequest("/payroll.php?action=generate", {
    method: "POST",
    body: JSON.stringify({ department_id: departmentId, year, month }),
  });
}
async function fetchPayrollRecords(periodId) {
  return apiRequest(`/payroll.php?action=records&period_id=${periodId}`);
}
async function updatePayrollRecordRequest(recordId, data) {
  return apiRequest("/payroll.php?action=record", {
    method: "PUT",
    body: JSON.stringify({ ...data, record_id: recordId }),
  });
}
async function approvePayrollPeriodRequest(periodId) {
  return apiRequest(`/payroll.php?action=approve&period_id=${periodId}`, {
    method: "POST",
  });
}
async function unapprovePayrollPeriodRequest(periodId) {
  return apiRequest(`/payroll.php?action=unapprove&period_id=${periodId}`, {
    method: "POST",
  });
}
// Employee: own approved pay history
async function fetchMyPayrollHistory() {
  return apiRequest("/payroll.php?action=my_history");
}

// ── Audit Log (admin only, read-only) ─────────────────
// Backend: backend/routes/audit_log.php
// Tracks: account_create, account_update, account_delete,
//         payroll_approve, payroll_unapprove
function buildAuditLogQS(filters = {}) {
  const params = [];
  if (filters.action)      params.push(`action=${encodeURIComponent(filters.action)}`);
  if (filters.targetType)  params.push(`target_type=${encodeURIComponent(filters.targetType)}`);
  if (filters.targetId)    params.push(`target_id=${encodeURIComponent(filters.targetId)}`);
  if (filters.accountId)   params.push(`account_id=${encodeURIComponent(filters.accountId)}`);
  if (filters.from)        params.push(`from=${encodeURIComponent(filters.from)}`);
  if (filters.to)          params.push(`to=${encodeURIComponent(filters.to)}`);
  params.push(`limit=${filters.limit || 25}`);
  params.push(`offset=${filters.offset || 0}`);
  return params.length ? `?${params.join("&")}` : "";
}
async function fetchAuditLog(filters = {}) {
  return apiRequest(`/audit_log.php${buildAuditLogQS(filters)}`);
}

// ── Reports (admin only) ──────────────────────────────
function buildReportQS({ departmentId, year, month }) {
  const params = [];
  if (departmentId) params.push(`department_id=${departmentId}`);
  if (year && month) {
    // Build a full month range so the backend date_from/date_to params are satisfied
    const pad = (n) => String(n).padStart(2, "0");
    const lastDay = new Date(year, month, 0).getDate();
    params.push(`date_from=${year}-${pad(month)}-01`);
    params.push(`date_to=${year}-${pad(month)}-${lastDay}`);
  } else if (year) {
    params.push(`date_from=${year}-01-01`);
    params.push(`date_to=${year}-12-31`);
  }
  return params.length ? `&${params.join("&")}` : "";
}

async function fetchDepartmentLaborCostReport(filters = {}) {
  const qs = buildReportQS(filters);
  return apiRequest(`/reports.php?action=department_labor_cost${qs}`);
}

async function fetchEmployeeEarningsReport(filters = {}) {
  const qs = buildReportQS(filters);
  return apiRequest(`/reports.php?action=employee_earnings${qs}`);
}

// ── Empty shape ───────────────────────────────────────
function emptyDb() {
  return {
    departments: [], roles: [], employees: [],
    shiftCategories: [], attendanceStatuses: [],
    timeLogs: [], leaveRecords: [], accounts: [],
    dashboardStats: null,
  };
}