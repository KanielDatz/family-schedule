// State Management
let appData = {
    packTime: '20:00',
    children: []
};

// Default Date tracking
let currentDateView = new Date();
let activeChildFilter = null; // null means all
let editingChildId = null;

// Initialize app
function init() {
    loadData();
    setupEventListeners();
    
    // Determine default date based on pack time
    const now = new Date();
    const [packHour, packMinute] = appData.packTime.split(':').map(Number);
    const packTimeDate = new Date();
    packTimeDate.setHours(packHour, packMinute, 0, 0);

    if (now >= packTimeDate) {
        // After pack time, default to tomorrow
        currentDateView.setDate(currentDateView.getDate() + 1);
    }
    
    updateDailyView();
}

// Data persistence
function loadData() {
    const saved = localStorage.getItem('familyScheduleData');
    if (saved) {
        appData = JSON.parse(saved);
        // Ensure data structures exist
        if (!appData.children) appData.children = [];
    }
}

function saveData() {
    localStorage.setItem('familyScheduleData', JSON.stringify(appData));
}

// Generators
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// --- DOM Elements ---
const btnSettings = document.getElementById('btn-settings');
const btnHome = document.getElementById('btn-home');
const viewDaily = document.getElementById('view-daily');
const viewSettings = document.getElementById('view-settings');
const displayDayName = document.getElementById('display-day-name');
const displayDate = document.getElementById('display-date');
const btnPrevDay = document.getElementById('btn-prev-day');
const btnNextDay = document.getElementById('btn-next-day');
const scheduleContainer = document.getElementById('schedule-container');
const packingListContainer = document.getElementById('packing-list-container');
const filterChildren = document.querySelector('.filter-children');
const packingForLabel = document.getElementById('packing-for-label');

// Settings Elements
const packTimeInput = document.getElementById('pack-time');
const childrenList = document.getElementById('settings-children-list');
const btnAddChild = document.getElementById('btn-add-child');

// Modal Elements
const modalEditChild = document.getElementById('modal-edit-child');
const btnCloseModal = document.getElementById('btn-close-child-modal');
const childNameInput = document.getElementById('child-name');
const childColorInput = document.getElementById('child-color');
const btnSaveChild = document.getElementById('btn-save-child');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const subjectsList = document.getElementById('subjects-list');
const btnAddSubject = document.getElementById('btn-add-subject');
const btnCopySubjects = document.getElementById('btn-copy-subjects');
const btnAddHoliday = document.getElementById('btn-add-holiday');
const btnCopyHolidays = document.getElementById('btn-copy-holidays');
const holidaysList = document.getElementById('holidays-list');
const scheduleGrid = document.getElementById('schedule-grid');


