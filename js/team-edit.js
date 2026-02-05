// team-edit.js - Полностью переработанный модуль редактирования команды
const teamEditModule = {
    currentTeam: null,
    editingPlayer: null,
    isSortMode: false,
    hasUnsavedChanges: false,
    originalTeamData: null,
    isSaving: false,
    pendingChanges: {
        logo: null
    },

    async show(teamId) {
        try {
            const { data: team, error } = await app.supabase
                .from('teams')
                .select(`*, players:team_players(*)`)
                .eq('id', teamId)
                .single();

            if (error) throw error;

            if (team.owner_id !== authModule.getUserId()) {
                alert('У вас нет прав на редактирование этой команды');
                return;
            }

            this.currentTeam = team;
            this.pendingChanges = { logo: null };
            this.isSortMode = false;
            this.hasUnsavedChanges = false;
            this.isSaving = false;
            
            // Сохраняем исходные данные для сравнения
            this.originalTeamData = {
                name: team.name,
                description: team.description || '',
                sport: team.sport,
                city: team.city
            };
            
            // Сортируем игроков
            if (team.players) {
                team.players.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            }
            
            this.render();
            screenManager.show('screen-team-edit');
            this.updateSaveButtons();
            
        } catch (error) {
            console.error('Ошибка загрузки команды:', error);
            alert('Ошибка загрузки команды');
        }
    },

    render() {
        if (!this.currentTeam) return;

        // Превью команды
        const logoImg = document.getElementById('preview-logo-img');
        const logoEmoji = document.getElementById('preview-logo-emoji');
        
        if (this.pendingChanges.logo || this.currentTeam.logo_url) {
            logoImg.src = this.pendingChanges.logo || this.currentTeam.logo_url;
            logoImg.classList.remove('hidden');
            logoEmoji.style.display = 'none';
        } else {
            logoImg.classList.add('hidden');
            logoEmoji.style.display = 'block';
            logoEmoji.textContent = this.currentTeam.avatar || '⚽';
        }

        document.getElementById('edit-team-name').value = this.currentTeam.name;
        
        // Meta chips
        const sportNames = { 
            football: 'Футбол', 
            volleyball: 'Волейбол', 
            basketball: 'Баскетбол', 
            hockey: 'Хоккей',
            tabletennis: 'Настольный теннис'
        };
        
        const sportChip = document.getElementById('edit-team-sport-chip');
        if (sportChip) {
            sportChip.querySelector('span').textContent = sportNames[this.currentTeam.sport] || this.currentTeam.sport;
        }
        
        const cityChip = document.getElementById('edit-team-city-chip');
        if (cityChip) {
            cityChip.querySelector('span').textContent = app.cities[this.currentTeam.city]?.name || this.currentTeam.city;
        }

        // Описание и контакты
        const descField = document.getElementById('edit-team-description');
        if (descField) {
            descField.value = this.currentTeam.description || '';
            descField.addEventListener('input', () => this.checkForChanges());
        }
        
        // Название команды
        const nameInput = document.getElementById('edit-team-name');
        if (nameInput) {
            nameInput.addEventListener('input', () => this.checkForChanges());
        }

        // Контакты
        const contactsField = document.getElementById('edit-team-contacts');
        if (contactsField) {
            contactsField.value = this.currentTeam.contacts || '';
            contactsField.addEventListener('input', () => this.checkForChanges());
        }
        
        // Счетчик символов
        this.updateCharCounter();

        // Проверка смены названия
        this.checkNameChangeAvailability();

        // Рендер состава
        this.renderRoster();

        // Сброс таба
        this.switchTab('roster');
        
        // Скрываем кнопки сохранения
        this.updateSaveButtons();
    },

    updateCharCounter() {
        const textarea = document.getElementById('edit-team-description');
        const counter = document.getElementById('desc-counter-edit');
        if (!textarea || !counter) return;
        
        counter.textContent = `${textarea.value.length}/500`;
        counter.style.color = textarea.value.length > 450 ? 'var(--accent-pink)' : 'var(--text-secondary)';
    },

    checkForChanges() {
        if (!this.currentTeam || !this.originalTeamData) return false;
        
        let hasChanges = false;
        
        // Проверяем изменения в основных полях
        const name = document.getElementById('edit-team-name')?.value || '';
        const description = document.getElementById('edit-team-description')?.value || '';
        const contacts = document.getElementById('edit-team-contacts')?.value || '';
        
        if (name !== this.originalTeamData.name) {
            hasChanges = true;
        }
        
        if (description !== this.originalTeamData.description) {
            hasChanges = true;
        }
        
        if (contacts !== (this.currentTeam.contacts || '')) {
            hasChanges = true;
        }
        
        // Проверяем изменения в логотипе
        if (this.pendingChanges.logo) {
            hasChanges = true;
        }
        
        this.hasUnsavedChanges = hasChanges;
        this.updateSaveButtons();
        
        return hasChanges;
    },

    updateSaveButtons() {
        const saveTopBtn = document.querySelector('.save-top-btn');
        const saveBottomBtn = document.querySelector('.btn-save-bottom');
        
        if (this.hasUnsavedChanges && !this.isSaving) {
            saveTopBtn?.classList.add('visible');
            saveBottomBtn?.classList.remove('hidden');
            saveBottomBtn?.classList.add('visible');
            
            if (saveBottomBtn) {
                saveBottomBtn.innerHTML = '<i class="fas fa-check"></i> Сохранить изменения';
                saveBottomBtn.disabled = false;
            }
        } else {
            saveTopBtn?.classList.remove('visible');
            saveBottomBtn?.classList.add('hidden');
            saveBottomBtn?.classList.remove('visible');
        }
    },

    async checkNameChangeAvailability() {
        const alert = document.getElementById('name-change-alert');
        const text = document.getElementById('name-change-text');
        const action = document.getElementById('name-change-action');
        
        if (!alert || !text || !action) return;
        
        alert.style.display = 'flex';
        
        try {
            const { data } = await app.supabase
                .from('team_name_changes')
                .select('changed_at')
                .eq('team_id', this.currentTeam.id)
                .order('changed_at', { ascending: false })
                .limit(1)
                .single();

            if (!data) {
                text.textContent = 'Бесплатная смена доступна (1 раз в год)';
                action.textContent = 'Изменить';
                action.onclick = () => this.handleNameChange(false);
            } else {
                const daysPassed = Math.floor((new Date() - new Date(data.changed_at)) / (1000 * 60 * 60 * 24));
                if (daysPassed > 365) {
                    text.textContent = 'Бесплатная смена доступна (прошел год)';
                    action.textContent = 'Изменить';
                    action.onclick = () => this.handleNameChange(false);
                } else {
                    const daysLeft = 365 - daysPassed;
                    text.textContent = `Следующая бесплатная смена через ${daysLeft} дней`;
                    action.textContent = 'Изменить за 299₽';
                    action.onclick = () => this.handleNameChange(true);
                }
            }
        } catch (e) {
            text.textContent = 'Бесплатная смена доступна';
            action.textContent = 'Изменить';
            action.onclick = () => this.handleNameChange(false);
        }
    },

    async handleNameChange(isPaid) {
        const newName = document.getElementById('edit-team-name').value.trim();
        if (!newName || newName === this.currentTeam.name) {
            alert('Введите новое название');
            return;
        }

        if (isPaid && !confirm('Смена названия стоит 299₽. Продолжить?')) return;

        try {
            const { error } = await app.supabase
                .from('teams')
                .update({ name: newName })
                .eq('id', this.currentTeam.id);

            if (error) throw error;

            this.currentTeam.name = newName;
            alert('Название изменено!');
            this.checkNameChangeAvailability();
            this.checkForChanges();
            
        } catch (error) {
            alert('Ошибка: ' + error.message);
        }
    },

    handleLogoChange(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('Файл слишком большой (макс. 5MB)');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.pendingChanges.logo = e.target.result;
            document.getElementById('preview-logo-img').src = e.target.result;
            document.getElementById('preview-logo-img').classList.remove('hidden');
            document.getElementById('preview-logo-emoji').style.display = 'none';
            this.checkForChanges();
        };
        reader.readAsDataURL(file);
    },

    switchTab(tabName) {
        document.querySelectorAll('.edit-tab').forEach(t => t.classList.remove('active'));
        const activeTab = document.querySelector(`.edit-tab[data-tab="${tabName}"]`);
        if (activeTab) activeTab.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        const activeContent = document.getElementById(`tab-${tabName}`);
        if (activeContent) activeContent.classList.add('active');
    },

    renderRoster() {
        const container = document.getElementById('edit-roster-list');
        const players = this.currentTeam?.players || [];
        const countBadge = document.getElementById('players-count');
        
        if (countBadge) countBadge.textContent = players.length;
        
        if (players.length === 0) {
            if (container) container.innerHTML = '';
            const emptyState = document.getElementById('empty-roster-state');
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }
        
        const emptyState = document.getElementById('empty-roster-state');
        if (emptyState) emptyState.classList.add('hidden');
        
        if (!container) return;
        
        container.innerHTML = players.map((player, index) => `
            <div class="player-card-modern ${player.is_captain ? 'captain' : ''}" 
                 data-id="${player.id}" 
                 draggable="${this.isSortMode}"
                 ondragstart="teamEditModule.handleDragStart(event, '${player.id}')"
                 ondragover="teamEditModule.handleDragOver(event)"
                 ondrop="teamEditModule.handleDrop(event, '${player.id}')"
                 ondragend="teamEditModule.handleDragEnd(event)">
                
                ${this.isSortMode ? '<div class="drag-handle"><i class="fas fa-grip-vertical"></i></div>' : ''}
                
                ${player.photo_url ? 
                    `<img src="${player.photo_url}" class="player-photo-thumb" alt="">` :
                    `<div class="player-number-circle">${player.number}</div>`
                }
                
                <div class="player-info-modern">
                    <div class="player-name-modern">${player.name}</div>
                    <div class="player-role-modern">${player.role || 'Игрок'}</div>
                    ${player.info ? `<div class="player-meta-modern">${player.info.substring(0, 50)}${player.info.length > 50 ? '...' : ''}</div>` : ''}
                </div>
                
                <div class="player-quick-actions">
                    <button class="quick-action-btn" onclick="teamEditModule.editPlayer('${player.id}')">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="quick-action-btn delete" onclick="teamEditModule.deletePlayer('${player.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    handleDragStart(e, playerId) {
        e.dataTransfer.setData('text/plain', playerId);
        e.target.classList.add('dragging');
    },

    handleDragOver(e) {
        e.preventDefault();
        const card = e.target.closest('.player-card-modern');
        if (card && !card.classList.contains('dragging')) {
            card.style.transform = 'translateY(5px)';
        }
    },

    handleDrop(e, targetId) {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId === targetId) return;
        
        const players = this.currentTeam.players;
        const draggedIdx = players.findIndex(p => p.id === draggedId);
        const targetIdx = players.findIndex(p => p.id === targetId);
        
        if (draggedIdx === -1 || targetIdx === -1) return;
        
        const [removed] = players.splice(draggedIdx, 1);
        players.splice(targetIdx, 0, removed);
        
        // Обновляем order_index
        players.forEach((p, i) => p.order_index = i);
        
        // Сохраняем порядок в базе
        this.savePlayerOrder();
        this.renderRoster();
    },

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.player-card-modern').forEach(card => {
            card.style.transform = '';
        });
    },

    async savePlayerOrder() {
        try {
            const updates = this.currentTeam.players.map((player, index) => ({
                id: player.id,
                order_index: index
            }));
            
            // Обновляем каждого игрока
            for (const update of updates) {
                const { error } = await app.supabase
                    .from('team_players')
                    .update({ order_index: update.order_index })
                    .eq('id', update.id);
                
                if (error) throw error;
            }
            
            console.log('✅ Порядок игроков сохранен');
        } catch (error) {
            console.error('❌ Ошибка сохранения порядка игроков:', error);
        }
    },

    toggleSortMode() {
        this.isSortMode = !this.isSortMode;
        const btn = document.querySelector('.icon-action-btn');
        if (btn) {
            btn.style.color = this.isSortMode ? 'var(--accent-green)' : '';
            btn.style.background = this.isSortMode ? 'rgba(0, 255, 136, 0.1)' : '';
        }
        this.renderRoster();
    },

    // ==================== ЭКРАН ИГРОКА ====================

    showAddPlayerForm() {
        this.editingPlayer = null;
        
        // Сбрасываем форму
        const titleEl = document.getElementById('player-screen-title');
        if (titleEl) titleEl.textContent = 'Новый игрок';
        
        const nameEl = document.getElementById('player-screen-name');
        if (nameEl) nameEl.value = '';
        
        const numberEl = document.getElementById('player-screen-number');
        if (numberEl) numberEl.value = '';
        
        const roleEl = document.getElementById('player-screen-role');
        if (roleEl) roleEl.value = '';
        
        const infoEl = document.getElementById('player-screen-info');
        if (infoEl) infoEl.value = '';
        
        const captainEl = document.getElementById('player-screen-captain');
        if (captainEl) captainEl.checked = false;
        
        // Сбрасываем фото
        const img = document.getElementById('player-screen-photo-img');
        const placeholder = document.getElementById('player-screen-photo-placeholder');
        
        if (img) {
            img.src = '';
            img.classList.add('hidden');
        }
        if (placeholder) placeholder.style.display = 'flex';
        
        // Скрываем кнопку удаления
        const deleteBtn = document.getElementById('delete-player-screen-btn');
        if (deleteBtn) deleteBtn.classList.add('hidden');
        
        // Показываем кнопку сохранения
        const saveBtn = document.querySelector('.btn-save-player');
        if (saveBtn) {
            saveBtn.classList.add('visible');
            saveBtn.disabled = false;
        }
        
        // Показываем экран
        screenManager.show('screen-edit-player');
    },

    async editPlayer(playerId) {
        const player = this.currentTeam.players.find(p => p.id === playerId);
        if (!player) return;
        
        this.editingPlayer = playerId;
        
        // Заполняем данные
        const titleEl = document.getElementById('player-screen-title');
        if (titleEl) titleEl.textContent = 'Редактировать игрока';
        
        const nameEl = document.getElementById('player-screen-name');
        if (nameEl) nameEl.value = player.name;
        
        const numberEl = document.getElementById('player-screen-number');
        if (numberEl) numberEl.value = player.number;
        
        const roleEl = document.getElementById('player-screen-role');
        if (roleEl) roleEl.value = player.role || '';
        
        const infoEl = document.getElementById('player-screen-info');
        if (infoEl) infoEl.value = player.info || '';
        
        const captainEl = document.getElementById('player-screen-captain');
        if (captainEl) captainEl.checked = player.is_captain || false;
        
        // Устанавливаем фото
        const img = document.getElementById('player-screen-photo-img');
        const placeholder = document.getElementById('player-screen-photo-placeholder');
        
        if (img && placeholder) {
            if (player.photo_url) {
                img.src = player.photo_url;
                img.classList.remove('hidden');
                placeholder.style.display = 'none';
            } else {
                img.classList.add('hidden');
                placeholder.style.display = 'flex';
            }
        }
        
        // Показываем кнопку удаления
        const deleteBtn = document.getElementById('delete-player-screen-btn');
        if (deleteBtn) deleteBtn.classList.remove('hidden');
        
        // Показываем кнопку сохранения
        const saveBtn = document.querySelector('.btn-save-player');
        if (saveBtn) {
            saveBtn.classList.add('visible');
            saveBtn.disabled = false;
        }
        
        // Показываем экран
        screenManager.show('screen-edit-player');
    },

    hidePlayerScreen() {
        screenManager.back();
    },

    handlePhotoUploadScreen(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (file.size > 2 * 1024 * 1024) {
            alert('Фото слишком большое (макс. 2MB)');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.getElementById('player-screen-photo-img');
            const placeholder = document.getElementById('player-screen-photo-placeholder');
            
            if (img) {
                img.src = e.target.result;
                img.classList.remove('hidden');
            }
            if (placeholder) placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    },

    async savePlayerFromScreen() {
        const nameEl = document.getElementById('player-screen-name');
        const numberEl = document.getElementById('player-screen-number');
        const roleEl = document.getElementById('player-screen-role');
        const infoEl = document.getElementById('player-screen-info');
        const captainEl = document.getElementById('player-screen-captain');
        
        const name = nameEl ? nameEl.value.trim() : '';
        const number = numberEl ? parseInt(numberEl.value) : NaN;
        const role = roleEl ? roleEl.value.trim() : '';
        const info = infoEl ? infoEl.value.trim() : '';
        const isCaptain = captainEl ? captainEl.checked : false;
        
        if (!name || !number) {
            alert('Заполните имя и номер игрока');
            return;
        }
        
        // Проверка уникальности номера
        const duplicate = this.currentTeam.players.find(p => 
            p.number === number && p.id !== this.editingPlayer
        );
        if (duplicate) {
            alert('Игрок с таким номером уже есть в команде');
            return;
        }
        
        // Показываем индикатор загрузки
        const saveBtn = document.querySelector('.btn-save-player');
        const originalText = saveBtn ? saveBtn.innerHTML : '';
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
            saveBtn.disabled = true;
        }
        
        try {
            // Получаем фото
            const img = document.getElementById('player-screen-photo-img');
            const hasPhoto = img && !img.classList.contains('hidden');
            const photoUrl = hasPhoto ? img.src : null;
            
            // Подготавливаем данные игрока
            const playerData = {
                team_id: this.currentTeam.id,
                name,
                number,
                role: role || 'Игрок',
                info: info || null,
                is_captain: isCaptain,
                order_index: this.currentTeam.players.length
            };
            
            // Если есть новое фото
            if (hasPhoto && photoUrl && photoUrl.startsWith('data:image/')) {
                // TODO: Загрузка фото в Supabase Storage
                // Пока сохраняем как data URL (временное решение)
                playerData.photo_url = photoUrl;
            }
            
            let playerId;
            
            if (this.editingPlayer) {
                // Обновляем существующего игрока
                if (isCaptain) {
                    // Снимаем флаг капитана с других игроков
                    await this.updateOtherCaptains(this.editingPlayer);
                }
                
                const { error } = await app.supabase
                    .from('team_players')
                    .update(playerData)
                    .eq('id', this.editingPlayer);
                
                if (error) throw error;
                
                playerId = this.editingPlayer;
                console.log('✅ Игрок обновлен в базе');
            } else {
                // Добавляем нового игрока
                if (isCaptain) {
                    // Снимаем флаг капитана с других игроков
                    await this.updateOtherCaptains();
                }
                
                const { data, error } = await app.supabase
                    .from('team_players')
                    .insert([playerData])
                    .select()
                    .single();
                
                if (error) throw error;
                
                playerId = data.id;
                console.log('✅ Игрок добавлен в базу');
            }
            
            // Обновляем локальные данные
            await this.updateLocalPlayerData(playerId, playerData, photoUrl);
            
            // Успешное сообщение
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-check"></i> Сохранено!';
                setTimeout(() => {
                    saveBtn.innerHTML = originalText;
                    saveBtn.disabled = false;
                }, 1000);
            }
            
            // Возвращаемся к редактированию команды
            setTimeout(() => {
                this.renderRoster();
                this.hidePlayerScreen();
            }, 500);
            
        } catch (error) {
            console.error('❌ Ошибка сохранения игрока:', error);
            alert('Ошибка сохранения: ' + error.message);
            if (saveBtn) {
                saveBtn.innerHTML = originalText;
                saveBtn.disabled = false;
            }
        }
    },

    async updateOtherCaptains(excludePlayerId = null) {
        try {
            let query = app.supabase
                .from('team_players')
                .update({ is_captain: false })
                .eq('team_id', this.currentTeam.id)
                .eq('is_captain', true);
            
            if (excludePlayerId) {
                query = query.neq('id', excludePlayerId);
            }
            
            const { error } = await query;
            
            if (error) throw error;
            
            // Обновляем локальные данные
            this.currentTeam.players.forEach(player => {
                if (player.id !== excludePlayerId) {
                    player.is_captain = false;
                }
            });
            
        } catch (error) {
            console.error('❌ Ошибка обновления капитанов:', error);
        }
    },

    async updateLocalPlayerData(playerId, playerData, photoUrl) {
        const idx = this.currentTeam.players.findIndex(p => p.id === playerId);
        
        if (idx !== -1) {
            // Обновляем существующего игрока
            this.currentTeam.players[idx] = {
                ...this.currentTeam.players[idx],
                ...playerData,
                photo_url: photoUrl || this.currentTeam.players[idx].photo_url
            };
        } else {
            // Добавляем нового игрока
            this.currentTeam.players.push({
                id: playerId,
                ...playerData,
                photo_url: photoUrl
            });
        }
    },

    async deletePlayerFromScreen() {
        if (!this.editingPlayer) return;
        
        const player = this.currentTeam.players.find(p => p.id === this.editingPlayer);
        if (!player) return;
        
        if (!confirm(`Удалить игрока "${player.name}" из команды?`)) {
            return;
        }
        
        await this.deletePlayer(this.editingPlayer);
        this.hidePlayerScreen();
    },

    async deletePlayer(playerId) {
        const player = this.currentTeam.players.find(p => p.id === playerId);
        if (!player) return;
        
        if (!confirm(`Удалить игрока "${player.name}" из команды?`)) {
            return;
        }
        
        try {
            // Удаляем из базы
            const { error } = await app.supabase
                .from('team_players')
                .delete()
                .eq('id', playerId);
            
            if (error) throw error;
            
            // Удаляем локально
            this.currentTeam.players = this.currentTeam.players.filter(p => p.id !== playerId);
            this.renderRoster();
            
            console.log('✅ Игрок удален');
            
        } catch (error) {
            console.error('❌ Ошибка удаления игрока:', error);
            alert('Ошибка удаления: ' + error.message);
        }
    },

    // ==================== СОХРАНЕНИЕ КОМАНДЫ ====================

    async saveAllChanges() {
    if (!this.hasUnsavedChanges) {
        alert('Нет изменений для сохранения');
        return;
    }
    
    if (this.isSaving) {
        alert('Сохранение уже выполняется...');
        return;
    }
    
    const btn = document.querySelector('.btn-save-bottom');
    const originalText = btn ? btn.innerHTML : 'Сохранить изменения';
    
    this.isSaving = true;
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
        btn.disabled = true;
    }
    
    try {
        // 1. Собираем обновленные данные команды
        const updates = {
            name: document.getElementById('edit-team-name')?.value || this.currentTeam.name,
            description: document.getElementById('edit-team-description')?.value || null,
            contacts: document.getElementById('edit-team-contacts')?.value || null
        };
        
        // 2. Если есть новый логотип, загружаем его
        if (this.pendingChanges.logo && this.pendingChanges.logo.startsWith('data:image/')) {
            try {
                // Генерируем уникальное имя файла
                const fileName = `team_logo_${this.currentTeam.id}_${Date.now()}.png`;
                
                // Извлекаем Base64 данные и MIME тип
                const matches = this.pendingChanges.logo.match(/^data:(.+);base64,(.+)$/);
                if (!matches) {
                    throw new Error('Неверный формат Data URL');
                }
                
                const mimeType = matches[1];
                const base64Data = matches[2];
                
                console.log('Загрузка логотипа:', fileName, 'MIME тип:', mimeType);
                
                // Декодируем Base64 в бинарные данные
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                // Используем прямой API-вызов через fetch
                const supabaseUrl = 'https://anqvyvtwqljqvldcljat.supabase.co'; // Ваш Supabase URL
                const storageUrl = `${supabaseUrl}/storage/v1/object/team-logos/${fileName}`;
                
                // Получаем токен доступа
                const { data: { session } } = await app.supabase.auth.getSession();
                const accessToken = session?.access_token;
                
                if (!accessToken) {
                    throw new Error('Пользователь не авторизован');
                }
                
                // Отправляем запрос на загрузку
                const response = await fetch(storageUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': mimeType,
                    },
                    body: bytes
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Ошибка загрузки:', errorData);
                    
                    // Если файл уже существует, пробуем через PUT (обновление)
                    if (response.status === 409) { // Conflict - файл уже существует
                        const putResponse = await fetch(storageUrl, {
                            method: 'PUT',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': mimeType,
                            },
                            body: bytes
                        });
                        
                        if (!putResponse.ok) {
                            const putErrorData = await putResponse.json();
                            throw new Error(`Не удалось обновить логотип: ${putErrorData.message || putErrorData.error}`);
                        }
                    } else {
                        throw new Error(`Ошибка загрузки: ${errorData.message || errorData.error}`);
                    }
                }
                
                // Получаем публичный URL
                const publicUrl = `${supabaseUrl}/storage/v1/object/public/team-logos/${fileName}`;
                
                updates.logo_url = publicUrl;
                console.log('Логотип загружен, URL:', publicUrl);
                
                // Удаляем старый логотип, если он существует
                if (this.currentTeam.logo_url) {
                    try {
                        const oldFileName = this.currentTeam.logo_url.split('/').pop();
                        if (oldFileName !== fileName) {
                            await app.supabase.storage
                                .from('team-logos')
                                .remove([oldFileName]);
                            console.log('Старый логотип удален:', oldFileName);
                        }
                    } catch (deleteError) {
                        console.warn('Не удалось удалить старый логотип:', deleteError);
                    }
                }
                
            } catch (uploadError) {
                console.error('Ошибка загрузки логотипа:', uploadError);
                alert('Не удалось загрузить логотип. Изменения сохранены, но логотип не обновлен.');
            }
        }
        
        // 3. Сохраняем в базу
        const { error } = await app.supabase
            .from('teams')
            .update(updates)
            .eq('id', this.currentTeam.id);
        
        if (error) throw error;
        
        // 4. Обновляем локальные данные
        Object.assign(this.currentTeam, updates);
        
        alert('Изменения сохранены!');
        
    } catch (error) {
        console.error('❌ Ошибка сохранения команды:', error);
        alert('Ошибка сохранения: ' + error.message);
        
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
        
        this.isSaving = false;
        return;
    } finally {
        this.isSaving = false;
    }
    
    // 5. Сбрасываем состояние
    this.hasUnsavedChanges = false;
    this.pendingChanges.logo = null;
    
    // 6. Обновляем исходные данные для сравнения
    this.originalTeamData = {
        name: this.currentTeam.name,
        description: this.currentTeam.description || '',
        sport: this.currentTeam.sport,
        city: this.currentTeam.city
    };
    
    // 7. Скрываем кнопки сохранения
    this.updateSaveButtons();
    
    // 8. Перезагружаем данные команды
    await this.show(this.currentTeam.id);
},

    async deleteTeam() {
        if (!confirm('Удалить команду?\n\nВсе данные будут безвозвратно удалены. Это действие нельзя отменить.')) {
            return;
        }
        
        try {
            // Удаляем игроков
            await app.supabase.from('team_players').delete().eq('team_id', this.currentTeam.id);
            
            // Удаляем команду
            await app.supabase.from('teams').delete().eq('id', this.currentTeam.id);
            
            alert('Команда удалена');
            
            if (navigationModule && navigationModule.showTeams) {
                navigationModule.showTeams();
            } else {
                screenManager.show('screen-teams');
            }
            
        } catch (error) {
            console.error('❌ Ошибка удаления команды:', error);
            alert('Ошибка удаления: ' + error.message);
        }
    },

    back() {
        if (navigationModule && navigationModule.showTeams) {
            navigationModule.showTeams();
        } else {
            screenManager.show('screen-teams');
        }
    }
};

// Инициализация слушателей при загрузке
document.addEventListener('DOMContentLoaded', () => {
    // Счетчик символов для описания
    const descTextarea = document.getElementById('edit-team-description');
    if (descTextarea) {
        descTextarea.addEventListener('input', () => {
            teamEditModule.updateCharCounter();
        });
    }
});