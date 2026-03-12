// Settings helpers
function populateSettingsForm() {
  if (!settingsForm) return;
  const theme = localStorage.getItem('theme') || 'dark';
  const weeklyGoal = parseInt(localStorage.getItem('weekly_goal') || '20', 10);
  const defaultFilter = localStorage.getItem('default_task_filter') || 'all';
  document.getElementById('settingsTheme').value = theme;
  document.getElementById('settingsWeeklyGoal').value = weeklyGoal;
  document.getElementById('settingsDefaultFilter').value = defaultFilter;
}

if (settingsForm) {
  settingsForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const theme = document.getElementById('settingsTheme').value;
    const weeklyGoal = document.getElementById('settingsWeeklyGoal').value || '20';
    const defaultFilter = document.getElementById('settingsDefaultFilter').value || 'all';
    localStorage.setItem('theme', theme);
    localStorage.setItem('weekly_goal', String(weeklyGoal));
    localStorage.setItem('default_task_filter', defaultFilter);
    currentTaskFilter = defaultFilter;
    document.querySelectorAll('.tasks-filters .pill-filter').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === defaultFilter);
    });
    applySavedTheme();
    refreshDashboard();
    renderTasksList();
    showToast('Settings saved.', 'success');
  });
}

const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');

function triggerDownload(filename, textContent, mime) {
  const blob = new Blob([textContent], { type: mime || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportTasksJSON() {
  const data = { tasks: allTasks, subtasks: allSubtasks };
  triggerDownload('tasks-backup.json', JSON.stringify(data, null, 2), 'application/json');
}

function exportTasksCSV() {
  const header = [
    'id',
    'title',
    'description',
    'dueDate',
    'startTime',
    'endTime',
    'priority',
    'category',
    'tags',
    'recurrence',
    'status'
  ];
  const rows = allTasks.map(function(t) {
    return [
      t.id,
      '"' + String(t.title || '').replace(/"/g, '""') + '"',
      '"' + String(t.description || '').replace(/"/g, '""') + '"',
      t.dueDate || '',
      t.startTime || '',
      t.endTime || '',
      t.priority || '',
      '"' + String(t.category || '').replace(/"/g, '""') + '"',
      '"' + String(t.tags || '').replace(/"/g, '""') + '"',
      t.recurrence || '',
      t.status || ''
    ].join(',');
  });
  const csv = [header.join(',')].concat(rows).join('\n');
  triggerDownload('tasks-backup.csv', csv, 'text/csv');
}

if (exportJsonBtn) {
  exportJsonBtn.addEventListener('click', exportTasksJSON);
}
if (exportCsvBtn) {
  exportCsvBtn.addEventListener('click', exportTasksCSV);
}
const token = localStorage.getItem('token');
if (!token) {
  window.location.href = 'login.html';
}
const API_URL = 'http://localhost:3000';

const taskForm = document.getElementById('taskForm');
const tasksList = document.getElementById('tasksList');
const tasksHeading = document.getElementById('tasksHeading');
const dashSearchInput = document.getElementById('dashSearchInput');
const settingsForm = document.getElementById('settingsForm');
const toastEl = document.getElementById('toast');
const loadingOverlay = document.getElementById('loadingOverlay');

let allTasks = [];
let allSubtasks = [];
let currentTaskFilter = 'all';

function showView(viewName, element) {
  document.querySelectorAll('.view').forEach(function(view) {
    view.classList.remove('active');
  });
  document.querySelectorAll('.nav-item').forEach(function(item) {
    item.classList.remove('active');
  });
  document.getElementById('view-' + viewName).classList.add('active');
  if (element) {
    element.classList.add('active');
  }
  if (viewName === 'tasks' || viewName === 'calendar' || viewName === 'dashboard') {
    fetchTasks();
  }
  if (viewName === 'settings') {
    populateSettingsForm();
  }
}

window.onload = function() {
  applySavedTheme();
  fetchTasks();
};

function setLoading(isLoading) {
  if (!loadingOverlay) return;
  loadingOverlay.style.display = isLoading ? 'flex' : 'none';
}

let toastTimeout = null;
function showToast(message, type) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.className = 'toast show' + (type ? ' ' + type : '');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(function() {
    toastEl.classList.remove('show');
  }, 3500);
}

function fetchTasks() {
  setLoading(true);
  fetch(API_URL + '/tasks', {
    headers: { Authorization: token }
  })
    .then(function(res) {
      return res.json();
    })
    .then(function(payload) {
      if (Array.isArray(payload)) {
        allTasks = payload;
        allSubtasks = [];
      } else {
        allTasks = Array.isArray(payload.tasks) ? payload.tasks : [];
        allSubtasks = Array.isArray(payload.subtasks) ? payload.subtasks : [];
      }
      renderTasksList();
      refreshDashboard();
      renderCalendar();
      setLoading(false);
    })
    .catch(function() {
      setLoading(false);
      showToast('Failed to load tasks from server.', 'error');
    });
}

taskForm.addEventListener('submit', function(event) {
  event.preventDefault();
  const title = document.getElementById('taskTitle').value.trim();
  const description = document.getElementById('taskDescription').value.trim();
  const dueDate = document.getElementById('taskDueDate').value || null;
  const startTime = document.getElementById('taskStartTime').value || null;
  const endTime = document.getElementById('taskEndTime').value || null;
  const priority = document.getElementById('taskPriority').value || 'Medium';
  const category = document.getElementById('taskCategory').value.trim() || null;
  const tags = document.getElementById('taskTags').value.trim() || null;
  const recurrence = document.getElementById('taskRecurrence').value || 'none';
  const reminderAt = document.getElementById('taskReminderAt').value || null;
  const attachments = document.getElementById('taskAttachments').value.trim() || null;
  const subtasksRaw = document.getElementById('taskSubtasks').value.split('\n');
  const subtasks = subtasksRaw
    .map(function(line) { return line.trim(); })
    .filter(function(line) { return line.length > 0; })
    .map(function(titleLine) { return { title: titleLine, completed: false }; });

  if (!title) {
    alert('Please enter a title for the task.');
    return;
  }

  fetch(API_URL + '/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token
    },
    body: JSON.stringify({
      title,
      description,
      dueDate,
      startTime,
      endTime,
      priority,
      category,
      tags,
      recurrence,
      attachments,
      reminderAt,
      subtasks
    })
  })
    .then(function(res) {
      if (!res.ok) throw new Error('Failed to create task');
      return res.json();
    })
    .then(function() {
      taskForm.reset();
      fetchTasks();
      showToast('Task created.', 'success');
    })
    .catch(function() {
      showToast('Failed to create task.', 'error');
    });
});

function updateTaskStatus(id, status) {
  const existing = allTasks.find(function(t) { return t.id === id; });
  fetch(API_URL + '/tasks/' + id, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token
    },
    body: JSON.stringify({ status: status })
  })
    .then(function() {
      if (existing && status === 'Completed' && existing.recurrence && existing.recurrence !== 'none' && existing.dueDate) {
        const d = new Date(existing.dueDate);
        if (existing.recurrence === 'daily') d.setDate(d.getDate() + 1);
        if (existing.recurrence === 'weekly') d.setDate(d.getDate() + 7);
        if (existing.recurrence === 'monthly') d.setMonth(d.getMonth() + 1);
        const newDateKey =
          d.getFullYear() +
          '-' +
          String(d.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(d.getDate()).padStart(2, '0');
        return fetch(API_URL + '/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token
          },
          body: JSON.stringify({
            title: existing.title,
            description: existing.description,
            dueDate: newDateKey,
            startTime: existing.startTime,
            endTime: existing.endTime,
            priority: existing.priority,
            category: existing.category,
            tags: existing.tags,
            recurrence: existing.recurrence,
            attachments: existing.attachments
          })
        }).catch(function() {
          showToast('Failed to create next recurring task.', 'error');
        });
      }
    })
    .finally(function() {
      fetchTasks();
      showToast('Task updated.', 'success');
    });
}

function renderTasksList() {
  const now = new Date();
  const todayKey =
    now.getFullYear() +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(now.getDate()).padStart(2, '0');

  const tasks = allTasks.filter(function(t) {
    if (currentTaskFilter === 'today') {
      return t.dueDate === todayKey;
    }
    if (currentTaskFilter === 'next7') {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      const diff = (d - now) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    }
    if (currentTaskFilter === 'overdue') {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d < now && t.status !== 'Completed';
    }
    if (currentTaskFilter === 'high') {
      return t.priority === 'High' || t.priority === 'Critical';
    }
    return true;
  }).sort(function(a, b) {
    return (a.dueDate || '') > (b.dueDate || '') ? 1 : -1;
  });

  if (tasks.length === 0) {
    tasksHeading.style.display = 'none';
    tasksList.innerHTML = '<p style="color:#888; font-size:14px;">No tasks yet. Create one above.</p>';
    return;
  }

  tasksHeading.style.display = 'block';
  tasksList.innerHTML = '';

  tasks.forEach(function(task) {
    const card = document.createElement('div');
    card.className = 'quote-card';
    card.dataset.taskId = task.id;
    const statusLabel = task.status || 'Pending';
    const actions =
      statusLabel === 'Completed'
        ? '<p style="color:#27ae60; font-weight:bold; margin-top:12px;">✓ Completed</p>'
        : '<div class="actions"><button onclick="updateTaskStatus(' +
          task.id +
          ', \'Completed\')">Mark as Completed</button></div>';

    const tagsDisplay = (task.tags || '')
      .split(',')
      .map(function(t) { return t.trim(); })
      .filter(Boolean)
      .map(function(t) { return '<span class="pill-tag">' + escapeHtml(t) + '</span>'; })
      .join(' ');

    const priorityBadge =
      '<span class="pill-priority priority-' + (task.priority || 'Medium').toLowerCase() + '">' +
      escapeHtml(task.priority || 'Medium') +
      '</span>';

    const subtasksForTask = allSubtasks.filter(function(st) { return st.taskId === task.id; });
    const subtasksHtml =
      subtasksForTask.length === 0
        ? ''
        : '<div class="subtasks">' +
          subtasksForTask
            .map(function(st) {
              const checked = st.completed ? 'checked' : '';
              return (
                '<label class="subtask-item">' +
                '<input type="checkbox" data-subtask-id="' +
                st.id +
                '" data-task-id="' +
                task.id +
                '" ' +
                checked +
                '> ' +
                escapeHtml(st.title) +
                '</label>'
              );
            })
            .join('') +
          '</div>';

    let attachmentsHtml = '';
    if (task.attachments) {
      const lines = task.attachments.split('\n');
      const items = lines
        .map(function(line) { return line.trim(); })
        .filter(Boolean)
        .map(function(line) {
          const isUrl = line.startsWith('http://') || line.startsWith('https://');
          if (isUrl) {
            return '<li><a href="' + line + '" target="_blank" rel="noreferrer">' + escapeHtml(line) + '</a></li>';
          }
          return '<li>' + escapeHtml(line) + '</li>';
        })
        .join('');
      attachmentsHtml = '<ul class="attachments-list">' + items + '</ul>';
    }

    card.innerHTML =
      '<p><strong>Title:</strong> <span class="task-title" data-task-id="' +
      task.id +
      '">' +
      escapeHtml(task.title) +
      '</span></p>' +
      '<p><strong>Description:</strong> <span class="task-desc" data-task-id="' +
      task.id +
      '">' +
      escapeHtml(task.description || '—') +
      '</span></p>' +
      '<p><strong>Due:</strong> ' +
      escapeHtml(task.dueDate || 'None') +
      (task.startTime ? ' • ' + escapeHtml(task.startTime || '') + (task.endTime ? ' - ' + escapeHtml(task.endTime) : '') : '') +
      '</p>' +
      '<p><strong>Status:</strong> <span class="status">' +
      escapeHtml(statusLabel) +
      '</span> ' +
      priorityBadge +
      (task.category ? ' • <span class="pill-category">' + escapeHtml(task.category) + '</span>' : '') +
      '</p>' +
      (tagsDisplay ? '<div class="task-tags">' + tagsDisplay + '</div>' : '') +
      (attachmentsHtml ? '<div class="task-attachments"><strong>Attachments:</strong>' + attachmentsHtml + '</div>' : '') +
      subtasksHtml +
      actions;

    tasksList.appendChild(card);
  });

  // inline editing for title and description
  tasksList.querySelectorAll('.task-title').forEach(function(el) {
    el.addEventListener('click', function() {
      const id = parseInt(el.getAttribute('data-task-id'), 10);
      const task = allTasks.find(function(t) { return t.id === id; });
      if (!task) return;
      const next = prompt('Edit title', task.title || '');
      if (next === null) return;
      fetch(API_URL + '/tasks/' + id, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token
        },
        body: JSON.stringify({ title: next.trim() })
      }).then(function() { fetchTasks(); });
    });
  });

  tasksList.querySelectorAll('.task-desc').forEach(function(el) {
    el.addEventListener('click', function() {
      const id = parseInt(el.getAttribute('data-task-id'), 10);
      const task = allTasks.find(function(t) { return t.id === id; });
      if (!task) return;
      const next = prompt('Edit description', task.description || '');
      if (next === null) return;
      fetch(API_URL + '/tasks/' + id, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token
        },
        body: JSON.stringify({ description: next })
      }).then(function() { fetchTasks(); });
    });
  });

  // subtask toggles
  tasksList.querySelectorAll('.subtasks input[type="checkbox"]').forEach(function(box) {
    box.addEventListener('change', function() {
      const subId = parseInt(box.getAttribute('data-subtask-id'), 10);
      const taskId = parseInt(box.getAttribute('data-task-id'), 10);
      const related = allSubtasks.filter(function(st) { return st.taskId === taskId; }).map(function(st) {
        if (st.id === subId) {
          return {
            title: st.title,
            completed: box.checked
          };
        }
        return {
          title: st.title,
          completed: !!st.completed
        };
      });
      fetch(API_URL + '/tasks/' + taskId, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token
        },
        body: JSON.stringify({ subtasks: related })
      }).then(function() { fetchTasks(); });
    });
  });
}

