'use strict';

/* =============================================
   Student Attendance Monitoring System — app.js
   Vanilla JS · localStorage persistence
   ============================================= */

/* ---------- Constants & state ---------- */
const STORAGE_KEYS = {
  students: 'sams.students',
  attendance: 'sams.attendance', // { 'YYYY-MM-DD': { [studentId]: { status, timestamp } } }
  theme: 'sams.theme',
  sound: 'sams.sound'
};

const STATUS_LABELS = { present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused', none: 'Not Marked' };
/** students: [{ id, name, section, gender, contact }] */
let students = [];
/** attendance: see STORAGE_KEYS.attendance */
let attendance = {};
let soundOn = true;
let statusMenuStudentId = null;
let confirmResolver = null;

/* ---------- DOM helpers ---------- */
const $ = (sel) => document.querySelector(sel);

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- Date / time helpers ---------- */
const pad2 = (n) => String(n).padStart(2, '0');

/** Local date key 'YYYY-MM-DD' */
function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local timestamp 'YYYY-MM-DDTHH:MM:SS' (no timezone, safe for storage) */
function localTimestamp(date = new Date()) {
  return `${dayKey(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function formatClockTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatClockDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatLongDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/** '2026-10-18T07:52:14' -> 'Oct 18, 2026 · 07:52:14 AM' */
function parseStoredTimestamp(iso) {
  if (typeof iso !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const values = [year, month, day, hour, minute, second].map(Number);
  const [yearNumber, monthNumber, dayNumber, hourNumber, minuteNumber, secondNumber] = values;
  const date = new Date(yearNumber, monthNumber - 1, dayNumber, hourNumber, minuteNumber, secondNumber);
  const isExact = date.getFullYear() === yearNumber && date.getMonth() === monthNumber - 1 &&
    date.getDate() === dayNumber && date.getHours() === hourNumber &&
    date.getMinutes() === minuteNumber && date.getSeconds() === secondNumber;
  return Number.isNaN(date.getTime()) || !isExact
    ? null
    : { date, hour: hourNumber, minute: minuteNumber, second: secondNumber };
}

function formatLogged(iso) {
  const parsed = parseStoredTimestamp(iso);
  if (!parsed) return '';
  const datePart = parsed.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const ampm = parsed.hour >= 12 ? 'PM' : 'AM';
  const h12 = parsed.hour % 12 === 0 ? 12 : parsed.hour % 12;
  return `${datePart} · ${pad2(h12)}:${pad2(parsed.minute)}:${pad2(parsed.second)} ${ampm}`;
}

/** '2026-10-18T07:52:14' -> '07:52 AM' */
function formatTimeShort(iso) {
  const parsed = parseStoredTimestamp(iso);
  if (!parsed) return 'unknown time';
  const ampm = parsed.hour >= 12 ? 'PM' : 'AM';
  const h12 = parsed.hour % 12 === 0 ? 12 : parsed.hour % 12;
  return `${pad2(h12)}:${pad2(parsed.minute)} ${ampm}`;
}

/* ---------- Persistence ---------- */
function loadState() {
  try {
    const storedStudents = JSON.parse(localStorage.getItem(STORAGE_KEYS.students));
    const storedAttendance = JSON.parse(localStorage.getItem(STORAGE_KEYS.attendance));
    students = Array.isArray(storedStudents)
      ? storedStudents.filter((student) => student &&
        typeof student.id === 'string' && typeof student.name === 'string' &&
        typeof student.section === 'string' && typeof student.gender === 'string' &&
        typeof student.contact === 'string')
      : [];
    attendance = storedAttendance && typeof storedAttendance === 'object' && !Array.isArray(storedAttendance)
      ? storedAttendance
      : {};
    soundOn = localStorage.getItem(STORAGE_KEYS.sound) !== 'off';
  } catch (err) {
    console.warn('Failed to read saved data, starting fresh.', err);
    students = [];
    attendance = {};
  }
}

function saveStudents() {
  try {
    localStorage.setItem(STORAGE_KEYS.students, JSON.stringify(students));
    return true;
  } catch (err) {
    console.error(err);
    toast('error', 'Storage error', 'Could not save the student list.');
    return false;
  }
}

function saveAttendance() {
  try {
    localStorage.setItem(STORAGE_KEYS.attendance, JSON.stringify(attendance));
    return true;
  } catch (err) {
    console.error(err);
    toast('error', 'Storage error', 'Could not save attendance logs.');
    return false;
  }
}

/* ---------- Seed mock data (first load only) ---------- */
const SEED_STUDENTS = [
  { id: 'S001', name: 'Emily Chen', section: 'Grade 11 - STEM A', gender: 'Female', contact: 'emily.chen@school.edu' },
  { id: 'S002', name: 'David Lee', section: 'Grade 11 - STEM A', gender: 'Male', contact: '+63 917 100 2001' },
  { id: 'S003', name: 'Sarah Johnson', section: 'Grade 11 - STEM A', gender: 'Female', contact: 'sarah.j@school.edu' },
  { id: 'S004', name: 'Michael Brown', section: 'Grade 11 - STEM A', gender: 'Male', contact: '+63 918 333 4141' },
  { id: 'S005', name: 'Jessica Davis', section: 'Grade 11 - STEM B', gender: 'Female', contact: 'jessica.davis@school.edu' },
  { id: 'S006', name: 'James Wilson', section: 'Grade 11 - STEM B', gender: 'Male', contact: '+63 919 555 0173' },
  { id: 'S007', name: 'Olivia Martinez', section: 'Grade 11 - STEM B', gender: 'Female', contact: 'olivia.m@school.edu' },
  { id: 'S008', name: 'Noah Garcia', section: 'Grade 11 - STEM B', gender: 'Male', contact: '+63 920 777 8282' },
  { id: 'S009', name: 'Sophia Rodriguez', section: 'Grade 12 - ABM A', gender: 'Female', contact: 'sophia.r@school.edu' },
  { id: 'S010', name: 'Ethan Clark', section: 'Grade 12 - ABM A', gender: 'Male', contact: '+63 921 212 3344' },
  { id: 'S011', name: 'Ava Thompson', section: 'Grade 12 - ABM A', gender: 'Female', contact: 'ava.thompson@school.edu' },
  { id: 'S012', name: 'Liam Anderson', section: 'Grade 12 - ABM A', gender: 'Male', contact: '+63 922 606 7171' },
  { id: 'S013', name: 'Mia Robinson', section: 'Grade 12 - HUMSS A', gender: 'Female', contact: 'mia.robinson@school.edu' },
  { id: 'S014', name: 'Benjamin Walker', section: 'Grade 12 - HUMSS A', gender: 'Male', contact: '+63 923 909 1212' },
  { id: 'S015', name: 'Isabella Hall', section: 'Grade 12 - HUMSS A', gender: 'Female', contact: 'isabella.hall@school.edu' },
  { id: 'S016', name: 'Lucas Allen', section: 'Grade 12 - HUMSS A', gender: 'Male', contact: '+63 924 414 5151' }
];

/** Seed today's log so the dashboard looks alive on first load. */
function seedIfNeeded() {
  if (students.length > 0) return;
  students = SEED_STUDENTS.map((s) => ({ ...s }));

  const today = dayKey();
  const marks = [
    ['S001', 'present', '07:52:14'], ['S002', 'present', '07:55:02'], ['S003', 'present', '07:58:41'],
    ['S004', 'late', '08:22:09'], ['S005', 'present', '08:01:33'], ['S006', 'present', '08:03:12'],
    ['S007', 'present', '08:04:55'], ['S008', 'absent', ''], ['S009', 'present', '07:49:27'],
    ['S010', 'present', '08:06:18'], ['S011', 'late', '08:27:44'], ['S012', 'present', '08:07:50'],
    ['S013', 'absent', ''], ['S014', 'present', '08:09:21'], ['S015', 'present', '08:10:36']
    // S016 intentionally left un-marked
  ];
  attendance[today] = {};
  marks.forEach(([id, status, time]) => {
    attendance[today][id] = { status, timestamp: time ? `${today}T${time}` : '' };
  });

  saveStudents();
  saveAttendance();
}

/* ---------- Toasts ---------- */
const TOAST_ICONS = { success: 'circle-check', error: 'triangle-alert', info: 'info' };

function toast(type, title, message) {
  const container = $('#toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <i data-lucide="${TOAST_ICONS[type] || 'info'}"></i>
    <div><strong>${escapeHtml(title)}</strong>${message ? escapeHtml(message) : ''}</div>`;
  container.appendChild(el);
  refreshIcons(el);

  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 250);
  }, 3800);
}

