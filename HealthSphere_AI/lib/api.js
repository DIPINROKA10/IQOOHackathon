import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, persist, coll, objColl, UPLOAD_DIR } from './db.js';
import {
  registerUser, loginUser, logoutToken, getAuthedUser,
  changePassword, audit
} from './auth.js';
import { processDocument, explainReport } from './extraction.js';
import { buildSeries, analyzeSeries, labelOf } from './trends.js';
import { getInsights, emergencyCard } from './insights.js';
import { createReminder, reminderAction, syncAutoReminders } from './reminders.js';
import { buildTimeline, TYPE_META } from './timeline.js';
import { generateActivityPlan, generateNutritionPlan, weeklyInsight } from './lifestyle.js';
import { CITIES, searchFacilities, fetchNearbyLive, geocodePlace } from './hospitals.js';
import { uid, todayISO } from './util.js';

/* ============================ API ROUTES ============================ */

export const routes = [];
const route = (method, pattern, handler, opts = {}) => routes.push({ method, pattern, handler, opts });

const ok = (res, data) => send(res, 200, data);
const bad = (res, err, status = 400) => send(res, status, { error: String(err.message || err) });

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

/* ---------- AUTH ---------- */
route('POST', /^\/api\/auth\/register$/, (req, res, p) => {
  try {
    const user = registerUser(p.body || {});
    initUserData(user.id);
    audit(user.id, 'account_created');
    const { token } = loginUser({ email: p.body.email, password: p.body.password });
    setAuth(res, token);
    ok(res, { user: pub(user), token });
  } catch (e) { bad(res, e); }
}, { auth: false });

route('POST', /^\/api\/auth\/login$/, (req, res, p) => {
  try {
    const { user, token } = loginUser(p.body || {});
    audit(user.id, 'login');
    setAuth(res, token);
    ok(res, { user: pub(user), token });
  } catch (e) { bad(res, e, 401); }
}, { auth: false });

route('POST', /^\/api\/auth\/logout$/, (req, res, p) => {
  logoutToken(p.req);
  res.setHeader('Set-Cookie', 'hs_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  ok(res, { ok: true });
}, { auth: false });

route('POST', /^\/api\/auth\/password$/, (req, res, p) => {
  try {
    changePassword(p.user.id, p.body.current, p.body.next);
    audit(p.user.id, 'password_changed');
    ok(res, { ok: true });
  } catch (e) { bad(res, e); }
});

route('GET', /^\/api\/me$/, (req, res, p) => {
  ok(res, { user: pub(p.user), profile: objColl('profiles', p.user.id), settings: objColl('settings', p.user.id) });
});

/* ---------- PROFILE ---------- */
route('PUT', /^\/api\/profile$/, (req, res, p) => {
  const prof = objColl('profiles', p.user.id);
  const b = p.body || {};
  for (const k of ['dob', 'sex', 'heightCm', 'weightKg', 'bloodGroup']) if (k in b) prof[k] = b[k];
  if ('allergies' in b) prof.allergies = arr(b.allergies);
  if ('conditions' in b) prof.conditions = arr(b.conditions);
  if ('medications' in b) prof.medications = typeof b.medications === 'string' ? [{ name: b.medications }] : arr(b.medications);
  if ('goals' in b) prof.goals = arr(b.goals);
  if ('foodPreference' in b) prof.foodPreference = b.foodPreference;
  if ('restrictions' in b) prof.restrictions = arr(b.restrictions);
  if (b.lifestyle) prof.lifestyle = { ...(prof.lifestyle || {}), ...b.lifestyle };
  if (!prof._createdAt) prof._createdAt = new Date().toISOString();
  // keep weight metric in sync when edited here
  if (b.weightKg && Number(b.weightKg) > 0 && !b._skipWeightMetric) addMetric(p.user.id, 'weight_kg', Number(b.weightKg), 'kg', todayISO(), 'manual');
  audit(p.user.id, 'profile_updated');
  persist();
  ok(res, { profile: prof });
});

function arr(v) {
  return Array.isArray(v) ? v : String(v || '').split(',').map(s => s.trim()).filter(Boolean);
}

/* ---------- DASHBOARD OVERVIEW ---------- */
route('GET', /^\/api\/overview$/, (req, res, p) => {
  const id = p.user.id;
  const insights = getInsights(id);
  const logs = coll('logs', id);
  const weightSeries = buildSeries(coll('metrics', id).filter(m => m.key === 'weight_kg').map(m => ({ date: m.date, value: m.value })));
  const wi = weeklyInsight(logs, weightSeries);

  const focusKeys = ['hba1c', 'bp_systolic', 'ldl', 'weight_kg'];
  const metricCards = focusKeys.map(k => ({
    key: k, label: labelOf(k),
    analysis: insights.seriesSummary[k] ? seriesFull(id, k) : null
  }));

  ok(res, {
    user: pub(p.user),
    profile: objColl('profiles', id),
    signalCount: insights.signals.length,
    topSignals: insights.signals.slice(0, 3),
    metricCards,
    recentReports: coll('reports', id).slice().sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1)).slice(0, 3)
      .map(r => ({ id: r.id, filename: r.filename, uploadedAt: r.uploadedAt, testCount: r.structured?.tests?.length || 0 })),
    upcomingReminders: coll('reminders', id).filter(r => r.status === 'active')
      .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)).slice(0, 5),
    weeklyInsight: wi,
    familySignals: familySummary(id),
    careTeam: coll('doctors', id).slice(0, 2)
  });
});

