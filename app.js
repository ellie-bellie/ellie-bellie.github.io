const STORAGE_KEYS = {
    MOODS: 'mood_tracker_moods',
    JOURNAL: 'mood_tracker_journal'
};

let selectedDate = new Date();
let isWeekView = false;
let currentEditingEntry = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    updateCurrentDate();
    setupTabs();
    setupCheckIns();
    setupCalendar();
    setupJournal();
    calculateStreak();
}

// --- UTILS ---
function getDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function updateCurrentDate() {
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// --- TABS ---
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(e.target.dataset.tab).classList.add('active');
        });
    });
}

// --- CALENDAR & WEEK VIEW ---
function setupCalendar() {
    document.getElementById('prev-month').addEventListener('click', () => {
        if (isWeekView) selectedDate.setDate(selectedDate.getDate() - 7);
        else selectedDate.setMonth(selectedDate.getMonth() - 1);
        renderCalendar();
    });
    document.getElementById('next-month').addEventListener('click', () => {
        if (isWeekView) selectedDate.setDate(selectedDate.getDate() + 7);
        else selectedDate.setMonth(selectedDate.getMonth() + 1);
        renderCalendar();
    });
    document.getElementById('toggle-view-btn').addEventListener('click', () => {
        isWeekView = !isWeekView;
        document.getElementById('toggle-view-btn').textContent = isWeekView ? 'Month View' : 'Week View';
        renderCalendar();
    });
    document.getElementById('close-detail').addEventListener('click', () => {
        document.getElementById('day-detail').classList.add('hidden');
    });
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const label = document.getElementById('calendar-month');
    grid.innerHTML = '';
    
    if (isWeekView) {
        label.textContent = "Week View";
        const startOfWeek = new Date(selectedDate);
        startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek);
            day.setDate(startOfWeek.getDate() + i);
            createDayElement(day, grid);
        }
    } else {
        label.textContent = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay();
        const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
        for (let i = 0; i < firstDay; i++) grid.appendChild(document.createElement('div'));
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
            createDayElement(date, grid);
        }
    }
}

function createDayElement(date, container) {
    const moods = JSON.parse(localStorage.getItem(STORAGE_KEYS.MOODS) || '{}');
    const dateKey = getDateKey(date);
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.textContent = date.getDate();
    if (moods[dateKey]) {
        dayEl.classList.add('has-mood');
        const m = moods[dateKey].mood;
        dayEl.style.color = m === 'good' ? '#4CAF50' : (m === 'bad' ? '#F44336' : '#FF9800');
    }
    dayEl.addEventListener('click', () => showDayDetail(date));
    container.appendChild(dayEl);
}

function showDayDetail(date) {
    const dateKey = getDateKey(date);
    const moods = JSON.parse(localStorage.getItem(STORAGE_KEYS.MOODS) || '{}');
    const data = moods[dateKey];
    document.getElementById('detail-date').textContent = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    document.getElementById('detail-moods').innerHTML = data ? `<div class="detail-item"><strong>Mood</strong>${data.mood.toUpperCase()}</div>` : `<p>No mood recorded.</p>`;
    document.getElementById('detail-notes').innerHTML = data && data.tags ? `<div class="detail-item"><strong>Tags</strong>${data.tags.join(', ')}</div>` : '';
    document.getElementById('day-detail').classList.remove('hidden');
}

// --- JOURNAL ---
function setupJournal() {
    document.getElementById('new-entry-btn').addEventListener('click', () => openJournalEditor());
    document.getElementById('close-editor').addEventListener('click', closeJournalEditor);
    document.getElementById('cancel-entry').addEventListener('click', closeJournalEditor);
    document.getElementById('save-entry').addEventListener('click', saveJournalEntry);
    document.getElementById('search-journal').addEventListener('input', (e) => renderJournalEntries(e.target.value.toLowerCase()));
    renderJournalEntries();
}

function openJournalEditor(entry = null) {
    currentEditingEntry = entry;
    document.getElementById('entry-title').value = entry ? entry.title : '';
    document.getElementById('entry-content').value = entry ? entry.content : '';
    document.getElementById('journal-editor').classList.remove('hidden');
}

function closeJournalEditor() {
    document.getElementById('journal-editor').classList.add('hidden');
    currentEditingEntry = null;
}

function saveJournalEntry() {
    const title = document.getElementById('entry-title').value;
    const content = document.getElementById('entry-content').value;
    if (!content) return alert("Please write something first!");

    let entries = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOURNAL) || '[]');
    if (currentEditingEntry) {
        const index = entries.findIndex(e => e.id === currentEditingEntry.id);
        entries[index] = { ...currentEditingEntry, title, content };
    } else {
        entries.unshift({ id: Date.now(), title, content, createdAt: new Date().toISOString() });
    }
    
    localStorage.setItem(STORAGE_KEYS.JOURNAL, JSON.stringify(entries));
    closeJournalEditor();
    renderJournalEntries();
}

function renderJournalEntries(search = '') {
    const container = document.getElementById('journal-entries');
    let entries = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOURNAL) || '[]');
    if (search) entries = entries.filter(e => e.title.toLowerCase().includes(search) || e.content.toLowerCase().includes(search));
    
    container.innerHTML = entries.map(e => `
        <div class="journal-entry" onclick="editEntryById(${e.id})">
            <div class="entry-header">
                <div class="entry-title">${e.title || 'Untitled Entry'}</div>
                <div class="entry-date">${new Date(e.createdAt).toLocaleDateString()}</div>
            </div>
            <div class="entry-preview">${e.content.substring(0, 80)}...</div>
        </div>
    `).join('') || '<p style="text-align:center; padding:20px;">No entries found.</p>';
}

// Global helper for the list clicks
window.editEntryById = (id) => {
    const entries = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOURNAL) || '[]');
    const entry = entries.find(e => e.id === id);
    openJournalEditor(entry);
};

// --- MOOD & STREAK ---
function setupCheckIns() {
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mood = e.currentTarget.dataset.mood;
            const tags = document.getElementById('mood-tags').value.split(',').map(t => t.trim()).filter(t => t);
            const moods = JSON.parse(localStorage.getItem(STORAGE_KEYS.MOODS) || '{}');
            moods[getDateKey(new Date())] = { mood, tags, timestamp: new Date().toISOString() };
            localStorage.setItem(STORAGE_KEYS.MOODS, JSON.stringify(moods));
            alert('Mood Saved!');
            renderCalendar();
            calculateStreak();
        });
    });
}

function calculateStreak() {
    const moods = JSON.parse(localStorage.getItem(STORAGE_KEYS.MOODS) || '{}');
    let streak = 0, check = new Date();
    check.setHours(0,0,0,0);
    while (moods[getDateKey(check)]) { streak++; check.setDate(check.getDate() - 1); }
    document.getElementById('streak-counter').textContent = `🔥 ${streak} Day Streak`;
}
