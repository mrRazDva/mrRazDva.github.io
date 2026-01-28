// js/app-modules/matches.js - полная исправленная версия с вызовами
const matchesModule = {
    app: null,
    
    init(appInstance) {
        this.app = appInstance;
    },
    
    // Загрузка матчей из Supabase
    async renderMatches() {
        const container = document.getElementById('matches-list');
        if (!container) return;
        
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
            
            // Добавляем информацию о вызовах для каждого матча
            for (let match of matches) {
                if (match.team2 === null) {
                    const { data: challenges } = await this.app.supabase
                        .from('challenges')
                        .select('id')
                        .eq('match_id', match.id)
                        .eq('status', 'pending');
                    
                    match.challengeCount = challenges?.length || 0;
                }
            }
            
            this.renderMatchesToContainer(container, matches);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки матчей:', error);
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--accent-pink);">Ошибка загрузки матчей</div>';
        }
    },
    
    renderMatchesToContainer(container, matches) {
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
            const hasChallenges = match.challengeCount > 0;
            
            const card = document.createElement('div');
            card.className = 'match-card';
            if (hasChallenges) {
                card.classList.add('has-challenges');
                card.setAttribute('data-challenge-count', match.challengeCount);
            }
            card.onclick = () => this.showMatchDetail(match.id);
            
            card.innerHTML = `
                <div class="match-header">
                    <span class="sport-badge">
                        <i class="fas fa-${this.app.getSportIcon(match.sport)}"></i>
                        ${this.app.getSportName(match.sport)}
                    </span>
                    ${hasChallenges ? `<span class="challenge-indicator" title="${match.challengeCount} вызовов"><i class="fas fa-fire"></i> ${match.challengeCount}</span>` : ''}
                    <span class="match-status status-${match.status || 'upcoming'}">
                        ${this.app.getStatusText(match.status)}
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
                            <div class="team-name">${t2?.name || (hasChallenges ? 'Выбор соперника' : 'Ждём соперника')}</div>
                            ${!t2 && hasChallenges ? `<div style="font-size: 0.7rem; color: var(--accent-gold); margin-top: 2px;">${match.challengeCount} вызовов</div>` : ''}
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
            const isMatchOwner = match.team1?.owner_id === userId;
            
            if (isMatchOwner && !match.team2) {
                // Если это владелец матча и матч открытый - показываем вызовы
                await this.renderMatchChallenges(matchId);
            } else if (authModule.isAuthenticated() && 
                       authModule.hasRole('organizer') && 
                       authModule.isProActive() && 
                       !match.team2) {
                // Если это другой организатор PRO - показываем форму броска вызова
                await this.renderChallengeButton(matchId);
            } else {
                // Скрываем секцию вызовов
                const challengeSection = document.getElementById('challenge-section');
                if (challengeSection) {
                    challengeSection.classList.add('hidden');
                }
            }
            
            // Инициализируем карту, если есть координаты
            if (match.lat && match.lng) {
                setTimeout(() => mapModule.initMap(match.lat, match.lng, match.location), 100);
            }
            
            // Показываем комментарии и реакции
            commentsModule.showCommentsSection(matchId);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки матча:', error);
            alert('Ошибка загрузки матча: ' + error.message);
        }
    },
    
    renderMatchDetail(match) {
        const content = document.getElementById('match-detail-content');
        const t1 = match.team1;
        const t2 = match.team2;
        
        if (!content) return;
        
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
                    <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-secondary);">${match.team1 ? 'Ждём соперника' : 'Неизвестно'}</div>
                </div>
            `;
        }
        
        content.innerHTML = `
            <div class="form-section" style="text-align: center; padding: 30px 20px;">
                <div style="display: flex; justify-content: space-around; align-items: center; margin: 20px 0;">
                    ${teamsHTML}
                </div>
                <span class="match-status status-${match.status || 'upcoming'}">${this.app.getStatusText(match.status)}</span>
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
        const datetime = document.getElementById('match-datetime').value;
        const location = document.getElementById('match-location').value;
        const lat = document.getElementById('match-lat').value;
        const lng = document.getElementById('match-lng').value;
        
        if (!teamId || !datetime || !location) {
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
    
    // ========== СИСТЕМА ВЫЗОВОВ ==========
    
    // Загрузить и отобразить вызовы к матчу
    async renderMatchChallenges(matchId) {
        try {
            const { data: challenges, error } = await this.app.supabase
                .from('challenges')
                .select(`
                    *,
                    from_team:teams!challenges_from_team_id_fkey(
                        id,
                        name,
                        avatar,
                        sport,
                        city,
                        owner_id,
                        wins,
                        losses,
                        created_at
                    )
                `)
                .eq('match_id', matchId)
                .eq('status', 'pending')
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            
            const container = document.getElementById('challenge-section');
            if (!container) return;
            
            container.classList.remove('hidden');
            container.innerHTML = `
                <div class="challenges-section">
                    <h3 class="section-subtitle">
                        <i class="fas fa-fire" style="color: var(--accent-gold);"></i>
                        Вызовы на матч 
                        <span class="count-badge">${challenges?.length || 0}</span>
                    </h3>
                    <div id="challenges-list" class="challenges-list">
                        ${challenges && challenges.length > 0 ? 
                            challenges.map(challenge => this.renderChallengeItem(challenge)).join('') :
                            '<div class="empty-state" style="text-align: center; padding: 20px; color: var(--text-secondary);">Пока нет вызовов на этот матч</div>'
                        }
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки вызовов:', error);
            const container = document.getElementById('challenge-section');
            if (container) {
                container.innerHTML = '<div class="empty-state">Ошибка загрузки вызовов</div>';
            }
        }
    },
    
    // Отображение одного вызова
    renderChallengeItem(challenge) {
        const team = challenge.from_team;
        if (!team) return '';
        
        const matchesPlayed = (team.wins || 0) + (team.losses || 0);
        const winrate = matchesPlayed > 0 ? 
            Math.round((team.wins / matchesPlayed) * 100) : 0;
        const teamAge = Math.floor((new Date() - new Date(team.created_at)) / (1000 * 60 * 60 * 24));
        
        return `
            <div class="challenge-card" data-challenge-id="${challenge.id}">
                <div class="challenge-team-info">
                    <div class="team-avatar" style="cursor: pointer;" onclick="teamModule.show('${team.id}')">
                        ${team.avatar || '⚽'}
                    </div>
                    <div class="team-details">
                        <div class="team-name" style="cursor: pointer;" onclick="teamModule.show('${team.id}')">
                            ${team.name}
                        </div>
                        <div class="team-stats">
                            <span><i class="fas fa-trophy" style="color: var(--accent-green);"></i> ${team.wins || 0}</span>
                            <span><i class="fas fa-times" style="color: var(--accent-pink);"></i> ${team.losses || 0}</span>
                            <span><i class="fas fa-chart-line" style="color: var(--accent-gold);"></i> ${winrate}%</span>
                            ${teamAge > 0 ? `<span><i class="far fa-calendar" style="color: var(--accent-blue);"></i> ${teamAge} дн.</span>` : ''}
                        </div>
                    </div>
                </div>
                ${challenge.message ? 
                    `<div class="challenge-message">
                        <i class="fas fa-quote-left" style="color: var(--accent-gold); opacity: 0.5; margin-right: 5px;"></i>
                        ${challenge.message}
                    </div>` : ''
                }
                <div class="challenge-meta">
                    <span class="challenge-time">
                        <i class="far fa-clock"></i>
                        ${this.app.formatTimeAgo(challenge.created_at)}
                    </span>
                </div>
                <div class="challenge-actions">
                    <button class="btn btn-success btn-small" 
                            onclick="matchesModule.acceptChallenge('${challenge.id}')">
                        <i class="fas fa-check"></i> Принять
                    </button>
                    <button class="btn btn-danger btn-small" 
                            onclick="matchesModule.rejectChallenge('${challenge.id}')">
                        <i class="fas fa-times"></i> Отклонить
                    </button>
                </div>
            </div>
        `;
    },
    
    // Отображение формы броска вызова для других организаторов
    async renderChallengeButton(matchId) {
        const userId = authModule.getUserId();
        
        // Проверяем, не является ли пользователь владельцем матча
        const isMatchOwner = this.app.selectedMatch?.team1?.owner_id === userId;
        if (isMatchOwner) {
            // Владелец видит вызовы, а не форму броска
            return;
        }
        
        try {
            // Загружаем данные матча
            const { data: match, error: matchError } = await this.app.supabase
                .from('matches')
                .select('sport, city, team1')
                .eq('id', matchId)
                .single();
            
            if (matchError) throw matchError;
            
            // Загружаем команды пользователя, которые подходят для вызова
            const { data: myTeams, error: teamsError } = await this.app.supabase
                .from('teams')
                .select('id, name, avatar, wins, losses')
                .eq('owner_id', userId)
                .eq('sport', match.sport)
                .eq('city', match.city)
                .neq('id', match.team1); // Нельзя бросить вызов самому себе
            
            if (teamsError) throw teamsError;
            
            const container = document.getElementById('challenge-section');
            if (!container) return;
            
            container.classList.remove('hidden');
            
            if (myTeams && myTeams.length > 0) {
                // Проверяем, не отправлял ли уже пользователь вызов
                const { data: existingChallenge, error: challengeError } = await this.app.supabase
                    .from('challenges')
                    .select('id, status, created_at')
                    .eq('match_id', matchId)
                    .in('from_team_id', myTeams.map(t => t.id))
                    .eq('status', 'pending')
                    .maybeSingle();
                
                if (existingChallenge) {
                    container.innerHTML = `
                        <div class="challenge-status">
                            <i class="fas fa-clock" style="color: var(--accent-gold); font-size: 1.2rem;"></i>
                            <div>
                                <div style="font-weight: 500; margin-bottom: 4px;">Вызов отправлен</div>
                                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                    Ожидайте ответа команды. Отправлено: ${this.app.formatTimeAgo(existingChallenge.created_at)}
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    // Создаем форму выбора команды
                    let teamsOptions = '';
                    myTeams.forEach(team => {
                        const winrate = (team.wins + team.losses) > 0 ? 
                            Math.round((team.wins / (team.wins + team.losses)) * 100) : 0;
                        teamsOptions += `
                            <option value="${team.id}" data-wins="${team.wins || 0}" data-losses="${team.losses || 0}" data-winrate="${winrate}">
                                ${team.avatar || '⚽'} ${team.name} (${team.wins || 0}W/${team.losses || 0}L, ${winrate}%)
                            </option>
                        `;
                    });
                    
                    container.innerHTML = `
                        <div class="challenge-form">
                            <h3 class="section-subtitle">
                                <i class="fas fa-fire" style="color: var(--accent-gold);"></i>
                                Бросить вызов
                            </h3>
                            <div class="form-group">
                                <label>Ваша команда</label>
                                <select id="challenge-team-select" class="challenge-select" onchange="matchesModule.updateTeamStats()">
                                    ${teamsOptions}
                                </select>
                            </div>
                            <div id="team-stats-preview" class="team-stats-preview" style="
                                background: var(--bg-secondary); 
                                border-radius: 8px; 
                                padding: 10px; 
                                margin: 10px 0; 
                                font-size: 0.85rem;
                                display: none;">
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                                    <div><strong>Победы:</strong> <span id="stat-wins">0</span></div>
                                    <div><strong>Поражения:</strong> <span id="stat-losses">0</span></div>
                                    <div><strong>Винрейт:</strong> <span id="stat-winrate">0%</span></div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Сообщение команде (необязательно)</label>
                                <textarea id="challenge-message" 
                                          placeholder="Хотим сыграть с вами! 🏆 Давайте устроим интересный матч..." 
                                          rows="3"
                                          maxlength="200"></textarea>
                                <div style="text-align: right; font-size: 0.8rem; color: var(--text-secondary); margin-top: 5px;">
                                    <span id="message-counter">0/200</span>
                                </div>
                            </div>
                            <button class="btn btn-challenge" 
                                    onclick="matchesModule.sendChallenge('${matchId}')"
                                    style="width: 100%; margin-top: 10px;">
                                <i class="fas fa-fire"></i> Отправить вызов
                            </button>
                            <div style="margin-top: 15px; text-align: center; color: var(--text-secondary); font-size: 0.8rem;">
                                <i class="fas fa-info-circle"></i> После отправки вызова команда получит уведомление
                            </div>
                        </div>
                    `;
                    
                    // Инициализируем счетчик символов
                    const textarea = document.getElementById('challenge-message');
                    const counter = document.getElementById('message-counter');
                    if (textarea && counter) {
                        textarea.addEventListener('input', function() {
                            counter.textContent = this.value.length + '/200';
                        });
                    }
                    
                    // Показываем статистику первой команды
                    this.updateTeamStats();
                }
            } else {
                container.innerHTML = `
                    <div class="challenge-status">
                        <i class="fas fa-info-circle" style="color: var(--text-secondary); font-size: 1.2rem;"></i>
                        <div>
                            <div style="font-weight: 500; margin-bottom: 4px;">Нет команд для вызова</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                Создайте команду того же вида спорта и города, чтобы бросить вызов
                            </div>
                        </div>
                    </div>
                `;
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных для вызова:', error);
            const container = document.getElementById('challenge-section');
            if (container) {
                container.innerHTML = '<div class="empty-state">Ошибка загрузки данных</div>';
            }
        }
    },
    
    // Обновление статистики выбранной команды
    updateTeamStats() {
        const select = document.getElementById('challenge-team-select');
        if (!select) return;
        
        const selectedOption = select.options[select.selectedIndex];
        const wins = selectedOption.getAttribute('data-wins') || 0;
        const losses = selectedOption.getAttribute('data-losses') || 0;
        const winrate = selectedOption.getAttribute('data-winrate') || '0%';
        
        document.getElementById('stat-wins').textContent = wins;
        document.getElementById('stat-losses').textContent = losses;
        document.getElementById('stat-winrate').textContent = winrate;
        
        const statsPreview = document.getElementById('team-stats-preview');
        if (statsPreview) {
            statsPreview.style.display = 'block';
        }
    },
    
    // Отправка вызова
    async sendChallenge(matchId) {
        const teamSelect = document.getElementById('challenge-team-select');
        if (!teamSelect) {
            alert('Ошибка: форма вызова не найдена');
            return;
        }
        
        const teamId = teamSelect.value;
        const message = document.getElementById('challenge-message')?.value;
        
        if (!teamId) {
            alert('Выберите команду для вызова');
            return;
        }
        
        // Проверка прав
        if (!authModule.isAuthenticated() || !authModule.hasRole('organizer') || !authModule.isProActive()) {
            alert('Только организаторы с активной подпиской PRO могут бросать вызовы');
            return;
        }
        
        try {
            // Проверяем, существует ли уже вызов от этой команды
            const { data: existingChallenge, error: checkError } = await this.app.supabase
                .from('challenges')
                .select('id')
                .eq('match_id', matchId)
                .eq('from_team_id', teamId)
                .in('status', ['pending', 'accepted'])
                .maybeSingle();
            
            if (checkError) throw checkError;
            
            if (existingChallenge) {
                alert('Вы уже отправили вызов от этой команды на этот матч');
                return;
            }
            
            // Отправляем вызов
            const { data: challenge, error } = await this.app.supabase
                .from('challenges')
                .insert([{
                    match_id: matchId,
                    from_team_id: teamId,
                    message: message?.trim(),
                    status: 'pending',
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();
            
            if (error) throw error;
            
            // Показываем подтверждение
            const challengeSection = document.getElementById('challenge-section');
            if (challengeSection) {
                challengeSection.innerHTML = `
                    <div class="challenge-status" style="background: rgba(var(--accent-green-rgb), 0.1); border-color: var(--accent-green);">
                        <i class="fas fa-check-circle" style="color: var(--accent-green); font-size: 1.5rem;"></i>
                        <div>
                            <div style="font-weight: 500; margin-bottom: 4px; color: var(--accent-green);">Вызов отправлен!</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                Команда получила уведомление. Вы получите ответ в течение 24 часов.
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Обновляем счетчик вызовов на карточке матча
            setTimeout(() => {
                this.renderMatches();
            }, 1000);
            
        } catch (error) {
            console.error('❌ Ошибка отправки вызова:', error);
            alert('Ошибка отправки вызова: ' + error.message);
        }
    },
    
    // Принять вызов
    async acceptChallenge(challengeId) {
        if (!confirm('Принять этот вызов? После принятия остальные вызовы будут автоматически отклонены.')) return;
        
        try {
            // Получаем данные вызова
            const { data: challenge, error: challengeError } = await this.app.supabase
                .from('challenges')
                .select('match_id, from_team_id')
                .eq('id', challengeId)
                .single();
            
            if (challengeError) throw challengeError;
            
            // Обновляем матч - добавляем команду соперника
            const { error: matchError } = await this.app.supabase
                .from('matches')
                .update({
                    team2: challenge.from_team_id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', challenge.match_id);
            
            if (matchError) throw matchError;
            
            // Обновляем статус принятого вызова
            await this.app.supabase
                .from('challenges')
                .update({
                    status: 'accepted',
                    updated_at: new Date().toISOString()
                })
                .eq('id', challengeId);
            
            // Отклоняем все остальные вызовы к этому матчу
            await this.app.supabase
                .from('challenges')
                .update({
                    status: 'rejected',
                    updated_at: new Date().toISOString()
                })
                .eq('match_id', challenge.match_id)
                .neq('id', challengeId);
            
            // Показываем подтверждение
            const challengeSection = document.getElementById('challenge-section');
            if (challengeSection) {
                challengeSection.innerHTML = `
                    <div class="challenge-status" style="background: rgba(var(--accent-green-rgb), 0.1); border-color: var(--accent-green);">
                        <i class="fas fa-check-circle" style="color: var(--accent-green); font-size: 1.5rem;"></i>
                        <div>
                            <div style="font-weight: 500; margin-bottom: 4px; color: var(--accent-green);">Вызов принят!</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                Команда добавлена к матчу. Уведомление отправлено капитану команды.
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Обновляем детали матча
            setTimeout(() => {
                this.showMatchDetail(challenge.match_id);
            }, 1500);
            
        } catch (error) {
            console.error('❌ Ошибка принятия вызова:', error);
            alert('Ошибка принятия вызова: ' + error.message);
        }
    },
    
    // Отклонить вызов
    async rejectChallenge(challengeId) {
        if (!confirm('Отклонить этот вызов?')) return;
        
        try {
            const { data: challenge, error: challengeError } = await this.app.supabase
                .from('challenges')
                .select('match_id')
                .eq('id', challengeId)
                .single();
            
            if (challengeError) throw challengeError;
            
            await this.app.supabase
                .from('challenges')
                .update({
                    status: 'rejected',
                    updated_at: new Date().toISOString()
                })
                .eq('id', challengeId);
            
            // Уведомляем об успешном отклонении
            const challengesList = document.getElementById('challenges-list');
            if (challengesList) {
                const challengeCard = document.querySelector(`[data-challenge-id="${challengeId}"]`);
                if (challengeCard) {
                    challengeCard.style.opacity = '0.5';
                    challengeCard.innerHTML = `
                        <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                            <i class="fas fa-times-circle" style="color: var(--accent-pink); font-size: 1.5rem; margin-bottom: 10px;"></i>
                            <div>Вызов отклонён</div>
                        </div>
                    `;
                    
                    // Удаляем карточку через 2 секунды
                    setTimeout(() => {
                        challengeCard.remove();
                        // Обновляем счетчик
                        const countBadge = document.querySelector('.challenges-section .count-badge');
                        if (countBadge) {
                            const currentCount = parseInt(countBadge.textContent) || 0;
                            countBadge.textContent = Math.max(0, currentCount - 1);
                        }
                    }, 2000);
                }
            }
            
        } catch (error) {
            console.error('❌ Ошибка отклонения вызова:', error);
            alert('Ошибка отклонения вызова: ' + error.message);
        }
    },
    
    // Старый метод броска вызова (для обратной совместимости)
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
            alert('Матч уже имеет соперника');
            return;
        }
        
        // Используем новую систему
        await this.renderChallengeButton(this.app.selectedMatch.id);
    }
};