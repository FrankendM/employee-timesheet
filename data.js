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

  const [
    employees,
    departments,
    roles,
    attendanceStatuses,
    leaveRecords,
    accounts,
    timeLogs,
    dashboardStats,
    leaveTypes,
    employmentStatuses,
    workSchedules,
    employmentTypes,
    holidays,
    overtimeCategories,
    payDifferentials,
    validationStatuses,
    timeLogClaims,
    employmentHistory,
    employeeExits,
    leaveBalances,
  ] = await Promise.all([
    apiRequest("/employees.php"),
    apiRequest("/departments.php"),
    apiRequest("/roles.php"),
    safe(apiRequest("/attendance_status.php")),
    safe(apiRequest("/leave_records.php")),
    safe(apiRequest("/accounts.php")),
    safe(apiRequest("/time_logs.php")),
    safe(apiRequest("/dashboard.php")),
    safe(apiRequest("/leave_types.php")),
    safe(apiRequest("/employment_status.php")),
    safe(apiRequest("/work_schedules.php")),
    safe(apiRequest("/employment_types.php")),
    safe(apiRequest("/holidays.php")),
    safe(apiRequest("/overtime_categories.php")),
    safe(apiRequest("/pay_differentials.php")),
    safe(apiRequest("/validation_status.php")),
    safe(apiRequest("/time_log_claims.php")),
    safe(apiRequest("/employment_history.php")),
    safe(apiRequest("/employee_exits.php")),
    safe(apiRequest("/leave_balances.php")),
  ]);

  return {
    employees,
    departments,
    roles,
    attendanceStatuses,
    timeLogs,
    leaveRecords,
    accounts,
    dashboardStats,
    leaveTypes,
    employmentStatuses,
    workSchedules,
    employmentTypes,
    holidays,
    overtimeCategories,
    payDifferentials,
    validationStatuses,
    timeLogClaims,
    employmentHistory,
    employeeExits,
    leaveBalances,
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
async function clockInRequest() {
  return apiRequest("/time_logs.php?action=clock_in", { method: "POST" });
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

// ── Time Log Claims ───────────────────────────────────
async function fetchTimeLogClaims(params = "") {
  const qs = params ? (params.startsWith("?") ? params : `?${params}`) : "";
  return apiRequest(`/time_log_claims.php${qs}`);
}
async function createTimeLogClaimRequest(body) {
  return apiRequest("/time_log_claims.php", { method: "POST", body: JSON.stringify(body) });
}
async function updateTimeLogClaimRequest(body) {
  return apiRequest("/time_log_claims.php", { method: "PUT", body: JSON.stringify(body) });
}
async function deleteTimeLogClaimRequest(claimId) {
  return apiRequest(`/time_log_claims.php?id=${claimId}`, { method: "DELETE" });
}

// ── Dashboard ─────────────────────────────────────────
async function fetchDashboardStats() {
  return apiRequest("/dashboard.php");
}

// ── Audit Log (admin only, read-only) ─────────────────
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

// ── Leave Types ───────────────────────────────────────
async function fetchLeaveTypes() {
  return apiRequest("/leave_types.php");
}
async function createLeaveType(body) {
  return apiRequest("/leave_types.php", { method: "POST", body: JSON.stringify(body) });
}
async function updateLeaveType(body) {
  return apiRequest("/leave_types.php", { method: "PUT", body: JSON.stringify(body) });
}
async function deleteLeaveType(body) {
  return apiRequest("/leave_types.php", { method: "DELETE", body: JSON.stringify(body) });
}

// ── Reports ───────────────────────────────────────────
function buildReportQS(filters) {
  const params = [];
  if (filters.departmentId) {
    params.push(`department_id=${encodeURIComponent(filters.departmentId)}`);
  }
  let dateFrom = "";
  let dateTo = "";
  if (filters.year) {
    if (filters.month) {
      const m = String(filters.month).padStart(2, '0');
      dateFrom = `${filters.year}-${m}-01`;
      const lastDay = new Date(filters.year, filters.month, 0).getDate();
      dateTo = `${filters.year}-${m}-${String(lastDay).padStart(2, '0')}`;
    } else {
      dateFrom = `${filters.year}-01-01`;
      dateTo = `${filters.year}-12-31`;
    }
  }
  if (dateFrom) params.push(`date_from=${dateFrom}`);
  if (dateTo) params.push(`date_to=${dateTo}`);
  return params.length ? `&${params.join("&")}` : "";
}
async function fetchDepartmentLaborCostReport(filters) {
  return apiRequest(`/reports.php?action=department_labor_cost${buildReportQS(filters)}`);
}
async function fetchEmployeeEarningsReport(filters) {
  return apiRequest(`/reports.php?action=employee_earnings${buildReportQS(filters)}`);
}

// ── Employment History ────────────────────────────────
async function fetchEmploymentHistory(params = "") {
  const qs = params ? (params.startsWith("?") ? params : `?${params}`) : "";
  return apiRequest(`/employment_history.php${qs}`);
}

// ── Employee Exits ────────────────────────────────────
async function fetchEmployeeExits() {
  return apiRequest("/employee_exits.php");
}

// ── Leave Balances ────────────────────────────────────
async function fetchLeaveBalances(params = "") {
  const qs = params ? (params.startsWith("?") ? params : `?${params}`) : "";
  return apiRequest(`/leave_balances.php${qs}`);
}

// ── Empty shape ───────────────────────────────────────
function emptyDb() {
  return {
    departments: [], roles: [], employees: [],
    attendanceStatuses: [],
    timeLogs: [], leaveRecords: [], accounts: [],
    dashboardStats: null,
    leaveTypes: [],
    employmentStatuses: [],
    workSchedules: [],
    employmentTypes: [],
    holidays: [],
    overtimeCategories: [],
    payDifferentials: [],
    validationStatuses: [],
    timeLogClaims: [],
    employmentHistory: [],
    employeeExits: [],
    leaveBalances: [],
  };
}
