/* ---------- Dashboard ---------- */

VIEWS.dashboard = async function (container) {
  const d = await api('/api/overview');
  const wi = d.weeklyInsight;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  container.innerHTML = `
    <section class="hero">
      <canvas class="hero-canvas" data-graph aria-hidden="true"></canvas>
      <div class="hero-inner">
        <div>
          <div class="hero-kicker">${today}</div>
          <h1>${greet}, ${esc(d.user.name.split(' ')[0])}</h1>
          <p class="hero-sub">Here is your connected health picture today — signals, trends and next steps in one place.</p>
        </div>
        <div class="hero-actions">
          <button class="btn" data-nav="#/reports">Upload Report</button>
          <button class="btn on-dark" data-nav="#/profile">Add Health Data</button>
          <button class="btn danger-outline" data-nav="#/emergency">Emergency</button>
        </div>
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><b data-count="${d.signalCount}">0</b><span>Health signals detected</span></div>
        <div class="hero-stat"><b data-count="${d.recentReports.length}">0</b><span>Reports processed</span></div>
        <div class="hero-stat"><b data-count="${d.upcomingReminders.length}">0</b><span>Upcoming reminders</span></div>
        <div class="hero-stat"><b data-count="${profileCompletion(d.profile)}">0</b><span>% profile complete</span></div>
      </div>
    </section>

    <div class="grid g2">
      <div class="card">
        <div class="spread"><h2>Key metric trends</h2><a href="#/profile">Manage</a></div>
        ${d.metricCards.map(mc => metricCardRow(mc)).join('') || '<div class="empty">Add measurements to see trends</div>'}
      </div>

      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="card">
          <div class="spread"><h2>Risk signals &amp; preventive guidance</h2><a href="#/insights">All insights</a></div>
          ${(d.topSignals || []).map(s => `
            <div class="card sev-${s.severity}" style="box-shadow:none;margin-bottom:10px;padding:12px 14px">
              <div class="spread"><b style="font-size:13.5px">${esc(s.area)}</b>${sevBadge(s.severity)}</div>
              <div class="page-sub" style="margin:4px 0">${esc(s.action)}</div>
            </div>`).join('') || '<div class="empty">No signals — keep tracking</div>'}
          <div class="disclaimer">Signals are pattern observations from your records, not diagnoses.</div>
        </div>

        <div class="card">
          <div class="spread"><h2>Weekly lifestyle insight</h2><a href="#/lifestyle">Lifestyle hub</a></div>
          ${wi.hasData ? (wi.insights || []).map(i => `
            <div class="spread" style="padding:5px 0;border-bottom:1px dashed var(--line)">
              <span style="font-size:13px;font-weight:600">${esc(i.area)}</span>
              <span class="${i.good ? 'flag-normal' : 'flag-borderline'}" style="font-size:13px">${esc(i.text)}</span>
            </div>`).join('') + `<div class="page-sub mt" style="margin-bottom:0">${esc(wi.recommendation)}</div>`
            : '<div class="empty">Log exercise, sleep or hydration to unlock weekly insights</div>'}
        </div>
      </div>
    </div>

    <div class="grid g2 mt">
      <div class="card">
        <div class="spread"><h2>Recent reports</h2><a href="#/reports">All reports</a></div>
        ${d.recentReports.map(r => `
          <div class="tl-event" style="cursor:pointer" data-report="${r.id}">
            <div style="flex:1"><div class="tl-title">${esc(r.filename)}</div>
            <div class="tl-detail">${r.testCount} values extracted · uploaded ${fmtDateUI(r.uploadedAt)}</div></div>
            <span class="chip neutral">View</span>
          </div>`).join('') || '<div class="empty">No reports yet — upload your first lab report</div>'}
      </div>
      <div class="card">
        <div class="spread"><h2>Upcoming reminders</h2><a href="#/reminders">All reminders</a></div>
        ${d.upcomingReminders.map(r => `
          <div class="tl-event">
            <div><div class="tl-title">${esc(r.title)}</div>
            <div class="rem-due">Due ${fmtDateUI(r.dueDate)}</div></div>
          </div>`).join('') || '<div class="empty">Nothing scheduled</div>'}
        <div class="mt divider spread">
          <div><b style="font-size:13px">Family health signals</b>
          <div class="row mt" style="gap:6px">${(d.familySignals || []).map(f => `<span class="chip warn">${esc(f.cond)} ×${f.n}</span>`).join('') || '<span class="page-sub">Add family history for context-aware guidance</span>'}</div></div>
          <a href="#/family">Family tree</a>
        </div>
        ${(d.careTeam || []).length ? `<div class="divider"><b style="font-size:13px">Care team</b></div>` : ''}
        ${d.careTeam.map(doc => `<div class="tl-event">
          <div><div class="tl-title">${esc(doc.name)}</div><div class="tl-detail">${esc(doc.specialty || doc.role)}</div></div></div>`).join('')}
      </div>
    </div>`;

  container.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => { location.hash = b.dataset.nav; });
  container.querySelectorAll('[data-count]').forEach(el => animateNum(el, +el.dataset.count));
  container.querySelectorAll('.card.hoverable').forEach(c => makeTilt(c, 6));
  if (window.HealthGraph) HealthGraph.mount(container);
  container.querySelectorAll('[data-report]').forEach(el => {
    el.onclick = () => { location.hash = '#/reports'; setTimeout(() => window.__openReport?.(el.dataset.report), 400); };
  });
};

function profileCompletion(p) {
  if (!p) return 0;
  const checks = [p.dob, p.sex, p.heightCm, p.weightKg, p.bloodGroup,
    Array.isArray(p.allergies) ? 'y' : '',
    p.conditions !== undefined ? 'y' : '', p.lifestyle?.activityLevel];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
}

function metricCardRow(mc) {
  if (!mc.analysis || mc.analysis.status === 'no_data') return `
    <div class="spread tl-event"><div><b style="font-size:13px">${esc(mc.label)}</b><div class="tl-detail">No readings yet</div></div></div>`;
  const a = mc.analysis;
  return `
    <div class="tl-event">
      <div style="flex:1">
        <div class="spread"><b style="font-size:13px">${esc(mc.label)}</b>
          <span class="chip neutral">${esc(TREND_ICON[a.direction] || a.direction || '')}</span>
        </div>
        <div class="row" style="justify-content:space-between;margin-top:3px">
          <span style="font-size:19px;font-weight:650;font-variant-numeric:tabular-nums">${a.last.value}<small style="color:var(--ink-soft);font-weight:500"> ${esc(a.unit || '')}</small></span>
          ${sparkline((a.points || []).map(p => p.value))}
        </div>
      </div>
    </div>`;
}
