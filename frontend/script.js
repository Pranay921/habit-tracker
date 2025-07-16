 // script.js
const API_BASE_URL = 'http://localhost:5000';
let currentUser = null;
let habits = [];
let currentView = 'auth';
let trackerView = 'daily';
let editingHabitId = null;
let statsChart = null;

// Theme management
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
}

function toggleTheme() {
    const newTheme = document.documentElement.classList.contains('dark-theme') ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark-theme');
        document.getElementById('theme-toggle-icon').classList.replace('fa-moon', 'fa-sun');
    } else {
        document.documentElement.classList.remove('dark-theme');
        document.getElementById('theme-toggle-icon').classList.replace('fa-sun', 'fa-moon');
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize theme
    initializeTheme();
    // Initialize auth form mode
    setAuthMode('login');
    // Load user data
    await loadUserData();
    // Decide initial view
    if (currentUser) {
        showView('dashboard');
    } else {
        showView('auth');
    }
    // Set up event listeners
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Auth form submission
    document.getElementById('auth-form').addEventListener('submit', handleAuth);
    // Habit form submission
    document.getElementById('habit-form').addEventListener('submit', handleHabitForm);
}

// Utility to parse JSON or throw error if response is not JSON
async function parseJSONResponse(response) {
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
        return await response.json();
    } else {
        const text = await response.text();
        throw new Error(`Unexpected response from server: ${text}`);
    }
}

// Authentication functions
function setAuthMode(mode) {
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const submitBtn = document.getElementById('auth-submit');

    if (mode === 'login') {
        loginBtn.classList.add('text-blue-600', 'border-blue-600');
        loginBtn.classList.remove('text-gray-500');
        signupBtn.classList.add('text-gray-500');
        signupBtn.classList.remove('text-blue-600', 'border-blue-600');
        submitBtn.textContent = 'Login';
        document.getElementById('name-field').classList.add('hidden');
    } else {
        signupBtn.classList.add('text-blue-600', 'border-blue-600');
        signupBtn.classList.remove('text-gray-500');
        loginBtn.classList.add('text-gray-500');
        loginBtn.classList.remove('text-blue-600', 'border-blue-600');
        submitBtn.textContent = 'Sign Up';
        document.getElementById('name-field').classList.remove('hidden');
    }
}

async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const isLogin = document.getElementById('auth-submit').textContent === 'Login';
    if (!email || !password) {
        showError('Please fill in all fields');
        return;
    }
    try {
        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await parseJSONResponse(response);
        if (!response.ok) {
            throw new Error(data.message || 'Authentication failed');
        }
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('userName', data.name || email.split('@')[0]);
        currentUser = { id: data.userId, name: data.name || email.split('@')[0] };
        document.getElementById('user-name').textContent = currentUser.name;
        showView('dashboard');
        await loadUserData();
    } catch (error) {
        showError(error.message);
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    currentUser = null;
    showView('auth');
}

// View management
function showView(view) {
    currentView = view;
    // Remove any existing login required message
    const existingMessage = document.getElementById('login-required-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    ['auth', 'dashboard', 'tracker', 'stats', 'profile'].forEach(v => {
        document.getElementById(`${v}-view`).classList.toggle('hidden', v !== view);
    });
    document.getElementById('page-title').textContent = {
        auth: 'Login',
        dashboard: 'Dashboard',
        tracker: 'Habit Tracker',
        stats: 'Statistics',
        profile: 'Profile'
    }[view];
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-blue-50', 'text-blue-600');
    });
    if (view === 'dashboard') renderHabits();
    if (view === 'tracker') renderCalendar();
    if (view === 'stats') renderStats();
    if (view === 'profile') populateProfileForm();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('hidden');
}

// Habit management
function showAddHabitModal(habit = null) {
    const token = localStorage.getItem('token');
    if (!currentUser || !token) {
        showLoginRequiredMessage();
        return;
    }
    editingHabitId = habit ? habit.id : null;
    document.getElementById('modal-title').textContent = habit ? 'Edit Habit' : 'Add New Habit';
    const form = document.getElementById('habit-form');
    if (habit) {
        document.getElementById('habit-name').value = habit.name;
        document.getElementById('habit-time').value = habit.time;
        document.getElementById('habit-frequency').value = habit.frequency;
        document.getElementById('habit-reminder').checked = habit.reminder;
    } else {
        form.reset();
    }
    const modal = document.getElementById('habit-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeHabitModal() {
    const modal = document.getElementById('habit-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function handleHabitForm(e) {
    e.preventDefault();
    const name = document.getElementById('habit-name').value.trim();
    const time = document.getElementById('habit-time').value;
    const frequency = document.getElementById('habit-frequency').value;
    const reminder = document.getElementById('habit-reminder').checked;
    if (!name) return alert('Please enter a habit name');
    const token = localStorage.getItem('token');
    const url = editingHabitId 
        ? `${API_BASE_URL}/api/habits/${editingHabitId}` 
        : `${API_BASE_URL}/api/habits`;
    const method = editingHabitId ? 'PUT' : 'POST';
    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, time, frequency, reminder })
        });
        if (!res.ok) {
            const err = await parseJSONResponse(res);
            return alert(err.message || 'Failed to save habit');
        }
        closeHabitModal();
        await loadUserData();
        showView('dashboard');
    } catch (err) {
        alert(err.message);
    }
}

