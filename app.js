const APP_VERSION = 1.3;

const STORAGE_KEYS = {
    MOODS: 'mood_tracker_moods',
    JOURNAL: 'mood_tracker_journal'
};

let currentDate = new Date();
let selectedDate = new Date();
let currentEditingEntry = null;
let isWeekView = false;
let currentPhotoBase64 = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.error);
});

function initApp() {
    updateCurrentDate();
    setupTabs();
    setupCheckIns();
    setupCalendar();
    setupJournal();
    setupExport();
    calculateStreak();
    renderTrends();
}

// --- UTILS ---
function formatDate(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function getDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function updateCurrentDate() {
    document.getElementById('current-date').textContent = formatDate(new Date());
}

// --- TABS ---
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(e.target.dataset.tab).classList.add('active');
            
            if(e.target.dataset.tab === 'trends') renderTrends();
        });
    });
}

// --- 1. STREAKS ---
function calculateStreak() {
    const moods = JSON.parse(localStorage.getItem(STORAGE_KEYS.MOODS) || '{}');
    const dates = Object.keys(moods).sort((a, b) => new Date(b) - new Date(a));
    
    let streak = 0;
    let today = new Date();
    today.setHours(0,0,0,0);
    
    let checkDate = new Date(today);
    let todayKey = getDateKey(today);
    
    // If today is missed, streak might still be alive from yesterday
    if (!moods[todayKey]) checkDate.setDate(checkDate.getDate() - 1);

    while (moods[getDateKey(checkDate)]) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
    }
    
    document.getElementById('streak-counter').textContent = `🔥 ${streak} Day Streak`;
}

// --- 2 & 7. CHECK INS & TAGS ---
function setupCheckIns() {
    const tagsInput = document.getElementById('mood-tags');
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
            const button = e.currentTarget;
            button.classList.add('selected');
            
            const mood = button.dataset.mood;
            const tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t !== "");
            
            const moods = JSON.parse(localStorage.getItem(STORAGE_KEYS.MOODS) || '{}');
            const todayKey = getDateKey(new Date());
            
            moods[todayKey] = { mood, tags, timestamp: new Date().toISOString() };
            localStorage.setItem(STORAGE_KEYS.MOODS, JSON.stringify(moods));
            
            calculateStreak(); // Update streak immediately
            alert('Check-in saved!');
        });
    });
}