/* ---------- Icons ---------- */
function refreshIcons(root = document) {
  if (window.lucide) window.lucide.createIcons({ root, attrs: { 'stroke-width': 1.9 } });
}

/* ---------- Clock ---------- */
function startClock() {
  const dateEl = $('#clock-date');
  const timeEl = $('#clock-time');
  const tick = () => {
    const now = new Date();
    dateEl.textContent = formatClockDate(now);
    timeEl.textContent = formatClockTime(now);
    const tableLabel = $('#table-date-label');
    if (tableLabel) tableLabel.textContent = `${formatLongDate(now)} · Daily log`;
  };
  tick();
  setInterval(tick, 1000);
}

/* ---------- Theme ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = $('#theme-toggle');
  if (btn) {
    btn.innerHTML = `<i data-lucide="${theme === 'dark' ? 'sun' : 'moon'}"></i>`;
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    btn.title = btn.getAttribute('aria-label');
    refreshIcons(btn);
  }
}

function initTheme() {
  let theme = null;
  try { theme = localStorage.getItem(STORAGE_KEYS.theme); } catch (_) { /* ignore */ }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  applyTheme(theme);

  $('#theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(STORAGE_KEYS.theme, next); } catch (_) { /* ignore */ }
  });
}

/* ---------- Scanner sounds (Web Audio API) ---------- */
let audioCtx = null;