// --- Event Listeners ---
function setupEventListeners() {
    btnSettings.addEventListener('click', () => {
        viewDaily.classList.remove('view-active');
        viewDaily.classList.add('view-hidden');
        viewSettings.classList.remove('view-hidden');
        viewSettings.classList.add('view-active');
        btnSettings.classList.add('hidden');
        btnHome.classList.remove('hidden');
        renderSettings();
    });

    btnHome.addEventListener('click', () => {
        viewSettings.classList.remove('view-active');
        viewSettings.classList.add('view-hidden');
        viewDaily.classList.remove('view-hidden');
        viewDaily.classList.add('view-active');
        btnHome.classList.add('hidden');
        btnSettings.classList.remove('hidden');
        saveData();
        updateDailyView();
    });

    btnPrevDay.addEventListener('click', () => {
        currentDateView.setDate(currentDateView.getDate() - 1);
        updateDailyView();
    });

    btnNextDay.addEventListener('click', () => {
        currentDateView.setDate(currentDateView.getDate() + 1);
        updateDailyView();
    });

    packTimeInput.addEventListener('change', (e) => {
        appData.packTime = e.target.value;
        saveData();
    });

    btnAddChild.addEventListener('click', () => {
        openChildModal();
    });

    btnCloseModal.addEventListener('click', closeChildModal);
    
    btnSaveChild.addEventListener('click', saveChildData);

    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });

    btnAddSubject.addEventListener('click', () => {
        addSubjectRow();
    });
    
    btnCopySubjects.addEventListener('click', () => {
        copyDataDialog('subjects');
    });
    btnCopyHolidays.addEventListener('click', () => {
        copyDataDialog('holidays');
    });
    
    btnAddHoliday.addEventListener('click', () => {
        addHolidayRow();
    });
    
    // AI Import processing
    document.getElementById('btn-process-ai').addEventListener('click', () => {
        const inputStr = document.getElementById('ai-json-input').value;
        try {
            const data = JSON.parse(inputStr);
            if (data.name && !childNameInput.value) {
                childNameInput.value = data.name;
                currentModalChild.name = data.name;
            }
            
            // Is this a full child export?
            if (data.subjects && data.schedule && !Array.isArray(data.schedule)) {
                // Full export format (from this app)
                // Generate new IDs mapping to avoid collisions
                const idMap = {};
                data.subjects.forEach(s => {
                    const newId = generateId();
                    idMap[s.id] = newId;
                    s.id = newId;
                    currentModalChild.subjects.push(s);
                });
                
                // Copy schedule with new IDs
                Object.keys(data.schedule).forEach(day => {
                    if(!currentModalChild.schedule[day]) currentModalChild.schedule[day] = [];
                    data.schedule[day].forEach(entry => {
                        currentModalChild.schedule[day].push({
                            time: entry.time,
                            subjectId: idMap[entry.subjectId] || entry.subjectId
                        });
                    });
                });
                
                // Copy holidays
                if (data.holidays) {
                    currentModalChild.holidays = [...(currentModalChild.holidays || []), ...data.holidays];
                }
                
                renderModalSubjects();
                renderModalSchedule();
                renderModalHolidays();
                document.getElementById('ai-json-input').value = '';
                alert('המערכת המלאה יובאה בהצלחה!');
                
            } else if (data.schedule && Array.isArray(data.schedule)) {
                // AI Format
                let addedCount = 0;
                data.schedule.forEach(item => {
                    if (item.day >= 0 && item.day <= 6 && item.subject) {
                        let subj = currentModalChild.subjects.find(s => s.name === item.subject);
                        if (!subj) {
                            subj = { id: generateId(), name: item.subject, items: [] };
                            currentModalChild.subjects.push(subj);
                        }
                        
                        if (!currentModalChild.schedule[item.day]) currentModalChild.schedule[item.day] = [];
                        currentModalChild.schedule[item.day].push({
                            time: item.time || '08:00',
                            subjectId: subj.id
                        });
                        addedCount++;
                    }
                });
                
                renderModalSubjects();
                renderModalSchedule();
                document.getElementById('ai-json-input').value = '';
                alert(`יובאו בהצלחה ${addedCount} שיעורים מ-AI!`);
            } else {
                alert('ה-JSON אינו תקין או אינו מזוהה.');
            }
        } catch(e) {
            alert('שגיאה בקריאת ה-JSON. ודא שהעתקת אותו במלואו.');
            console.error(e);
        }
    });

    // Export processing
    document.getElementById('btn-export-child').addEventListener('click', () => {
        // Save current DOM state to object first so we export latest changes
        const subjectRows = subjectsList.querySelectorAll('.subject-item');
        let tempSubjects = [];
        subjectRows.forEach(row => {
            const id = row.dataset.id;
            const name = row.querySelector('.subject-name').value;
            const itemsStr = row.querySelector('.subject-items').value;
            if(name.trim()) {
                tempSubjects.push({
                    id: id,
                    name: name.trim(),
                    items: itemsStr.split(',').map(s => s.trim()).filter(s => s)
                });
            }
        });
        
        const tempHolidays = [];
        holidaysList.querySelectorAll('.holiday-item').forEach(row => {
            const date = row.querySelector('.holiday-date').value;
            const type = row.querySelector('.holiday-type').value;
            const desc = row.querySelector('.holiday-desc').value;
            if(date) tempHolidays.push({ date, type, desc });
        });

        const exportData = {
            name: childNameInput.value || currentModalChild.name,
            color: childColorInput.value || currentModalChild.color,
            subjects: tempSubjects,
            schedule: currentModalChild.schedule,
            holidays: tempHolidays
        };
        
        const jsonStr = JSON.stringify(exportData, null, 2);
        
        if (navigator.share) {
            navigator.share({
                title: 'מערכת שעות: ' + exportData.name,
                text: 'העתק את הקוד הבא לאפליקציית מערכת השעות:\n' + jsonStr
            }).catch(err => {
                // Fallback to clipboard
                navigator.clipboard.writeText(jsonStr);
                alert('הקוד הועתק! תוכל לשלוח אותו בוואטסאפ או במייל לחברים.');
            });
        } else {
            navigator.clipboard.writeText(jsonStr);
            alert('הקוד הועתק! תוכל לשלוח אותו בוואטסאפ או במייל לחברים.');
        }
    });

    // Packing list delegation for checkbox toggle
    packingListContainer.addEventListener('change', (e) => {
        if(e.target.type === 'checkbox') {
            const li = e.target.closest('.packing-item');
            if(e.target.checked) li.classList.add('checked');
            else li.classList.remove('checked');
        }
    });
}


