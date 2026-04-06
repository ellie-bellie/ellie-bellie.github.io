const APP_VERSION = 1;

// Storage keys
const STORAGE_KEYS = {
    MOODS: 'mood_tracker_moods',
    NOTES: 'mood_tracker_notes',
    JOURNAL: 'mood_tracker_journal',
    TAGS: 'mood_tracker_tags'
};

// State
let currentDate = new Date();
let selectedDate = new Date();
let currentEditingEntry = null;
let currentWeekStart = new Date();
let currentPhotos = [];
let allEntries = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    registerServiceWorker();
});

function initApp() {
    updateCurrentDate();
    setupTabs();
    setupCheckIns();
    setupTags();
    setupCalendar();
    setupJournal();
    setupTrends();
    loadTodayData();
    updateStreak();
    
    // Auto-save notes
    document.getElementById('daily-notes').addEventListener('input', debounce(saveDailyNotes, 500));
    
    // Set up current week
    currentWeekStart = getWeekStart(new Date());
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

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
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
            } else if (tabId === 'trends') {
                renderTrends();
            }
        });
    });
}

// Streak counter
function updateStreak() {
    const moods = getAllMoods();
    const dates = Object.keys(moods).sort().reverse();
    
    let streak = 0;
    const today = getDateKey(new Date());
    let checkDate = new Date();
    
    // Check if we have today's data
    const todayMoods = moods[today] || {};
    const hasTodayData = Object.keys(todayMoods).length > 0;
    
    // Start from yesterday if no data today, otherwise start from today
    if (!hasTodayData) {
        checkDate = addDays(checkDate, -1);
    }
    
    // Count consecutive days with data
    while (true) {
        const key = getDateKey(checkDate);
        const dayMoods = moods[key] || {};
        
        if (Object.keys(dayMoods).length === 0) {
            break;
        }
        
        streak++;
        checkDate = addDays(checkDate, -1);
    }
    
    document.getElementById('streak-count').textContent = streak;
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
            updateStreak();
        });
    });
}

function setupTags() {
    const tagButtons = document.querySelectorAll('.tag-btn');
    
    tagButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const meal = btn.closest('.tags-section').dataset.meal;
            const tag = btn.dataset.tag;
            
            btn.classList.toggle('selected');
            saveTags(meal, getSelectedTags(meal));
        });
    });
}

function getSelectedTags(meal) {
    const section = document.querySelector(`.tags-section[data-meal="${meal}"]`);
    const selected = section.querySelectorAll('.tag-btn.selected');
    return Array.from(selected).map(btn => btn.dataset.tag);
}

function saveTags(meal, tags) {
    const dateKey = getDateKey(new Date());
    const allTags = getAllTags();
    
    if (!allTags[dateKey]) {
        allTags[dateKey] = {};
    }
    
    allTags[dateKey][meal] = tags;
    localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(allTags));
}

function getAllTags() {
    const stored = localStorage.getItem(STORAGE_KEYS.TAGS);
    return stored ? JSON.parse(stored) : {};
}

function getTagsForDate(date) {
    const tags = getAllTags();
    return tags[getDateKey(date)] || {};
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
    
    let icon, text, color;
    if (avg > 0.3) {
        icon = 'good.png';
        text = 'Good';
        color = 'var(--good)';
    } else if (avg < -0.3) {
        icon = 'bad.png';
        text = 'Rough';
        color = 'var(--bad)';
    } else {
        icon = 'neutral.png';
        text = 'Okay';
        color = 'var(--neutral)';
    }
    
    const display = document.getElementById('average-display');
    display.innerHTML = `<img src="${icon}" alt="${text}" style="width: 64px; height: 64px; margin-bottom: 0.5rem;"><br><span style="color: ${color}; font-size: 1.5rem;">${text}</span>`;
}