function seriesFull(userId, key) {
  const entries = coll('metrics', userId).filter(m => m.key === key);
  const series = buildSeries(entries.map(e => ({ date: e.date, value: e.value })));
  const analysis = analyzeSeries(series, key);
  return { ...analysis, points: series.map(p => ({ date: p.date, value: p.value })), unit: entries[0]?.unit || '' };
}

function familySummary(userId) {
  const fam = coll('families', userId);
  const counts = {};
  for (const f of fam) for (const c of f.conditions || []) counts[normalizeCond(c.name)] = (counts[normalizeCond(c.name)] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cond, n]) => ({ cond, n }));
}
function normalizeCond(n) {
  if (/diabet/i.test(n)) return 'Diabetes';
  if (/(heart|cardiac|coronary)/i.test(n)) return 'Heart disease';
  if (/hypertension|blood pressure/i.test(n)) return 'Hypertension';
  if (/thyroid/i.test(n)) return 'Thyroid';
  if (/cholesterol/i.test(n)) return 'High cholesterol';
  if (/cancer/i.test(n)) return 'Cancer';
  return n.replace(/\s+/g, ' ').trim();
}

/* ---------- FAMILY HISTORY ---------- */
route('GET', /^\/api\/family$/, (req, res, p) => ok(res, { members: coll('families', p.user.id) }));

route('POST', /^\/api\/family$/, (req, res, p) => {
  const b = p.body || {};
  if (!b.relation) return bad(res, new Error('Relationship is required.'));
  const m = {
    id: uid('fam'),
    relation: b.relation, name: b.name || '', ageOrYear: b.ageOrYear || '',
    conditions: Array.isArray(b.conditions) ? b.conditions : [],
    surgeries: arr(b.surgeries), cancerHistory: !!b.cancerHistory,
    geneticConditions: arr(b.geneticConditions), events: [], notes: b.notes || '',
    recordedAt: new Date().toISOString()
  };
  coll('families', p.user.id).push(m);
  audit(p.user.id, 'family_member_added', m.relation);
  persist();
  refreshAutoReminders(p.user);
  ok(res, { member: m });
});

route('PUT', /^\/api\/family\/([\w-]+)$/, (req, res, p) => {
  const m = coll('families', p.user.id).find(x => x.id === p.params[0]);
  if (!m) return bad(res, new Error('Not found'), 404);
  Object.assign(m, pick(p.body, ['relation', 'name', 'ageOrYear', 'conditions', 'surgeries', 'geneticConditions', 'notes']));
  if ('cancerHistory' in (p.body || {})) m.cancerHistory = !!p.body.cancerHistory;
  persist();
  ok(res, { member: m });
});

route('DELETE', /^\/api\/family\/([\w-]+)$/, (req, res, p) => {
  db.families[p.user.id] = coll('families', p.user.id).filter(x => x.id !== p.params[0]);
  persist();
  ok(res, { ok: true });
});