// --- Daily View Logic ---
const daysOfWeek = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function updateDailyView() {
    // 1. Update Date Header
    const today = new Date();
    const isToday = currentDateView.toDateString() === today.toDateString();
    
    let dayLabel = daysOfWeek[currentDateView.getDay()];
    if (isToday) dayLabel = "היום (" + dayLabel + ")";
    
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (currentDateView.toDateString() === tomorrow.toDateString()) {
        dayLabel = "מחר (" + dayLabel + ")";
    }

    displayDayName.textContent = dayLabel;
    displayDate.textContent = currentDateView.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
    
    if (isToday) {
        packingForLabel.textContent = "ציוד להיום";
    } else if (currentDateView.toDateString() === tomorrow.toDateString()) {
        packingForLabel.textContent = "ציוד למחר";
    } else {
        packingForLabel.textContent = "ציוד ל-" + dayLabel;
    }

    // 2. Render Filters
    renderFilters();

    // 3. Gather Schedule and Packing Data
    const dayIndex = currentDateView.getDay();
    const dateString = currentDateView.toISOString().split('T')[0];
    
    let scheduleItems = [];
    let packingItemsMap = {}; // Maps item string -> array of child colors
    
    appData.children.forEach(child => {
        if (activeChildFilter && activeChildFilter !== child.id) return;
        
        // Check for holiday/short day
        const holiday = child.holidays?.find(h => h.date === dateString);
        let isFullHoliday = false;
        
        if (holiday) {
            if (holiday.type === 'full') {
                isFullHoliday = true;
                scheduleItems.push({
                    time: '08:00',
                    subjectName: 'חופש: ' + (holiday.desc || ''),
                    childName: child.name,
                    color: child.color,
                    isHoliday: true
                });
            } else {
                scheduleItems.push({
                    time: '08:00',
                    subjectName: 'יום קצר: ' + (holiday.desc || ''),
                    childName: child.name,
                    color: child.color,
                    isHoliday: true
                });
            }
        }
        
        if (!isFullHoliday && child.schedule && child.schedule[dayIndex]) {
            child.schedule[dayIndex].forEach(entry => {
                const subject = child.subjects.find(s => s.id === entry.subjectId);
                if (subject) {
                    scheduleItems.push({
                        time: entry.time || '',
                        subjectName: subject.name,
                        childName: child.name,
                        color: child.color
                    });
                    
                    // Add items to packing list
                    if (subject.items && subject.items.length > 0) {
                        subject.items.forEach(item => {
                            if(!item.trim()) return;
                            const key = item.trim();
                            if(!packingItemsMap[key]) packingItemsMap[key] = [];
                            packingItemsMap[key].push(child.color);
                        });
                    }
                }
            });
        }
    });

    // 4. Render Schedule
    // Sort by time
    scheduleItems.sort((a, b) => a.time.localeCompare(b.time));
    
    scheduleContainer.innerHTML = '';
    if (scheduleItems.length === 0) {
        scheduleContainer.innerHTML = '<div class="empty-state">אין לו"ז ליום זה</div>';
    } else {
        scheduleItems.forEach(item => {
            const el = document.createElement('div');
            el.className = 'schedule-item';
            el.style.borderRightColor = item.color;
            if (item.isHoliday) el.style.background = '#fff8e1';
            
            el.innerHTML = `
                <div class="item-time">${item.time}</div>
                <div class="item-details">
                    <div class="item-subject">${item.subjectName}</div>
                    <div class="item-child">${item.childName}</div>
                </div>
            `;
            scheduleContainer.appendChild(el);
        });
    }

    // 5. Render Packing List
    packingListContainer.innerHTML = '';
    const packingKeys = Object.keys(packingItemsMap);
    if (packingKeys.length === 0) {
        packingListContainer.innerHTML = '<div class="empty-state">אין ציוד לארוז היום איזה כיף!</div>';
    } else {
        packingKeys.forEach((itemText, i) => {
            const colors = packingItemsMap[itemText];
            // unique colors
            const uniqueColors = [...new Set(colors)];
            
            const li = document.createElement('li');
            li.className = 'packing-item';
            const id = 'pack-' + i;
            
            let colorDots = uniqueColors.map(c => `<span class="packing-child-indicator" style="background:${c}"></span>`).join('');
            
            li.innerHTML = `
                <input type="checkbox" id="${id}">
                <label for="${id}">${itemText} ${colorDots}</label>
            `;
            packingListContainer.appendChild(li);
        });
    }
}