function beep(pattern) {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    pattern.forEach(([freq, start, dur, type]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.25, now + start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    });
  } catch (_) { /* audio not available — visual feedback still shows */ }
}

const SOUND_OK = [[659.25, 0, 0.07], [880, 0.075, 0.08], [1318.5, 0.16, 0.16]];
const SOUND_DUPLICATE = [[523.25, 0, 0.09], [523.25, 0.12, 0.13, 'triangle']];
const SOUND_ERR = [[220, 0, 0.12, 'square'], [165, 0.15, 0.18, 'square']];
const SOUND_MARK = [[1046.5, 0, 0.07], [1568, 0.08, 0.1]];

function initSoundToggle() {
  const btn = $('#sound-toggle');
  const render = () => {
    btn.innerHTML = `<i data-lucide="${soundOn ? 'volume-2' : 'volume-x'}"></i>`;
    btn.setAttribute('aria-label', soundOn ? 'Mute scanner sounds' : 'Unmute scanner sounds');
    btn.title = btn.getAttribute('aria-label');
    refreshIcons(btn);
  };
  render();
  btn.addEventListener('click', () => {
    soundOn = !soundOn;
    try { localStorage.setItem(STORAGE_KEYS.sound, soundOn ? 'on' : 'off'); } catch (_) { /* ignore */ }
    render();
    if (soundOn) beep(SOUND_MARK);
    toast('info', soundOn ? 'Sound enabled' : 'Sound muted', 'Scanner feedback sounds updated.');
  });
}

/* ---------- Attendance operations ---------- */
function validRecord(record) {
  return Boolean(record && typeof record === 'object' &&
    ['present', 'absent', 'late', 'excused'].includes(record.status) &&
    (record.timestamp === '' || parseStoredTimestamp(record.timestamp)));
}

const todayRecords = () => {
  const records = attendance[dayKey()];
  if (!records || typeof records !== 'object' || Array.isArray(records)) return {};
  return records;
};

function getStudent(id) {
  return students.find((s) => s.id === id) || null;
}

/** status: 'present' | 'absent' | 'late' | 'none' (none clears the mark) */
function markAttendance(studentId, status) {
  if (!getStudent(studentId) || !['present', 'absent', 'late', 'excused', 'none'].includes(status)) return;
  const key = dayKey();
  attendance[key] = attendance[key] || {};
  if (status === 'none') {
    delete attendance[key][studentId];
  } else {
    attendance[key][studentId] = { status, timestamp: localTimestamp() };
  }
  saveAttendance();
  renderAll();
}

function computeStats() {
  const recs = todayRecords();
  let present = 0, absent = 0, late = 0, marked = 0;
  Object.values(recs).forEach((r) => {
    if (!validRecord(r)) return;
    if (r.status === 'present') present++;
    else if (r.status === 'absent') absent++;
    else if (r.status === 'late') late++;
    if (r.status) marked++;
  });
  return { total: students.length, present, absent, late, marked, unmarked: students.length - marked };
}

function renderStats() {
  const st = computeStats();
  $('#stat-total').textContent = st.total;
  $('#stat-present').textContent = st.present;
  $('#stat-absent').textContent = st.absent;
  $('#stat-late').textContent = st.late;

  const pct = (n) => (st.total ? `${Math.round((n / st.total) * 100)}% of enrolled` : '—');
  const sections = new Set(students.map((s) => s.section));
  $('#stat-total-sub').textContent = st.total ? `${sections.size} section${sections.size === 1 ? '' : 's'} on record` : 'No students yet';
  $('#stat-present-sub').textContent = pct(st.present);
  $('#stat-absent-sub').textContent = pct(st.absent);
  $('#stat-late-sub').textContent = pct(st.late);
  updateAttendanceChart();
}

/* ---------- Table rendering ---------- */
function statusBadge(status) {
  const s = status || 'none';
  return `<span class="badge badge-${s}"><span class="dot"></span>${STATUS_LABELS[s]}</span>`;
}

function avatarHtml(name) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const palette = ['#14508c', '#0e7490', '#4338ca', '#b45309', '#be123c', '#047857', '#6d28d9', '#0369a1'];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % palette.length;
  return `<span class="avatar" style="background:${palette[hash]}">${escapeHtml(initials)}</span>`;
}

function getFilteredStudents() {
  const q = $('#table-search').value.trim().toLowerCase();
  const statusF = $('#filter-status').value;
  const sectionF = $('#filter-section').value;
  const recs = todayRecords();

  return students.filter((s) => {
    if (q && !s.name.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) return false;
    if (sectionF !== 'all' && s.section !== sectionF) return false;
    if (statusF !== 'all') {
      const status = validRecord(recs[s.id]) ? recs[s.id].status : 'none';
      if (status !== statusF) return false;
    }
    return true;
  });
}

