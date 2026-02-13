// js/match-edit.js - Редактирование матчей с таймером и управлением составом
const matchEditModule = {
    currentMatch: null,
    originalMatch: null,
    isEditing: false,
    timerInterval: null,

    async show(matchId) {
        try {
            const { data: match, error } = await app.supabase
                .from('matches')
                .select(`
                    *,
                    team1:teams!matches_team1_fkey(*),
                    team2:teams!matches_team2_fkey(*)
                `)
                .eq('id', matchId)
                .single();

            if (error) throw error;

            const userId = authModule.getUserId();
            const isTeam1Owner = match.team1?.owner_id === userId;
            const isTeam2Owner = match.team2?.owner_id === userId;
            
            if (!isTeam1Owner && !isTeam2Owner) {
                alert('Только владельцы команд могут управлять матчем');
                return;
            }

            this.currentMatch = match;
			this.ourTeamId = isTeam1Owner ? match.team1.id : match.team2.id;
            this.originalMatch = JSON.parse(JSON.stringify(match));
            this.isEditing = false;
            
            this.render();
            screenManager.show('screen-match-edit');
            this.updateMatchTimer();
            
        } catch (error) {
            console.error('❌ Ошибка загрузки матча:', error);
            alert('Ошибка загрузки матча: ' + error.message);
        }
    },

    render() {
        if (!this.currentMatch) return;
        const match = this.currentMatch;
        this.renderTeamsInfo(match);
        this.renderScoreSection(match);
        this.renderMatchInfo(match);
        this.renderStatusControls(match);
        this.renderWarnings(match);
    },

    updateMatchTimer() {
        const match = this.currentMatch;
        if (!match) return;
        
        const timerEl = document.getElementById('match-timer');
        if (!timerEl) return;
        
        if (match.status === 'live' && match.started_at) {
            const startTime = new Date(match.started_at);
            const duration = this.formatDuration(new Date() - startTime);
            
            timerEl.innerHTML = `
                <div style="color: var(--accent-green); font-weight: 700; font-size: 1.4rem; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <i class="fas fa-stopwatch" style="animation: pulse 1s infinite;"></i>
                    <span id="timer-value">${duration}</span>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">
                    Начало: ${startTime.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}
                </div>
            `;
            timerEl.classList.remove('hidden');
            
            if (this.timerInterval) clearInterval(this.timerInterval);
            this.timerInterval = setInterval(() => {
                const dur = this.formatDuration(new Date() - startTime);
                const span = document.getElementById('timer-value');
                if (span) span.textContent = dur;
            }, 1000);
            
        } else if (match.status === 'finished' && match.started_at && match.finished_at) {
            const startTime = new Date(match.started_at);
            const endTime = new Date(match.finished_at);
            const duration = this.formatDuration(endTime - startTime);
            
            timerEl.innerHTML = `
                <div style="color: var(--accent-blue); font-weight: 700; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <i class="fas fa-clock"></i>
                    <span>Длительность: ${duration}</span>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">
                    ${startTime.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})} - ${endTime.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}
                </div>
            `;
            timerEl.classList.remove('hidden');
            if (this.timerInterval) clearInterval(this.timerInterval);
            
        } else if (match.status === 'cancelled') {
            timerEl.innerHTML = `<div style="color: var(--accent-pink); font-size: 1rem;"><i class="fas fa-ban"></i> Матч отменен</div>`;
            timerEl.classList.remove('hidden');
            if (this.timerInterval) clearInterval(this.timerInterval);
            
        } else if (match.date) {
            const matchDate = new Date(match.date);
            const diffMs = matchDate - new Date();
            
            if (diffMs > 0) {
                timerEl.innerHTML = `<div style="color: var(--text-secondary); font-size: 1rem;"><i class="fas fa-hourglass-start"></i> До начала: <span style="color: var(--accent-green); font-weight: 700;">${this.formatDuration(diffMs)}</span></div>`;
                timerEl.classList.remove('hidden');
                if (this.timerInterval) clearInterval(this.timerInterval);
                this.timerInterval = setInterval(() => {
                    const diff = matchDate - new Date();
                    if (diff <= 0) { this.updateMatchTimer(); return; }
                    const span = timerEl.querySelector('span');
                    if (span) span.textContent = this.formatDuration(diff);
                }, 1000);
            } else {
                timerEl.innerHTML = `<div style="color: var(--accent-pink); font-size: 0.9rem;"><i class="fas fa-exclamation-triangle"></i> Время матча прошло</div>`;
                timerEl.classList.remove('hidden');
            }
        }
    },

    formatDuration(ms) {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));
        if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },

    clearTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

    renderTeamsInfo(match) {
        const sportElement = document.getElementById('edit-match-sport');
        if (sportElement) sportElement.innerHTML = `<i class="fas fa-${app.getSportIcon(match.sport)}"></i> ${app.getSportName(match.sport).toUpperCase()}`;
        
        // Команда 1
        const team1AvatarEl = document.getElementById('edit-match-team1-avatar');
        if (team1AvatarEl) {
            if (match.team1?.logo_url) {
                team1AvatarEl.innerHTML = `
                    <img src="${match.team1.logo_url}" 
                         alt="${match.team1.name}" 
                         style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;"
                         onerror="this.style.display='none'; this.parentElement.textContent='${match.team1?.avatar || '⚽'}'">
                `;
            } else {
                team1AvatarEl.textContent = match.team1?.avatar || '⚽';
            }
        }
        document.getElementById('edit-match-team1-name').textContent = match.team1?.name || 'Неизвестно';
        
        // Команда 2
        const team2AvatarEl = document.getElementById('edit-match-team2-avatar');
        if (team2AvatarEl) {
            if (match.team2?.logo_url) {
                team2AvatarEl.innerHTML = `
                    <img src="${match.team2.logo_url}" 
                         alt="${match.team2.name}" 
                         style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;"
                         onerror="this.style.display='none'; this.parentElement.textContent='${match.team2?.avatar || '⚽'}'">
                `;
            } else {
                team2AvatarEl.textContent = match.team2?.avatar || '⚽';
            }
        }
        document.getElementById('edit-match-team2-name').textContent = match.team2?.name || 'Неизвестно';
    },

    renderScoreSection(match) {
        const [score1, score2] = match.score ? match.score.split(':').map(Number) : [0, 0];
        const score1Input = document.getElementById('edit-match-score1');
        const score2Input = document.getElementById('edit-match-score2');
        const scoreBtns = document.querySelectorAll('.score-btn');
        const scoreMessage = document.getElementById('score-status-message');
        
        score1Input.value = score1;
        score2Input.value = score2;
        
        if (match.status === 'upcoming') {
            score1Input.disabled = true; score2Input.disabled = true;
            scoreBtns.forEach(btn => btn.style.display = 'none');
            if (scoreMessage) scoreMessage.textContent = 'Счет будет доступен после начала матча';
            score1Input.classList.remove('final-score'); score2Input.classList.remove('final-score');
        } else if (match.status === 'live') {
            score1Input.disabled = false; score2Input.disabled = false;
            scoreBtns.forEach(btn => btn.style.display = 'flex');
            if (scoreMessage) scoreMessage.textContent = 'Установите счет и нажмите "Завершить матч"';
            score1Input.classList.remove('final-score'); score2Input.classList.remove('final-score');
        } else if (match.status === 'finished') {
            score1Input.disabled = true; score2Input.disabled = true;
            scoreBtns.forEach(btn => btn.style.display = 'none');
            score1Input.classList.add('final-score'); score2Input.classList.add('final-score');
            if (scoreMessage) scoreMessage.innerHTML = '<span style="color: var(--accent-green); font-weight: 700;"><i class="fas fa-check-circle"></i> Матч завершен</span>';
        } else if (match.status === 'cancelled') {
            score1Input.disabled = true; score2Input.disabled = true;
            scoreBtns.forEach(btn => btn.style.display = 'none');
            score1Input.classList.remove('final-score'); score2Input.classList.remove('final-score');
            if (scoreMessage) scoreMessage.textContent = 'Матч отменен';
        }
    },

    renderMatchInfo(match) {
        const formatSelect = document.getElementById('edit-match-format');
        const datetimeInput = document.getElementById('edit-match-datetime');
        const locationInput = document.getElementById('edit-match-location');
        const locationBtn = document.getElementById('edit-match-location-btn');
        
        if (formatSelect) formatSelect.value = match.format || '5x5';
        if (datetimeInput) datetimeInput.value = match.date ? utils.formatDateTimeLocal(match.date) : '';
        if (locationInput) locationInput.value = match.location || '';
        
        const isEditable = match.status === 'upcoming';
        if (formatSelect) formatSelect.disabled = !isEditable;
        if (datetimeInput) datetimeInput.disabled = !isEditable;
        if (locationInput) locationInput.disabled = !isEditable;
        if (locationBtn) locationBtn.style.display = isEditable ? 'inline-flex' : 'none';
        
        const statusBadge = document.getElementById('edit-match-status-badge');
        if (statusBadge) {
            const config = {
                'upcoming': { text: 'ПРЕДСТОИТ', class: 'status-upcoming', icon: 'fa-clock' },
                'live': { text: 'ИДЁТ СЕЙЧАС', class: 'status-live', icon: 'fa-play-circle' },
                'finished': { text: 'ЗАВЕРШЁН', class: 'status-finished', icon: 'fa-flag-checkered' },
                'cancelled': { text: 'ОТМЕНЁН', class: 'status-cancelled', icon: 'fa-ban' }
            }[match.status] || { text: 'ПРЕДСТОИТ', class: 'status-upcoming', icon: 'fa-clock' };
            statusBadge.className = `match-status ${config.class}`;
            statusBadge.innerHTML = `<i class="fas ${config.icon}"></i> ${config.text}`;
        }
    },

    renderStatusControls(match) {
        const container = document.getElementById('match-status-controls');
        if (!container) return;
        container.innerHTML = '';
        
        const userId = authModule.getUserId();
        const isTeam1Owner = match.team1?.owner_id === userId;
        const isTeam2Owner = match.team2?.owner_id === userId;
        const isOwner = isTeam1Owner || isTeam2Owner;
        
        if (!isOwner) return;
        
        const buttons = [];
        
        switch (match.status) {
            case 'upcoming':
                if (match.team2) {
                    // Проверяем, выбран ли состав для обеих команд
                    buttons.push({ 
                        text: 'Проверить составы', 
                        icon: 'fa-users-check', 
                        class: 'btn-info', 
                        handler: () => this.checkRostersBeforeStart() 
                    });
                    buttons.push({ 
                        text: 'Начать матч', 
                        icon: 'fa-play', 
                        class: 'btn-success', 
                        confirm: 'Начать матч? Таймер начнет отсчет.', 
                        handler: () => this.startMatch() 
                    });
                } else {
                    buttons.push({ 
                        text: 'Ожидание соперника', 
                        icon: 'fa-clock', 
                        class: 'btn-secondary', 
                        disabled: true, 
                        handler: () => {} 
                    });
                }
                buttons.push({ 
                    text: 'Выбрать состав', 
                    icon: 'fa-users', 
                    class: 'btn-primary', 
                    handler: () => this.showRosterManagement() 
                });
                buttons.push({ 
                    text: 'Редактировать матч', 
                    icon: 'fa-pen', 
                    class: 'btn-primary', 
                    handler: () => this.isEditing ? this.saveMatchChanges() : this.startEditing() 
                });
                buttons.push({ 
                    text: 'Отменить матч', 
                    icon: 'fa-ban', 
                    class: 'btn-danger', 
                    confirm: 'Отменить матч? Его можно будет возобновить позже.', 
                    handler: () => this.cancelMatch() 
                });
                break;
                
            case 'live':
                buttons.push({ 
                    text: 'Завершить матч', 
                    icon: 'fa-flag-checkered', 
                    class: 'btn-success', 
                    confirm: 'Завершить матч? После завершения данные нельзя изменить!', 
                    handler: () => this.finishMatch() 
                });
                buttons.push({ 
                    text: 'Изменить состав', 
                    icon: 'fa-users', 
                    class: 'btn-primary', 
                    handler: () => this.showRosterManagement() 
                });
				
				if (this.ourTeamId) {
    buttons.push({
        text: 'Статистика игроков',
        icon: 'fa-chart-simple',
        class: 'btn-info',
        handler: () => this.showPlayerStats(this.currentMatch.id, this.ourTeamId)
    });
}
				
                buttons.push({ 
                    text: 'Отменить матч', 
                    icon: 'fa-ban', 
                    class: 'btn-danger', 
                    confirm: 'Прервать и отменить текущий матч?', 
                    handler: () => this.cancelMatch() 
                });
                break;
                
            case 'finished':
                buttons.push({ 
                    text: 'Просмотр состава', 
                    icon: 'fa-users', 
                    class: 'btn-primary', 
                    handler: () => this.showRosterManagement() 
                });
                buttons.push({ 
                    text: 'Назад', 
                    icon: 'fa-arrow-left', 
                    class: 'btn-secondary', 
                    handler: () => this.back() 
                });
                break;
                
            case 'cancelled':
                buttons.push({ 
                    text: 'Возобновить матч', 
                    icon: 'fa-redo', 
                    class: 'btn-warning', 
                    confirm: 'Возобновить матч?', 
                    handler: () => this.resumeMatch() 
                });
                buttons.push({ 
                    text: 'Назад', 
                    icon: 'fa-arrow-left', 
                    class: 'btn-secondary', 
                    handler: () => this.back() 
                });
                break;
        }
        
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = `btn ${btn.class}`;
            button.innerHTML = `<i class="fas ${btn.icon}"></i> ${btn.text}`;
            
            if (btn.disabled) {
                button.disabled = true;
                button.style.opacity = '0.6';
                button.style.cursor = 'not-allowed';
            }
            
            if (btn.confirm && !btn.disabled) {
                button.onclick = () => {
                    if (confirm(btn.confirm)) btn.handler();
                };
            } else {
                button.onclick = btn.handler;
            }
            
            container.appendChild(button);
        });
    },

    renderWarnings(match) {
        const warningsEl = document.getElementById('edit-match-warnings');
        if (!warningsEl) return;
        
        let warnings = [];
        
        if (!match.team2) {
            warnings.push('⚠️ Добавьте соперника для начала матча');
        }
        
        if (match.status === 'upcoming' && new Date(match.date) < new Date()) {
            warnings.push('⏰ Время матча уже прошло');
        }
        
        // Проверка состава для предстоящих матчей
        if (match.status === 'upcoming') {
            if (!match.team2) {
                warnings.push('👥 Выберите состав своей команды');
            } else {
                warnings.push('👥 Выберите состав своей команды (соперник выберет свой)');
            }
        }
        
        if (warnings.length > 0) {
            warningsEl.innerHTML = warnings.map(w => `<div class="warning-item">${w}</div>`).join('');
            warningsEl.classList.remove('hidden');
        } else {
            warningsEl.classList.add('hidden');
        }
    },

    async checkRostersBeforeStart() {
        if (!this.currentMatch) return;
        
        try {
            const match = this.currentMatch;
            let allRostersComplete = true;
            let messages = [];
            
            // Проверяем состав нашей команды
            const ourTeamId = match.team1?.id;
            if (ourTeamId) {
                const ourRoster = await this.getMatchRoster(match.id, ourTeamId);
                const requiredPlayers = this.getRequiredPlayersCount(match.format);
                
                if (!ourRoster || ourRoster.length < requiredPlayers) {
                    allRostersComplete = false;
                    messages.push(`Наша команда: не выбран состав (нужно ${requiredPlayers} игроков)`);
                }
            }
            
            // Проверяем состав соперника (если он есть)
            const opponentTeamId = match.team2?.id;
            if (opponentTeamId) {
                const opponentRoster = await this.getMatchRoster(match.id, opponentTeamId);
                const requiredPlayers = this.getRequiredPlayersCount(match.format);
                
                if (!opponentRoster || opponentRoster.length < requiredPlayers) {
                    allRostersComplete = false;
                    messages.push(`Соперник: не выбран состав (нужно ${requiredPlayers} игроков)`);
                }
            }
            
            if (allRostersComplete) {
                alert('✅ Обе команды выбрали состав! Можно начинать матч.');
            } else {
                let message = '⚠️ Не все команды выбрали состав:\n\n';
                message += messages.join('\n');
                message += '\n\nВладелец каждой команды должен выбрать состав самостоятельно.';
                alert(message);
            }
            
        } catch (error) {
            console.error('❌ Ошибка проверки состава:', error);
            alert('Ошибка при проверке состава команд');
        }
    },

    getRequiredPlayersCount(format) {
        const formatMap = {
            '2x2': 2,
            '3x3': 3,
            '4x4': 4,
            '5x5': 5,
            '7x7': 7,
            '11x11': 11
        };
        return formatMap[format] || 5;
    },

    async getMatchRoster(matchId, teamId) {
        try {
            const { data: roster, error } = await app.supabase
                .from('match_rosters')
                .select(`
                    player:team_players(*)
                `)
                .eq('match_id', matchId)
                .eq('team_id', teamId);
            
            if (error) throw error;
            
            return roster?.map(r => r.player) || [];
        } catch (error) {
            console.error('❌ Ошибка загрузки состава:', error);
            return null;
        }
    },

    async startMatch() {
        try {
            if (!this.currentMatch?.team2) { 
                alert('Нельзя начать матч без соперника'); 
                return; 
            }
            
            // Проверяем составы обеих команд
            const match = this.currentMatch;
            const requiredPlayers = this.getRequiredPlayersCount(match.format);
            
            // Проверяем состав нашей команды
            const ourRoster = await this.getMatchRoster(match.id, match.team1.id);
            if (!ourRoster || ourRoster.length < requiredPlayers) {
                alert(`Наша команда не выбрала состав! Нужно минимум ${requiredPlayers} игроков.`);
                return;
            }
            
            // Проверяем состав соперника
            const opponentRoster = await this.getMatchRoster(match.id, match.team2.id);
            if (!opponentRoster || opponentRoster.length < requiredPlayers) {
                alert(`Соперник не выбрал состав! Нужно минимум ${requiredPlayers} игроков.`);
                return;
            }
            
            const { error } = await app.supabase
                .from('matches')
                .update({ 
                    status: 'live', 
                    started_at: new Date().toISOString(), 
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentMatch.id);
            
            if (error) throw error;
            
            this.currentMatch.status = 'live';
            this.currentMatch.started_at = new Date().toISOString();
            alert('✅ Матч начался! Таймер запущен.');
            this.render(); 
            this.updateMatchTimer();
            
            if (matchesModule) await matchesModule.renderMatches();
            
        } catch (error) { 
            alert('❌ Ошибка: ' + error.message); 
        }
    },

    async finishMatch() {
        try {
            if (!this.currentMatch) return;
            
            const score1 = parseInt(document.getElementById('edit-match-score1').value) || 0;
            const score2 = parseInt(document.getElementById('edit-match-score2').value) || 0;
            
            if (!confirm(`Завершить матч со счетом ${score1}:${score2}?`)) return;
            
            const { error } = await app.supabase
                .from('matches')
                .update({ 
                    status: 'finished', 
                    score: `${score1}:${score2}`, 
                    finished_at: new Date().toISOString(), 
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentMatch.id);
            
            if (error) throw error;

            // Обновляем статистику команд
            await this.updateTeamStats(score1, score2);
            
            // Обновляем ELO рейтинги
            if (typeof eloModule !== 'undefined') {
                await eloModule.onMatchFinished(this.currentMatch.id);
            }

            this.currentMatch.status = 'finished';
            this.currentMatch.finished_at = new Date().toISOString();
            this.currentMatch.score = `${score1}:${score2}`;
            
            this.clearTimer();
            
            const duration = this.formatDuration(
                new Date(this.currentMatch.finished_at) - new Date(this.currentMatch.started_at)
            );
            
            alert(`✅ Матч завершен! Длительность: ${duration}`);
            this.render(); 
            this.updateMatchTimer();
            
            if (matchesModule) await matchesModule.renderMatches();
            
        } catch (error) { 
            alert('❌ Ошибка: ' + error.message); 
        }
    },

    async cancelMatch() {
        try {
            if (!confirm('Вы уверены, что хотите отменить матч?')) return;
            
            const { error } = await app.supabase
                .from('matches')
                .update({ 
                    status: 'cancelled', 
                    cancelled_at: new Date().toISOString(), 
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentMatch.id);
            
            if (error) throw error;
            
            this.currentMatch.status = 'cancelled';
            this.currentMatch.cancelled_at = new Date().toISOString();
            this.clearTimer(); 
            
            alert('✅ Матч отменен');
            this.render(); 
            this.updateMatchTimer();
            
            if (matchesModule) await matchesModule.renderMatches();
            
        } catch (error) { 
            alert('❌ Ошибка: ' + error.message); 
        }
    },

    async resumeMatch() {
        try {
            if (!confirm('Возобновить матч?')) return;
            
            const { error } = await app.supabase
                .from('matches')
                .update({ 
                    status: 'upcoming', 
                    started_at: null, 
                    finished_at: null, 
                    cancelled_at: null, 
                    score: '0:0', 
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentMatch.id);
            
            if (error) throw error;
            
            this.currentMatch.status = 'upcoming';
            this.currentMatch.score = '0:0';
            this.currentMatch.started_at = null;
            this.currentMatch.finished_at = null;
            this.currentMatch.cancelled_at = null;
            
            this.clearTimer(); 
            alert('✅ Матч возобновлен');
            this.render(); 
            this.updateMatchTimer();
            
            if (matchesModule) await matchesModule.renderMatches();
            
        } catch (error) { 
            alert('❌ Ошибка: ' + error.message); 
        }
    },

    async updateTeamStats(score1, score2) {
        try {
            const match = this.currentMatch;
            if (!match.team1 || !match.team2) return;
            
            let team1Update = {}, team2Update = {};
            
            if (score1 > score2) {
                team1Update = { wins: (match.team1.wins || 0) + 1 };
                team2Update = { losses: (match.team2.losses || 0) + 1 };
            } else if (score2 > score1) {
                team1Update = { losses: (match.team1.losses || 0) + 1 };
                team2Update = { wins: (match.team2.wins || 0) + 1 };
            } else {
                team1Update = { draws: (match.team1.draws || 0) + 1 };
                team2Update = { draws: (match.team2.draws || 0) + 1 };
            }
            
            await app.supabase.from('teams').update(team1Update).eq('id', match.team1.id);
            await app.supabase.from('teams').update(team2Update).eq('id', match.team2.id);
            
        } catch (error) { 
            console.error('❌ Ошибка обновления статистики:', error); 
        }
    },

    async saveMatchChanges() {
        if (this.currentMatch.status !== 'upcoming') { 
            alert('Редактирование доступно только для предстоящих матчей'); 
            return; 
        }
        
        const updates = {
            date: document.getElementById('edit-match-datetime').value,
            location: document.getElementById('edit-match-location').value,
            format: document.getElementById('edit-match-format').value,
            lat: document.getElementById('edit-match-lat').value || null,
            lng: document.getElementById('edit-match-lng').value || null,
            updated_at: new Date().toISOString()
        };
        
        try {
            const { error } = await app.supabase
                .from('matches')
                .update(updates)
                .eq('id', this.currentMatch.id);
            
            if (error) throw error;
            
            Object.assign(this.currentMatch, updates);
            this.isEditing = false; 
            
            alert('✅ Изменения сохранены!');
            this.render(); 
            this.updateMatchTimer();
            
            if (matchesModule) await matchesModule.renderMatches();
            
        } catch (error) { 
            alert('❌ Ошибка сохранения: ' + error.message); 
        }
    },

    startEditing() {
        if (this.currentMatch.status !== 'upcoming') return;
        this.isEditing = true; 
        this.render();
        document.getElementById('edit-match-format').disabled = false;
        document.getElementById('edit-match-datetime').disabled = false;
        document.getElementById('edit-match-location').disabled = false;
        document.getElementById('edit-match-location-btn').style.display = 'inline-flex';
    },

    cancelEditing() { 
        this.isEditing = false; 
        this.currentMatch = JSON.parse(JSON.stringify(this.originalMatch)); 
        this.render(); 
    },

    adjustScore(change, teamNumber) {
    if (this.currentMatch.status !== 'live') return;
    
    const input = document.getElementById(
        teamNumber === 1 ? 'edit-match-score1' : 'edit-match-score2'
    );
    
    let value = parseInt(input.value) || 0;
    value = Math.max(0, value + change);
    input.value = value;
    
    // Сохраняем счет в БД
    this.updateScore();
},

    openMapForLocation() {
        mapModule.openMapForLocation();
        const originalConfirm = mapModule.confirmLocation;
        
        mapModule.confirmLocation = () => {
            document.getElementById('edit-match-location').value = 
                document.getElementById('location-name').value;
            
            document.getElementById('edit-match-lat').value = mapModule.selectedCoords[0];
            document.getElementById('edit-match-lng').value = mapModule.selectedCoords[1];
            
            mapModule.closeLocationPicker();
            mapModule.confirmLocation = originalConfirm;
        };
    },

    showRosterManagement() {
        const userId = authModule.getUserId();
        const match = this.currentMatch;
        
        if (!match) return;
        
        const isTeam1Owner = match.team1?.owner_id === userId;
        const isTeam2Owner = match.team2?.owner_id === userId;
        
        // Определяем, какую команду редактировать
        let teamId, isOurTeam;
        
        if (isTeam1Owner) {
            // Пользователь владелец команды 1 - это наша команда
            teamId = match.team1.id;
            isOurTeam = true;
        } else if (isTeam2Owner) {
            // Пользователь владелец команды 2 - это команда соперника
            teamId = match.team2.id;
            isOurTeam = false;
        } else {
            alert('Вы не являетесь владельцем ни одной из команд');
            return;
        }
        
        // Открываем экран управления составом
        if (typeof matchRosterModule !== 'undefined' && matchRosterModule.show) {
            // Передаем matchId, teamId и isOurTeam (чтобы понимать, какая это команда)
            matchRosterModule.show(match.id, teamId, isOurTeam);
        } else {
            alert('Модуль управления составом не доступен');
        }
    },




    back() {
        this.clearTimer();
        if (this.isEditing) {
            if (confirm('Есть несохраненные изменения. Выйти без сохранения?')) {
                this.cancelEditing();
                screenManager.back();
            }
        } else {
            screenManager.back();
        }
    },
	
	async showPlayerStats(matchId, teamId) {
    try {
        // Загружаем матч
        const { data: match, error } = await app.supabase
            .from('matches')
            .select('*, team1:teams!matches_team1_fkey(*), team2:teams!matches_team2_fkey(*)')
            .eq('id', matchId)
            .single();
        if (error) throw error;
        this.currentMatch = match;
		this.ourTeamId = teamId;		

        // Загружаем состав на матч (игроки команды)
        const { data: roster, error: rosterError } = await app.supabase
            .from('match_rosters')
            .select('*, player:team_players(*)')
            .eq('match_id', matchId)
            .eq('team_id', teamId);
        if (rosterError) throw rosterError;

        // Загружаем текущую статистику для этого матча и команды
        const { data: stats, error: statsError } = await app.supabase
            .from('match_player_stats')
            .select('*')
            .eq('match_id', matchId)
            .eq('team_id', teamId);
        if (statsError) throw statsError;

        const statsMap = {};
        stats?.forEach(s => { statsMap[s.team_player_id] = s; });

        // Показываем экран
        screenManager.show('screen-match-player-stats');

        // Рендерим форму
        this.renderPlayerStatsForm(match, roster, statsMap, teamId);
    } catch (error) {
        console.error('❌ Ошибка загрузки статистики:', error);
        alert('Не удалось загрузить данные статистики');
    }
},

renderPlayerStatsForm(match, roster, statsMap, teamId) {
    const container = document.getElementById('match-player-stats-content');
    if (!container) return;

    const sport = match.sport;
    const config = window.sportStatConfig?.[sport] || { fields: [] };
    const validationInfo = this.getScoreValidationInfo(); // нужно убедиться, что this.ourTeamId уже установлен
    const { scoreField, teamScore } = validationInfo || { scoreField: 'goals', teamScore: 0 };

    // Предварительно подсчитаем уже распределенные голы/очки из statsMap
    let currentTotal = 0;
    roster.forEach(item => {
        const stat = statsMap[item.player.id] || {};
        currentTotal += stat[scoreField] || 0;
    });

    const remaining = Math.max(0, teamScore - currentTotal);

    let html = `
        <div class="player-stats-container">
            <div class="stats-header">
                <h2>Статистика игроков</h2>
                <span class="sport-badge">${app.getSportName(sport)}</span>
            </div>
            <div class="score-progress-bar">
                <div class="progress-info">
                    <span>Счет команды: <strong>${teamScore}</strong></span>
                    <span>Распределено: <strong>${currentTotal}</strong></span>
                    <span class="${remaining === 0 ? 'text-success' : 'text-warning'}">Осталось: <strong>${remaining}</strong></span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${teamScore > 0 ? (currentTotal / teamScore * 100) : 0}%"></div>
                </div>
            </div>
            <div class="player-stats-list">`;

    roster.forEach(item => {
        const player = item.player;
        const stat = statsMap[player.id] || {};
        html += `
            <div class="player-stat-card">
                <div class="player-info-row">
                    <span class="player-number">${player.number || '-'}</span>
                    <span class="player-name">${player.name}</span>
                    ${player.is_captain ? '<span class="captain-badge">C</span>' : ''}
                    <span class="player-role">${player.role || ''}</span>
                </div>
                <div class="stat-fields-row">`;

        config.fields.forEach(field => {
            // Проверка видимости (например, для вратарей)
            if (field.visible && !field.visible(player.role)) return;

            const value = stat[field.name] || 0;
            html += `
                <div class="stat-field">
    <label>${field.label}</label>
    <div class="stat-input-group">
        <button type="button" class="stat-btn minus" 
                onclick="matchEditModule.adjustPlayerStat('${player.id}', '${field.name}', -1)">−</button>
        <input type="number" 
               class="stat-input" 
               data-player-id="${player.id}"
               data-stat-name="${field.name}"
               value="${value}"
               min="0" 
               max="${field.max || 99}">
        <button type="button" class="stat-btn plus" 
                onclick="matchEditModule.adjustPlayerStat('${player.id}', '${field.name}', 1)">+</button>
    </div>
</div>`;
        });

        html += `</div></div>`;
    });

    // Добавим кнопку быстрого распределения оставшихся голов/очков
    html += `</div>
        <div class="player-stats-actions">
            ${remaining > 0 ? `
            <button class="btn btn-secondary" onclick="matchEditModule.distributeRemainingScore(${remaining}, '${scoreField}')">
                <i class="fas fa-magic"></i> Распределить ${remaining} ${scoreField === 'goals' ? 'голов' : 
                                                                       scoreField === 'points' ? 'очков' : 
                                                                       'побед'}
            </button>
            ` : ''}
            <button class="btn btn-primary" onclick="matchEditModule.savePlayerStats('${match.id}', '${teamId}')">
                <i class="fas fa-save"></i> Сохранить статистику
            </button>
            <button class="btn btn-secondary" onclick="matchEditModule.back()">Отмена</button>
        </div>
    </div>`;

    container.innerHTML = html;
    
    // Добавляем обработчики для обновления прогресса при изменении инпутов
    this.attachStatInputListeners(scoreField, teamScore);
},

adjustPlayerStat(playerId, statName, delta) {
    const input = document.querySelector(`.stat-input[data-player-id="${playerId}"][data-stat-name="${statName}"]`);
    if (!input) return;
    
    let value = parseInt(input.value) || 0;
    const max = parseInt(input.getAttribute('max')) || 99;
    value = Math.min(max, Math.max(0, value + delta));
    input.value = value;
    
    // Обновляем прогресс-бар (если есть)
    if (this._boundUpdateProgress) this._boundUpdateProgress();
},

distributeRemainingScore(remaining, scoreField) {
    if (remaining <= 0) return;
    
    const inputs = Array.from(document.querySelectorAll('.stat-input'))
        .filter(input => input.dataset.statName === scoreField);
    
    if (inputs.length === 0) return;
    
    // Простое распределение: добавляем по 1 к первому игроку
    // Можно сделать более умное распределение, но для начала так
    inputs[0].value = (parseInt(inputs[0].value) || 0) + remaining;
    
    // Обновляем прогресс
    if (this._boundUpdateProgress) this._boundUpdateProgress();
},

attachStatInputListeners(scoreField, teamScore) {
    // Создаём новую функцию обновления
    const updateProgress = () => {
        let total = 0;
        document.querySelectorAll('.stat-input').forEach(input => {
            if (input.dataset.statName === scoreField) {
                total += parseInt(input.value) || 0;
            }
        });
        const remaining = Math.max(0, teamScore - total);

        const progressFill = document.querySelector('.progress-fill');
        const distributedSpan = document.querySelector('.progress-info span:nth-child(2) strong');
        const remainingSpan = document.querySelector('.progress-info span:last-child strong');

        if (progressFill) {
            progressFill.style.width = teamScore > 0 ? (total / teamScore * 100) + '%' : '0%';
        }
        if (distributedSpan) distributedSpan.textContent = total;
        if (remainingSpan) {
            remainingSpan.textContent = remaining;
            const parent = remainingSpan.parentElement;
            if (parent) {
                parent.className = remaining === 0 ? 'text-success' : 'text-warning';
            }
        }
    };

    // Сохраняем привязанную версию
    this._boundUpdateProgress = updateProgress.bind(this);

    // Обновляем слушатели на всех input
    document.querySelectorAll('.stat-input').forEach(input => {
        input.removeEventListener('input', this._boundUpdateProgress);
        input.addEventListener('input', this._boundUpdateProgress);
    });
},

async savePlayerStats(matchId, teamId) {
    const inputs = document.querySelectorAll('.stat-input');
    const statsData = [];
    const validationInfo = this.getScoreValidationInfo();
    
    if (!validationInfo) {
        alert('Ошибка: не удалось определить данные для валидации');
        return;
    }

    const { scoreField, teamScore } = validationInfo;

    // Собираем данные и сразу считаем сумму голов/очков
    let totalPlayerScore = 0;

    inputs.forEach(input => {
        const playerId = input.dataset.playerId;
        const statName = input.dataset.statName;
        const value = parseInt(input.value) || 0;

        let playerStat = statsData.find(s => s.team_player_id === playerId);
        if (!playerStat) {
            playerStat = {
                match_id: matchId,
                team_player_id: playerId,
                team_id: teamId,
                sport: this.currentMatch.sport,
                created_by: authModule.getUserId()
            };
            statsData.push(playerStat);
        }
        playerStat[statName] = value;

        // Суммируем только то поле, которое отвечает за результативность
        if (statName === scoreField) {
            totalPlayerScore += value;
        }
    });

    // ВАЛИДАЦИЯ: сумма голов/очков игроков не может превышать счет команды
    if (totalPlayerScore > teamScore) {
        alert(`Ошибка: суммарное количество ${scoreField === 'goals' ? 'голов' : 
              scoreField === 'points' ? 'очков' : 'выигранных партий'} 
              игроков (${totalPlayerScore}) превышает счет команды (${teamScore})`);
        return;
    }

    try {
        // Удаляем старую статистику
        await app.supabase
            .from('match_player_stats')
            .delete()
            .eq('match_id', matchId)
            .eq('team_id', teamId);

        // Вставляем новую
        if (statsData.length > 0) {
            const { error } = await app.supabase
                .from('match_player_stats')
                .insert(statsData);
            if (error) throw error;
        }

        alert('Статистика сохранена!');
        this.back();
    } catch (error) {
        console.error('❌ Ошибка сохранения статистики:', error);
        alert('Ошибка при сохранении');
    }
},

// Возвращает scoreField для данного спорта и значение счета нашей команды
getScoreValidationInfo() {
    const match = this.currentMatch;
    if (!match) return null;

    // Определяем, какое поле отвечает за результативные действия в этом спорте
    let scoreField;
    switch (match.sport) {
        case 'football':
        case 'hockey':
            scoreField = 'goals';
            break;
        case 'basketball':
        case 'volleyball':
            scoreField = 'points';
            break;
        case 'tabletennis':
            scoreField = 'games_won';
            break;
        default:
            scoreField = 'goals'; // fallback
    }

    // Парсим счет матча
    const [score1, score2] = (match.score || '0:0').split(':').map(Number);
    
    // Определяем счет нашей команды
    let teamScore;
    if (match.team1?.id === this.ourTeamId) {
        teamScore = score1;
    } else if (match.team2?.id === this.ourTeamId) {
        teamScore = score2;
    } else {
        teamScore = 0;
    }

    return { scoreField, teamScore, teamId: this.ourTeamId };
},

async updateScore() {
    if (this.currentMatch.status !== 'live') return;
    
    const score1 = parseInt(document.getElementById('edit-match-score1').value) || 0;
    const score2 = parseInt(document.getElementById('edit-match-score2').value) || 0;
    const newScore = `${score1}:${score2}`;
    
    // Если счет не изменился — не делаем запрос
    if (this.currentMatch.score === newScore) return;
    
    try {
        const { error } = await app.supabase
            .from('matches')
            .update({ 
                score: newScore,
                updated_at: new Date().toISOString()
            })
            .eq('id', this.currentMatch.id);
        
        if (error) throw error;
        
        // Обновляем локальные данные
        this.currentMatch.score = newScore;
        
        // Обновляем список матчей на главном экране
        if (typeof matchesModule !== 'undefined' && matchesModule.renderMatches) {
            matchesModule.renderMatches();
        }
        
        // Если открыт экран деталей этого матча — обновляем его
        if (app.selectedMatch?.id === this.currentMatch.id) {
            matchesModule.renderMatchDetail(this.currentMatch);
        }
        
        console.log('✅ Счет обновлен:', newScore);
    } catch (error) {
        console.error('❌ Ошибка обновления счета:', error);
    }
}
	
	
	
};