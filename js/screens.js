class ScreenManager {
    constructor() {
        this.screens = document.querySelectorAll('.screen');
        this.currentScreen = null;
        this.history = [];
        this.splashHidden = false;
    }

    show(screenId, addToHistory = true) {
        // Если splash ещё не скрыт, откладываем показ других экранов
        if (!this.splashHidden && screenId !== 'screen-splash') {
            setTimeout(() => this.show(screenId, addToHistory), 50);
            return;
        }

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

    hideSplashScreen() {
        if (this.splashHidden) return;
        
        const splash = document.getElementById('screen-splash');
        const appContainer = document.getElementById('app-container');
        
        if (splash) {
            // Плавное исчезание
            splash.style.opacity = '0';
            splash.style.transition = 'opacity 0.4s ease-out';
            
            setTimeout(() => {
                splash.classList.remove('active');
                splash.style.display = 'none';
                this.splashHidden = true;
                
                // Показываем контейнер
                if (appContainer) {
                    appContainer.style.opacity = '1';
                }
                
                // Определяем, какой экран показать
                if (authModule && authModule.isAuthenticated()) {
                    console.log('Пользователь авторизован, показываем главный экран');
                    this.show('screen-main', false);
                } else {
                    console.log('Пользователь не авторизован, показываем экран выбора роли');
                    this.show('screen-role', false);
                }
            }, 400);
        }
    }
}

const screenManager = new ScreenManager();