document.querySelectorAll('.tasks-filters .pill-filter').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tasks-filters .pill-filter').forEach(function(b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
    currentTaskFilter = btn.getAttribute('data-filter');
    renderTasksList();
  });
});

function logout() {
  localStorage.removeItem('token');
  window.location.href = 'login.html';
}

/* ----------------------------
   New Dashboard (inline view)
   ---------------------------- */
function formatCurrencyZAR(amount) {
  const safe = Number.isFinite(amount) ? amount : 0;
  return 'R' + safe.toFixed(2);
}

function parseDateKey(quote) {
  if (quote.quoteDate) return quote.quoteDate;
  if (quote.createdAt && typeof quote.createdAt === 'string') return quote.createdAt.split(' ')[0];
  return null;
}

function toMs(yyyyMmDd) {
  const parts = String(yyyyMmDd).split('-');
  if (parts.length !== 3) return NaN;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d).getTime();
}

function computeTaskStats(tasks) {
  const totalTasks = tasks.length;
  const completed = tasks.filter(function(t) { return t.status === 'Completed'; }).length;
  const pending = totalTasks - completed;

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const dayMap = {};
  tasks.forEach(function(t) {
    if (t.completedAt && t.status === 'Completed') {
      const d = new Date(t.completedAt);
      const key =
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0');
      dayMap[key] = true;
    }
  });

  const keys = Object.keys(dayMap).sort();
  let longestStreak = 0;
  let currentStreak = 0;
  let prevDate = null;
  keys.forEach(function(key) {
    const parts = key.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (prevDate) {
      const diff = (d - prevDate) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        currentStreak += 1;
      } else {
        currentStreak = 1;
      }
    } else {
      currentStreak = 1;
    }
    if (currentStreak > longestStreak) longestStreak = currentStreak;
    prevDate = d;
  });

  const todayKey =
    now.getFullYear() +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(now.getDate()).padStart(2, '0');
  const hasToday = !!dayMap[todayKey];
  const currentStreakToday = hasToday ? currentStreak : 0;

  const WEEKLY_GOAL = parseInt(localStorage.getItem('weekly_goal') || '20', 10);
  const completedThisWeek = tasks.filter(function(t) {
    if (!t.completedAt || t.status !== 'Completed') return false;
    const d = new Date(t.completedAt);
    return d >= startOfWeek && d < endOfWeek;
  }).length;

  const weekCount = tasks.filter(function(t) {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d >= startOfWeek && d < endOfWeek;
  }).length;

  return {
    totalTasks,
    completed,
    pending,
    weekCount,
    streak: longestStreak,
    currentStreak: currentStreakToday,
    weeklyGoal: WEEKLY_GOAL,
    completedThisWeek
  };
}

