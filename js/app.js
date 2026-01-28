// js/app.js - версия только для реальных данных Supabase
const app = {
    currentUser: null,
    selectedRole: 'fan',
    currentCity: 'obninsk',
    currentFilter: 'all',
    currentHubFilter: 'all',
    selectedMatch: null,
    supabase: null,
    map: null,
    ymapsReady: false,
	locationMap: null,
    selectedPlacemark: null,
    selectedCoords: null,





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
    
    // Проверяем сессию
    await authModule.init();
    
    // Загружаем города из Supabase
    await this.loadCitiesFromSupabase();
    
    // Инициализируем teamEditModule после загрузки городов
    if (typeof teamEditModule !== 'undefined' && typeof teamEditModule.init === 'function') {
        try {
            await teamEditModule.init();
        } catch (error) {
            console.warn('⚠️ Ошибка инициализации teamEditModule:', error);
        }
    }

        // Инициализация Яндекс Карт
        if (typeof ymaps !== 'undefined') {
            ymaps.ready(() => {
                this.ymapsReady = true;
                console.log('✅ Яндекс Карты готовы');
            });
        }
        
        console.log('✅ Приложение инициализировано');
    },

    // Загрузка городов из Supabase
    async loadCitiesFromSupabase() {
        try {
            const { data, error } = await this.supabase
                .from('cities')
                .select('*')
                .order('name');
            
            if (error) throw error;
            
            // Если таблица городов не существует или пуста
            if (!data || data.length === 0) {
                console.warn('Таблица городов пуста, создаем базовые города');
                
                // Создаем базовые города (только если у пользователя есть права администратора)
                const cities = [
                    { id: 'moscow', name: 'Москва', lat: 55.7558, lng: 37.6173, stats: '12 площадок • 48 команд' },
                    { id: 'kaluga', name: 'Калуга', lat: 54.5293, lng: 36.2754, stats: '5 площадок • 16 команд' },
                    { id: 'obninsk', name: 'Обнинск', lat: 55.0968, lng: 36.6101, stats: '3 площадки • 12 команд' }
                ];
                
                try {
                    const { error: insertError } = await this.supabase
                        .from('cities')
                        .insert(cities);
                    
                    if (insertError && insertError.code !== '23505') { // Игнорируем ошибку уникальности
                        throw insertError;
                    }
                    
                    this.cities = {};
                    cities.forEach(city => {
                        this.cities[city.id] = {
                            name: city.name,
                            lat: city.lat,
                            lng: city.lng,
                            stats: city.stats
                        };
                    });
                } catch (insertError) {
                    console.warn('Не удалось создать города:', insertError);
                    // Используем локальные данные
                    this.cities = {};
                    cities.forEach(city => {
                        this.cities[city.id] = {
                            name: city.name,
                            lat: city.lat,
                            lng: city.lng,
                            stats: city.stats
                        };
                    });
                }
            } else {
                // Преобразуем данные из Supabase в нужный формат
                this.cities = {};
                data.forEach(city => {
                    this.cities[city.id] = {
                        name: city.name,
                        lat: city.lat || 55.7558,
                        lng: city.lng || 37.6173,
                        stats: city.stats || '0 площадок • 0 команд'
                    };
                });
            }
            
            this.renderCities();
            
        } catch (error) {
            console.error('❌ Ошибка загрузки городов:', error);
            // Используем базовые города в случае ошибки
            const cities = [
                { id: 'moscow', name: 'Москва', lat: 55.7558, lng: 37.6173, stats: '12 площадок • 48 команд' },
                { id: 'kaluga', name: 'Калуга', lat: 54.5293, lng: 36.2754, stats: '5 площадок • 16 команд' },
                { id: 'obninsk', name: 'Обнинск', lat: 55.0968, lng: 36.6101, stats: '3 площадки • 12 команд' }
            ];
            
            this.cities = {};
            cities.forEach(city => {
                this.cities[city.id] = {
                    name: city.name,
                    lat: city.lat,
                    lng: city.lng,
                    stats: city.stats
                };
            });
            
            this.renderCities();
        }
    },

    // Отображение городов
    renderCities() {
        const container = document.getElementById('city-list');
        if (!container || !this.cities) return;

        container.innerHTML = '';
        Object.entries(this.cities).forEach(([id, city]) => {
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

    // Показать экран выбора роли
    showRoleSelection() {
        screenManager.show('screen-role');
        this.selectedRole = 'fan';
        this.updateRoleUI();
    },

    // Обновление UI выбора роли
    updateRoleUI() {
        document.querySelectorAll('.role-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.role === this.selectedRole);
        });

        utils.toggleActive(
            document.querySelector(`.role-option[data-role="${this.selectedRole}"]`),
            document.querySelector('.role-selector')
        );

        utils.hide('role-info-fan');
        utils.hide('role-info-organizer');
        utils.show(`role-info-${this.selectedRole}`);

        const btn = document.getElementById('continue-btn');
        btn.textContent = this.selectedRole === 'organizer' ? 'Перейти к оплате' : 'Продолжить';
    },

    // Выбор роли
    selectRole(role) {
        this.selectedRole = role;
        this.updateRoleUI();
    },

    // Переход к экрану авторизации
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

    // Назад к выбору роли
    backToRole() {
        screenManager.show('screen-role');
    },

    // Показать экран входа
    showLogin() {
        screenManager.show('screen-login');
    },

    // Обработка входа
    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            alert('Заполните все поля');
            return;
        }

        const loginBtn = document.getElementById('login-btn');
        const originalText = loginBtn.textContent;
        loginBtn.textContent = 'Вход...';
        loginBtn.disabled = true;

        try {
            const result = await authModule.login({ email, password });
            
            if (result.success) {
                this.currentUser = result.user;
                this.showMain();
            } else {
                alert('Ошибка входа: ' + result.error);
            }
        } catch (error) {
            console.error('Ошибка входа:', error);
            alert('Ошибка входа. Попробуйте позже.');
        } finally {
            loginBtn.textContent = originalText;
            loginBtn.disabled = false;
        }
    },

    // Восстановление пароля
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

    // Регистрация
    async register() {
        const nickname = document.getElementById('reg-nickname').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const phone = document.getElementById('reg-phone')?.value;

        if (!nickname || !email || !password) {
            alert('Заполните все обязательные поля');
            return;
        }

        if (password.length < 6) {
            alert('Пароль должен быть не менее 6 символов');
            return;
        }

        const regBtn = document.getElementById('reg-btn');
        const originalText = regBtn.textContent;
        regBtn.textContent = 'Регистрация...';
        regBtn.disabled = true;

        try {
            const result = await authModule.register({
                nickname,
                email,
                password,
                role: this.selectedRole,
                phone: this.selectedRole === 'organizer' ? phone : null
            });

            if (result.success) {
                this.currentUser = result.user;
                alert('Регистрация успешна!');
                
                if (this.selectedRole === 'organizer') {
                    this.showPayment();
                } else {
                    this.showCitySelection();
                }
            } else {
                alert('Ошибка регистрации: ' + result.error);
            }
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            alert('Ошибка регистрации. Попробуйте позже.');
        } finally {
            regBtn.textContent = originalText;
            regBtn.disabled = false;
        }
    },



    // Показать выбор города
    showCitySelection() {
        screenManager.show('screen-city');
    },

    // Выбор города
    selectCity(cityId) {
        this.currentCity = cityId;
        const cityName = this.cities[cityId]?.name || 'Город';
        
        document.querySelectorAll('#current-city-name').forEach(el => {
            el.textContent = cityName;
        });

        this.showMain();
    },

    // Показать главный экран
    showMain() {
        screenManager.show('screen-main');
        
        // Обновляем UI пользователя
        this.updateUserUI();
        
        // Показываем/скрываем элементы в зависимости от роли
        this.updateRoleBasedUI();
        
        // Загружаем матчи
        this.renderMatches();
    },

    // Обновление UI пользователя
    updateUserUI() {
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
        }
    },

    // Обновление UI в зависимости от роли
    updateRoleBasedUI() {
        if (!authModule.isAuthenticated()) return;
        
        const user = authModule.currentUser;
        
        // Показываем/скрываем элементы навигации
        utils.toggleVisibility('nav-teams-btn', authModule.hasRole('organizer'));
        utils.toggleVisibility('nav-create-btn', authModule.isProActive());
        
        // Баннер просрочки
        utils.toggleVisibility('paywall-banner', 
            user.role === 'organizer' && !authModule.isProActive()
        );
        
        // Показываем нижнюю навигацию
        utils.toggleVisibility('bottom-nav', true);
    },

    // Загрузка матчей из Supabase
