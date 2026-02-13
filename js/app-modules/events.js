// js/app-modules/events.js - Модуль работы с событиями (хаб)
const eventsModule = {
    app: null,
	topTeams: [],
topTeamsLimit: 3,
    
    init(appInstance) {
        this.app = appInstance;
    },
    
    // Рендер хаба
    async renderHub() {
        await this.renderHubEvents();
        await this.renderHubMatches();
        await this.renderHubRecommended();
        await this.renderHubSummary(); 
		await this.renderHubTopTeams();
    },
    async loadTopTeams() {
    try {
        const { data: teams, error } = await this.app.supabase
            .from('teams')
            .select('id, name, logo_url, elo_rating, wins, losses, sport')
            .eq('city', this.app.currentCity)
            .order('elo_rating', { ascending: false })
            .limit(5);

        if (error) throw error;
        this.topTeams = teams || [];
    } catch (error) {
        console.error('❌ Ошибка загрузки топа команд:', error);
        this.topTeams = [];
    }
},

showMoreTopTeams() {
    this.topTeamsLimit = this.topTeams.length; // или 5, но так универсальнее
    this.renderHubTopTeams();
},


    // События в хабе
    async renderHubEvents() {
        const container = document.getElementById('hub-events-list');
        if (!container) return;
        
        try {
            const { data: events, error } = await this.app.supabase
                .from('events')
                .select('*')
                .eq('city', this.app.currentCity)
                .gte('date', new Date().toISOString())
                .order('date', { ascending: true })
                .limit(5);
            
            if (error) throw error;
            
            if (!events || events.length === 0) {
                container.innerHTML = '<div class="empty-state">Нет событий на ближайшие дни</div>';
                return;
            }
            
            container.innerHTML = events.map(event => `
                <div class="hub-card event-card" onclick="eventsModule.showEventDetail('${event.id}')" style="--event-color: ${event.color || '#00ff88'}">
                    <div class="hub-card-icon" style="background: ${event.color || '#00ff88'}20; color: ${event.color || '#00ff88'}">
                        ${event.icon || '🎯'}
                    </div>
                    <div class="hub-card-content">
                        <div class="hub-card-header">
                            <span class="hub-card-type">${this.app.getEventTypeName(event.type)}</span>
                            <span class="hub-card-price">${event.price || 'Бесплатно'}</span>
                        </div>
                        <h4 class="hub-card-title">${event.title}</h4>
                        <p class="hub-card-desc">${event.description}</p>
                        <div class="hub-card-meta">
                            <span><i class="far fa-clock"></i> ${this.app.formatDateTime(event.date)}</span>
                            <span><i class="fas fa-map-marker-alt"></i> ${event.location}</span>
                        </div>
                    </div>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки событий:', error);
            container.innerHTML = '<div class="empty-state">Ошибка загрузки событий</div>';
        }
    },
    
    // Матчи в хабе
    async renderHubMatches() {
        const container = document.getElementById('hub-matches-list');
        if (!container) return;
        
        try {
            const now = new Date();
            const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            
            const { data: weekMatches, error } = await this.app.supabase
                .from('matches')
                .select(`
                    *,
                    team1:teams!matches_team1_fkey(*),
                    team2:teams!matches_team2_fkey(*)
                `)
                .eq('city', this.app.currentCity)
                .eq('status', 'upcoming')
                .gte('date', now.toISOString())
                .lte('date', nextWeek.toISOString())
                .order('date', { ascending: true })
                .limit(3);
            
            if (error) throw error;
            
            if (!weekMatches || weekMatches.length === 0) {
                container.innerHTML = '<div class="empty-state">Нет предстоящих матчей на этой неделе</div>';
                return;
            }
            
            container.innerHTML = weekMatches.map(match => {
                const t1 = match.team1;
                const t2 = match.team2;
                return `
                    <div class="hub-card match-card-compact" onclick="matchesModule.showMatchDetail('${match.id}')">
                        <div class="hub-match-teams">
                            <div class="hub-team">
                                <span class="hub-team-avatar">${t1?.avatar || '?'}</span>
                                <span class="hub-team-name">${t1?.name || 'TBD'}</span>
                            </div>
                            <span class="hub-vs">VS</span>
                            <div class="hub-team">
                                <span class="hub-team-avatar">${t2?.avatar || '?'}</span>
                                <span class="hub-team-name">${t2?.name || 'TBD'}</span>
                            </div>
                        </div>
                        <div class="hub-match-info">
                            <span class="hub-match-time"><i class="far fa-clock"></i> ${this.app.formatDateTime(match.date)}</span>
                            <span class="hub-match-location"><i class="fas fa-map-marker-alt"></i> ${match.location || 'Стадион'}</span>
                        </div>
                    </div>
                `;
            }).join('');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки матчей:', error);
            container.innerHTML = '<div class="empty-state">Ошибка загрузки матчей</div>';
        }
    },
    
    // Рекомендации в хабе
    async renderHubRecommended() {
        const container = document.getElementById('hub-recommended-list');
        if (!container) return;
        
        try {
            const { data: popularEvents, error } = await this.app.supabase
                .from('events')
                .select('*')
                .eq('city', this.app.currentCity)
                .gte('date', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(2);
            
            if (error) throw error;
            
            if (!popularEvents || popularEvents.length === 0) {
                container.innerHTML = '<div class="empty-state">Нет рекомендаций</div>';
                return;
            }
            
            container.innerHTML = popularEvents.map(event => `
                <div class="hub-card recommendation-card" onclick="eventsModule.showEventDetail('${event.id}')">
                    <div class="hub-rec-icon" style="background: ${event.color || '#00ccff'}20; color: ${event.color || '#00ccff'}">
                        ${event.icon || '⭐'}
                    </div>
                    <div class="hub-rec-content">
                        <h4>${event.title}</h4>
                        <p>${event.description ? (event.description.substring(0, 60) + '...') : 'Нет описания'}</p>
                    </div>
                    <button class="btn btn-small btn-secondary">Подробнее</button>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки рекомендаций:', error);
            container.innerHTML = '<div class="empty-state">Ошибка загрузки рекомендаций</div>';
        }
    },
    
    // НОВЫЙ МЕТОД: Сводка завершённых матчей за месяц
    async renderHubSummary() {
        const container = document.getElementById('hub-summary-list');
        if (!container) return;
        
        try {
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            
            const { data: finishedMatches, error } = await this.app.supabase
                .from('matches')
                .select(`
                    *,
                    team1:teams!matches_team1_fkey(name),
                    team2:teams!matches_team2_fkey(name)
                `)
                .eq('status', 'finished')
                .gte('date', oneMonthAgo.toISOString())
                .order('date', { ascending: false })
                .limit(5);
            
            if (error) throw error;
            
            if (!finishedMatches || finishedMatches.length === 0) {
                container.innerHTML = '<div class="empty-state">Нет завершённых матчей за последний месяц</div>';
                return;
            }
            
            container.innerHTML = finishedMatches.map(match => {
                const scoreParts = (match.score || '0:0').split(':');
                const score1 = parseInt(scoreParts[0]) || 0;
                const score2 = parseInt(scoreParts[1]) || 0;
                
                const team1 = match.team1;
                const team2 = match.team2;
                
                let type = 'regular';
                let winnerName = null, loserName = null;
                
                if (score1 > score2) {
                    winnerName = team1?.name || 'Команда 1';
                    loserName = team2?.name || 'Команда 2';
                    if (this.isBigWin(score1, score2, match.sport)) type = 'rout';
                } else if (score2 > score1) {
                    winnerName = team2?.name || 'Команда 2';
                    loserName = team1?.name || 'Команда 1';
                    if (this.isBigWin(score2, score1, match.sport)) type = 'rout';
                } else {
                    type = 'draw';
                }
                
                const scoreText = `${score1}:${score2}`;
                let message = '';
                
                if (type === 'draw') {
                    message = this.generateDrawMessage(
                        team1?.name || 'Команда 1',
                        team2?.name || 'Команда 2',
                        scoreText,
                        match.sport
                    );
                } else if (type === 'rout') {
                    message = this.generateRoutMessage(
                        winnerName,
                        loserName,
                        scoreText,
                        match.sport
                    );
                } else {
                    message = this.generateWinMessage(
                        winnerName,
                        loserName,
                        scoreText,
                        match.sport
                    );
                }
                
                return `
    <div class="newspaper-clip" onclick="matchesModule.showMatchDetail('${match.id}')">
        <div class="newspaper-icon">
            <i class="fas fa-${this.app.getSportIcon(match.sport)}"></i>
        </div>
        <div class="newspaper-content">
            <p class="newspaper-text">${message}</p>
            <div class="newspaper-date">
                <i class="far fa-clock"></i> ${this.app.formatTimeAgo(match.date)}
            </div>
        </div>
        <span class="newspaper-tag">${this.app.getSportName(match.sport)}</span>
    </div>
`;
            }).join('');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки сводки матчей:', error);
            container.innerHTML = '<div class="empty-state">Ошибка загрузки сводки</div>';
        }
    },
    
    // Вспомогательные методы для анализа и генерации сообщений
    
    isBigWin(winnerScore, loserScore, sport) {
        const diff = winnerScore - loserScore;
        switch(sport) {
            case 'football':
            case 'hockey':
                return diff >= 3;
            case 'basketball':
                return diff >= 20;
            case 'volleyball':
                return diff >= 10;
            case 'tabletennis':
                return diff >= 5;
            default:
                return diff >= 5;
        }
    },
    
    generateDrawMessage(team1, team2, score, sport) {
        const templates = {
            football: [
                '{team1} и {team2} разошлись миром – {score}. Боевая ничья!',
                'Ничья {score} в матче {team1} – {team2}. Очки поделены.',
                '{team1} и {team2} сыграли вничью {score}. Голкиперы в ударе!',
                'Матч {team1} – {team2} завершился со счётом {score}. Мир? Дружба?',
                '{score} – боевая ничья между {team1} и {team2}.',
                '{team1} и {team2} не выявили сильнейшего – {score}.',
                'Ничья {score}! {team1} и {team2} остались при своих.',
                '{team1} – {team2} {score}. Футбольное равновесие.',
                'Голевая перестрелка закончилась миром – {score}.',
                '{team1} и {team2} поделили очки: {score}.',
            ],
            basketball: [
                'Баскетбольное противостояние {team1} и {team2} завершилось ничьей {score}! Овертайм?',
                '{score} – ничья в матче {team1} – {team2}. Судьи в шоке.',
                '{team1} и {team2} набрали поровну – {score}. Редкий случай в баскетболе!',
                'Ничья {score}! {team1} и {team2} не смогли выявить победителя.',
                'Баскетбольные качели: {team1} – {team2} {score}. Мир?',
                'Ничейный исход {score} в матче {team1} – {team2}.',
                '{team1} и {team2} обменялись попаданиями – итог {score}.',
                'В баскетболе ничья – редкость, но {team1} и {team2} это сделали – {score}.',
                '{score} – равная игра между {team1} и {team2}.',
                'Ничья {score}! Команды не пожалели колец.',
            ],
            volleyball: [
                'Волейбольная битва {team1} и {team2} – ничья {score}. Сетка в напряжении!',
                '{team1} и {team2} сыграли вничью {score}. Кто следующий подаёт?',
                'Ничья {score} в матче {team1} – {team2}. Очки поровну.',
                '{team1} – {team2} {score}. Боевая ничья на сетке.',
                'Волейбольные страсти: {team1} и {team2} разошлись миром – {score}.',
                'Ничья {score}! Команды показали характер.',
                '{team1} и {team2} не уступили друг другу – {score}.',
                'Равная игра завершилась ничьей {score}.',
                '{team1} – {team2} {score}. Мир в волейболе.',
            ],
            hockey: [
                'Хоккейная ничья {score} между {team1} и {team2}. Буллитов не будет!',
                '{team1} и {team2} разошлись миром – {score}. Вратари – герои.',
                'Ничья {score} в ледовом противостоянии {team1} – {team2}.',
                '{team1} – {team2} {score}. Овертайм не помог.',
                'Ничья {score}! Шайбы поровну.',
                '{team1} и {team2} поделили очки – {score}.',
                'Хоккейная битва завершилась миром – {score}.',
                'Ничья {score} – вратари в ударе.',
            ],
            tabletennis: [
                'Настольный теннис: {team1} и {team2} сыграли вничью {score}. Розыгрыши зашкаливали!',
                'Ничья {score} в матче {team1} – {team2}. Счёт как качели.',
                '{team1} и {team2} поделили очки – {score}.',
                'Ничья {score}! Партии летали со скоростью света.',
                '{team1} – {team2} {score}. Боевая ничья на столе.',
                'В настольном теннисе ничья – редкость, но {score} случился.',
            ],
            default: [
                '{team1} и {team2} сыграли вничью – {score}.',
                'Ничья {score} в матче {team1} – {team2}.',
                '{team1} и {team2} разошлись миром – {score}.',
                'Боевая ничья {score} между {team1} и {team2}!',
            ]
        };
        
			const sportTemplates = templates[sport] || templates.default;
			const template = sportTemplates[Math.floor(Math.random() * sportTemplates.length)];
         return template
        .replace(/{team1}/g, team1 || 'Команда 1')
        .replace(/{team2}/g, team2 || 'Команда 2')
        .replace(/{score}/g, score || '0:0');
},
    
    generateRoutMessage(winner, loser, score, sport) {
        const templates = {
            football: [
                '{winner} разгромил {loser} – {score}! Это было мощно!',
                'Сокрушительная победа {winner} над {loser} – {score}.',
                '{winner} уничтожил {loser} со счётом {score}. Болельщики в восторге!',
                '{winner} не оставил шансов {loser} – {score}.',
                '{winner} устроил разгром: {score} в матче с {loser}.',
                'Футбольное избиение: {winner} – {loser} {score}.',
                '{winner} накидал {loser} {score}. Голевой пир!',
                '{loser} ничего не смог противопоставить {winner} – {score}.',
                'Разгром! {winner} забил {score} в ворота {loser}.',
                '{winner} показал класс, обыграв {loser} со счётом {score}.',
            ],
            basketball: [
                '{winner} устроил баскетбольное шоу, набрав {score} против {loser}!',
                'Разгром в баскетболе: {winner} – {loser} {score}.',
                '{winner} не оставил шансов {loser} – {score} на табло.',
                'Баскетбольная феерия от {winner} – {score} в матче с {loser}.',
                '{winner} перебросал {loser} {score}. Дабл‑дабл в удовольствие!',
                '{winner} разорвал {loser} – {score}.',
                '{winner} накидал трёшек {loser} – итог {score}.',
                '{loser} не справился с натиском {winner} – {score}.',
                'Разгромное {score} в пользу {winner}.',
                '{winner} уничтожил {loser} на паркете – {score}.',
            ],
            volleyball: [
                '{winner} разгромил {loser} в волейбол – {score}!',
                'Сетка дрожала: {winner} – {loser} {score}.',
                '{winner} не оставил шансов {loser} – {score}.',
                'Волейбольный разгром: {winner} – {loser} {score}.',
                '{winner} доминировал над {loser} – {score}.',
            ],
            hockey: [
                '{winner} разгромил {loser} на льду – {score}!',
                'Хоккейное избиение: {winner} – {loser} {score}.',
                '{winner} забил {score} в ворота {loser}.',
                'Шайбы посыпались: {winner} – {loser} {score}.',
                '{winner} не оставил мокрого места от {loser} – {score}.',
            ],
            tabletennis: [
                '{winner} разгромил {loser} в настольный теннис – {score}!',
                '{winner} – {loser} {score}. Соперник не успевал за мячом.',
                'Разгром {score} в пользу {winner}.',
                '{winner} показал мастер-класс, обыграв {loser} – {score}.',
            ],
            default: [
                '{winner} разгромил {loser} со счётом {score}!',
                'Разгром! {winner} – {loser} {score}.',
                '{winner} не оставил шансов {loser} – {score}.',
                'Сокрушительная победа {winner} над {loser} – {score}.',
            ]
        };
        
        const sportTemplates = templates[sport] || templates.default;
        const template = sportTemplates[Math.floor(Math.random() * sportTemplates.length)];
        return template
            .replace('{winner}', winner)
            .replace('{loser}', loser)
            .replace('{score}', score);
    },
    
    generateWinMessage(winner, loser, score, sport) {
        const templates = {
            football: [
                '{winner} обыграл {loser} со счётом {score}. Упорная борьба!',
                '{winner} оказался сильнее {loser} – {score}.',
                'В матче {winner} – {loser} победа досталась хозяевам – {score}.',
                '{winner} вырвал победу у {loser} – {score}.',
                '{winner} победил {loser} – {score}. Хорошая игра!',
                'Минимальная победа {winner} над {loser} – {score}.',
                '{winner} дожал {loser} в концовке – {score}.',
                '{winner} – {loser} {score}. Три очка уходят к {winner}.',
                '{winner} переиграл {loser} со счётом {score}.',
                '{winner} взял верх над {loser} – {score}.',
            ],
            basketball: [
                '{winner} переиграл {loser} – {score}. Хороший матч!',
                '{winner} оказался сильнее {loser} – {score}.',
                'Победа {winner} над {loser} – {score}.',
                '{winner} – {loser} {score}. Команды настреляли кучу очков.',
                '{winner} вырвал победу у {loser} – {score}.',
            ],
            volleyball: [
                '{winner} победил {loser} в трёх партиях – {score}.',
                '{winner} – {loser} {score}. Красивая игра!',
                '{winner} оказался сильнее {loser} – {score}.',
                'Победа {winner} над {loser} – {score}.',
            ],
            hockey: [
                '{winner} обыграл {loser} – {score}. Хоккей высшего уровня!',
                '{winner} – {loser} {score}. Шайбы летели в ворота.',
                '{winner} победил {loser} – {score}.',
                '{winner} вырвал победу у {loser} – {score}.',
            ],
            tabletennis: [
                '{winner} обыграл {loser} – {score}. Накал страстей!',
                '{winner} – {loser} {score}. Розыгрыши завораживали.',
                '{winner} победил {loser} – {score}.',
            ],
            default: [
                '{winner} обыграл {loser} со счётом {score}.',
                '{winner} победил {loser} – {score}.',
                'Победа {winner} над {loser} – {score}.',
                '{winner} – {loser} {score}.',
            ]
        };
        
        const sportTemplates = templates[sport] || templates.default;
    const template = sportTemplates[Math.floor(Math.random() * sportTemplates.length)];
    
    return template
        .replace(/{winner}/g, winner || 'Победитель')
        .replace(/{loser}/g, loser || 'Проигравший')
        .replace(/{score}/g, score || '0:0');
},
    
    // Фильтрация в хабе
    async filterHub(type) {
        this.app.currentHubFilter = type;
        
        document.querySelectorAll('.hub-filter').forEach(btn => {
            btn.classList.toggle('active', btn.textContent.toLowerCase().includes(
                type === 'all' ? 'всё' : 
                type === 'events' ? 'события' :
                type === 'matches' ? 'матчи' : 'тренировки'
            ));
        });
        
        await this.renderHub();
    },
    
    // Показать детали события
    async showEventDetail(eventId) {
        try {
            const { data: event, error } = await this.app.supabase
                .from('events')
                .select('*')
                .eq('id', eventId)
                .single();
            
            if (error) throw error;
            
            alert(`${event.title}\n\n${event.description || 'Нет описания'}\n\n📍 ${event.location}\n🕐 ${this.app.formatDateTime(event.date)}\n💰 ${event.price || 'Бесплатно'}`);
        } catch (error) {
            console.error('❌ Ошибка загрузки события:', error);
            alert('Ошибка загрузки события');
        }
    },
	


async renderHubTopTeams() {
    const container = document.getElementById('hub-top-teams-list');
    if (!container) return;

    await this.loadTopTeams();

    if (this.topTeams.length === 0) {
        container.innerHTML = '<div class="empty-state">В вашем городе пока нет команд</div>';
        const btn = document.getElementById('show-more-teams-btn');
        if (btn) btn.classList.add('hidden');
        return;
    }

    const teamsToShow = this.topTeams.slice(0, this.topTeamsLimit);
    container.innerHTML = teamsToShow.map((team, index) => {
    const winLoss = `${team.wins || 0} / ${team.losses || 0}`;
    const medalEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
    return `
        <div class="top-team-card" onclick="app.showTeamWithMatchRoster('${team.id}')">
            <div class="top-team-rank">${medalEmoji || (index + 1)}</div>
            <div class="top-team-avatar" style="background: var(--bg-secondary);">
                ${team.logo_url ? `<img src="${team.logo_url}" alt="${team.name}">` : 
                                  `<span>${team.name.charAt(0).toUpperCase()}</span>`}
            </div>
            <div class="top-team-info">
                <div class="top-team-name">${team.name}</div>
                <div class="top-team-meta">
                    <span class="top-team-sport">
                        <i class="fas fa-${this.app.getSportIcon(team.sport)}"></i>
                        ${this.app.getSportName(team.sport)}
                    </span>
                    <span class="top-team-wl">W/L: ${winLoss}</span>
                </div>
            </div>
            <div class="top-team-rating">
                <span class="rating-value">${team.elo_rating}</span>
                <span class="rating-label">ELO</span>
            </div>
        </div>
    `;
}).join('');

    const btn = document.getElementById('show-more-teams-btn');
    if (btn) {
        if (this.topTeams.length <= 3 || this.topTeamsLimit >= this.topTeams.length) {
            btn.classList.add('hidden');
        } else {
            btn.classList.remove('hidden');
            btn.textContent = `Показать ещё ${this.topTeams.length - this.topTeamsLimit}`;
        }
    }
}
	
};

// Экспортируем глобально
window.eventsModule = eventsModule;