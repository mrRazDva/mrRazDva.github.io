const initModule = {
    app: null,
    
    cities: {
    kaluga: { name: 'Калуга', teams: 0, matches: 0, lat: 54.5293, lng: 36.2754 },
    moscow: { name: 'Москва', teams: 0, matches: 0, lat: 55.7558, lng: 37.6173 },
    obninsk: { name: 'Обнинск', teams: 0, matches: 0, lat: 55.0944, lng: 36.6122 }
},
    
    init(appInstance) {
    this.app = appInstance;
    this.app.cities = this.cities; // Делаем cities доступным в app
    this.renderCitySelection();
},
    
    async loadCityStats() {
        try {
            // Загружаем количество команд по городам
            const { data: teamsData, error: teamsError } = await this.app.supabase
                .from('teams')
                .select('city');
            
            if (teamsError) throw teamsError;
            
            // Загружаем количество предстоящих матчей по городам (status = 'upcoming')
            const { data: matchesData, error: matchesError } = await this.app.supabase
                .from('matches')
                .select('city, status')
                .eq('status', 'upcoming');
            
            if (matchesError) throw matchesError;
            
            // Считаем команды по городам
            const teamCounts = {};
            teamsData.forEach(team => {
                const city = team.city;
                if (this.cities[city]) {
                    teamCounts[city] = (teamCounts[city] || 0) + 1;
                }
            });
            
            // Считаем матчи по городам
            const matchCounts = {};
            matchesData.forEach(match => {
                const city = match.city;
                if (this.cities[city]) {
                    matchCounts[city] = (matchCounts[city] || 0) + 1;
                }
            });
            
            // Обновляем данные в cities
            Object.keys(this.cities).forEach(cityId => {
                this.cities[cityId].teams = teamCounts[cityId] || 0;
                this.cities[cityId].matches = matchCounts[cityId] || 0;
            });
            
            console.log('✅ Статистика городов загружена:', this.cities);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики городов:', error);
            // При ошибке оставляем нули - пользователь увидит "0 команд / 0 игр"
        }
    },
    
    async renderCitySelection() {
        // Показываем загрузку
        const container = document.getElementById('city-list');
        if (!container) return;
        
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Загрузка...</div>';
        
        // Загружаем реальные данные
        await this.loadCityStats();
        
        // Рендерим карточки городов
        container.innerHTML = Object.entries(this.cities).map(([id, city]) => `
            <button class="city-card" onclick="initModule.selectCity('${id}')">
                <div class="city-name">${city.name}</div>
                <div class="city-stats">
                    <span class="stat">
                        
                        ${city.teams} ${this.pluralizeTeams(city.teams)}
                    </span>
                    <span class="stat">
                       
                        ${city.matches} ${this.pluralizeMatches(city.matches)}
                    </span>
                </div>
            </button>
        `).join('');
    },
    
    // Склонение "команда"
    pluralizeTeams(count) {
        if (count === 1) return 'команда';
        if (count >= 2 && count <= 4) return 'команды';
        return 'команд';
    },
    
    // Склонение "игра"
    pluralizeMatches(count) {
        if (count === 1) return 'игра';
        if (count >= 2 && count <= 4) return 'игры';
        return 'игр';
    },
    
    selectCity(cityId) {
        this.app.currentCity = cityId;
        const cityName = this.cities[cityId].name;
        
        // Обновляем отображение города в шапке
        const cityNameEl = document.getElementById('current-city-name');
        if (cityNameEl) {
            cityNameEl.textContent = cityName;
        }
        
        // Сохраняем в localStorage для следующих сессий
        localStorage.setItem('selectedCity', cityId);
        
        // Показываем главный экран
        navigationModule.showMain();
    }
};

// Экспортируем глобально
window.initModule = initModule;