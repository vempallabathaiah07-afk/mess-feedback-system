(function() {
    // ---------- CONST ----------
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MEALS = ['Breakfast', 'Lunch', 'Dinner'];
    const RATING_OPTIONS = ['Bad', 'Average', 'Good', 'Excellent'];
    const RATING_COLORS = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db'];
    const RATING_LABELS = ['Bad', 'Average', 'Good', 'Excellent'];

    // ---------- STATE ----------
    let menuItems = {};
    let allFeedback = {};
    let currentStudent = { name: '', reg: '', dept: '' };
    let selectedDate = new Date();
    let currentRole = 'student';
    let detailDay = '', detailMeal = '';
    let itemCharts = {};
    let weeklyChart = null, monthlyChart = null;

    // DOM refs
    const loginPanel = document.getElementById('loginPanel');
    const mainApp = document.getElementById('mainApp');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginError = document.getElementById('loginError');
    const studentName = document.getElementById('studentName');
    const studentReg = document.getElementById('studentReg');
    const studentDept = document.getElementById('studentDept');
    const adminName = document.getElementById('adminName');
    const adminPass = document.getElementById('adminPass');
    const studentFields = document.getElementById('studentFields');
    const adminFields = document.getElementById('adminFields');
    const roleTabs = document.querySelectorAll('.role-tab');
    const displayName = document.getElementById('displayName');
    const displayRole = document.getElementById('displayRole');
    const displayDept = document.getElementById('displayDept');
    const displayReg = document.getElementById('displayReg');
    const singleDayContainer = document.getElementById('singleDayContainer');
    const datePicker = document.getElementById('weekDatePicker');
    const studentView = document.getElementById('studentView');
    const adminDashboard = document.getElementById('adminDashboard');
    const adminDeptFilter = document.getElementById('adminDeptFilter');
    const refreshBtn = document.getElementById('refreshDashboardBtn');
    const clearAllBtn = document.getElementById('clearAllDataBtn');
    const manageMenuBtn = document.getElementById('manageMenuBtn');
    const currentDateDisplay = document.getElementById('currentDateDisplay');
    const itemDeptLabel = document.getElementById('itemDeptLabel');
    const itemChartsGrid = document.getElementById('itemChartsGrid');
    const weeklyDeptLabel = document.getElementById('weeklyDeptLabel');
    const monthlyDeptLabel = document.getElementById('monthlyDeptLabel');

    const menuModal = document.getElementById('menuModal');
    const menuModalClose = document.getElementById('menuModalClose');
    const menuModalBody = document.getElementById('menuModalBody');
    const menuSaveBtn = document.getElementById('menuSaveBtn');
    const menuStatus = document.getElementById('menuStatus');

    const detailOverlay = document.getElementById('detailOverlay');
    const detailDayTitle = document.getElementById('detailDayTitle');
    const detailMealContainer = document.getElementById('detailMealContainer');
    const detailCloseBtn = document.getElementById('detailCloseBtn');
    const toastNotification = document.getElementById('toastNotification');

    // ---------- HELPERS ----------
    let toastTimeout = null;
    function showToast(message) {
        if (!toastNotification) return;
        toastNotification.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        toastNotification.classList.add('active');
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toastNotification.classList.remove('active');
        }, 3500);
    }

    function getLocalDateString(date) {
        const d = new Date(date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const rDay = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${rDay}`;
    }

    function formatDate(date) {
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function getWeekKey(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        const start = new Date(d.getFullYear(), d.getMonth(), diff);
        return getLocalDateString(start);
    }

    function getTodayStr() {
        return getLocalDateString(new Date());
    }

    function getMonthKey(date) {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    // ---------- API CALLS ----------
    async function apiGetMenu() {
        try {
            const res = await fetch('/api/menu');
            menuItems = await res.json();
        } catch(e) {
            console.error("Error fetching menu:", e);
        }
    }

    async function apiSaveMenu() {
        try {
            await fetch('/api/menu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(menuItems)
            });
        } catch(e) {
            console.error("Error saving menu:", e);
        }
    }

    async function apiGetFeedback(dept = "all") {
        try {
            const res = await fetch(`/api/feedback?dept=${dept}`);
            allFeedback = await res.json();
        } catch(e) {
            console.error("Error fetching feedback:", e);
        }
    }

    async function apiSaveFeedback(feedbackData) {
        try {
            const reg = currentStudent.reg;
            await fetch(`/api/feedback/${reg}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: currentStudent.name,
                    dept: currentStudent.dept,
                    week_key: getWeekKey(selectedDate),
                    feedback_data: feedbackData
                })
            });
        } catch(e) {
            console.error("Error saving feedback:", e);
        }
    }

    async function apiClearAll() {
        try {
            await fetch('/api/clear-all', { method: 'POST' });
        } catch(e) {
            console.error("Error clearing all data:", e);
        }
    }

    function loadCurrentStudentFeedback() {
        const reg = currentStudent.reg;
        if (!reg || reg === 'admin') return {};
        const student = allFeedback[reg];
        const weekKey = getWeekKey(selectedDate);
        if (student && student.weeks && student.weeks[weekKey]) {
            return student.weeks[weekKey];
        }
        return {};
    }

    // ---------- CLEAR ALL DATA ----------
    async function clearAllData() {
        if (confirm('⚠️ Are you sure you want to delete ALL feedback data? This action cannot be undone!')) {
            await apiClearAll();
            await apiGetMenu();
            await apiGetFeedback();
            
            if (currentRole === 'student') {
                renderStudentDay();
            } else {
                updateAdminDashboard();
            }
            
            alert('✅ All data has been cleared and reset to default menu!');
        }
    }

    // ---------- MENU MANAGEMENT ----------
    function openMenuModal() {
        menuModal.classList.add('active');
        renderMenuModal();
        menuStatus.textContent = '';
    }

    function closeMenuModal() {
        menuModal.classList.remove('active');
    }

    function renderMenuModal() {
        let html = '<div class="menu-grid">';
        for (let day of DAYS) {
            html += `<div class="menu-day-card">`;
            html += `<div class="menu-day-title">${day}</div>`;
            for (let meal of MEALS) {
                const items = menuItems[day]?.[meal] || [];
                const itemsStr = items.join(', ');
                html += `
                    <div class="menu-meal-group">
                        <span class="menu-meal-label">${meal}</span>
                        <input class="menu-meal-input" data-day="${day}" data-meal="${meal}" value="${itemsStr}" placeholder="Enter food items (comma separated)">
                    </div>
                `;
            }
            html += `</div>`;
        }
        html += '</div>';
        menuModalBody.innerHTML = html;
    }

    async function saveMenuFromModal() {
        const inputs = menuModalBody.querySelectorAll('.menu-meal-input');
        let newMenu = {};
        
        inputs.forEach(input => {
            const day = input.dataset.day;
            const meal = input.dataset.meal;
            const value = input.value.trim();
            if (!newMenu[day]) newMenu[day] = {};
            if (value) {
                newMenu[day][meal] = value.split(',').map(item => item.trim()).filter(item => item !== '');
            } else {
                newMenu[day][meal] = [];
            }
        });

        menuItems = newMenu;
        await apiSaveMenu();
        
        menuStatus.textContent = '✅ Menu updated successfully!';
        menuStatus.style.color = '#2a6b4a';
        
        if (currentRole === 'student') {
            renderStudentDay();
        } else {
            await apiGetFeedback(adminDeptFilter.value);
            updateAdminDashboard();
        }
        
        setTimeout(() => {
            menuStatus.textContent = '';
        }, 3000);
    }

    // ---------- RENDER STUDENT DAY (Single Day) ----------
    function renderStudentDay() {
        const dateObj = new Date(selectedDate);
        const dayName = DAYS[dateObj.getDay()];
        const dateStr = formatDate(dateObj);
        const isToday = (dateObj.toDateString() === new Date().toDateString());

        const dayFeedback = loadCurrentStudentFeedback()[dayName] || {};
        const dayItems = menuItems[dayName] || { Breakfast: [], Lunch: [], Dinner: [] };

        let mealHtml = '';
        let hasItems = false;

        for (let meal of MEALS) {
            const items = dayItems[meal] || [];
            const itemFeedback = dayFeedback[meal] || {};
            const ratedCount = Object.keys(itemFeedback).filter(k => itemFeedback[k]).length;
            const totalItems = items.length;
            const summary = ratedCount > 0 ? `${ratedCount}/${totalItems} rated` : '';

            if (items.length > 0) hasItems = true;

            mealHtml += `
                <div class="meal-item" data-day="${dayName}" data-meal="${meal}">
                    <span class="meal-label">${meal}</span>
                    <span class="meal-food">${items.length > 0 ? items.join(', ') : '—'}</span>
                    <div class="feedback-summary">
                        ${summary ? `<span class="rating-badge">${summary}</span>` : ''}
                    </div>
                </div>
            `;
        }

        if (!hasItems) {
            mealHtml = `<div class="no-items-msg"><i class="fas fa-utensils" style="color:#6a859b; font-size:2rem; display:block; margin-bottom:0.5rem;"></i>No menu items added for this day. Check back later.</div>`;
        }

        const todayClass = isToday ? 'today' : '';

        singleDayContainer.innerHTML = `
            <div class="day-card-large ${todayClass}">
                <div class="day-name">${dayName}</div>
                <div class="day-date">${dateStr}</div>
                <div class="meal-block">${mealHtml}</div>
            </div>
        `;

        document.querySelectorAll('.day-card-large .meal-item').forEach(item => {
            item.addEventListener('click', function(e) {
                const day = this.dataset.day;
                const meal = this.dataset.meal;
                if (currentRole === 'student') {
                    openStudentDetail(day, meal);
                }
            });
        });
    }

    // ---------- STUDENT DETAIL ----------
    function openStudentDetail(day, meal) {
        detailDay = day;
        detailMeal = meal;
        detailDayTitle.textContent = `${day} · ${meal}`;

        const items = menuItems[day]?.[meal] || [];
        const mealFeedback = loadCurrentStudentFeedback()[day]?.[meal] || {};

        let itemsHtml = '';
        items.forEach(item => {
            const currentRating = mealFeedback[item] || null;
            let ratingBtns = RATING_OPTIONS.map(opt => {
                const selected = (currentRating === opt) ? 'selected' : '';
                return `<button class="${selected}" data-item="${item}" data-rating="${opt}">${opt}</button>`;
            }).join('');

            itemsHtml += `
                <div class="detail-item-row" data-item="${item}">
                    <span class="detail-item-name"><i class="fas fa-utensil-spoon"></i> ${item}</span>
                    <div class="detail-item-rating">${ratingBtns}</div>
                </div>
            `;
        });

        const noItemsMsg = (items.length === 0) ? 
            `<div style="text-align:center; color:#6a859b; padding:1rem; background:#f5f9fe; border-radius:1.5rem;">No items added yet. Check back later.</div>` : '';

        detailMealContainer.innerHTML = `
            <div class="detail-meal-name">${meal}</div>
            <div class="detail-items-container">
                ${items.length > 0 ? itemsHtml : noItemsMsg}
            </div>
            <div id="detailFeedbackStatus" class="detail-feedback-status"></div>
            ${items.length > 0 ? `<button class="detail-submit" id="detailSubmitBtn"><i class="fas fa-check"></i> Save Ratings</button>` : ''}
        `;

        detailOverlay.classList.add('active');

        if (items.length > 0) {
            document.querySelectorAll('.detail-item-rating button').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    const parent = this.closest('.detail-item-rating');
                    if (this.classList.contains('selected')) {
                        this.classList.remove('selected');
                    } else {
                        parent.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
                        this.classList.add('selected');
                    }
                });
            });

            document.getElementById('detailSubmitBtn').addEventListener('click', async function() {
                const savedDay = detailDay;
                const savedMeal = detailMeal;
                let feedbackData = loadCurrentStudentFeedback();
                if (!feedbackData[savedDay]) feedbackData[savedDay] = {};
                if (!feedbackData[savedDay][savedMeal]) feedbackData[savedDay][savedMeal] = {};

                document.querySelectorAll('.detail-item-row').forEach(row => {
                    const itemName = row.dataset.item;
                    const selected = row.querySelector('.detail-item-rating button.selected');
                    if (selected) {
                        feedbackData[savedDay][savedMeal][itemName] = selected.dataset.rating;
                    } else {
                        delete feedbackData[savedDay][savedMeal][itemName];
                    }
                });

                await apiSaveFeedback(feedbackData);
                await apiGetFeedback(); // Refresh memory values
                closeDetail(); // Automatically close modal without pressing into (X) mark
                renderStudentDay(); // Open specific day menu screen automatically
                showToast(`Ratings saved successfully for ${savedDay} · ${savedMeal}!`);
            });
        }
    }

    function closeDetail() {
        detailOverlay.classList.remove('active');
    }

    // ---------- ADMIN DASHBOARD (Item-wise, Weekly, Monthly Pie Charts with Department Filter) ----------
    function updateAdminDashboard() {
        const deptFilter = adminDeptFilter.value;
        
        const now = selectedDate || new Date();
        currentDateDisplay.textContent = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

        const deptDisplayName = deptFilter === 'all' ? 'All Departments' : deptFilter;
        if (itemDeptLabel) itemDeptLabel.textContent = `Showing: ${deptDisplayName}`;
        if (weeklyDeptLabel) weeklyDeptLabel.textContent = `Showing: ${deptDisplayName}`;
        if (monthlyDeptLabel) monthlyDeptLabel.textContent = `Showing: ${deptDisplayName}`;

        const weekKey = getWeekKey(now);
        const monthKey = getMonthKey(now);
        const selectedDayName = DAYS[now.getDay()];

        let weeklyRatings = { Bad: 0, Average: 0, Good: 0, Excellent: 0 };
        let monthlyRatings = { Bad: 0, Average: 0, Good: 0, Excellent: 0 };

        for (let reg in allFeedback) {
            const student = allFeedback[reg];
            
            for (let wk in student.weeks) {
                const weekData = student.weeks[wk];
                if (!weekData) continue;

                const wkParts = wk.split('-');
                const wkDate = new Date(parseInt(wkParts[0], 10), parseInt(wkParts[1], 10) - 1, parseInt(wkParts[2], 10));
                const wkMonthKey = getMonthKey(wkDate);
                const isCurrentWeek = (wk === weekKey);
                const isCurrentMonth = (wkMonthKey === monthKey);

                for (let day of DAYS) {
                    const dayFb = weekData[day] || {};
                    for (let meal of MEALS) {
                        const mealFb = dayFb[meal] || {};
                        for (let item in mealFb) {
                            const rating = mealFb[item];
                            if (rating) {
                                if (isCurrentWeek && weeklyRatings[rating] !== undefined) {
                                    weeklyRatings[rating]++;
                                }
                                if (isCurrentMonth && monthlyRatings[rating] !== undefined) {
                                    monthlyRatings[rating]++;
                                }
                            }
                        }
                    }
                }
            }
        }

        document.getElementById('badCount').textContent = weeklyRatings.Bad;
        document.getElementById('averageCount').textContent = weeklyRatings.Average;
        document.getElementById('goodCount').textContent = weeklyRatings.Good;
        document.getElementById('excellentCount').textContent = weeklyRatings.Excellent;

        function createPieChart(ctx, data) {
            const total = data.Bad + data.Average + data.Good + data.Excellent;
            const percentages = [
                total > 0 ? ((data.Bad / total) * 100).toFixed(1) : 0,
                total > 0 ? ((data.Average / total) * 100).toFixed(1) : 0,
                total > 0 ? ((data.Good / total) * 100).toFixed(1) : 0,
                total > 0 ? ((data.Excellent / total) * 100).toFixed(1) : 0
            ];

            const labels = RATING_LABELS.map((label, i) => 
                `${label} (${percentages[i]}%)`
            );

            return new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: [data.Bad, data.Average, data.Good, data.Excellent],
                        backgroundColor: RATING_COLORS,
                        borderColor: '#ffffff',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 10,
                                font: { size: 11 }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                    return `${context.label}: ${context.parsed} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Render Item-wise Pie Charts
        for (let key in itemCharts) {
            if (itemCharts[key]) itemCharts[key].destroy();
        }
        itemCharts = {};

        const selectedDayItems = menuItems[selectedDayName] || {};
        let itemDataList = [];

        for (let meal of MEALS) {
            const items = selectedDayItems[meal] || [];
            for (let item of items) {
                let ratings = { Bad: 0, Average: 0, Good: 0, Excellent: 0 };
                for (let reg in allFeedback) {
                    const student = allFeedback[reg];
                    for (let wk in student.weeks) {
                        if (wk === weekKey) {
                            const dayFb = student.weeks[wk]?.[selectedDayName] || {};
                            const mealFb = dayFb[meal] || {};
                            const r = mealFb[item];
                            if (r && ratings[r] !== undefined) {
                                ratings[r]++;
                            }
                        }
                    }
                }
                itemDataList.push({ day: selectedDayName, meal, item, ratings });
            }
        }

        if (itemChartsGrid) {
            if (itemDataList.length === 0) {
                itemChartsGrid.innerHTML = `<div class="no-feedback-msg"><i class="fas fa-info-circle"></i> No menu items added for ${selectedDayName}.</div>`;
            } else {
                let html = '';
                itemDataList.forEach((dataObj, index) => {
                    const canvasId = `itemChart_${index}`;
                    html += `
                        <div class="item-chart-card">
                            <div class="item-name">${dataObj.item}</div>
                            <div class="item-meal">${dataObj.meal}</div>
                            <div class="item-chart-wrapper">
                                <canvas id="${canvasId}" height="180"></canvas>
                            </div>
                        </div>
                    `;
                });
                itemChartsGrid.innerHTML = html;

                itemDataList.forEach((dataObj, index) => {
                    const canvasId = `itemChart_${index}`;
                    const canvasEl = document.getElementById(canvasId);
                    if (canvasEl) {
                        const ctx = canvasEl.getContext('2d');
                        itemCharts[canvasId] = createPieChart(ctx, dataObj.ratings);
                    }
                });
            }
        }

        const weeklyCtx = document.getElementById('weeklyChart')?.getContext('2d');
        if (weeklyCtx) {
            if (weeklyChart) weeklyChart.destroy();
            weeklyChart = createPieChart(weeklyCtx, weeklyRatings);
        }

        const monthlyCtx = document.getElementById('monthlyChart')?.getContext('2d');
        if (monthlyCtx) {
            if (monthlyChart) monthlyChart.destroy();
            monthlyChart = createPieChart(monthlyCtx, monthlyRatings);
        }
    }



    // ---------- LOGIN / LOGOUT ----------
    async function handleLogin() {
        const role = currentRole;
        if (role === 'student') {
            const name = studentName.value.trim();
            const reg = studentReg.value.trim();
            const dept = studentDept.value;
            if (!name || !reg || !dept) {
                loginError.textContent = '⚠️ Enter Name, Registration Number, and select Department.';
                return;
            }
            loginError.textContent = '';
            currentStudent = { name, reg, dept };
            displayName.textContent = name;
            displayRole.textContent = 'Student';
            displayDept.textContent = dept;
            displayReg.textContent = reg;
            
            studentView.style.display = 'block';
            adminDashboard.style.display = 'none';
        } else {
            const name = adminName.value.trim();
            const pass = adminPass.value.trim();
            if (!name || !pass) {
                loginError.textContent = '⚠️ Enter Admin Name and Password.';
                return;
            }
            if (name !== 'admin@pec' || pass !== 'pecmess@1110') {
                loginError.textContent = '⚠️ Invalid admin username or password.';
                return;
            }
            loginError.textContent = '';
            currentStudent = { name: name, reg: 'admin', dept: 'Admin' };
            displayName.textContent = name;
            displayRole.textContent = 'Admin';
            displayDept.textContent = 'Admin';
            displayReg.textContent = '—';
            
            studentView.style.display = 'none';
            adminDashboard.style.display = 'block';
        }

        datePicker.value = getLocalDateString(selectedDate);

        // Fetch data from backend API
        await apiGetMenu();
        await apiGetFeedback(role === 'student' ? 'all' : adminDeptFilter.value);
        
        if (currentRole === 'student') {
            renderStudentDay();
        } else {
            updateAdminDashboard();
        }

        loginPanel.style.display = 'none';
        mainApp.style.display = 'block';
    }

    function handleLogout() {
        loginPanel.style.display = 'flex';
        mainApp.style.display = 'none';
        currentStudent = { name: '', reg: '', dept: '' };
        closeDetail();
        closeMenuModal();
    }

    // ---------- ROLE TAB ----------
    roleTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            roleTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentRole = this.dataset.role;
            if (currentRole === 'student') {
                studentFields.style.display = 'block';
                adminFields.style.display = 'none';
            } else {
                studentFields.style.display = 'none';
                adminFields.style.display = 'block';
            }
            loginError.textContent = '';
        });
    });

    // ---------- INIT ----------
    async function init() {
        loginBtn.addEventListener('click', handleLogin);
        logoutBtn.addEventListener('click', handleLogout);

        detailCloseBtn.addEventListener('click', closeDetail);
        detailOverlay.addEventListener('click', function(e) {
            if (e.target === this) closeDetail();
        });
        refreshBtn.addEventListener('click', async () => {
            await apiGetFeedback(adminDeptFilter.value);
            updateAdminDashboard();
        });
        clearAllBtn.addEventListener('click', clearAllData);
        manageMenuBtn.addEventListener('click', openMenuModal);
        menuModalClose.addEventListener('click', closeMenuModal);
        menuModal.addEventListener('click', function(e) {
            if (e.target === this) closeMenuModal();
        });
        menuSaveBtn.addEventListener('click', saveMenuFromModal);
        
        datePicker.value = getLocalDateString(selectedDate);

        // Auto-update charts when department filter changes
        adminDeptFilter.addEventListener('change', async () => {
            await apiGetFeedback(adminDeptFilter.value);
            updateAdminDashboard();
        });

        // Date picker change listener
        datePicker.addEventListener('change', function() {
            if (this.value) {
                const parts = this.value.split('-');
                selectedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                if (currentRole === 'student') {
                    renderStudentDay();
                } else {
                    updateAdminDashboard();
                }
            }
        });

        document.querySelectorAll('#studentName, #studentReg, #studentDept, #adminName, #adminPass').forEach(el => {
            el.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
        });

        // Pre-fetch menu on page load
        await apiGetMenu();

        currentRole = 'student';
        studentFields.style.display = 'block';
        adminFields.style.display = 'none';
    }

    init();
})();