function renderTable() {
  const tbody = $('#attendance-tbody');
  const recs = todayRecords();
  const rows = getFilteredStudents();
  const total = students.length;

  tbody.innerHTML = rows.map((s) => {
    const rec = validRecord(recs[s.id]) ? recs[s.id] : null;
    const status = rec ? rec.status : 'none';
    const logged = rec && rec.timestamp && formatLogged(rec.timestamp) ? formatLogged(rec.timestamp) : '<em>Not logged</em>';
    return `
      <tr data-id="${escapeHtml(s.id)}">
        <td class="cell-id">${escapeHtml(s.id)}</td>
        <td><span class="cell-name">${avatarHtml(s.name)}${escapeHtml(s.name)}</span></td>
        <td>${escapeHtml(s.section)}</td>
        <td class="cell-time${rec && rec.timestamp ? '' : ' empty'}">${logged}</td>
        <td>${statusBadge(status)}</td>
        <td class="col-actions">
          <div class="row-actions">
            <button class="row-btn" type="button" data-action="status" title="Quick edit status" aria-label="Quick edit status for ${escapeHtml(s.name)}"><i data-lucide="sliders-horizontal"></i></button>
            <button class="row-btn" type="button" data-action="profile" title="View profile" aria-label="View profile for ${escapeHtml(s.name)}"><i data-lucide="user-round"></i></button>
            <button class="row-btn danger" type="button" data-action="delete-log" title="Delete attendance log" aria-label="Delete attendance log for ${escapeHtml(s.name)}"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');

  const hasTodayLogs = Object.values(recs).some(validRecord);
  const empty = $('#table-empty');
  empty.hidden = rows.length > 0;
  empty.querySelector('p').textContent = hasTodayLogs
    ? 'No students match the current filters.'
    : 'No attendance logs recorded today. Scan an ID or search above to get started!';
  empty.querySelector('[data-lucide]')?.setAttribute('data-lucide', hasTodayLogs ? 'search' : 'clipboard-list');
  $('#table-count').textContent = `Showing ${rows.length} of ${total} student${total === 1 ? '' : 's'}`;
  refreshIcons(tbody);
}

function renderSectionFilter() {
  const select = $('#filter-section');
  const current = select.value;
  const sections = [...new Set(students.map((s) => s.section))].sort((a, b) => a.localeCompare(b));
  select.innerHTML = '<option value="all">Section: All</option>' +
    sections.map((sec) => `<option value="${escapeHtml(sec)}">${escapeHtml(sec)}</option>`).join('');
  select.value = sections.includes(current) ? current : 'all';

  const datalist = $('#section-suggestions');
  if (datalist) datalist.innerHTML = sections.map((sec) => `<option value="${escapeHtml(sec)}"></option>`).join('');
}

function renderAll() {
  renderStats();
  renderSectionFilter();
  renderTable();
}

/* ---------- Scanner ---------- */
let scannerFlashTimer = null;
let scannerFeedbackTimer = null;
let attendanceChart = null;

function scannerFeedback(kind, message, student = null) {
  const el = $('#scanner-feedback');
  if (!el) return;
  clearTimeout(scannerFeedbackTimer);
  el.className = `scanner-feedback${kind ? ' ' + kind : ''}`;
  el.hidden = false;
  if (student) {
    const timestamp = message.timestamp || localTimestamp();
    el.innerHTML = `<span class="feedback-icon">${kind === 'ok' ? '✓' : kind === 'duplicate' ? '⚠' : '✕'}</span>${avatarHtml(student.name).replace('class="avatar"', 'class="avatar feedback-avatar"')}<span class="feedback-copy"><strong>${escapeHtml(message.title)}</strong><span>${escapeHtml(message.detail || '')}</span></span><button class="feedback-dismiss" type="button" aria-label="Dismiss scan feedback">×</button>`;
  } else {
    el.innerHTML = `<span class="feedback-icon">${kind === 'error' ? '✕' : '⚠'}</span><span class="feedback-copy"><strong>${escapeHtml(message)}</strong></span><button class="feedback-dismiss" type="button" aria-label="Dismiss scan feedback">×</button>`;
  }
  const dismiss = el.querySelector('.feedback-dismiss');
  if (dismiss) dismiss.addEventListener('click', () => { el.hidden = true; });
  scannerFeedbackTimer = setTimeout(() => { el.hidden = true; }, 4000);
}

function updateAttendanceChart() {
  const canvas = $('#attendance-chart');
  if (!canvas || typeof window.Chart !== 'function') return;
  const st = computeStats();
  const values = [st.present, st.absent, st.late];
  if (!attendanceChart) {
    attendanceChart = new Chart(canvas, { type: 'doughnut', data: { labels: ['Present', 'Absent', 'Late'], datasets: [{ data: values, backgroundColor: ['#34d399', '#fb7185', '#fbbf24'], borderColor: '#0f172a', borderWidth: 4, spacing: 3, hoverOffset: 3 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '74%', interaction: { mode: 'nearest', intersect: true }, onHover: (_event, activeElements) => {
        const center = document.querySelector('.chart-center');
        const hoverMessage = document.querySelector('#chart-hover-message');
        const label = document.querySelector('#chart-center-label');
        const detail = document.querySelector('#chart-center-detail');
        if (!center || !hoverMessage || !label || !detail) return;
        const active = activeElements && activeElements[0];
        if (active) {
          const chartLabel = attendanceChart.data.labels[active.index];
          const count = attendanceChart.data.datasets[active.datasetIndex].data[active.index];
          label.textContent = chartLabel;
          const statusClass = chartLabel.toLowerCase();
          hoverMessage.textContent = `${chartLabel}: ${count} student${Number(count) === 1 ? '' : 's'}`;
          hoverMessage.className = `chart-hover-message ${statusClass} is-visible`;
          detail.textContent = `${count} student${Number(count) === 1 ? '' : 's'}`;
          center.classList.add('is-hovering');
        } else {
          label.textContent = 'present';
          detail.textContent = 'of enrolled';
          hoverMessage.className = 'chart-hover-message';
          hoverMessage.textContent = '';
          center.classList.remove('is-hovering');
        }
      }, animation: { duration: 1100, easing: 'easeOutQuart' }, plugins: { legend: { display: false }, tooltip: { enabled: false } } } });
  } else {
    attendanceChart.data.datasets[0].data = values;
    attendanceChart.update();
  }
  const marked = st.present + st.absent + st.late;
  $('#chart-total').textContent = marked;
  $('#chart-present').textContent = st.present;
  $('#chart-absent').textContent = st.absent;
  $('#chart-late').textContent = st.late;
  const presentPercent = st.total ? Math.round((st.present / st.total) * 100) : 0;
  const centerValue = $('#chart-center-value');
  centerValue.textContent = `${presentPercent}%`;
  centerValue.classList.remove('value-pop');
  void centerValue.offsetWidth;
  centerValue.classList.add('value-pop');
}

function flashScanner(kind) {
  const field = $('#scanner-field');
  field.classList.remove('flash-ok', 'flash-error');
  void field.offsetWidth; // restart animation
  field.classList.add(kind);
  clearTimeout(scannerFlashTimer);
  scannerFlashTimer = setTimeout(() => field.classList.remove(kind), 900);
}

function processScan() {
  const input = $('#scanner-input');
  const code = input.value.trim();
  input.value = '';

  if (!code) {
    flashScanner('flash-error');
    beep(SOUND_ERR);
    scannerFeedback('error', 'Please scan or type a Student ID first.');
    return;
  }

  const student = students.find((s) => s.id.toLowerCase() === code.toLowerCase());
  if (!student) {
    flashScanner('flash-error');
    beep(SOUND_ERR);
    scannerFeedback('error', `Unknown ID "${code}" — no enrolled student matches. Check the ID or add the student.`);
    toast('error', 'Scan failed', `No student found with ID "${code}".`);
    return;
  }

  const rec = todayRecords()[student.id];
  if (rec && rec.status === 'present') {
    flashScanner('flash-ok');
    beep(SOUND_DUPLICATE);
    scannerFeedback('duplicate', { title: `Student ${student.id} has already checked in today!`, detail: `${student.name} · ${formatTimeShort(rec.timestamp)}` }, student);
    toast('info', 'Already marked', `${student.name} was logged Present at ${formatTimeShort(rec.timestamp)}.`);
    return;
  }

  markAttendance(student.id, 'present');
  flashScanner('flash-ok');
  beep(SOUND_OK);
  const scanTime = localTimestamp();
  scannerFeedback('ok', { title: `${student.id} — Marked PRESENT at ${formatTimeShort(scanTime)}`, detail: student.name, timestamp: scanTime }, student);
  toast('success', 'Marked Present', `${student.name} · ${student.id} — ${formatTimeShort(localTimestamp())}`);
}

/* ---------- Status dropdown menu ---------- */
function openStatusMenu(anchorBtn, studentId) {
  const menu = $('#status-menu');
  statusMenuStudentId = studentId;
  menu.hidden = false;
  menu.setAttribute('aria-hidden', 'false');

  const rect = anchorBtn.getBoundingClientRect();
  const menuWidth = 180;
  let left = rect.right - menuWidth;
  let top = rect.bottom + 6;
  if (left < 8) left = 8;
  if (top + menu.offsetHeight > window.innerHeight - 8) top = rect.top - menu.offsetHeight - 6;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  const rec = todayRecords()[studentId];
  menu.querySelectorAll('button[data-status]').forEach((b) => {
    b.style.fontWeight = rec && b.dataset.status === rec.status ? '800' : '';
  });
}

function closeStatusMenu() {
  const menu = $('#status-menu');
  menu.hidden = true;
  menu.setAttribute('aria-hidden', 'true');
  statusMenuStudentId = null;
}

/* ---------- Modal helpers ---------- */
function openModal(id) {
  $(id).hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  $(id).hidden = true;
  if (![...document.querySelectorAll('.modal-overlay')].some((m) => !m.hidden)) {
    document.body.style.overflow = '';
  }
}

/** Promise-based confirm dialog */
function confirmDialog(title, message, confirmLabel = 'Confirm') {
  $('#confirm-title').textContent = title;
  $('#confirm-message').textContent = message;
  $('#confirm-yes').innerHTML = `<i data-lucide="check"></i><span>${escapeHtml(confirmLabel)}</span>`;
  refreshIcons($('#confirm-yes'));
  openModal('#confirm-modal');
  return new Promise((resolve) => { confirmResolver = resolve; });
}

function settleConfirm(answer) {
  if (confirmResolver) {
    confirmResolver(answer);
    confirmResolver = null;
  }
  closeModal('#confirm-modal');
}

/* ---------- Add / Edit student ---------- */
const FORM_FIELDS = ['student-id', 'full-name', 'section', 'gender', 'contact'];

function clearFormErrors() {
  FORM_FIELDS.forEach((f) => {
    $(`#err-${f}`).textContent = '';
    const input = $(`#f-${f}`);
    if (input) input.classList.remove('invalid');
  });
}

