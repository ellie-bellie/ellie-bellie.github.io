const APP_VERSION = 1.6;

const STORAGE_KEYS = {
    MOODS: 'mood_tracker_moods',
    JOURNAL: 'mood_tracker_journal'
};

let currentDate = new Date();
let selectedDate = new Date();
let isWeekView = false;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    updateCurrentDate();
    setupTabs();
    setupCheckIns();
    setupCalendar();
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

// --- CALENDAR LOGIC ---
function setupCalendar() {
    document.getElementById('prev-month').addEventListener('click', () => {
        selectedDate.setMonth(selectedDate.getMonth() - 1);
        renderCalendar();
    });
    document.getElementById('next-month').addEventListener('click', () => {
        selectedDate.setMonth(selectedDate.getMonth() + 1);
        renderCalendar();
    });
    document.getElementById('close-detail').addEventListener('click', () => {
        document.getElementById('day-detail').classList.add('hidden');
    });
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthYearLabel = document.getElementById('calendar-month');
    grid.innerHTML = '';
    
    monthYearLabel.textContent = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();

    // Fill empty spots for previous month
    for (let i = 0; i < firstDay; i++) {
        grid.appendChild(document.createElement('div'));
    }

    const moods = JSON.parse(localStorage.getItem(STORAGE_KEYS.MOODS) || '{}');

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
        const dateKey = getDateKey(date);
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = day;

        if (moods[dateKey]) {
            dayEl.classList.add('has-mood');
            const moodColor = moods[dateKey].mood === 'good' ? '#4CAF50' : (moods[dateKey].mood === 'bad' ? '#F44336' : '#FF9800');
            dayEl.style.color = moodColor;
        }

        dayEl.addEventListener('click', () => showDayDetail(date));
        grid.appendChild(dayEl);
    }
}

function showDayDetail(date) {
    const dateKey = getDateKey(date);
    const moods = JSON.parse(localStorage.getItem(STORAGE_KEYS.MOODS) || '{}');
    const data = moods[dateKey];
    
    document.getElementById('detail-date').textContent = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    const moodContainer = document.getElementById('detail-moods');
    const notesContainer = document.getElementById('detail-notes');
    
    if (data) {
        moodContainer.innerHTML = `<div class="detail-item"><strong>Mood</strong>${data.mood.toUpperCase()}</div>`;
        notesContainer.innerHTML = data.tags && data.tags.length > 0 
            ? `<div class="detail-item"><strong>Tags</strong>${data.tags.join(', ')}</div>` 
            : `<div class="detail-item"><em>No tags for this day.</em></div>`;
    } else {
        moodContainer.innerHTML = `<p>No data recorded for this day.</p>`;
        notesContainer.innerHTML = '';
    }
    
    document.getElementById('day-detail').classList.remove('hidden');
}

// --- MOOD & STREAK LOGIC ---
function setupCheckIns() {
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mood = e.currentTarget.dataset.mood;
            const tags = document.getElementById('mood-tags').value.split(',').map(t => t.trim()).filter(t => t !== "");
            const moods = JSON.parse(localStorage.getItem(STORAGE_KEYS.MOODS) || '{}');
            moods[getDateKey(new Date())] = { mood, tags, timestamp: new Date().toISOString() };
            localStorage.setItem(STORAGE_KEYS.MOODS, JSON.stringify(moods));
            alert('Saved!');
            calculateStreak();
            renderCalendar();
        });
    });
}

function calculateStreak() {
    const moods = JSON.parse(localStorage.getItem(STORAGE_KEYS.MOODS) || '{}');
    let streak = 0;
    let checkDate = new Date();
    checkDate.setHours(0,0,0,0);
    
    while (moods[getDateKey(checkDate)]) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
    }
    document.getElementById('streak-counter').textContent = `🔥 ${streak} Day Streak`;
}