function topDays(tasks, limit) {
  const byDay = {};
  tasks.forEach(function(t) {
    if (!t.dueDate) return;
    byDay[t.dueDate] = (byDay[t.dueDate] || 0) + 1;
  });
  const entries = Object.keys(byDay).map(function(k) {
    return { day: k, count: byDay[k] };
  });
  entries.sort(function(a, b) {
    return b.count - a.count;
  });
  return entries.slice(0, limit);
}

function recentItems(tasks, searchTerm, limit) {
  const needle = (searchTerm || '').trim().toLowerCase();
  const mapped = tasks
    .map(function(q) {
      const dateKey = q.dueDate || null;
      const ms = dateKey ? toMs(dateKey) : NaN;
      return { q, dateKey, ms: Number.isFinite(ms) ? ms : 0 };
    })
    .sort(function(a, b) {
      return b.ms - a.ms;
    });

  const filtered = needle
    ? mapped.filter(function(item) {
        const q = item.q;
        const hay = [
          q.title,
          q.description,
          q.status,
          item.dateKey
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(needle);
      })
    : mapped;

  return filtered.slice(0, limit);
}

function statusBadgeClass(status) {
  if (status === 'Completed') return 'dash-badge';
  if (status === 'Pending') return 'dash-badge warn';
  return 'dash-badge danger';
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

let dashAnalyticsChart = null;
let dashClientsChart = null;

function buildSeries(tasks, rangeDays) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const start = today - (rangeDays - 1) * 24 * 60 * 60 * 1000;

  const buckets = {};
  for (let i = 0; i < rangeDays; i++) {
    const t = start + i * 24 * 60 * 60 * 1000;
    const d = new Date(t);
    const key =
      d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    buckets[key] = { paid: 0, outstanding: 0 };
  }

  tasks.forEach(function(t) {
    const key = t.dueDate;
    if (!key || !buckets[key]) return;
    const isCompleted = t.status === 'Completed';
    if (isCompleted) buckets[key].paid += 1;
    else buckets[key].outstanding += 1;
  });

  const labels = Object.keys(buckets).sort();
  return {
    labels: labels,
    paid: labels.map(function(k) { return buckets[k].paid; }),
    outstanding: labels.map(function(k) { return buckets[k].outstanding; })
  };
}

function renderAnalyticsChart(tasks, rangeDays) {
  const ctxEl = document.getElementById('dashAnalyticsChart');
  if (!ctxEl) return;
  const series = buildSeries(tasks, rangeDays);
  const ctx = ctxEl.getContext('2d');

  if (dashAnalyticsChart) dashAnalyticsChart.destroy();

  dashAnalyticsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: series.labels,
      datasets: [
        {
          label: 'Completed',
          data: series.paid,
          backgroundColor: 'rgba(22, 163, 74, 0.55)',
          borderColor: 'rgba(15, 122, 76, 0.85)',
          borderWidth: 1,
          borderRadius: 10,
          stack: 'stack'
        },
        {
          label: 'Pending',
          data: series.outstanding,
          backgroundColor: 'rgba(148, 163, 184, 0.55)',
          borderColor: 'rgba(100, 116, 139, 0.8)',
          borderWidth: 1,
          borderRadius: 10,
          stack: 'stack'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: function(ctx2) {
              const val = (ctx2.parsed && ctx2.parsed.y) || 0;
              return ctx2.dataset.label + ': ' + formatCurrencyZAR(val);
            }
          }
        }
      },
      scales: {
        x: { stacked: true, ticks: { maxRotation: 0, autoSkip: true } },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            callback: function(v) {
              return v;
            }
          }
        }
      }
    }
  });
}