async function deleteHabit(id) {
    if (!confirm('Are you sure?')) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE_URL}/api/habits/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const err = await parseJSONResponse(res);
            return alert(err.message || 'Failed to delete habit');
        }
        await loadUserData();
        showView('dashboard');
    } catch (err) {
        alert(err.message);
    }
}

async function markHabitComplete(id) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE_URL}/api/habits/${id}/complete`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const errData = await parseJSONResponse(res);
            alert(errData.message || 'Failed to mark habit complete');
            return;
        }
        await loadUserData();
        if (currentView === 'dashboard') {
            renderHabits();
        } else {
            showView('dashboard');
        }
    } catch (err) {
        alert(err.message);
    }
}

// Data persistence
async function loadUserData() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const profileRes = await fetch(`${API_BASE_URL}/api/users/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!profileRes.ok) throw new Error('Session expired');
        const userData = await parseJSONResponse(profileRes);
        currentUser = { id: userData._id, name: userData.name };
        document.getElementById('user-name').textContent = currentUser.name;

        const habitsRes = await fetch(`${API_BASE_URL}/api/habits`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (habitsRes.ok) {
            const raw = await parseJSONResponse(habitsRes);
            habits = raw.map(h => ({ ...h, id: h._id }));
        }
    } catch (err) {
        console.error(err);
        logout();
    }
}

// Populate profile form
function populateProfileForm() {
    if (!currentUser) return;
    document.getElementById('profile-name').value = currentUser.name;
    document.getElementById('profile-email').value = localStorage.getItem('userName') + '@example.com'; 
    document.getElementById('profile-password').value = '';
    document.getElementById('profile-confirm-password').value = '';
    document.getElementById('notifications').checked = false;
}

async function saveProfile() {
    const name = document.getElementById('profile-name').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    const password = document.getElementById('profile-password').value;
    const confirmPassword = document.getElementById('profile-confirm-password').value;
    const notifications = document.getElementById('notifications').checked;

    if (!name || !email) {
        return alert('Name and email cannot be empty');
    }
    if (password && password !== confirmPassword) {
        return alert('Passwords do not match');
    }

    try {
        const token = localStorage.getItem('token');
        // Update profile
        const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name, email, notifications })
        });
        if (!res.ok) {
            const err = await parseJSONResponse(res);
            throw new Error(err.message || 'Failed to update profile');
        }
        // Update password if provided
        if (password) {
            const pwRes = await fetch(`${API_BASE_URL}/api/users/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ currentPassword: password, newPassword: password })
            });
            if (!pwRes.ok) {
                const err = await parseJSONResponse(pwRes);
                throw new Error(err.message || 'Failed to update password');
            }
        }
        alert('Profile updated successfully');
        await loadUserData();
        populateProfileForm();
    } catch (err) {
        alert(err.message);
    }
}

function confirmDeleteAccount() {
    const modal = document.getElementById('delete-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeDeleteModal() {
    const modal = document.getElementById('delete-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function deleteAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                const err = await parseJSONResponse(res);
                throw new Error(err.message || 'Failed to delete account');
            }
            logout();
            closeDeleteModal();
            showView('auth');
        } catch (err) {
            alert(err.message);
        }
    }
}

// UI rendering functions
function renderHabits() {
    const container = document.querySelector('#dashboard-view .grid');
    container.innerHTML = '';
    if (!habits.length) {
        container.innerHTML = `<div class="col-span-full text-center py-12">
            <i class="fas fa-chart-line text-6xl text-gray-300 mb-4"></i>
            <h3 class="text-xl font-semibold text-gray-600 mb-2">No Habits Yet</h3>
            <p class="text-gray-500">Add your first habit to start tracking</p>
            <button onclick="showAddHabitModal()" class="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <i class="fas fa-plus mr-2"></i>Add Habit
            </button>
        </div>`;
        return;
    }
    habits.forEach(h => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl shadow-lg p-6';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800">${h.name}</h3>
                    <p class="text-gray-600 text-sm"><i class="fas fa-clock mr-1"></i>${h.time}</p>
                </div>
                <div class="flex space-x-2">
                    <button onclick='showAddHabitModal(${JSON.stringify(h).replace(/"/g,'&quot;')})' class="text-blue-600 hover:text-blue-800"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteHabit('${h.id}')" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center space-x-2"><i class="fas fa-fire text-orange-500"></i><span class="text-gray-700">${h.streak} day streak</span></div>
                <span class="text-sm text-gray-500">${h.frequency}</span>
            </div>
            <button onclick="markHabitComplete('${h.id}')" class="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                <i class="fas fa-check mr-2"></i>Mark as Done
            </button>`;
        container.appendChild(card);
    });
}

