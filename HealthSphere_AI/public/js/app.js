/* ---------- App shell & hash router ---------- */

const App = {
  user: null,

  async boot() {
    try {
      const me = await api('/api/me');
      this.onAuthed(me.user, false);
    } catch {
      this.routeAuth();
    }
    window.addEventListener('hashchange', () => this.route());
  },

  onAuthed(user, navigate = true) {
    this.user = user;
    this.renderShell();
    if (navigate || !location.hash || location.hash === '#/login' || location.hash === '#/register') {
      location.hash = '#/dashboard';
    }
    this.route();
  },

  routeAuth() {
    this.user = null;
    const view = document.getElementById('app');
    const name = location.hash === '#/register' ? 'register' : 'login';
    (VIEWS[name] || VIEWS.login)(view);
    if (window.HealthGraph) HealthGraph.mount(view);
  },

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
          <div class="nav-label">Care</div>
          <button class="nav-item" data-h="#/care">Care Team</button>
          <button class="nav-item" data-h="#/hospitals">Nearby Care</button>
          <button class="nav-item" data-h="#/settings">Settings</button>
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

    document.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { location.hash = b.dataset.h; });
    document.getElementById('logout-btn').onclick = async () => {
      await api('/api/auth/logout', { method: 'POST' });
      this.user = null;
      location.hash = '#/login';
      this.routeAuth();
      toast('Signed out');
    };
  },

  activeNav() {
    const cur = (location.hash || '#/dashboard').split('?')[0];
    document.querySelectorAll('.nav-item[data-h]').forEach(b =>
      b.classList.toggle('active', b.dataset.h === cur));
  },

  async route() {
    if (!this.user) return this.routeAuth();
    if (!document.querySelector('.shell')) this.renderShell();
    this.activeNav();
    const name = (location.hash || '#/dashboard').replace(/^#\//, '').split('?')[0] || 'dashboard';
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
  }
};

window.App = App;
App.boot();
