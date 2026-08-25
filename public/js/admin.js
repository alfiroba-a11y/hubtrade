function getToken(){ return localStorage.getItem('th_token'); }
function clearToken(){ localStorage.removeItem('th_token'); }

async function api(path, opts = {}){
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(body.error ? (body.error.message || JSON.stringify(body.error)) : `Request failed (${res.status})`);
  return body;
}

document.getElementById('logoutBtn')?.addEventListener('click', () => { clearToken(); location.href='/'; });

async function loadUsers(){
  const tbody = document.getElementById('userTable');
  const users = await api('/api/admin/users');
  if(!users.length){ tbody.innerHTML = '<tr><td colspan="6" class="empty">No users</td></tr>'; return; }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${u.username}</td>
      <td class="muted">${u.email}</td>
      <td><span class="tag ${u.role}">${u.role}</span></td>
      <td><span class="tag ${u.status}">${u.status}</span></td>
      <td class="muted">${new Date(u.created_at).toLocaleDateString()}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn secondary" data-toggle-status="${u.id}" data-status="${u.status}">
          ${u.status === 'active' ? 'Suspend' : 'Reactivate'}
        </button>
        <button class="btn secondary" data-toggle-role="${u.id}" data-role="${u.role}">
          ${u.role === 'admin' ? 'Demote' : 'Promote'}
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-toggle-status]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.toggleStatus;
      const next = btn.dataset.status === 'active' ? 'suspended' : 'active';
      await api(`/api/admin/users/${id}/status`, { method:'POST', body: JSON.stringify({ status: next }) });
      loadUsers();
    });
  });
  tbody.querySelectorAll('[data-toggle-role]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.toggleRole;
      const next = btn.dataset.role === 'admin' ? 'user' : 'admin';
      await api(`/api/admin/users/${id}/role`, { method:'POST', body: JSON.stringify({ role: next }) });
      loadUsers();
    });
  });
}

async function loadOrders(){
  const tbody = document.getElementById('orderTable');
  const orders = await api('/api/admin/orders');
  if(!orders.length){ tbody.innerHTML = '<tr><td colspan="6" class="empty">No orders</td></tr>'; return; }
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td>${o.username}</td>
      <td class="symbol-badge">${o.symbol}</td>
      <td><span class="tag ${o.side}">${o.side}</span></td>
      <td>${o.qty}</td>
      <td>${o.status}</td>
      <td class="muted">${new Date(o.submitted_at).toLocaleString()}</td>
    </tr>
  `).join('');
}

async function boot(){
  if(!getToken()){ document.getElementById('deniedView').style.display='flex'; return; }
  try{
    const me = await api('/api/auth/me');
    if(me.role !== 'admin'){ document.getElementById('deniedView').style.display='flex'; return; }
    document.getElementById('adminView').style.display='block';
    loadUsers();
    loadOrders();
  } catch {
    document.getElementById('deniedView').style.display='flex';
  }
}

boot();