/* ---------- REPORTS ---------- */
route('GET', /^\/api\/reports$/, (req, res, p) =>
  ok(res, { reports: coll('reports', p.user.id).slice().sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))
    .map(r => ({ ...r, fileUrl: r.storedName ? `/api/reports/${r.id}/file` : null })) }));

route('GET', /^\/api\/reports\/([\w-]+)$/, (req, res, p) => {
  const r = coll('reports', p.user.id).find(x => x.id === p.params[0]);
  if (!r) return bad(res, new Error('Report not found'), 404);
  const trendNotes = {};
  for (const t of r.structured.tests || []) trendNotes[t.key] = seriesFull(p.user.id, t.key)?.text || '';
  ok(res, { report: { ...r, fileUrl: r.storedName ? `/api/reports/${r.id}/file` : null }, trendNotes });
});

route('GET', /^\/api\/reports\/([\w-]+)\/file$/, (req, res, p) => {
  const r = coll('reports', p.user.id).find(x => x.id === p.params[0]);
  if (!r?.storedName) return bad(res, new Error('File not found'), 404);
  const fp = path.join(UPLOAD_DIR, path.basename(r.storedName));
  if (!fs.existsSync(fp)) return bad(res, new Error('File missing'), 404);
  res.writeHead(200, { 'Content-Type': r.mime || 'application/octet-stream', 'Content-Disposition': `inline; filename="${path.basename(r.filename)}"` });
  fs.createReadStream(fp).pipe(res);
});

route('POST', /^\/api\/reports$/, (req, res, p) => {
  const b = p.body || {};
  if (!b.filename || !b.dataBase64) return bad(res, new Error('filename and dataBase64 are required'));
  let buffer;
  try { buffer = Buffer.from(b.dataBase64, 'base64'); } catch { return bad(res, new Error('Invalid base64 payload')); }

  const out = processDocument({ filename: b.filename, mime: b.mime || guessMime(b.filename), size: buffer.length, buffer },
    { sex: objColl('profiles', p.user.id).sex, fallbackDate: todayISO() });

  const report = {
    id: uid('rep'), filename: sanitizeName(b.filename), storedName: null, mime: b.mime || 'application/pdf',
    size: buffer.length, uploadedAt: new Date().toISOString(),
    status: out.error ? 'failed' : 'processed',
    pipeline: out.stages || [], structured: out.structured || { tests: [] }, summaryText: ''
  };

  if (out.error) { persist(); return bad(res, new Error(out.stages.at(-1).detail)); }

  // store file for PDFs/images (audit trail), not for plain text
  if (!/\.txt$/i.test(report.filename) && buffer.length <= 15 * 1024 * 1024) {
    report.storedName = `${crypto.randomBytes(6).toString('hex')}_${report.filename}`;
    try { fs.writeFileSync(path.join(UPLOAD_DIR, report.storedName), buffer); } catch { report.storedName = null; }
  }

  mergeExtractedMetrics(p.user.id, report);
  report.summaryText = explainReport(report.structured, {});
  coll('reports', p.user.id).push(report);
  audit(p.user.id, 'report_uploaded', report.filename);
  persist();
  syncAutoReminders(p.user, coll('reminders', p.user.id), getInsights(p.user.id).signals);
  persist();
  ok(res, { report });
});

route('POST', /^\/api\/reports\/manual$/, (req, res, p) => {
  const text = String(p.body?.text || '');
  if (text.trim().length < 5) return bad(res, new Error('Paste the report text first.'));
  const buffer = Buffer.from(text, 'utf8');
  const out = processDocument({ filename: 'manual-entry.txt', mime: 'text/plain', size: buffer.length, buffer },
    { sex: objColl('profiles', p.user.id).sex, fallbackDate: p.body?.date || todayISO() });
  if (out.error) return bad(res, new Error(out.stages.at(-1).detail));
  const report = {
    id: uid('rep'), filename: p.body?.filename || 'Pasted report text', storedName: null, mime: 'text/plain',
    size: buffer.length, uploadedAt: new Date().toISOString(), status: 'processed',
    pipeline: out.stages, structured: out.structured, summaryText: ''
  };
  mergeExtractedMetrics(p.user.id, report);
  report.summaryText = explainReport(report.structured, {});
  coll('reports', p.user.id).push(report);
  audit(p.user.id, 'report_manual_entry');
  persist();
  ok(res, { report });
});

