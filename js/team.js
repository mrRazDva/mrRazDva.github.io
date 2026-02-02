const teamModule = {
    currentTeam: null,
    isLoading: false,

    async show(teamId) {
        try {
            // Сбрасываем состояние
            this.currentTeam = null;
            this.isLoading = true;
            
            // Очищаем контейнеры и показываем индикатор загрузки
            this.clearContainers();
            this.showLoadingState();

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
            this.isLoading = false;
            this.render(team);
            screenManager.show('screen-team');
        } catch (error) {
            console.error('❌ Ошибка загрузки команды:', error);
            this.isLoading = false;
            this.showErrorState();
            alert('Ошибка загрузки команды');
        }
    },

    clearContainers() {
        // Очищаем основную информацию
        const avatarContainer = document.getElementById('team-profile-avatar');
        if (avatarContainer) avatarContainer.innerHTML = '<div class="loading-shimmer"></div>';
        
        const nameEl = document.getElementById('team-profile-name');
        if (nameEl) nameEl.textContent = '';
        
        const cityEl = document.getElementById('team-profile-city');
        if (cityEl) cityEl.textContent = '';
        
        const eloContainer = document.getElementById('team-elo-rating');
        if (eloContainer) eloContainer.innerHTML = '<div class="loading-shimmer" style="height: 100px;"></div>';
        
        // Очищаем статистику
        document.getElementById('team-stat-wins').textContent = '';
        document.getElementById('team-stat-losses').textContent = '';
        document.getElementById('team-stat-winrate').textContent = '';
        
        // Очищаем состав и историю
        const rosterContainer = document.getElementById('team-roster');
        const historyContainer = document.getElementById('team-match-history');
        
        if (rosterContainer) {
            rosterContainer.innerHTML = '<div class="empty-state"><div class="loading-spinner"></div>Загрузка состава...</div>';
        }
        
        if (historyContainer) {
            historyContainer.innerHTML = '<div class="empty-state"><div class="loading-spinner"></div>Загрузка истории...</div>';
        }
        
        // Очищаем кнопки действий
        const actionsContainer = document.getElementById('team-actions');
        if (actionsContainer) actionsContainer.innerHTML = '';
    },

    showLoadingState() {
        // Можно добавить анимацию загрузки
        const container = document.querySelector('#screen-team .container');
        if (container) {
            container.classList.add('loading');
        }
    },

    showErrorState() {
        const rosterContainer = document.getElementById('team-roster');
        const historyContainer = document.getElementById('team-match-history');
        
        if (rosterContainer) {
            rosterContainer.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i>Ошибка загрузки состава</div>';
        }
        
        if (historyContainer) {
            historyContainer.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i>Ошибка загрузки истории</div>';
        }
    },

    async render(team) {
    // Основная информация
    // Аватар команды (логотип или эмодзи)
    const avatarContainer = document.getElementById('team-profile-avatar');
    if (avatarContainer) {
        if (team.logo_url) {
            avatarContainer.innerHTML = `
                <img src="${team.logo_url}" 
                     alt="${team.name}" 
                     style="width: 100%; height: 100%; object-fit: cover; display: block;">
            `;
        } else {
            avatarContainer.textContent = team.avatar || '⚽';
        }
    }
    
    const nameEl = document.getElementById('team-profile-name');
    if (nameEl) nameEl.textContent = team.name;
    
    const cityEl = document.getElementById('team-profile-city');
    if (cityEl) {
        cityEl.textContent = `${app.cities[team.city]?.name || team.city} • ${this.getSportName(team.sport)}`;
    }

    // Загружаем статистику команды
    await this.loadTeamStats(team.id);
    // Отображение ELO рейтинга - теперь в отдельном блоке
    await this.renderEloRating(team.id);

    // Состав команды
    this.renderRoster(team.players || []);

    // История матчей
    await this.renderMatchHistory(team.id);
    
    // Снимаем класс загрузки
    const container = document.querySelector('#screen-team .container');
    if (container) {
        container.classList.remove('loading');
    }
},

async renderEloRating(teamId) {
    try {
        const { data: team, error } = await app.supabase
            .from('teams')
            .select('elo_rating')
            .eq('id', teamId)
            .single();
            
        if (error) throw error;
        
        const eloRating = team.elo_rating || 1000;
        const rank = eloModule.getRank(eloRating);
        
        // Добавляем ELO рейтинг в отдельный контейнер
        const eloContainer = document.getElementById('team-elo-rating');
        if (eloContainer) {
            eloContainer.innerHTML = `
                <div class="stat-box" style="border: 2px solid ${rank.color}; background: rgba(0,0,0,0.3); text-align: center; margin-bottom: 20px; padding: 20px;">
                    <div class="stat-number" style="color: ${rank.color}; font-weight: 700; font-size: 2rem; margin-bottom: 10px;">${eloRating}</div>
                    <div class="rank-badge" style="color: ${rank.color}; font-size: 0.8rem; font-weight: 700; text-transform: uppercase;">
                        ${rank.name}
                    </div>
                    <div class="stat-label" style="font-size: 0.6rem; margin-top: 5px; opacity: 0.8;">ELO рейтинг</div>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки ELO рейтинга:', error);
        const eloContainer = document.getElementById('team-elo-rating');
        if (eloContainer) {
            eloContainer.innerHTML = '<div class="empty-state">Ошибка загрузки рейтинга</div>';
        }
    }
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

    rosterContainer.innerHTML = players.map((player, index) => {
        // Генерируем HTML для аватарки игрока
        let avatarHTML = '';
        if (player.photo_url) {
            // Если есть URL фото, используем изображение
            avatarHTML = `
                <div class="player-avatar" style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                    <img src="${player.photo_url}" alt="${player.name}" style="width:100%;height:100%;object-fit:cover;">
                </div>
            `;
        } else {
            // Если нет фото, показываем номер игрока
            avatarHTML = `
                <div class="player-avatar" style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-blue); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.9rem;">
                    ${player.number}
                </div>
            `;
        }

        return `
            <div class="player-card" style="animation-delay: ${index * 0.05}s">
                ${avatarHTML}
                <div class="player-info">
                    <div class="player-name">${player.name}</div>
                    <div class="player-role">${player.role}</div>
                    ${player.info ? `<div class="player-bio">${player.info}</div>` : ''}
                </div>
                ${player.is_captain ? '<span class="captain-badge">Капитан</span>' : ''}
            </div>
        `;
    }).join('');
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
            const opponentTeam = opponent || { name: 'Неизвестно' };
            
            let opponentAvatar = '?';
            if (opponentTeam) {
                if (opponentTeam.logo_url) {
                    opponentAvatar = `<img src="${opponentTeam.logo_url}" alt="${opponentTeam.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                } else {
                    opponentAvatar = opponentTeam.avatar || '?';
                }
            }
            
            let resultClass = 'upcoming';
            let resultText = 'СКОРО';
            
            if (match.status === 'finished') {
                const [score1, score2] = match.score.split(':').map(Number);
                const isWin = isTeam1 ? score1 > score2 : score2 > score1;
                resultClass = isWin ? 'win' : 'loss';
                resultText = match.score;
            }

            return `
                <div class="history-match ${resultClass}" onclick="app.showMatchDetail('${match.id}')">
                    <div class="history-opponent">
                        <div class="team-avatar" style="width: 32px; height: 32px; font-size: 1rem; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                            ${opponentAvatar}
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



getSportName(sport) {
    const names = {
        football: 'Футбол',
        volleyball: 'Волейбол',
        basketball: 'Баскетбол'
    };
    return names[sport] || sport;
}
};