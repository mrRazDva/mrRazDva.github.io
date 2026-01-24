const teamModule = {
    currentTeam: null,

    show(teamId) {
        const team = mockData.teams[teamId];
        if (!team) return;

        this.currentTeam = team;
        this.render(team);
        screenManager.show('screen-team');
    },

    render(team) {
        // Основная информация
        document.getElementById('team-profile-avatar').textContent = team.avatar;
        document.getElementById('team-profile-name').textContent = team.name;
        document.getElementById('team-profile-city').textContent = 
            `${mockData.cities[team.city]?.name || team.city} • ${this.getSportName(team.sport)}`;

        // Статистика
        const totalGames = team.wins + team.losses + (team.draws || 0);
        const winRate = totalGames > 0 ? Math.round((team.wins / totalGames) * 100) : 0;

        document.getElementById('team-stat-wins').textContent = team.wins;
        document.getElementById('team-stat-losses').textContent = team.losses;
        document.getElementById('team-stat-winrate').textContent = winRate + '%';

        // Показываем/скрываем кнопку редактирования для владельца
        const isOwner = team.owner === app.currentUser?.id;
        const editButton = document.getElementById('team-edit-btn');
        if (editButton) {
            editButton.style.display = isOwner ? 'block' : 'none';
            if (isOwner) {
                editButton.onclick = () => teamEditModule.show(team.id);
            }
        }

        // Состав команды
        const rosterContainer = document.getElementById('team-roster');
        if (rosterContainer) {
            rosterContainer.innerHTML = team.players.map((player, index) => `
                <div class="player-card" style="animation-delay: ${index * 0.05}s">
                    <div class="player-number">${player.number}</div>
                    <div class="player-info">
                        <div class="player-name">${player.name}</div>
                        <div class="player-role">${player.role}</div>
                        ${player.info ? `<div class="player-bio">${player.info}</div>` : ''}
                    </div>
                    ${index === 0 ? '<span class="captain-badge">Капитан</span>' : ''}
                </div>
            `).join('');
        }

        // История матчей
        this.renderMatchHistory(team.id);
    },

    renderMatchHistory(teamId) {
        const historyContainer = document.getElementById('team-match-history');
        if (!historyContainer) return;

        const teamMatches = mockData.matches.filter(m => 
            m.team1 === teamId || m.team2 === teamId
        );

        if (teamMatches.length === 0) {
            historyContainer.innerHTML = '<div class="empty-state">Нет матчей</div>';
            return;
        }

        historyContainer.innerHTML = teamMatches.map(match => {
            const isTeam1 = match.team1 === teamId;
            const opponent = mockData.teams[isTeam1 ? match.team2 : match.team1];
            
            let resultClass = 'upcoming';
            let resultText = 'СКОРО';
            
            if (match.status === 'finished') {
                const [score1, score2] = match.score.split(':').map(Number);
                const isWin = isTeam1 ? score1 > score2 : score2 > score1;
                resultClass = isWin ? 'win' : 'loss';
                resultText = match.score;
            }

            return `
                <div class="history-match ${resultClass}">
                    <div class="history-opponent">
                        <div class="team-avatar" style="width: 32px; height: 32px; font-size: 1rem;">
                            ${opponent?.avatar || '?'}
                        </div>
                        <span>${opponent?.name || 'Неизвестно'}</span>
                    </div>
                    <div class="history-result">
                        <span class="history-score ${resultClass}">${resultText}</span>
                        <span class="history-date">${match.date}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    back() {
        if (app.selectedMatch) {
            screenManager.show('screen-match');
        } else {
            screenManager.show('screen-main');
        }
    },

    challenge() {
        if (app.currentUser.role !== 'organizer') {
            alert('Только организаторы могут бросать вызовы');
            return;
        }
        
        if (!app.currentUser.teams || app.currentUser.teams.length === 0) {
            alert('Сначала создайте команду');
            return;
        }

        // Если у пользователя одна команда - сразу бросаем вызов
        if (app.currentUser.teams.length === 1) {
            this.confirmChallenge(app.currentUser.teams[0]);
        } else {
            // Если несколько команд - показываем выбор
            this.showTeamSelection();
        }
    },

    showTeamSelection() {
        const myTeams = app.currentUser.teams.map(id => mockData.teams[id]).filter(Boolean);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal-content">
                <h3 style="margin-bottom: 20px; font-family: var(--font-display);">Выберите команду</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    Какой командой бросить вызов ${this.currentTeam.name}?
                </p>
                <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
                    ${myTeams.map(team => `
                        <button class="btn btn-secondary" style="justify-content: flex-start; gap: 15px;" 
                                onclick="teamModule.confirmChallenge('${team.id}'); this.closest('.modal-overlay').remove();">
                            <span style="font-size: 1.5rem;">${team.avatar}</span>
                            <span>${team.name}</span>
                        </button>
                    `).join('')}
                </div>
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Отмена</button>
            </div>
        `;
        document.body.appendChild(modal);
    },

    confirmChallenge(myTeamId) {
        alert(`Вызов команде ${this.currentTeam.name} отправлен! Ожидайте подтверждения.`);
        // Здесь можно добавить создание уведомления или запроса на матч
    },

    getSportName(sport) {
        const names = {
            football: 'Футбол',
            volleyball: 'Волейбол',
            basketball: 'Баскетбол'
        };
        return names[sport] || sport;
    }
};