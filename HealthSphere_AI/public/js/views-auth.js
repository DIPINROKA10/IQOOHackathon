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
        <button class="btn secondary sm" id="demo-btn">Explore the live demo</button>
      </div>
      <div class="demo-note"><b>Demo workspace</b> — pre-loaded with two years of health data, family history and processed lab reports.</div>
    </div></div></div>
  </div>`;

  container.querySelector('#f-login').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const r = await api('/api/auth/login', { method: 'POST', body: { email: fd.get('email'), password: fd.get('password') } });
      App.onAuthed(r.user);
    } catch (err) { toast(err.message, 'err'); }
  };
  container.querySelector('#demo-btn').onclick = async () => {
    try {
      const r = await api('/api/auth/login', { method: 'POST', body: { email: 'demo@healthsphere.ai', password: 'demo1234' } });
      App.onAuthed(r.user);
    } catch (err) { toast(err.message, 'err'); }
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
      App.onAuthed(r.user);
    } catch (err) { toast(err.message, 'err'); }
  };
};
