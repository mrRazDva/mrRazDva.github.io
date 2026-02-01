// js/match-edit.js - Редактирование матчей с таймером
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
        const isOwner = match.team1?.owner_id === userId || match.team2?.owner_id === userId;
        if (!isOwner) return;
        
        const buttons = [];
        switch (match.status) {
            case 'upcoming':
                if (match.team2) buttons.push({ text: 'Начать матч', icon: 'fa-play', class: 'btn-success', confirm: 'Начать матч? Таймер начнет отсчет.', handler: () => this.startMatch() });
                else buttons.push({ text: 'Ожидание соперника', icon: 'fa-clock', class: 'btn-secondary', disabled: true, handler: () => {} });
                buttons.push({ text: 'Редактировать', icon: 'fa-pen', class: 'btn-primary', handler: () => this.isEditing ? this.saveMatchChanges() : this.startEditing() });
                buttons.push({ text: 'Отменить матч', icon: 'fa-ban', class: 'btn-danger', confirm: 'Отменить матч? Его можно будет возобновить позже.', handler: () => this.cancelMatch() });
                break;
            case 'live':
                buttons.push({ text: 'Завершить матч', icon: 'fa-flag-checkered', class: 'btn-success', confirm: 'Завершить матч? После завершения данные нельзя изменить!', handler: () => this.finishMatch() });
                buttons.push({ text: 'Отменить матч', icon: 'fa-ban', class: 'btn-danger', confirm: 'Прервать и отменить текущий матч?', handler: () => this.cancelMatch() });
                break;
            case 'finished':
                buttons.push({ text: 'Назад', icon: 'fa-arrow-left', class: 'btn-secondary', handler: () => this.back() });
                break;
            case 'cancelled':
                buttons.push({ text: 'Возобновить матч', icon: 'fa-redo', class: 'btn-warning', confirm: 'Возобновить матч?', handler: () => this.resumeMatch() });
                buttons.push({ text: 'Назад', icon: 'fa-arrow-left', class: 'btn-secondary', handler: () => this.back() });
                break;
        }
        
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = `btn ${btn.class}`;
            button.innerHTML = `<i class="fas ${btn.icon}"></i> ${btn.text}`;
            if (btn.disabled) button.disabled = true;
            if (btn.confirm && !btn.disabled) button.onclick = () => { if (confirm(btn.confirm)) btn.handler(); };
            else button.onclick = btn.handler;
            container.appendChild(button);
        });
    },

    renderWarnings(match) {
        const warningsEl = document.getElementById('edit-match-warnings');
        if (!warningsEl) return;
        let warnings = [];
        if (!match.team2) warnings.push('⚠️ Добавьте соперника для начала матча');
        if (match.status === 'upcoming' && new Date(match.date) < new Date()) warnings.push('⏰ Время матча уже прошло');
        if (warnings.length > 0) {
            warningsEl.innerHTML = warnings.map(w => `<div class="warning-item">${w}</div>`).join('');
            warningsEl.classList.remove('hidden');
        } else warningsEl.classList.add('hidden');
    },

    async startMatch() {
        try {
            if (!this.currentMatch?.team2) { alert('Нельзя начать матч без соперника'); return; }
            const { error } = await app.supabase.from('matches').update({ 
                status: 'live', started_at: new Date().toISOString(), updated_at: new Date().toISOString()
            }).eq('id', this.currentMatch.id);
            if (error) throw error;
            this.currentMatch.status = 'live';
            this.currentMatch.started_at = new Date().toISOString();
            alert('Матч начался! Таймер запущен.');
            this.render(); this.updateMatchTimer();
            if (matchesModule) await matchesModule.renderMatches();
        } catch (error) { alert('Ошибка: ' + error.message); }
    },

    async finishMatch() {
        try {
            if (!this.currentMatch) return;
            const score1 = parseInt(document.getElementById('edit-match-score1').value) || 0;
            const score2 = parseInt(document.getElementById('edit-match-score2').value) || 0;
            if (!confirm(`Завершить матч со счетом ${score1}:${score2}?`)) return;
            
            const { error } = await app.supabase.from('matches').update({ 
                status: 'finished', score: `${score1}:${score2}`, finished_at: new Date().toISOString(), updated_at: new Date().toISOString()
            }).eq('id', this.currentMatch.id);
            if (error) throw error;

            await this.updateTeamStats(score1, score2);
            if (typeof eloModule !== 'undefined') await eloModule.onMatchFinished(this.currentMatch.id);

            this.currentMatch.status = 'finished';
            this.currentMatch.finished_at = new Date().toISOString();
            this.currentMatch.score = `${score1}:${score2}`;
            this.clearTimer();
            const duration = this.formatDuration(new Date(this.currentMatch.finished_at) - new Date(this.currentMatch.started_at));
            alert(`Матч завершен! Длительность: ${duration}`);
            this.render(); this.updateMatchTimer();
            if (matchesModule) await matchesModule.renderMatches();
        } catch (error) { alert('Ошибка: ' + error.message); }
    },

    async cancelMatch() {
        try {
            const { error } = await app.supabase.from('matches').update({ 
                status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString()
            }).eq('id', this.currentMatch.id);
            if (error) throw error;
            this.currentMatch.status = 'cancelled';
            this.currentMatch.cancelled_at = new Date().toISOString();
            this.clearTimer(); alert('Матч отменен');
            this.render(); this.updateMatchTimer();
            if (matchesModule) await matchesModule.renderMatches();
        } catch (error) { alert('Ошибка: ' + error.message); }
    },

    async resumeMatch() {
        try {
            const { error } = await app.supabase.from('matches').update({ 
                status: 'upcoming', started_at: null, finished_at: null, cancelled_at: null, score: '0:0', updated_at: new Date().toISOString()
            }).eq('id', this.currentMatch.id);
            if (error) throw error;
            this.currentMatch.status = 'upcoming';
            this.currentMatch.score = '0:0';
            this.currentMatch.started_at = null;
            this.currentMatch.finished_at = null;
            this.currentMatch.cancelled_at = null;
            this.clearTimer(); alert('Матч возобновлен');
            this.render(); this.updateMatchTimer();
            if (matchesModule) await matchesModule.renderMatches();
        } catch (error) { alert('Ошибка: ' + error.message); }
    },

    async updateTeamStats(score1, score2) {
        try {
            const match = this.currentMatch;
            if (!match.team1 || !match.team2) return;
            let team1Update = {}, team2Update = {};
            if (score1 > score2) { team1Update = { wins: (match.team1.wins || 0) + 1 }; team2Update = { losses: (match.team2.losses || 0) + 1 }; }
            else if (score2 > score1) { team1Update = { losses: (match.team1.losses || 0) + 1 }; team2Update = { wins: (match.team2.wins || 0) + 1 }; }
            else { team1Update = { draws: (match.team1.draws || 0) + 1 }; team2Update = { draws: (match.team2.draws || 0) + 1 }; }
            await app.supabase.from('teams').update(team1Update).eq('id', match.team1.id);
            await app.supabase.from('teams').update(team2Update).eq('id', match.team2.id);
        } catch (error) { console.error('❌ Ошибка обновления статистики:', error); }
    },

    async saveMatchChanges() {
        if (this.currentMatch.status !== 'upcoming') { alert('Редактирование доступно только для предстоящих матчей'); return; }
        const updates = {
            date: document.getElementById('edit-match-datetime').value,
            location: document.getElementById('edit-match-location').value,
            format: document.getElementById('edit-match-format').value,
            lat: document.getElementById('edit-match-lat').value || null,
            lng: document.getElementById('edit-match-lng').value || null,
            updated_at: new Date().toISOString()
        };
        try {
            const { error } = await app.supabase.from('matches').update(updates).eq('id', this.currentMatch.id);
            if (error) throw error;
            Object.assign(this.currentMatch, updates);
            this.isEditing = false; alert('Сохранено!');
            this.render(); this.updateMatchTimer();
            if (matchesModule) await matchesModule.renderMatches();
        } catch (error) { alert('Ошибка сохранения'); }
    },

    startEditing() {
        if (this.currentMatch.status !== 'upcoming') return;
        this.isEditing = true; this.render();
        document.getElementById('edit-match-format').disabled = false;
        document.getElementById('edit-match-datetime').disabled = false;
        document.getElementById('edit-match-location').disabled = false;
        document.getElementById('edit-match-location-btn').style.display = 'inline-flex';
    },

    cancelEditing() { this.isEditing = false; this.currentMatch = JSON.parse(JSON.stringify(this.originalMatch)); this.render(); },

    adjustScore(change, teamNumber) {
        if (this.currentMatch.status !== 'live') return;
        const input = document.getElementById(teamNumber === 1 ? 'edit-match-score1' : 'edit-match-score2');
        let value = parseInt(input.value) || 0;
        value = Math.max(0, value + change);
        input.value = value;
    },

    openMapForLocation() {
        mapModule.openMapForLocation();
        const originalConfirm = mapModule.confirmLocation;
        mapModule.confirmLocation = () => {
            document.getElementById('edit-match-location').value = document.getElementById('location-name').value;
            document.getElementById('edit-match-lat').value = mapModule.selectedCoords[0];
            document.getElementById('edit-match-lng').value = mapModule.selectedCoords[1];
            mapModule.closeLocationPicker();
            mapModule.confirmLocation = originalConfirm;
        };
    },

    back() {
        this.clearTimer();
        if (this.isEditing) { if (confirm('Есть несохраненные изменения. Выйти?')) { this.cancelEditing(); screenManager.back(); } }
        else screenManager.back();
    }
};