route('DELETE', /^\/api\/reports\/([\w-]+)$/, (req, res, p) => {
  const r = coll('reports', p.user.id).find(x => x.id === p.params[0]);
  if (!r) return bad(res, new Error('Not found'), 404);
  if (r.storedName) { try { fs.unlinkSync(path.join(UPLOAD_DIR, r.storedName)); } catch { /* noop */ } }
  db.reports[p.user.id] = coll('reports', p.user.id).filter(x => x.id !== p.params[0]);
  persist();
  ok(res, { ok: true });
});

function mergeExtractedMetrics(userId, report) {
  const date = report.structured.reportDate || report.uploadedAt.slice(0, 10);
  for (const t of report.structured.tests || []) {
    const dup = coll('metrics', userId).some(m => m.key === t.key && m.date === date && Number(m.value) === t.value);
    if (!dup) coll('metrics', userId).push({
      id: uid('met'), key: t.key, value: t.value, unit: t.unit, date,
      source: `report:${report.id}`, flag: t.flag, label: `${t.name} — ${t.unit}`
    });
  }
}

function guessMime(fn) {
  if (/\.pdf$/i.test(fn)) return 'application/pdf';
  if (/\.png$/i.test(fn)) return 'image/png';
  if (/\.jpe?g$/i.test(fn)) return 'image/jpeg';
  return 'text/plain';
}
function sanitizeName(n) { return String(n).replace(/[^\w.\- ]+/g, '_').slice(0, 120); }

/* ---------- METRICS ---------- */
route('GET', /^\/api\/metrics$/, (req, res, p) => {
  const entries = coll('metrics', p.user.id).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  ok(res, { metrics: entries });
});

route('POST', /^\/api\/metrics$/, (req, res, p) => {
  const b = p.body || {};
  if (!b.key || !Number.isFinite(Number(b.value))) return bad(res, new Error('key and numeric value required'));
  const m = addMetric(p.user.id, b.key, Number(b.value), b.unit || defaultUnit(b.key), b.date || todayISO(), 'manual');
  audit(p.user.id, 'metric_added', b.key);
  persist();
  ok(res, { metric: m });
});

route('DELETE', /^\/api\/metrics\/([\w:-]+)$/, (req, res, p) => {
  db.metrics[p.user.id] = coll('metrics', p.user.id).filter(m => m.id !== p.params[0]);
  persist();
  ok(res, { ok: true });
});

function addMetric(userId, key, value, unit, date, source) {
  const m = { id: uid('met'), key, value, unit, date: String(date).slice(0, 10), source, flag: null, label: null };
  coll('metrics', userId).push(m);
  return m;
}

const UNITS = { hba1c: '%', glucose_fasting: 'mg/dL', total_cholesterol: 'mg/dL', ldl: 'mg/dL', hdl: 'mg/dL', triglycerides: 'mg/dL', bp_systolic: 'mmHg', bp_diastolic: 'mmHg', heart_rate: 'bpm', hemoglobin: 'g/dL', weight_kg: 'kg', sleep_hours: 'h', hydration_liters: 'L', exercise_minutes: 'min', mood_score: '/5', tsh: 'µIU/mL', vitamin_d: 'ng/mL', vitamin_b12: 'pg/mL', creatinine: 'mg/dL' };
function defaultUnit(key) { return UNITS[key] || ''; }

/* ---------- TRENDS ---------- */
route('GET', /^\/api\/trends\/([\w-]+)$/, (req, res, p) => {
  const key = p.params[0];
  const entries = coll('metrics', p.user.id).filter(m => m.key === key);
  const series = buildSeries(entries.map(e => ({ date: e.date, value: e.value })));
  const analysis = analyzeSeries(series, key);
  ok(res, { key, label: labelOf(key), unit: defaultUnit(key), series, analysis });
});

