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
    renderTrends();
    initThemeSwitcher();
    
    // Export button
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }
}

// --- UTILS & STORAGE ---
function getDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Helper to handle multiple logs per day
function getMoodData() {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEYS.MOODS) || '{}');
    // Migration: If old data is a single object, wrap it in an array
    Object.keys(data).forEach(key => {
        if (!Array.isArray(data[key])) {
            data[key] = [data[key]];
        }
    });
    return data;
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
            
            if(e.target.dataset.tab === 'trends') renderTrends();
        });
    });
}

// --- CALENDAR & MULTI-LOG LOGIC ---
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
    const moods = getMoodData();
    const dateKey = getDateKey(date);
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.textContent = date.getDate();

    if (moods[dateKey] && moods[dateKey].length > 0) {
        dayEl.classList.add('has-mood');
        
        // Calculate Average Mood for the Day
        const scores = { good: 3, neutral: 2, bad: 1 };
        const total = moods[dateKey].reduce((acc, curr) => acc + (scores[curr.mood] || 2), 0);
        const avg = total / moods[dateKey].length;
        
        if (avg >= 2.5) dayEl.style.color = '#4CAF50'; // Good
        else if (avg >= 1.5) dayEl.style.color = '#FF9800'; // Neutral
        else dayEl.style.color = '#F44336'; // Bad
    }
    
    dayEl.addEventListener('click', () => showDayDetail(date));
    container.appendChild(dayEl);
}

function showDayDetail(date) {
    const dateKey = getDateKey(date);
    const moods = getMoodData();
    const dayLogs = moods[dateKey] || [];
    
    document.getElementById('detail-date').textContent = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    if (dayLogs.length === 0) {
        document.getElementById('detail-moods').innerHTML = `<p>No moods recorded.</p>`;
        document.getElementById('detail-notes').innerHTML = '';
    } else {
        // Build a list of all logs for that day
        const logsHtml = dayLogs.map(log => {
            const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown Time';
            return `
                <div class="detail-item" style="border-bottom: 1px solid #eee; padding: 10px 0;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${time}</strong>
                        <span style="color: ${log.mood === 'good' ? '#4CAF50' : (log.mood === 'bad' ? '#F44336' : '#FF9800')}">
                            ${log.mood.toUpperCase()}
                        </span>
                    </div>
                    <div style="font-size: 0.85rem; color: #666; margin-top:4px;">
                        ${log.tags && log.tags.length > 0 ? 'Tags: ' + log.tags.join(', ') : 'No tags'}
                    </div>
                </div>
            `;
        }).join('');
        
        document.getElementById('detail-moods').innerHTML = logsHtml;
        document.getElementById('detail-notes').innerHTML = '';
    }
    
    document.getElementById('day-detail').classList.remove('hidden');
}

// --- TRENDS LOGIC ---
function renderTrends() {
    const moods = getMoodData();
    const moodCounts = { good: 0, neutral: 0, bad: 0 };
    const tagCounts = {};

    Object.values(moods).forEach(dayArray => {
        dayArray.forEach(entry => {
            if (moodCounts[entry.mood] !== undefined) moodCounts[entry.mood]++;
            if (entry.tags) {
                entry.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });
    });

    const entries = Object.keys(moodCounts).filter(k => moodCounts[k] > 0);
    const topMood = entries.length > 0 ? entries.reduce((a, b) => moodCounts[a] > moodCounts[b] ? a : b) : null;
    document.getElementById('top-mood-display').textContent = topMood ? topMood.toUpperCase() : "No data yet";

    const topTags = Object.entries(tagCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([tag, count]) => `${tag} (${count})`);

    document.getElementById('top-tags-display').textContent = topTags.length > 0 ? topTags.join(', ') : "No tags used yet";

    // Render the graph
    renderTrendGraph(moods);
}

function renderTrendGraph(allData) {
    const graphBars = document.getElementById('graph-bars');
    if (!graphBars) return;
    
    graphBars.innerHTML = '';

    // Get last 7 days
    const today = new Date();
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        last7Days.push(date);
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    last7Days.forEach(date => {
        const dateKey = getDateKey(date);
        const dayLogs = allData[dateKey] || [];
        
        // Count moods for this day
        const counts = { good: 0, neutral: 0, bad: 0 };
        dayLogs.forEach(log => {
            if (counts.hasOwnProperty(log.mood)) {
                counts[log.mood]++;
            }
        });

        const total = counts.good + counts.neutral + counts.bad;
        
        // Create bar
        const barContainer = document.createElement('div');
        barContainer.className = 'graph-bar';

        const barStack = document.createElement('div');
        barStack.className = 'bar-stack';
        
        if (total > 0) {
            // Calculate heights as percentages
            const maxHeight = 180; // pixels
            const totalHeight = Math.min(total * 40, maxHeight); // 40px per mood entry, capped
            
            ['good', 'neutral', 'bad'].forEach(mood => {
                if (counts[mood] > 0) {
                    const segment = document.createElement('div');
                    segment.className = `bar-segment ${mood}`;
                    const height = (counts[mood] / total) * totalHeight;
                    segment.style.height = `${height}px`;
                    barStack.appendChild(segment);
                }
            });
        } else {
            // Empty bar
            const segment = document.createElement('div');
            segment.className = 'bar-segment';
            segment.style.height = '4px';
            segment.style.background = 'var(--border)';
            barStack.appendChild(segment);
        }

        const label = document.createElement('div');
        label.className = 'bar-label';
        label.textContent = dayNames[date.getDay()];

        barContainer.appendChild(barStack);
        barContainer.appendChild(label);
        graphBars.appendChild(barContainer);
    });
}

// Theme switching
function initThemeSwitcher() {
    const savedTheme = localStorage.getItem('app-theme') || 'default';
    applyTheme(savedTheme);

    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.dataset.theme;
            applyTheme(theme);
            localStorage.setItem('app-theme', theme);
        });
    });
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.theme === theme);
    });
}

// Export data function
function exportData() {
    const data = {
        moods: getMoodData(),
        journal: JSON.parse(localStorage.getItem(STORAGE_KEYS.JOURNAL) || '[]'),
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


// --- JOURNAL LOGIC ---
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
            const tagsInput = document.getElementById('mood-tags');
            const tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);
            
            const moods = getMoodData();
            const dateKey = getDateKey(new Date());
            
            if (!moods[dateKey]) moods[dateKey] = [];
            
            moods[dateKey].push({ 
                mood, 
                tags, 
                timestamp: new Date().toISOString() 
            });
            
            localStorage.setItem(STORAGE_KEYS.MOODS, JSON.stringify(moods));
            
            // UI Cleanup
            tagsInput.value = '';
            alert('Mood Saved!');
            renderCalendar();
            calculateStreak();
            renderTrends();
        });
    });
}

function calculateStreak() {
    const moods = getMoodData();
    let streak = 0, check = new Date();
    check.setHours(0,0,0,0);
    while (moods[getDateKey(check)]) { 
        streak++; 
        check.setDate(check.getDate() - 1); 
    }
    document.getElementById('streak-counter').textContent = `🔥 ${streak} Day Streak`;
        }