function setFieldError(field, message) {
  $(`#err-${field}`).textContent = message;
  const input = $(`#f-${field}`);
  if (input) input.classList.add('invalid');
}

function openStudentForm(student = null) {
  clearFormErrors();
  $('#student-edit-id').value = student ? student.id : '';
  $('#student-modal-title').textContent = student ? `Edit Student — ${student.name}` : 'Add New Student';
  $('#f-student-id').value = student ? student.id : '';
  $('#f-full-name').value = student ? student.name : '';
  $('#f-section').value = student ? student.section : '';
  $('#f-gender').value = student ? student.gender : '';
  $('#f-contact').value = student ? student.contact : '';
  $('#f-student-id').disabled = Boolean(student); // IDs are immutable once created
  openModal('#student-modal');
  setTimeout(() => (student ? $('#f-full-name') : $('#f-student-id')).focus(), 60);
}

function handleStudentSubmit(event) {
  event.preventDefault();
  clearFormErrors();

  const editId = $('#student-edit-id').value;
  const id = $('#f-student-id').value.trim();
  const name = $('#f-full-name').value.trim();
  const section = $('#f-section').value.trim();
  const gender = $('#f-gender').value;
  const contact = $('#f-contact').value.trim();

  let ok = true;
  if (!id) { setFieldError('student-id', 'Student ID is required.'); ok = false; }
  else if (!editId && students.some((s) => s.id.toLowerCase() === id.toLowerCase())) {
    setFieldError('student-id', 'This ID already exists. IDs must be unique.'); ok = false;
  }
  if (!name) { setFieldError('full-name', 'Full name is required.'); ok = false; }
  else if (name.length < 2) { setFieldError('full-name', 'Name is too short.'); ok = false; }
  if (!section) { setFieldError('section', 'Grade / Course / Section is required.'); ok = false; }
  if (!gender) { setFieldError('gender', 'Please select a gender.'); ok = false; }
  if (!contact) { setFieldError('contact', 'Email or contact number is required.'); ok = false; }
  else if (!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) || /^[\d\s+()-]{7,}$/.test(contact))) {
    setFieldError('contact', 'Enter a valid email address or contact number.'); ok = false;
  }
  if (!ok) return;

  if (editId) {
    const s = getStudent(editId);
    if (s) Object.assign(s, { name, section, gender, contact });
    saveStudents();
    toast('success', 'Student updated', `${name} (${editId}) has been updated.`);
  } else {
    students.push({ id, name, section, gender, contact });
    saveStudents();
    toast('success', 'Student added', `${name} (${id}) enrolled in ${section}.`);
    beep(SOUND_MARK);
  }

  closeModal('#student-modal');
  renderAll();
  if (!$('#manual-modal').hidden) renderManualResults();
}

