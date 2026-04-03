// Storage keys
const STORAGE_KEYS = {
    MOODS: 'mood_tracker_moods',
    NOTES: 'mood_tracker_notes',
    JOURNAL: 'mood_tracker_journal'
};

// State
let currentDate = new Date();
let selectedDate = new Date();
let currentEditingEntry = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    registerServiceWorker();
});

function initApp() {
    updateCurrentDate();
    setupTabs();
    setupCheckIns();
    setupCalendar();
    setupJournal();
    loadTodayData();
    
    // Auto-save notes
    document.getElementById('daily-notes').addEventListener('input', debounce(saveDailyNotes, 500));
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {
            console.log('Service worker registration failed');
        });
    }
}

// Date utilities
function formatDate(date) {
    return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function getDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function updateCurrentDate() {
    document.getElementById('current-date').textContent = formatDate(new Date());
}

// Tab navigation
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            
            if (tabId === 'calendar') {
                renderCalendar();
            } else if (tabId === 'journal') {
                renderJournalEntries();
            }
        });
    });
}

// Check-in functionality
function setupCheckIns() {
    const moodButtons = document.querySelectorAll('.mood-btn');
    
    moodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const meal = btn.closest('.mood-buttons').dataset.meal;
            const mood = btn.dataset.mood;
            
            // Remove selected from siblings
            btn.closest('.mood-buttons').querySelectorAll('.mood-btn').forEach(b => {
                b.classList.remove('selected');
            });
            
            btn.classList.add('selected');
            saveMood(meal, mood);
            updateCheckStatus(meal);
            updateDailyAverage();
        });
    });
}

function saveMood(meal, mood) {
    const dateKey = getDateKey(new Date());
    const moods = getAllMoods();
    
    if (!moods[dateKey]) {
        moods[dateKey] = {};
    }
    
    moods[dateKey][meal] = mood;
    localStorage.setItem(STORAGE_KEYS.MOODS, JSON.stringify(moods));
}

function getAllMoods() {
    const stored = localStorage.getItem(STORAGE_KEYS.MOODS);
    return stored ? JSON.parse(stored) : {};
}

function getMoodsForDate(date) {
    const moods = getAllMoods();
    return moods[getDateKey(date)] || {};
}

function updateCheckStatus(meal) {
    const status = document.querySelector(`.check-status[data-meal="${meal}"]`);
    status.textContent = '✓ Checked';
    status.classList.add('checked');
}

function updateDailyAverage() {
    const today = getMoodsForDate(new Date());
    const meals = ['breakfast', 'lunch', 'dinner'];
    const checkedMeals = meals.filter(m => today[m]);
    
    if (checkedMeals.length === 0) {
        document.getElementById('average-display').textContent = 'No check-ins yet';
        return;
    }
    
    const moodValues = { good: 1, neutral: 0, bad: -1 };
    const sum = checkedMeals.reduce((acc, meal) => acc + moodValues[today[meal]], 0);
    const avg = sum / checkedMeals.length;
    
    let emoji, text, color;
    if (avg > 0.3) {
        emoji = '😊';
        text = 'Good';
        color = 'var(--good)';
    } else if (avg < -0.3) {
        emoji = '😔';
        text = 'Rough';
        color = 'var(--bad)';
    } else {
        emoji = '😐';
        text = 'Okay';
        color = 'var(--neutral)';
    }
    
    const display = document.getElementById('average-display');
    display.innerHTML = `<span style="color: ${color}">${emoji} ${text}</span>`;
}

function loadTodayData() {
    const today = getMoodsForDate(new Date());
    
    // Load moods
    ['breakfast', 'lunch', 'dinner'].forEach(meal => {
        if (today[meal]) {
            const btn = document.querySelector(`.mood-buttons[data-meal="${meal}"] .mood-btn[data-mood="${today[meal]}"]`);
            if (btn) {
                btn.classList.add('selected');
                updateCheckStatus(meal);
            }
        }
    });
    
    // Load notes
    const notes = getAllNotes();
    const dateKey = getDateKey(new Date());
    if (notes[dateKey]) {
        document.getElementById('daily-notes').value = notes[dateKey];
    }
    
    updateDailyAverage();
}

// Daily notes
function saveDailyNotes() {
    const dateKey = getDateKey(new Date());
    const notes = getAllNotes();
    const content = document.getElementById('daily-notes').value;
    
    if (content.trim()) {
        notes[dateKey] = content;
    } else {
        delete notes[dateKey];
    }
    
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
}

function getAllNotes() {
    const stored = localStorage.getItem(STORAGE_KEYS.NOTES);
    return stored ? JSON.parse(stored) : {};
}

