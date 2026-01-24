const app = {
    currentUser: null,
    selectedRole: 'fan',
    currentCity: 'obninsk',
    currentFilter: 'all',
    selectedMatch: null,
    map: null,
    ymapsReady: false,

    init() {
        // Check for saved session
        const saved = utils.storage.get('streetLeagueUser');
        if (saved) {
            this.currentUser = saved;
            this.selectedRole = saved.role;
            this.showCitySelection();
        } else {
            screenManager.show('screen-role');
        }

        // Init Yandex Maps
        if (typeof ymaps !== 'undefined') {
            ymaps.ready(() => {
                this.ymapsReady = true;
            });
        }

        // Render cities
        this.renderCities();
    },

    // Role Selection
    selectRole(role) {
        this.selectedRole = role;
        
        // Update UI
        document.querySelectorAll('.role-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.role === role);
        });
        
        utils.toggleActive(
            document.querySelector(`.role-option[data-role="${role}"]`),
            document.querySelector('.role-selector')
        );

        // Show appropriate info
        utils.hide('role-info-fan');
        utils.hide('role-info-organizer');
        utils.show(`role-info-${role}`);

        // Update continue button text
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

    register() {
        const nickname = document.getElementById('reg-nickname').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        if (!nickname || !email || !password) {
            alert('Заполните все поля');
            return;
        }

        this.currentUser = {
            nickname,
            email,
            id: 'user_' + Date.now(),
            role: this.selectedRole,
            subscriptionActive: this.selectedRole === 'organizer',
            subscriptionExpiry: this.selectedRole === 'organizer' ? '2025-12-31' : null,
            teams: []
        };

        utils.storage.set('streetLeagueUser', this.currentUser);
        this.showCitySelection();
    },

    // City Selection
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
        
        // Update all city name elements
        document.querySelectorAll('#current-city-name').forEach(el => {
            el.textContent = cityName;
        });

        this.showMain();
    },

    // Main Screen
    showMain() {
        screenManager.show('screen-main');
        
        // Update user avatar
        const avatarLetter = document.getElementById('avatar-letter');
        const proBadge = document.getElementById('pro-badge');
        
        if (avatarLetter) {
            avatarLetter.textContent = this.currentUser.nickname[0].toUpperCase();
        }

        // Show/hide organizer features
        const isOrganizer = this.currentUser.role === 'organizer';
        const hasActiveSub = this.currentUser.subscriptionActive;

        if (proBadge) {
            proBadge.classList.toggle('hidden', !isOrganizer);
        }

        utils.toggleVisibility('fab-create', isOrganizer && hasActiveSub);
        utils.toggleVisibility('bottom-nav', isOrganizer);
        utils.toggleVisibility('paywall-banner', isOrganizer && !hasActiveSub);

        this.renderMatches();
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

    // Match Detail
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

        // Show challenge button for organizers
        const canChallenge = this.currentUser.role === 'organizer' && 
            this.currentUser.subscriptionActive &&
            !this.currentUser.teams?.includes(match.team1);
        
        utils.toggleVisibility('challenge-section', canChallenge);

        // Init map
        setTimeout(() => this.initMap(match.lat, match.lng, match.location), 100);
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

    // Teams
    showTeams() {
        screenManager.show('screen-teams');
        this.renderMyTeams();
    },

    renderMyTeams() {
    const container = document.getElementById('teams-list');
    if (!container) return;

    const myTeams = Object.values(mockData.teams).filter(t => 
        t.owner === this.currentUser.id
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
            owner: this.currentUser.id,
            players: [
                { name: this.currentUser.nickname, number: 10, role: 'Капитан' }
            ]
        };

        if (!this.currentUser.teams) this.currentUser.teams = [];
        this.currentUser.teams.push(teamId);
        utils.storage.set('streetLeagueUser', this.currentUser);

        this.showTeams();
    },

    editTeam(teamId) {
        // TODO: Implement team editing
        alert('Редактирование команды: ' + teamId);
    },

    // Create Match
    showCreateMatch() {
        screenManager.show('screen-create-match');
        
        // Populate teams select
        const myTeams = Object.values(mockData.teams).filter(t => 
            t.owner === this.currentUser.id
        );
        
        const teamSelect = document.getElementById('match-team');
        teamSelect.innerHTML = myTeams.map(t => 
            `<option value="${t.id}">${t.name}</option>`
        ).join('');

        // Populate opponents
        const opponents = Object.values(mockData.teams).filter(t => 
            t.owner !== this.currentUser.id && t.city === this.currentCity
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
        if (!this.currentUser.teams || this.currentUser.teams.length === 0) {
            alert('Сначала создайте команду');
            return;
        }
        
        if (confirm('Бросить вызов на этот матч?')) {
            alert('Вызов отправлен! Ожидайте подтверждения.');
        }
    },

    // Profile
    showProfile() {
        screenManager.show('screen-profile');
        
        document.getElementById('profile-avatar').textContent = this.currentUser.nickname[0].toUpperCase();
        document.getElementById('profile-name').textContent = this.currentUser.nickname;
        document.getElementById('profile-role').textContent = 
            this.currentUser.role === 'organizer' ? 'Организатор PRO' : 'Болельщик';

        const isOrg = this.currentUser.role === 'organizer';
        utils.toggleVisibility('profile-pro-badge', isOrg);
        utils.toggleVisibility('subscription-card', isOrg);

        if (isOrg) {
            const statusEl = document.getElementById('sub-status');
            const dateEl = document.getElementById('sub-date');
            
            statusEl.textContent = this.currentUser.subscriptionActive ? 'Активна' : 'Неактивна';
            statusEl.className = 'info-value ' + (this.currentUser.subscriptionActive ? 'status-active' : 'status-inactive');
            dateEl.textContent = this.currentUser.subscriptionExpiry || '-';
        }
    },

    // Payment
    showPayment() {
        document.getElementById('payment-modal').classList.add('active');
    },

    closePayment() {
        document.getElementById('payment-modal').classList.remove('active');
    },

    processPayment() {
        this.currentUser.subscriptionActive = true;
        this.currentUser.subscriptionExpiry = '2025-12-31';
        utils.storage.set('streetLeagueUser', this.currentUser);
        
        this.closePayment();
        alert('Подписка успешно оформлена!');
        
        if (this.currentUser.role === 'organizer') {
            this.showMain();
        }
    },

    // Team Detail
    showTeam(teamId) {
        const team = mockData.teams[teamId];
        if (!team) return;

        // For now just alert, can be expanded to separate screen
        alert(`Команда: ${team.name}\nПобед: ${team.wins}\nИгроков: ${team.players.length}`);
    },

    backToMatch() {
        if (this.selectedMatch) {
            this.showMatchDetail(this.selectedMatch.id);
        } else {
            this.showMain();
        }
    },

    // Logout
    logout() {
        utils.storage.remove('streetLeagueUser');
        location.reload();
    }
};

// Helper for visibility
utils.toggleVisibility = (id, show) => {
    const el = document.getElementById(id);
    if (el) {
        el.classList.toggle('hidden', !show);
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});