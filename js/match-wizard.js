// js/match-wizard.js - Онбординг создания матча
const matchWizardModule = {
    currentStep: 1,
    totalSteps: 4,
    
    // Данные формы
    formData: {
        teamId: null,
        teamData: null,
        format: null,
        roster: [], // ID выбранных игроков
        matchMode: 'open',
        opponentId: null,
        date: null,
        time: null,
        location: null,
        lat: null,
        lng: null
    },

    // Инициализация
    init() {
        this.bindEvents();
    },

    bindEvents() {
        // Слушаем изменения для обновления summary и кнопки
        document.getElementById('wizard-match-date')?.addEventListener('change', () => this.updateSummary());
        document.getElementById('wizard-match-time')?.addEventListener('change', () => this.updateSummary());
    },

    // ===== НАВИГАЦИЯ =====
    
    show() {
        this.reset();
        screenManager.show('screen-create-match-wizard');
        this.loadStep1();
    },

    reset() {
        this.currentStep = 1;
        this.formData = {
            teamId: null,
            teamData: null,
            format: null,
            roster: [],
            matchMode: 'open',
            opponentId: null,
            date: null,
            time: null,
            location: null,
            lat: null,
            lng: null
        };
        this.updateProgress();
        this.showStep(1);
    },

    nextStep() {
        if (!this.validateCurrentStep()) return;
        
        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.showStep(this.currentStep);
            this.loadStepData(this.currentStep);
        } else {
            this.createMatch();
        }
    },

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.showStep(this.currentStep);
        } else {
            // Выход из wizard
            navigationModule.showMain();
        }
    },

    showStep(stepNum) {
        // Скрываем все шаги
        document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
        // Показываем текущий
        document.getElementById(`step-${stepNum}`)?.classList.add('active');
        
        this.updateProgress();

        // Если перешли на шаг 4, обновляем состояние кнопки
        if (stepNum === 4) {
            this.updateStep4NextButton();
        }
    },

    updateProgress() {
        const percent = (this.currentStep / this.totalSteps) * 100;
        document.getElementById('wizard-progress-fill').style.width = `${percent}%`;
        
        // Обновляем точки
        document.querySelectorAll('.step-dot').forEach((dot, idx) => {
            const stepNum = idx + 1;
            dot.classList.remove('active', 'completed');
            if (stepNum < this.currentStep) dot.classList.add('completed');
            else if (stepNum === this.currentStep) dot.classList.add('active');
        });

        // Обновляем лейблы
        document.querySelectorAll('.step-labels span').forEach((label, idx) => {
            label.classList.toggle('active', idx + 1 === this.currentStep);
        });
    },

    // ===== ШАГ 1: ВЫБОР КОМАНДЫ =====

    async loadStep1() {
        const container = document.getElementById('wizard-teams-grid');
        const emptyState = document.getElementById('no-teams-state');
        
        container.innerHTML = '<div class="loading-skeleton"><div class="skeleton-card"></div><div class="skeleton-card"></div></div>';
        
        try {
            const userId = authModule.getUserId();
            const { data: teams, error } = await app.supabase
                .from('teams')
                .select('*')
                .eq('owner_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!teams || teams.length === 0) {
                container.classList.add('hidden');
                emptyState.classList.remove('hidden');
                return;
            }

            container.classList.remove('hidden');
            emptyState.classList.add('hidden');

            // Если одна команда — автовыбор
            if (teams.length === 1) {
                this.selectTeam(teams[0]);
            }

            container.innerHTML = teams.map(team => `
                <div class="team-select-card ${this.formData.teamId === team.id ? 'selected' : ''}" 
                     onclick="matchWizardModule.selectTeam(${JSON.stringify(team).replace(/"/g, '&quot;')})">
                    <div class="team-select-logo">
                        ${team.logo_url 
                            ? `<img src="${team.logo_url}" alt="${team.name}">`
                            : `<span class="emoji">${team.avatar || '⚽'}</span>`
                        }
                    </div>
                    <div class="team-select-info">
                        <div class="team-select-name">${team.name}</div>
                        <div class="team-select-meta">
                            ${app.cities[team.city]?.name || team.city}
                        </div>
                        <span class="team-select-sport">
                            <i class="fas fa-${app.getSportIcon(team.sport)}"></i>
                            ${app.getSportName(team.sport)}
                        </span>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('❌ Ошибка загрузки команд:', error);
            container.innerHTML = '<div class="error-state">Ошибка загрузки</div>';
        }
    },

    selectTeam(team) {
        this.formData.teamId = team.id;
        this.formData.teamData = team;
        
        // Обновляем UI выбора
        document.querySelectorAll('.team-select-card').forEach(card => {
            card.classList.toggle('selected', card.onclick.toString().includes(team.id));
        });

        // Автопереход если выбрали
        setTimeout(() => this.nextStep(), 300);
    },

    // ===== ШАГ 2: ВЫБОР ФОРМАТА =====

    loadStepData(stepNum) {
        if (stepNum === 2) this.loadStep2();
        if (stepNum === 3) this.loadStep3();
        if (stepNum === 4) this.loadStep4();
    },

    loadStep2() {
        const sport = this.formData.teamData?.sport || 'football';
        document.getElementById('format-sport-subtitle').textContent = app.getSportName(sport);
        
        // Форматы по спорту
        const formats = this.getFormatsForSport(sport);
        
        document.getElementById('format-cards').innerHTML = formats.map(f => `
            <div class="format-card ${this.formData.format === f.value ? 'selected' : ''}" 
                 onclick="matchWizardModule.selectFormat('${f.value}')">
                <div class="format-number">${f.players}</div>
                <div class="format-label">${f.label}</div>
            </div>
        `).join('');

        // Подсказка
        const hints = {
            football: '5 на 5 — самый популярный формат для мини-футбола',
            volleyball: '6 на 6 — классический формат волейбола',
            basketball: '3 на 3 — уличный баскетбол',
            hockey: '5 на 5 — стандарт для хоккея с шайбой',
            tabletennis: '1 на 1 или 2 на 2'
        };
        document.querySelector('#format-hint span').textContent = hints[sport] || 'Выберите подходящий формат';
    },

    getFormatsForSport(sport) {
        const map = {
            football: [
                { value: '3x3', players: '3', label: 'на 3' },
                { value: '5x5', players: '5', label: 'на 5' },
                { value: '7x7', players: '7', label: 'на 7' },
                { value: '11x11', players: '11', label: 'на 11' }
            ],
            volleyball: [
                { value: '2x2', players: '2', label: 'на 2 (пляжный)' },
                { value: '6x6', players: '6', label: 'на 6 (классика)' }
            ],
            basketball: [
                { value: '3x3', players: '3', label: 'на 3' },
                { value: '5x5', players: '5', label: 'на 5' }
            ],
            hockey: [
                { value: '3x3', players: '3', label: 'на 3' },
                { value: '5x5', players: '5', label: 'на 5' }
            ],
            tabletennis: [
                { value: '1x1', players: '1', label: 'одиночный' },
                { value: '2x2', players: '2', label: 'парный' }
            ]
        };
        return map[sport] || map.football;
    },

    selectFormat(format) {
        this.formData.format = format;
        
        document.querySelectorAll('.format-card').forEach(card => {
            card.classList.toggle('selected', card.onclick.toString().includes(format));
        });

        setTimeout(() => this.nextStep(), 300);
    },

    // ===== ШАГ 3: ВЫБОР СОСТАВА =====

async loadStep3() {
    // Сразу обновляем счетчики в шапке, используя уже имеющиеся данные
    const requiredPlayers = this.getRequiredPlayersCount(this.formData.format);
    const requiredSpan = document.getElementById('roster-required-count');
    if (requiredSpan) requiredSpan.textContent = requiredPlayers;
    const selectedSpan = document.getElementById('roster-selected-count');
    if (selectedSpan) selectedSpan.textContent = this.formData.roster.length;

    const container = document.getElementById('wizard-roster-container');
    
    // Загружаем игроков команды
    try {
        const { data: players, error } = await app.supabase
            .from('team_players')
            .select('*')
            .eq('team_id', this.formData.teamId)
            .order('number');

        if (error) throw error;

        // Рендерим используя стили match-roster.js, но адаптированно
        this.renderWizardRoster(players || []);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки состава:', error);
        container.innerHTML = '<div class="error-state">Ошибка загрузки состава</div>';
    }
},

renderWizardRoster(players) {
    const container = document.getElementById('wizard-roster-container');
    const requiredPlayers = this.getRequiredPlayersCount(this.formData.format);
    
    // Обновляем счетчик в шапке
    document.getElementById('roster-required-count').textContent = requiredPlayers;
    this.updateRosterCounter();

    if (players.length === 0) {
        container.innerHTML = `
            <div class="empty-roster-state">
                <div class="empty-icon-large">
                    <i class="fas fa-user-plus"></i>
                </div>
                <h3>В команде нет игроков</h3>
                <p>Добавьте игроков перед созданием матча</p>
                <button class="btn btn-primary" onclick="teamEditModule.show('${this.formData.teamId}')">
                    <i class="fas fa-users"></i> Управление командой
                </button>
            </div>
        `;
        return;
    }

    // Сортируем: капитан первый, затем по номеру
    const sortedPlayers = [...players].sort((a, b) => {
        if (a.is_captain && !b.is_captain) return -1;
        if (!a.is_captain && b.is_captain) return 1;
        return (a.number || 99) - (b.number || 99);
    });

    // Используем структуру как в match-roster.js
    container.innerHTML = `
        <div class="roster-requirements-card">
            <div class="requirements-header">
                <div class="format-badge-large">
                    <i class="fas fa-trophy"></i>
                    <span>Формат: ${this.formData.format.replace('x', ' на ')}</span>
                </div>
                <div class="player-requirement">
                    <i class="fas fa-users"></i>
                    <span>${requiredPlayers} игроков</span>
                </div>
            </div>
            
            <div class="progress-container">
                <div class="progress-bar" id="wizard-roster-progress" 
                     style="width: ${Math.min(100, (this.formData.roster.length / requiredPlayers) * 100)}%"></div>
                <div class="progress-text">
                    <span>Выбрано: <strong id="wizard-roster-count">${this.formData.roster.length}</strong> из <strong>${requiredPlayers}</strong></span>
                    <span class="progress-percent" id="wizard-roster-percent">
                        ${Math.round((this.formData.roster.length / requiredPlayers) * 100)}%
                    </span>
                </div>
            </div>
        </div>

        <div class="roster-grid-container">
            <h3 class="section-label">
                <i class="fas fa-list-ol"></i>
                Доступные игроки
                <span class="count-badge">${players.length}</span>
            </h3>
            
            <div class="roster-grid" id="wizard-roster-grid">
                ${sortedPlayers.map(player => this.renderPlayerCard(player)).join('')}
            </div>
        </div>

        <!-- Новый футер с кнопкой Далее -->
        <div class="roster-controls-footer">
            <button class="roster-next-btn" id="roster-next-btn" onclick="matchWizardModule.confirmRosterAndNext()" disabled>
                <span>Выбрано ${this.formData.roster.length} из ${requiredPlayers}</span>
                <i class="fas fa-arrow-right"></i>
            </button>
        </div>
    `;
    
    // Обновляем состояние кнопки
    this.updateRosterNextButton();
},

renderPlayerCard(player) {
    const isSelected = this.formData.roster.includes(player.id);
    const isCaptain = player.is_captain;
    
    let photoHTML = '';
    if (player.photo_url) {
        photoHTML = `<img src="${player.photo_url}" alt="${player.name}" class="player-photo">`;
    } else {
        const initial = player.name ? player.name.charAt(0).toUpperCase() : '?';
        photoHTML = `<div class="player-initial">${initial}</div>`;
    }

    const position = this.getPositionAbbreviation(player.role);

    return `
        <div class="roster-player-card ${isSelected ? 'selected' : ''} ${isCaptain ? 'captain' : ''}" 
             onclick="matchWizardModule.togglePlayer('${player.id}')"
             data-player-id="${player.id}">
            
            <div class="player-card-header">
                <div class="player-number-bubble">${player.number || '-'}</div>
                <div class="player-position-badge">${position}</div>
                <div class="selection-indicator">
                    <i class="fas fa-${isSelected ? 'check-circle' : 'circle'}"></i>
                </div>
            </div>
            
            <div class="player-photo-container">
                ${photoHTML}
                ${isCaptain ? '<div class="captain-corner-badge">C</div>' : ''}
            </div>
            
            <div class="player-info">
                <div class="player-name-truncate" title="${player.name}">${player.name}</div>
                <div class="player-role-small">${player.role || 'Игрок'}</div>
            </div>
            
            <div class="player-status">
                <span class="status-dot ${isSelected ? 'active' : ''}"></span>
                <span class="status-text">${isSelected ? 'В составе' : 'В запасе'}</span>
            </div>
        </div>
    `;
},

getPositionAbbreviation(role) {
    if (!role) return 'ИГР';
    const roleLower = role.toLowerCase();
    const positions = {
        'вратарь': 'ВРТ', 'голкипер': 'ВРТ',
        'защитник': 'ЗЩТ', 'дефендер': 'ЗЩТ',
        'полузащитник': 'ПЗЩ', 'мидфилдер': 'ПЗЩ',
        'нападающий': 'НАП', 'форвард': 'НАП',
        'связующий': 'СВ', 'сеттер': 'СВ',
        'центральный блокирующий': 'ЦБ', 'либеро': 'ЛИ',
        'разыгрывающий': 'РГ', 'атакующий защитник': 'АЗ'
    };
    for (const [key, value] of Object.entries(positions)) {
        if (roleLower.includes(key)) return value;
    }
    return 'ИГР';
},

getRequiredPlayersCount(format) {
    const [num] = format.split('x');
    return parseInt(num);
},

togglePlayer(playerId) {
    const requiredPlayers = this.getRequiredPlayersCount(this.formData.format);
    const index = this.formData.roster.indexOf(playerId);
    
    if (index === -1) {
        // Добавляем
        if (this.formData.roster.length >= requiredPlayers) {
            // Показываем тост "максимум"
            this.showMaxPlayersToast(requiredPlayers);
            return;
        }
        this.formData.roster.push(playerId);
    } else {
        // Удаляем
        this.formData.roster.splice(index, 1);
    }

    // Обновляем UI карточки
    const card = document.querySelector(`[data-player-id="${playerId}"]`);
    if (card) {
        const isSelected = index === -1; // Теперь выбран
        card.classList.toggle('selected', isSelected);
        card.querySelector('.selection-indicator i').className = `fas fa-${isSelected ? 'check-circle' : 'circle'}`;
        card.querySelector('.status-dot').classList.toggle('active', isSelected);
        card.querySelector('.status-text').textContent = isSelected ? 'В составе' : 'В запасе';
    }

    this.updateRosterCounter();
    this.updateRosterNextButton();
},

updateRosterCounter() {
    const requiredPlayers = this.getRequiredPlayersCount(this.formData.format);
    const selectedCount = this.formData.roster.length;
    
    // Прогресс-бар
    const progressBar = document.getElementById('wizard-roster-progress');
    const progressCount = document.getElementById('wizard-roster-count');
    const progressPercent = document.getElementById('wizard-roster-percent');
    
    if (progressBar) {
        progressBar.style.width = `${Math.min(100, (selectedCount / requiredPlayers) * 100)}%`;
    }
    if (progressCount) progressCount.textContent = selectedCount;
    if (progressPercent) progressPercent.textContent = `${Math.round((selectedCount / requiredPlayers) * 100)}%`;
    
    // Обновляем счетчик в шапке wizard
    const selectedCountSpan = document.getElementById('roster-selected-count');
    if (selectedCountSpan) {
        selectedCountSpan.textContent = selectedCount;
    }
    const headerCounterEl = document.querySelector('.roster-progress-mini');
    if (headerCounterEl) {
        const isReady = selectedCount >= requiredPlayers;
        headerCounterEl.classList.toggle('complete', isReady);
    }
},

// Новый метод: обновление кнопки Далее
updateRosterNextButton() {
    const requiredPlayers = this.getRequiredPlayersCount(this.formData.format);
    const selectedCount = this.formData.roster.length;
    const btn = document.getElementById('roster-next-btn');
    
    if (!btn) return;
    
    const isReady = selectedCount >= requiredPlayers;
    
    if (isReady) {
        btn.classList.add('active');
        btn.disabled = false;
        btn.innerHTML = `
            <span>Подтвердить состав</span>
            <i class="fas fa-arrow-right"></i>
        `;
    } else {
        btn.classList.remove('active');
        btn.disabled = true;
        btn.innerHTML = `
            <span>Выбрано ${selectedCount} из ${requiredPlayers}</span>
            <i class="fas fa-arrow-right"></i>
        `;
    }
},

// Новый метод: подтверждение состава и переход далее
confirmRosterAndNext() {
    const requiredPlayers = this.getRequiredPlayersCount(this.formData.format);
    
    if (this.formData.roster.length < requiredPlayers) {
        alert(`Выберите минимум ${requiredPlayers} игроков`);
        return;
    }
    
    this.nextStep();
},

showMaxPlayersToast(max) {
    // Можно добавить красивый toast вместо alert
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `
        <i class="fas fa-info-circle"></i>
        <span>Максимум ${max} игроков для формата ${this.formData.format}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
},

    // ===== ШАГ 4: ДЕТАЛИ =====

// Новый метод для привязки слушателей к полям шага 4
attachStep4Listeners() {
    const dateInput = document.getElementById('wizard-match-date');
    const timeInput = document.getElementById('wizard-match-time');
    
    if (dateInput && !dateInput.hasAttribute('data-listener-attached')) {
        dateInput.addEventListener('change', () => this.updateSummary());
        dateInput.setAttribute('data-listener-attached', 'true');
    }
    if (timeInput && !timeInput.hasAttribute('data-listener-attached')) {
        timeInput.addEventListener('change', () => this.updateSummary());
        timeInput.setAttribute('data-listener-attached', 'true');
    }
},

    loadStep4() {
    // Убираем значения по умолчанию — поля пустые
    document.getElementById('wizard-match-date').value = '';
    document.getElementById('wizard-match-time').value = '';
    
    // Привязываем слушатели (если ещё не привязаны)
    this.attachStep4Listeners();
    
    this.updateSummary();
    this.updateStep4NextButton(); // кнопка будет неактивной
},

    setTime(time) {
        document.getElementById('wizard-match-time').value = time;
        this.updateSummary();
    },

    setTomorrow() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('wizard-match-date').value = tomorrow.toISOString().split('T')[0];
        document.getElementById('wizard-match-time').value = '10:00';
        this.updateSummary();
    },

    openLocationPicker() {
        // Используем существующий mapModule
        mapModule.openMapForLocation();
        
        // Переопределяем callback
        const originalConfirm = mapModule.confirmLocation;
        mapModule.confirmLocation = () => {
            const name = document.getElementById('location-name')?.value || '';
            const address = document.getElementById('location-address')?.value || '';
            
            this.formData.location = name || address || 'Выбранная локация';
            
            // Берём координаты напрямую из mapModule.selectedCoords
            if (mapModule.selectedCoords) {
                this.formData.lat = mapModule.selectedCoords[0];
                this.formData.lng = mapModule.selectedCoords[1];
            }
            
            // Обновляем UI
            const locationText = document.getElementById('wizard-location-text');
            if (locationText) {
                locationText.innerHTML = `<span class="address">${this.formData.location}</span>`;
            }
            document.querySelector('.location-input-modern')?.classList.add('has-location');
            
            // Показываем превью карты
            const preview = document.getElementById('wizard-location-preview');
            if (preview) preview.classList.remove('hidden');
            
            // Инициализируем мини-карту, если есть координаты
            if (this.formData.lat && this.formData.lng) {
                ymaps.ready(() => {
                    const mapContainer = document.getElementById('wizard-map-thumb');
                    if (mapContainer) {
                        const map = new ymaps.Map(mapContainer, {
                            center: [this.formData.lat, this.formData.lng],
                            zoom: 15,
                            controls: []
                        });
                        map.geoObjects.add(new ymaps.Placemark([this.formData.lat, this.formData.lng]));
                    }
                });
            }
            
            // Закрываем палку и восстанавливаем оригинальный метод
            mapModule.closeLocationPicker();
            mapModule.confirmLocation = originalConfirm;
            
            this.updateSummary();
            this.updateStep4NextButton(); // обновляем кнопку после выбора локации
        };
    },

    updateSummary() {
        const date = document.getElementById('wizard-match-date')?.value;
        const time = document.getElementById('wizard-match-time')?.value;
        
        document.getElementById('summary-team').textContent = this.formData.teamData?.name || '-';
        document.getElementById('summary-format').textContent = this.formData.format?.replace('x', ' на ') || '-';
        document.getElementById('summary-roster').textContent = `${this.formData.roster.length} игроков`;
        document.getElementById('summary-datetime').textContent = (date && time) ? `${date} ${time}` : '-';
        
        this.updateStep4NextButton(); // обновляем кнопку при изменении даты/времени
    },

    // Новый метод: обновление кнопки на шаге 4
    updateStep4NextButton() {
    const btn = document.getElementById('step4-next-btn');
    if (!btn) return;

    const date = document.getElementById('wizard-match-date')?.value;
    const time = document.getElementById('wizard-match-time')?.value;
    
    const hasDateTime = date && time;
    const hasLocation = !!this.formData.location; // проверяем, выбрана ли локация

    const isReady = hasDateTime && hasLocation;

    if (isReady) {
        btn.classList.add('active');
        btn.disabled = false;
        btn.innerHTML = `
            <span>Создать матч</span>
            <i class="fas fa-check"></i>
        `;
    } else {
        btn.classList.remove('active');
        btn.disabled = true;
        
        // Формируем понятную подсказку
        let message = 'Заполните все поля';
        if (!hasDateTime) message = 'Укажите дату и время';
        else if (!hasLocation) message = 'Выберите место на карте';
        
        btn.innerHTML = `
            <span>${message}</span>
            <i class="fas fa-check"></i>
        `;
    }
},

    // ===== ВАЛИДАЦИЯ =====

    validateCurrentStep() {
        switch (this.currentStep) {
            case 1:
                if (!this.formData.teamId) {
                    alert('Выберите команду');
                    return false;
                }
                return true;
                
            case 2:
                if (!this.formData.format) {
                    alert('Выберите формат игры');
                    return false;
                }
                return true;
                
            case 3:
                const requiredPlayers = this.getRequiredPlayersCount(this.formData.format);
                if (this.formData.roster.length < requiredPlayers) {
                    alert(`Выберите минимум ${requiredPlayers} игроков`);
                    return false;
                }
                return true;
                
            case 4:
                const date = document.getElementById('wizard-match-date').value;
                const time = document.getElementById('wizard-match-time').value;
                
                if (!date || !time) {
                    alert('Укажите дату и время');
                    return false;
                }
                
                const matchDate = new Date(`${date}T${time}`);
                if (matchDate < new Date()) {
                    alert('Нельзя создать матч в прошлом');
                    return false;
                }
                
                if (!this.formData.location) {
                    // Не обязательно, но предупреждаем
                    if (!confirm('Локация не выбрана. Продолжить?')) return false;
                }
                
                this.formData.date = date;
                this.formData.time = time;
                return true;
                
            default:
                return true;
        }
    },

    // ===== СОЗДАНИЕ МАТЧА =====

    async createMatch() {
        // Сначала валидация (на случай, если кнопка активирована программно)
        if (!this.validateCurrentStep()) return;

        const btn = document.getElementById('step4-next-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создание...';

        try {
            const userId = authModule.getUserId();
            const datetime = `${this.formData.date}T${this.formData.time}`;
            
            // 1. Создаем матч
            const { data: match, error: matchError } = await app.supabase
                .from('matches')
                .insert([{
                    sport: this.formData.teamData.sport,
                    format: this.formData.format,
                    team1: this.formData.teamId,
                    team2: this.formData.matchMode === 'private' ? this.formData.opponentId : null,
                    date: datetime,
                    location: this.formData.location,
                    lat: this.formData.lat,
                    lng: this.formData.lng,
                    city: this.formData.teamData.city,
                    status: 'upcoming',
                    score: '0:0',
                    created_by: userId,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (matchError) throw matchError;

            // 2. Сохраняем состав в match_rosters
            if (this.formData.roster.length > 0) {
                const rosterData = this.formData.roster.map(playerId => ({
                    match_id: match.id,
                    team_id: this.formData.teamId,
                    player_id: playerId,
                    is_starting: true,
                    created_at: new Date().toISOString()
                }));

                const { error: rosterError } = await app.supabase
                    .from('match_rosters')
                    .insert(rosterData);

                if (rosterError) {
                    console.error('❌ Ошибка сохранения состава:', rosterError);
                    // Не критично, матч создан
                }
            }

            // 3. Показываем успех и переходим
            this.showSuccessAnimation(() => {
                navigationModule.showMain();
                // Открываем детали созданного матча
                matchesModule.showMatchDetail(match.id);
            });

        } catch (error) {
            console.error('❌ Ошибка создания матча:', error);
            alert('Ошибка создания матча: ' + error.message);
            btn.disabled = false;
            btn.innerHTML = 'Создать матч <i class="fas fa-check"></i>';
            // Возвращаем активное состояние, если данные ещё валидны
            this.updateStep4NextButton();
        }
    },

    showSuccessAnimation(callback) {
        // Можно добавить красивую анимацию успеха
        const container = document.querySelector('.wizard-container');
        container.innerHTML = `
            <div class="success-animation">
                <div class="success-circle">
                    <i class="fas fa-check"></i>
                </div>
                <h2>Матч создан!</h2>
                <p>Переходим к деталям...</p>
            </div>
        `;
        setTimeout(callback, 1500);
    }
};

// Экспортируем
window.matchWizardModule = matchWizardModule;