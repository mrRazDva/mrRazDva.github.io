class ScreenManager {
    constructor() {
        this.screens = document.querySelectorAll('.screen');
        this.currentScreen = null;
        this.history = [];
    }

    show(screenId, addToHistory = true) {
        // Hide all screens
        this.screens.forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen
        const target = document.getElementById(screenId);
        if (target) {
            target.classList.add('active');
            this.currentScreen = screenId;
            
            if (addToHistory && this.history[this.history.length - 1] !== screenId) {
                this.history.push(screenId);
            }

            // Scroll to top
            window.scrollTo(0, 0);
            
            // Update bottom nav if needed
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

        if (screenId === 'screen-main') {
            items[0]?.classList.add('active');
        } else if (screenId === 'screen-teams') {
            items[1]?.classList.add('active');
        } else if (screenId === 'screen-profile') {
            items[2]?.classList.add('active');
        }
    }

    getCurrentScreen() {
        return this.currentScreen;
    }
}

// Initialize
const screenManager = new ScreenManager();