function loadTodayData() {
    const today = getMoodsForDate(new Date());
    const todayTags = getTagsForDate(new Date());
    
    // Load moods
    ['breakfast', 'lunch', 'dinner'].forEach(meal => {
        if (today[meal]) {
            const btn = document.querySelector(`.mood-buttons[data-meal="${meal}"] .mood-btn[data-mood="${today[meal]}"]`);
            if (btn) {
                btn.classList.add('selected');
                updateCheckStatus(meal);
            }
        }
        
        // Load tags
        if (todayTags[meal]) {
            const section = document.querySelector(`.tags-section[data-meal="${meal}"]`);
            todayTags[meal].forEach(tag => {
                const tagBtn = section.querySelector(`.tag-btn[data-tag="${tag}"]`);
                if (tagBtn) {
                    tagBtn.classList.add('selected');
                }
            });
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

// Trends
function setupTrends() {
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTrends();
        });
    });
    
    document.getElementById('prev-week').addEventListener('click', () => {
        currentWeekStart = addDays(currentWeekStart, -7);
        renderTrends();
    });
    
    document.getElementById('next-week').addEventListener('click', () => {
        currentWeekStart = addDays(currentWeekStart, 7);
        renderTrends();
    });
    
    document.getElementById('export-data-btn').addEventListener('click', exportData);
}

function renderTrends() {
    const activeView = document.querySelector('.view-btn.active').dataset.view;
    
    if (activeView === 'week') {
        renderWeekView();
    } else {
        renderMonthView();
    }
    
    renderStats(activeView);
}