function renderClientsChart(tasks) {
  const ctxEl = document.getElementById('dashClientsChart');
  if (!ctxEl) return;
  const top = topDays(tasks, 5);
  const ctx = ctxEl.getContext('2d');

  if (dashClientsChart) dashClientsChart.destroy();

  dashClientsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: top.map(function(x) { return x.day; }),
      datasets: [
        {
          data: top.map(function(x) { return x.count; }),
          backgroundColor: [
            'rgba(22, 163, 74, 0.78)',
            'rgba(15, 122, 76, 0.78)',
            'rgba(34, 197, 94, 0.68)',
            'rgba(148, 163, 184, 0.75)',
            'rgba(100, 116, 139, 0.65)'
          ],
          borderWidth: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: function(ctx2) {
              const val = ctx2.parsed || 0;
              return ctx2.label + ': ' + val + ' task(s)';
            }
          }
        }
      }
    }
  });
}

function renderDashKpis(tasks) {
  const stats = computeTaskStats(tasks);
  document.getElementById('dashKpiTotalTasks').textContent = String(stats.totalTasks);
  document.getElementById('dashKpiCompleted').textContent = String(stats.completed);
  document.getElementById('dashKpiPending').textContent = String(stats.pending);
  document.getElementById('dashKpiWeekCount').textContent = String(stats.weekCount);
  document.getElementById('dashKpiWeekBadge').textContent = String(stats.weekCount);

  document.getElementById('dashKpiTotalTasksHint').textContent = 'All tasks';
  document.getElementById('dashKpiCompletedHint').textContent = stats.completed + ' completed';
  document.getElementById('dashKpiPendingHint').textContent = stats.pending + ' pending';

  const subtitle = document.querySelector('.dash-subtitle');
  if (subtitle) {
    subtitle.textContent =
      'Streak: ' +
      stats.currentStreak +
      ' day(s) • Weekly goal: ' +
      stats.completedThisWeek +
      '/' +
      stats.weeklyGoal +
      ' tasks completed';
  }
}

