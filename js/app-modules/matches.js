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
            
            const card = document.createElement('div');
            card.className = 'match-card';
            card.onclick = () => this.showMatchDetail(match.id);
            
            card.innerHTML = `
                <div class="match-header">
                    <span class="sport-badge">
                        <i class="fas fa-${this.app.getSportIcon(match.sport)}"></i>
                        ${this.app.getSportName(match.sport)}
                    </span>
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
            
            // Показываем/скрываем кнопку вызова
            const canChallenge = authModule.isAuthenticated() && 
                authModule.hasRole('organizer') &&
                authModule.isProActive();
            
            utils.toggleVisibility('challenge-section', canChallenge);
            
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
        
        if (confirm('Бросить вызов на этот матч?')) {
            try {
                const { error } = await this.app.supabase
                    .from('challenges')
                    .insert([{
                        from_team_id: null,
                        to_team_id: this.app.selectedMatch.team1?.id || this.app.selectedMatch.team2?.id,
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
    }
};