function renderWeekView() {
    const weekEnd = addDays(currentWeekStart, 6);
    document.getElementById('week-range').textContent = 
        `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    
    const chart = document.getElementById('week-chart');
    chart.innerHTML = '';
    
    const moods = getAllMoods();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 0; i < 7; i++) {
        const date = addDays(currentWeekStart, i);
        const dateKey = getDateKey(date);
        const dayMoods = moods[dateKey] || {};
        
        const dayEl = document.createElement('div');
        dayEl.className = 'week-day';
        
        const label = document.createElement('div');
        label.className = 'week-day-label';
        label.textContent = `${days[i]} ${date.getDate()}`;
        
        const moodsContainer = document.createElement('div');
        moodsContainer.className = 'week-day-moods';
        
        ['breakfast', 'lunch', 'dinner'].forEach(meal => {
            if (dayMoods[meal]) {
                const icon = document.createElement('img');
                icon.src = `${dayMoods[meal]}.png`;
                icon.className = 'week-mood-icon';
                icon.alt = dayMoods[meal];
                moodsContainer.appendChild(icon);
            }
        });
        
        if (moodsContainer.children.length === 0) {
            moodsContainer.innerHTML = '<span style="color: var(--text-light); font-size: 0.9rem;">No data</span>';
        }
        
        dayEl.appendChild(label);
        dayEl.appendChild(moodsContainer);
        chart.appendChild(dayEl);
    }
}

function renderMonthView() {
    // For month view, show the whole current month
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    document.getElementById('week-range').textContent = 
        currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const chart = document.getElementById('week-chart');
    chart.innerHTML = '<div style="color: var(--text-light); text-align: center; padding: 2rem;">Month view shows aggregated stats below</div>';
}

function renderStats(period) {
    const moods = getAllMoods();
    const tags = getAllTags();
    let dates = [];
    
    if (period === 'week') {
        for (let i = 0; i < 7; i++) {
            dates.push(getDateKey(addDays(currentWeekStart, i)));
        }
    } else {
        // Month
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        for (let i = 1; i <= lastDay; i++) {
            dates.push(getDateKey(new Date(year, month, i)));
        }
    }
    
    // Calculate mood breakdown
    let goodCount = 0, neutralCount = 0, badCount = 0, totalCheckins = 0;
    
    dates.forEach(dateKey => {
        const dayMoods = moods[dateKey] || {};
        Object.values(dayMoods).forEach(mood => {
            totalCheckins++;
            if (mood === 'good') goodCount++;
            else if (mood === 'neutral') neutralCount++;
            else if (mood === 'bad') badCount++;
        });
    });
    
    if (totalCheckins === 0) {
        document.getElementById('period-breakdown').textContent = 'No data';
    } else {
        const goodPct = Math.round((goodCount / totalCheckins) * 100);
        const neutralPct = Math.round((neutralCount / totalCheckins) * 100);
        const badPct = Math.round((badCount / totalCheckins) * 100);
        document.getElementById('period-breakdown').innerHTML = `
            <div style="font-size: 0.95rem; line-height: 1.8;">
                <div style="color: var(--good);">😊 ${goodPct}% Good</div>
                <div style="color: var(--neutral);">😐 ${neutralPct}% Neutral</div>
                <div style="color: var(--bad);">😔 ${badPct}% Bad</div>
            </div>
        `;
    }
    
    // Calculate common tags
    const tagCounts = {};
    dates.forEach(dateKey => {
        const dayTags = tags[dateKey] || {};
        Object.values(dayTags).forEach(mealTags => {
            mealTags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });
    });
    
    const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (sortedTags.length === 0) {
        document.getElementById('common-tags').textContent = 'No tags';
    } else {
        document.getElementById('common-tags').innerHTML = sortedTags
            .map(([tag, count]) => `<div style="font-size: 0.9rem;">${tag} (${count}×)</div>`)
            .join('');
    }
    
    // Check-in rate
    const daysWithData = dates.filter(dateKey => {
        const dayMoods = moods[dateKey] || {};
        return Object.keys(dayMoods).length > 0;
    }).length;
    
    const rate = Math.round((daysWithData / dates.length) * 100);
    document.getElementById('checkin-rate').textContent = `${rate}% (${daysWithData}/${dates.length} days)`;
}

function exportData() {
    const data = {
        moods: getAllMoods(),
        notes: getAllNotes(),
        tags: getAllTags(),
        journal: getAllJournalEntries(),
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mood-tracker-export-${getDateKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            
            let iconSrc;
            if (avg > 0.3) iconSrc = 'good.png';
            else if (avg < -0.3) iconSrc = 'bad.png';
            else iconSrc = 'neutral.png';
            
            const indicator = document.createElement('img');
            indicator.className = 'mood-indicator';
            indicator.src = iconSrc;
            indicator.alt = 'mood';
            
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
    const tags = getTagsForDate(date);
    const dateKey = getDateKey(date);
    
    const detail = document.getElementById('day-detail');
    const dateDisplay = document.getElementById('detail-date');
    const moodsDisplay = document.getElementById('detail-moods');
    const notesDisplay = document.getElementById('detail-notes');
    
    dateDisplay.textContent = formatDate(date);
    
    // Display moods
    moodsDisplay.innerHTML = '<h4>Moods</h4>';
    const moodIcons = { good: 'good.png', neutral: 'neutral.png', bad: 'bad.png' };
    const moodLabels = { good: 'Good', neutral: 'Neutral', bad: 'Bad' };
    
    if (Object.keys(moods).length === 0) {
        moodsDisplay.innerHTML += '<p style="color: var(--text-light); margin-top: 0.5rem;">No check-ins for this day</p>';
    } else {
        ['breakfast', 'lunch', 'dinner'].forEach(meal => {
            if (moods[meal]) {
                const item = document.createElement('div');
                item.className = 'detail-mood-item';
                
                let tagsHtml = '';
                if (tags[meal] && tags[meal].length > 0) {
                    tagsHtml = `<div style="font-size: 0.85rem; color: var(--text-light); margin-top: 0.25rem;">Tags: ${tags[meal].join(', ')}</div>`;
                }
                
                item.innerHTML = `
                    <div>
                        <span style="text-transform: capitalize; font-weight: 500;">${meal}</span>
                        ${tagsHtml}
                    </div>
                    <span style="display: flex; align-items: center; gap: 0.5rem;">
                        <img src="${moodIcons[moods[meal]]}" alt="${moodLabels[moods[meal]]}" style="width: 24px; height: 24px;">
                        ${moodLabels[moods[meal]]}
                    </span>
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
        currentPhotos = [];
        showJournalEditor();
    });
    
    document.getElementById('close-editor').addEventListener('click', closeJournalEditor);
    document.getElementById('cancel-entry').addEventListener('click', closeJournalEditor);
    document.getElementById('save-entry').addEventListener('click', saveJournalEntry);
    document.getElementById('delete-entry').addEventListener('click', deleteJournalEntry);
    
    document.getElementById('add-photo-btn').addEventListener('click', () => {
        document.getElementById('photo-input').click();
    });
    
    document.getElementById('photo-input').addEventListener('change', handlePhotoUpload);
    
    document.getElementById('journal-search').addEventListener('input', debounce(searchJournal, 300));
}

