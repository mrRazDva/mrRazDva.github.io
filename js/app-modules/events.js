// js/app-modules/events.js - Модуль работы с событиями (хаб)
const eventsModule = {
    app: null,
    
    init(appInstance) {
        this.app = appInstance;
    },
    
    // Рендер хаба
    async renderHub() {
        await this.renderHubEvents();
        await this.renderHubMatches();
        await this.renderHubRecommended();
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
    }
};