/* ---------- TIMELINE ---------- */
route('GET', /^\/api\/timeline$/, (req, res, p) => {
  const events = buildTimeline({
    reports: coll('reports', p.user.id),
    metrics: coll('metrics', p.user.id),
    family: coll('families', p.user.id),
    logs: coll('logs', p.user.id),
    reminders: coll('reminders', p.user.id),
    doctors: coll('doctors', p.user.id)
  });
  let filtered = events;
  const { type, q, from, to } = p.query;
  if (type && type !== 'all') filtered = filtered.filter(e => e.type === type);
  if (q) filtered = filtered.filter(e => (e.title + ' ' + e.detail).toLowerCase().includes(q.toLowerCase()));
  if (from) filtered = filtered.filter(e => e.date >= from);
  if (to) filtered = filtered.filter(e => e.date <= to);
  ok(res, { events: filtered.slice(0, 400), typeMeta: TYPE_META });
});

/* ---------- INSIGHTS ---------- */
route('GET', /^\/api\/insights$/, (req, res, p) => {
  refreshAutoReminders(p.user);
  ok(res, getInsights(p.user.id));
});

function refreshAutoReminders(user) {
  const before = coll('reminders', user.id).length;
  syncAutoReminders(user, coll('reminders', user.id), getInsights(user.id).signals);
  if (coll('reminders', user.id).length !== before) persist();
}

/* ---------- LIFESTYLE ---------- */
route('GET', /^\/api\/lifestyle$/, (req, res, p) => {
  const id = p.user.id;
  const plans = objColl('plans', id);
  const logs = coll('logs', id);
  const weightSeries = buildSeries(coll('metrics', id).filter(m => m.key === 'weight_kg').map(m => ({ date: m.date, value: m.value })));
  ok(res, {
    plans: { activity: plans.activity || null, nutrition: plans.nutrition || null },
    weeklyInsight: weeklyInsight(logs, weightSeries),
    logs: logs.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 60)
  });
});

route('POST', /^\/api\/lifestyle\/regenerate$/, (req, res, p) => {
  const ctxProfile = objColl('profiles', p.user.id);
  const signals = getInsights(p.user.id).signals;
  db.plans[p.user.id] = {
    activity: generateActivityPlan(ctxProfile, signals),
    nutrition: generateNutritionPlan(ctxProfile, signals)
  };
  audit(p.user.id, 'lifestyle_plan_regenerated');
  persist();
  ok(res, { plans: db.plans[p.user.id] });
});

route('POST', /^\/api\/lifestyle\/logs$/, (req, res, p) => {
  const b = p.body || {};
  const valid = ['exercise_minutes', 'sleep_hours', 'hydration_liters', 'mood_score'];
  if (!valid.includes(b.type) || !Number.isFinite(Number(b.value))) return bad(res, new Error(`type must be one of ${valid.join(', ')}`));
  const log = { id: uid('log'), type: b.type, value: Number(b.value), date: b.date || todayISO() };
  coll('logs', p.user.id).push(log);
  persist();
  ok(res, { log });
});

/* ---------- REMINDERS ---------- */
route('GET', /^\/api\/reminders$/, (req, res, p) => {
  const list = coll('reminders', p.user.id).slice().sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  ok(res, { reminders: list });
});

route('POST', /^\/api\/reminders$/, (req, res, p) => {
  const b = p.body || {};
  if (!b.title) return bad(res, new Error('Title is required.'));
  const r = createReminder(p.user.id, b);
  coll('reminders', p.user.id).push(r);
  persist();
  ok(res, { reminder: r });
});

route('POST', /^\/api\/reminders\/([\w-]+)\/action$/, (req, res, p) => {
  const r = coll('reminders', p.user.id).find(x => x.id === p.params[0]);
  if (!r) return bad(res, new Error('Not found'), 404);
  try {
    reminderAction(r, p.body.action, p.body);
    audit(p.user.id, `reminder_${p.body.action}`, r.title);
    persist();
    ok(res, { reminder: r });
  } catch (e) { bad(res, e); }
});

/* ---------- CARE TEAM & EMERGENCY CONTACTS ---------- */
route('GET', /^\/api\/care$/, (req, res, p) =>
  ok(res, { doctors: coll('doctors', p.user.id), contacts: coll('contacts', p.user.id).sort((a, b) => (a.priority || 9) - (b.priority || 9)) }));