function handlePhotoUpload(e) {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            currentPhotos.push(event.target.result);
            renderPhotoPreview();
        };
        reader.readAsDataURL(file);
    });
    
    e.target.value = '';
}

function renderPhotoPreview() {
    const preview = document.getElementById('photo-preview');
    preview.innerHTML = '';
    
    currentPhotos.forEach((photo, index) => {
        const item = document.createElement('div');
        item.className = 'photo-preview-item';
        item.innerHTML = `
            <img src="${photo}" alt="Photo ${index + 1}">
            <button class="photo-remove-btn" onclick="removePhoto(${index})">×</button>
        `;
        preview.appendChild(item);
    });
}

function removePhoto(index) {
    currentPhotos.splice(index, 1);
    renderPhotoPreview();
}

// Make removePhoto globally accessible
window.removePhoto = removePhoto;

function showJournalEditor(entry = null) {
    const editor = document.getElementById('journal-editor');
    const titleInput = document.getElementById('entry-title');
    const contentInput = document.getElementById('entry-content');
    const deleteBtn = document.getElementById('delete-entry');
    
    if (entry) {
        currentEditingEntry = entry;
        titleInput.value = entry.title || '';
        contentInput.value = entry.content || '';
        currentPhotos = entry.photos || [];
        renderPhotoPreview();
        deleteBtn.classList.remove('hidden');
    } else {
        titleInput.value = '';
        contentInput.value = '';
        currentPhotos = [];
        renderPhotoPreview();
        deleteBtn.classList.add('hidden');
    }
    
    editor.classList.remove('hidden');
    titleInput.focus();
}

function closeJournalEditor() {
    document.getElementById('journal-editor').classList.add('hidden');
    currentEditingEntry = null;
    currentPhotos = [];
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
                title: title || 'Untitled',
                content,
                photos: currentPhotos,
                updatedAt: new Date().toISOString()
            };
        }
    } else {
        // Create new entry
        const newEntry = {
            id: Date.now().toString(),
            title: title || 'Untitled',
            content,
            photos: currentPhotos,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        entries.unshift(newEntry);
    }
    
    localStorage.setItem(STORAGE_KEYS.JOURNAL, JSON.stringify(entries));
    closeJournalEditor();
    renderJournalEntries();
}

function deleteJournalEntry() {
    if (!currentEditingEntry) return;
    
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    const entries = getAllJournalEntries();
    const filtered = entries.filter(e => e.id !== currentEditingEntry.id);
    
    localStorage.setItem(STORAGE_KEYS.JOURNAL, JSON.stringify(filtered));
    closeJournalEditor();
    renderJournalEntries();
}

function getAllJournalEntries() {
    const stored = localStorage.getItem(STORAGE_KEYS.JOURNAL);
    return stored ? JSON.parse(stored) : [];
}

function searchJournal(e) {
    const query = e.target.value.toLowerCase().trim();
    
    if (!query) {
        renderJournalEntries();
        return;
    }
    
    const entries = getAllJournalEntries();
    const filtered = entries.filter(entry => 
        entry.title.toLowerCase().includes(query) || 
        entry.content.toLowerCase().includes(query)
    );
    
    renderJournalEntries(filtered);
}

function renderJournalEntries(entries = null) {
    const entriesToRender = entries || getAllJournalEntries();
    const container = document.getElementById('journal-entries');
    
    if (entriesToRender.length === 0) {
        const message = entries ? 'No entries match your search' : 'No journal entries yet';
        const subtext = entries ? 'Try a different search term' : 'Tap "New Entry" to start writing';
        container.innerHTML = `
            <div class="empty-state">
                <h3>${message}</h3>
                <p>${subtext}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    entriesToRender.forEach(entry => {
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
        
        let photosHtml = '';
        if (entry.photos && entry.photos.length > 0) {
            photosHtml = `
                <div class="entry-photos">
                    ${entry.photos.slice(0, 4).map(photo => `
                        <div class="entry-photo"><img src="${photo}" alt="Entry photo"></div>
                    `).join('')}
                </div>
            `;
        }
        
        entryEl.innerHTML = `
            <div class="entry-header">
                <div class="entry-title">${entry.title}</div>
                <div class="entry-date">${dateStr}</div>
            </div>
            <div class="entry-preview">${entry.content}</div>
            ${photosHtml}
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