/* ---------- Manual search & mark modal ---------- */
function renderManualResults() {
  const q = $('#manual-search').value.trim().toLowerCase();
  const recs = todayRecords();
  const matches = students.filter((s) =>
    !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.section.toLowerCase().includes(q)
  );

  const box = $('#manual-results');
  if (matches.length === 0) {
    box.innerHTML = `<p class="manual-empty">No students match “${escapeHtml($('#manual-search').value.trim())}”.</p>`;
    return;
  }

  box.innerHTML = matches.map((s) => {
    const rec = validRecord(recs[s.id]) ? recs[s.id] : null;
    const status = rec ? rec.status : 'none';
    const active = (st) => (status === st ? ' active' : '');
    const when = rec && rec.timestamp ? ` · logged ${formatTimeShort(rec.timestamp)}` : '';
    return `
      <div class="manual-row" data-id="${escapeHtml(s.id)}">
        ${avatarHtml(s.name)}
        <div class="manual-row-info">
          <div class="manual-row-name">${escapeHtml(s.name)}</div>
          <div class="manual-row-meta">${escapeHtml(s.id)} · ${escapeHtml(s.section)}${when}</div>
        </div>
        ${statusBadge(status)}
        <div class="manual-row-actions">
          <button type="button" class="mark-btn present${active('present')}" data-mark="present" data-id="${escapeHtml(s.id)}">Present</button>
          <button type="button" class="mark-btn absent${active('absent')}" data-mark="absent" data-id="${escapeHtml(s.id)}">Absent</button>
          <button type="button" class="mark-btn late${active('late')}" data-mark="late" data-id="${escapeHtml(s.id)}">Late</button>
        </div>
      </div>`;
  }).join('');
}