// --- 3. EXPORT DATA ---
function setupExport() {
    document.getElementById('export-btn').addEventListener('click', () => {
        const data = {
            moods: JSON.parse(localStorage.getItem(STORAGE_KEYS.MOODS) || '{}'),
            journal: JSON.parse(localStorage.getItem(STORAGE_KEYS.JOURNAL) || '[]')
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MoodTracker_Export_${getDateKey(new Date())}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

// --- 4. WEEK/MONTH CALENDAR VIEW ---
function setupCalendar() {
    const viewBtn = document.getElementById('toggle-view-btn');
    viewBtn.addEventListener('click', () => {
        isWeekView = !isWeekView;
        viewBtn.textContent = isWeekView ? 'Month View' : 'Week View';
        renderCalendar();
    });
    
    document.getElementById('prev-month').addEventListener('click', () => {
        selectedDate.setMonth(selectedDate.getMonth() - 1);
        renderCalendar();
    });
    document.getElementById('next-month').addEventListener('click', () => {
        selectedDate.setMonth(selectedDate.getMonth() + 1);
        renderCalendar();
    });
    
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthLabel = document.getElementById('calendar-month');
    grid.innerHTML = '';
    
    monthLabel.textContent = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const moods = JSON.parse(localStorage.getItem(STORAGE_KEYS.MOODS) || '{}');
    
    let daysToRender = [];
    
    if (isWeekView) {
        // Find start of current week (Sunday)
        const currentDay = new Date(selectedDate);
        const firstDayOfWeek = new Date(currentDay.setDate(currentDay.getDate() - currentDay.getDay()));
        for (let i = 0; i < 7; i++) {
            daysToRender.push(new Date(firstDayOfWeek));
            firstDayOfWeek.setDate(firstDayOfWeek.getDate() + 1);
        }
    } else {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        for (let i = 0; i < firstDay.getDay(); i++) {
            daysToRender.push(null); // Empty slots
        }
        for (let i = 1; i <= lastDay.getDate(); i++) {
            daysToRender.push(new Date(year, month, i));
        }
    }
    
    daysToRender.forEach(date => {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        if (date) {
            dayEl.textContent = date.getDate();
            const dateKey = getDateKey(date);
            if (moods[dateKey]) {
                dayEl.classList.add('has-mood');
                // Optional: color code dot based on mood
                if(moods[dateKey].mood === 'bad') dayEl.style.setProperty('--primary', 'var(--bad)');
                if(moods[dateKey].mood === 'good') dayEl.style.setProperty('--primary', 'var(--good)');
            }
        }
        grid.appendChild(dayEl);
    });
}

// --- 5. TRENDS/PATTERNS ---
function renderTrends() {
    const moods = JSON.parse(localStorage.getItem(STORAGE_KEYS.MOODS) || '{}');
    let good = 0, neutral = 0, bad = 0;
    const tagCounts = {};
    
    // Look at last 30 days
    const today = new Date();
    for(let i=0; i<30; i++) {
        let d = new Date(today);
        d.setDate(d.getDate() - i);
        let key = getDateKey(d);
        if(moods[key]) {
            if(moods[key].mood === 'good') good++;
            if(moods[key].mood === 'neutral') neutral++;
            if(moods[key].mood === 'bad') bad++;
            
            if(moods[key].tags) {
                moods[key].tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        }
    }
    
    const total = good + neutral + bad;
    const chart = document.getElementById('mood-pie-chart');
    if (total === 0) {
        chart.innerHTML = "<p>Not enough data yet.</p>";
    } else {
        chart.innerHTML = `
            <div class="chart-bar"><span class="chart-bar-label">Good</span> <div class="chart-bar-fill fill-good" style="width: ${(good/total)*100}%">${good}</div></div>
            <div class="chart-bar"><span class="chart-bar-label">Neutral</span> <div class="chart-bar-fill fill-neutral" style="width: ${(neutral/total)*100}%">${neutral}</div></div>
            <div class="chart-bar"><span class="chart-bar-label">Bad</span> <div class="chart-bar-fill fill-bad" style="width: ${(bad/total)*100}%">${bad}</div></div>
        `;
    }
    
    const tagsList = document.getElementById('top-tags-list');
    tagsList.innerHTML = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5) // Top 5
        .map(([tag, count]) => `<span class="tag-badge">${tag} (${count})</span>`)
        .join(' ');
}

// --- 6. JOURNAL, SEARCH & PHOTOS ---
function setupJournal() {
    const newEntryBtn = document.getElementById('new-entry-btn');
    const closeEditorBtn = document.getElementById('close-editor');
    const cancelEntryBtn = document.getElementById('cancel-entry');
    const saveEntryBtn = document.getElementById('save-entry');
    const searchJournal = document.getElementById('search-journal');
    const entryPhoto = document.getElementById('entry-photo');

    if (newEntryBtn) newEntryBtn.addEventListener('click', () => openJournalEditor(null));
    if (closeEditorBtn) closeEditorBtn.addEventListener('click', closeJournalEditor);
    if (cancelEntryBtn) cancelEntryBtn.addEventListener('click', closeJournalEditor);
    if (saveEntryBtn) saveEntryBtn.addEventListener('click', saveJournalEntry);
    
    // Search
    if (searchJournal) {
        searchJournal.addEventListener('input', (e) => {
            renderJournalEntries(e.target.value.toLowerCase());
        });
    }
    
    // Photo handling & compression
    if (entryPhoto) {
        entryPhoto.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const MAX_WIDTH = 800;
                    let width = img.width;
                    let height = img.height;
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    currentPhotoBase64 = canvas.toDataURL('image/jpeg', 0.6); 
                    
                    const previewContainer = document.getElementById('photo-preview-container');
                    if (previewContainer) previewContainer.innerHTML = `<img src="${currentPhotoBase64}">`;
                }
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
    
    renderJournalEntries();
}

function openJournalEditor(entry = null) {
    currentEditingEntry = entry;
    
    const titleInput = document.getElementById('entry-title');
    const contentInput = document.getElementById('entry-content');
    const previewContainer = document.getElementById('photo-preview-container');
    const photoInput = document.getElementById('entry-photo');
    const editor = document.getElementById('journal-editor');

    if (titleInput) titleInput.value = entry ? (entry.title || '') : '';
    if (contentInput) contentInput.value = entry ? (entry.content || '') : '';
    
    currentPhotoBase64 = entry ? entry.photo : null;
    if (previewContainer) previewContainer.innerHTML = currentPhotoBase64 ? `<img src="${currentPhotoBase64}">` : '';
    if (photoInput) photoInput.value = '';
    
    if (editor) editor.classList.remove('hidden');
}

function closeJournalEditor() {
    const editor = document.getElementById('journal-editor');
    if (editor) editor.classList.add('hidden');
    currentEditingEntry = null;
    currentPhotoBase64 = null;
}

function saveJournalEntry() {
    const titleEl = document.getElementById('entry-title');
    const contentEl = document.getElementById('entry-content');
    const searchEl = document.getElementById('search-journal');
    
    const title = (titleEl ? titleEl.value.trim() : '') || 'Untitled';
    const content = contentEl ? contentEl.value.trim() : '';
    
    if (!content) {
        alert('Please write some content before saving.');
        return;
    }
    
    let entries = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOURNAL) || '[]');
    
    if (currentEditingEntry && currentEditingEntry.id) {
        const index = entries.findIndex(e => e.id === currentEditingEntry.id);
        if (index !== -1) {
            entries[index] = { ...entries[index], title, content, photo: currentPhotoBase64, updatedAt: new Date().toISOString() };
        }
    } else {
        entries.unshift({
            id: Date.now().toString(),
            title,
            content,
            photo: currentPhotoBase64,
            createdAt: new Date().toISOString()
        });
    }
    
    localStorage.setItem(STORAGE_KEYS.JOURNAL, JSON.stringify(entries));
    closeJournalEditor();
    
    const searchTerm = searchEl ? searchEl.value.toLowerCase() : '';
    renderJournalEntries(searchTerm);
}

function renderJournalEntries(searchTerm = '') {
    let entries = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOURNAL) || '[]');
    const container = document.getElementById('journal-entries');
    
    if (searchTerm) {
        entries = entries.filter(e => 
            e.title.toLowerCase().includes(searchTerm) || 
            e.content.toLowerCase().includes(searchTerm)
        );
    }
    
    if (entries.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>No entries found.</p></div>`;
        return;
    }
    
    container.innerHTML = '';
    
    entries.forEach(entry => {
        const entryEl = document.createElement('div');
        entryEl.className = 'journal-entry';
        
        const dateStr = new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        let photoHtml = entry.photo ? `<img src="${entry.photo}" class="entry-thumbnail">` : '';
        
        entryEl.innerHTML = `
            <div class="entry-header">
                <div class="entry-title">${entry.title}</div>
                <div class="entry-date">${dateStr}</div>
            </div>
            <div class="entry-preview">${entry.content.substring(0, 100)}${entry.content.length > 100 ? '...' : ''}</div>
            ${photoHtml}
        `;
        
        entryEl.addEventListener('click', () => openJournalEditor(entry));
        container.appendChild(entryEl);
    });
}
