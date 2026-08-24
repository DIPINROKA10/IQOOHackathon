/* ---------- Lifestyle hub + Reminders ---------- */

VIEWS.lifestyle = async function (container) {
  const d = await api('/api/lifestyle');
  const wi = d.weeklyInsight;
  const act = d.plans.activity, nut = d.plans.nutrition;

  container.innerHTML = `
    <div class="topbar"><div><h1>Lifestyle Hub</h1>
      <div class="page-sub">Exercise, nutrition, sleep and hydration — personalized plans that adapt to your health graph.</div></div>
      <button class="btn secondary" id="regen">Regenerate plans</button></div>

    <div class="grid g2 mb">
      <div class="card">
        <h2>This week vs last week</h2>
        ${wi.hasData ? `
          ${wi.insights.map(i => `
            <div class="spread" style="padding:7px 0;border-bottom:1px dashed var(--line)">
              <b style="font-size:13.5px">${esc(i.area)}</b>
              <span class="${i.good ? 'flag-normal' : 'flag-borderline'}">${esc(i.text)}</span></div>`).join('')}
          <div class="mt" style="font-size:13.5px;background:var(--primary-soft);border-radius:8px;padding:10px 12px">
            <b>Recommendation.</b> ${esc(wi.recommendation)}</div>`
          : '<div class="empty">Start logging below — insights appear after a week of data.</div>'}
        <div class="row mt divider" style="gap:8px">
          <form id="log-ex" class="row" style="gap:6px"><input name="value" type="number" min="0" placeholder="Exercise (min)" style="width:130px"><button class="btn sm">Log</button></form>
          <form id="log-sl" class="row" style="gap:6px"><input name="value" type="number" step="0.5" min="0" placeholder="Sleep (h)" style="width:110px"><button class="btn sm">Log</button></form>
          <form id="log-hy" class="row" style="gap:6px"><input name="value" type="number" step="0.1" min="0" placeholder="Water (L)" style="width:110px"><button class="btn sm">Log</button></form>
          <select id="log-mood" style="width:auto"><option value="">Mood check-in…</option><option value="1">1 — Very low</option><option value="2">2 — Low</option><option value="3">3 — Neutral</option><option value="4">4 — Good</option><option value="5">5 — Very good</option></select>
        </div>
      </div>

      <div class="card">
        <h2><span>Activity plan</span>&nbsp;&nbsp;${act ? `<span class="chip neutral">${esc(act.goal)}</span>` : ''}</h2>
        ${act ? `
          <div class="page-sub">Target ~${act.weeklyTargetMinutes} min/week · generated ${fmtDateUI(act.generatedAt)}</div>
          ${act.weeks.map(w => `
            <details ${w.week === 1 ? 'open' : ''} class="mb" style="border-bottom:1px dashed var(--line);padding-bottom:8px">
              <summary style="cursor:pointer;font-weight:600;font-size:13.5px">Week ${w.week} — ${esc(w.focus)}</summary>
              ${w.items.map(it => `<div class="spread" style="padding:4px 14px;font-size:13.5px"><span>${esc(it.name)}</span><span class="chip ok">${esc(it.detail)}</span></div>`).join('')}
            </details>`).join('')}
          <div class="disclaimer">${act.safetyNotes.map(esc).join('<br>')}</div>`
          : '<div class="empty">No plan yet — set your profile and goals, then regenerate.</div>'}
      </div>
    </div>

    <div class="card mb">
      <h2>Nutrition plan&nbsp;&nbsp;${nut ? `<span class="chip info">${esc(nut.preference)}${nut.estimatedDailyCalories ? ` · ~${nut.estimatedDailyCalories} kcal/day target` : ''}</span>` : ''}</h2>
      ${nut ? `
        <div class="row mb" style="gap:8px">
          <span class="chip neutral">Hydration target: ${esc(nut.hydrationTarget)}</span>
          <span class="chip neutral">Goal: ${esc(nut.goal)}${nut.tdeeEstimate ? ` · TDEE est. ${nut.tdeeEstimate} kcal` : ''}</span>
        </div>
        <table class="tbl"><thead><tr><th>Day</th><th>Breakfast</th><th>Lunch</th><th>Dinner</th><th>Snacks</th></tr></thead>
        <tbody>${nut.weekPlan.map(day => `
          <tr><td><b>${esc(day.day)}</b></td>
          <td>${mealHtml(day.breakfast)}</td><td>${mealHtml(day.lunch)}</td><td>${mealHtml(day.dinner)}</td>
          <td style="color:var(--ink-soft);font-size:12.5px">${esc(day.snacks)}</td></tr>`).join('')}</tbody></table>
        <div class="disclaimer">${nut.notes.map(esc).join('<br>')}</div>`
        : '<div class="empty">No nutrition plan yet.</div>'}
    </div>`;

  function mealHtml([name, kcal]) { return `${esc(name)}<br><small class="tl-detail">${esc(kcal || '')}</small>`; }

  const logTypes = { 'log-ex': 'exercise_minutes', 'log-sl': 'sleep_hours', 'log-hy': 'hydration_liters' };
  for (const [id, type] of Object.entries(logTypes)) {
    container.querySelector('#' + id).onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api('/api/lifestyle/logs', { method: 'POST', body: { type, value: Number(fd.get('value')) } });
        toast('Logged.'); VIEWS.lifestyle(container);
      } catch (err) { toast(err.message, 'err'); }
    };
  }
  container.querySelector('#log-mood').onchange = async e => {
    if (!e.target.value) return;
    await api('/api/lifestyle/logs', { method: 'POST', body: { type: 'mood_score', value: Number(e.target.value) } });
    toast('Check-in recorded.'); VIEWS.lifestyle(container);
  };
  container.querySelector('#regen').onclick = async () => {
    await api('/api/lifestyle/regenerate', { method: 'POST' });
    toast('Plans regenerated from your latest data.'); VIEWS.lifestyle(container);
  };
};

