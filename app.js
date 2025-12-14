// Main Application JavaScript for FulfillME.com

class FulfillMEApp {
    constructor() {
        this.currentUser = null;
        this.needs = [];
        this.init();
    }

    init() {
        this.loadUserData();
        this.loadNeeds();
        this.setupEventListeners();
        this.setupInstallPrompt();
        this.checkForUpdates();
    }

    // Load user data from localStorage
    loadUserData() {
        const userData = localStorage.getItem('fulfillme_user');
        if (userData) {
            this.currentUser = JSON.parse(userData);
            this.updateUIForUser();
        }
    }

    // Load needs data (in production, this would be from an API)
    loadNeeds() {
        const sampleNeeds = [
            {
                id: 1,
                title: "Plumber for kitchen sink",
                description: "Need a plumber to fix leaking kitchen sink in Nairobi West",
                budget: 1000,
                location: "Nairobi",
                category: "services",
                user: { name: "John D.", avatar: "JD" },
                time: "Tomorrow",
                photo: null
            },
            {
                id: 2,
                title: "Used laptop under KSh 15,000",
                description: "Looking for a used laptop in good condition for student use",
                budget: 15000,
                location: "Kisumu",
                category: "products",
                user: { name: "Sarah M.", avatar: "SM" },
                time: "ASAP",
                photo: null
            },
            {
                id: 3,
                title: "Wedding DJ",
                description: "Need professional DJ for wedding ceremony in Nakuru",
                budget: 5000,
                location: "Nakuru",
                category: "services",
                user: { name: "Mike K.", avatar: "MK" },
                time: "Next weekend",
                photo: null
            },
            {
                id: 4,
                title: "House cleaning",
                description: "Full house cleaning in Mombasa, 3 bedrooms",
                budget: 800,
                location: "Mombasa",
                category: "services",
                user: { name: "Amina A.", avatar: "AA" },
                time: "This Saturday",
                photo: null
            }
        ];

        this.needs = sampleNeeds;
        this.renderLatestNeeds();
    }

    // Render latest needs on homepage
    renderLatestNeeds() {
        const container = document.getElementById('latestRequests');
        if (!container) return;

        container.innerHTML = this.needs.map(need => `
            <div class="request-card" data-id="${need.id}">
                <div class="request-image">
                    <i class="fas fa-image"></i>
                </div>
                <div class="request-content">
                    <div class="request-header">
                        <div class="request-title">${need.title}</div>
                        <div class="request-budget">KSh ${need.budget.toLocaleString()}</div>
                    </div>
                    <p>${need.description}</p>
                    <div class="request-location">
                        <i class="fas fa-map-marker-alt"></i> ${need.location}
                    </div>
                    <div class="request-time">
                        <i class="far fa-clock"></i> ${need.time}
                    </div>
                    <div class="request-user">
                        <div class="user-avatar">${need.user.avatar}</div>
                        <span>${need.user.name}</span>
                    </div>
                    <button class="btn-view-details" onclick="app.viewNeedDetails(${need.id})">
                        View Details
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Setup event listeners
    setupEventListeners() {
        // Menu toggle
        const menuToggle = document.querySelector('.menu-toggle');
        const navLinks = document.querySelector('.nav-links');
        
        if (menuToggle && navLinks) {
            menuToggle.addEventListener('click', () => {
                navLinks.classList.toggle('active');
            });
        }

        // Search functionality
        const searchBtn = document.querySelector('.btn-search');
        const searchInput = document.getElementById('searchInput');
        
        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', () => this.handleSearch());
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });
        }

        // Install button
        const installBtn = document.getElementById('installButton');
        if (installBtn) {
            installBtn.addEventListener('click', () => this.showInstallPrompt());
        }

        // Install prompt buttons
        const installCancel = document.getElementById('installCancel');
        const installConfirm = document.getElementById('installConfirm');
        
        if (installCancel) {
            installCancel.addEventListener('click', () => this.hideInstallPrompt());
        }
        
        if (installConfirm) {
            installConfirm.addEventListener('click', () => this.handleInstall());
        }

        // Category search
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const category = card.querySelector('span').textContent.toLowerCase();
                this.searchByCategory(category);
            });
        });
    }

    // Handle search
    handleSearch() {
        const searchTerm = document.getElementById('searchInput').value;
        const category = document.getElementById('categorySelect').value;
        const location = document.getElementById('locationSelect').value;
        
        // In production, this would redirect to browse page with query params
        window.location.href = `pages/browse.html?search=${encodeURIComponent(searchTerm)}&category=${category}&location=${location}`;
    }

    // Search by category
    searchByCategory(category) {
        window.location.href = `pages/browse.html?category=${encodeURIComponent(category)}`;
    }

    // View need details
    viewNeedDetails(needId) {
        const need = this.needs.find(n => n.id === needId);
        if (need) {
            localStorage.setItem('selectedNeed', JSON.stringify(need));
            window.location.href = 'pages/need-details.html';
        }
    }

    // PWA Install functionality
    setupInstallPrompt() {
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            deferredPrompt = e;
            
            // Show install button
            const installBtn = document.getElementById('installButton');
            if (installBtn) {
                installBtn.style.display = 'flex';
            }
        });
        
        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
            this.hideInstallPrompt();
        });
    }

    showInstallPrompt() {
        const prompt = document.getElementById('installPrompt');
        if (prompt) {
            prompt.classList.add('show');
        }
    }

    hideInstallPrompt() {
        const prompt = document.getElementById('installPrompt');
        if (prompt) {
            prompt.classList.remove('show');
        }
    }

    async handleInstall() {
        if (window.deferredPrompt) {
            window.deferredPrompt.prompt();
            const { outcome } = await window.deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            window.deferredPrompt = null;
            this.hideInstallPrompt();
        }
    }

    // Check for app updates
    checkForUpdates() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.update();
            });
        }
    }

    // Update UI based on user status
    updateUIForUser() {
        const authButtons = document.querySelector('.auth-buttons');
        if (authButtons && this.currentUser) {
            authButtons.innerHTML = `
                <a href="pages/dashboard.html" class="btn-login">
                    <i class="fas fa-user-circle"></i> Dashboard
                </a>
                <a href="#" class="btn-register" onclick="app.logout()">
                    Logout
                </a>
            `;
        }
    }

    // User logout
    logout() {
        localStorage.removeItem('fulfillme_user');
        this.currentUser = null;
        window.location.href = 'index.html';
    }

    // Simulate API calls
    async apiRequest(endpoint, method = 'GET', data = null) {
        const baseUrl = 'http://localhost:3000/api'; // Change this in production
        const token = localStorage.getItem('fulfillme_token');
        
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const config = {
            method,
            headers,
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
            config.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(`${baseUrl}${endpoint}`, config);
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
}

// Initialize app
const app = new FulfillMEApp();

// Make app available globally
window.app = app;

// Offline functionality
window.addEventListener('online', () => {
    document.body.classList.remove('offline');
    app.checkForUpdates();
});

window.addEventListener('offline', () => {
    document.body.classList.add('offline');
    console.log('App is offline. Some features may be limited.');
});