async renderMatches() {
    const container = document.getElementById('matches-list');
    if (!container) return;

    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">Загрузка матчей...</div>';

    try {
        // Сначала получим ID команд в текущем городе
        const { data: teamsInCity, error: teamsError } = await this.supabase
            .from('teams')
            .select('id')
            .eq('city', this.currentCity);

        if (teamsError) throw teamsError;

        let matches = [];
        
        if (teamsInCity && teamsInCity.length > 0) {
            const teamIds = teamsInCity.map(t => t.id);
            const teamIdsString = teamIds.join(',');
            
            // Используем правильный синтаксис для or()
            const { data: matchesData, error: matchesError } = await this.supabase
                .from('matches')
                .select(`
                    *,
                    team1:teams!matches_team1_fkey(*),
                    team2:teams!matches_team2_fkey(*)
                `)
                .or(`team1.in.(${teamIdsString}),team2.in.(${teamIdsString})`)
                .order('date', { ascending: true });

            if (matchesError) throw matchesError;
            matches = matchesData || [];
        }

        // Очищаем контейнер
        container.innerHTML = '';

        if (!matches || matches.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Нет предстоящих матчей</div>';
            return;
        }

            // Фильтрация по виду спорта
            let filteredMatches = matches;
            if (this.currentFilter !== 'all') {
                filteredMatches = matches.filter(match => match.sport === this.currentFilter);
            }

            if (filteredMatches.length === 0) {
                container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Нет матчей по виду спорта "${this.getSportName(this.currentFilter)}"</div>`;
                return;
            }

            // Рендерим матчи
            filteredMatches.forEach(match => {
                const t1 = match.team1;
                const t2 = match.team2;
                
                const card = document.createElement('div');
                card.className = 'match-card';
                card.onclick = () => this.showMatchDetail(match.id);
                
                card.innerHTML = `
    <div class="match-header">
        <span class="sport-badge">
            <i class="fas fa-${this.getSportIcon(match.sport)}"></i>
            ${this.getSportName(match.sport)}
        </span>
        <span class="match-status status-${match.status || 'upcoming'}">
            ${this.getStatusText(match.status)}
        </span>
    </div>
    <div class="teams-row">
        <div class="team">
            <div class="team-avatar">${t1?.avatar || '?'}</div>
            <div class="team-name">${t1?.name || 'Команда 1'}</div>
        </div>
        <div class="vs">VS</div>
        <div class="team" style="justify-content: flex-end;">
            <div style="text-align: right; margin-right: 8px;">
                <div class="team-name">${t2?.name || 'Команда 2'}</div>
            </div>
            <div class="team-avatar">${t2?.avatar || '?'}</div>
        </div>
    </div>
    <div class="match-info">
        <span><i class="far fa-clock"></i> ${this.formatDateTime(match.date)}</span>
        <span><i class="fas fa-map-marker-alt"></i> ${match.location || 'Стадион'}</span>
    </div>
`;
                container.appendChild(card);
            });

        } catch (error) {
            console.error('❌ Ошибка загрузки матчей:', error);
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--accent-pink);">Ошибка загрузки матчей</div>';
        }
    },

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

    // Текст статуса матча
    getStatusText(status) {
        const statusMap = {
            'upcoming': 'СКОРО',
            'live': 'ИДЁТ',
            'finished': 'ЗАВЕРШЁН',
            'cancelled': 'ОТМЕНЁН'
        };
        return statusMap[status] || 'СКОРО';
    },

    // Фильтрация по виду спорта
    filterSport(sport) {
        this.currentFilter = sport;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent.toLowerCase().includes(
                sport === 'all' ? 'все' : 
                sport === 'football' ? 'футбол' :
                sport === 'volleyball' ? 'волейбол' : 'баскетбол'
            ));
        });
        this.renderMatches();
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

    // Получение названия вида спорта
    getSportName(sport) {
        const names = {
            football: 'Футбол',
            volleyball: 'Волейбол',
            basketball: 'Баскетбол'
        };
        return names[sport] || sport;
    },

    // Показать детали матча
async showMatchDetail(matchId) {
    try {
        const { data: match, error } = await this.supabase
            .from('matches')
            .select(`
                *,
                team1:teams!matches_team1_fkey(*),
                team2:teams!matches_team2_fkey(*)
            `)
            .eq('id', matchId)
            .single();

        if (error) throw error;

        if (!match) {
            alert('Матч не найден');
            return;
        }

        this.selectedMatch = match;
        screenManager.show('screen-match');

        const content = document.getElementById('match-detail-content');
        const t1 = match.team1;
        const t2 = match.team2;

        if (content) {
            // СОЗДАЕМ HTML ДЛЯ КОМАНД С ПРОВЕРКОЙ НА NULL
            let teamsHTML = '';
            
            // Команда 1 (обязательно должна быть)
            if (t1) {
                teamsHTML += `
                    <div class="detail-team" onclick="teamModule.show('${t1.id}')" style="cursor: pointer;">
                        <div class="team-avatar" style="width: 80px; height: 80px; font-size: 2.5rem; margin: 0 auto 10px; border-color: var(--accent-green); transition: transform 0.2s;" 
                             onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                            ${t1.avatar || '⚽'}
                        </div>
                        <div style="font-weight: 700; font-size: 1.1rem;">${t1.name || 'Команда 1'}</div>
                        <div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 4px;">Состав →</div>
                    </div>
                `;
            } else {
                teamsHTML += `
                    <div class="detail-team">
                        <div class="team-avatar" style="width: 80px; height: 80px; font-size: 2.5rem; margin: 0 auto 10px; border-color: var(--text-secondary);">
                            ?
                        </div>
                        <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-secondary);">Неизвестно</div>
                    </div>
                `;
            }
            
            // Счет
            teamsHTML += `
                <div style="font-family: var(--font-display); font-size: 2.5rem; color: var(--accent-green);">
                    ${match.score || '0:0'}
                </div>
            `;
            
            // Команда 2 (может быть null)
            if (t2) {
                teamsHTML += `
                    <div class="detail-team" onclick="teamModule.show('${t2.id}')" style="cursor: pointer;">
                        <div class="team-avatar" style="width: 80px; height: 80px; font-size: 2.5rem; margin: 0 auto 10px; border-color: var(--accent-green); transition: transform 0.2s;" 
                             onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                            ${t2.avatar || '⚽'}
                        </div>
                        <div style="font-weight: 700; font-size: 1.1rem;">${t2.name || 'Команда 2'}</div>
                        <div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 4px;">Состав →</div>
                    </div>
                `;
            } else {
                teamsHTML += `
                    <div class="detail-team">
                        <div class="team-avatar" style="width: 80px; height: 80px; font-size: 2.5rem; margin: 0 auto 10px; border-color: var(--text-secondary);">
                            ?
                        </div>
                        <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-secondary);">Ждём соперника</div>
                    </div>
                `;
            }

            content.innerHTML = `
                <div class="form-section" style="text-align: center; padding: 30px 20px;">
                    <div style="display: flex; justify-content: space-around; align-items: center; margin: 20px 0;">
                        ${teamsHTML}
                    </div>
                    <span class="match-status status-${match.status || 'upcoming'}">${this.getStatusText(match.status)}</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px;">
                    <div class="form-section" style="margin: 0;">
                        <div style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 4px;">Когда</div>
                        <div style="font-weight: 700;">${this.formatDateTime(match.date)}</div>
                    </div>
                    <div class="form-section" style="margin: 0;">
                        <div style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 4px;">Где</div>
                        <div style="font-weight: 700;">${match.location || 'Стадион'}</div>
                    </div>
                </div>
            `;
        }

        // Показываем/скрываем кнопку вызова
        const canChallenge = authModule.isAuthenticated() && 
            authModule.hasRole('organizer') &&
            authModule.isProActive();
        
        utils.toggleVisibility('challenge-section', canChallenge);

        // Инициализируем карту, если есть координаты
        if (match.lat && match.lng) {
            setTimeout(() => this.initMap(match.lat, match.lng, match.location), 100);
        }

        // Показываем комментарии и реакции
        this.renderReactions(matchId);
        this.renderComments(matchId);

    } catch (error) {
        console.error('❌ Ошибка загрузки матча:', error);
        alert('Ошибка загрузки матча: ' + error.message);
    }
},

    // Инициализация карты
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

    // Показать команды
    showTeams() {
        if (!authModule.isAuthenticated()) {
            alert('Сначала войдите в систему');
            this.showRoleSelection();
            return;
        }
        
        screenManager.show('screen-teams');
        this.renderMyTeams();
    },

    // Загрузка моих команд из Supabase
    async renderMyTeams() {
        const container = document.getElementById('teams-list');
        if (!container) return;

        container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 20px;">Загрузка команд...</div>';

        try {
            const userId = authModule.getUserId();
            if (!userId) {
                throw new Error('Пользователь не авторизован');
            }

            const { data: teams, error } = await this.supabase
                .from('teams')
                .select(`
                    *,
                    players:team_players(*)
                `)
                .eq('owner_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            container.innerHTML = '';

            if (!teams || teams.length === 0) {
                container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 40px;">У тебя пока нет команд</div>';
                return;
            }

            container.innerHTML = teams.map(team => {
                const playerCount = team.players?.length || 0;
                return `
                    <div class="team-manage-card" onclick="teamEditModule.show('${team.id}')">
                        <div class="team-avatar" style="width: 50px; height: 50px; font-size: 1.5rem; border-color: var(--accent-green);">
                            ${team.avatar || '⚽'}
                        </div>
                        <div class="team-info">
                            <div class="team-name">${team.name}</div>
                            <div class="team-stats">${team.wins || 0} побед • ${playerCount} игроков</div>
                        </div>
                        <i class="fas fa-chevron-right" style="color: var(--text-secondary);"></i>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('❌ Ошибка загрузки команд:', error);
            container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 40px;">Ошибка загрузки команд</div>';
        }
    },

    // Показать создание команды
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

    // Создание команды в Supabase
    async createTeam() {
        const name = document.getElementById('team-name').value;
        const avatar = document.getElementById('team-avatar').value || '⚽';
        const sport = document.getElementById('team-sport').value;

        if (!name) {
            alert('Введите название команды');
            return;
        }

        if (!authModule.isAuthenticated()) {
            alert('Сначала войдите в систему');
            return;
        }

        if (!authModule.hasRole('organizer')) {
            alert('Только организаторы могут создавать команды');
            return;
        }

        const userId = authModule.getUserId();
        if (!userId) {
            alert('Ошибка получения ID пользователя');
            return;
        }

        try {
            // Создаём команду в Supabase
            const { data: team, error } = await this.supabase
                .from('teams')
                .insert([{
                    name,
                    city: this.currentCity,
                    sport,
                    avatar,
                    owner_id: userId,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;

            // Создаём запись капитана в составе
            await this.supabase
                .from('team_players')
                .insert([{
                    team_id: team.id,
                    name: authModule.currentUser?.nickname || 'Капитан',
                    number: 10,
                    role: 'Капитан',
                    is_captain: true,
                    created_at: new Date().toISOString()
                }]);

            alert('Команда создана!');
            this.showTeams();

        } catch (error) {
            console.error('❌ Ошибка создания команды:', error);
            alert('Ошибка создания команды: ' + error.message);
        }
    },

    // Показать создание матча
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
        
        // Загружаем команды пользователя
        this.loadUserTeamsForMatch();
    },

    // Загрузка команд для создания матча
    async loadUserTeamsForMatch() {
        const userId = authModule.getUserId();
        if (!userId) return;

        try {
            const { data: myTeams, error } = await this.supabase
                .from('teams')
                .select('*')
                .eq('owner_id', userId)
                .order('name');

            if (error) throw error;

            const teamSelect = document.getElementById('match-team');
            teamSelect.innerHTML = myTeams.map(t => 
                `<option value="${t.id}">${t.name}</option>`
            ).join('');

            // Загружаем команды соперников
            this.loadOpponentTeams();

        } catch (error) {
            console.error('❌ Ошибка загрузки команд:', error);
            alert('Ошибка загрузки команд');
        }
    },

    // Загрузка команд соперников
    async loadOpponentTeams() {
        const userId = authModule.getUserId();
        if (!userId) return;

        try {
            const { data: opponents, error } = await this.supabase
                .from('teams')
                .select('*')
                .neq('owner_id', userId)
                .eq('city', this.currentCity)
                .order('name');

            if (error) throw error;

            const opponentSelect = document.getElementById('match-opponent');
            opponentSelect.innerHTML = '<option value="">Открытый матч (без соперника)</option>' + 
                (opponents?.map(t => `<option value="${t.id}">${t.name}</option>`).join('') || '');

        } catch (error) {
            console.error('❌ Ошибка загрузки команд соперников:', error);
        }
    },

    // Создание матча в Supabase
    async createMatch() {
        const teamId = document.getElementById('match-team').value;
        const opponentId = document.getElementById('match-opponent').value;
        const datetime = document.getElementById('match-datetime').value;
        const location = document.getElementById('match-location').value;
		    const lat = document.getElementById('match-lat').value;  // ОБЯЗАТЕЛЬНО добавьте эту строку
    const lng = document.getElementById('match-lng').value;  // ОБЯЗАТЕЛЬНО добавьте эту строку

        if (!teamId || !datetime || !location) {
            alert('Заполните все обязательные поля');
            return;
        }

        if (!authModule.isAuthenticated() || !authModule.hasRole('organizer') || !authModule.isProActive()) {
            alert('Только организаторы с активной подпиской могут создавать матчи');
            return;
        }

        try {
            // Проверяем, принадлежит ли команда пользователю
            const userId = authModule.getUserId();
            const { data: team, error: teamError } = await this.supabase
                .from('teams')
                .select('*')
                .eq('id', teamId)
                .eq('owner_id', userId)
                .single();

            if (teamError || !team) {
                alert('Вы можете создавать матчи только для своих команд');
                return;
            }

            // Создаём матч в Supabase
             const { data: match, error: matchError } = await this.supabase
            .from('matches')
            .insert([{
                sport: team.sport,
                team1: teamId,
                team2: opponentId || null,
                date: datetime,
                location,
                lat: lat || null,
                lng: lng || null,
                city: this.currentCity,
                status: 'upcoming',
                score: '0:0',
                created_by: userId,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

            if (matchError) throw matchError;

            alert('Матч создан!');
            this.showMain();

        } catch (error) {
            console.error('❌ Ошибка создания матча:', error);
            alert('Ошибка создания матча: ' + error.message);
        }
    },

    // Бросок вызова
    async challengeTeam() {
        if (!authModule.isAuthenticated() || !authModule.hasRole('organizer') || !authModule.isProActive()) {
            alert('Только организаторы с активной подпиской могут бросать вызовы');
            return;
        }
        
        if (!this.selectedMatch) {
            alert('Матч не выбран');
            return;
        }
        
        if (confirm('Бросить вызов на этот матч?')) {
            try {
                // Создаем запись о вызове в Supabase
                const { error } = await this.supabase
                    .from('challenges')
                    .insert([{
                        from_team_id: null, // ID команды пользователя
                        to_team_id: this.selectedMatch.team1?.id || this.selectedMatch.team2?.id,
                        status: 'pending',
                        created_at: new Date().toISOString()
                    }]);

                if (error) throw error;

                alert('Вызов отправлен! Ожидайте подтверждения.');
            } catch (error) {
                console.error('❌ Ошибка отправки вызова:', error);
                alert('Ошибка отправки вызова');
            }
        }
    },

    // Показать профиль
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
            const subCard = document.getElementById('subscription-card');
            if (subCard) {
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
            }
        }
    },

    // Показать оплату
    showPayment() {
        this.paymentType = 'upgrade';
        document.getElementById('payment-modal').classList.add('active');
    },

    // Закрыть оплату
    closePayment() {
        document.getElementById('payment-modal').classList.remove('active');
        this.paymentType = null;
    },

    // Обработка оплаты
    async processPayment() {
        const paymentBtn = document.querySelector('#payment-modal .btn-gold');
        const originalText = paymentBtn.textContent;
        paymentBtn.textContent = 'Обработка...';
        paymentBtn.disabled = true;

        try {
            // Обновляем профиль пользователя для PRO подписки
            const result = await authModule.upgradeToPro();
            
            if (result.success) {
                this.currentUser = result.user;
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

    // Назад к матчу
    backToMatch() {
        if (this.selectedMatch) {
            this.showMatchDetail(this.selectedMatch.id);
        } else {
            this.showMain();
        }
    },

    // Выход
    async logout() {
        if (confirm('Выйти из аккаунта?')) {
            const result = await authModule.logout();
            
            if (result.success) {
                this.currentUser = null;
                setTimeout(() => {
                    this.showRoleSelection();
                }, 500);
            }
        }
    },

    // Показать хаб
    showHub() {
        screenManager.show('screen-hub');
        this.renderHub();
    },

    // Рендер хаба
    async renderHub() {
        await this.renderHubEvents();
        await this.renderHubMatches();
        this.renderHubRecommended();
    },

    // События в хабе из Supabase
    async renderHubEvents() {
        const container = document.getElementById('hub-events-list');
        if (!container) return;

        try {
            const { data: events, error } = await this.supabase
                .from('events')
                .select('*')
                .eq('city', this.currentCity)
                .gte('date', new Date().toISOString())
                .order('date', { ascending: true })
                .limit(5);

            if (error) throw error;

            if (!events || events.length === 0) {
                container.innerHTML = '<div class="empty-state">Нет событий на ближайшие дни</div>';
                return;
            }

            container.innerHTML = events.map(event => `
                <div class="hub-card event-card" onclick="app.showEventDetail('${event.id}')" style="--event-color: ${event.color || '#00ff88'}">
                    <div class="hub-card-icon" style="background: ${event.color || '#00ff88'}20; color: ${event.color || '#00ff88'}">
                        ${event.icon || '🎯'}
                    </div>
                    <div class="hub-card-content">
                        <div class="hub-card-header">
                            <span class="hub-card-type">${this.getEventTypeName(event.type)}</span>
                            <span class="hub-card-price">${event.price || 'Бесплатно'}</span>
                        </div>
                        <h4 class="hub-card-title">${event.title}</h4>
                        <p class="hub-card-desc">${event.description}</p>
                        <div class="hub-card-meta">
                            <span><i class="far fa-clock"></i> ${this.formatDateTime(event.date)}</span>
                            <span><i class="fas fa-map-marker-alt"></i> ${event.location}</span>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('❌ Ошибка загрузки событий:', error);
            container.innerHTML = '<div class="empty-state">Ошибка загрузки событий</div>';
        }
    },

    // Матчи в хабе из Supabase
    async renderHubMatches() {
        const container = document.getElementById('hub-matches-list');
        if (!container) return;

        try {
            // Получаем матчи на текущую неделю
            const now = new Date();
            const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            const { data: weekMatches, error } = await this.supabase
                .from('matches')
                .select(`
                    *,
                    team1:teams!matches_team1_fkey(*),
                    team2:teams!matches_team2_fkey(*)
                `)
                .eq('city', this.currentCity)
                .eq('status', 'upcoming')
                .gte('date', now.toISOString())
                .lte('date', nextWeek.toISOString())
                .order('date', { ascending: true })
                .limit(3);

            if (error) throw error;

            if (!weekMatches || weekMatches.length === 0) {
                container.innerHTML = '<div class="empty-state">Нет предстоящих матчей на этой неделе</div>';
                return;
            }

            container.innerHTML = weekMatches.map(match => {
                const t1 = match.team1;
                const t2 = match.team2;
                return `
                    <div class="hub-card match-card-compact" onclick="app.showMatchDetail('${match.id}')">
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
                            <span class="hub-match-time"><i class="far fa-clock"></i> ${this.formatDateTime(match.date)}</span>
                            <span class="hub-match-location"><i class="fas fa-map-marker-alt"></i> ${match.location || 'Стадион'}</span>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('❌ Ошибка загрузки матчей:', error);
            container.innerHTML = '<div class="empty-state">Ошибка загрузки матчей</div>';
        }
    },

    // Рекомендации в хабе
    async renderHubRecommended() {
        const container = document.getElementById('hub-recommended-list');
        if (!container) return;

        try {
            // Получаем популярные события
            const { data: popularEvents, error } = await this.supabase
                .from('events')
                .select('*')
                .eq('city', this.currentCity)
                .gte('date', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(2);

            if (error) throw error;

            if (!popularEvents || popularEvents.length === 0) {
                container.innerHTML = '<div class="empty-state">Нет рекомендаций</div>';
                return;
            }

            container.innerHTML = popularEvents.map(event => `
                <div class="hub-card recommendation-card" onclick="app.showEventDetail('${event.id}')">
                    <div class="hub-rec-icon" style="background: ${event.color || '#00ccff'}20; color: ${event.color || '#00ccff'}">
                        ${event.icon || '⭐'}
                    </div>
                    <div class="hub-rec-content">
                        <h4>${event.title}</h4>
                        <p>${event.description ? (event.description.substring(0, 60) + '...') : 'Нет описания'}</p>
                    </div>
                    <button class="btn btn-small btn-secondary">Подробнее</button>
                </div>
            `).join('');

        } catch (error) {
            console.error('❌ Ошибка загрузки рекомендаций:', error);
            container.innerHTML = '<div class="empty-state">Ошибка загрузки рекомендаций</div>';
        }
    },

    // Фильтрация в хабе
    async filterHub(type) {
        this.currentHubFilter = type;
        
        document.querySelectorAll('.hub-filter').forEach(btn => {
            btn.classList.toggle('active', btn.textContent.toLowerCase().includes(
                type === 'all' ? 'всё' : 
                type === 'events' ? 'события' :
                type === 'matches' ? 'матчи' : 'тренировки'
            ));
        });

        await this.renderHub();
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
    },

    // Показать детали события
    async showEventDetail(eventId) {
        try {
            const { data: event, error } = await this.supabase
                .from('events')
                .select('*')
                .eq('id', eventId)
                .single();

            if (error) throw error;

            alert(`${event.title}\n\n${event.description || 'Нет описания'}\n\n📍 ${event.location}\n🕐 ${this.formatDateTime(event.date)}\n💰 ${event.price || 'Бесплатно'}`);
        } catch (error) {
            console.error('❌ Ошибка загрузки события:', error);
            alert('Ошибка загрузки события');
        }
    },

    // Комментарии и реакции
    async renderReactions(matchId) {
        const container = document.getElementById('match-reactions');
        if (!container) return;

        try {
            // Получаем реакции для матча
            const { data: reactions, error } = await this.supabase
                .from('reactions')
                .select('emoji, user_id')
                .eq('match_id', matchId);

            if (error) throw error;

            // Группируем реакции по эмодзи
            const reactionStats = {};
            const reactionTypes = ['🔥', '❤️', '👍', '😮', '🏆'];
            
            // Инициализируем счетчики
            reactionTypes.forEach(emoji => {
                reactionStats[emoji] = 0;
            });

            // Считаем реакции
            reactions?.forEach(reaction => {
                if (reactionStats[reaction.emoji] !== undefined) {
                    reactionStats[reaction.emoji]++;
                }
            });

            // Получаем реакцию текущего пользователя
            let myReaction = null;
            if (authModule.isAuthenticated()) {
                const myReactionData = reactions?.find(r => r.user_id === authModule.getUserId());
                myReaction = myReactionData?.emoji;
            }

            let html = '<div class="reactions-bar">';
            
            reactionTypes.forEach(emoji => {
                const count = reactionStats[emoji] || 0;
                const isActive = myReaction === emoji;
                
                html += `
                    <button class="reaction-btn ${isActive ? 'active' : ''} ${count > 0 ? 'has-count' : ''}" 
                            onclick="app.toggleReaction('${matchId}', '${emoji}')">
                        <span class="reaction-emoji">${emoji}</span>
                        ${count > 0 ? `<span class="reaction-count">${count}</span>` : ''}
                    </button>
                `;
            });
            
            html += '</div>';
            container.innerHTML = html;

        } catch (error) {
            console.error('❌ Ошибка загрузки реакций:', error);
            container.innerHTML = '<div class="empty-state">Ошибка загрузки реакций</div>';
        }
    },

    async toggleReaction(matchId, emoji) {
        if (!authModule.isAuthenticated()) {
            alert('Для реакции войдите в систему');
            return;
        }

        try {
            const userId = authModule.getUserId();
            
            // Проверяем, есть ли уже реакция от пользователя
            const { data: existingReaction, error: checkError } = await this.supabase
                .from('reactions')
                .select('id, emoji')
                .eq('match_id', matchId)
                .eq('user_id', userId)
                .maybeSingle();

            if (checkError) throw checkError;

            if (existingReaction) {
                if (existingReaction.emoji === emoji) {
                    // Удаляем реакцию, если кликнули на ту же
                    const { error: deleteError } = await this.supabase
                        .from('reactions')
                        .delete()
                        .eq('id', existingReaction.id);

                    if (deleteError) throw deleteError;
                } else {
                    // Обновляем реакцию
                    const { error: updateError } = await this.supabase
                        .from('reactions')
                        .update({ emoji })
                        .eq('id', existingReaction.id);

                    if (updateError) throw updateError;
                }
            } else {
                // Добавляем новую реакцию
                const { error: insertError } = await this.supabase
                    .from('reactions')
                    .insert([{
                        match_id: matchId,
                        user_id: userId,
                        emoji,
                        created_at: new Date().toISOString()
                    }]);

                if (insertError) throw insertError;
            }

            // Обновляем отображение реакций
            this.renderReactions(matchId);

        } catch (error) {
            console.error('❌ Ошибка обработки реакции:', error);
            alert('Ошибка обработки реакции');
        }
    },

    async renderComments(matchId) {
        const container = document.getElementById('comments-list');
        const countBadge = document.getElementById('comments-count');
        if (!container) return;

        try {
            const { data: comments, error } = await this.supabase
                .from('comments')
                .select(`
                    *,
                    user:profiles(nickname)
                `)
                .eq('match_id', matchId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (countBadge) countBadge.textContent = comments?.length || 0;

            if (!comments || comments.length === 0) {
                container.innerHTML = '<div class="empty-comments">Пока нет комментариев. Будь первым!</div>';
                return;
            }

            container.innerHTML = comments.map(comment => `
                <div class="comment-item">
                    <div class="comment-avatar">${comment.user?.nickname?.[0]?.toUpperCase() || 'U'}</div>
                    <div class="comment-content">
                        <div class="comment-header">
                            <span class="comment-author">${comment.user?.nickname || 'Пользователь'}</span>
                            <span class="comment-time">${this.formatTimeAgo(comment.created_at)}</span>
                        </div>
                        <div class="comment-text">${comment.text}</div>
                        <div class="comment-actions">
                            <button class="comment-like" onclick="app.likeComment('${comment.id}')">
                                <i class="fas fa-heart"></i>
                                <span>${comment.likes || 0}</span>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('❌ Ошибка загрузки комментариев:', error);
            container.innerHTML = '<div class="empty-comments">Ошибка загрузки комментариев</div>';
        }
    },

    async addComment(matchId, text) {
        if (!authModule.isAuthenticated()) {
            alert('Для комментирования войдите в систему');
            return;
        }

        const commentInput = document.getElementById('comment-input');
        const commentText = text || (commentInput ? commentInput.value : '');

        if (!commentText.trim()) {
            alert('Введите текст комментария');
            return;
        }

        try {
            const userId = authModule.getUserId();
            
            const { error } = await this.supabase
                .from('comments')
                .insert([{
                    match_id: matchId,
                    user_id: userId,
                    text: commentText.trim(),
                    created_at: new Date().toISOString()
                }]);

            if (error) throw error;

            // Очищаем поле ввода
            if (commentInput) commentInput.value = '';

            // Обновляем комментарии
            this.renderComments(matchId);

        } catch (error) {
            console.error('❌ Ошибка добавления комментария:', error);
            alert('Ошибка добавления комментария');
        }
    },

    async likeComment(commentId) {
        if (!authModule.isAuthenticated()) {
            alert('Для оценки комментариев войдите в систему');
            return;
        }

        try {
            const userId = authModule.getUserId();
            
            // Проверяем, есть ли уже лайк
            const { data: existingLike, error: checkError } = await this.supabase
                .from('comment_likes')
                .select('id')
                .eq('comment_id', commentId)
                .eq('user_id', userId)
                .maybeSingle();

            if (checkError) throw checkError;

            if (existingLike) {
                // Удаляем лайк
                const { error: deleteError } = await this.supabase
                    .from('comment_likes')
                    .delete()
                    .eq('id', existingLike.id);

                if (deleteError) throw deleteError;
            } else {
                // Добавляем лайк
                const { error: insertError } = await this.supabase
                    .from('comment_likes')
                    .insert([{
                        comment_id: commentId,
                        user_id: userId,
                        created_at: new Date().toISOString()
                    }]);

                if (insertError) throw insertError;
            }

            // Получаем ID матча для обновления комментариев
            const { data: comment } = await this.supabase
                .from('comments')
                .select('match_id')
                .eq('id', commentId)
                .single();

            if (comment) {
                this.renderComments(comment.match_id);
            }

        } catch (error) {
            console.error('❌ Ошибка обработки лайка:', error);
            alert('Ошибка обработки лайка');
        }
    },

    // Форматирование времени
    formatTimeAgo(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000); // Разница в секундах

        if (diff < 60) return 'только что';
        if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
        if (diff < 604800) return `${Math.floor(diff / 86400)} д назад`;
        return date.toLocaleDateString('ru-RU');
    },

    // Вспомогательная функция для обновления UI
    updateUI() {
        if (typeof this.updateUserUI === 'function') {
            this.updateUserUI();
        }
        if (typeof this.updateRoleBasedUI === 'function') {
            this.updateRoleBasedUI();
        }
    },
	
	
	 // Метод открытия карты для выбора местоположения
    openMapForLocation() {
        // Показываем модальное окно
        const modal = document.getElementById('location-picker-modal');
        modal.classList.remove('hidden');
        modal.classList.add('active');
        
        // Инициализируем карту (немного подождем, чтобы DOM обновился)
        setTimeout(() => {
            this.initLocationMap();
        }, 100);
    },
    
    // Инициализация карты для выбора места
initLocationMap() {
    if (!this.ymapsReady) {
        alert('Карты загружаются. Попробуйте через пару секунд.');
        return;
    }
    
    const mapContainer = document.getElementById('location-map');
    if (!mapContainer) return;
    
    // Убедимся, что контейнер видим и имеет размеры
    mapContainer.style.height = '400px';
    mapContainer.style.minHeight = '400px';
    
    // Определяем центр карты (текущий город или координаты по умолчанию)
    const city = this.cities[this.currentCity];
    const center = city ? [city.lat, city.lng] : [55.7558, 37.6173];
    
    // Создаем карту
    this.locationMap = new ymaps.Map("location-map", {
        center: center,
        zoom: 13,
        controls: ['zoomControl', 'searchControl', 'fullscreenControl']
    });
    
    // Добавляем обработчик клика на карту
    this.locationMap.events.add('click', (e) => {
        this.handleMapClick(e);
    });
    
    // Если уже были выбраны координаты, показываем их
    const lat = document.getElementById('match-lat').value;
    const lng = document.getElementById('match-lng').value;
    
    if (lat && lng) {
        this.showSelectedPoint([parseFloat(lat), parseFloat(lng)]);
        this.reverseGeocode([parseFloat(lat), parseFloat(lng)]);
    }
},
    
    // Обработка клика на карту
    handleMapClick(e) {
        const coords = e.get('coords');
        
        // Удаляем предыдущую метку
        if (this.selectedPlacemark) {
            this.locationMap.geoObjects.remove(this.selectedPlacemark);
        }
        
        // Создаем новую метку
        this.selectedPlacemark = new ymaps.Placemark(coords, {
            hintContent: 'Выбранное место',
            balloonContent: 'Место проведения матча'
        }, {
            preset: 'islands#redDotIcon',
            draggable: true
        });
        
        // Добавляем метку на карту
        this.locationMap.geoObjects.add(this.selectedPlacemark);
        
        // Сохраняем координаты
        this.selectedCoords = coords;
        
        // Обновляем отображение координат
        this.updateCoordinatesDisplay(coords);
        
        // Пытаемся получить адрес по координатам (обратное геокодирование)
        this.reverseGeocode(coords);
        
        // Обработка перемещения метки
        this.selectedPlacemark.events.add('dragend', () => {
            const newCoords = this.selectedPlacemark.geometry.getCoordinates();
            this.selectedCoords = newCoords;
            this.updateCoordinatesDisplay(newCoords);
            this.reverseGeocode(newCoords);
        });
    },
    
    // Обновление отображения координат
    updateCoordinatesDisplay(coords) {
        const lat = coords[0].toFixed(6);
        const lng = coords[1].toFixed(6);
        
        document.getElementById('coordinates-text').textContent = `${lat}, ${lng}`;
    },
    
    // Обратное геокодирование (получение адреса по координатам)
    reverseGeocode(coords) {
        ymaps.geocode(coords).then((res) => {
            const firstGeoObject = res.geoObjects.get(0);
            
            if (firstGeoObject) {
                // Автоматически заполняем поля адреса
                const address = firstGeoObject.getAddressLine();
                const name = firstGeoObject.getLocalities().length > 0 ? 
                    firstGeoObject.getLocalities()[0] : 
                    firstGeoObject.getThoroughfare() || 'Выбранное место';
                
                document.getElementById('location-name').value = name;
                document.getElementById('location-address').value = address;
                
                // Обновляем подсказку на метке
                this.selectedPlacemark.properties.set({
                    hintContent: name,
                    balloonContent: address
                });
            }
        }).catch((error) => {
            console.error('Ошибка геокодирования:', error);
        });
    },
    
    // Показать уже выбранную точку
    showSelectedPoint(coords) {
        if (!this.locationMap) return;
        
        this.selectedCoords = coords;
        this.selectedPlacemark = new ymaps.Placemark(coords, {
            hintContent: 'Выбранное место',
            balloonContent: 'Место проведения матча'
        }, {
            preset: 'islands#greenDotIcon'
        });
        
        this.locationMap.geoObjects.add(this.selectedPlacemark);
        this.locationMap.setCenter(coords, 15);
        this.updateCoordinatesDisplay(coords);
    },
    
    // Подтверждение выбора места
    confirmLocation() {
        if (!this.selectedCoords) {
            alert('Выберите место на карте!');
            return;
        }
        
        const name = document.getElementById('location-name').value;
        const address = document.getElementById('location-address').value;
        const [lat, lng] = this.selectedCoords;
        
        // Сохраняем в скрытых полях
        document.getElementById('match-lat').value = lat;
        document.getElementById('match-lng').value = lng;
        
        // Обновляем поле местоположения в форме
        let locationText = name;
        if (address) {
            locationText += ` (${address})`;
        }
        document.getElementById('match-location').value = locationText;
        
        // Показываем информацию о выбранных координатах
        document.getElementById('location-coordinates').innerHTML = `
            <i class="fas fa-check-circle" style="color: var(--accent-green);"></i>
            Место выбрано: ${lat.toFixed(4)}, ${lng.toFixed(4)}
        `;
        
        // Закрываем модальное окно
        this.closeLocationPicker();
    },
    
    // Закрытие окна выбора места
    closeLocationPicker() {
        const modal = document.getElementById('location-picker-modal');
        modal.classList.remove('active');
        modal.classList.add('hidden');
        
        // Очищаем карту
        if (this.locationMap) {
            this.locationMap.destroy();
            this.locationMap = null;
        }
        this.selectedPlacemark = null;
        
        // Очищаем поля в модальном окне
        document.getElementById('location-name').value = '';
        document.getElementById('location-address').value = '';
        document.getElementById('coordinates-text').textContent = 'Не выбраны';
    },
    
   
	

    // Показать выбор города (для header)
    showCitySelection() {
        screenManager.show('screen-city');
    }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    // Ждём немного для инициализации всех модулей
    setTimeout(() => {
        app.init();
    }, 500);
});

// Экспортируем глобально
window.app = app;
