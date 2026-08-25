/* ---------- App shell & hash router ---------- */

const App = {
  user: null,
  doctorUser: null,
  storeOwner: null,
  adminUser: null,

  async boot() {
    // Try patient login
    try {
      const me = await api('/api/me');
      this.onAuthed({ ...me.user, isAdmin: !!me.isAdmin }, false);
    } catch {
      // Try doctor login
      try {
        const dm = await api('/api/doctor/me');
        this.onDoctorAuthed(dm.doctor, false);
      } catch {
        // Try store owner login
        try {
          const sm = await api('/api/store/me');
          this.onStoreOwnerAuthed(sm.owner, sm.store, false);
        } catch {
          this.routeAuth();
        }
      }
    }
    window.addEventListener('hashchange', () => this.route());
  },

  /* ---- Patient Auth ---- */
  onAuthed(user, navigate = true) {
    this.user = user;
    this.doctorUser = null;
    this.storeOwner = null;
    this.renderShell();
    if (navigate || !location.hash || ['#/login', '#/register', '#/doctor/login', '#/doctor/register', '#/store-owner/login', '#/store-owner/register', '#/admin/login'].includes(location.hash)) {
      location.hash = '#/dashboard';
    }
    this.route();
  },

  routeAuth() {
    this.user = null;
    this.doctorUser = null;
    this.storeOwner = null;
    if (window.Assistant) Assistant.hide();
    const view = document.getElementById('app');
    const hash = location.hash || '#/login';
    if (hash === '#/doctor/login' || hash === '#/doctor/register') return this.routeDoctorAuth();
    if (hash === '#/store-owner/login' || hash === '#/store-owner/register') return this.routeStoreOwnerAuth();
    if (hash === '#/admin/login') return this.routeAdminAuth();
    const name = hash === '#/register' ? 'register' : 'login';
    (VIEWS[name] || VIEWS.login)(view);
  },

  /* ---- Doctor Auth ---- */
  onDoctorAuthed(doctor, navigate = true) {
    this.doctorUser = doctor;
    this.user = null;
    this.storeOwner = null;
    this.renderDoctorShell();
    if (navigate || !location.hash || ['#/login', '#/register', '#/doctor/login', '#/doctor/register'].includes(location.hash)) {
      location.hash = '#/doctor/dashboard';
    }
    this.routeDoctor();
  },

  routeDoctorAuth() {
    this.doctorUser = null;
    const view = document.getElementById('app');
    const name = location.hash === '#/doctor/register' ? 'doctor-register' : 'doctor-login';
    (VIEWS[name] || VIEWS['doctor-login'])(view);
  },

  /* ---- Store Owner Auth ---- */
  onStoreOwnerAuthed(owner, store, navigate = true) {
    this.storeOwner = owner;
    this.user = null;
    this.doctorUser = null;
    this.renderStoreOwnerShell();
    if (navigate || !location.hash || ['#/login', '#/register', '#/store-owner/login', '#/store-owner/register'].includes(location.hash)) {
      location.hash = '#/store-owner/dashboard';
    }
    this.routeStoreOwner();
  },

  routeStoreOwnerAuth() {
    this.storeOwner = null;
    const view = document.getElementById('app');
    const name = location.hash === '#/store-owner/register' ? 'store-register' : 'store-login';
    (VIEWS[name] || VIEWS['store-login'])(view);
  },

  /* ---- Admin Login (separate entry point) ---- */
  routeAdminAuth() {
    const view = document.getElementById('app');
    view.innerHTML = `
    <div class="auth-shell">
      <div class="auth-hero">
        <div class="brand" style="padding-left:0"><b style="font-size:18px">HealthSphere</b><span>AI</span></div>
        <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#8fd6cc;font-weight:700;margin-top:24px">Admin Portal</div>
        <h1 style="color:#fff;font-size:33px;line-height:1.18;margin-top:42px;font-weight:800">Platform Administration</h1>
        <p style="color:#90a1ac;max-width:46ch;font-size:14.5px">Manage doctors, stores, users, and system settings. Use your admin email to sign in through the main login.</p>
      </div>
      <div class="auth-panel"><div class="auth-card"><div class="card">
        <h2 style="margin-bottom:2px">Admin Sign In</h2>
        <p class="page-sub">Sign in with an admin-registered email</p>
        <form id="f-admin-login">
          <label>Email</label>
          <input name="email" type="email" required placeholder="admin@healthsphere.ai">
          <div class="mt"></div>
          <label>Password</label>
          <input name="password" type="password" required placeholder="Enter your password">
          <button class="btn big mt" type="submit">Sign in</button>
        </form>
        <div class="divider"></div>
        <div class="portal-links">
          <a href="#/login" class="portal-link">
            <span class="portal-icon">P</span>
            <b>Patient Portal</b>
            <span>Back to patient login</span>
            <span class="portal-arrow">Open &rarr;</span>
          </a>
        </div>
      </div></div></div>
    </div>`;

    view.querySelector('#f-admin-login').onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const r = await api('/api/auth/login', { method: 'POST', body: { email: fd.get('email'), password: fd.get('password') } });
        App.onAuthed({ ...r.user, isAdmin: !!r.isAdmin });
      } catch (err) { toast(err.message, 'err'); }
    };
  },

  /* ==================== SHELLS ==================== */

  renderShell() {
    const initials = (this.user?.name || '?').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
    document.getElementById('app').innerHTML = `
      <div class="shell">
        <aside class="sidebar">
          <div class="brand"><b>HealthSphere</b><span>AI</span></div>
          <div class="brand-sub">Family Health Intelligence</div>
          <div class="nav-label">Health record</div>
          ${[
            ['#/dashboard', 'Dashboard'], ['#/profile', 'My Profile'],
            ['#/family', 'Family History'], ['#/reports', 'Medical Reports'],
            ['#/timeline', 'Timeline']
          ].map(([h, l]) => `<button class="nav-item" data-h="${h}">${l}</button>`).join('')}
          <div class="nav-label">Planning &amp; insights</div>
          ${[
            ['#/insights', 'Insights &amp; Risks'], ['#/lifestyle', 'Lifestyle'],
            ['#/reminders', 'Reminders']
          ].map(([h, l]) => `<button class="nav-item" data-h="${h}">${l}</button>`).join('')}
          <button class="nav-item" id="nav-assistant">AI Assistant</button>
          <div class="nav-label">Services</div>
          <button class="nav-item" data-h="#/consult">Consult a Doctor</button>
          <button class="nav-item" data-h="#/stores">Find a Medical Store</button>
          <div class="nav-label">Care</div>
          <button class="nav-item" data-h="#/care">Care Team</button>
          <button class="nav-item" data-h="#/hospitals">Nearby Care</button>
          <button class="nav-item" data-h="#/settings">Settings</button>
          ${this.user?.isAdmin ? `
          <div class="nav-label">Administration</div>
          <button class="nav-item" data-h="#/admin">Admin Access</button>
          ` : ''}
          <div class="nav-sep"></div>
          <div class="emergency-nav">
            <button class="nav-item alert" data-h="#/emergency">Emergency Mode</button>
          </div>
          <div class="side-user">
            <div class="avatar">${esc(initials)}</div>
            <div class="u-meta"><b>${esc(this.user?.name || '')}</b><span>${esc(this.user?.email || '')}</span></div>
            <button id="logout-btn" title="Sign out">Sign out</button>
          </div>
        </aside>
        <main class="main" id="view"></main>
      </div>`;

    this._bindShellNav();
    document.getElementById('nav-assistant').onclick = () => window.Assistant && Assistant.toggle(true);
    if (window.Assistant) Assistant.mount();
    document.getElementById('logout-btn').onclick = async () => {
      await api('/api/auth/logout', { method: 'POST' });
      this.user = null;
      location.hash = '#/login';
      this.routeAuth();
      toast('Signed out');
    };
  },

  renderDoctorShell() {
    const d = this.doctorUser;
    const initials = (d?.name || 'D').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
    const isVerified = d?.verificationStatus === 'verified';
    const isOnline = d?.availabilityStatus === 'online';
    document.getElementById('app').innerHTML = `
      <div class="shell">
        <aside class="sidebar">
          <div class="brand"><b>HealthSphere</b><span>AI</span></div>
          <div class="brand-sub">Doctor Portal</div>
          <div class="nav-label">Consultation</div>
          <button class="nav-item" data-h="#/doctor/dashboard">Dashboard</button>
          <div class="nav-label">Account</div>
          <button class="nav-item" data-h="#/settings">Settings</button>
          <div class="nav-sep"></div>
          <div class="side-user">
            <div class="avatar">${esc(initials)}</div>
            <div class="u-meta">
              <b>${esc(d?.name || '')}</b>
              <span>${esc(d?.specialization || '')}</span>
            </div>
          </div>
          <div style="padding:6px 10px;font-size:11px">
            <span class="chip ${isVerified ? (isOnline ? 'ok' : 'neutral') : 'warn'}">${isVerified ? (isOnline ? 'Online' : 'Offline') : 'Pending Verification'}</span>
          </div>
          <div style="padding:4px 10px">
            <a href="#/login" style="font-size:11px;color:#7d95a1">← Patient login</a>
          </div>
          <div style="padding:4px 10px">
            <button id="doc-logout-btn" style="background:none;border:none;color:#7d95a1;font-size:11.5px;cursor:pointer;font-family:inherit;padding:4px 6px">Sign out</button>
          </div>
        </aside>
        <main class="main" id="view"></main>
      </div>`;

    this._bindShellNav();
    document.getElementById('doc-logout-btn').onclick = async () => {
      await api('/api/doctor/auth/logout', { method: 'POST' });
      this.doctorUser = null;
      location.hash = '#/doctor/login';
      this.routeDoctorAuth();
      toast('Signed out');
    };
  },

  renderStoreOwnerShell() {
    const o = this.storeOwner;
    const initials = (o?.ownerName || 'S').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
    document.getElementById('app').innerHTML = `
      <div class="shell">
        <aside class="sidebar">
          <div class="brand"><b>HealthSphere</b><span>AI</span></div>
          <div class="brand-sub">Store Owner Portal</div>
          <div class="nav-label">Store</div>
          <button class="nav-item" data-h="#/store-owner/dashboard">My Store</button>
          <div class="nav-label">Account</div>
          <button class="nav-item" data-h="#/settings">Settings</button>
          <div class="nav-sep"></div>
          <div class="side-user">
            <div class="avatar">${esc(initials)}</div>
            <div class="u-meta">
              <b>${esc(o?.storeName || '')}</b>
              <span>${esc(o?.ownerName || '')}</span>
            </div>
          </div>
          <div style="padding:4px 10px">
            <a href="#/login" style="font-size:11px;color:#7d95a1">← Patient login</a>
          </div>
          <div style="padding:4px 10px">
            <button id="store-logout-btn" style="background:none;border:none;color:#7d95a1;font-size:11.5px;cursor:pointer;font-family:inherit;padding:4px 6px">Sign out</button>
          </div>
        </aside>
        <main class="main" id="view"></main>
      </div>`;

    this._bindShellNav();
    document.getElementById('store-logout-btn').onclick = async () => {
      await api('/api/store/auth/logout', { method: 'POST' });
      this.storeOwner = null;
      location.hash = '#/store-owner/login';
      this.routeStoreOwnerAuth();
      toast('Signed out');
    };
  },

  _bindShellNav() {
    document.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { location.hash = b.dataset.h; });
    this.activeNav();
  },

  activeNav() {
    const cur = (location.hash || '#/dashboard').split('?')[0];
    document.querySelectorAll('.nav-item[data-h]').forEach(b =>
      b.classList.toggle('active', b.dataset.h === cur));
  },

  /* ==================== ROUTERS ==================== */

  async route() {
    const hash = location.hash || '#/dashboard';
    // Route to appropriate portal
    if (hash.startsWith('#/doctor/')) return this.routeDoctor();
    if (hash.startsWith('#/store-owner/')) return this.routeStoreOwner();

    // Patient routes
    if (!this.user) return this.routeAuth();
    if (!document.querySelector('.shell')) this.renderShell();
    this.activeNav();
    const name = hash.replace(/^#\//, '').split('?')[0] || 'dashboard';
    const view = document.getElementById('view');
    const fn = VIEWS[name];
    if (!fn) { view.innerHTML = '<div class="empty">Page not found</div>'; return; }
    view.innerHTML = `<div class="skel-load">
      <div class="skel" style="height:64px"></div>
      <div class="grid g4"><div class="skel" style="height:88px"></div><div class="skel" style="height:88px"></div><div class="skel" style="height:88px"></div><div class="skel" style="height:88px"></div></div>
      <div class="skel" style="height:220px"></div>
    </div>`;
    try {
      await fn(view);
      if (window.HealthGraph) HealthGraph.mount(view);
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      if (/sign in/i.test(e.message)) { this.user = null; return this.routeAuth(); }
      view.innerHTML = `<div class="card empty">Something went wrong: ${esc(e.message)}<br><br><a href="#/dashboard">Back to dashboard</a></div>`;
    }
  },

  async routeDoctor() {
    if (!this.doctorUser) return this.routeDoctorAuth();
    if (!document.querySelector('.shell')) this.renderDoctorShell();
    this.activeNav();
    const name = (location.hash || '#/doctor/dashboard').replace(/^#\//, '').split('?')[0];
    const view = document.getElementById('view');
    const fn = VIEWS[name];
    if (!fn) { view.innerHTML = '<div class="empty">Page not found</div>'; return; }
    view.innerHTML = `<div class="skel-load"><div class="skel" style="height:200px"></div></div>`;
    try {
      await fn(view);
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      if (/sign in/i.test(e.message)) { this.doctorUser = null; return this.routeDoctorAuth(); }
      view.innerHTML = `<div class="card empty">Something went wrong: ${esc(e.message)}</div>`;
    }
  },

  async routeStoreOwner() {
    if (!this.storeOwner) return this.routeStoreOwnerAuth();
    if (!document.querySelector('.shell')) this.renderStoreOwnerShell();
    this.activeNav();
    const name = (location.hash || '#/store-owner/dashboard').replace(/^#\//, '').split('?')[0];
    const view = document.getElementById('view');
    const fn = VIEWS[name];
    if (!fn) { view.innerHTML = '<div class="empty">Page not found</div>'; return; }
    view.innerHTML = `<div class="skel-load"><div class="skel" style="height:200px"></div></div>`;
    try {
      await fn(view);
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      if (/sign in/i.test(e.message)) { this.storeOwner = null; return this.routeStoreOwnerAuth(); }
      view.innerHTML = `<div class="card empty">Something went wrong: ${esc(e.message)}</div>`;
    }
  }
};

window.App = App;
App.boot();
