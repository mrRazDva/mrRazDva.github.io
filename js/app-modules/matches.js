const matchesModule = {
    app: null,
    
    init(appInstance) {
        this.app = appInstance;
    },
    
    // Загрузка матчей из Supabase
async renderMatches() {
    const container = document.getElementById('matches-list');
    if (!container) return;
    
    // ДОБАВЛЕМ ПРОВЕРКУ НАЛИЧИЯ supabase
    if (!this.app || !this.app.supabase) {
        console.error('❌ Supabase client not initialized');
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">Ошибка инициализации...</div>';
        return;
    }
    
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">Загрузка матчей...</div>';
    
    try {
        const { data: teamsInCity, error: teamsError } = await this.app.supabase
            .from('teams')
            .select('id')
            .eq('city', this.app.currentCity);
        
        if (teamsError) throw teamsError;
        
        let matches = [];
        
        if (teamsInCity && teamsInCity.length > 0) {
            const teamIds = teamsInCity.map(t => t.id);
            const teamIdsString = teamIds.join(',');
            
            const { data: matchesData, error: matchesError } = await this.app.supabase
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
            
            // Получаем количество вызовов для матчей
            const userId = authModule.getUserId();
            let challengeCounts = {};
            
            if (userId && matches.length > 0) {
                const matchIds = matches.map(m => m.id);
                
                try {
                    const { data: challengesData, error: challengesError } = await this.app.supabase
                        .from('challenges')
                        .select('match_id')
                        .eq('status', 'pending')
                        .in('match_id', matchIds);
                    
                    if (!challengesError && challengesData) {
                        // Считаем количество вызовов для каждого матча
                        challengesData.forEach(challenge => {
                            if (challengeCounts[challenge.match_id]) {
                                challengeCounts[challenge.match_id]++;
                            } else {
                                challengeCounts[challenge.match_id] = 1;
                            }
                        });
                    }
                } catch (error) {
                    console.error('❌ Ошибка загрузки вызовов:', error);
                }
            }
            
            this.renderMatchesToContainer(container, matches, challengeCounts, userId);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки матчей:', error);
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--accent-pink);">Ошибка загрузки матчей</div>';
        }
    },
    
    renderMatchesToContainer(container, matches, challengeCounts = {}, userId = null) {
    container.innerHTML = '';
    
    if (!matches || matches.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Нет предстоящих матчей</div>';
        return;
    }
    
    let filteredMatches = matches;
    if (this.app.currentFilter !== 'all') {
        filteredMatches = matches.filter(match => match.sport === this.app.currentFilter);
    }
    
    if (filteredMatches.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Нет матчей по виду спорта "${this.app.getSportName(this.app.currentFilter)}"</div>`;
        return;
    }
    
    filteredMatches.forEach(match => {
        const t1 = match.team1;
        const t2 = match.team2;
        const challengeCount = challengeCounts[match.id] || 0;
        const isOwner = userId && (t1?.owner_id === userId);
        const hasChallenges = isOwner && challengeCount > 0;
        
        // Определяем, нужно ли показывать счет
        const showScore = match.status === 'live' || match.status === 'finished';
        const [score1, score2] = match.score ? match.score.split(':').map(Number) : [0, 0];
        
        // Определяем победителя для стилей
        let team1Class = '';
        let team2Class = '';
        let scoreClass = '';
        
        if (showScore) {
            if (score1 > score2) {
                team1Class = 'winner';
                team2Class = 'loser';
                scoreClass = 'score-winner';
            } else if (score2 > score1) {
                team1Class = 'loser';
                team2Class = 'winner';
                scoreClass = 'score-winner';
            } else {
                scoreClass = 'score-draw';
            }
        }
        
        const card = document.createElement('div');
        card.className = `match-card ${hasChallenges ? 'has-challenges' : ''}`;
        card.onclick = () => this.showMatchDetail(match.id);
        
        // Определяем текст для бейджа вызовов
        let challengeBadgeHTML = '';
        if (hasChallenges) {
            let challengeText;
            if (challengeCount === 1) {
                challengeText = '1 ВЫЗОВ';
            } else if (challengeCount === 2) {
                challengeText = '2 ВЫЗОВА';
            } else if (challengeCount === 3) {
                challengeText = '3 ВЫЗОВА';
            } else if (challengeCount === 4) {
                challengeText = '4 ВЫЗОВА';
            } else {
                challengeText = `${challengeCount} ВЫЗОВОВ`;
            }
            
            challengeBadgeHTML = `
                <span class="match-status status-challenges" title="${challengeText}">
                    <i class="fas fa-fire" style="margin-right: 4px;"></i>${challengeText}
                </span>
            `;
        }
        
        // Определяем центральную часть (счет или VS)
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
            centerContent = `<div class="vs">VS</div>`;
        }
        
        card.innerHTML = `
            <div class="match-header">
                <div class="match-header-left">
                    <span class="sport-badge">
                        <i class="fas fa-${this.app.getSportIcon(match.sport)}"></i>
                        ${this.app.getSportName(match.sport).toUpperCase()}
                    </span>
                    <span class="format-badge">
                        ${this.app.getFormatText(match.format || '5x5')}
                    </span>
                </div>
                <div class="match-header-right">
                    ${challengeBadgeHTML}
                    <span class="match-status status-${match.status || 'upcoming'}">
                        ${this.app.getStatusText(match.status)}
                    </span>
                </div>
            </div>
            <div class="teams-row">
                <div class="team ${team1Class}">
                    <div class="team-avatar">${t1?.avatar || '?'}</div>
                    <div class="team-name">${t1?.name || 'Команда 1'}</div>
                   
                </div>
                
                ${centerContent}
                
                <div class="team ${team2Class}" style="justify-content: flex-end;">
             
                    <div style="text-align: right; margin-right: 8px;">
                        <div class="team-name">${t2?.name || 'Команда 2'}</div>
                    </div>
                    <div class="team-avatar">${t2?.avatar || '?'}</div>
                </div>
            </div>
            <div class="match-info">
                <span><i class="far fa-clock"></i> ${this.app.formatDateTime(match.date)}</span>
                <span><i class="fas fa-map-marker-alt"></i> ${match.location || 'Стадион'}</span>
            </div>
        `;
        container.appendChild(card);
    });
},
    
    // Вспомогательная функция для правильного склонения
    pluralize(count, one, few, many) {
        const mod10 = count % 10;
        const mod100 = count % 100;
        
        if (mod100 >= 11 && mod100 <= 14) {
            return many;
        }
        if (mod10 === 1) {
            return one;
        }
        if (mod10 >= 2 && mod10 <= 4) {
            return few;
        }
        return many;
    },
    
    // Фильтрация по виду спорта
    filterSport(sport) {
        this.app.currentFilter = sport;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent.toLowerCase().includes(
                sport === 'all' ? 'все' : 
                sport === 'football' ? 'футбол' :
                sport === 'volleyball' ? 'волейбол' : 'баскетбол'
            ));
        });
        this.renderMatches();
    },
    
    // Показать детали матча
    async showMatchDetail(matchId) {
    // ДОБАВЛЕМ ПРОВЕРКУ
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
            
            // Проверяем, является ли пользователь владельцем команды
            const userId = authModule.getUserId();
            const isMatchOwner = match.team1?.owner_id === userId || match.team2?.owner_id === userId;
            const isOpenMatch = !match.team2 && match.team1?.owner_id !== userId;
            
            // Показываем/скрываем кнопку вызова
            const canChallenge = authModule.isAuthenticated() && 
                authModule.hasRole('organizer') &&
                authModule.isProActive() &&
                isOpenMatch;
            
            utils.toggleVisibility('challenge-section', canChallenge);
            
            // Показываем секцию вызовов если пользователь владелец команды
            if (isMatchOwner && !match.team2) {
                await this.renderChallenges(matchId);
            } else {
                const challengesSection = document.getElementById('challenges-section');
                if (challengesSection) {
                    challengesSection.innerHTML = '';
                }
            }
            
            // Инициализируем карту, если есть координаты
            if (match.lat && match.lng) {
                setTimeout(() => mapModule.initMap(match.lat, match.lng, match.location), 100);
            }
            
            // Показываем комментарии и реакции
            commentsModule.showCommentsSection(matchId);
            
            // Добавляем кнопку редактирования если пользователь владелец
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
        
        // Ищем контейнер для действий
        const detailContent = document.getElementById('match-detail-content');
        if (!detailContent) return;
        
        // Удаляем существующую кнопку редактирования, если есть
        const existingEditBtn = detailContent.querySelector('.edit-match-btn');
        if (existingEditBtn) {
            existingEditBtn.remove();
        }
        
        // Создаем кнопку редактирования
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
        
        // Добавляем кнопку после деталей матча
        detailContent.appendChild(editBtn);
    },
    
    renderMatchDetail(match) {
        const content = document.getElementById('match-detail-content');
        const t1 = match.team1;
        const t2 = match.team2;
        
        if (!content) return;
        
        // Определяем победителя для стилей
        const [score1, score2] = match.score ? match.score.split(':').map(Number) : [0, 0];
        let team1Class = '';
        let team2Class = '';
        let scoreClass = '';
        
        if (match.status === 'live' || match.status === 'finished') {
            if (score1 > score2) {
                team1Class = 'winner';
                team2Class = 'loser';
                scoreClass = 'score-winner';
            } else if (score2 > score1) {
                team1Class = 'loser';
                team2Class = 'winner';
                scoreClass = 'score-winner';
            } else {
                scoreClass = 'score-draw';
            }
        }
        
        let teamsHTML = '';
        
        // Команда 1
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
        
        // Команда 2
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
                <span class="match-status status-${match.status || 'upcoming'}">${this.app.getStatusText(match.status)}</span>
                <div style="margin-top: 10px; color: var(--text-secondary); font-size: 0.9rem;">
                    <i class="fas fa-users"></i> Формат: ${this.app.getFormatText(match.format || '5x5')}
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
    },
    
    // Загрузка вызовов для матча
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
    
    // Отображение вызовов
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
    
    // Загрузка команд для создания матча
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
    
    // Загрузка команд соперников
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
    
    // Создание матча в Supabase
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
    
    // Бросок вызова
    async challengeTeam() {
        if (!authModule.isAuthenticated() || !authModule.hasRole('organizer') || !authModule.isProActive()) {
            alert('Только организаторы с активной подпиской могут бросать вызовы');
            return;
        }
        
        if (!this.app.selectedMatch) {
            alert('Матч не выбран');
            return;
        }
        
        // Проверяем, что матч открытый и нет второго соперника
        if (this.app.selectedMatch.team2) {
            alert('В этом матче уже есть соперник');
            return;
        }
        
        // Проверяем, что пользователь не владелец матча
        const userId = authModule.getUserId();
        if (this.app.selectedMatch.team1?.owner_id === userId) {
            alert('Вы не можете бросить вызов на свой же матч');
            return;
        }
        
        try {
            // Загружаем команды пользователя
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
            
            // Проверяем существующие вызовы пользователя на этот матч
            const { data: existingChallenges, error: challengesError } = await this.app.supabase
                .from('challenges')
                .select('from_team_id, status')
                .eq('match_id', this.app.selectedMatch.id)
                .in('from_team_id', myTeams.map(t => t.id));
            
            if (challengesError) {
                console.error('Ошибка загрузки вызовов:', challengesError);
            }
            
            // Фильтруем команды с активными вызовами
            const teamsWithActiveChallenges = new Set();
            if (existingChallenges) {
                existingChallenges.forEach(challenge => {
                    if (challenge.status === 'pending' || challenge.status === 'accepted') {
                        teamsWithActiveChallenges.add(challenge.from_team_id);
                    }
                });
            }
            
            // Доступные команды для вызова
            const availableTeams = myTeams.filter(team => !teamsWithActiveChallenges.has(team.id));
            
            // Показываем диалог выбора команды
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
            
            // Предупреждение о командах с активными вызовами
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
            
            // Если нет доступных команд
            if (availableTeams.length === 0) {
                alert('Все ваши команды уже отправили вызовы на этот матч');
                document.body.removeChild(dialog);
                return;
            }
            
            // Обработчик отправки вызова
            document.getElementById('confirm-challenge').onclick = async () => {
                const teamId = document.getElementById('challenge-team-select').value;
                const message = document.getElementById('challenge-message').value;
                
                try {
                    // Проверяем, есть ли уже вызов от этой команды на этот матч
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
                        // Вызов уже существует
                        if (existingChallenge.status === 'pending') {
                            alert('Вы уже отправили вызов на этот матч и он ожидает рассмотрения.');
                            document.body.removeChild(dialog);
                            return;
                        } else if (existingChallenge.status === 'accepted') {
                            alert('Ваш вызов уже был принят для этого матча.');
                            document.body.removeChild(dialog);
                            return;
                        } else if (existingChallenge.status === 'rejected') {
                            // Если вызов был отклонен, спрашиваем, отправить ли заново
                            if (confirm('Ваш предыдущий вызов был отклонен. Хотите отправить новый вызов?')) {
                                // Обновляем существующий вызов
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
                                    
                                    // Обновляем отображение вызовов если пользователь владелец матча
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
                    
                    // Если вызова нет - создаем новый
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
                        
                        // Обновляем отображение вызовов если пользователь владелец матча
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
    
    // Принять вызов
    async acceptChallenge(challengeId, matchId) {
        if (!confirm('Принять этот вызов и назначить команду соперником?')) return;
        
        try {
            // Получаем информацию о вызове
            const { data: challenge, error: challengeError } = await this.app.supabase
                .from('challenges')
                .select('*')
                .eq('id', challengeId)
                .single();
            
            if (challengeError) throw challengeError;
            
            // Обновляем матч - добавляем соперника
            const { error: matchError } = await this.app.supabase
                .from('matches')
                .update({ team2: challenge.from_team_id })
                .eq('id', matchId);
            
            if (matchError) throw matchError;
            
            // Обновляем статус вызова
            await this.app.supabase
                .from('challenges')
                .update({ status: 'accepted' })
                .eq('id', challengeId);
            
            // Отклоняем остальные вызовы к этому матчу
            await this.app.supabase
                .from('challenges')
                .update({ status: 'rejected' })
                .eq('match_id', matchId)
                .neq('id', challengeId)
                .eq('status', 'pending');
            
            alert('Вызов принят! Команда добавлена в матч.');
            
            // Обновляем отображение матча
            await this.showMatchDetail(matchId);
            
        } catch (error) {
            console.error('❌ Ошибка принятия вызова:', error);
            alert('Ошибка принятия вызова: ' + error.message);
        }
    },
    
    // Отклонить вызов
    async rejectChallenge(challengeId, matchId) {
        if (!confirm('Отклонить этот вызов?')) return;
        
        try {
            const { error } = await this.app.supabase
                .from('challenges')
                .update({ status: 'rejected' })
                .eq('id', challengeId);
            
            if (error) throw error;
            
            // Удаляем карточку вызова
            const challengeCard = document.getElementById(`challenge-${challengeId}`);
            if (challengeCard) {
                challengeCard.style.opacity = '0';
                setTimeout(() => challengeCard.remove(), 300);
            }
            
            // Если больше нет вызовов, скрываем секцию
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