route('POST', /^\/api\/doctors$/, (req, res, p) => {
  const b = p.body || {};
  if (!b.name) return bad(res, new Error('Name is required.'));
  const d = { id: uid('doc'), name: b.name, role: b.role || 'Specialist', specialty: b.specialty || '', phone: b.phone || '', clinic: b.clinic || '', notes: b.notes || '', addedAt: new Date().toISOString() };
  coll('doctors', p.user.id).push(d);
  persist();
  ok(res, { doctor: d });
});
route('DELETE', /^\/api\/doctors\/([\w-]+)$/, (req, res, p) => {
  db.doctors[p.user.id] = coll('doctors', p.user.id).filter(d => d.id !== p.params[0]); persist(); ok(res, { ok: true });
});

route('POST', /^\/api\/contacts$/, (req, res, p) => {
  const b = p.body || {};
  if (!b.name || !b.phone) return bad(res, new Error('Name and phone are required.'));
  const c = { id: uid('ct'), name: b.name, relation: b.relation || 'Other', phone: b.phone, notes: b.notes || '', priority: Math.max(1, Math.min(5, Number(b.priority) || 2)) };
  coll('contacts', p.user.id).push(c);
  persist();
  ok(res, { contact: c });
});
route('DELETE', /^\/api\/contacts\/([\w-]+)$/, (req, res, p) => {
  db.contacts[p.user.id] = coll('contacts', p.user.id).filter(c => c.id !== p.params[0]); persist(); ok(res, { ok: true });
});

/* Consent-gated contact import simulation (PRD 8.17) */
route('POST', /^\/api\/contacts\/import$/, (req, res, p) => {
  const s = objColl('settings', p.user.id);
  s.consents = { contactsImport: false, location: false, shareReports: false, familyView: false, ...(s.consents || {}) };
  if (!p.body?.confirm) return bad(res, new Error('Explicit confirmation required to import contacts.'), 403);
  s.consents.contactsImport = true;
  const demoDeviceContacts = [
    { name: 'Suresh Mehta', relation: 'Father', phone: '+91 98200 77889' },
    { name: 'Nirmala Mehta', relation: 'Mother', phone: '+91 98200 99001' }
  ];
  const added = [];
  for (const c of demoDeviceContacts) {
    if (coll('contacts', p.user.id).some(x => x.phone === c.phone)) continue;
    const entry = { id: uid('ct'), ...c, notes: 'Imported from device contacts', priority: 1 };
    coll('contacts', p.user.id).push(entry); added.push(entry);
  }
  audit(p.user.id, 'contacts_imported', `${added.length} contact(s)`);
  persist();
  ok(res, { added, consentRecord: { scope: 'device_contacts', ts: new Date().toISOString() } });
});

/* ---------- HOSPITALS ---------- */
route('GET', /^\/api\/hospitals$/, async (req, res, p) => {
  const q = p.query;
  const lat = q.lat ? parseFloat(q.lat) : null;
  const lng = q.lng ? parseFloat(q.lng) : null;
  const type = q.type || 'all';
  const searchQ = q.q || '';

  // Live OpenStreetMap discovery around real coordinates
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    try {
      const facilities = await fetchNearbyLive({ lat, lng, type, q: searchQ });
      return ok(res, {
        cities: CITIES.map(c => c.name),
        source: 'live',
        origin: { lat, lng },
        radiusKm: 6,
        facilities
      });
    } catch {
      const facilities = searchFacilities({ lat, lng, city: q.city, type, q: searchQ });
      return ok(res, { cities: CITIES.map(c => c.name), source: 'sample', origin: { lat, lng }, facilities });
    }
  }

  // Geocoded place search ("any city or locality")
  if (q.place) {
    try {
      const g = await geocodePlace(q.place);
      try {
        const facilities = await fetchNearbyLive({ lat: g.lat, lng: g.lng, type, q: searchQ });
        return ok(res, { cities: CITIES.map(c => c.name), source: 'live', origin: g, radiusKm: 6, facilities });
      } catch {
        const facilities = searchFacilities({ lat: g.lat, lng: g.lng, city: q.city, type, q: searchQ });
        return ok(res, { cities: CITIES.map(c => c.name), source: 'sample', origin: g, facilities });
      }
    } catch (e) {
      return ok(res, { cities: CITIES.map(c => c.name), source: 'error', error: e.message || 'Place not found', facilities: [] });
    }
  }

  // Offline sample dataset (city browse)
  ok(res, {
    cities: CITIES.map(c => c.name),
    source: 'sample',
    facilities: searchFacilities({ lat, lng, city: q.city, type, q: searchQ })
  });
});

