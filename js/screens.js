class ScreenManager {
    constructor() {
        this.screens = document.querySelectorAll('.screen');
        this.currentScreen = null;
        this.history = [];
    }

    show(screenId, addToHistory = true) {
        this.screens.forEach(screen => {
            screen.classList.remove('active');
        });

        const target = document.getElementById(screenId);
        if (target) {
            target.classList.add('active');
            this.currentScreen = screenId;
            
            if (addToHistory && this.history[this.history.length - 1] !== screenId) {
                this.history.push(screenId);
            }

            window.scrollTo(0, 0);
            this.updateBottomNav(screenId);
        }
    }

    back() {
        if (this.history.length > 1) {
            this.history.pop();
            const previous = this.history[this.history.length - 1];
            this.show(previous, false);
        }
    }

    updateBottomNav(screenId) {
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;

    const items = nav.querySelectorAll('.nav-item');
    items.forEach(item => item.classList.remove('active'));

    // Маппинг экранов на data-screen атрибуты
    const screenMap = {
        'screen-main': 'main',
        'screen-teams': 'teams',
        'screen-hub': 'hub',
        'screen-profile': 'profile'
    };

    const targetScreen = screenMap[screenId];
    if (targetScreen) {
        const activeBtn = nav.querySelector(`[data-screen="${targetScreen}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }
}

    getCurrentScreen() {
        return this.currentScreen;
    }
}

const screenManager = new ScreenManager();