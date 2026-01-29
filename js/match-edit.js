// js/match-edit.js - Редактирование матчей, счет, завершение
const matchEditModule = {
    currentMatch: null,
    originalMatch: null,
    isEditing: false,

    async show(matchId) {
        try {
            // Загружаем матч с командами
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

            // Проверяем, является ли пользователь владельцем одной из команд
            const userId = authModule.getUserId();
            const isTeam1Owner = match.team1?.owner_id === userId;
            const isTeam2Owner = match.team2?.owner_id === userId;
            
            if (!isTeam1Owner && !isTeam2Owner) {
                alert('Только владельцы команд могут редактировать матч');
                return;
            }

            this.currentMatch = match;
            this.originalMatch = JSON.parse(JSON.stringify(match));
            this.isEditing = false;
            
            this.render();
            screenManager.show('screen-match-edit');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки матча:', error);
            alert('Ошибка загрузки матча');
        }
    },

    render() {
        if (!this.currentMatch) return;

        const match = this.currentMatch;
        const isOwner = this.isMatchOwner();
        
        // Заполняем основную информацию
        document.getElementById('edit-match-sport').textContent = 
            app.getSportName(match.sport).toUpperCase();
        
        document.getElementById('edit-match-team1-name').textContent = 
            match.team1?.name || 'Неизвестно';
        document.getElementById('edit-match-team1-avatar').textContent = 
            match.team1?.avatar || '?';
            
        document.getElementById('edit-match-team2-name').textContent = 
            match.team2?.name || 'Неизвестно';
        document.getElementById('edit-match-team2-avatar').textContent = 
            match.team2?.avatar || '?';

        // Текущий счет
        const [score1, score2] = match.score ? match.score.split(':').map(Number) : [0, 0];
        document.getElementById('edit-match-score1').value = score1;
        document.getElementById('edit-match-score2').value = score2;

        // Статус
        document.getElementById('edit-match-status').value = match.status || 'upcoming';
        
        // Даты
        const dateTime = match.date ? utils.formatDateTimeLocal(match.date) : '';
        document.getElementById('edit-match-datetime').value = dateTime;
        
        // Место
        document.getElementById('edit-match-location').value = match.location || '';
        document.getElementById('edit-match-lat').value = match.lat || '';
        document.getElementById('edit-match-lng').value = match.lng || '';

        // Обновляем UI в зависимости от статуса и режима редактирования
        this.updateUIByStatus();
        this.updateEditModeUI();
    },

    isMatchOwner() {
        if (!this.currentMatch || !authModule.isAuthenticated()) return false;
        const userId = authModule.getUserId();
        const match = this.currentMatch;
        
        return match.team1?.owner_id === userId || match.team2?.owner_id === userId;
    },

    updateUIByStatus() {
        const match = this.currentMatch;
        if (!match) return;

        const score1 = parseInt(document.getElementById('edit-match-score1').value) || 0;
        const score2 = parseInt(document.getElementById('edit-match-score2').value) || 0;
        const hasScore = score1 > 0 || score2 > 0;
        const bothTeamsPresent = match.team1 && match.team2;

        // Обновляем кнопку завершения
        const finishBtn = document.getElementById('finish-match-btn');
        if (finishBtn) {
            const isOwner = this.isMatchOwner();
            const canFinish = isOwner && match.status !== 'finished' && bothTeamsPresent && hasScore;
            
            finishBtn.disabled = !canFinish;
            finishBtn.style.display = !this.isEditing && canFinish ? 'block' : 'none';
            
            if (!bothTeamsPresent) {
                finishBtn.title = 'Нужны обе команды';
            } else if (!hasScore) {
                finishBtn.title = 'Установите счет';
            } else {
                finishBtn.title = 'Завершить матч';
            }
        }

        // Обновляем предупреждения
        this.updateWarnings();
    },

    updateWarnings() {
        const match = this.currentMatch;
        const warningsEl = document.getElementById('edit-match-warnings');
        
        if (!warningsEl) return;

        let warnings = [];

        if (!match.team2) {
            warnings.push('• В матче нет второй команды');
        }

        if (match.status === 'upcoming' && new Date(match.date) < new Date()) {
            warnings.push('• Время матча уже прошло');
        }

        if (match.status === 'finished' && !match.score) {
            warnings.push('• У завершенного матча нет счета');
        }

        if (warnings.length > 0) {
            warningsEl.innerHTML = warnings.map(w => 
                `<div class="warning-item"><i class="fas fa-exclamation-triangle"></i> ${w}</div>`
            ).join('');
            warningsEl.classList.remove('hidden');
        } else {
            warningsEl.classList.add('hidden');
        }
    },

    // Обновление UI в зависимости от режима редактирования
    updateEditModeUI() {
        const isOwner = this.isMatchOwner();
        const match = this.currentMatch;
        
        if (this.isEditing) {
            // Режим редактирования
            document.getElementById('edit-match-datetime').disabled = false;
            document.getElementById('edit-match-location').disabled = false;
            document.getElementById('edit-match-location-btn').classList.remove('hidden');
            document.getElementById('edit-match-status').disabled = false;
            
            // Кнопки
            document.getElementById('edit-match-edit-btn').style.display = 'none';
            document.getElementById('edit-match-save-btn').style.display = 'block';
            document.getElementById('edit-match-cancel-btn').style.display = 'block';
            document.getElementById('finish-match-btn').style.display = 'none';
            document.getElementById('cancel-match-btn').style.display = 'none';
            document.getElementById('resume-match-btn').style.display = 'none';
        } else {
            // Режим просмотра
            document.getElementById('edit-match-datetime').disabled = true;
            document.getElementById('edit-match-location').disabled = true;
            document.getElementById('edit-match-location-btn').classList.add('hidden');
            document.getElementById('edit-match-status').disabled = true;
            
            // Кнопки
            document.getElementById('edit-match-edit-btn').style.display = isOwner ? 'block' : 'none';
            document.getElementById('edit-match-save-btn').style.display = 'none';
            document.getElementById('edit-match-cancel-btn').style.display = 'none';
            
            // Кнопки управления статусом
            const canFinish = isOwner && match.status !== 'finished' && match.team2;
            const canCancel = isOwner && match.status !== 'cancelled';
            const canResume = isOwner && match.status === 'cancelled';
            
            document.getElementById('finish-match-btn').style.display = canFinish ? 'block' : 'none';
            document.getElementById('cancel-match-btn').style.display = canCancel ? 'block' : 'none';
            document.getElementById('resume-match-btn').style.display = canResume ? 'block' : 'none';
        }

        // Бейдж статуса
        const statusBadge = document.getElementById('edit-match-status-badge');
        if (statusBadge) {
            statusBadge.className = `match-status status-${match.status || 'upcoming'}`;
            statusBadge.textContent = app.getStatusText(match.status);
        }
    },

    // ДОБАВЛЕННЫЕ МЕТОДЫ ДЛЯ РАБОТЫ СО СЧЕТОМ:
    
    adjustScore(change, teamNumber) {
        const inputId = teamNumber === 1 ? 'edit-match-score1' : 'edit-match-score2';
        const input = document.getElementById(inputId);
        let value = parseInt(input.value) || 0;
        
        value += change;
        if (value < 0) value = 0;
        if (value > 99) value = 99;
        
        input.value = value;
        this.updateUIByStatus();
    },

    async updateScore() {
        const score1 = parseInt(document.getElementById('edit-match-score1').value) || 0;
        const score2 = parseInt(document.getElementById('edit-match-score2').value) || 0;
        
        if (score1 < 0 || score2 < 0) {
            alert('Счет не может быть отрицательным');
            return;
        }

        const newScore = `${score1}:${score2}`;
        
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
            this.updateUIByStatus();
            
            // Обновляем на главном экране
            if (matchesModule) {
                await matchesModule.renderMatches();
                if (app.selectedMatch?.id === this.currentMatch.id) {
                    matchesModule.showMatchDetail(this.currentMatch.id);
                }
            }

            alert('Счет обновлен!');

        } catch (error) {
            console.error('❌ Ошибка обновления счета:', error);
            alert('Ошибка обновления счета');
        }
    },

    async updateStatus(newStatus) {
        if (!confirm(`Изменить статус матча на "${app.getStatusText(newStatus)}"?`)) {
            return;
        }

        try {
            const updates = { 
                status: newStatus,
                updated_at: new Date().toISOString()
            };
            
            // Если завершаем матч, проверяем счет
            if (newStatus === 'finished') {
                const score1 = parseInt(document.getElementById('edit-match-score1').value) || 0;
                const score2 = parseInt(document.getElementById('edit-match-score2').value) || 0;
                
                if (score1 === 0 && score2 === 0) {
                    if (!confirm('Счет 0:0. Все равно завершить матч?')) {
                        return;
                    }
                }
                
                updates.score = `${score1}:${score2}`;
                updates.finished_at = new Date().toISOString();
                
                // Обновляем статистику команд
                await this.updateTeamStats();
            }
            
            // Если отменяем матч
            if (newStatus === 'cancelled') {
                updates.cancelled_at = new Date().toISOString();
            }

            const { error } = await app.supabase
                .from('matches')
                .update(updates)
                .eq('id', this.currentMatch.id);

            if (error) throw error;

            this.currentMatch.status = newStatus;
            this.currentMatch.score = updates.score || this.currentMatch.score;
            
            alert(`Статус матча изменен на "${app.getStatusText(newStatus)}"`);
            this.render();

            // Обновляем в других местах
            if (matchesModule) {
                await matchesModule.renderMatches();
                if (app.selectedMatch?.id === this.currentMatch.id) {
                    matchesModule.showMatchDetail(this.currentMatch.id);
                }
            }

        } catch (error) {
            console.error('❌ Ошибка изменения статуса:', error);
            alert('Ошибка изменения статуса матча');
        }
    },

    async updateTeamStats() {
        try {
            const match = this.currentMatch;
            const [score1, score2] = match.score.split(':').map(Number);
            
            if (!match.team1 || !match.team2) return;

            // Определяем победителя
            let winnerId = null;
            let loserId = null;
            
            if (score1 > score2) {
                winnerId = match.team1.id;
                loserId = match.team2.id;
            } else if (score2 > score1) {
                winnerId = match.team2.id;
                loserId = match.team1.id;
            }
            // Ничья - winnerId остается null

            // Обновляем статистику в базе данных
            // Сначала получаем текущую статистику
            const { data: team1Data } = await app.supabase
                .from('teams')
                .select('wins, losses, draws')
                .eq('id', match.team1.id)
                .single();

            const { data: team2Data } = await app.supabase
                .from('teams')
                .select('wins, losses, draws')
                .eq('id', match.team2.id)
                .single();

            // Подготавливаем обновления
            const team1Updates = { 
                wins: team1Data?.wins || 0,
                losses: team1Data?.losses || 0,
                draws: team1Data?.draws || 0
            };
            
            const team2Updates = { 
                wins: team2Data?.wins || 0,
                losses: team2Data?.losses || 0,
                draws: team2Data?.draws || 0
            };

            if (winnerId === match.team1.id) {
                team1Updates.wins++;
                team2Updates.losses++;
            } else if (winnerId === match.team2.id) {
                team2Updates.wins++;
                team1Updates.losses++;
            } else {
                // Ничья
                team1Updates.draws++;
                team2Updates.draws++;
            }

            // Сохраняем обновления
            await app.supabase
                .from('teams')
                .update(team1Updates)
                .eq('id', match.team1.id);

            await app.supabase
                .from('teams')
                .update(team2Updates)
                .eq('id', match.team2.id);

        } catch (error) {
            console.error('❌ Ошибка обновления статистики команд:', error);
            // Не блокируем основную операцию из-за ошибки статистики
        }
    },

    async saveMatchChanges() {
        const datetime = document.getElementById('edit-match-datetime').value;
        const location = document.getElementById('edit-match-location').value;
        const lat = document.getElementById('edit-match-lat').value;
        const lng = document.getElementById('edit-match-lng').value;
        const status = document.getElementById('edit-match-status').value;
        const score1 = parseInt(document.getElementById('edit-match-score1').value) || 0;
        const score2 = parseInt(document.getElementById('edit-match-score2').value) || 0;

        if (!datetime || !location) {
            alert('Заполните дату и место проведения');
            return;
        }

        try {
            const updates = {
                date: datetime,
                location,
                status,
                score: `${score1}:${score2}`,
                lat: lat || null,
                lng: lng || null,
                updated_at: new Date().toISOString()
            };

            // Если статус меняется на finished, устанавливаем дату завершения
            if (status === 'finished' && this.currentMatch.status !== 'finished') {
                updates.finished_at = new Date().toISOString();
                
                // Обновляем статистику команд
                await this.updateTeamStats();
            }

            const { error } = await app.supabase
                .from('matches')
                .update(updates)
                .eq('id', this.currentMatch.id);

            if (error) throw error;

            // Обновляем текущий матч
            Object.assign(this.currentMatch, updates);
            this.originalMatch = JSON.parse(JSON.stringify(this.currentMatch));
            this.isEditing = false;
            
            alert('Изменения сохранены!');
            this.render();

            // Обновляем в других модулях
            if (matchesModule) {
                await matchesModule.renderMatches();
                if (app.selectedMatch?.id === this.currentMatch.id) {
                    matchesModule.showMatchDetail(this.currentMatch.id);
                }
            }

        } catch (error) {
            console.error('❌ Ошибка сохранения матча:', error);
            alert('Ошибка сохранения изменений матча');
        }
    },

    async cancelMatch() {
        if (!confirm('Отменить матч? Это действие нельзя отменить.')) {
            return;
        }

        try {
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
            alert('Матч отменен');
            this.render();

            // Обновляем в других местах
            if (matchesModule) {
                await matchesModule.renderMatches();
            }

        } catch (error) {
            console.error('❌ Ошибка отмены матча:', error);
            alert('Ошибка отмены матча');
        }
    },

    async resumeMatch() {
        if (!confirm('Возобновить матч?')) {
            return;
        }

        try {
            const { error } = await app.supabase
                .from('matches')
                .update({ 
                    status: 'upcoming',
                    cancelled_at: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentMatch.id);

            if (error) throw error;

            this.currentMatch.status = 'upcoming';
            this.currentMatch.cancelled_at = null;
            alert('Матч возобновлен');
            this.render();

            // Обновляем в других местах
            if (matchesModule) {
                await matchesModule.renderMatches();
            }

        } catch (error) {
            console.error('❌ Ошибка возобновления матча:', error);
            alert('Ошибка возобновления матча');
        }
    },

    startEditing() {
        this.isEditing = true;
        this.render();
    },

    cancelEditing() {
        this.isEditing = false;
        // Восстанавливаем исходные значения
        this.currentMatch = JSON.parse(JSON.stringify(this.originalMatch));
        this.render();
    },

    openMapForLocation() {
        // Используем существующий функционал карты
        mapModule.openMapForLocation();
        
        // Устанавливаем обработчики для этого конкретного матча
        const originalConfirmLocation = mapModule.confirmLocation;
        mapModule.confirmLocation = () => {
            const name = document.getElementById('location-name').value;
            const address = document.getElementById('location-address').value;
            const [lat, lng] = mapModule.selectedCoords || [null, null];
            
            document.getElementById('edit-match-location').value = 
                name + (address ? ` (${address})` : '');
            document.getElementById('edit-match-lat').value = lat;
            document.getElementById('edit-match-lng').value = lng;
            
            mapModule.closeLocationPicker();
            mapModule.confirmLocation = originalConfirmLocation;
        };
    },

    back() {
        if (this.isEditing) {
            if (confirm('Есть несохраненные изменения. Выйти?')) {
                this.cancelEditing();
            } else {
                return;
            }
        }
        screenManager.show('screen-match');
    },
    
    // ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ:
    
    quickScore(team1Score, team2Score) {
        document.getElementById('edit-match-score1').value = team1Score;
        document.getElementById('edit-match-score2').value = team2Score;
        this.updateScore();
    }
};