function renderDashProjectsList(tasks, searchTerm) {
  const container = document.getElementById('dashProjectsList');
  if (!container) return;
  const items = recentItems(tasks, searchTerm, 6);

  if (items.length === 0) {
    container.innerHTML = '<div class="dash-empty">No matches.</div>';
    return;
  }

  container.innerHTML = '';
  items.forEach(function(item) {
    const q = item.q;
    const title = q.title || 'Untitled task';
    const sub = (q.description || '—') + (item.dateKey ? ' • ' + item.dateKey : '');

    const el = document.createElement('div');
    el.className = 'dash-list-item';
    el.innerHTML =
      '<div class="dash-list-left">' +
      '<div class="dash-list-title">' +
      escapeHtml(title) +
      '</div>' +
      '<div class="dash-list-sub">' +
      escapeHtml(sub) +
      '</div>' +
      '</div>' +
      '<div class="' +
      statusBadgeClass(q.status || 'Pending') +
      '">' +
      escapeHtml(q.status || 'Pending') +
      '</div>';
    container.appendChild(el);
  });
}

function getDashRangeDays() {
  const btn = document.querySelector('#view-dashboard .dash-pill-btn.active');
  const range = btn ? parseInt(btn.getAttribute('data-range'), 10) : 7;
  return Number.isFinite(range) ? range : 7;
}

