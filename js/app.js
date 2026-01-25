// js/app.js - исправленная версия
const app = {
    currentUser: null,
    selectedRole: 'fan',
    currentCity: 'obninsk',
    currentFilter: 'all',
    currentHubFilter: 'all',
    selectedMatch: null,
    map: null,
    ymapsReady: false,

    init() {
        // Загружаем города
        this.renderCities();
        
        // Проверяем авторизацию через authModule
        if (typeof authModule !== 'undefined' && authModule.isAuthenticated()) {
            // Показываем главный экран
            this.showMain();
        } else {
            // Показываем выбор роли
            screenManager.show('screen-role');
        }

        // Инициализация Яндекс Карт
        if (typeof ymaps !== 'undefined') {
            ymaps.ready(() => {
                this.ymapsReady = true;
            });
        }
    },

    selectRole(role) {
        this.selectedRole = role;
        
        document.querySelectorAll('.role-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.role === role);
        });
        
        utils.toggleActive(
            document.querySelector(`.role-option[data-role="${role}"]`),
            document.querySelector('.role-selector')
        );

        utils.hide('role-info-fan');
        utils.hide('role-info-organizer');
        utils.show(`role-info-${role}`);

        const btn = document.getElementById('continue-btn');
        btn.textContent = role === 'organizer' ? 'Перейти к оплате' : 'Продолжить';
    },

    goToAuth() {
        screenManager.show('screen-auth');
        
        const isOrganizer = this.selectedRole === 'organizer';
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

    // Регистрация через authModule
    async register() {
        const nickname = document.getElementById('reg-nickname').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const phone = document.getElementById('reg-phone')?.value;

        if (!nickname || !email || !password) {
            alert('Заполните все обязательные поля');
            return;
        }

        // Проверяем пароль
        if (password.length < 6) {
            alert('Пароль должен быть не менее 6 символов');
            return;
        }

        // Показываем загрузку
        const regBtn = document.getElementById('reg-btn');
        const originalText = regBtn.textContent;
        regBtn.textContent = 'Регистрация...';
        regBtn.disabled = true;

        try {
            const userData = {
                nickname,
                email,
                password,
                role: this.selectedRole,
                phone: this.selectedRole === 'organizer' ? phone : null
            };

            const result = await authModule.register(userData);

            if (result.success) {
                // Регистрация успешна
                this.currentUser = result.user;
                
                // Если организатор, показываем оплату
                if (this.selectedRole === 'organizer') {
                    this.showPayment();
                } else {
                    // Болельщик - сразу к выбору города
                    this.showCitySelection();
                }
            } else {
                alert('Ошибка регистрации: ' + result.error);
            }
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            alert('Ошибка регистрации. Попробуйте позже.');
        } finally {
            // Восстанавливаем кнопку
            regBtn.textContent = originalText;
            regBtn.disabled = false;
        }
    },

    renderCities() {
        const container = document.getElementById('city-list');
        if (!container) return;

        Object.entries(mockData.cities).forEach(([id, city]) => {
            const card = document.createElement('button');
            card.className = 'city-card';
            card.onclick = () => this.selectCity(id);
            card.innerHTML = `
                <div>
                    <div class="city-name">${city.name}</div>
                    <div class="city-stats">${city.stats}</div>
                </div>
                <i class="fas fa-chevron-right" style="color: var(--accent-green);"></i>
            `;
            container.appendChild(card);
        });
    },

    showCitySelection() {
        screenManager.show('screen-city');
    },

    selectCity(cityId) {
        this.currentCity = cityId;
        const cityName = mockData.cities[cityId].name;
        
        document.querySelectorAll('#current-city-name').forEach(el => {
            el.textContent = cityName;
        });

        this.showMain();
    },

    showMain() {
        screenManager.show('screen-main');
        
        // Проверяем, авторизован ли пользователь
        if (authModule.isAuthenticated()) {
            const user = authModule.currentUser;
            
            // Аватар
            const avatarLetter = document.getElementById('avatar-letter');
            if (avatarLetter) {
                avatarLetter.textContent = user.nickname[0].toUpperCase();
            }
            
            // PRO бейдж
            const proBadge = document.getElementById('pro-badge');
            if (proBadge) {
                proBadge.classList.toggle('hidden', !authModule.isProActive());
            }
            
            // Показываем меню
            utils.toggleVisibility('bottom-nav', true);
            
            // Показываем/скрываем элементы в зависимости от роли
            utils.toggleVisibility('nav-teams-btn', user.role === 'organizer');
            utils.toggleVisibility('nav-create-btn', authModule.isProActive());
            
            // Баннер просрочки
            utils.toggleVisibility('paywall-banner', 
                user.role === 'organizer' && !authModule.isProActive()
            );
            
            // Загружаем матчи
            this.renderMatches();
        } else {
            // Если не авторизован, показываем выбор роли
            screenManager.show('screen-role');
        }
    },

    renderMatches() {
        const container = document.getElementById('matches-list');
        if (!container) return;

        container.innerHTML = '';

        let matches = mockData.matches.filter(m => {
            const t1 = mockData.teams[m.team1];
            const t2 = mockData.teams[m.team2];
            return t1?.city === this.currentCity || t2?.city === this.currentCity;
        });

        if (this.currentFilter !== 'all') {
            matches = matches.filter(m => m.sport === this.currentFilter);
        }

        matches.forEach(match => {
            const t1 = mockData.teams[match.team1];
            const t2 = mockData.teams[match.team2];
            
            if (!t1 || !t2) return;

            const card = document.createElement('div');
            card.className = 'match-card';
            card.onclick = () => this.showMatchDetail(match.id);
            
            card.innerHTML = `
                <div class="match-header">
                    <span class="sport-badge">
                        <i class="fas fa-${this.getSportIcon(match.sport)}"></i>
                        ${this.getSportName(match.sport)}
                    </span>
                    <span class="match-status status-${match.status}">
                        ${match.status === 'upcoming' ? 'СКОРО' : 'ИДЁТ'}
                    </span>
                </div>
                <div class="teams-row">
                    <div class="team">
                        <div class="team-avatar">${t1.avatar}</div>
                        <div class="team-name">${t1.name}</div>
                    </div>
                    <div class="vs">VS</div>
                    <div class="team" style="justify-content: flex-end;">
                        <div style="text-align: right; margin-right: 8px;">
                            <div class="team-name">${t2.name}</div>
                        </div>
                        <div class="team-avatar">${t2.avatar}</div>
                    </div>
                </div>
                <div class="match-info">
                    <span><i class="far fa-clock"></i> ${match.date}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${match.location}</span>
                </div>
            `;
            container.appendChild(card);
        });
    },

    getSportIcon(sport) {
        const icons = {
            football: 'futbol',
            volleyball: 'volleyball-ball',
            basketball: 'basketball-ball'
        };
        return icons[sport] || 'futbol';
    },

    getSportName(sport) {
        const names = {
            football: 'Футбол',
            volleyball: 'Волейбол',
            basketball: 'Баскетбол'
        };
        return names[sport] || sport;
    },

    filterSport(sport) {
        this.currentFilter = sport;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent.toLowerCase().includes(
                sport === 'all' ? 'все' : 
                sport === 'football' ? 'футбол' :
                sport === 'volleyball' ? 'волей' : 'баскет'
            ));
        });
        this.renderMatches();
    },

    showMatchDetail(matchId) {
        this.selectedMatch = mockData.matches.find(m => m.id === matchId);
        if (!this.selectedMatch) return;

        const match = this.selectedMatch;
        const t1 = mockData.teams[match.team1];
        const t2 = mockData.teams[match.team2];

        screenManager.show('screen-match');

        const content = document.getElementById('match-detail-content');
        if (content) {
            content.innerHTML = `
                <div class="form-section" style="text-align: center; padding: 30px 20px;">
                    <div style="display: flex; justify-content: space-around; align-items: center; margin: 20px 0;">
                        <div class="detail-team" onclick="teamModule.show('${t1.id}')" style="cursor: pointer;">
                            <div class="team-avatar" style="width: 80px; height: 80px; font-size: 2.5rem; margin: 0 auto 10px; border-color: var(--accent-green); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                                ${t1.avatar}
                            </div>
                            <div style="font-weight: 700; font-size: 1.1rem;">${t1.name}</div>
                            <div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 4px;">Состав →</div>
                        </div>
                        
                        <div style="font-family: var(--font-display); font-size: 2.5rem; color: var(--accent-green);">
                            ${match.score}
                        </div>
                        
                        <div class="detail-team" onclick="teamModule.show('${t2.id}')" style="cursor: pointer;">
                            <div class="team-avatar" style="width: 80px; height: 80px; font-size: 2.5rem; margin: 0 auto 10px; border-color: var(--accent-green); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                                ${t2.avatar}
                            </div>
                            <div style="font-weight: 700; font-size: 1.1rem;">${t2.name}</div>
                            <div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 4px;">Состав →</div>
                        </div>
                    </div>
                    <span class="match-status status-${match.status}">Предстоящий матч</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px;">
                    <div class="form-section" style="margin: 0;">
                        <div style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 4px;">Когда</div>
                        <div style="font-weight: 700;">${match.date}</div>
                    </div>
                    <div class="form-section" style="margin: 0;">
                        <div style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 4px;">Где</div>
                        <div style="font-weight: 700;">${match.location}</div>
                    </div>
                </div>
            `;
        }

        const canChallenge = authModule.isAuthenticated() && 
            authModule.hasRole('organizer') &&
            authModule.isProActive();
        
        utils.toggleVisibility('challenge-section', canChallenge);

        setTimeout(() => this.initMap(match.lat, match.lng, match.location), 100);
        if (typeof socialModule !== 'undefined') {
            socialModule.showCommentsSection(matchId);
        }
    },

    initMap(lat, lng, location) {
        if (!this.ymapsReady) {
            setTimeout(() => this.initMap(lat, lng, location), 500);
            return;
        }

        const mapContainer = document.getElementById('map');
        if (!mapContainer) return;

        if (this.map) {
            this.map.destroy();
        }

        this.map = new ymaps.Map("map", {
            center: [lat, lng],
            zoom: 15,
            controls: ['zoomControl']
        });

        const placemark = new ymaps.Placemark([lat, lng], {
            hintContent: location,
            balloonContent: `<strong>${location}</strong>`
        }, {
            preset: 'islands#greenDotIconWithCaption'
        });

        this.map.geoObjects.add(placemark);
    },

    showTeams() {
        if (!authModule.isAuthenticated()) {
            alert('Сначала войдите в систему');
            screenManager.show('screen-role');
            return;
        }
        
        screenManager.show('screen-teams');
        this.renderMyTeams();
    },

    renderMyTeams() {
        const container = document.getElementById('teams-list');
        if (!container) return;

        const myTeams = Object.values(mockData.teams).filter(t => 
            t.owner === (authModule.currentUser?.id || '')
        );

        if (myTeams.length === 0) {
            container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 40px;">У тебя пока нет команд</div>';
            return;
        }

        container.innerHTML = myTeams.map(team => `
            <div class="team-manage-card" onclick="teamEditModule.show('${team.id}')">
                <div class="team-avatar" style="width: 50px; height: 50px; font-size: 1.5rem; border-color: var(--accent-green);">
                    ${team.avatar}
                </div>
                <div class="team-info">
                    <div class="team-name">${team.name}</div>
                    <div class="team-stats">${team.wins} побед • ${team.players.length} игроков</div>
                </div>
                <i class="fas fa-chevron-right" style="color: var(--text-secondary);"></i>
            </div>
        `).join('');
    },

    showCreateTeam() {
        screenManager.show('screen-create-team');
    },

    createTeam() {
        const name = document.getElementById('team-name').value;
        const avatar = document.getElementById('team-avatar').value || '⚽';
        const sport = document.getElementById('team-sport').value;

        if (!name) {
            alert('Введите название команды');
            return;
        }

        const teamId = 'team_' + Date.now();
        mockData.teams[teamId] = {
            id: teamId,
            name,
            city: this.currentCity,
            sport,
            avatar,
            wins: 0,
            losses: 0,
            draws: 0,
            owner: authModule.currentUser?.id || 'demo_user',
            players: [
                { name: authModule.currentUser?.nickname || 'Игрок', number: 10, role: 'Капитан' }
            ]
        };

        this.showTeams();
    },

    showCreateMatch() {
        screenManager.show('screen-create-match');
        
        const myTeams = Object.values(mockData.teams).filter(t => 
            t.owner === (authModule.currentUser?.id || '')
        );
        
        const teamSelect = document.getElementById('match-team');
        teamSelect.innerHTML = myTeams.map(t => 
            `<option value="${t.id}">${t.name}</option>`
        ).join('');

        const opponents = Object.values(mockData.teams).filter(t => 
            t.owner !== authModule.currentUser?.id && t.city === this.currentCity
        );
        
        const opponentSelect = document.getElementById('match-opponent');
        opponentSelect.innerHTML = '<option value="">Открытый матч (без соперника)</option>' + 
            opponents.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    },

    createMatch() {
        const teamId = document.getElementById('match-team').value;
        const opponentId = document.getElementById('match-opponent').value;
        const datetime = document.getElementById('match-datetime').value;
        const location = document.getElementById('match-location').value;

        if (!datetime || !location) {
            alert('Заполните все поля');
            return;
        }

        const match = {
            id: Date.now(),
            sport: mockData.teams[teamId].sport,
            team1: teamId,
            team2: opponentId || 'tbd',
            date: new Date(datetime).toLocaleString('ru-RU', {
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            location,
            lat: mockData.cities[this.currentCity].lat,
            lng: mockData.cities[this.currentCity].lng,
            status: 'upcoming',
            score: '0:0'
        };

        mockData.matches.push(match);
        this.showMain();
    },

    challengeTeam() {
        if (!authModule.isAuthenticated() || !authModule.hasRole('organizer') || !authModule.isProActive()) {
            alert('Только организаторы с активной подпиской могут бросать вызовы');
            return;
        }
        
        if (confirm('Бросить вызов на этот матч?')) {
            alert('Вызов отправлен! Ожидайте подтверждения.');
        }
    },

    showProfile() {
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
            const subCard = document.getElementById('subscription-card');
            if (subCard) {
                subCard.classList.remove('hidden');
                
                const statusEl = document.getElementById('sub-status');
                const dateEl = document.getElementById('sub-date');
                
                if (user.role === 'organizer') {
                    if (user.subscriptionActive && user.subscriptionExpiry) {
                        const expiryDate = new Date(user.subscriptionExpiry);
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
            }
        }
    },

    showPayment() {
        this.paymentType = 'upgrade';
        document.getElementById('payment-modal').classList.add('active');
    },

    closePayment() {
        document.getElementById('payment-modal').classList.remove('active');
        this.paymentType = null;
    },

    processPayment() {
        setTimeout(() => {
            if (authModule.isAuthenticated()) {
                authModule.currentUser.subscriptionActive = true;
                authModule.currentUser.subscriptionExpiry = '2025-12-31';
                authModule.saveToStorage();
                alert('Подписка успешно оформлена!');
            }
            
            this.closePayment();
            this.showMain();
        }, 500);
    },

    showTeam(teamId) {
        const team = mockData.teams[teamId];
        if (!team) return;
        alert(`Команда: ${team.name}\nПобед: ${team.wins}\nИгроков: ${team.players.length}`);
    },

    backToMatch() {
        if (this.selectedMatch) {
            this.showMatchDetail(this.selectedMatch.id);
        } else {
            this.showMain();
        }
    },

    logout() {
        if (confirm('Выйти из аккаунта?')) {
            if (typeof authModule !== 'undefined') {
                authModule.logout();
            }
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
    },

    showHub() {
        screenManager.show('screen-hub');
        this.renderHub();
    },

    renderHub() {
        this.renderHubEvents();
        this.renderHubMatches();
        this.renderHubRecommended();
    },

    renderHubEvents() {
        const container = document.getElementById('hub-events-list');
        if (!container) return;

        let events = mockData.events.filter(e => e.city === this.currentCity);
        
        if (this.currentHubFilter !== 'all' && this.currentHubFilter !== 'matches') {
            events = events.filter(e => e.type === this.currentHubFilter || e.category === this.currentHubFilter);
        }

        if (events.length === 0) {
            container.innerHTML = '<div class="empty-state">Нет событий на ближайшие дни</div>';
            return;
        }

        container.innerHTML = events.map(event => `
            <div class="hub-card event-card" onclick="app.showEventDetail('${event.id}')" style="--event-color: ${event.color}">
                <div class="hub-card-icon" style="background: ${event.color}20; color: ${event.color}">
                    ${event.image}
                </div>
                <div class="hub-card-content">
                    <div class="hub-card-header">
                        <span class="hub-card-type">${this.getEventTypeName(event.type)}</span>
                        <span class="hub-card-price">${event.price}</span>
                    </div>
                    <h4 class="hub-card-title">${event.title}</h4>
                    <p class="hub-card-desc">${event.description}</p>
                    <div class="hub-card-meta">
                        <span><i class="far fa-clock"></i> ${event.date}</span>
                        <span><i class="fas fa-map-marker-alt"></i> ${event.location}</span>
                    </div>
                </div>
            </div>
        `).join('');
    },

    renderHubMatches() {
        const container = document.getElementById('hub-matches-list');
        if (!container) return;

        const weekMatches = mockData.matches.filter(m => {
            const t1 = mockData.teams[m.team1];
            const t2 = mockData.teams[m.team2];
            return (t1?.city === this.currentCity || t2?.city === this.currentCity) && 
                   m.status === 'upcoming';
        }).slice(0, 3);

        if (weekMatches.length === 0) {
            container.innerHTML = '<div class="empty-state">Нет предстоящих матчей</div>';
            return;
        }

        container.innerHTML = weekMatches.map(match => {
            const t1 = mockData.teams[match.team1];
            const t2 = mockData.teams[match.team2];
            return `
                <div class="hub-card match-card-compact" onclick="app.showMatchDetail(${match.id})">
                    <div class="hub-match-teams">
                        <div class="hub-team">
                            <span class="hub-team-avatar">${t1?.avatar || '?'}</span>
                            <span class="hub-team-name">${t1?.name || 'TBD'}</span>
                        </div>
                        <span class="hub-vs">VS</span>
                        <div class="hub-team">
                            <span class="hub-team-avatar">${t2?.avatar || '?'}</span>
                            <span class="hub-team-name">${t2?.name || 'TBD'}</span>
                        </div>
                    </div>
                    <div class="hub-match-info">
                        <span class="hub-match-time"><i class="far fa-clock"></i> ${match.date}</span>
                        <span class="hub-match-location"><i class="fas fa-map-marker-alt"></i> ${match.location}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderHubRecommended() {
        const container = document.getElementById('hub-recommended-list');
        if (!container) return;

        const recommended = [
            {
                title: 'Новая площадка',
                desc: 'Открытие футбольного поля с искусственным газоном',
                icon: '🏟️',
                action: 'Посмотреть'
            },
            {
                title: 'Набор в команду',
                desc: 'Драконы ищут защитника',
                icon: '👥',
                action: 'Подробнее'
            }
        ];

        container.innerHTML = recommended.map(item => `
            <div class="hub-card recommendation-card">
                <div class="hub-rec-icon">${item.icon}</div>
                <div class="hub-rec-content">
                    <h4>${item.title}</h4>
                    <p>${item.desc}</p>
                </div>
                <button class="btn btn-small btn-secondary">${item.action}</button>
            </div>
        `).join('');
    },

    filterHub(type) {
        this.currentHubFilter = type;
        
        document.querySelectorAll('.hub-filter').forEach(btn => {
            btn.classList.toggle('active', btn.textContent.toLowerCase().includes(
                type === 'all' ? 'всё' : 
                type === 'events' ? 'события' :
                type === 'matches' ? 'матчи' : 'тренировки'
            ));
        });

        this.renderHub();
    },

    getEventTypeName(type) {
        const names = {
            masterclass: 'Мастер-класс',
            training: 'Тренировка',
            tournament: 'Турнир'
        };
        return names[type] || type;
    },

    showEventDetail(eventId) {
        const event = mockData.events.find(e => e.id === eventId);
        if (!event) return;
        
        alert(`${event.title}\n\n${event.description}\n\n📍 ${event.location}\n🕐 ${event.date}\n💰 ${event.price}`);
    }
};

// Вспомогательная функция для toggleVisibility
utils.toggleVisibility = (id, show) => {
    const el = document.getElementById(id);
    if (el) {
        el.classList.toggle('hidden', !show);
    }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});