function renderFilters() {
    filterChildren.innerHTML = '';
    
    const allChip = document.createElement('div');
    allChip.className = `child-chip ${activeChildFilter === null ? 'active' : ''}`;
    allChip.textContent = 'כולם';
    allChip.style.background = '#edf2f7';
    allChip.onclick = () => { activeChildFilter = null; updateDailyView(); };
    filterChildren.appendChild(allChip);

    appData.children.forEach(child => {
        const chip = document.createElement('div');
        chip.className = `child-chip ${activeChildFilter === child.id ? 'active' : ''}`;
        chip.textContent = child.name;
        chip.style.background = child.color + '40'; // 25% opacity background
        chip.style.borderColor = child.color;
        chip.style.color = '#000';
        chip.onclick = () => { activeChildFilter = child.id; updateDailyView(); };
        filterChildren.appendChild(chip);
    });
}


// --- Settings View Logic ---
function renderSettings() {
    packTimeInput.value = appData.packTime || '20:00';
    
    childrenList.innerHTML = '';
    appData.children.forEach(child => {
        const div = document.createElement('div');
        div.className = 'schedule-item'; // Reuse style
        div.style.borderRightColor = child.color;
        div.style.cursor = 'pointer';
        div.innerHTML = `
            <div class="item-details" style="display:flex; justify-content:space-between; align-items:center;">
                <div class="item-subject">${child.name}</div>
                <button class="icon-btn btn-delete-child" data-id="${child.id}"><i class="fas fa-trash" style="color:var(--danger)"></i></button>
            </div>
        `;
        // Edit on click
        div.querySelector('.item-subject').addEventListener('click', () => {
            openChildModal(child);
        });
        
        // Delete
        div.querySelector('.btn-delete-child').addEventListener('click', (e) => {
            e.stopPropagation();
            if(confirm(`למחוק את ${child.name}?`)) {
                appData.children = appData.children.filter(c => c.id !== child.id);
                saveData();
                renderSettings();
            }
        });
        
        childrenList.appendChild(div);
    });
}


// --- Modal Logic ---
let currentModalChild = null;

function openChildModal(child = null) {
    currentModalChild = child ? JSON.parse(JSON.stringify(child)) : {
        id: generateId(),
        name: '',
        color: '#4CAF50',
        subjects: [],
        schedule: {0:[], 1:[], 2:[], 3:[], 4:[], 5:[], 6:[]},
        holidays: []
    };
    
    document.getElementById('child-modal-title').textContent = child ? 'עריכת ' + child.name : 'הוספת ילד';
    childNameInput.value = currentModalChild.name;
    childColorInput.value = currentModalChild.color;
    
    renderModalSubjects();
    renderModalSchedule();
    renderModalHolidays();
    
    modalEditChild.classList.remove('view-hidden');
    
    // Reset tabs to first
    tabBtns[0].click();
}