function refreshDashboard() {
  const tasks = Array.isArray(allTasks) ? allTasks : [];
  renderDashKpis(tasks);
  renderAnalyticsChart(tasks, getDashRangeDays());
  renderClientsChart(tasks);
  renderDashProjectsList(tasks, dashSearchInput ? dashSearchInput.value : '');
}

// Timer (persisted)
let dashTimerInterval = null;
let dashTimerStartMs = null;
let dashTimerAccumMs = 0;

function dashSetTimerState(running) {
  const el = document.getElementById('dashTimerState');
  if (!el) return;
  el.textContent = running ? 'Running' : 'Stopped';
}

function dashStartTicking() {
  if (dashTimerInterval) return;
  dashTimerInterval = setInterval(dashRenderTimer, 250);
}

function dashStopTicking() {
  if (!dashTimerInterval) return;
  clearInterval(dashTimerInterval);
  dashTimerInterval = null;
}

function dashRenderTimer() {
  const el = document.getElementById('dashTimerValue');
  if (!el) return;
  const now = Date.now();
  const elapsed = dashTimerAccumMs + (dashTimerStartMs ? Math.max(0, now - dashTimerStartMs) : 0);
  const totalSec = Math.floor(elapsed / 1000);
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  el.textContent = hh + ':' + mm + ':' + ss;
}

function dashLoadTimer() {
  const raw = localStorage.getItem('dash_timer');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    dashTimerStartMs = parsed.timerStartMs;
    dashTimerAccumMs = parsed.timerAccumMs || 0;
    if (parsed.running && typeof dashTimerStartMs === 'number') {
      dashStartTicking();
      dashSetTimerState(true);
    } else {
      dashTimerStartMs = null;
      dashSetTimerState(false);
      dashRenderTimer();
    }
  } catch {
    // ignore
  }
}

function dashSaveTimer(running) {
  localStorage.setItem(
    'dash_timer',
    JSON.stringify({
      running: running,
      timerStartMs: dashTimerStartMs,
      timerAccumMs: dashTimerAccumMs
    })
  );
}

