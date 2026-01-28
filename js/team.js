const teamModule = {
    currentTeam: null,

    async show(teamId) {
        try {
            const { data: team, error } = await app.supabase
                .from('teams')
                .select(`
                    *,
                    players:team_players(*)
                `)
                .eq('id', teamId)
                .single();

            if (error) throw error;

            this.currentTeam = team;
            this.render(team);
            screenManager.show('screen-team');
        } catch (error) {
            console.error('❌ Ошибка загрузки команды:', error);
            alert('Ошибка загрузки команды');
        }
    },

    async render(team) {
        // Основная информация
        document.getElementById('team-profile-avatar').textContent = team.avatar;
        document.getElementById('team-profile-name').textContent = team.name;
        document.getElementById('team-profile-city').textContent = 
            `${app.cities[team.city]?.name || team.city} • ${this.getSportName(team.sport)}`;

        // Загружаем статистику команды
        await this.loadTeamStats(team.id);

        // Показываем/скрываем кнопку редактирования для владельца
        const isOwner = team.owner_id === app.currentUser?.id;
        const actionsContainer = document.getElementById('team-actions');
        if (actionsContainer) {
            actionsContainer.innerHTML = isOwner ? 
                `<button class="btn btn-primary" onclick="teamEditModule.show('${team.id}')">Редактировать</button>` :
                `<button class="btn btn-challenge" onclick="teamModule.challenge()">
                    <i class="fas fa-fire"></i> Бросить вызов
                </button>`;
        }

        // Состав команды
        this.renderRoster(team.players || []);

        // История матчей
        await this.renderMatchHistory(team.id);
    },

    async loadTeamStats(teamId) {
        try {
            // Получаем статистику матчей команды
            const { data: matches, error } = await app.supabase
                .from('matches')
                .select('*')
                .or(`team1.eq.${teamId},team2.eq.${teamId}`)
                .eq('status', 'finished');

            if (error) throw error;

            let wins = 0, losses = 0;
            matches.forEach(match => {
                const isTeam1 = match.team1 === teamId;
                const [score1, score2] = match.score.split(':').map(Number);
                const isWin = isTeam1 ? score1 > score2 : score2 > score1;
                
                if (isWin) wins++;
                else losses++;
            });

            const totalGames = wins + losses;
            const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

            document.getElementById('team-stat-wins').textContent = wins;
            document.getElementById('team-stat-losses').textContent = losses;
            document.getElementById('team-stat-winrate').textContent = winRate + '%';

        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
        }
    },

    renderRoster(players) {
        const rosterContainer = document.getElementById('team-roster');
        if (!rosterContainer) return;

        if (!players || players.length === 0) {
            rosterContainer.innerHTML = '<div class="empty-state">Состав команды пуст</div>';
            return;
        }

        rosterContainer.innerHTML = players.map((player, index) => `
            <div class="player-card" style="animation-delay: ${index * 0.05}s">
                <div class="player-number">${player.number}</div>
                <div class="player-info">
                    <div class="player-name">${player.name}</div>
                    <div class="player-role">${player.role}</div>
                    ${player.info ? `<div class="player-bio">${player.info}</div>` : ''}
                </div>
                ${player.is_captain ? '<span class="captain-badge">Капитан</span>' : ''}
            </div>
        `).join('');
    },

    async renderMatchHistory(teamId) {
        const historyContainer = document.getElementById('team-match-history');
        if (!historyContainer) return;

        try {
            const { data: matches, error } = await app.supabase
                .from('matches')
                .select(`
                    *,
                    team1:teams!matches_team1_fkey(*),
                    team2:teams!matches_team2_fkey(*)
                `)
                .or(`team1.eq.${teamId},team2.eq.${teamId}`)
                .order('date', { ascending: false })
                .limit(10);

            if (error) throw error;

            if (!matches || matches.length === 0) {
                historyContainer.innerHTML = '<div class="empty-state">Нет матчей</div>';
                return;
            }

            historyContainer.innerHTML = matches.map(match => {
                const isTeam1 = match.team1.id === teamId;
                const opponent = isTeam1 ? match.team2 : match.team1;
                const opponentTeam = opponent || { name: 'Неизвестно', avatar: '?' };
                
                let resultClass = 'upcoming';
                let resultText = 'СКОРО';
                
                if (match.status === 'finished') {
                    const [score1, score2] = match.score.split(':').map(Number);
                    const isWin = isTeam1 ? score1 > score2 : score2 > score1;
                    resultClass = isWin ? 'win' : 'loss';
                    resultText = match.score;
                }

                return `
                    <div class="history-match ${resultClass}" onclick="app.showMatchDetail(${match.id})">
                        <div class="history-opponent">
                            <div class="team-avatar" style="width: 32px; height: 32px; font-size: 1rem;">
                                ${opponentTeam.avatar || '?'}
                            </div>
                            <span>${opponentTeam.name}</span>
                        </div>
                        <div class="history-result">
                            <span class="history-score ${resultClass}">${resultText}</span>
                            <span class="history-date">${new Date(match.date).toLocaleDateString('ru-RU')}</span>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('❌ Ошибка загрузки истории матчей:', error);
            historyContainer.innerHTML = '<div class="empty-state">Ошибка загрузки истории</div>';
        }
    },

    back() {
        if (app.selectedMatch) {
            screenManager.show('screen-match');
        } else {
            screenManager.show('screen-main');
        }
    },

    async challenge() {
        if (!app.currentUser || app.currentUser.role !== 'organizer') {
            alert('Только организаторы могут бросать вызовы');
            return;
        }
        
        if (confirm(`Бросить вызов команде ${this.currentTeam.name}?`)) {
            try {
                // Создаем запись о вызове в Supabase
                const { error } = await app.supabase
                    .from('challenges')
                    .insert([{
                        from_team_id: null, // ID команды пользователя
                        to_team_id: this.currentTeam.id,
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