/* ---------- Export / Print / Backup / Reset ---------- */
function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function exportCsv() {
  const recs = todayRecords();
  const rows = getFilteredStudents();
  if (rows.length === 0) { toast('info', 'Nothing to export', 'No rows match the current filters.'); return; }

  const header = ['Student ID', 'Full Name', 'Section / Class', 'Date & Time Logged', 'Status'];
  const lines = [header.map(csvCell).join(',')];
  rows.forEach((s) => {
    const rec = validRecord(recs[s.id]) ? recs[s.id] : null;
    lines.push([
      s.id, s.name, s.section,
      rec && rec.timestamp ? formatLogged(rec.timestamp) : 'Not logged',
      STATUS_LABELS[rec ? rec.status : 'none']
    ].map(csvCell).join(','));
  });

  downloadFile(`attendance-${dayKey()}.csv`, lines.join('\r\n'), 'text/csv;charset=utf-8');
  toast('success', 'CSV exported', `${rows.length} record${rows.length === 1 ? '' : 's'} downloaded.`);
}

function printReport() {
  const recs = todayRecords();
  const rows = getFilteredStudents();
  const now = new Date();
  const st = computeStats();

  $('#print-subtitle').textContent =
    `Attendance Report — ${formatLongDate(now)} · ${rows.length} of ${students.length} students shown`;
  $('#print-tbody').innerHTML = rows.map((s) => {
    const rec = validRecord(recs[s.id]) ? recs[s.id] : null;
    return `<tr>
      <td>${escapeHtml(s.id)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.section)}</td>
      <td>${rec && rec.timestamp ? escapeHtml(formatLogged(rec.timestamp)) : 'Not logged'}</td>
      <td>${STATUS_LABELS[rec ? rec.status : 'none']}</td>
    </tr>`;
  }).join('');
  $('#print-foot').textContent =
    `Generated ${formatLogged(localTimestamp(now))} — Present: ${st.present} · Absent: ${st.absent} · Late: ${st.late} · Not marked: ${st.unmarked}`;

  window.print();
}

function saveLogsBackup() {
  const payload = {
    exportedAt: localTimestamp(),
    app: 'Student Attendance Monitoring System',
    students,
    attendance
  };
  downloadFile(`attendance-logs-backup-${dayKey()}.json`, JSON.stringify(payload, null, 2), 'application/json');
  toast('success', 'Logs saved', 'A JSON backup of all stored logs was downloaded.');
}

async function resetToday() {
  const ok = await confirmDialog(
    "Reset today's attendance?",
    'This clears every Present / Absent / Late mark recorded today. The student list is kept. This cannot be undone.',
    'Reset Today'
  );
  if (!ok) return;
  delete attendance[dayKey()];
  saveAttendance();
  renderAll();
  if (!$('#manual-modal').hidden) renderManualResults();
  scannerFeedback('', 'Ready to scan — awaiting input…');
  toast('success', 'Attendance reset', "Today's marks have been cleared.");
}

async function deleteStudent(id) {
  const s = getStudent(id);
  if (!s) return;
  const ok = await confirmDialog('Delete student?', `${s.name} (${s.id}) will be removed from the roster along with all logged marks.`, 'Delete');
  if (!ok) return;
  students = students.filter((x) => x.id !== id);
  Object.values(attendance).forEach((day) => { if (day) delete day[id]; });
  saveStudents();
  saveAttendance();
  renderAll();
  if (!$('#manual-modal').hidden) renderManualResults();
  toast('success', 'Student deleted', `${s.name} (${s.id}) was removed.`);
}