function wireDashboardEvents() {
  const refreshBtn = document.getElementById('dashRefreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', refreshDashboard);

  const newQuoteBtn = document.getElementById('dashNewQuoteBtn');
  if (newQuoteBtn) newQuoteBtn.addEventListener('click', function() {
    const navQuotes = Array.from(document.querySelectorAll('.nav-item')).find(function(el) {
      return (el.textContent || '').toLowerCase().includes('tasks');
    });
    showView('tasks', navQuotes || null);
  });

  const openCompletedBtn = document.getElementById('dashOpenCompletedBtn');
  if (openCompletedBtn) openCompletedBtn.addEventListener('click', function() {
    const navTasks = Array.from(document.querySelectorAll('.nav-item')).find(function(el) {
      return (el.textContent || '').toLowerCase().includes('tasks');
    });
    showView('tasks', navTasks || null);
  });

  const openPendingBtn = document.getElementById('dashOpenPendingBtn');
  if (openPendingBtn) openPendingBtn.addEventListener('click', function() {
    const navTasks = Array.from(document.querySelectorAll('.nav-item')).find(function(el) {
      return (el.textContent || '').toLowerCase().includes('tasks');
    });
    showView('tasks', navTasks || null);
  });

  const newProjectBtn = document.getElementById('dashNewProjectBtn');
  if (newProjectBtn) newProjectBtn.addEventListener('click', function() {
    const navTasks = Array.from(document.querySelectorAll('.nav-item')).find(function(el) {
      return (el.textContent || '').toLowerCase().includes('tasks');
    });
    showView('tasks', navTasks || null);
  });

  if (dashSearchInput) {
    dashSearchInput.addEventListener('input', function() {
      renderDashProjectsList(allTasks, dashSearchInput.value);
    });
  }

  document.querySelectorAll('#view-dashboard .dash-pill-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#view-dashboard .dash-pill-btn').forEach(function(b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      renderAnalyticsChart(allTasks, getDashRangeDays());
    });
  });

  const startBtn = document.getElementById('dashTimerStartBtn');
  const stopBtn = document.getElementById('dashTimerStopBtn');
  const resetBtn = document.getElementById('dashTimerResetBtn');

  if (startBtn)
    startBtn.addEventListener('click', function() {
      if (dashTimerStartMs) return;
      dashTimerStartMs = Date.now();
      dashStartTicking();
      dashSetTimerState(true);
      dashSaveTimer(true);
    });

  if (stopBtn)
    stopBtn.addEventListener('click', function() {
      if (!dashTimerStartMs) return;
      dashTimerAccumMs += Math.max(0, Date.now() - dashTimerStartMs);
      dashTimerStartMs = null;
      dashStopTicking();
      dashSetTimerState(false);
      dashRenderTimer();
      dashSaveTimer(false);
    });

  if (resetBtn)
    resetBtn.addEventListener('click', function() {
      dashTimerStartMs = null;
      dashTimerAccumMs = 0;
      dashStopTicking();
      dashSetTimerState(false);
      dashRenderTimer();
      dashSaveTimer(false);
    });

  document.querySelectorAll('#view-dashboard .dash-icon-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      btn.blur();
    });
  });

  dashLoadTimer();
  dashRenderTimer();
}

wireDashboardEvents();

/* ----------------------------
   Calendar rendering
   ---------------------------- */
function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const title = document.getElementById('calTitle');
  if (!grid || !title) return;

  const now = window.__calCurrent || new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const startDay = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  title.textContent = monthNames[month] + ' ' + year;

  grid.innerHTML = '';
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  dayLabels.forEach(function(d) {
    const header = document.createElement('div');
    header.className = 'calendar-day-header';
    header.textContent = d;
    grid.appendChild(header);
  });

  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-cell';
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    const dateKey =
      dateObj.getFullYear() +
      '-' +
      String(dateObj.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(dateObj.getDate()).padStart(2, '0');
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';

    const dateLabel = document.createElement('div');
    dateLabel.className = 'calendar-date';
    dateLabel.textContent = String(day);
    cell.appendChild(dateLabel);

    const tasksForDay = allTasks.filter(function(t) {
      return t.dueDate === dateKey;
    });

    tasksForDay.forEach(function(t) {
      const pill = document.createElement('div');
      pill.className = 'calendar-task-pill';
      pill.draggable = true;
      pill.dataset.taskId = t.id;
      pill.textContent = t.title;
      pill.addEventListener('dragstart', function(ev) {
        ev.dataTransfer.setData('text/plain', String(t.id));
      });
      cell.appendChild(pill);
    });

    cell.addEventListener('dragover', function(ev) {
      ev.preventDefault();
    });
    cell.addEventListener('drop', function(ev) {
      ev.preventDefault();
      const id = parseInt(ev.dataTransfer.getData('text/plain'), 10);
      if (!id) return;
      updateTaskStatusDate(id, dateKey);
    });

    grid.appendChild(cell);
  }
}

