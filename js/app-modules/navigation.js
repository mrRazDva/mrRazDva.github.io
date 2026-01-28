const navigationModule = {
    app: null,
    
    init(appInstance) {
        this.app = appInstance;
        this.setupEventListeners();
    },
    
    setupEventListeners() {
        // Навигация по экранам
        this.setupScreenNavigation();
    },
    
    setupScreenNavigation() {
        // Управление видимостью навигации
        this.updateBottomNavVisibility();
    },
    
    // ========== НАВИГАЦИЯ ПО ЭКРАНАМ ==========
    
    // Роли и авторизация
    showRoleSelection() {
        screenManager.show('screen-role');
        this.app.selectedRole = 'fan';
        this.updateRoleUI();
    },
    
    selectRole(role) {
        this.app.selectedRole = role;
        this.updateRoleUI();
    },
    
    updateRoleUI() {
        document.querySelectorAll('.role-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.role === this.app.selectedRole);
        });
        
        utils.toggleActive(
            document.querySelector(`.role-option[data-role="${this.app.selectedRole}"]`),
            document.querySelector('.role-selector')
        );
        
        utils.hide('role-info-fan');
        utils.hide('role-info-organizer');
        utils.show(`role-info-${this.app.selectedRole}`);
        
        const btn = document.getElementById('continue-btn');
        btn.textContent = this.app.selectedRole === 'organizer' ? 'Перейти к оплате' : 'Продолжить';
    },
    
    goToAuth() {
        screenManager.show('screen-auth');
        
        const isOrganizer = this.app.selectedRole === 'organizer';
        document.getElementById('auth-subtitle').textContent = 
            isOrganizer ? 'Оформление подписки PRO' : 'Создай аккаунт болельщика';
        
        if (isOrganizer) {
            utils.show('phone-field');
            utils.hide('reg-btn');
            utils.show('pay-btn');
        } else {
            utils.hide('phone-field');
            utils.show('reg-btn');
            utils.hide('pay-btn');
        }
    },
    
    backToRole() {
        screenManager.show('screen-role');
    },
    
    showLogin() {
        screenManager.show('screen-login');
    },
    
    showForgotPassword() {
        const email = prompt('Введите email для восстановления пароля:');
        if (email) {
            authModule.resetPassword(email).then(result => {
                if (result.success) {
                    alert('Инструкции отправлены на ваш email');
                } else {
                    alert('Ошибка: ' + result.error);
                }
            });
        }
    },
    
    // Город
    showCitySelection() {
        screenManager.show('screen-city');
    },
    
    // Главный экран
    showMain() {
        screenManager.show('screen-main');
        this.updateUserUI();
        this.updateRoleBasedUI();
        matchesModule.renderMatches();
    },
    
    // Хаб
    showHub() {
        screenManager.show('screen-hub');
        eventsModule.renderHub();
    },
    
    // Команды
    showTeams() {
        if (!authModule.isAuthenticated()) {
            alert('Сначала войдите в систему');
            this.showRoleSelection();
            return;
        }
        
        screenManager.show('screen-teams');
        teamsModule.renderMyTeams();
    },
    
    // Создание команды
    showCreateTeam() {
        if (!authModule.isAuthenticated()) {
            alert('Сначала войдите в систему');
            return;
        }
        
        if (!authModule.hasRole('organizer')) {
            alert('Только организаторы могут создавать команды');
            return;
        }
        
        screenManager.show('screen-create-team');
    },
    
    // Создание матча
    showCreateMatch() {
        if (!authModule.isAuthenticated()) {
            alert('Сначала войдите в систему');
            return;
        }
        
        if (!authModule.hasRole('organizer') || !authModule.isProActive()) {
            alert('Только организаторы с активной подпиской могут создавать матчи');
            return;
        }
        
        screenManager.show('screen-create-match');
        matchesModule.loadUserTeamsForMatch();
    },
    
    // Профиль
    async showProfile() {
        screenManager.show('screen-profile');
        
        if (authModule.isAuthenticated()) {
            const user = authModule.currentUser;
            
            document.getElementById('profile-avatar').textContent = user.nickname[0].toUpperCase();
            document.getElementById('profile-name').textContent = user.nickname;
            document.getElementById('profile-role').textContent = 
                user.role === 'organizer' ? 'Организатор PRO' : 'Болельщик';
            
            // PRO бейдж
            const proBadge = document.getElementById('profile-pro-badge');
            if (proBadge) {
                proBadge.classList.toggle('hidden', user.role !== 'organizer');
            }
            
            // Карточка подписки
            await this.renderSubscriptionCard(user);
        }
    },
    
    async renderSubscriptionCard(user) {
        const subCard = document.getElementById('subscription-card');
        if (!subCard) return;
        
        subCard.classList.remove('hidden');
        
        const statusEl = document.getElementById('sub-status');
        const dateEl = document.getElementById('sub-date');
        
        if (user.role === 'organizer') {
            if (user.subscription_active && user.subscription_expiry) {
                const expiryDate = new Date(user.subscription_expiry);
                const now = new Date();
                
                if (expiryDate > now) {
                    statusEl.textContent = 'Активна';
                    statusEl.className = 'info-value status-active';
                    dateEl.textContent = expiryDate.toLocaleDateString('ru-RU');
                } else {
                    statusEl.textContent = 'Истекла';
                    statusEl.className = 'info-value status-inactive';
                    dateEl.textContent = expiryDate.toLocaleDateString('ru-RU');
                }
            } else {
                statusEl.textContent = 'Неактивна';
                statusEl.className = 'info-value status-inactive';
                dateEl.textContent = '—';
            }
        } else {
            statusEl.textContent = 'Базовый';
            statusEl.className = 'info-value';
            statusEl.style.color = 'var(--text-secondary)';
            dateEl.parentElement.style.display = 'none';
        }
    },
    
    // Оплата
    showPayment() {
        this.paymentType = 'upgrade';
        document.getElementById('payment-modal').classList.add('active');
    },
    
    closePayment() {
        document.getElementById('payment-modal').classList.remove('active');
        this.paymentType = null;
    },
    
    async processPayment() {
        const paymentBtn = document.querySelector('#payment-modal .btn-gold');
        const originalText = paymentBtn.textContent;
        paymentBtn.textContent = 'Обработка...';
        paymentBtn.disabled = true;
        
        try {
            const result = await authModule.upgradeToPro();
            
            if (result.success) {
                this.app.currentUser = result.user;
                alert('Подписка успешно оформлена!');
                
                this.closePayment();
                this.showMain();
            } else {
                alert('Ошибка: ' + result.error);
            }
        } catch (error) {
            console.error('Ошибка обработки платежа:', error);
            alert('Ошибка обработки платежа');
        } finally {
            paymentBtn.textContent = originalText;
            paymentBtn.disabled = false;
        }
    },
    
    // Выход
    async logout() {
        if (confirm('Выйти из аккаунта?')) {
            const result = await authModule.logout();
            
            if (result.success) {
                this.app.currentUser = null;
                setTimeout(() => {
                    this.showRoleSelection();
                }, 500);
            }
        }
    },
    
    // ========== UI ОБНОВЛЕНИЯ ==========
    
    updateUserUI() {
        if (authModule.isAuthenticated()) {
            const user = authModule.currentUser;
            
            const avatarLetter = document.getElementById('avatar-letter');
            if (avatarLetter) {
                avatarLetter.textContent = user.nickname[0].toUpperCase();
            }
            
            const proBadge = document.getElementById('pro-badge');
            if (proBadge) {
                proBadge.classList.toggle('hidden', !authModule.isProActive());
            }
        }
    },
    
    updateRoleBasedUI() {
        if (!authModule.isAuthenticated()) return;
        
        const user = authModule.currentUser;
        
        utils.toggleVisibility('nav-teams-btn', authModule.hasRole('organizer'));
        utils.toggleVisibility('nav-create-btn', authModule.isProActive());
        
        utils.toggleVisibility('paywall-banner', 
            user.role === 'organizer' && !authModule.isProActive()
        );
        
        utils.toggleVisibility('bottom-nav', true);
    },
    
    updateBottomNavVisibility() {
        if (typeof utils !== 'undefined') {
            utils.toggleVisibility('bottom-nav', authModule.isAuthenticated());
        }
    },
    
    // Назад к матчу
    backToMatch() {
        if (this.app.selectedMatch) {
            matchesModule.showMatchDetail(this.app.selectedMatch.id);
        } else {
            this.showMain();
        }
    }
};

// Экспортируем глобально
window.navigationModule = navigationModule;