/* ---------- EMERGENCY ---------- */
route('GET', /^\/api\/emergency$/, (req, res, p) => {
  audit(p.user.id, 'emergency_card_accessed');
  ok(res, emergencyCard(p.user.id));
});

/* ---------- SETTINGS / PRIVACY / DATA RIGHTS ---------- */
route('PUT', /^\/api\/settings$/, (req, res, p) => {
  const s = objColl('settings', p.user.id);
  const b = p.body || {};
  if (b.consents) s.consents = { ...(s.consents || {}), ...b.consents };
  if (b.notifications) s.notifications = { ...(s.notifications || {}), ...b.notifications };
  if (b.privacy) s.privacy = { ...(s.privacy || {}), ...b.privacy };
  audit(p.user.id, 'settings_updated', Object.keys(b).join(','));
  persist();
  ok(res, { settings: s });
});

route('GET', /^\/api\/export$/, (req, res, p) => {
  const dump = {
    exportedAt: new Date().toISOString(),
    account: pub(p.user),
    profile: objColl('profiles', p.user.id),
    familyHistory: coll('families', p.user.id),
    medicalReports: coll('reports', p.user.id),
    healthMetrics: coll('metrics', p.user.id),
    lifestyleLogs: coll('logs', p.user.id),
    plans: objColl('plans', p.user.id),
    doctors: coll('doctors', p.user.id),
    emergencyContacts: coll('contacts', p.user.id),
    reminders: coll('reminders', p.user.id),
    consentsAndSettings: objColl('settings', p.user.id)
  };
  audit(p.user.id, 'data_exported');
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Disposition': `attachment; filename="HealthSphere-export-${todayISO()}.json"`,
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(dump, null, 2));
});

route('GET', /^\/api\/audit$/, (req, res, p) => ok(res, { audit: (db.audit[p.user.id] || []).slice(-100).reverse() }));

route('DELETE', /^\/api\/account$/, (req, res, p) => {
  const id = p.user.id;
  for (const k of ['users']) db[k] = db[k].filter(u => u.id !== id);
  db.sessions = db.sessions.filter(s => s.userId !== id);
  delete db.profiles[id]; delete db.families[id]; delete db.reports[id]; delete db.metrics[id];
  delete db.logs[id]; delete db.plans[id]; delete db.doctors[id]; delete db.contacts[id];
  delete db.reminders[id]; delete db.settings[id]; delete db.audit[id];
  persist();
  res.setHeader('Set-Cookie', 'hs_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  ok(res, { ok: true, message: 'Account and all associated data deleted.' });
});

/* ---------------- helpers ---------------- */
function pub(u) { return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt }; }
function pick(obj, keys) { const o = {}; if (!obj) return o; for (const k of keys) if (k in obj) o[k] = obj[k]; return o; }
function initUserData(userId) {
  objColl('profiles', userId);
  objColl('settings', userId).consents = { contactsImport: false, location: false, shareReports: false, familyView: false };
  objColl('settings', userId).notifications = { health: true, lifestyle: true, healthcare: true, emergency: true };
  persist();
}
function setAuth(res, token) {
  res.setHeader('Set-Cookie', `hs_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`);
}

/* ---------------- dispatcher ---------------- */
export async function handleApi(req, res, pathname, query, body) {
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = pathname.match(r.pattern);
    if (!m) continue;
    const params = m.slice(1);
    const needsAuth = r.opts.auth !== false;
    const user = getAuthedUser(req);
    if (needsAuth && !user) { send(res, 401, { error: 'Please sign in.' }); return true; }
    try {
      await r.handler(req, res, { params, query, body, user, req });
    } catch (e) {
      console.error('[api]', e);
      bad(res, e, 500);
    }
    return true;
  }
  return false;
}
