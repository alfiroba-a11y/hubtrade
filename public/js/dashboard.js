const authView = document.getElementById('authView');
const dashView = document.getElementById('dashView');

function getToken(){ return localStorage.getItem('th_token'); }
function setToken(t){ localStorage.setItem('th_token', t); }
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

const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authError = document.getElementById('authError');

tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active'); tabRegister.classList.remove('active');
  loginForm.style.display='block'; registerForm.style.display='none'; authError.classList.remove('show');
});
tabRegister.addEventListener('click', () => {
  tabRegister.classList.add('active'); tabLogin.classList.remove('active');
  registerForm.style.display='block'; loginForm.style.display='none'; authError.classList.remove('show');
});

function showAuthError(msg){ authError.textContent = msg; authError.classList.add('show'); }

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try{
    const body = await api('/api/auth/login', {
      method:'POST',
      body: JSON.stringify({
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPassword').value,
      }),
    });
    setToken(body.token);
    boot();
  } catch(err){ showAuthError(err.message); }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try{
    const body = await api('/api/auth/register', {
      method:'POST',
      body: JSON.stringify({
        username: document.getElementById('regUsername').value,
        email: document.getElementById('regEmail').value,
        password: document.getElementById('regPassword').value,
      }),
    });
    setToken(body.token);
    boot();
  } catch(err){ showAuthError(err.message); }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearToken();
  location.reload();
});

let ws;
const lastPrices = {};

function connectWs(){
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws/prices`);
  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if(msg.type === 'tick') renderTick(msg.data);
  };
  ws.onclose = () => setTimeout(connectWs, 3000);
}

function renderTick(tick){
  const sym = tick.S;
  const price = tick.p ?? tick.bp ?? tick.ap;
  const prev = lastPrices[sym]?.price;
  lastPrices[sym] = {
    price, bid: tick.bp, ask: tick.ap, time: new Date(tick.t || Date.now()),
    dir: prev != null ? (price >= prev ? 'up' : 'down') : 'up',
  };
  renderPriceTable();
}

function renderPriceTable(){
  const tbody = document.getElementById('priceTable');
  const rows = Object.entries(lastPrices);
  if(!rows.length){ tbody.innerHTML = '<tr><td colspan="5" class="empty">Waiting for stream…</td></tr>'; return; }
  tbody.innerHTML = rows.map(([sym, d]) => `
    <tr>
      <td class="symbol-badge">${sym}</td>
      <td class="price-tick ${d.dir}">${d.price != null ? d.price.toFixed(2) : '—'}</td>
      <td>${d.bid != null ? d.bid.toFixed(2) : '—'}</td>
      <td>${d.ask != null ? d.ask.toFixed(2) : '—'}</td>
      <td class="muted">${d.time.toLocaleTimeString()}</td>
    </tr>
  `).join('');
}

async function loadAccount(){
  const box = document.getElementById('accountBox');
  try{
    const acc = await api('/api/trade/account');
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span class="muted">Equity</span><b>$${Number(acc.equity).toLocaleString()}</b>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span class="muted">Cash</span><b>$${Number(acc.cash).toLocaleString()}</b>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span class="muted">Buying power</span><b>$${Number(acc.buying_power).toLocaleString()}</b>
      </div>
    `;
  } catch(err){
    box.innerHTML = `<span style="color:var(--red);">Could not load account: ${err.message}</span>`;
  }
}

async function loadOrders(){
  const tbody = document.getElementById('orderTable');
  try{
    const orders = await api('/api/trade/orders');
    if(!orders.length){ tbody.innerHTML = '<tr><td colspan="5" class="empty">No orders yet</td></tr>'; return; }
    tbody.innerHTML = orders.map(o => `
      <tr>
        <td class="symbol-badge">${o.symbol}</td>
        <td><span class="tag ${o.side}">${o.side}</span></td>
        <td>${o.qty}</td>
        <td>${o.status}</td>
        <td class="muted">${new Date(o.submitted_at).toLocaleString()}</td>
      </tr>
    `).join('');
  } catch(err){
    tbody.innerHTML = `<tr><td colspan="5" class="empty">${err.message}</td></tr>`;
  }
}

document.getElementById('orderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errBox = document.getElementById('orderError');
  errBox.classList.remove('show');
  try{
    await api('/api/trade/orders', {
      method:'POST',
      body: JSON.stringify({
        symbol: document.getElementById('ordSymbol').value.toUpperCase(),
        side: document.getElementById('ordSide').value,
        qty: Number(document.getElementById('ordQty').value),
      }),
    });
    await loadOrders();
    await loadAccount();
  } catch(err){
    errBox.textContent = err.message;
    errBox.classList.add('show');
  }
});

async function boot(){
  if(!getToken()){
    authView.style.display='flex'; dashView.style.display='none';
    return;
  }
  try{
    const me = await api('/api/auth/me');
    authView.style.display='none'; dashView.style.display='block';
    document.getElementById('whoami').textContent = `${me.username} · ${me.role}`;
    document.getElementById('adminLink').style.display = me.role === 'admin' ? 'inline-block' : 'none';
    connectWs();
    loadAccount();
    loadOrders();
  } catch{
    clearToken();
    authView.style.display='flex'; dashView.style.display='none';
  }
}

boot();
