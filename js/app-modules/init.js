const initModule = {
    app: null,
    
    init(appInstance) {
        this.app = appInstance;
        return this.loadCities();
    },
    
    // Загрузка городов из Supabase
    async loadCities() {
        try {
            const { data, error } = await this.app.supabase
                .from('cities')
                .select('*')
                .order('name');
            
            if (error) throw error;
            
            if (!data || data.length === 0) {
                return this.createDefaultCities();
            }
            
            this.processCitiesData(data);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки городов:', error);
            this.createDefaultCities();
        }
    },
    
    // Создание базовых городов
    async createDefaultCities() {
        console.warn('Таблица городов пуста, создаем базовые города');
        
        const cities = [
            { id: 'moscow', name: 'Москва', lat: 55.7558, lng: 37.6173, stats: '12 площадок • 48 команд' },
            { id: 'kaluga', name: 'Калуга', lat: 54.5293, lng: 36.2754, stats: '5 площадок • 16 команд' },
            { id: 'obninsk', name: 'Обнинск', lat: 55.0968, lng: 36.6101, stats: '3 площадки • 12 команд' }
        ];
        
        this.processCitiesData(cities);
        
        // Пытаемся сохранить в базу
        try {
            await this.app.supabase
                .from('cities')
                .insert(cities)
                .select();
        } catch (error) {
            console.warn('Не удалось создать города в базе:', error);
        }
    },
    
    // Обработка данных городов
    processCitiesData(data) {
        this.app.cities = {};
        data.forEach(city => {
            this.app.cities[city.id] = {
                name: city.name,
                lat: city.lat || 55.7558,
                lng: city.lng || 37.6173,
                stats: city.stats || '0 площадок • 0 команд'
            };
        });
        
        this.renderCities();
    },
    
    // Отображение городов
    renderCities() {
        const container = document.getElementById('city-list');
        if (!container || !this.app.cities) return;
        
        container.innerHTML = '';
        Object.entries(this.app.cities).forEach(([id, city]) => {
            const card = document.createElement('button');
            card.className = 'city-card';
            card.onclick = () => this.selectCity(id);
            card.innerHTML = `
                <div>
                    <div class="city-name">${city.name}</div>
                    <div class="city-stats">${city.stats}</div>
                </div>
                <i class="fas fa-chevron-right" style="color: var(--accent-green);"></i>
            `;
            container.appendChild(card);
        });
    },
    
    // Выбор города
    selectCity(cityId) {
        this.app.currentCity = cityId;
        const cityName = this.app.cities[cityId]?.name || 'Город';
        
        document.querySelectorAll('#current-city-name').forEach(el => {
            el.textContent = cityName;
        });
        
        navigationModule.showMain();
    }
};