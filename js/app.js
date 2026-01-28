// js/app.js - Основной файл приложения (с прокси-методами)
const app = {
    currentUser: null,
    selectedRole: 'fan',
    currentCity: 'obninsk',
    currentFilter: 'all',
    currentHubFilter: 'all',
    selectedMatch: null,
    supabase: null,
    
    // Инициализация приложения
    async init() {
        console.log('🚀 Инициализация Street League...');
        
        // Инициализируем Supabase
        this.supabase = window.supabaseClient;
        
        if (!this.supabase) {
            console.error('❌ Supabase клиент не найден!');
            alert('Ошибка подключения к серверу. Пожалуйста, обновите страницу.');
            return;
        }
        
        // Инициализируем модули
        await this.initModules();
        
        console.log('✅ Приложение инициализировано');
    },
    
    // Инициализация всех модулей
    async initModules() {
        // Проверяем сессию
        await authModule.init();
        
        // Инициализируем модуль инициализации
        await initModule.init(this);
        
        // Инициализируем остальные модули
        navigationModule.init(this);
        matchesModule.init(this);
        teamsModule.init(this);
        eventsModule.init(this);
        commentsModule.init(this);
        mapModule.init(this);
        
        // Инициализируем teamEditModule если он существует
        if (typeof teamEditModule !== 'undefined' && typeof teamEditModule.init === 'function') {
            try {
                await teamEditModule.init();
            } catch (error) {
                console.warn('⚠️ Ошибка инициализации teamEditModule:', error);
            }
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
    
    handleLogin() {
        return navigationModule.handleLogin();
    },
    
    showForgotPassword() {
        return navigationModule.showForgotPassword();
    },
    
    register() {
        return navigationModule.register();
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
    setTimeout(() => {
        app.init();
    }, 500);
});

// Экспортируем глобально
window.app = app;