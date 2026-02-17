// js/match-roster.js - Управление составом команды на матч
const matchRosterModule = {
    currentMatch: null,
    currentTeam: null,
    availablePlayers: [],
    selectedPlayers: [],
    isOurTeam: true,

    // Полноэкранный режим (без изменений)
    async show(matchId, teamId, isOurTeam = true) {
        try {
            this.isOurTeam = isOurTeam;
            
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

            this.currentMatch = match;
            
            const { data: team, error: teamError } = await app.supabase
                .from('teams')
                .select('*')
                .eq('id', teamId)
                .single();
                
            if (teamError) throw teamError;
            
            this.currentTeam = team;

            const userId = authModule.getUserId();
            const isOwner = this.currentTeam?.owner_id === userId;
            
            if (!isOwner) {
                alert('Только владелец команды может управлять составом');
                return;
            }

            await this.loadAvailablePlayers();
            await this.loadSelectedPlayers();
            
            this.render();
            screenManager.show('screen-match-roster');

        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            alert('Ошибка загрузки данных');
        }
    },

    // Рендеринг в указанный контейнер (для вкладок)
    async renderTo(containerId, matchId, teamId, isEditable = true) {
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

            this.currentMatch = match;
            
            const { data: team, error: teamError } = await app.supabase
                .from('teams')
                .select('*')
                .eq('id', teamId)
                .single();
                
            if (teamError) throw teamError;
            
            this.currentTeam = team;

            const userId = authModule.getUserId();
            const isOwner = this.currentTeam?.owner_id === userId;
            
            if (!isOwner && isEditable) {
                isEditable = false; // если нет прав, только просмотр
            }

            await this.loadAvailablePlayers();
            await this.loadSelectedPlayers();
            
            this.renderInline(containerId, isEditable);

        } catch (error) {
            console.error('❌ Ошибка загрузки данных для inline:', error);
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = '<p class="error-message" style="color: var(--accent-pink); text-align: center;">Ошибка загрузки состава</p>';
            }
        }
    },

    // Вспомогательные методы загрузки
    async loadAvailablePlayers() {
        try {
            const { data: players, error } = await app.supabase
                .from('team_players')
                .select('*')
                .eq('team_id', this.currentTeam.id)
                .order('number');

            if (error) throw error;
            this.availablePlayers = players || [];
        } catch (error) {
            console.error('❌ Ошибка загрузки игроков:', error);
            this.availablePlayers = [];
        }
    },

    async loadSelectedPlayers() {
        try {
            const { data: selected, error } = await app.supabase
                .from('match_rosters')
                .select('player_id')
                .eq('match_id', this.currentMatch.id)
                .eq('team_id', this.currentTeam.id);

            if (error) throw error;
            this.selectedPlayers = selected.map(s => s.player_id);
        } catch (error) {
            console.error('❌ Ошибка загрузки выбранных игроков:', error);
            this.selectedPlayers = [];
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

    // ========== INLINE-РЕНДЕРИНГ (полностью соответствующий wizard) ==========

    showMaxPlayersToast(max) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = `
            <i class="fas fa-info-circle"></i>
            <span>Максимум ${max} игроков для формата ${this.currentMatch.format}</span>
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    },

    renderInline(containerId, isEditable) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const teamLabel = this.isOurTeam ? 'НАША КОМАНДА' : 'КОМАНДА СОПЕРНИКА';
        const teamName = this.currentTeam?.name || 'Команда';
        const matchFormat = this.currentMatch?.format || '5x5';
        const requiredPlayers = this.getRequiredPlayersCount(matchFormat);
        const selectedCount = this.selectedPlayers.length;
        
        let teamLogoHTML = '';
        if (this.currentTeam?.logo_url) {
            teamLogoHTML = `<img src="${this.currentTeam.logo_url}" alt="${teamName}" style="width:100%;height:100%;object-fit:cover;">`;
        } else {
            teamLogoHTML = `<span>${this.currentTeam?.avatar || '⚽'}</span>`;
        }
        
        container.innerHTML = `
            <!-- Шапка с командой -->
            <div class="roster-header-main" style="margin-bottom: 20px;">
                <div class="team-header-info" style="display: flex; align-items: center; gap: 15px;">
                    <div class="team-logo-large" style="width: 60px; height: 60px; border-radius: 50%; overflow: hidden; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; font-size: 2rem;">
                        ${teamLogoHTML}
                    </div>
                    <div class="team-header-text">
                        <h2 class="roster-title" style="margin: 0 0 5px; font-size: 1.2rem;">Состав на матч</h2>
                        <div class="team-name-badge">
                            <span class="team-label-badge" style="background: var(--accent-blue); color: #000; padding: 2px 8px; border-radius: 20px; font-size: 0.7rem; font-weight: 700;">${teamLabel}</span>
                            <span class="team-name-large" style="font-weight: 700; margin-left: 8px;">${teamName}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Карточка требований и прогресс (как в wizard) -->
            <div class="roster-requirements-card">
                <div class="requirements-header">
                    <div class="format-badge-large">
                        <i class="fas fa-trophy"></i>
                        <span>Формат: ${matchFormat.replace('x', ' на ')}</span>
                    </div>
                    <div class="player-requirement">
                        <i class="fas fa-users"></i>
                        <span>${requiredPlayers} игроков</span>
                    </div>
                </div>
                
                <div class="progress-container">
                    <div class="progress-bar" id="inline-roster-progress" 
                         style="width: ${Math.min(100, (selectedCount / requiredPlayers) * 100)}%"></div>
                    <div class="progress-text">
                        <span>Выбрано: <strong id="inline-roster-count">${selectedCount}</strong> из <strong>${requiredPlayers}</strong></span>
                        <span class="progress-percent" id="inline-roster-percent">
                            ${Math.round((selectedCount / requiredPlayers) * 100)}%
                        </span>
                    </div>
                </div>
            </div>

            <!-- Сетка игроков -->
            <div class="roster-grid-container">
                <h3 class="section-label">
                    <i class="fas fa-list-ol"></i>
                    Доступные игроки
                    <span class="count-badge">${this.availablePlayers.length}</span>
                </h3>
                
                <div class="roster-grid" id="inline-roster-grid">
                    ${this.renderPlayersGridInline(isEditable)}
                </div>
                
                ${this.availablePlayers.length === 0 ? `
                    <div class="empty-roster-state">
                        <div class="empty-icon-large">
                            <i class="fas fa-user-plus"></i>
                        </div>
                        <h3>Нет игроков в команде</h3>
                        <p>Добавьте игроков в состав команды через меню управления командой</p>
                        <button class="btn btn-primary" onclick="teamEditModule.show('${this.currentTeam.id}')">
                            <i class="fas fa-users"></i> Управление командой
                        </button>
                    </div>
                ` : ''}
            </div>

            <!-- Панель управления (стилизованная как в wizard) -->
            ${isEditable ? `
            <div class="roster-controls-footer">
                <button class="roster-next-btn" id="inline-roster-save-btn" onclick="matchRosterModule.saveRosterInline('${containerId}')" ${selectedCount < requiredPlayers ? 'disabled' : ''}>
                    <span>${selectedCount < requiredPlayers ? `Выбрано ${selectedCount} из ${requiredPlayers}` : 'Сохранить состав'}</span>
                    <i class="fas fa-${selectedCount < requiredPlayers ? 'arrow-right' : 'save'}"></i>
                </button>
            </div>
            ` : `
            <div class="roster-viewonly-note" style="margin-top: 20px; text-align: center; color: var(--text-secondary);">
                <i class="fas fa-eye"></i> Просмотр состава (редактирование недоступно)
            </div>
            `}
        `;

        if (!isEditable) {
            document.querySelectorAll(`#${containerId} .roster-player-card`).forEach(card => {
                card.onclick = null;
                card.style.cursor = 'default';
            });
        }
    },

    renderPlayersGridInline(isEditable) {
        if (this.availablePlayers.length === 0) return '';

        const sortedPlayers = [...this.availablePlayers].sort((a, b) => {
            if (a.is_captain && !b.is_captain) return -1;
            if (!a.is_captain && b.is_captain) return 1;
            
            const aSelected = this.selectedPlayers.includes(a.id);
            const bSelected = this.selectedPlayers.includes(b.id);
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
            
            return (a.number || 99) - (b.number || 99);
        });

        return sortedPlayers.map(player => {
            const isSelected = this.selectedPlayers.includes(player.id);
            const isCaptain = player.is_captain;
            
            let photoHTML = '';
            if (player.photo_url) {
                photoHTML = `<img src="${player.photo_url}" alt="${player.name}" class="player-photo" style="width:100%;height:100%;object-fit:cover;">`;
            } else {
                const initial = player.name ? player.name.charAt(0).toUpperCase() : '?';
                photoHTML = `<div class="player-initial">${initial}</div>`;
            }
            
            const position = this.getPositionAbbreviation(player.role);
            
            return `
                <div class="roster-player-card ${isSelected ? 'selected' : ''} ${isCaptain ? 'captain' : ''}" 
                     data-player-id="${player.id}"
                     style="cursor: ${isEditable ? 'pointer' : 'default'};"
                     ${isEditable ? `onclick="matchRosterModule.togglePlayerInline('${player.id}')"` : ''}>
                    
                    <div class="player-card-header">
                        <div class="player-number-bubble">${player.number || '-'}</div>
                        <div class="player-position-badge">${position}</div>
                        <div class="selection-indicator">
                            <i class="fas fa-${isSelected ? 'check-circle' : 'circle'}"></i>
                        </div>
                    </div>
                    
                    <div class="player-photo-container">
                        ${photoHTML}
                        ${isCaptain ? '<div class="captain-corner-badge">C</div>' : ''}
                    </div>
                    
                    <div class="player-info">
                        <div class="player-name-truncate" title="${player.name}">${player.name}</div>
                        <div class="player-role-small">${player.role || 'Игрок'}</div>
                    </div>
                    
                    <div class="player-status">
                        <span class="status-dot ${isSelected ? 'active' : ''}"></span>
                        <span class="status-text">${isSelected ? 'В составе' : 'В запасе'}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    getPositionAbbreviation(role) {
        if (!role) return 'ИГР';
        const roleLower = role.toLowerCase();
        const positions = {
            'вратарь': 'ВРТ', 'голкипер': 'ВРТ',
            'защитник': 'ЗЩТ', 'дефендер': 'ЗЩТ',
            'полузащитник': 'ПЗЩ', 'мидфилдер': 'ПЗЩ',
            'нападающий': 'НАП', 'форвард': 'НАП',
            'связующий': 'СВ', 'сеттер': 'СВ',
            'диагональный': 'ДИ', 'оппозит': 'ДИ',
            'центральный блокирующий': 'ЦБ', 'либеро': 'ЛИ',
            'разыгрывающий': 'РГ', 'атакующий защитник': 'АЗ'
        };
        for (const [key, value] of Object.entries(positions)) {
            if (roleLower.includes(key)) return value;
        }
        return 'ИГР';
    },

    togglePlayerInline(playerId) {
        const index = this.selectedPlayers.indexOf(playerId);
        const requiredPlayers = this.getRequiredPlayersCount(this.currentMatch.format);
        
        if (index === -1) {
            if (this.selectedPlayers.length >= requiredPlayers) {
                this.showMaxPlayersToast(requiredPlayers);
                return;
            }
            this.selectedPlayers.push(playerId);
        } else {
            this.selectedPlayers.splice(index, 1);
        }
        
        this.updateInlineUI();
    },

    updateInlineUI() {
          const requiredPlayers = this.getRequiredPlayersCount(this.currentMatch.format);
    const selectedCount = this.selectedPlayers.length;
        
        const progressBar = document.getElementById('inline-roster-progress');
        const countSpan = document.getElementById('inline-roster-count');
        const percentSpan = document.getElementById('inline-roster-percent');
        
        if (progressBar) {
            progressBar.style.width = `${Math.min(100, (selectedCount / requiredPlayers) * 100)}%`;
        }
        if (countSpan) countSpan.textContent = selectedCount;
        if (percentSpan) percentSpan.textContent = `${Math.round((selectedCount / requiredPlayers) * 100)}%`;
        
        const saveBtn = document.getElementById('inline-roster-save-btn');
    if (saveBtn) {
        const isReady = selectedCount >= requiredPlayers;
        saveBtn.disabled = !isReady;
        saveBtn.classList.toggle('active', isReady);
        
        if (isReady) {
            saveBtn.innerHTML = `<span>Сохранить состав</span><i class="fas fa-save"></i>`;
        } else {
            saveBtn.innerHTML = `<span>Выбрано ${selectedCount} из ${requiredPlayers}</span><i class="fas fa-arrow-right"></i>`;
        }
    }
        
        this.availablePlayers.forEach(player => {
            const isSelected = this.selectedPlayers.includes(player.id);
            const card = document.querySelector(`#edit-tab-roster .roster-player-card[data-player-id="${player.id}"]`);
            if (card) {
                card.classList.toggle('selected', isSelected);
                
                const indicator = card.querySelector('.selection-indicator i');
                if (indicator) {
                    indicator.className = `fas fa-${isSelected ? 'check-circle' : 'circle'}`;
                }
                
                const statusDot = card.querySelector('.status-dot');
                const statusText = card.querySelector('.status-text');
                if (statusDot && statusText) {
                    statusDot.classList.toggle('active', isSelected);
                    statusText.textContent = isSelected ? 'В составе' : 'В запасе';
                }
            }
        });
    },

    async saveRosterInline(containerId) {
        const requiredPlayers = this.getRequiredPlayersCount(this.currentMatch.format);
        const selectedCount = this.selectedPlayers.length;
        
        if (selectedCount < requiredPlayers) {
            alert(`Минимальное количество игроков: ${requiredPlayers}. Выбрано: ${selectedCount}`);
            return;
        }

        try {
            await app.supabase
                .from('match_rosters')
                .delete()
                .eq('match_id', this.currentMatch.id)
                .eq('team_id', this.currentTeam.id);

            const rosterData = this.selectedPlayers.map(playerId => ({
                match_id: this.currentMatch.id,
                team_id: this.currentTeam.id,
                player_id: playerId,
                is_starting: true,
                created_at: new Date().toISOString()
            }));

            const { error } = await app.supabase
                .from('match_rosters')
                .insert(rosterData);

            if (error) throw error;

            const container = document.getElementById(containerId);
            const successMsg = document.createElement('div');
            successMsg.className = 'save-success-message';
            successMsg.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <span>Состав сохранен для матча!</span>
            `;
            container.appendChild(successMsg);
            
            setTimeout(() => {
                successMsg.classList.add('show');
                setTimeout(() => {
                    successMsg.classList.remove('show');
                    setTimeout(() => {
                        if (successMsg.parentNode) {
                            successMsg.parentNode.removeChild(successMsg);
                        }
                    }, 300);
                }, 2000);
            }, 100);

        } catch (error) {
            console.error('❌ Ошибка сохранения состава:', error);
            alert('Ошибка сохранения состава');
        }
    },

    closeInline() {
        if (typeof matchEditModule !== 'undefined') {
            matchEditModule.switchTab('main');
        }
    },

    // ========== ПОЛНОЭКРАННЫЙ РЕЖИМ (без изменений) ==========

    render() {
        const container = document.getElementById('match-roster-content');
        if (!container) return;

        const teamLabel = this.isOurTeam ? 'НАША КОМАНДА' : 'КОМАНДА СОПЕРНИКА';
        const teamName = this.currentTeam?.name || 'Команда';
        const matchFormat = this.currentMatch?.format || '5x5';
        const requiredPlayers = this.getRequiredPlayersCount(matchFormat);
        const selectedCount = this.selectedPlayers.length;
        
        let teamLogoHTML = '';
        if (this.currentTeam?.logo_url) {
            teamLogoHTML = `<img src="${this.currentTeam.logo_url}" alt="${teamName}" class="team-logo-image">`;
        } else {
            teamLogoHTML = `<span class="team-logo-emoji">${this.currentTeam?.avatar || '⚽'}</span>`;
        }
        
        container.innerHTML = `
            <div class="roster-header-main">
                <div class="team-header-info">
                    <div class="team-logo-large">
                        ${teamLogoHTML}
                    </div>
                    <div class="team-header-text">
                        <h1 class="roster-title">Состав на матч</h1>
                        <div class="team-name-badge">
                            <span class="team-label-badge">${teamLabel}</span>
                            <span class="team-name-large">${teamName}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="roster-requirements-card">
                <div class="requirements-header">
                    <div class="format-badge-large">
                        <i class="fas fa-trophy"></i>
                        <span>Формат: ${matchFormat.replace('x', ' на ')}</span>
                    </div>
                    <div class="player-requirement">
                        <i class="fas fa-users"></i>
                        <span>${requiredPlayers} игроков</span>
                    </div>
                </div>
                
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${Math.min(100, (selectedCount / requiredPlayers) * 100)}%"></div>
                    <div class="progress-text">
                        <span>Выбрано: <strong>${selectedCount}</strong> из <strong>${requiredPlayers}</strong></span>
                        <span class="progress-percent">${Math.round((selectedCount / requiredPlayers) * 100)}%</span>
                    </div>
                </div>
                
                ${!this.isOurTeam ? `
                    <div class="info-note">
                        <i class="fas fa-eye"></i>
                        <span>Этот состав увидят обе команды после начала матча</span>
                    </div>
                ` : ''}
            </div>

            <div class="roster-grid-container">
                <h3 class="section-label">
                    <i class="fas fa-list-ol"></i>
                    Доступные игроки
                    <span class="count-badge">${this.availablePlayers.length}</span>
                </h3>
                
                <div class="roster-grid" id="roster-grid">
                    ${this.renderPlayersGrid()}
                </div>
                
                ${this.availablePlayers.length === 0 ? `
                    <div class="empty-roster-state">
                        <div class="empty-icon-large">
                            <i class="fas fa-user-plus"></i>
                        </div>
                        <h3>Нет игроков в команде</h3>
                        <p>Добавьте игроков в состав команды через меню управления командой</p>
                        <button class="btn btn-primary" onclick="teamEditModule.show('${this.currentTeam.id}')">
                            <i class="fas fa-users"></i> Управление командой
                        </button>
                    </div>
                ` : ''}
            </div>

            <div class="roster-controls-footer">
                <div class="roster-status">
                    <div class="status-indicator ${selectedCount >= requiredPlayers ? 'ready' : 'warning'}">
                        <i class="fas fa-${selectedCount >= requiredPlayers ? 'check-circle' : 'exclamation-triangle'}"></i>
                        <span>
                            ${selectedCount >= requiredPlayers ? 
                                'Состав готов к матчу!' : 
                                `Нужно еще ${requiredPlayers - selectedCount} игроков`}
                        </span>
                    </div>
                </div>
                
                <div class="roster-actions-final">
                    <button class="btn btn-secondary" onclick="matchRosterModule.back()">
                        <i class="fas fa-times"></i> Отмена
                    </button>
                    <button class="btn btn-primary ${selectedCount < requiredPlayers ? 'disabled' : ''}" 
                            onclick="matchRosterModule.saveRoster()">
                        <i class="fas fa-save"></i> Сохранить состав
                    </button>
                </div>
            </div>
        `;
    },

    renderPlayersGrid() {
        if (this.availablePlayers.length === 0) return '';

        const sortedPlayers = [...this.availablePlayers].sort((a, b) => {
            if (a.is_captain && !b.is_captain) return -1;
            if (!a.is_captain && b.is_captain) return 1;
            
            const aSelected = this.selectedPlayers.includes(a.id);
            const bSelected = this.selectedPlayers.includes(b.id);
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
            
            return (a.number || 99) - (b.number || 99);
        });

        return sortedPlayers.map(player => {
            const isSelected = this.selectedPlayers.includes(player.id);
            const isCaptain = player.is_captain;
            
            let photoHTML = '';
            if (player.photo_url) {
                photoHTML = `<img src="${player.photo_url}" alt="${player.name}" class="player-photo">`;
            } else {
                const initial = player.name ? player.name.charAt(0).toUpperCase() : '?';
                photoHTML = `<div class="player-initial">${initial}</div>`;
            }
            
            const position = this.getPositionAbbreviation(player.role);
            
            return `
                <div class="roster-player-card ${isSelected ? 'selected' : ''} ${isCaptain ? 'captain' : ''}" 
                     onclick="matchRosterModule.togglePlayer('${player.id}')">
                    
                    <div class="player-card-header">
                        <div class="player-number-bubble">${player.number || '-'}</div>
                        <div class="player-position-badge">${position}</div>
                        <div class="selection-indicator">
                            <i class="fas fa-${isSelected ? 'check-circle' : 'circle'}"></i>
                        </div>
                    </div>
                    
                    <div class="player-photo-container">
                        ${photoHTML}
                        ${isCaptain ? '<div class="captain-corner-badge">C</div>' : ''}
                    </div>
                    
                    <div class="player-info">
                        <div class="player-name-truncate" title="${player.name}">${player.name}</div>
                        <div class="player-role-small">${player.role || 'Игрок'}</div>
                    </div>
                    
                    <div class="player-status">
                        <span class="status-dot ${isSelected ? 'active' : ''}"></span>
                        <span class="status-text">${isSelected ? 'В составе' : 'В запасе'}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    togglePlayer(playerId) {
        const index = this.selectedPlayers.indexOf(playerId);
        const requiredPlayers = this.getRequiredPlayersCount(this.currentMatch.format);
        
        if (index === -1) {
            if (this.selectedPlayers.length >= requiredPlayers) {
                alert(`Максимальное количество игроков: ${requiredPlayers}`);
                return;
            }
            this.selectedPlayers.push(playerId);
        } else {
            this.selectedPlayers.splice(index, 1);
        }
        
        this.updateUI();
    },

    updateUI() {
        const requiredPlayers = this.getRequiredPlayersCount(this.currentMatch.format);
        const selectedCount = this.selectedPlayers.length;
        
        const progressBar = document.querySelector('.progress-bar');
        const progressPercent = document.querySelector('.progress-percent');
        const progressText = document.querySelector('.progress-text strong:first-child');
        
        if (progressBar) {
            progressBar.style.width = `${Math.min(100, (selectedCount / requiredPlayers) * 100)}%`;
        }
        if (progressPercent) {
            progressPercent.textContent = `${Math.round((selectedCount / requiredPlayers) * 100)}%`;
        }
        if (progressText) {
            progressText.textContent = selectedCount;
        }
        
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            if (btn.querySelector('i.fa-times-circle')) {
                btn.classList.toggle('disabled', selectedCount === 0);
            }
            if (btn.querySelector('i.fa-check-double')) {
                btn.classList.toggle('active', selectedCount === requiredPlayers);
            }
        });
        
        const statusIndicator = document.querySelector('.status-indicator');
        const statusIcon = statusIndicator?.querySelector('i');
        const statusText = statusIndicator?.querySelector('span');
        
        if (statusIndicator && statusIcon && statusText) {
            if (selectedCount >= requiredPlayers) {
                statusIndicator.className = 'status-indicator ready';
                statusIcon.className = 'fas fa-check-circle';
                statusText.textContent = 'Состав готов к матчу!';
            } else {
                statusIndicator.className = 'status-indicator warning';
                statusIcon.className = 'fas fa-exclamation-triangle';
                statusText.textContent = `Нужно еще ${requiredPlayers - selectedCount} игроков`;
            }
        }
        
        const saveBtn = document.querySelector('.roster-actions-final .btn-primary');
        if (saveBtn) {
            saveBtn.classList.toggle('disabled', selectedCount < requiredPlayers);
        }
        
        this.availablePlayers.forEach(player => {
            const isSelected = this.selectedPlayers.includes(player.id);
            const card = document.querySelector(`[onclick*="${player.id}"]`);
            if (card) {
                card.classList.toggle('selected', isSelected);
                
                const indicator = card.querySelector('.selection-indicator i');
                if (indicator) {
                    indicator.className = `fas fa-${isSelected ? 'check-circle' : 'circle'}`;
                }
                
                const statusDot = card.querySelector('.status-dot');
                const statusText = card.querySelector('.status-text');
                if (statusDot && statusText) {
                    statusDot.classList.toggle('active', isSelected);
                    statusText.textContent = isSelected ? 'В составе' : 'В запасе';
                }
            }
        });
    },

    selectAll() {
        const requiredPlayers = this.getRequiredPlayersCount(this.currentMatch.format);
        const availableIds = this.availablePlayers.map(p => p.id);
        
        const playersToSelect = availableIds.slice(0, requiredPlayers);
        this.selectedPlayers = playersToSelect;
        this.updateUI();
    },

    selectOptimal() {
        const requiredPlayers = this.getRequiredPlayersCount(this.currentMatch.format);
        
        const sortedPlayers = [...this.availablePlayers].sort((a, b) => {
            if (a.is_captain && !b.is_captain) return -1;
            if (!a.is_captain && b.is_captain) return 1;
            return (a.number || 99) - (b.number || 99);
        });
        
        this.selectedPlayers = sortedPlayers.slice(0, requiredPlayers).map(p => p.id);
        this.updateUI();
    },

    deselectAll() {
        if (this.selectedPlayers.length === 0) return;
        
        if (confirm('Очистить весь выбранный состав?')) {
            this.selectedPlayers = [];
            this.updateUI();
        }
    },

    async saveRoster() {
        const requiredPlayers = this.getRequiredPlayersCount(this.currentMatch.format);
        const selectedCount = this.selectedPlayers.length;
        
        if (selectedCount < requiredPlayers) {
            alert(`Минимальное количество игроков: ${requiredPlayers}. Выбрано: ${selectedCount}`);
            return;
        }

        try {
            await app.supabase
                .from('match_rosters')
                .delete()
                .eq('match_id', this.currentMatch.id)
                .eq('team_id', this.currentTeam.id);

            const rosterData = this.selectedPlayers.map(playerId => ({
                match_id: this.currentMatch.id,
                team_id: this.currentTeam.id,
                player_id: playerId,
                is_starting: true,
                created_at: new Date().toISOString()
            }));

            const { error } = await app.supabase
                .from('match_rosters')
                .insert(rosterData);

            if (error) throw error;

            const successMsg = document.createElement('div');
            successMsg.className = 'save-success-message';
            successMsg.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <span>Состав сохранен для матча!</span>
            `;
            document.getElementById('match-roster-content').appendChild(successMsg);
            
            setTimeout(() => {
                successMsg.classList.add('show');
                setTimeout(() => {
                    successMsg.classList.remove('show');
                    setTimeout(() => {
                        if (successMsg.parentNode) {
                            successMsg.parentNode.removeChild(successMsg);
                        }
                        this.back();
                    }, 300);
                }, 2000);
            }, 100);

        } catch (error) {
            console.error('❌ Ошибка сохранения состава:', error);
            alert('Ошибка сохранения состава');
        }
    },

    back() {
        screenManager.back();
    },

    async getMatchRoster(matchId, teamId) {
        try {
            const { data: roster, error } = await app.supabase
                .from('match_rosters')
                .select(`
                    player:team_players(*)
                `)
                .eq('match_id', matchId)
                .eq('team_id', teamId)
                .order('created_at');

            if (error) throw error;

            return roster?.map(r => r.player) || [];
        } catch (error) {
            console.error('❌ Ошибка загрузки состава на матч:', error);
            return null;
        }
    }
};

window.matchRosterModule = matchRosterModule;