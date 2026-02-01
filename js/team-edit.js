// team-edit.js - Полностью переработанный модуль редактирования команды
const teamEditModule = {
    currentTeam: null,
    editingPlayer: null,
    isSortMode: false,
    pendingChanges: {
        players: [],
        deletedPlayers: [],
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
            this.pendingChanges = { players: [], deletedPlayers: [], logo: null };
            this.isSortMode = false;
            
            // Сортируем игроков по order_index
            if (team.players) {
                team.players.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            }
            
            this.render();
            screenManager.show('screen-team-edit');
            
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
        if (descField) descField.value = this.currentTeam.description || '';
        
        const contactsField = document.getElementById('edit-team-contacts');
        if (contactsField) contactsField.value = this.currentTeam.contacts || '';
        
        // Счетчик символов
        this.updateCharCounter();

        // Проверка смены названия
        this.checkNameChangeAvailability();

        // Рендер состава
        this.renderRoster();

        // Сброс таба
        this.switchTab('roster');
    },

    updateCharCounter() {
        const textarea = document.getElementById('edit-team-description');
        const counter = document.getElementById('desc-counter-edit');
        if (!textarea || !counter) return;
        
        counter.textContent = `${textarea.value.length}/500`;
        counter.style.color = textarea.value.length > 450 ? 'var(--accent-pink)' : 'var(--text-secondary)';
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

    // Drag and Drop
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
        
        this.renderRoster();
    },

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.player-card-modern').forEach(card => {
            card.style.transform = '';
        });
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
        
        // Показываем экран
        screenManager.show('screen-edit-player');
    },

    editPlayer(playerId) {
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

    savePlayerFromScreen() {
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
        
        // Если назначаем капитаном, снимаем с других
        if (isCaptain) {
            this.currentTeam.players.forEach(p => p.is_captain = false);
        }
        
        const img = document.getElementById('player-screen-photo-img');
        const photoUrl = img ? img.src : '';
        const hasPhoto = img && !img.classList.contains('hidden');
        
        if (this.editingPlayer) {
            // Обновляем существующего
              const idx = this.currentTeam.players.findIndex(p => p.id === this.editingPlayer);
            if (idx !== -1) {
                this.currentTeam.players[idx] = {
                    ...this.currentTeam.players[idx],
                    name,
                    number,
                    role: role || 'Игрок',
                    info,
                    is_captain: isCaptain,
                    photo_url: hasPhoto && photoUrl !== window.location.href ? photoUrl : null
                    // УБРАНО: order_index
                };
            }
        } else {
            // Добавляем нового
            const newPlayer = {
                id: 'temp_' + Date.now(),
                team_id: this.currentTeam.id,
                name,
                number,
                role: role || 'Игрок',
                info,
                is_captain: isCaptain,
                photo_url: hasPhoto && photoUrl !== window.location.href ? photoUrl : null
                // УБРАНО: order_index - нет в таблице БД
            };
            this.currentTeam.players.push(newPlayer);
            this.pendingChanges.players.push(newPlayer);
        }
        
        // Возвращаемся к редактированию команды и обновляем список
        this.renderRoster();
        this.hidePlayerScreen();
    },

    deletePlayerFromScreen() {
        if (!this.editingPlayer) return;
        
        if (!confirm('Удалить игрока из команды?')) return;
        
        this.deletePlayer(this.editingPlayer);
        this.hidePlayerScreen();
    },

    deletePlayer(playerId) {
        // Помечаем на удаление
        const player = this.currentTeam.players.find(p => p.id === playerId);
        if (player && !playerId.toString().startsWith('temp_')) {
            this.pendingChanges.deletedPlayers.push(playerId);
        }
        
        // Удаляем локально
        this.currentTeam.players = this.currentTeam.players.filter(p => p.id !== playerId);
        this.renderRoster();
    },

    // ==================== СОХРАНЕНИЕ ====================

    async saveAllChanges() {
        const btn = document.querySelector('.save-top-btn');
        const originalText = btn ? btn.innerHTML : 'Готово';
        
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
            btn.disabled = true;
        }

        try {
            // 1. Обновляем основную инфу
            const nameEl = document.getElementById('edit-team-name');
            const descEl = document.getElementById('edit-team-description');
            
            const updates = {
                name: nameEl ? nameEl.value : this.currentTeam.name,
                description: descEl ? descEl.value : null
                // УБРАНО: contacts - этого поля нет в таблице teams
            };

            // Если есть новый логотип, загружаем его
            if (this.pendingChanges.logo) {
                // TODO: Загрузка файла на сервер и получение URL
                // updates.logo_url = uploadedUrl;
            }

            const { error: updateError } = await app.supabase
                .from('teams')
                .update(updates)
                .eq('id', this.currentTeam.id);

            if (updateError) throw updateError;

            // 2. Сохраняем состав игроков
            for (const player of this.currentTeam.players) {
                if (player.id.toString().startsWith('temp_')) {
                    // Новый игрок - добавляем
                    const { id, ...data } = player;
                    const { error } = await app.supabase.from('team_players').insert([data]);
                    if (error) throw error;
                } else {
                    // Существующий игрок - обновляем
                    const { error } = await app.supabase.from('team_players')
                        .update({
                            name: player.name,
                            number: player.number,
                            role: player.role,
                            info: player.info,
                            is_captain: player.is_captain,
                            photo_url: player.photo_url
                            // УБРАНО: order_index - нет в таблице
                        })
                        .eq('id', player.id);
                    if (error) throw error;
                }
            }

            // 3. Удаляем помеченных игроков
            if (this.pendingChanges.deletedPlayers.length > 0) {
                const { error } = await app.supabase.from('team_players')
                    .delete()
                    .in('id', this.pendingChanges.deletedPlayers);
                if (error) throw error;
            }

            alert('Изменения сохранены!');
            
            // Очищаем pending changes
            this.pendingChanges = { players: [], deletedPlayers: [], logo: null };
            
            // Обновляем данные команды
            await this.show(this.currentTeam.id);
            
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            alert('Ошибка сохранения: ' + error.message);
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    },

    deleteTeam() {
        this.showConfirm(
            'Удалить команду?',
            'Все данные будут безвозвратно удалены. Это действие нельзя отменить.',
            async () => {
                try {
                    // Сначала удаляем игроков
                    await app.supabase.from('team_players').delete().eq('team_id', this.currentTeam.id);
                    
                    // Потом команду
                    await app.supabase.from('teams').delete().eq('id', this.currentTeam.id);
                    
                    alert('Команда удалена');
                    if (navigationModule && navigationModule.showTeams) {
                        navigationModule.showTeams();
                    } else {
                        screenManager.show('screen-teams');
                    }
                } catch (error) {
                    alert('Ошибка удаления: ' + error.message);
                }
            }
        );
    },

    showConfirm(title, text, action) {
        // Простой confirm вместо модалки, можно заменить на кастомную модалку позже
        if (confirm(title + '\n\n' + text)) {
            action();
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