function closeChildModal() {
    modalEditChild.classList.add('view-hidden');
}

function saveChildData() {
    currentModalChild.name = childNameInput.value || 'ללא שם';
    currentModalChild.color = childColorInput.value;
    
    // Gather subjects
    const subjectRows = subjectsList.querySelectorAll('.subject-item');
    currentModalChild.subjects = [];
    subjectRows.forEach(row => {
        const id = row.dataset.id;
        const name = row.querySelector('.subject-name').value;
        const itemsStr = row.querySelector('.subject-items').value;
        if(name.trim()) {
            currentModalChild.subjects.push({
                id: id,
                name: name.trim(),
                items: itemsStr.split(',').map(s => s.trim()).filter(s => s)
            });
        }
    });

    // Gather schedule (handled inside renderModalSchedule as they change it? No, gather it on save)
    // Actually, schedule is already being updated in currentModalChild as they interact.
    
    // Gather holidays
    const holidayRows = holidaysList.querySelectorAll('.holiday-item');
    currentModalChild.holidays = [];
    holidayRows.forEach(row => {
        const date = row.querySelector('.holiday-date').value;
        const type = row.querySelector('.holiday-type').value;
        const desc = row.querySelector('.holiday-desc').value;
        if(date) {
            currentModalChild.holidays.push({ date, type, desc });
        }
    });
    
    // Save to main data
    const idx = appData.children.findIndex(c => c.id === currentModalChild.id);
    if(idx > -1) {
        appData.children[idx] = currentModalChild;
    } else {
        appData.children.push(currentModalChild);
    }
    
    saveData();
    closeChildModal();
    renderSettings();
}

// Subjects
function renderModalSubjects() {
    subjectsList.innerHTML = '';
    currentModalChild.subjects.forEach(sub => {
        addSubjectRow(sub);
    });
}

function addSubjectRow(sub = {id: generateId(), name:'', items:[]}) {
    const tpl = document.getElementById('tpl-subject').content.cloneNode(true);
    const div = tpl.querySelector('.subject-item');
    div.dataset.id = sub.id;
    div.querySelector('.subject-name').value = sub.name;
    div.querySelector('.subject-items').value = sub.items.join(', ');
    
    div.querySelector('.btn-delete-subject').addEventListener('click', () => {
        div.remove();
        renderModalSchedule(); // Need to update schedule selects
    });
    
    subjectsList.appendChild(div);
}

// Schedule
function renderModalSchedule() {
    scheduleGrid.innerHTML = '';
    
    // We need current subjects to populate selects
    // Update currentModalChild.subjects temporarily based on DOM
    const subjectRows = subjectsList.querySelectorAll('.subject-item');
    let tempSubjects = [];
    subjectRows.forEach(row => {
        const id = row.dataset.id;
        const name = row.querySelector('.subject-name').value;
        if(name.trim()) tempSubjects.push({id, name});
    });

    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי']; // Usually no school sat
    
    days.forEach((dayName, index) => {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'schedule-day-block glass';
        dayDiv.style.marginBottom = '10px';
        dayDiv.style.padding = '10px';
        
        dayDiv.innerHTML = `<div style="font-weight:bold; margin-bottom:10px; display:flex; justify-content:space-between">
            <span>${dayName}</span>
            <button class="btn-primary btn-sm btn-add-sched" data-day="${index}"><i class="fas fa-plus"></i></button>
        </div>`;
        
        const listDiv = document.createElement('div');
        listDiv.className = 'sched-list';
        
        const entries = currentModalChild.schedule[index] || [];
        entries.forEach((entry, eIdx) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '5px';
            row.style.marginBottom = '5px';
            
            let options = tempSubjects.map(s => `<option value="${s.id}" ${s.id===entry.subjectId?'selected':''}>${s.name}</option>`).join('');
            
            row.innerHTML = `
                <input type="time" value="${entry.time}" style="width:100px" class="sched-time">
                <select class="sched-subj" style="flex:1">
                    <option value="">בחר...</option>
                    ${options}
                </select>
                <button class="icon-btn btn-del-sched"><i class="fas fa-trash"></i></button>
            `;
            
            // Listen to changes to update currentModalChild live
            row.querySelector('.sched-time').addEventListener('change', (e) => entry.time = e.target.value);
            row.querySelector('.sched-subj').addEventListener('change', (e) => entry.subjectId = e.target.value);
            row.querySelector('.btn-del-sched').addEventListener('click', () => {
                currentModalChild.schedule[index].splice(eIdx, 1);
                renderModalSchedule();
            });
            
            listDiv.appendChild(row);
        });
        
        dayDiv.appendChild(listDiv);
        
        dayDiv.querySelector('.btn-add-sched').addEventListener('click', () => {
            if(!currentModalChild.schedule[index]) currentModalChild.schedule[index] = [];
            currentModalChild.schedule[index].push({ time: '08:00', subjectId: '' });
            renderModalSchedule();
        });
        
        scheduleGrid.appendChild(dayDiv);
    });
}

