/* ---------- Auth views (login / register) ---------- */

const HERO_FEATURES = `
  <div class="feat">
    <div><b>Document intelligence</b><span>Lab reports become structured, trend-ready data.</span></div>
    <div><b>Longitudinal analysis</b><span>Multi-year trends with anomaly detection.</span></div>
    <div><b>Explainable guidance</b><span>Every signal links to its source records.</span></div>
    <div><b>Lifestyle programs</b><span>Activity and nutrition plans that adapt.</span></div>
    <div><b>Emergency readiness</b><span>One-tap card with contacts and nearby care.</span></div>
  </div>`;

function authHero(title, sub) {
  return `
  <div class="auth-hero">
    <canvas class="auth-canvas" data-graph aria-hidden="true"></canvas>
    <div class="brand" style="padding-left:0"><b style="font-size:18px">HealthSphere</b><span>AI</span></div>
    <h1>${title}</h1>
    <p>${sub}</p>
    ${HERO_FEATURES}
    <div style="margin-top:auto;padding-top:34px;font-size:11.5px;color:#7d948f">
      Informational only — not a substitute for professional medical advice.
    </div>
  </div>`;
}

VIEWS.login = function (container) {
  container.innerHTML = `
  <div class="auth-shell">
    ${authHero('Your family&rsquo;s health, finally connected.',
      'Family history, reports, measurements and lifestyle — one health graph, analyzed continuously for you.')}
    <div class="auth-panel"><div class="auth-card"><div class="card">
      <h2 style="margin-bottom:2px">Welcome back</h2>
      <p class="page-sub">Sign in to continue to your health workspace</p>
      <form id="f-login">
        <label>Email</label>
        <input name="email" type="email" required placeholder="you@example.com" autocomplete="email">
        <div class="mt"></div>
        <label>Password</label>
        <input name="password" type="password" required placeholder="Enter your password" autocomplete="current-password">
        <button class="btn big mt" type="submit">Sign in</button>
      </form>
      <div class="row mt" style="justify-content:space-between">
        <a href="#/register">Create an account</a>
        <button class="btn secondary sm" id="demo-btn" data-loading-text="Loading...">Explore the live demo</button>
      </div>
      <div class="demo-note"><b>Demo workspace</b> — pre-loaded with two years of health data, family history and processed lab reports.</div>
<div class="divider"></div>
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-faint);font-weight:700;margin-bottom:10px">Other Portals</div>
      <div class="portal-links">
        <a href="#/doctor/login" class="portal-link doctor">
          <span class="portal-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
          <div class="portal-content"><b>Doctor</b></div>
          <span class="portal-arrow">→</span>
        </a>
        <a href="#/store-owner/login" class="portal-link store">
          <span class="portal-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg></span>
          <div class="portal-content"><b>Store</b></div>
          <span class="portal-arrow">→</span>
        </a>
        <a href="#/admin/login" class="portal-link admin">
          <span class="portal-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
          <div class="portal-content"><b>Admin</b></div>
          <span class="portal-arrow">→</span>
        </a>
      </div>
    </div></div></div>
  </div>`;

  container.querySelector('#f-login').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const r = await api('/api/auth/login', { method: 'POST', body: { email: fd.get('email'), password: fd.get('password') } });
      App.onAuthed({ ...r.user, isAdmin: !!r.isAdmin });
    } catch (err) { toast(err.message, 'err'); }
  };
  const demoBtn = container.querySelector('#demo-btn');
  demoBtn.onclick = async () => {
    const originalText = demoBtn.textContent;
    demoBtn.disabled = true;
    demoBtn.textContent = demoBtn.dataset.loadingText || 'Loading...';
    demoBtn.style.opacity = '.7';
    try {
      const r = await api('/api/auth/login', { method: 'POST', body: { email: 'demo@healthsphere.ai', password: 'demo1234' } });
      App.onAuthed({ ...r.user, isAdmin: !!r.isAdmin });
    } catch (err) { toast(err.message, 'err'); }
    finally {
      demoBtn.disabled = false;
      demoBtn.textContent = originalText;
      demoBtn.style.opacity = '';
    }
  };
};

VIEWS.register = function (container) {
  container.innerHTML = `
  <div class="auth-shell">
    ${authHero('A lifelong record that keeps working for you.',
      'Set up your profile and family history in minutes — HealthSphere keeps analyzing as new data arrives.')}
    <div class="auth-panel"><div class="auth-card"><div class="card">
      <h2 style="margin-bottom:2px">Create account</h2>
      <p class="page-sub">Takes under a minute</p>
      <form id="f-reg">
        <label>Full name</label>
        <input name="name" required placeholder="Your full name">
        <div class="mt"></div>
        <label>Email</label>
        <input name="email" type="email" required placeholder="you@example.com">
        <div class="mt"></div>
        <label>Password (minimum 6 characters)</label>
        <input name="password" type="password" required minlength="6">
        <button class="btn big mt" type="submit">Create account</button>
      </form>
      <div class="row mt" style="justify-content:flex-end"><a href="#/login">Already have an account?</a></div>
    </div></div></div>
  </div>`;

  container.querySelector('#f-reg').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const r = await api('/api/auth/register', { method: 'POST', body: Object.fromEntries(fd) });
      toast('Account created. Welcome to HealthSphere.');
      App.onAuthed({ ...r.user, isAdmin: !!r.isAdmin });
    } catch (err) { toast(err.message, 'err'); }
  };
};
