// js/app-modules/teams.js - Модуль работы с командами
const teamsModule = {
    app: null,
    
    init(appInstance) {
        this.app = appInstance;
    },
    
    // Отображение моих команд
    async renderMyTeams() {
        const container = document.getElementById('teams-list');
        if (!container) return;
        
        container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 20px;">Загрузка команд...</div>';
        
        try {
            const userId = authModule.getUserId();
            if (!userId) {
                throw new Error('Пользователь не авторизован');
            }
            
            const { data: teams, error } = await this.app.supabase
                .from('teams')
                .select(`
                    *,
                    players:team_players(*)
                `)
                .eq('owner_id', userId)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            container.innerHTML = '';
            
            if (!teams || teams.length === 0) {
                container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 40px;">У тебя пока нет команд</div>';
                return;
            }
            
            container.innerHTML = teams.map(team => {
                const playerCount = team.players?.length || 0;
                return `
                    <div class="team-manage-card" onclick="teamEditModule.show('${team.id}')">
                        <div class="team-avatar" style="width: 50px; height: 50px; font-size: 1.5rem; border-color: var(--accent-green);">
                            ${team.avatar || '⚽'}
                        </div>
                        <div class="team-info">
                            <div class="team-name">${team.name}</div>
                            <div class="team-stats">${team.wins || 0} побед • ${playerCount} игроков</div>
                        </div>
                        <i class="fas fa-chevron-right" style="color: var(--text-secondary);"></i>
                    </div>
                `;
            }).join('');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки команд:', error);
            container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 40px;">Ошибка загрузки команд</div>';
        }
    },
    
    // Создание команды
    async createTeam() {
        const name = document.getElementById('team-name').value;
        const avatar = document.getElementById('team-avatar').value || '⚽';
        const sport = document.getElementById('team-sport').value;
        
        if (!name) {
            alert('Введите название команды');
            return;
        }
        
        if (!authModule.isAuthenticated()) {
            alert('Сначала войдите в систему');
            return;
        }
        
        if (!authModule.hasRole('organizer')) {
            alert('Только организаторы могут создавать команды');
            return;
        }
        
        const userId = authModule.getUserId();
        if (!userId) {
            alert('Ошибка получения ID пользователя');
            return;
        }
        
        try {
            // Создаём команду в Supabase
            const { data: team, error } = await this.app.supabase
                .from('teams')
                .insert([{
                    name,
                    city: this.app.currentCity,
                    sport,
                    avatar,
                    owner_id: userId,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();
            
            if (error) throw error;
            
            // Создаём запись капитана в составе
            await this.app.supabase
                .from('team_players')
                .insert([{
                    team_id: team.id,
                    name: authModule.currentUser?.nickname || 'Капитан',
                    number: 10,
                    role: 'Капитан',
                    is_captain: true,
                    created_at: new Date().toISOString()
                }]);
            
            alert('Команда создана!');
            navigationModule.showTeams();
            
        } catch (error) {
            console.error('❌ Ошибка создания команды:', error);
            alert('Ошибка создания команды: ' + error.message);
        }
    },
    
    // Загрузка команд для выпадающего списка
    async loadTeamsForDropdown() {
        const userId = authModule.getUserId();
        if (!userId) return [];
        
        try {
            const { data: teams, error } = await this.app.supabase
                .from('teams')
                .select('*')
                .eq('owner_id', userId)
                .order('name');
            
            if (error) throw error;
            
            return teams || [];
        } catch (error) {
            console.error('❌ Ошибка загрузки команд:', error);
            return [];
        }
    }
};