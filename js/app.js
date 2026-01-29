// js/app.js - Основной файл приложения (с прокси-методами)
const app = {
    // Добавляем флаг инициализации
    isInitialized: false,
    currentUser: null,
    selectedRole: 'fan',
    currentCity: 'obninsk',
    currentFilter: 'all',
    currentHubFilter: 'all',
    selectedMatch: null,
    supabase: null,
    
    async init() {
        console.log('🚀 Инициализация Street League...');
        
        // Ждем supabase client
        await this.waitForSupabase();
        
        if (!this.supabase) {
            console.error('❌ Supabase клиент не найден!');
            // Показываем сообщение пользователю
            const splash = document.getElementById('screen-splash');
            if (splash) {
                splash.innerHTML = `
                    <div class="splash-container">
                        <div class="splash-logo">STREET LEAGUE</div>
                        <div style="color: var(--accent-pink); margin-top: 20px;">
                            Ошибка подключения. Обновите страницу.
                        </div>
                    </div>
                `;
            }
            return;
        }
        
        // Инициализируем модули
        await this.initModules();
        
        this.isInitialized = true;
        console.log('✅ Приложение инициализировано');
        
        // Скрываем splash screen
        setTimeout(() => {
            screenManager.hideSplashScreen();
        }, 1000);
    },
    
    // Ждем инициализации Supabase
    async waitForSupabase() {
        const maxAttempts = 50; // 5 секунд максимум
        for (let i = 0; i < maxAttempts; i++) {
            if (window.supabaseClient) {
                this.supabase = window.supabaseClient;
                console.log('✅ Supabase клиент найден');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100)); // ждем 100ms
        }
        console.warn('⚠️ Supabase клиент не загрузился после ожидания');
    },
    
    async initModules() {
        // Сначала инициализируем authModule, но без вызова showMain
        await authModule.init(this);
        
        // Инициализируем модуль инициализации
        await initModule.init(this);
        
        // Инициализируем остальные модули
        navigationModule.init(this);
        matchesModule.init(this);
        teamsModule.init(this);
        eventsModule.init(this);
        commentsModule.init(this);
        mapModule.init(this);
        
        // Теперь, если пользователь уже авторизован, показываем главный экран
        if (authModule.isAuthenticated()) {
            console.log('👤 Пользователь уже авторизован, показываем главный экран');
            setTimeout(() => {
                if (typeof navigationModule.showMain === 'function') {
                    navigationModule.showMain();
                }
            }, 500);
        }
    },
    
    // ========== ПРОКСИ-МЕТОДЫ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ ==========
    
    // Навигация
    showRoleSelection() {
        return navigationModule.showRoleSelection();
    },
    
    selectRole(role) {
        return navigationModule.selectRole(role);
    },
    
    goToAuth() {
        return navigationModule.goToAuth();
    },
    
    backToRole() {
        return navigationModule.backToRole();
    },
    
    showLogin() {
        return navigationModule.showLogin();
    },
    
    // Исправлено: теперь вызываем authModule.login вместо navigationModule.handleLogin
    async handleLogin() {
    try {
        // Собираем данные из формы входа
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        // Валидация
        if (!email || !password) {
            alert('Пожалуйста, введите email и пароль');
            return;
        }

        // Вызываем метод входа из authModule
        const result = await authModule.login({
            email,
            password
        });

        if (result.success) {
            console.log('✅ Вход выполнен успешно');

            // Обновляем UI
            if (typeof navigationModule !== 'undefined' && navigationModule.updateUserUI) {
                navigationModule.updateUserUI();
            }

            // ПОКАЗЫВАЕМ НИЖНЕЕ МЕНЮ
            const bottomNav = document.getElementById('bottom-nav');
            if (bottomNav) {
                bottomNav.classList.remove('hidden');
                bottomNav.style.display = 'flex';
            }

            // Показываем главный экран
            setTimeout(() => {
                if (typeof navigationModule !== 'undefined' && navigationModule.showMain) {
                    navigationModule.showMain();
                }
            }, 100);
        } else {
            alert('Ошибка входа: ' + (result.error || 'Неизвестная ошибка'));
        }

    } catch (error) {
        console.error('❌ Ошибка в методе handleLogin:', error);
        alert('Произошла ошибка при входе в систему');
    }
},
    
    // Исправлено: теперь вызываем authModule.resetPassword вместо navigationModule.showForgotPassword
    async showForgotPassword() {
        // Запрашиваем email у пользователя через prompt (временное решение)
        const email = prompt('Введите ваш email для восстановления пароля:');
        if (email) {
            const result = await authModule.resetPassword(email);
            if (result.success) {
                alert('Инструкции по сбросу пароля отправлены на ваш email');
            } else {
                alert('Ошибка: ' + result.error);
            }
        }
    },
    
    // Исправлено: теперь вызываем authModule.register вместо navigationModule.register
    async register() {
        try {
            // Собираем данные из формы
            const nickname = document.getElementById('reg-nickname').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const phone = document.getElementById('reg-phone').value;
            const role = this.selectedRole;
            
            // Валидация
            if (!nickname || !email || !password) {
                alert('Пожалуйста, заполните все обязательные поля');
                return;
            }
            
            if (password.length < 6) {
                alert('Пароль должен быть не менее 6 символов');
                return;
            }
            
            // Вызываем метод регистрации из authModule
            const result = await authModule.register({
                nickname,
                email,
                password,
                role,
                phone: phone || null
            });
            
            if (result.success) {
                // Успешная регистрация - authModule автоматически перенаправит пользователя
                console.log('✅ Регистрация успешна:', result.message);
                
                // Обновляем UI
                if (typeof navigationModule !== 'undefined' && navigationModule.updateUserUI) {
                    navigationModule.updateUserUI();
                }
                
                // Если пользователь выбрал роль организатора, показываем платежное окно
                if (role === 'organizer') {
                    setTimeout(() => {
                        if (typeof navigationModule !== 'undefined' && navigationModule.showPayment) {
                            navigationModule.showPayment();
                        }
                    }, 500);
                }
            } else {
                alert('Ошибка регистрации: ' + (result.error || 'Неизвестная ошибка'));
            }
            
        } catch (error) {
            console.error('❌ Ошибка в методе register:', error);
            alert('Произошла ошибка при регистрации');
        }
    },
    
    showCitySelection() {
        return navigationModule.showCitySelection();
    },
    
    selectCity(cityId) {
        return initModule.selectCity(cityId);
    },
    
    showMain() {
        return navigationModule.showMain();
    },
    
    filterSport(sport) {
        return matchesModule.filterSport(sport);
    },
    
    showMatchDetail(matchId) {
        return matchesModule.showMatchDetail(matchId);
    },
    
    showTeams() {
        return navigationModule.showTeams();
    },
    
    showCreateTeam() {
        return navigationModule.showCreateTeam();
    },
    
    createTeam() {
        return teamsModule.createTeam();
    },
    
    showCreateMatch() {
        return navigationModule.showCreateMatch();
    },
    
    createMatch() {
        return matchesModule.createMatch();
    },
    
    showProfile() {
        return navigationModule.showProfile();
    },
    
    showPayment() {
        return navigationModule.showPayment();
    },
    
    closePayment() {
        return navigationModule.closePayment();
    },
    
    processPayment() {
        return navigationModule.processPayment();
    },
    
    logout() {
        return navigationModule.logout();
    },
    
    showHub() {
        return navigationModule.showHub();
    },
    
    filterHub(type) {
        return eventsModule.filterHub(type);
    },
    
    showEventDetail(eventId) {
        return eventsModule.showEventDetail(eventId);
    },
    
    challengeTeam() {
        return matchesModule.challengeTeam();
    },
    
    openMapForLocation() {
        return mapModule.openMapForLocation();
    },
    
    closeLocationPicker() {
        return mapModule.closeLocationPicker();
    },
    
    confirmLocation() {
        return mapModule.confirmLocation();
    },
    
    // Команды
    renderMyTeams() {
        return teamsModule.renderMyTeams();
    },
    
    // Комментарии и реакции
    addComment(matchId, text) {
        return commentsModule.addComment(matchId, text);
    },
    
    // ========== НОВЫЕ МЕТОДЫ ДЛЯ РЕДАКТИРОВАНИЯ МАТЧЕЙ ==========
    
    showMatchEdit(matchId) {
        if (typeof matchEditModule !== 'undefined' && matchEditModule.show) {
            return matchEditModule.show(matchId);
        } else {
            alert('Модуль редактирования матчей не доступен');
            return null;
        }
    },
	
	// Получение текста формата игры
    getFormatText(format) {
        const formatMap = {
            '2x2': '2 на 2',
            '3x3': '3 на 3',
            '4x4': '4 на 4',
            '5x5': '5 на 5',
            '7x7': '7 на 7',
            '11x11': '11 на 11'
        };
        return formatMap[format] || format;
    },
    
    // ========== ОБЩИЕ УТИЛИТЫ ==========
    
    // Форматирование даты
    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('ru-RU', {
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    // Форматирование времени (сколько времени прошло)
    formatTimeAgo(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        
        if (diff < 60) return 'только что';
        if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
        if (diff < 604800) return `${Math.floor(diff / 86400)} д назад`;
        return date.toLocaleDateString('ru-RU');
    },
    
    // Получение названия вида спорта
    getSportName(sport) {
        const names = {
            football: 'Футбол',
            volleyball: 'Волейбол',
            basketball: 'Баскетбол'
        };
        return names[sport] || sport;
    },
    
    // Получение иконки вида спорта
    getSportIcon(sport) {
        const icons = {
            football: 'futbol',
            volleyball: 'volleyball-ball',
            basketball: 'basketball-ball'
        };
        return icons[sport] || 'futbol';
    },
    
    // Получение текста статуса матча
    getStatusText(status) {
        const statusMap = {
            'upcoming': 'СКОРО',
            'live': 'ИДЁТ',
            'finished': 'ЗАВЕРШЁН',
            'cancelled': 'ОТМЕНЁН'
        };
        return statusMap[status] || 'СКОРО';
    },
    
    // Получение названия типа события
    getEventTypeName(type) {
        const names = {
            masterclass: 'Мастер-класс',
            training: 'Тренировка',
            tournament: 'Турнир',
            workshop: 'Воркшоп',
            competition: 'Соревнование'
        };
        return names[type] || type;
    }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    // Запускаем инициализацию сразу, без задержки
    app.init();
});

// Экспортируем глобально
window.app = app;