function renderCalendar() {
    const container = document.getElementById('calendar-container');
    const dates = getDatesForView();
    let html = `
        <div class="overflow-x-auto">
            <table class="w-full border-collapse">
                <thead>
                    <tr class="border-b-2 border-gray-200">
                        <th class="py-3 text-left font-semibold text-gray-600">Habit</th>
                        ${dates.map(d => `<th class="py-3 text-center font-semibold text-gray-600">${formatDate(d)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>`;
    habits.forEach(h => {
        html += `<tr class="border-b border-gray-100">
            <td class="py-3 pr-4">
                <div class="font-medium text-gray-800">${h.name}</div>
                <div class="text-xs text-gray-500">${h.time}</div>
            </td>
            ${dates.map(d => {
                const done = h.completed && h.completed[d];
                return `<td class="py-3 text-center"><button onclick="toggleHabitCompletion('${h.id}','${d}')" class="w-8 h-8 rounded-lg flex items-center justify-center ${done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'} hover:opacity-80 transition-colors">${done ? '<i class="fas fa-check"></i>' : ''}</button></td>`;
            }).join('')}
        </tr>`;
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

function renderStats() {
    const currentStreak = Math.max(...habits.map(h => h.streak), 0);
    const longestStreak = Math.max(...habits.map(h => h.streak), 0);
    const totalDays = 30;
    const completedDays = habits.reduce((sum, h) => sum + (h.completed ? Object.values(h.completed).filter(Boolean).length : 0), 0);
    const completionRate = habits.length ? Math.round((completedDays / (habits.length * totalDays)) * 100) : 0;
    document.getElementById('current-streak').textContent = currentStreak;
    document.getElementById('longest-streak').textContent = longestStreak;
    document.getElementById('completion-rate').textContent = completionRate + '%';
    const ctx = document.getElementById('stats-chart').getContext('2d');
    if (statsChart) statsChart.destroy();
    statsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Week 1','Week 2','Week 3','Week 4'],
            datasets: [{ label: 'Completion Rate', data: [65,78,82,90], borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.4 }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
    });
}

// Utility functions
function getDatesForView() {
    const dates = [];
    const today = new Date();
    if (trackerView === 'daily') {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today); d.setDate(today.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }
    } else {
        for (let i = 0; i < 7; i++) {
            const d = new Date(today); d.setDate(today.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }
    }
    return dates;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function toggleHabitCompletion(id, date) {
    const habit = habits.find(h => h.id === id);
    if (habit) {
        habit.completed = habit.completed || {};
        habit.completed[date] = !habit.completed[date];
        habit.streak = habit.completed[date] ? habit.streak + 1 : Math.max(0, habit.streak - 1);
        saveHabits();
        renderCalendar();
    }
}

function setTrackerView(view) {
    trackerView = view;
    document.getElementById('daily-btn').className = view === 'daily' ? 'px-4 py-2 bg-blue-600 text-white rounded-lg' : 'px-4 py-2 bg-gray-200 text-gray-700 rounded-lg';
    document.getElementById('weekly-btn').className = view === 'weekly' ? 'px-4 py-2 bg-blue-600 text-white rounded-lg' : 'px-4 py-2 bg-gray-200 text-gray-700 rounded-lg';
    renderCalendar();
}

async function saveHabits() {
    localStorage.setItem('habits', JSON.stringify(habits));
}

function showError(message) {
    const errorDiv = document.getElementById('auth-error');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    setTimeout(() => errorDiv.classList.add('hidden'), 3000);
}

function showLoginRequiredMessage() {
    ['auth', 'dashboard', 'tracker', 'stats', 'profile'].forEach(v => {
        document.getElementById(`${v}-view`).classList.add('hidden');
    });
    const old = document.getElementById('login-required-message');
    if (old) old.remove();
    const messageDiv = document.createElement('div');
    messageDiv.id = 'login-required-message';
    messageDiv.className = 'max-w-md mx-auto bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-xl mt-6';
    messageDiv.innerHTML = `
        <p class="font-semibold text-lg mb-2">Login Required</p>
        <p>You need to log in to access this section.</p>
        <button id="login-required-btn" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">Go to Login</button>
    `;
    const main = document.querySelector('main');
    main.appendChild(messageDiv);
    document.getElementById('login-required-btn').addEventListener('click', () => {
        messageDiv.remove();
        showView('auth');
    });
}