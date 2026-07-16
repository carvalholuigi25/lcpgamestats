const els = {
  adminStatus: document.getElementById('admin-status'),
  adminSummaryTotal: document.getElementById('admin-summary-total'),
  adminSummaryAdmins: document.getElementById('admin-summary-admins'),
  adminSummaryRecent: document.getElementById('admin-summary-recent'),
  adminUsersTableBody: document.getElementById('admin-users-table-body'),
  refreshAdminBtn: document.getElementById('refresh-admin-btn'),
  logoutBtn: document.getElementById('btn-logout')
};

let currentUser = null;

function getDefaultFetchOptions(overrides = {}) {
  return {
    credentials: 'include',
    headers: { Accept: 'application/json', ...(overrides.headers || {}) },
    ...overrides
  };
}

function setAdminFeedback(message, type = 'info') {
  if (!els.adminStatus) return;
  els.adminStatus.textContent = message;
  els.adminStatus.classList.remove('d-none', 'alert-info', 'alert-danger', 'alert-success');
  els.adminStatus.classList.add('alert-' + type);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderUsers(users) {
  if (!els.adminUsersTableBody) return;
  if (!users.length) {
    els.adminUsersTableBody.innerHTML = '<tr><td colspan="4" class="text-muted">No users found.</td></tr>';
    return;
  }

  els.adminUsersTableBody.innerHTML = users.map((user) => {
    const createdLabel = user.createdAt ? new Date(Number(user.createdAt) * 1000).toLocaleDateString() : '—';
    const roleLabel = user.role === 'admin' ? 'Admin' : 'User';
    const isSelf = currentUser && Number(user.id) === Number(currentUser.id);
    return `
      <tr>
        <td>
          <div class="fw-semibold">${escapeHtml(user.displayName || user.username || 'User')}</div>
          <div class="small text-muted">${escapeHtml(user.username || '')}</div>
        </td>
        <td>${escapeHtml(roleLabel)}</td>
        <td>${escapeHtml(createdLabel)}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary" type="button" data-action="toggle-role" data-user-id="${user.id}" data-role="${user.role === 'admin' ? 'user' : 'admin'}" ${isSelf ? 'disabled' : ''}>
            ${user.role === 'admin' ? 'Demote' : 'Promote'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  els.adminUsersTableBody.querySelectorAll('[data-action="toggle-role"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const userId = button.getAttribute('data-user-id');
      const nextRole = button.getAttribute('data-role');
      try {
        const res = await fetch(`/api/admin/users/${userId}/role`, {
          method: 'PATCH',
          ...getDefaultFetchOptions({ headers: { 'Content-Type': 'application/json' } }),
          body: JSON.stringify({ role: nextRole })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update role');
        setAdminFeedback(`Role updated to ${nextRole}.`, 'success');
        await loadAdminData();
      } catch (err) {
        setAdminFeedback(err.message || 'Unable to update role', 'danger');
      }
    });
  });
}

async function loadAdminData() {
  try {
    const [summaryRes, usersRes] = await Promise.all([
      fetch('/api/admin/summary', getDefaultFetchOptions()),
      fetch('/api/admin/users', getDefaultFetchOptions())
    ]);
    if (!summaryRes.ok || !usersRes.ok) {
      throw new Error('Unable to load admin data');
    }
    const summaryData = await summaryRes.json();
    const usersData = await usersRes.json();
    const summary = summaryData.summary || {};
    if (els.adminSummaryTotal) els.adminSummaryTotal.textContent = summary.totalUsers ?? 0;
    if (els.adminSummaryAdmins) els.adminSummaryAdmins.textContent = summary.totalAdmins ?? 0;
    if (els.adminSummaryRecent) els.adminSummaryRecent.textContent = summary.recentSignups ?? 0;
    renderUsers(usersData.users || []);
    setAdminFeedback('Admin data loaded.', 'info');
  } catch (err) {
    console.warn('Failed to load admin data:', err.message);
    setAdminFeedback(err.message || 'Unable to load admin data', 'danger');
  }
}

async function fetchCurrentUser() {
  try {
    const res = await fetch('/api/auth/me', getDefaultFetchOptions());
    if (!res.ok) {
      currentUser = null;
      window.location.href = '/';
      return null;
    }
    const data = await res.json();
    currentUser = data.user || null;
    if (!currentUser || currentUser.role !== 'admin') {
      window.location.href = '/';
      return null;
    }
    return currentUser;
  } catch (err) {
    console.warn('Failed to fetch current user:', err.message);
    window.location.href = '/';
    return null;
  }
}

async function init() {
  if (els.refreshAdminBtn) {
    els.refreshAdminBtn.addEventListener('click', () => loadAdminData());
  }

  if (els.logoutBtn) {
    els.logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', ...getDefaultFetchOptions() });
      } catch (err) {
        console.warn('Logout failed:', err.message);
      }
      window.location.href = '/';
    });
  }

  const user = await fetchCurrentUser();
  if (!user) return;
  await loadAdminData();
}

init().catch((err) => {
  console.error('Admin initialization failed:', err);
  setAdminFeedback(err.message || 'Unable to initialize admin page', 'danger');
});