// Holidays
function renderModalHolidays() {
    holidaysList.innerHTML = '';
    if(!currentModalChild.holidays) currentModalChild.holidays = [];
    currentModalChild.holidays.forEach(hol => addHolidayRow(hol));
}

function addHolidayRow(hol = {date:'', type:'full', desc:''}) {
    const div = document.createElement('div');
    div.className = 'holiday-item form-group';
    div.style.display = 'flex';
    div.style.gap = '5px';
    div.style.alignItems = 'center';
    
    div.innerHTML = `
        <input type="date" class="holiday-date" value="${hol.date}" style="flex:1">
        <select class="holiday-type" style="width:100px; padding:8px; border-radius:4px; border:1px solid #ccc;">
            <option value="full" ${hol.type==='full'?'selected':''}>חופש מלא</option>
            <option value="short" ${hol.type==='short'?'selected':''}>יום קצר</option>
        </select>
        <input type="text" class="holiday-desc" placeholder="תיאור (למשל: סוכות)" value="${hol.desc}" style="flex:1">
        <button class="icon-btn btn-del-hol"><i class="fas fa-trash"></i></button>
    `;
    
    div.querySelector('.btn-del-hol').addEventListener('click', () => div.remove());
    holidaysList.appendChild(div);
}

// Copy features
function copyDataDialog(type) {
    const otherChildren = appData.children.filter(c => c.id !== currentModalChild.id);
    if(otherChildren.length === 0) {
        alert('אין ילדים אחרים להעתיק מהם.');
        return;
    }
    
    let optionsStr = otherChildren.map(c => `${c.name} (${c.id})`).join('\n');
    let promptMsg = `העתק ${type === 'subjects' ? 'מקצועות' : 'חופשות'} מאיזה ילד?\n(אנא הקלד את שם הילד המדויק)\n\n${optionsStr}`;
    let res = prompt(promptMsg);
    
    if(res) {
        const sourceChild = otherChildren.find(c => c.name === res.trim());
        if(sourceChild) {
            if(type === 'subjects') {
                // To avoid ID collisions if they use same subjects, we generate new IDs for copied subjects
                const copiedSubjects = sourceChild.subjects.map(s => ({
                    id: generateId(),
                    name: s.name,
                    items: [...s.items]
                }));
                currentModalChild.subjects = [...currentModalChild.subjects, ...copiedSubjects];
                renderModalSubjects();
                alert('מקצועות הועתקו בהצלחה.');
            } else if (type === 'holidays') {
                const copiedHols = sourceChild.holidays.map(h => ({...h}));
                currentModalChild.holidays = [...(currentModalChild.holidays || []), ...copiedHols];
                renderModalHolidays();
                alert('חופשות הועתקו בהצלחה.');
            }
        } else {
            alert('ילד לא נמצא.');
        }
    }
}

// Boot
init();
