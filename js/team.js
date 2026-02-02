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
        // Аватар команды (логотип или эмодзи)
        const avatarContainer = document.getElementById('team-profile-avatar');
        if (team.logo_url) {
            avatarContainer.innerHTML = `
                <img src="${team.logo_url}" 
                     alt="${team.name}" 
                     style="width: 100%; height: 100%; object-fit: cover; display: block;">
            `;
        } else {
            avatarContainer.textContent = team.avatar || '⚽';
        }
        document.getElementById('team-profile-name').textContent = team.name;
        document.getElementById('team-profile-city').textContent = 
            `${app.cities[team.city]?.name || team.city} • ${this.getSportName(team.sport)}`;

        // Загружаем статистику команды
        await this.loadTeamStats(team.id);
        // Отображение ELO рейтинга - теперь в отдельном блоке
        await this.renderEloRating(team.id);
        
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

        // Состав команды - отображаем на футбольном поле для футбола
        if (team.sport === 'football') {
            this.renderFootballFieldRoster(team.players || []);
        } else {
            this.renderRoster(team.players || []);
        }

        // История матчей
        await this.renderMatchHistory(team.id);
    },

    // Новый метод для отображения состава на футбольном поле
    renderFootballFieldRoster(players) {
        const rosterContainer = document.getElementById('team-roster');
        if (!rosterContainer) return;

        if (!players || players.length === 0) {
            rosterContainer.innerHTML = '<div class="empty-state">Состав команды пуст</div>';
            return;
        }

        // Сортируем игроков: капитан первый, затем по номеру
        const sortedPlayers = [...players].sort((a, b) => {
            if (a.is_captain && !b.is_captain) return -1;
            if (!a.is_captain && b.is_captain) return 1;
            return (a.number || 99) - (b.number || 99);
        });

        // Распределяем игроков по позициям
        const formation = this.distributePlayersToFormation(sortedPlayers);

        rosterContainer.innerHTML = `
            <div class="football-field-roster">
                <img src="./images/football-field.jpg" alt="Футбольное поле" class="football-field-bg">
                <div class="football-field-overlay">
                    <!-- Вратарь -->
                    <div class="field-row goalkeeper">
                        ${formation.goalkeeper.map(p => this.renderPlayerOnField(p)).join('')}
                    </div>
                    <!-- Защитники -->
                    <div class="field-row defenders">
                        ${formation.defenders.map(p => this.renderPlayerOnField(p)).join('')}
                    </div>
                    <!-- Полузащитники -->
                    <div class="field-row midfielders">
                        ${formation.midfielders.map(p => this.renderPlayerOnField(p)).join('')}
                    </div>
                    <!-- Нападающие -->
                    <div class="field-row attackers">
                        ${formation.attackers.map(p => this.renderPlayerOnField(p)).join('')}
                    </div>
                </div>
            </div>
            <div class="roster-list-below">
                <h3 class="section-subtitle">
                    <i class="fas fa-list"></i>
                    Список игроков
                </h3>
                <div class="players-list-simple">
                    ${sortedPlayers.map((player, index) => `
                        <div class="player-simple-item" style="animation-delay: ${index * 0.05}s">
                            <span class="player-simple-number">${player.number || '-'}</span>
                            <span class="player-simple-name">${player.name}</span>
                            ${player.is_captain ? '<span class="captain-badge-small">К</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Добавляем стили для списка игроков
        this.addRosterListStyles();
    },

    // Распределяет игроков по позициям на поле
    distributePlayersToFormation(players) {
        const formation = {
            goalkeeper: [],
            defenders: [],
            midfielders: [],
            attackers: []
        };

        // Определяем позицию по role или номеру
        players.forEach(player => {
            const role = (player.role || '').toLowerCase();
            
            if (role.includes('вратар') || role.includes('голкипер') || role.includes('keeper') || player.number === 1) {
                formation.goalkeeper.push(player);
            } else if (role.includes('защит') || role.includes('дефендер') || role.includes('defender') || 
                       role.includes('лев') || role.includes('прав') || role.includes('центр') && role.includes('защ')) {
                formation.defenders.push(player);
            } else if (role.includes('полузащит') || role.includes('мидфилд') || role.includes('midfield') ||
                       role.includes('опорн') || role.includes('атак') && role.includes('полу')) {
                formation.midfielders.push(player);
            } else if (role.includes('напада') || role.includes('форвард') || role.includes('forward') ||
                       role.includes('страйкер') || role.includes(' striker')) {
                formation.attackers.push(player);
            } else {
                // Если позиция не определена, распределяем по номерам
                const num = player.number || 99;
                if (num === 1) {
                    formation.goalkeeper.push(player);
                } else if (num >= 2 && num <= 5) {
                    formation.defenders.push(player);
                } else if (num >= 6 && num <= 10) {
                    formation.midfielders.push(player);
                } else {
                    formation.attackers.push(player);
                }
            }
        });

        // Если какая-то линия пуста, распределяем оставшихся игроков
        const allAssigned = [...formation.goalkeeper, ...formation.defenders, ...formation.midfielders, ...formation.attackers];
        const unassigned = players.filter(p => !allAssigned.includes(p));

        if (formation.goalkeeper.length === 0 && unassigned.length > 0) {
            formation.goalkeeper.push(unassigned.shift());
        }
        
        // Распределяем оставшихся равномерно
        while (unassigned.length > 0) {
            if (formation.defenders.length <= formation.midfielders.length && 
                formation.defenders.length <= formation.attackers.length) {
                formation.defenders.push(unassigned.shift());
            } else if (formation.midfielders.length <= formation.attackers.length) {
                formation.midfielders.push(unassigned.shift());
            } else {
                formation.attackers.push(unassigned.shift());
            }
        }

        return formation;
    },

     // Рендерит одного игрока на поле в стиле FIFA UT
renderPlayerOnField(player) {
    const isCaptain = player.is_captain;
    const number = player.number || '-';
    const position = this.getPositionAbbreviation(player.role);
    
    // Определяем контент для фото
    let imageContent = '';
    if (player.photo_url) {
        imageContent = `<img src="${player.photo_url}" alt="${player.name}">`;
    } else {
        const initial = player.name ? player.name.charAt(0).toUpperCase() : '?';
        imageContent = `<div class="fut-initial">${initial}</div>`;
    }
    
    // Короткое имя (максимум 10 символов)
    const shortName = player.name.length > 10 
        ? player.name.substring(0, 10).toUpperCase() 
        : player.name.toUpperCase();
    
    return `
        <div class="fut-card ${isCaptain ? 'captain' : ''}" onclick="teamModule.showPlayerDetail('${player.id}')">
            <div class="fut-card-header">
                <div class="fut-rating">${number}</div>
                <div class="fut-position">${position}</div>
            </div>
            <div class="fut-card-image">
                ${imageContent}
            </div>
            <div class="fut-name">${shortName}</div>
        </div>
    `;
},

    // Получает аббревиатуру позиции
getPositionAbbreviation(role) {
    if (!role) return 'ЗАП';
    const roleLower = role.toLowerCase();
    
    const positions = {
        'вратарь': 'ВРТ',
        'голкипер': 'ВРТ',
        'keeper': 'ВРТ',
        'защитник': 'ЗЩТ',
        'дефендер': 'ЗЩТ',
        'defender': 'ЗЩТ',
        'левый защитник': 'ЛЗ',
        'левый': 'ЛЗ',
        'правый защитник': 'ПЗ',
        'правый': 'ПЗ',
        'центральный защитник': 'ЦЗ',
        'центр защитник': 'ЦЗ',
        'полузащитник': 'ПЗЩ',
        'мидфилдер': 'ПЗЩ',
        'midfield': 'ПЗЩ',
        'опорный': 'ОПО',
        'опорный полузащитник': 'ОПО',
        'атакующий полузащитник': 'АПЗ',
        'левый полузащитник': 'ЛП',
        'левый вингер': 'ЛВ',
        'правый полузащитник': 'ПП',
        'правый вингер': 'ПВ',
        'центральный полузащитник': 'ЦП',
        'нападающий': 'НАП',
        'форвард': 'НАП',
        'forward': 'НАП',
        'страйкер': 'СТР',
        'striker': 'СТР',
        'центрфорвард': 'ЦФ',
        'вингер': 'ВНГ'
    };
    
    return positions[roleLower] || 'ЗАП';
},

    

    // Добавляет стили для списка игроков
    addRosterListStyles() {
        if (document.getElementById('roster-list-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'roster-list-styles';
        styles.textContent = `
            .players-list-simple {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .player-simple-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: var(--bg-hover);
                border-radius: var(--radius-md);
                animation: slideIn 0.3s ease forwards;
            }
            
            .player-simple-number {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: var(--gradient-green);
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: var(--font-display);
                font-size: 0.85rem;
                color: #000;
                flex-shrink: 0;
            }
            
            .player-simple-name {
                flex: 1;
                font-weight: 500;
                font-size: 0.95rem;
            }
            
            .captain-badge-small {
                background: var(--accent-gold);
                color: #000;
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 0.7rem;
                font-weight: 700;
            }
        `;
        document.head.appendChild(styles);
    },

    // Показывает детали игрока
    showPlayerDetail(playerId) {
        const player = this.currentTeam?.players?.find(p => p.id === playerId);
        if (!player) return;

        // Можно расширить - показать модальное окно с деталями игрока
        const info = [
            `Имя: ${player.name}`,
            player.number ? `Номер: ${player.number}` : '',
            player.role ? `Позиция: ${player.role}` : '',
            player.info ? `Инфо: ${player.info}` : '',
            player.is_captain ? '⭐ Капитан команды' : ''
        ].filter(Boolean).join('\n');

        alert(info);
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
                    <div class="history-match ${resultClass}" onclick="app.showMatchDetail('${match.id}')">
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
            basketball: 'Баскетбол',
            hockey: 'Хоккей',
            tabletennis: 'Настольный теннис'
        };
        return names[sport] || sport;
    }
};