/* ================= REMINDERS ================= */
const REM_TYPE_LABEL = {
  followup: 'Follow-up', measurement: 'Measurement', report: 'Report', screening: 'Screening',
  medication: 'Medication', exercise: 'Exercise', sleep: 'Sleep', lifestyle: 'Lifestyle'
};

VIEWS.reminders = async function (container) {
  let tab = 'active';
  const { reminders } = await api('/api/reminders');

  container.innerHTML = `
    <div class="topbar"><div><h1>Health Reminders</h1>
      <div class="page-sub">Auto-generated from your risk signals, plus your own follow-ups.</div></div></div>

    <div class="grid g2">
      <div class="card">
        <div class="tabs"><button class="tab active" data-t="active">Active (${reminders.filter(r => r.status === 'active').length})</button>
        <button class="tab" data-t="done">Completed / disabled (${reminders.filter(r => r.status !== 'active').length})</button></div>
        <div id="remlist"></div>
      </div>
      <div class="card">
        <h2>Add reminder</h2>
        <form id="f-rem">
          <label>Title</label><input name="title" required placeholder="e.g. Call lab for thyroid retest">
          <div class="grid g2 mt">
            <div><label>Type</label><select name="type">
              ${Object.entries(REM_TYPE_LABEL).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select></div>
            <div><label>Due date</label><input name="dueDate" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
          </div>
          <div class="mt"></div><label>Notes</label><input name="notes" placeholder="Optional">
          <button class="btn mt" type="submit">Add reminder</button>
        </form>
      </div>
    </div>`;

  function renderList() {
    const list = reminders.filter(r => tab === 'active' ? r.status === 'active' : r.status !== 'active');
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('remlist').innerHTML = list.map(r => `
      <div class="tl-event ${r.dueDate <= today && r.status === 'active' ? 'rem-overdue' : ''}">
        <div style="flex:1"><div class="tl-title">${esc(r.title)}</div>
          <div class="rem-due">${r.status === 'completed' ? 'Completed' : r.status === 'disabled' ? 'Disabled' : 'Due ' + fmtDateUI(r.dueDate)}
          &nbsp;<span class="chip neutral" style="font-size:9.5px;padding:1px 5px">${REM_TYPE_LABEL[r.type] || r.type}</span>
          ${r.source !== 'user' ? '<span class="chip info" style="margin-left:6px;font-size:9.5px;padding:1px 5px">auto</span>' : ''}</div>
          ${r.notes ? `<div class="tl-detail">${esc(r.notes)}</div>` : ''}
        </div>
        ${r.status === 'active' ? `<div class="row" style="gap:5px">
          <button class="btn sm" data-act="complete" data-id="${r.id}">Complete</button>
          <button class="btn sm secondary" data-act="snooze" data-id="${r.id}" title="Snooze 3 days">Snooze</button>
          <input type="date" class="resched" data-id="${r.id}" style="width:130px;padding:4px 6px" title="Reschedule to date">
          <button class="btn sm danger-outline" data-act="disable" data-id="${r.id}">Disable</button>
        </div>` : ''}
      </div>`).join('') || '<div class="empty">Nothing here</div>';

    document.getElementById('remlist').querySelectorAll('[data-act]').forEach(b => b.onclick = async () => {
      await api(`/api/reminders/${b.dataset.id}/action`, { method: 'POST', body: { action: b.dataset.act, days: b.dataset.act === 'snooze' ? 3 : undefined } });
      toast({ complete: 'Marked complete.', snooze: 'Snoozed 3 days.', disable: 'Reminder disabled.' }[b.dataset.act]);
      VIEWS.reminders(container);
    });
    document.getElementById('remlist').querySelectorAll('.resched').forEach(inp => inp.onchange = async () => {
      if (!inp.value) return;
      await api(`/api/reminders/${inp.dataset.id}/action`, { method: 'POST', body: { action: 'reschedule', date: inp.value } });
      toast('Rescheduled.'); VIEWS.reminders(container);
    });
  }
  renderList();

  container.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    container.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active'); tab = t.dataset.t; renderList();
  });

  container.querySelector('#f-rem').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/api/reminders', { method: 'POST', body: Object.fromEntries(fd) });
    toast('Reminder added.'); VIEWS.reminders(container);
  };
};
