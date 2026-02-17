// js/match-edit.js - Редактирование матчей с вкладками (исправленная версия)
const matchEditModule = {
    currentMatch: null,
    originalMatch: null,
    isEditing: false,
    timerInterval: null,
    ourTeamId: null,
    activeTab: 'main',

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
        // Загружаем содержимое активной вкладки (все данные теперь внутри табов)
        this.loadTabContent(this.activeTab);
    },

    switchTab(tabId) {
        if (this.activeTab === tabId) return;

        document.querySelectorAll('.edit-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });

        document.querySelectorAll('.edit-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `edit-tab-${tabId}`);
        });

        this.activeTab = tabId;
        this.loadTabContent(tabId);
    },

    loadTabContent(tabId) {
        if (!this.currentMatch) return;

        switch(tabId) {
            case 'main':
                this.renderMainTab();
                break;
            case 'roster':
                this.renderRosterTab();
                break;
            case 'stats':
                this.renderStatsTab();
                break;
        }
    },

    // ========== РЕНДЕРИНГ ВКЛАДОК ==========

    renderMainTab() {
        const container = document.getElementById('edit-tab-main');
        if (!container) return;

        const match = this.currentMatch;
        const userId = authModule.getUserId();
        const isTeam1Owner = match.team1?.owner_id === userId;
        const isTeam2Owner = match.team2?.owner_id === userId;
        const isOwner = isTeam1Owner || isTeam2Owner;
        
        // Блок команд
        let teamsHTML = `
            <div class="form-section" style="text-align: center; padding: 20px;">
                <span class="match-status" id="edit-match-status-badge" style="font-size: 0.9rem; padding: 8px 16px;">
                    ${this.getStatusText(match.status)}
                </span>
                
                <div style="display: flex; justify-content: center; align-items: center; gap: 20px; margin: 25px 0;">
                    <div style="text-align: center;">
                        <div class="team-avatar" id="edit-match-team1-avatar" style="width: 60px; height: 60px; font-size: 2rem; margin: 0 auto 8px;">${this.getTeamAvatarHTML(match.team1)}</div>
                        <div id="edit-match-team1-name" style="font-weight: 700; font-size: 0.9rem;">${match.team1?.name || 'Команда 1'}</div>
                    </div>
                    
                    <div style="font-size: 1.8rem; color: var(--accent-pink); font-family: var(--font-display);">VS</div>
                    
                    <div style="text-align: center;">
                        <div class="team-avatar" id="edit-match-team2-avatar" style="width: 60px; height: 60px; font-size: 2rem; margin: 0 auto 8px;">${this.getTeamAvatarHTML(match.team2)}</div>
                        <div id="edit-match-team2-name" style="font-weight: 700; font-size: 0.9rem;">${match.team2?.name || 'Команда 2'}</div>
                    </div>
                </div>
                
                <span class="sport-badge" id="edit-match-sport">
                    <i class="fas fa-${app.getSportIcon(match.sport)}"></i> ${app.getSportName(match.sport).toUpperCase()}
                </span>
            </div>
        `;

        // Блок счёта
        const [score1, score2] = match.score ? match.score.split(':').map(Number) : [0, 0];
        const scoreEditable = match.status === 'live';
        const scoreReadonly = !scoreEditable;

        let scoreHTML = `
            <div class="form-section" id="score-section">
                <h3 class="form-title" style="text-align: center; margin-bottom: 20px;">
                    <i class="fas fa-trophy"></i> Счет
                </h3>
                
                <div style="display: flex; justify-content: center; align-items: center; gap: 20px; margin-bottom: 15px;">
                    <div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
                        ${scoreEditable ? `<button class="score-btn" onclick="matchEditModule.adjustScore(1, 1)" style="width: 45px; height: 45px; border-radius: 50%; border: 2px solid var(--accent-green); background: transparent; color: var(--accent-green); font-size: 1.2rem;">+</button>` : ''}
                        <input type="number" id="edit-match-score1" value="${score1}" min="0" max="99" 
                               style="width: 70px; height: 70px; font-size: 2rem; text-align: center; border-radius: 15px; border: 3px solid var(--accent-green); background: var(--bg-card); color: var(--text-primary); font-weight: 700;"
                               ${scoreReadonly ? 'readonly' : ''} onblur="matchEditModule.updateScore()">
                        ${scoreEditable ? `<button class="score-btn" onclick="matchEditModule.adjustScore(-1, 1)" style="width: 45px; height: 45px; border-radius: 50%; border: 2px solid var(--accent-pink); background: transparent; color: var(--accent-pink); font-size: 1.2rem;">-</button>` : ''}
                    </div>
                    
                    <div style="font-size: 1.5rem; color: var(--text-secondary);;">:</div>
                    
                    <div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
                        ${scoreEditable ? `<button class="score-btn" onclick="matchEditModule.adjustScore(1, 2)" style="width: 45px; height: 45px; border-radius: 50%; border: 2px solid var(--accent-green); background: transparent; color: var(--accent-green); font-size: 1.2rem;">+</button>` : ''}
                        <input type="number" id="edit-match-score2" value="${score2}" min="0" max="99" 
                               style="width: 70px; height: 70px; font-size: 2rem; text-align: center; border-radius: 15px; border: 3px solid var(--accent-green); background: var(--bg-card); color: var(--text-primary); font-weight: 700;"
                               ${scoreReadonly ? 'readonly' : ''} onblur="matchEditModule.updateScore()">
                        ${scoreEditable ? `<button class="score-btn" onclick="matchEditModule.adjustScore(-1, 2)" style="width: 45px; height: 45px; border-radius: 50%; border: 2px solid var(--accent-pink); background: transparent; color: var(--accent-pink); font-size: 1.2rem;">-</button>` : ''}
                    </div>
                </div>
                
                <div id="score-status-message" style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; font-style: italic;"></div>
            </div>
        `;

        // Блок таймера
        const timerHTML = `<div id="match-timer" class="match-timer-block" style="text-align: center; margin: 16px 0;"></div>`;

        // Блок деталей
        const detailsEditable = match.status === 'upcoming' && isOwner;
        const formatSelect = this.getFormatSelectHTML(match.format || '5x5', detailsEditable);
        const datetimeValue = match.date ? this.formatDateTimeLocal(match.date) : '';
        const locationValue = match.location || '';

        let detailsHTML = `
            <div class="form-section" id="match-info-section">
                <h3 class="form-title"><i class="fas fa-info-circle"></i> Детали</h3>
                
                <div class="form-group">
                    <label>Формат</label>
                    <select id="edit-match-format" class="form-control" ${detailsEditable ? '' : 'disabled'} style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                        ${formatSelect}
                    </select>
                </div>

                <div class="form-group">
                    <label>Дата и время</label>
                    <input type="datetime-local" id="edit-match-datetime" class="form-control" value="${datetimeValue}" ${detailsEditable ? '' : 'disabled'} style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                </div>

                <div class="form-group">
                    <label>Место</label>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="edit-match-location" class="form-control" value="${locationValue}" ${detailsEditable ? '' : 'disabled'} style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                        ${detailsEditable ? `<button type="button" class="btn btn-secondary" id="edit-match-location-btn" onclick="matchEditModule.openMapForLocation()" style="padding: 10px 15px;"><i class="fas fa-map-marker-alt"></i></button>` : ''}
                    </div>
                </div>

                <input type="hidden" id="edit-match-lat" value="${match.lat || ''}">
                <input type="hidden" id="edit-match-lng" value="${match.lng || ''}">
            </div>
        `;

        // Блок предупреждений
        const warningsHTML = `<div id="edit-match-warnings" class="warnings-container hidden" style="margin-bottom: 15px; background: rgba(255,193,7,0.1); border: 1px solid rgba(255,193,7,0.3); border-radius: 10px; padding: 12px; color: #ffc107; font-size: 0.9rem;"></div>`;

        // Блок действий
        const actionsHTML = `<div id="match-status-controls" style="display: flex; flex-direction: column; gap: 10px;"></div>`;

        container.innerHTML = teamsHTML + scoreHTML + timerHTML + detailsHTML + warningsHTML + actionsHTML;

        this.updateMatchTimer();
        this.renderWarnings(this.currentMatch);
        this.renderStatusControls(this.currentMatch);
    },

    renderRosterTab() {
        const container = document.getElementById('edit-tab-roster');
        if (!container) return;

        const userId = authModule.getUserId();
        const match = this.currentMatch;
        const isTeam1Owner = match.team1?.owner_id === userId;
        const isTeam2Owner = match.team2?.owner_id === userId;
        
        if (!isTeam1Owner && !isTeam2Owner) {
            container.innerHTML = '<p class="error-message" style="color: var(--accent-pink); text-align: center; padding: 20px;">У вас нет прав для управления составом</p>';
            return;
        }

        const teamId = isTeam1Owner ? match.team1.id : match.team2.id;
        
        if (typeof matchRosterModule !== 'undefined' && matchRosterModule.renderTo) {
            matchRosterModule.renderTo('edit-tab-roster', match.id, teamId, true);
        } else {
            container.innerHTML = `
                <div class="info-message" style="text-align: center; padding: 40px; background: var(--bg-secondary); border-radius: 16px;">
                    <i class="fas fa-users" style="font-size: 3rem; color: var(--accent-blue); margin-bottom: 15px;"></i>
                    <p style="margin-bottom: 20px;">Для удобного управления составом откройте полноэкранный режим.</p>
                    <button class="btn btn-primary" onclick="matchRosterModule.show('${match.id}', '${teamId}', true)">
                        <i class="fas fa-expand"></i> Открыть состав
                    </button>
                </div>
            `;
        }
    },

    renderStatsTab() {
        const container = document.getElementById('edit-tab-stats');
        if (!container) return;

        const match = this.currentMatch;
        
        if (match.status !== 'live' && match.status !== 'finished') {
            container.innerHTML = '<p class="info-message" style="text-align: center; padding: 40px; color: var(--text-secondary);">Статистика будет доступна после начала матча.</p>';
            return;
        }

        this.renderPlayerStatsInline(match.id, this.ourTeamId, 'edit-tab-stats');
    },

    // Рендеринг статистики игроков внутри указанного контейнера
    async renderPlayerStatsInline(matchId, teamId, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const { data: roster, error: rosterError } = await app.supabase
                .from('match_rosters')
                .select('*, player:team_players(*)')
                .eq('match_id', matchId)
                .eq('team_id', teamId);
            if (rosterError) throw rosterError;

            const { data: stats, error: statsError } = await app.supabase
                .from('match_player_stats')
                .select('*')
                .eq('match_id', matchId)
                .eq('team_id', teamId);
            if (statsError) throw statsError;

            const statsMap = {};
            stats?.forEach(s => { statsMap[s.team_player_id] = s; });

            const sport = this.currentMatch.sport;
            const config = window.sportStatConfig?.[sport] || { fields: [] };
            const validationInfo = this.getScoreValidationInfo();
            const { scoreField, teamScore } = validationInfo || { scoreField: 'goals', teamScore: 0 };

            let currentTotal = 0;
            roster.forEach(item => {
                const stat = statsMap[item.player.id] || {};
                currentTotal += stat[scoreField] || 0;
            });

            const remaining = Math.max(0, teamScore - currentTotal);

            let html = `
                <div class="player-stats-container">
                    <div class="stats-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 style="margin: 0;">Статистика игроков</h3>
                        <span class="sport-badge">${app.getSportName(sport)}</span>
                    </div>
                    
                    <div class="score-progress-bar" style="margin-bottom: 25px;">
                        <div class="progress-info" style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem;">
                            <span>Счет команды: <strong>${teamScore}</strong></span>
                            <span>Распределено: <strong>${currentTotal}</strong></span>
                            <span class="${remaining === 0 ? 'text-success' : 'text-warning'}" style="color: ${remaining === 0 ? 'var(--accent-green)' : 'var(--accent-pink)'};">Осталось: <strong>${remaining}</strong></span>
                        </div>
                        <div class="progress-track" style="height: 8px; background: var(--bg-secondary); border-radius: 4px; overflow: hidden;">
                            <div class="progress-fill" style="width: ${teamScore > 0 ? (currentTotal / teamScore * 100) : 0}%; height: 100%; background: linear-gradient(90deg, var(--accent-green), var(--accent-blue));"></div>
                        </div>
                    </div>
                    
                    <div class="player-stats-list" style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 30px;">
            `;

            roster.forEach(item => {
                const player = item.player;
                const stat = statsMap[player.id] || {};
                // Генерируем аватар
// Генерируем аватар
let avatarHtml;
if (player.photo_url) {
    avatarHtml = `<img src="${player.photo_url}" alt="${player.name}" class="player-stat-avatar">`;
} else {
    const initial = player.name ? player.name.charAt(0).toUpperCase() : '?';
    // Убираем цветной фон, оставляем тёмный с обводкой
    avatarHtml = `<div class="player-stat-avatar initial">${initial}</div>`;
}

html += `
    <div class="player-stat-card">
        <div class="player-info-row">
            ${avatarHtml}
            <div class="player-name-wrapper">
                <span class="player-name">${player.name}</span>
                ${player.is_captain ? '<span class="captain-badge">C</span>' : ''}
            </div>
            <span class="player-role">${player.role || ''}</span>
        </div>

                        <div class="stat-fields-row" style="display: flex; flex-wrap: wrap; gap: 10px;">
                `;

                config.fields.forEach(field => {
                    if (field.visible && !field.visible(player.role)) return;

                    const value = stat[field.name] || 0;
                    html += `
                        <div class="stat-field" style="flex: 1 1 120px;">
                            <label style="display: block; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">${field.label}</label>
                            <div class="stat-input-group" style="display: flex; align-items: center; gap: 4px;">
                                <button type="button" class="stat-btn minus" onclick="matchEditModule.adjustPlayerStatInline('${player.id}', '${field.name}', -1)" style="width: 36px; height: 36px; border-radius: 8px; background: var(--bg-card); border: 1px solid var(--border); color: var(--accent-pink); font-size: 1.2rem;">−</button>
                                <input type="number" 
                                       class="stat-input" 
                                       data-player-id="${player.id}"
                                       data-stat-name="${field.name}"
                                       value="${value}"
                                       min="0" 
                                       max="${field.max || 99}"
                                       style="width: 60px; height: 36px; text-align: center; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); font-weight: 600;"
                                       onchange="matchEditModule.updatePlayerStatTotal()">
                                <button type="button" class="stat-btn plus" onclick="matchEditModule.adjustPlayerStatInline('${player.id}', '${field.name}', 1)" style="width: 36px; height: 36px; border-radius: 8px; background: var(--bg-card); border: 1px solid var(--border); color: var(--accent-green); font-size: 1.2rem;">+</button>
                            </div>
                        </div>
                    `;
                });

                html += `</div></div>`;
            });

            html += `
                    </div>
                    
                    <div class="player-stats-actions" style="display: flex; gap: 12px; flex-wrap: wrap;">
                        ${remaining > 0 ? `
                        <button class="btn btn-secondary" onclick="matchEditModule.distributeRemainingEvenly('${scoreField}')" style="flex: 1;">
                            <i class="fas fa-magic"></i> Распределить ${remaining} равномерно
                        </button>
                        ` : ''}
                        <button class="btn btn-primary" onclick="matchEditModule.savePlayerStatsInline('${matchId}', '${teamId}')" style="flex: 1;">
                            <i class="fas fa-save"></i> Сохранить статистику
                        </button>
                        <button class="btn btn-secondary" onclick="matchEditModule.loadTabContent('stats')" style="flex: 1;">
                            <i class="fas fa-sync-alt"></i> Сбросить
                        </button>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            this._updateProgress = () => {
                let total = 0;
                document.querySelectorAll(`#${containerId} .stat-input`).forEach(input => {
                    if (input.dataset.statName === scoreField) {
                        total += parseInt(input.value) || 0;
                    }
                });
                const remaining = Math.max(0, teamScore - total);
                const progressFill = document.querySelector(`#${containerId} .progress-fill`);
                const distributedSpan = document.querySelector(`#${containerId} .progress-info span:nth-child(2) strong`);
                const remainingSpan = document.querySelector(`#${containerId} .progress-info span:last-child strong`);

                if (progressFill) {
                    progressFill.style.width = teamScore > 0 ? (total / teamScore * 100) + '%' : '0%';
                }
                if (distributedSpan) distributedSpan.textContent = total;
                if (remainingSpan) {
                    remainingSpan.textContent = remaining;
                    const parent = remainingSpan.parentElement;
                    if (parent) {
                        parent.style.color = remaining === 0 ? 'var(--accent-green)' : 'var(--accent-pink)';
                    }
                }
            };

            document.querySelectorAll(`#${containerId} .stat-input`).forEach(input => {
                input.removeEventListener('input', this._updateProgress);
                input.addEventListener('input', this._updateProgress);
            });

        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            container.innerHTML = '<p class="error-message" style="text-align: center; padding: 40px; color: var(--accent-pink);">Ошибка загрузки данных</p>';
        }
    },

    adjustPlayerStatInline(playerId, statName, delta) {
        const input = document.querySelector(`.stat-input[data-player-id="${playerId}"][data-stat-name="${statName}"]`);
        if (!input) return;
        
        let value = parseInt(input.value) || 0;
        const max = parseInt(input.getAttribute('max')) || 99;
        value = Math.min(max, Math.max(0, value + delta));
        input.value = value;
        
        if (this._updateProgress) this._updateProgress();
    },

    updatePlayerStatTotal() {
        if (this._updateProgress) this._updateProgress();
    },

    distributeRemainingEvenly(scoreField) {
        const inputs = Array.from(document.querySelectorAll('#edit-tab-stats .stat-input'))
            .filter(input => input.dataset.statName === scoreField);
        
        if (inputs.length === 0) return;

        const remaining = this.getRemainingScore(scoreField);
        if (remaining <= 0) return;

        const base = Math.floor(remaining / inputs.length);
        let extra = remaining % inputs.length;

        inputs.forEach((input, index) => {
            let add = base + (index < extra ? 1 : 0);
            let current = parseInt(input.value) || 0;
            input.value = current + add;
        });

        this._updateProgress();
    },

    getRemainingScore(scoreField) {
        const validationInfo = this.getScoreValidationInfo();
        if (!validationInfo) return 0;
        const { teamScore } = validationInfo;

        let total = 0;
        document.querySelectorAll('#edit-tab-stats .stat-input').forEach(input => {
            if (input.dataset.statName === scoreField) {
                total += parseInt(input.value) || 0;
            }
        });
        return Math.max(0, teamScore - total);
    },

    async savePlayerStatsInline(matchId, teamId) {
        const inputs = document.querySelectorAll('#edit-tab-stats .stat-input');
        const statsData = [];
        const validationInfo = this.getScoreValidationInfo();
        
        if (!validationInfo) {
            alert('Ошибка: не удалось определить данные для валидации');
            return;
        }

        const { scoreField, teamScore } = validationInfo;

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

            if (statName === scoreField) {
                totalPlayerScore += value;
            }
        });

        if (totalPlayerScore > teamScore) {
            alert(`Ошибка: суммарное количество ${scoreField === 'goals' ? 'голов' : 
                  scoreField === 'points' ? 'очков' : 'выигранных партий'} 
                  игроков (${totalPlayerScore}) превышает счет команды (${teamScore})`);
            return;
        }

        try {
            await app.supabase
                .from('match_player_stats')
                .delete()
                .eq('match_id', matchId)
                .eq('team_id', teamId);

            if (statsData.length > 0) {
                const { error } = await app.supabase
                    .from('match_player_stats')
                    .insert(statsData);
                if (error) throw error;
            }

            alert('Статистика сохранена!');
            this.loadTabContent('stats');
        } catch (error) {
            console.error('❌ Ошибка сохранения статистики:', error);
            alert('Ошибка при сохранении');
        }
    },

    // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

    getTeamAvatarHTML(team) {
        if (!team) return '<span>?</span>';
        if (team.logo_url) {
            return `<img src="${team.logo_url}" alt="${team.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'; this.parentElement.textContent='${team.avatar || '?'}'">`;
        } else {
            return `<span>${team.avatar || '⚽'}</span>`;
        }
    },

    getFormatSelectHTML(selectedFormat, editable) {
        const formats = ['2x2', '3x3', '4x4', '5x5', '7x7', '11x11'];
        return formats.map(f => `<option value="${f}" ${f === selectedFormat ? 'selected' : ''}>${f.replace('x', ' на ')}</option>`).join('');
    },

    formatDateTimeLocal(dateString) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    },

    getStatusText(status) {
        const map = {
            'upcoming': 'ПРЕДСТОИТ',
            'live': 'ИДЁТ СЕЙЧАС',
            'finished': 'ЗАВЕРШЁН',
            'cancelled': 'ОТМЕНЁН'
        };
        return map[status] || 'ПРЕДСТОИТ';
    },

    // ========== МЕТОДЫ УПРАВЛЕНИЯ МАТЧЕМ (без изменений, кроме adjustScore/updateScore) ==========

    adjustScore(change, teamNumber) {
        if (this.currentMatch.status !== 'live') return;
        
        const container = document.getElementById('edit-tab-main');
        if (!container) return;
        
        const input = container.querySelector(teamNumber === 1 ? '#edit-match-score1' : '#edit-match-score2');
        if (!input) return;
        
        let value = parseInt(input.value) || 0;
        value = Math.max(0, value + change);
        input.value = value;
        
        this.updateScore();
    },

    async updateScore() {
        if (this.currentMatch.status !== 'live') return;
        
        const container = document.getElementById('edit-tab-main');
        if (!container) return;
        
        const score1Input = container.querySelector('#edit-match-score1');
        const score2Input = container.querySelector('#edit-match-score2');
        if (!score1Input || !score2Input) return;
        
        const score1 = parseInt(score1Input.value) || 0;
        const score2 = parseInt(score2Input.value) || 0;
        const newScore = `${score1}:${score2}`;
        
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
            
            this.currentMatch.score = newScore;
            
            if (typeof matchesModule !== 'undefined' && matchesModule.renderMatches) {
                matchesModule.renderMatches();
            }
            
            if (app.selectedMatch?.id === this.currentMatch.id) {
                matchesModule.renderMatchDetail(this.currentMatch);
            }
            
            console.log('✅ Счет обновлен:', newScore);
        } catch (error) {
            console.error('❌ Ошибка обновления счета:', error);
        }
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

    async startMatch() {
        try {
            if (!this.currentMatch?.team2) { 
                alert('Нельзя начать матч без соперника'); 
                return; 
            }
            
            const match = this.currentMatch;
            const requiredPlayers = this.getRequiredPlayersCount(match.format);
            
            const ourRoster = await this.getMatchRoster(match.id, match.team1.id);
            if (!ourRoster || ourRoster.length < requiredPlayers) {
                alert(`Наша команда не выбрала состав! Нужно минимум ${requiredPlayers} игроков.`);
                return;
            }
            
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

            await this.updateTeamStats(score1, score2);
            
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
        
        let teamId, isOurTeam;
        
        if (isTeam1Owner) {
            teamId = match.team1.id;
            isOurTeam = true;
        } else if (isTeam2Owner) {
            teamId = match.team2.id;
            isOurTeam = false;
        } else {
            alert('Вы не являетесь владельцем ни одной из команд');
            return;
        }
        
        if (typeof matchRosterModule !== 'undefined' && matchRosterModule.show) {
            matchRosterModule.show(match.id, teamId, isOurTeam);
        } else {
            alert('Модуль управления составом не доступен');
        }
    },

    async showPlayerStats(matchId, teamId) {
        try {
            const { data: match, error } = await app.supabase
                .from('matches')
                .select('*, team1:teams!matches_team1_fkey(*), team2:teams!matches_team2_fkey(*)')
                .eq('id', matchId)
                .single();
            if (error) throw error;
            this.currentMatch = match;
            this.ourTeamId = teamId;

            const { data: roster, error: rosterError } = await app.supabase
                .from('match_rosters')
                .select('*, player:team_players(*)')
                .eq('match_id', matchId)
                .eq('team_id', teamId);
            if (rosterError) throw rosterError;

            const { data: stats, error: statsError } = await app.supabase
                .from('match_player_stats')
                .select('*')
                .eq('match_id', matchId)
                .eq('team_id', teamId);
            if (statsError) throw statsError;

            const statsMap = {};
            stats?.forEach(s => { statsMap[s.team_player_id] = s; });

            screenManager.show('screen-match-player-stats');
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
        const validationInfo = this.getScoreValidationInfo();
        const { scoreField, teamScore } = validationInfo || { scoreField: 'goals', teamScore: 0 };

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

        html += `</div>
            <div class="player-stats-actions">
                ${remaining > 0 ? `
                <button class="btn btn-secondary" onclick="matchEditModule.distributeRemainingScore(${remaining}, '${scoreField}')">
                    <i class="fas fa-magic"></i> Распределить ${remaining} равномерно
                </button>
                ` : ''}
                <button class="btn btn-primary" onclick="matchEditModule.savePlayerStats('${match.id}', '${teamId}')">
                    <i class="fas fa-save"></i> Сохранить статистику
                </button>
                <button class="btn btn-secondary" onclick="matchEditModule.back()">Отмена</button>
            </div>
        </div>`;

        container.innerHTML = html;
        
        this.attachStatInputListeners(scoreField, teamScore);
    },

    adjustPlayerStat(playerId, statName, delta) {
        const input = document.querySelector(`.stat-input[data-player-id="${playerId}"][data-stat-name="${statName}"]`);
        if (!input) return;
        
        let value = parseInt(input.value) || 0;
        const max = parseInt(input.getAttribute('max')) || 99;
        value = Math.min(max, Math.max(0, value + delta));
        input.value = value;
        
        if (this._boundUpdateProgress) this._boundUpdateProgress();
    },

    distributeRemainingScore(remaining, scoreField) {
        if (remaining <= 0) return;
        
        const inputs = Array.from(document.querySelectorAll('.stat-input'))
            .filter(input => input.dataset.statName === scoreField);
        
        if (inputs.length === 0) return;
        
        inputs[0].value = (parseInt(inputs[0].value) || 0) + remaining;
        
        if (this._boundUpdateProgress) this._boundUpdateProgress();
    },

    attachStatInputListeners(scoreField, teamScore) {
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

        this._boundUpdateProgress = updateProgress.bind(this);

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

            if (statName === scoreField) {
                totalPlayerScore += value;
            }
        });

        if (totalPlayerScore > teamScore) {
            alert(`Ошибка: суммарное количество ${scoreField === 'goals' ? 'голов' : 
                  scoreField === 'points' ? 'очков' : 'выигранных партий'} 
                  игроков (${totalPlayerScore}) превышает счет команды (${teamScore})`);
            return;
        }

        try {
            await app.supabase
                .from('match_player_stats')
                .delete()
                .eq('match_id', matchId)
                .eq('team_id', teamId);

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

    getScoreValidationInfo() {
        const match = this.currentMatch;
        if (!match) return null;

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
                scoreField = 'goals';
        }

        const [score1, score2] = (match.score || '0:0').split(':').map(Number);
        
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

    async checkRostersBeforeStart() {
        if (!this.currentMatch) return;
        
        try {
            const match = this.currentMatch;
            let allRostersComplete = true;
            let messages = [];
            
            const ourTeamId = match.team1?.id;
            if (ourTeamId) {
                const ourRoster = await this.getMatchRoster(match.id, ourTeamId);
                const requiredPlayers = this.getRequiredPlayersCount(match.format);
                
                if (!ourRoster || ourRoster.length < requiredPlayers) {
                    allRostersComplete = false;
                    messages.push(`Наша команда: не выбран состав (нужно ${requiredPlayers} игроков)`);
                }
            }
            
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
                    text: this.isEditing ? 'Сохранить изменения' : 'Редактировать матч', 
                    icon: this.isEditing ? 'fa-check' : 'fa-pen', 
                    class: this.isEditing ? 'btn-success' : 'btn-primary', 
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
    }
};

window.matchEditModule = matchEditModule;