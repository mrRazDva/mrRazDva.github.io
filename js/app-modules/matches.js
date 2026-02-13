// js/app-modules/matches.js - Модуль работы с матчами (с бесконечной прокруткой)
const matchesModule = {
    app: null,
    liveUpdateInterval: null,
    liveMatches: [],

    // === ПЕРЕМЕННЫЕ ДЛЯ ПАГИНАЦИИ ===
    page: 1,
    limit: 6,                 // количество матчей на одной странице
    hasMore: true,
    isLoading: false,
    observer: null,            // Intersection Observer для бесконечного скролла
    // ================================

    init(appInstance) {
        this.app = appInstance;
        this.initInfiniteScroll(); // инициализируем наблюдатель
    },

    // === НОВЫЙ МЕТОД: загрузка одной страницы матчей ===
    async fetchMatches(page = 1, limit = this.limit) {
        if (!this.app || !this.app.supabase) {
            console.error('❌ Supabase client not initialized');
            return [];
        }

        try {
            // Получаем ID команд в текущем городе
            const { data: teamsInCity, error: teamsError } = await this.app.supabase
                .from('teams')
                .select('id')
                .eq('city', this.app.currentCity);

            if (teamsError) throw teamsError;

            if (!teamsInCity || teamsInCity.length === 0) {
                return [];
            }

            const teamIds = teamsInCity.map(t => t.id);
            const teamIdsString = teamIds.join(',');

            // Вычисляем диапазон для пагинации
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            // Запрос с пагинацией через range
            const { data: matches, error: matchesError } = await this.app.supabase
                .from('matches')
                .select(`
                    *,
                    team1:teams!matches_team1_fkey(*),
                    team2:teams!matches_team2_fkey(*)
                `)
                .or(`team1.in.(${teamIdsString}),team2.in.(${teamIdsString})`)
                .order('date', { ascending: true })
                .range(from, to);

            if (matchesError) throw matchesError;

            // Определяем, есть ли ещё страницы
            this.hasMore = (matches || []).length === limit;

            return matches || [];
        } catch (error) {
            console.error('❌ Ошибка загрузки матчей:', error);
            return [];
        }
    },

    // === НОВЫЙ МЕТОД: генерация HTML карточки матча ===
    generateMatchCard(match, challengeCounts = {}, userId = null) {
        const t1 = match.team1;
        const t2 = match.team2;
        const challengeCount = challengeCounts[match.id] || 0;
        const isOwner = userId && (t1?.owner_id === userId);
        const hasChallenges = isOwner && challengeCount > 0;

        const showScore = match.status === 'live' || match.status === 'finished';
        const [score1, score2] = match.score ? match.score.split(':').map(Number) : [0, 0];

        let team1Class = '', team2Class = '', scoreClass = '';
        if (showScore) {
            if (score1 > score2) {
                team1Class = 'winner';
                team2Class = 'loser';
            } else if (score2 > score1) {
                team1Class = 'loser';
                team2Class = 'winner';
            }
        }

        // Бейдж вызовов
        let challengeBadgeHTML = '';
        if (hasChallenges) {
            let challengeText = challengeCount === 1 ? '1 ВЫЗОВ' :
                challengeCount < 5 ? `${challengeCount} ВЫЗОВА` : `${challengeCount} ВЫЗОВОВ`;
            challengeBadgeHTML = `<span class="match-status status-challenges"><i class="fas fa-fire"></i> ${challengeText}</span>`;
        }

        // Центральная часть (счет или VS)
        let centerContent = '';
        if (showScore) {
            centerContent = `
                <div class="match-score-display ${scoreClass}">
                    <span class="score-team1 ${team1Class}">${score1}</span>
                    <span class="score-divider">:</span>
                    <span class="score-team2 ${team2Class}">${score2}</span>
                </div>
            `;
        } else {
            centerContent = '<div class="vs">VS</div>';
        }

        const timeHTML = this.getMatchTimeHTML(match);
        const durationHTML = this.getMatchDurationHTML(match);

        return `
            <div class="match-card ${hasChallenges ? 'has-challenges' : ''}" data-match-id="${match.id}" onclick="matchesModule.showMatchDetail('${match.id}')">
                <div class="match-header">
                    <div class="match-header-left">
                        <span class="sport-badge"><i class="fas fa-${this.app.getSportIcon(match.sport)}"></i> ${this.app.getSportName(match.sport).toUpperCase()}</span>
                        <span class="format-badge">${this.app.getFormatText(match.format || '5x5')}</span>
                    </div>
                    <div class="match-header-right">
                        ${challengeBadgeHTML}
                        <span class="match-status status-${match.status || 'upcoming'}">${this.app.getStatusText(match.status)}</span>
                    </div>
                </div>
                <div class="teams-row">
                    <div class="team ${team1Class}">
                        <div class="team-avatar">${this.getTeamAvatarHTML(t1)}</div>
                        <div class="team-name">${t1?.name || 'Команда 1'}</div>
                    </div>
                    ${centerContent}
                    <div class="team ${team2Class}" style="justify-content: flex-end;">
                        <div style="text-align: right; margin-right: 8px;">
                            <div class="team-name">${t2?.name || 'Ожидаем'}</div>
                        </div>
                        <div class="team-avatar">${this.getTeamAvatarHTML(t2)}</div>
                    </div>
                </div>
                <div class="match-info" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 0.85rem; color: var(--text-secondary); margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <span>${timeHTML}</span>
                    ${durationHTML ? `<span>${durationHTML}</span>` : ''}
                    <span><i class="fas fa-map-marker-alt"></i> ${match.location || 'Стадион'}</span>
                </div>
            </div>
        `;
    },

    // === НОВЫЙ МЕТОД: добавление отрендеренных карточек в контейнер ===
    appendMatchesToContainer(matches, challengeCounts = {}, userId = null) {
        const container = document.getElementById('matches-list');
        if (!container) return;

        if (matches.length === 0) {
            // Если это первая страница и матчей нет, показываем заглушку
            if (this.page === 1) {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Нет предстоящих матчей</div>';
            }
            return;
        }

        matches.forEach(match => {
            const cardHTML = this.generateMatchCard(match, challengeCounts, userId);
            container.insertAdjacentHTML('beforeend', cardHTML);
        });

        // После добавления новых карточек запускаем обновление таймеров live-матчей
        this.startLiveTimersUpdate(matches);

        // Обновляем наблюдатель Intersection Observer для последней карточки
        if (this.observer && this.observeLastCard) {
            this.observeLastCard();
        }
    },

    // === НОВЫЙ МЕТОД: инициализация бесконечного скролла ===
    initInfiniteScroll() {
        const container = document.getElementById('matches-list');
        if (!container) return;

        // Создаём Intersection Observer
        this.observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && this.hasMore && !this.isLoading) {
                this.renderMatches(false); // загружаем следующую страницу без сброса
            }
        }, { threshold: 0.1, rootMargin: '100px' });

        // Функция для наблюдения за последней карточкой
        this.observeLastCard = () => {
            // Отключаемся от всех элементов
            this.observer.disconnect();
            // Находим все карточки
            const cards = container.querySelectorAll('.match-card');
            if (cards.length > 0) {
                // Наблюдаем за последней карточкой
                this.observer.observe(cards[cards.length - 1]);
            }
        };

        // Первоначально наблюдаем, если карточки уже есть
        setTimeout(() => this.observeLastCard(), 500);
    },

    // === ОСНОВНОЙ МЕТОД РЕНДЕРА (с пагинацией) ===
    async renderMatches(reset = true) {
        const container = document.getElementById('matches-list');
        if (!container) return;

        // Сбрасываем пагинацию, если reset = true
        if (reset) {
            this.page = 1;
            this.hasMore = true;
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">Загрузка матчей...</div>';
        }

        // Защита от повторной загрузки
        if (this.isLoading || !this.hasMore) return;
        this.isLoading = true;

        try {
            // Получаем данные о вызовах для пользователя (если авторизован)
            const userId = authModule.getUserId();
            let challengeCounts = {};

            // Загружаем одну страницу матчей
            const matches = await this.fetchMatches(this.page, this.limit);

            // Если это сброс, очищаем контейнер (после загрузки первой страницы)
            if (reset) {
                container.innerHTML = '';
            }

            if (matches.length === 0) {
                if (reset) {
                    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Нет предстоящих матчей</div>';
                }
                this.hasMore = false;
                this.isLoading = false;
                return;
            }

            // Загружаем challengeCounts только для загруженных матчей (если есть userId)
            if (userId && matches.length > 0) {
                const matchIds = matches.map(m => m.id);
                try {
                    const { data: challengesData, error: challengesError } = await this.app.supabase
                        .from('challenges')
                        .select('match_id')
                        .eq('status', 'pending')
                        .in('match_id', matchIds);
                    if (!challengesError && challengesData) {
                        challengesData.forEach(challenge => {
                            challengeCounts[challenge.match_id] = (challengeCounts[challenge.match_id] || 0) + 1;
                        });
                    }
                } catch (error) {
                    console.error('❌ Ошибка загрузки вызовов:', error);
                }
            }

            // Применяем фильтр по спорту (если не 'all')
            let filteredMatches = matches;
            if (this.app.currentFilter !== 'all') {
                filteredMatches = matches.filter(match => match.sport === this.app.currentFilter);
            }

            // Добавляем отфильтрованные матчи в контейнер
            this.appendMatchesToContainer(filteredMatches, challengeCounts, userId);

            // Увеличиваем номер страницы для следующей загрузки
            if (this.hasMore) {
                this.page++;
            }

        } catch (error) {
            console.error('❌ Ошибка в renderMatches:', error);
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--accent-pink);">Ошибка загрузки матчей</div>';
        } finally {
            this.isLoading = false;
        }
    },

    // === ОБНОВЛЁННЫЙ МЕТОД filterSport ===
    filterSport(sport) {
        this.app.currentFilter = sport;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent.toLowerCase().includes(
                sport === 'all' ? 'все' :
                sport === 'football' ? 'футбол' :
                sport === 'volleyball' ? 'волейбол' :
                sport === 'basketball' ? 'баскетбол' :
                sport === 'hockey' ? 'хоккей' :
                sport === 'tabletennis' ? 'настольный' : 'все'
            ));
        });
        // При смене фильтра сбрасываем пагинацию и загружаем заново
        this.renderMatches(true);
    },

    // === ОСТАЛЬНЫЕ МЕТОДЫ (без изменений) ===

    getTeamAvatarHTML(team) {
        if (!team) return '<span>?</span>';
        if (team.logo_url) {
            return `<img src="${team.logo_url}" alt="${team.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            return `<span>${team.avatar || '?'}</span>`;
        }
    },

    pluralize(count, one, few, many) {
        const mod10 = count % 10;
        const mod100 = count % 100;
        if (mod100 >= 11 && mod100 <= 14) return many;
        if (mod10 === 1) return one;
        if (mod10 >= 2 && mod10 <= 4) return few;
        return many;
    },

    // Запуск обновления таймеров live матчей
    startLiveTimersUpdate(matches) {
        if (this.liveUpdateInterval) {
            clearInterval(this.liveUpdateInterval);
            this.liveUpdateInterval = null;
        }
        this.liveMatches = matches.filter(m => m.status === 'live' && m.started_at);
        if (this.liveMatches.length === 0) return;
        this.updateLiveTimers();
        this.liveUpdateInterval = setInterval(() => {
            this.updateLiveTimers();
        }, 1000);
    },

    // Остановка обновления
    stopLiveTimersUpdate() {
        if (this.liveUpdateInterval) {
            clearInterval(this.liveUpdateInterval);
            this.liveUpdateInterval = null;
        }
        this.liveMatches = [];
    },

    // Обновление всех таймеров на странице
    updateLiveTimers() {
        const now = new Date();
        this.liveMatches.forEach(match => {
            const card = document.querySelector(`[data-match-id="${match.id}"]`);
            if (!card) return;
            const timerEl = card.querySelector('.live-timer');
            if (!timerEl) return;
            const startTime = new Date(match.started_at);
            const diffMs = now - startTime;
            const duration = this.formatDurationShort(diffMs);
            timerEl.innerHTML = `<i class="fas fa-stopwatch" style="animation: pulse 1s infinite;"></i> ${duration}`;
        });
    },

    getMatchDurationHTML(match) {
        if (match.status === 'live' && match.started_at) {
            const duration = this.formatDurationShort(new Date() - new Date(match.started_at));
            return `<span style="color: var(--accent-green); font-weight: 700; display: inline-flex; align-items: center; gap: 4px; font-size: 0.9rem;">
                <i class="fas fa-stopwatch" style="animation: pulse 1s infinite;"></i> ${duration}
            </span>`;
        } else if (match.status === 'finished' && match.started_at && match.finished_at) {
            const duration = this.formatDurationShort(new Date(match.finished_at) - new Date(match.started_at));
            return `<span style="color: var(--accent-blue); font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px;">
                <i class="fas fa-clock"></i> ${duration}
            </span>`;
        }
        return '';
    },

    formatDurationShort(ms) {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));
        if (hours > 0) return `${hours}ч ${minutes}м`;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    },

    getMatchTimeHTML(match) {
        if (match.status === 'live') return `<span style="color: var(--accent-green); font-weight: 700;"><i class="fas fa-play-circle"></i> LIVE</span>`;
        if (match.status === 'finished') return `<span style="color: var(--text-secondary);"><i class="fas fa-flag-checkered"></i> Завершен</span>`;
        if (match.status === 'cancelled') return `<span style="color: var(--accent-pink);"><i class="fas fa-ban"></i> Отменен</span>`;
        return `<span><i class="far fa-clock"></i> ${this.app.formatDateTime(match.date)}</span>`;
    },

    // Показать детали матча
    async showMatchDetail(matchId) {
        if (!this.app || !this.app.supabase) {
            console.error('❌ Supabase client not initialized');
            alert('Приложение не готово. Пожалуйста, попробуйте позже.');
            return;
        }
        try {
            const { data: match, error } = await this.app.supabase
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
            this.app.selectedMatch = match;
            screenManager.show('screen-match');
            this.renderMatchDetail(match);

            const userId = authModule.getUserId();
            const isMatchOwner = match.team1?.owner_id === userId || match.team2?.owner_id === userId;
            const isOpenMatch = !match.team2 && match.team1?.owner_id !== userId;

            const canChallenge = authModule.isAuthenticated() &&
                authModule.hasRole('organizer') &&
                authModule.isProActive() &&
                isOpenMatch;
            utils.toggleVisibility('challenge-section', canChallenge);

            if (isMatchOwner && !match.team2) {
                await this.renderChallenges(matchId);
            } else {
                const challengesSection = document.getElementById('challenges-section');
                if (challengesSection) {
                    challengesSection.innerHTML = '';
                }
            }

            if (match.lat && match.lng) {
                setTimeout(() => mapModule.initMap(match.lat, match.lng, match.location), 100);
            }

            commentsModule.showCommentsSection(matchId);
            this.addEditButtonToMatchDetail();
        } catch (error) {
            console.error('❌ Ошибка загрузки матча:', error);
            alert('Ошибка загрузки матча: ' + error.message);
        }
    },

    // Добавить кнопку редактирования в детали матча
    addEditButtonToMatchDetail() {
        const match = this.app.selectedMatch;
        if (!match) return;
        const userId = authModule.getUserId();
        const isTeam1Owner = match.team1?.owner_id === userId;
        const isTeam2Owner = match.team2?.owner_id === userId;
        const canEdit = isTeam1Owner || isTeam2Owner;
        if (!canEdit) return;
        const detailContent = document.getElementById('match-detail-content');
        if (!detailContent) return;
        const existingEditBtn = detailContent.querySelector('.edit-match-btn');
        if (existingEditBtn) {
            existingEditBtn.remove();
        }
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-primary edit-match-btn';
        editBtn.style.marginTop = '20px';
        editBtn.style.width = '100%';
        editBtn.innerHTML = '<i class="fas fa-edit"></i> Управление матчем';
        editBtn.onclick = () => {
            if (typeof matchEditModule !== 'undefined') {
                matchEditModule.show(match.id);
            } else {
                alert('Модуль редактирования матча не загружен');
            }
        };
        detailContent.appendChild(editBtn);
    },

    renderMatchDetail(match) {
    const content = document.getElementById('match-detail-content');
    if (!content) return;

    const userId = authModule.getUserId();

    const getTeamBlock = (team) => {
        if (!team) {
            return `
                <div class="team-block">
                    <div class="team-avatar-large" style="border-color: var(--text-secondary);">
                        <span>?</span>
                    </div>
                    <div class="team-name" style="color: var(--text-secondary);">Нет команды</div>
                    <button class="btn-roster" disabled style="opacity:0.5;">Состав</button>
                </div>
            `;
        }

        const avatarHtml = team.logo_url
            ? `<img src="${team.logo_url}" alt="${team.name}">`
            : `<span>${team.avatar || '⚽'}</span>`;

        // Используем старый метод для открытия состава (просмотр)
        const rosterHandler = `app.showTeamWithMatchRoster('${team.id}', '${match.id}')`;

        return `
            <div class="team-block">
                <div class="team-avatar-large" onclick="${rosterHandler}">
                    ${avatarHtml}
                </div>
                <div class="team-name">${team.name}</div>
                <button class="btn-roster" onclick="${rosterHandler}">
                    <i class="fas fa-users"></i> Состав
                </button>
            </div>
        `;
    };

    const team1Block = getTeamBlock(match.team1);
    const team2Block = getTeamBlock(match.team2);

    const statusClass = match.status || 'upcoming';
    const statusText = this.app.getStatusText(match.status);
    const [score1, score2] = match.score ? match.score.split(':').map(Number) : [0, 0];
    const score = match.score || '0:0';
    const format = this.app.getFormatText(match.format || '5x5');

    let scoreClass = '';
    if (match.status === 'live' || match.status === 'finished') {
        if (score1 > score2) scoreClass = 'score-winner';
        else if (score2 > score1) scoreClass = 'score-winner';
        else scoreClass = 'score-draw';
    }

    const html = `
        <div class="match-header-modern">
            <div class="match-teams-row">
                ${team1Block}
                <div class="match-score-block ${scoreClass}">
                    <div class="match-score">${score}</div>
                    <span class="match-status-badge ${statusClass}">${statusText}</span>
                    <div class="match-format">
                        <i class="fas fa-users"></i> ${format}
                    </div>
                </div>
                ${team2Block}
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px;">
            <div class="form-section" style="margin: 0;">
                <div style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 4px;">Когда</div>
                <div style="font-weight: 700;">${this.app.formatDateTime(match.date)}</div>
            </div>
            <div class="form-section" style="margin: 0;">
                <div style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 4px;">Где</div>
                <div style="font-weight: 700;">${match.location || 'Стадион'}</div>
            </div>
        </div>
    `;

    content.innerHTML = html;
},

    async getChallengesForMatch(matchId) {
        try {
            const { data: challenges, error } = await this.app.supabase
                .from('challenges')
                .select(`
                    *,
                    from_team:teams!challenges_from_team_id_fkey(*)
                `)
                .eq('match_id', matchId)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return challenges || [];
        } catch (error) {
            console.error('❌ Ошибка загрузки вызовов:', error);
            return [];
        }
    },

    async renderChallenges(matchId) {
        const challenges = await this.getChallengesForMatch(matchId);
        const container = document.getElementById('challenges-section');
        if (!container) return;
        if (!challenges || challenges.length === 0) {
            container.innerHTML = '';
            container.classList.add('hidden');
            return;
        }
        container.innerHTML = `
            <div class="challenges-container">
                <h3 class="section-subtitle" style="margin-bottom: 15px;">
                    <i class="fas fa-fire"></i>
                    Вызовы 
                    <span class="count-badge">${challenges.length}</span>
                </h3>
                <div class="challenges-list">
                    ${challenges.map(challenge => `
                        <div class="challenge-card" id="challenge-${challenge.id}">
                            <div class="challenge-team">
                                <div class="team-avatar small">${challenge.from_team?.avatar || '?'}</div>
                                <div class="team-info">
                                    <div class="team-name">${challenge.from_team?.name || 'Команда'}</div>
                                    <div class="challenge-message">${challenge.message || 'Хотим сыграть!'}</div>
                                    <div class="challenge-time">${this.app.formatTimeAgo(challenge.created_at)}</div>
                                </div>
                            </div>
                            <div class="challenge-actions">
                                <button class="btn btn-success btn-small" onclick="matchesModule.acceptChallenge('${challenge.id}', '${matchId}')">
                                    <i class="fas fa-check"></i> Принять
                                </button>
                                <button class="btn btn-danger btn-small" onclick="matchesModule.rejectChallenge('${challenge.id}', '${matchId}')">
                                    <i class="fas fa-times"></i> Отклонить
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        container.classList.remove('hidden');
    },

    async loadUserTeamsForMatch() {
        const userId = authModule.getUserId();
        if (!userId) return;
        try {
            const { data: myTeams, error } = await this.app.supabase
                .from('teams')
                .select('*')
                .eq('owner_id', userId)
                .order('name');
            if (error) throw error;
            const teamSelect = document.getElementById('match-team');
            teamSelect.innerHTML = myTeams.map(t => 
                `<option value="${t.id}">${t.name}</option>`
            ).join('');
            this.loadOpponentTeams();
        } catch (error) {
            console.error('❌ Ошибка загрузки команд:', error);
            alert('Ошибка загрузки команд');
        }
    },

    async loadOpponentTeams() {
        const userId = authModule.getUserId();
        if (!userId) return;
        try {
            const { data: opponents, error } = await this.app.supabase
                .from('teams')
                .select('*')
                .neq('owner_id', userId)
                .eq('city', this.app.currentCity)
                .order('name');
            if (error) throw error;
            const opponentSelect = document.getElementById('match-opponent');
            opponentSelect.innerHTML = '<option value="">Открытый матч (без соперника)</option>' + 
                (opponents?.map(t => `<option value="${t.id}">${t.name}</option>`).join('') || '');
        } catch (error) {
            console.error('❌ Ошибка загрузки команд соперников:', error);
        }
    },

    async createMatch() {
        const teamId = document.getElementById('match-team').value;
        const opponentId = document.getElementById('match-opponent').value;
        const format = document.getElementById('match-format').value;
        const datetime = document.getElementById('match-datetime').value;
        const location = document.getElementById('match-location').value;
        const lat = document.getElementById('match-lat').value;
        const lng = document.getElementById('match-lng').value;
        if (!teamId || !format || !datetime || !location) {
            alert('Заполните все обязательные поля');
            return;
        }
        if (!authModule.isAuthenticated() || !authModule.hasRole('organizer') || !authModule.isProActive()) {
            alert('Только организаторы с активной подпиской могут создавать матчи');
            return;
        }
        try {
            const userId = authModule.getUserId();
            const { data: team, error: teamError } = await this.app.supabase
                .from('teams')
                .select('*')
                .eq('id', teamId)
                .eq('owner_id', userId)
                .single();
            if (teamError || !team) {
                alert('Вы можете создавать матчи только для своих команд');
                return;
            }
            const { data: match, error: matchError } = await this.app.supabase
                .from('matches')
                .insert([{
                    sport: team.sport,
                    format: format,
                    team1: teamId,
                    team2: opponentId || null,
                    date: datetime,
                    location,
                    lat: lat || null,
                    lng: lng || null,
                    city: this.app.currentCity,
                    status: 'upcoming',
                    score: '0:0',
                    created_by: userId,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();
            if (matchError) throw matchError;
            alert('Матч создан!');
            navigationModule.showMain();
        } catch (error) {
            console.error('❌ Ошибка создания матча:', error);
            alert('Ошибка создания матча: ' + error.message);
        }
    },

    async challengeTeam() {
        if (!authModule.isAuthenticated() || !authModule.hasRole('organizer') || !authModule.isProActive()) {
            alert('Только организаторы с активной подпиской могут бросать вызовы');
            return;
        }
        if (!this.app.selectedMatch) {
            alert('Матч не выбран');
            return;
        }
        if (this.app.selectedMatch.team2) {
            alert('В этом матче уже есть соперник');
            return;
        }
        const userId = authModule.getUserId();
        if (this.app.selectedMatch.team1?.owner_id === userId) {
            alert('Вы не можете бросить вызов на свой же матч');
            return;
        }
        try {
            const { data: myTeams, error: teamsError } = await this.app.supabase
                .from('teams')
                .select('*')
                .eq('owner_id', userId)
                .eq('sport', this.app.selectedMatch.sport)
                .eq('city', this.app.currentCity)
                .order('name');
            if (teamsError) throw teamsError;
            if (!myTeams || myTeams.length === 0) {
                alert('У вас нет команд в этом виде спорта для броска вызова');
                return;
            }
            const { data: existingChallenges, error: challengesError } = await this.app.supabase
                .from('challenges')
                .select('from_team_id, status')
                .eq('match_id', this.app.selectedMatch.id)
                .in('from_team_id', myTeams.map(t => t.id));
            if (challengesError) {
                console.error('Ошибка загрузки вызовов:', challengesError);
            }
            const teamsWithActiveChallenges = new Set();
            if (existingChallenges) {
                existingChallenges.forEach(challenge => {
                    if (challenge.status === 'pending' || challenge.status === 'accepted') {
                        teamsWithActiveChallenges.add(challenge.from_team_id);
                    }
                });
            }
            const availableTeams = myTeams.filter(team => !teamsWithActiveChallenges.has(team.id));
            const dialog = document.createElement('div');
            dialog.className = 'modal-overlay';
            dialog.style.display = 'flex';
            dialog.style.alignItems = 'center';
            dialog.style.justifyContent = 'center';
            dialog.style.zIndex = '1000';
            dialog.style.position = 'fixed';
            dialog.style.top = '0';
            dialog.style.left = '0';
            dialog.style.right = '0';
            dialog.style.bottom = '0';
            dialog.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            let warningHTML = '';
            if (teamsWithActiveChallenges.size > 0) {
                const blockedTeams = myTeams.filter(t => teamsWithActiveChallenges.has(t.id));
                warningHTML = `
                    <div class="challenge-warning" style="margin-bottom: 10px; padding: 8px; background: rgba(255, 193, 7, 0.1); border-radius: 8px; border: 1px solid rgba(255, 193, 7, 0.3);">
                        <i class="fas fa-exclamation-triangle" style="color: #ffc107;"></i>
                        <span style="color: #ffc107; font-size: 0.85rem;">
                            ${blockedTeams.length === 1 ? '1 команда уже отправила вызов' : 
                              `${blockedTeams.length} команды уже отправили вызовы`}
                        </span>
                    </div>
                `;
            }
            dialog.innerHTML = `
                <div class="modal-content" style="width: 90%; max-width: 400px;">
                    <h3 style="margin-bottom: 20px;">Выберите команду для вызова</h3>
                    ${warningHTML}
                    <div style="margin-bottom: 15px;">
                        <select id="challenge-team-select" style="width: 100%; padding: 10px; border-radius: 8px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-primary);">
                            ${availableTeams.map(team => `<option value="${team.id}">${team.name}</option>`).join('')}
                        </select>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px; color: var(--text-secondary);">Сообщение команде (необязательно)</label>
                        <textarea id="challenge-message" placeholder="Мы готовы сразиться!" style="width: 100%; padding: 10px; border-radius: 8px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-primary); min-height: 80px;"></textarea>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary" id="confirm-challenge" style="flex: 1;">Отправить вызов</button>
                        <button class="btn btn-secondary" id="cancel-challenge" style="flex: 1;">Отмена</button>
                    </div>
                </div>
            `;
            document.body.appendChild(dialog);
            if (availableTeams.length === 0) {
                alert('Все ваши команды уже отправили вызовы на этот матч');
                document.body.removeChild(dialog);
                return;
            }
            document.getElementById('confirm-challenge').onclick = async () => {
                const teamId = document.getElementById('challenge-team-select').value;
                const message = document.getElementById('challenge-message').value;
                try {
                    const { data: existingChallenge, error: checkError } = await this.app.supabase
                        .from('challenges')
                        .select('id, status')
                        .eq('match_id', this.app.selectedMatch.id)
                        .eq('from_team_id', teamId)
                        .maybeSingle();
                    if (checkError) {
                        console.error('❌ Ошибка проверки вызова:', checkError);
                        alert('Ошибка проверки существующего вызова');
                        document.body.removeChild(dialog);
                        return;
                    }
                    if (existingChallenge) {
                        if (existingChallenge.status === 'pending') {
                            alert('Вы уже отправили вызов на этот матч и он ожидает рассмотрения.');
                            document.body.removeChild(dialog);
                            return;
                        } else if (existingChallenge.status === 'accepted') {
                            alert('Ваш вызов уже был принят для этого матча.');
                            document.body.removeChild(dialog);
                            return;
                        } else if (existingChallenge.status === 'rejected') {
                            if (confirm('Ваш предыдущий вызов был отклонен. Хотите отправить новый вызов?')) {
                                const { error: updateError } = await this.app.supabase
                                    .from('challenges')
                                    .update({
                                        status: 'pending',
                                        message: message.trim() || null,
                                        created_at: new Date().toISOString()
                                    })
                                    .eq('id', existingChallenge.id);
                                if (updateError) {
                                    console.error('❌ Ошибка обновления вызова:', updateError);
                                    alert('Ошибка обновления вызова: ' + updateError.message);
                                } else {
                                    alert('Новый вызов отправлен!');
                                    document.body.removeChild(dialog);
                                    if (this.app.selectedMatch.team1?.owner_id === userId) {
                                        await this.renderChallenges(this.app.selectedMatch.id);
                                    }
                                }
                            } else {
                                document.body.removeChild(dialog);
                            }
                            return;
                        }
                        document.body.removeChild(dialog);
                        return;
                    }
                    const { error: insertError } = await this.app.supabase
                        .from('challenges')
                        .insert([{
                            match_id: this.app.selectedMatch.id,
                            from_team_id: teamId,
                            status: 'pending',
                            message: message.trim() || null,
                            created_at: new Date().toISOString()
                        }]);
                    if (insertError) {
                        console.error('❌ Ошибка отправки вызова:', insertError);
                        alert('Ошибка отправки вызова: ' + insertError.message);
                    } else {
                        alert('Вызов отправлен! Ожидайте подтверждения.');
                        document.body.removeChild(dialog);
                        if (this.app.selectedMatch.team1?.owner_id === userId) {
                            await this.renderChallenges(this.app.selectedMatch.id);
                        }
                    }
                } catch (error) {
                    console.error('❌ Ошибка отправки вызова:', error);
                    alert('Ошибка отправки вызова: ' + error.message);
                }
            };
            document.getElementById('cancel-challenge').onclick = () => {
                document.body.removeChild(dialog);
            };
        } catch (error) {
            console.error('❌ Ошибка броска вызова:', error);
            alert('Ошибка броска вызова: ' + error.message);
        }
    },

    async acceptChallenge(challengeId, matchId) {
        if (!confirm('Принять этот вызов и назначить команду соперником?')) return;
        try {
            const { data: challenge, error: challengeError } = await this.app.supabase
                .from('challenges')
                .select('*')
                .eq('id', challengeId)
                .single();
            if (challengeError) throw challengeError;
            const { error: matchError } = await this.app.supabase
                .from('matches')
                .update({ team2: challenge.from_team_id })
                .eq('id', matchId);
            if (matchError) throw matchError;
            await this.app.supabase
                .from('challenges')
                .update({ status: 'accepted' })
                .eq('id', challengeId);
            await this.app.supabase
                .from('challenges')
                .update({ status: 'rejected' })
                .eq('match_id', matchId)
                .neq('id', challengeId)
                .eq('status', 'pending');
            alert('Вызов принят! Команда добавлена в матч.');
            await this.showMatchDetail(matchId);
        } catch (error) {
            console.error('❌ Ошибка принятия вызова:', error);
            alert('Ошибка принятия вызова: ' + error.message);
        }
    },

    async rejectChallenge(challengeId, matchId) {
        if (!confirm('Отклонить этот вызов?')) return;
        try {
            const { error } = await this.app.supabase
                .from('challenges')
                .update({ status: 'rejected' })
                .eq('id', challengeId);
            if (error) throw error;
            const challengeCard = document.getElementById(`challenge-${challengeId}`);
            if (challengeCard) {
                challengeCard.style.opacity = '0';
                setTimeout(() => challengeCard.remove(), 300);
            }
            const challengesList = document.querySelector('.challenges-list');
            if (challengesList && challengesList.children.length === 0) {
                const challengesSection = document.getElementById('challenges-section');
                if (challengesSection) {
                    challengesSection.innerHTML = '';
                    challengesSection.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('❌ Ошибка отклонения вызова:', error);
            alert('Ошибка отклонения вызова: ' + error.message);
        }
    }
};

// Экспортируем глобально
window.matchesModule = matchesModule;