// Calendar
function setupCalendar() {
    document.getElementById('prev-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
    
    document.getElementById('close-detail').addEventListener('click', () => {
        document.getElementById('day-detail').classList.add('hidden');
    });
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Update month display
    document.getElementById('calendar-month').textContent = 
        currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    
    // Day headers
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day header';
        header.textContent = day;
        grid.appendChild(header);
    });
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const today = new Date();
    const moods = getAllMoods();
    
    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = document.createElement('div');
        day.className = 'calendar-day other-month';
        day.textContent = daysInPrevMonth - i;
        grid.appendChild(day);
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day';
        
        const date = new Date(year, month, i);
        const dateKey = getDateKey(date);
        const dayMoods = moods[dateKey];
        
        // Check if today
        if (date.toDateString() === today.toDateString()) {
            day.classList.add('today');
        }
        
        // Check if has data
        if (dayMoods && Object.keys(dayMoods).length > 0) {
            day.classList.add('has-data');
            
            // Calculate average for indicator
            const moodValues = { good: 1, neutral: 0, bad: -1 };
            const values = Object.values(dayMoods).map(m => moodValues[m]);
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            
            const indicator = document.createElement('div');
            indicator.className = 'mood-indicator';
            if (avg > 0.3) indicator.classList.add('good');
            else if (avg < -0.3) indicator.classList.add('bad');
            else indicator.classList.add('neutral');
            
            day.innerHTML = `${i}`;
            day.appendChild(indicator);
        } else {
            day.textContent = i;
        }
        
        day.addEventListener('click', () => showDayDetail(date));
        grid.appendChild(day);
    }
    
    // Next month days
    const totalCells = grid.children.length - 7; // Exclude headers
    const remainingCells = 42 - totalCells - 7; // 6 rows * 7 days - headers
    for (let i = 1; i <= remainingCells; i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day other-month';
        day.textContent = i;
        grid.appendChild(day);
    }
}

function showDayDetail(date) {
    const moods = getMoodsForDate(date);
    const notes = getAllNotes();
    const dateKey = getDateKey(date);
    
    const detail = document.getElementById('day-detail');
    const dateDisplay = document.getElementById('detail-date');
    const moodsDisplay = document.getElementById('detail-moods');
    const notesDisplay = document.getElementById('detail-notes');
    
    dateDisplay.textContent = formatDate(date);
    
    // Display moods
    moodsDisplay.innerHTML = '<h4>Moods</h4>';
    const moodEmojis = { good: '😊', neutral: '😐', bad: '😔' };
    const moodLabels = { good: 'Good', neutral: 'Neutral', bad: 'Bad' };
    
    if (Object.keys(moods).length === 0) {
        moodsDisplay.innerHTML += '<p style="color: var(--text-light); margin-top: 0.5rem;">No check-ins for this day</p>';
    } else {
        ['breakfast', 'lunch', 'dinner'].forEach(meal => {
            if (moods[meal]) {
                const item = document.createElement('div');
                item.className = 'detail-mood-item';
                item.innerHTML = `
                    <span style="text-transform: capitalize; font-weight: 500;">${meal}</span>
                    <span>${moodEmojis[moods[meal]]} ${moodLabels[moods[meal]]}</span>
                `;
                moodsDisplay.appendChild(item);
            }
        });
    }
    
    // Display notes
    if (notes[dateKey]) {
        notesDisplay.innerHTML = `<h4>Notes</h4><p style="margin-top: 0.5rem; white-space: pre-wrap;">${notes[dateKey]}</p>`;
    } else {
        notesDisplay.innerHTML = '';
    }
    
    detail.classList.remove('hidden');
}

// Journal
function setupJournal() {
    document.getElementById('new-entry-btn').addEventListener('click', () => {
        currentEditingEntry = null;
        showJournalEditor();
    });
    
    document.getElementById('close-editor').addEventListener('click', closeJournalEditor);
    document.getElementById('cancel-entry').addEventListener('click', closeJournalEditor);
    document.getElementById('save-entry').addEventListener('click', saveJournalEntry);
}

function showJournalEditor(entry = null) {
    const editor = document.getElementById('journal-editor');
    const titleInput = document.getElementById('entry-title');
    const contentInput = document.getElementById('entry-content');
    
    if (entry) {
        currentEditingEntry = entry;
        titleInput.value = entry.title || '';
        contentInput.value = entry.content || '';
    } else {
        titleInput.value = '';
        contentInput.value = '';
    }
    
    editor.classList.remove('hidden');
    titleInput.focus();
}

function closeJournalEditor() {
    document.getElementById('journal-editor').classList.add('hidden');
    currentEditingEntry = null;
}

function saveJournalEntry() {
    const title = document.getElementById('entry-title').value.trim();
    const content = document.getElementById('entry-content').value.trim();
    
    if (!content) {
        alert('Please write something before saving');
        return;
    }
    
    const entries = getAllJournalEntries();
    
    if (currentEditingEntry) {
        // Update existing entry
        const index = entries.findIndex(e => e.id === currentEditingEntry.id);
        if (index !== -1) {
            entries[index] = {
                ...currentEditingEntry,
                title,
                content,
                updatedAt: new Date().toISOString()
            };
        }
    } else {
        // Create new entry
        const newEntry = {
            id: Date.now().toString(),
            title: title || 'Untitled',
            content,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        entries.unshift(newEntry);
    }
    
    localStorage.setItem(STORAGE_KEYS.JOURNAL, JSON.stringify(entries));
    closeJournalEditor();
    renderJournalEntries();
}

function getAllJournalEntries() {
    const stored = localStorage.getItem(STORAGE_KEYS.JOURNAL);
    return stored ? JSON.parse(stored) : [];
}

function renderJournalEntries() {
    const entries = getAllJournalEntries();
    const container = document.getElementById('journal-entries');
    
    if (entries.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No journal entries yet</h3>
                <p>Tap "New Entry" to start writing</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    entries.forEach(entry => {
        const entryEl = document.createElement('div');
        entryEl.className = 'journal-entry';
        
        const date = new Date(entry.createdAt);
        const dateStr = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
        
        entryEl.innerHTML = `
            <div class="entry-header">
                <div class="entry-title">${entry.title}</div>
                <div class="entry-date">${dateStr}</div>
            </div>
            <div class="entry-preview">${entry.content}</div>
        `;
        
        entryEl.addEventListener('click', () => showJournalEditor(entry));
        container.appendChild(entryEl);
    });
}

// Utilities
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