function updateTaskStatusDate(id, newDate) {
  fetch(API_URL + '/tasks/' + id, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token
    },
    body: JSON.stringify({ dueDate: newDate })
  })
    .then(function() {
      fetchTasks();
      showToast('Task moved to ' + newDate + '.', 'success');
    })
    .catch(function() {
      showToast('Failed to move task.', 'error');
    });
}

document.getElementById('calPrev').addEventListener('click', function() {
  const current = window.__calCurrent || new Date();
  window.__calCurrent = new Date(current.getFullYear(), current.getMonth() - 1, 1);
  renderCalendar();
});

document.getElementById('calNext').addEventListener('click', function() {
  const current = window.__calCurrent || new Date();
  window.__calCurrent = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  renderCalendar();
});

// Week agenda mode toggle
const calModeMonthBtn = document.getElementById('calModeMonth');
const calModeWeekBtn = document.getElementById('calModeWeek');

function renderWeekAgenda() {
  const agenda = document.getElementById('weekAgenda');
  if (!agenda) return;
  const now = window.__calCurrent || new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  agenda.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const key =
      date.getFullYear() +
      '-' +
      String(date.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(date.getDate()).padStart(2, '0');
    const col = document.createElement('div');
    col.className = 'week-day-column';
    const title = document.createElement('div');
    title.className = 'week-day-title';
    title.textContent = dayLabels[i] + ' ' + date.getDate();
    col.appendChild(title);

    const tasksForDay = allTasks.filter(function(t) {
      return t.dueDate === key;
    });

    tasksForDay.forEach(function(t) {
      const block = document.createElement('div');
      block.className = 'week-task-block';
      const timePart =
        t.startTime && t.endTime ? t.startTime + '–' + t.endTime : t.startTime ? t.startTime : '';
      block.textContent = (timePart ? timePart + ' • ' : '') + t.title;
      col.appendChild(block);
    });

    agenda.appendChild(col);
  }
}

function setCalendarMode(mode) {
  const grid = document.getElementById('calendarGrid');
  const agenda = document.getElementById('weekAgenda');
  if (mode === 'week') {
    grid.style.display = 'none';
    agenda.style.display = 'grid';
    renderWeekAgenda();
  } else {
    grid.style.display = 'grid';
    agenda.style.display = 'none';
    renderCalendar();
  }
}

if (calModeMonthBtn && calModeWeekBtn) {
  calModeMonthBtn.addEventListener('click', function() {
    calModeMonthBtn.classList.add('active');
    calModeWeekBtn.classList.remove('active');
    setCalendarMode('month');
  });
  calModeWeekBtn.addEventListener('click', function() {
    calModeWeekBtn.classList.add('active');
    calModeMonthBtn.classList.remove('active');
    setCalendarMode('week');
  });
}

// Theme toggle + keyboard shortcuts
const themeToggleBtn = document.getElementById('themeToggleBtn');
function applySavedTheme() {
  const theme = localStorage.getItem('theme') || 'dark';
  if (theme === 'light') {
    document.body.classList.add('theme-light');
  } else {
    document.body.classList.remove('theme-light');
  }
}
applySavedTheme();

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', function() {
    const isLight = document.body.classList.toggle('theme-light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
  });
}

document.addEventListener('keydown', function(e) {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (e.key === 'd') {
    const nav = Array.from(document.querySelectorAll('.nav-item')).find(function(el) {
      return (el.textContent || '').toLowerCase().includes('dashboard');
    });
    showView('dashboard', nav || null);
  }
  if (e.key === 't') {
    const nav = Array.from(document.querySelectorAll('.nav-item')).find(function(el) {
      return (el.textContent || '').toLowerCase().includes('tasks');
    });
    showView('tasks', nav || null);
  }
  if (e.key === 'c') {
    const nav = Array.from(document.querySelectorAll('.nav-item')).find(function(el) {
      return (el.textContent || '').toLowerCase().includes('calendar');
    });
    showView('calendar', nav || null);
  }
  if (e.key === 'n') {
    const titleInput = document.getElementById('taskTitle');
    if (titleInput) {
      titleInput.focus();
    }
  }
});