/* ---------- Event wiring ---------- */
function wireEvents() {
  // Scanner
  $('#scanner-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') processScan(); });
  $('#scanner-mark-btn').addEventListener('click', processScan);

  // Table filters (real-time)
  $('#table-search').addEventListener('input', renderTable);
  $('#filter-status').addEventListener('change', renderTable);
  $('#filter-section').addEventListener('change', renderTable);

  // Toolbar
  $('#export-csv-btn').addEventListener('click', exportCsv);
  $('#print-btn').addEventListener('click', printReport);
  $('#save-logs-btn').addEventListener('click', saveLogsBackup);
  $('#reset-btn').addEventListener('click', resetToday);

  // Quick actions
  $('#open-student-modal').addEventListener('click', () => openStudentForm(null));
  $('#open-manual-modal').addEventListener('click', () => {
    $('#manual-search').value = '';
    renderManualResults();
    openModal('#manual-modal');
    setTimeout(() => $('#manual-search').focus(), 60);
  });

  // Manual modal
  $('#manual-search').addEventListener('input', renderManualResults);
  $('#manual-results').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mark]');
    if (!btn) return;
    const id = btn.dataset.id;
    const mark = btn.dataset.mark;
    const s = getStudent(id);
    markAttendance(id, mark);
    renderManualResults();
    beep(mark === 'absent' ? SOUND_ERR : SOUND_MARK);
    toast('success', `Marked ${STATUS_LABELS[mark]}`, `${s ? s.name : id} · ${id} — ${formatTimeShort(localTimestamp())}`);
  });

  // Student form
  $('#student-form').addEventListener('submit', handleStudentSubmit);

  // Table row actions (event delegation)
  $('#attendance-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    if (btn.dataset.action === 'profile') openStudentForm(getStudent(id));
    else if (btn.dataset.action === 'delete-log') {
      markAttendance(id, 'none');
      toast('info', 'Attendance log deleted', `${id} was cleared for today.`);
    } else if (btn.dataset.action === 'status') openStatusMenu(btn, id);
  });

  // Status menu
  const statusMenu = $('#status-menu');
  const closeStatusMenuFromButton = (e) => {
    const closeButton = e.target.closest('#status-menu-close');
    if (!closeButton) return;
    e.preventDefault();
    e.stopPropagation();
    closeStatusMenu();
  };
  statusMenu.addEventListener('pointerdown', closeStatusMenuFromButton);
  statusMenu.addEventListener('click', closeStatusMenuFromButton);
  statusMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-status]');
    if (!btn || !statusMenuStudentId) return;
    const id = statusMenuStudentId;
    const status = btn.dataset.status;
    const s = getStudent(id);
    closeStatusMenu();
    markAttendance(id, status);
    beep(status === 'absent' ? SOUND_ERR : SOUND_MARK);
    if (status === 'none') toast('info', 'Mark cleared', `${s ? s.name : id} is now unmarked.`);
    else toast('success', `Marked ${STATUS_LABELS[status]}`, `${s ? s.name : id} · ${id} — ${formatTimeShort(localTimestamp())}`);
  });

  const closeTransientUiOnOutsidePointer = (e) => {
    const menu = $('#status-menu');
    const clickedStatusAction = e.target.closest('[data-action="status"]');
    if (!menu.hidden && !menu.contains(e.target) && !clickedStatusAction) closeStatusMenu();
  };
  document.addEventListener('pointerdown', closeTransientUiOnOutsidePointer);
  document.addEventListener('click', closeTransientUiOnOutsidePointer);
  window.addEventListener('resize', closeStatusMenu);
  window.addEventListener('scroll', closeStatusMenu, true);

  // Confirm dialog
  $('#confirm-yes').addEventListener('click', () => settleConfirm(true));

  // Modal close buttons + overlay clicks + Escape
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    const closeFromBackdrop = (e) => {
      if (e.target !== overlay) return;
      closeModal(`#${overlay.id}`);
      if (overlay.id === 'confirm-modal') settleConfirm(false);
    };
    overlay.addEventListener('pointerdown', closeFromBackdrop);
    overlay.addEventListener('click', closeFromBackdrop);
    overlay.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', () => {
        closeModal(`#${overlay.id}`);
        if (overlay.id === 'confirm-modal') settleConfirm(false);
      });
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const openOverlays = [...document.querySelectorAll('.modal-overlay')].filter((m) => !m.hidden);
    if (openOverlays.length) {
      const top = openOverlays[openOverlays.length - 1];
      closeModal(`#${top.id}`);
      if (top.id === 'confirm-modal') settleConfirm(false);
    } else {
      closeStatusMenu();
    }
  });
}

/* ---------- Init ---------- */
let attendanceAppInitialized = false;

function initAttendanceApp() {
  if (attendanceAppInitialized) return;
  attendanceAppInitialized = true;
  loadState();
  seedIfNeeded();
  initTheme();
  initSoundToggle();
  startClock();
  wireEvents();
  renderAll();
  refreshIcons();

  // Autofocus scanner on desktop so USB scanners type straight into it
  if (window.matchMedia('(min-width: 900px) and (pointer: fine)').matches) {
    $('#scanner-input').focus();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initAttendanceApp();
});







