// team-edit.js - исправленный
const teamEditModule = {
    currentTeam: null,
    editingPlayer: null,
    nameChangeCost: 299,

    async show(teamId) {
        try {
            // Загружаем команду с игроками
            const { data: team, error } = await app.supabase
                .from('teams')
                .select(`
                    *,
                    players:team_players(*)
                `)
                .eq('id', teamId)
                .single();

            if (error) throw error;

            // Проверяем, является ли пользователь владельцем
            if (team.owner_id !== authModule.getUserId()) {
                alert('У вас нет прав на редактирование этой команды');
                return;
            }

            this.currentTeam = team;
            this.render();
            screenManager.show('screen-team-edit');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки команды:', error);
            alert('Ошибка загрузки команды');
        }
    },

    async render() {
        if (!this.currentTeam) return;

        // Заполняем форму
        document.getElementById('edit-team-name').value = this.currentTeam.name;
        document.getElementById('edit-team-avatar').value = this.currentTeam.avatar;
        
        // Рендерим состав
        this.renderRoster();

        // Проверяем возможность смены названия
        await this.checkNameChangeAvailability();
    },

    async checkNameChangeAvailability() {
        const changeBtn = document.getElementById('change-name-btn');
        const changeInfo = document.getElementById('name-change-info');

        try {
            // Проверяем существование таблицы team_name_changes
            // Делаем запрос только если app.supabase доступен
            if (!app.supabase) {
                console.warn('Supabase недоступен для проверки смены названия');
                changeInfo.innerHTML = '<span style="color: var(--text-secondary);">Информация о смене названия недоступна</span>';
                changeBtn.textContent = 'Изменить название';
                changeBtn.onclick = () => this.changeName(false);
                return;
            }

            const { error } = await app.supabase
                .from('team_name_changes')
                .select('changed_at')
                .eq('team_id', this.currentTeam.id)
                .order('changed_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code === 'PGRST116') { // No data found
                // Еще не меняли - можно бесплатно
                changeInfo.innerHTML = '<span style="color: var(--accent-green);">✓ Бесплатная смена доступна (1 раз в год)</span>';
                changeBtn.textContent = 'Изменить название';
                changeBtn.onclick = () => this.changeName(false);
                return;
            } else if (error && error.code === '42P01') { // Table doesn't exist
                console.warn('Таблица team_name_changes не существует');
                changeInfo.innerHTML = '<span style="color: var(--text-secondary);">Таблица для отслеживания изменений не настроена</span>';
                changeBtn.textContent = 'Изменить название';
                changeBtn.onclick = () => this.changeName(false);
                return;
            } else if (error) {
                // Другие ошибки
                console.warn('Ошибка проверки смены названия:', error);
                changeInfo.innerHTML = '<span style="color: var(--text-secondary);">Ошибка проверки данных</span>';
                changeBtn.textContent = 'Изменить название';
                changeBtn.onclick = () => this.changeName(false);
                return;
            }

            // Если мы здесь, значит данные получены успешно
            // Код для обработки даты смены названия...
            // Обратите внимание: в оригинальном коде здесь была ошибка - мы пытались
            // получить data, но не сохраняли её. Исправим:

            const { data: nameChanges, error: dateError } = await app.supabase
                .from('team_name_changes')
                .select('changed_at')
                .eq('team_id', this.currentTeam.id)
                .order('changed_at', { ascending: false })
                .limit(1)
                .single();

            if (!nameChanges || !nameChanges.changed_at) {
                changeInfo.innerHTML = '<span style="color: var(--accent-green);">✓ Бесплатная смена доступна</span>';
                changeBtn.textContent = 'Изменить название';
                changeBtn.onclick = () => this.changeName(false);
                return;
            }

            const lastDate = new Date(nameChanges.changed_at);
            const now = new Date();
            const diffTime = now - lastDate;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const daysLeft = 365 - diffDays;

            if (daysLeft > 0) {
                // Прошло меньше года - нужно платить
                changeInfo.innerHTML = `<span style="color: var(--accent-gold);">Следующая бесплатная смена через ${daysLeft} дней</span>`;
                changeBtn.textContent = `Изменить за ${this.nameChangeCost} ₽`;
                changeBtn.onclick = () => this.showPaymentForNameChange();
            } else {
                // Прошел год - можно бесплатно
                changeInfo.innerHTML = '<span style="color: var(--accent-green);">✓ Бесплатная смена доступна (прошел год)</span>';
                changeBtn.textContent = 'Изменить название';
                changeBtn.onclick = () => this.changeName(false);
            }
        } catch (error) {
            console.error('❌ Ошибка проверки смены названия:', error);
            // В случае ошибки разрешаем смену без проверки
            changeInfo.innerHTML = '<span style="color: var(--accent-green);">Можно изменить название</span>';
            changeBtn.textContent = 'Изменить название';
            changeBtn.onclick = () => this.changeName(false);
        }
    },

    async changeName(isPaid) {
        const newName = document.getElementById('edit-team-name').value.trim();
        if (!newName || newName === this.currentTeam.name) return;

        if (isPaid) {
            if (!confirm(`Списать ${this.nameChangeCost} ₽ для смены названия?`)) return;
            
            // Здесь должна быть интеграция с платежной системой
            // Временно просто обновляем
        }

        try {
            // Обновляем название команды
            const { error } = await app.supabase
                .from('teams')
                .update({ name: newName })
                .eq('id', this.currentTeam.id);

            if (error) throw error;

            // Пытаемся записать изменение названия (если таблица существует)
            try {
                await app.supabase
                    .from('team_name_changes')
                    .insert([{
                        team_id: this.currentTeam.id,
                        old_name: this.currentTeam.name,
                        new_name: newName,
                        is_paid: isPaid,
                        changed_at: new Date().toISOString()
                    }]);
            } catch (dbError) {
                console.warn('Не удалось записать историю смены названия:', dbError);
                // Игнорируем, если таблицы нет
            }

            // Обновляем текущую команду
            this.currentTeam.name = newName;

            alert('Название команды изменено!');
            this.checkNameChangeAvailability();

            // Обновляем в других местах
            if (typeof app.renderMyTeams === 'function') {
                await app.renderMyTeams();
            }

        } catch (error) {
            console.error('❌ Ошибка смены названия:', error);
            alert('Ошибка смены названия команды');
        }
    },

    showPaymentForNameChange() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal-content">
                <h3 style="margin-bottom: 15px; font-family: var(--font-display);">Смена названия</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    Бесплатная смена будет доступна позже.<br>
                    Хотите изменить сейчас за ${this.nameChangeCost} ₽?
                </p>
                <div style="background: var(--bg-card); padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                    <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 5px;">Новое название:</div>
                    <div style="font-weight: 700; font-size: 1.2rem;">${document.getElementById('edit-team-name').value}</div>
                </div>
                <button class="btn btn-gold" onclick="teamEditModule.changeName(true); this.closest('.modal-overlay').remove();">
                    Оплатить ${this.nameChangeCost} ₽
                </button>
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="margin-top: 10px;">
                    Отмена
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // Управление составом
    renderRoster() {
        const container = document.getElementById('edit-roster-list');
        if (!container || !this.currentTeam.players) return;

        if (this.currentTeam.players.length === 0) {
            container.innerHTML = '<div class="empty-state">Нет игроков. Добавьте первого!</div>';
            return;
        }

        container.innerHTML = this.currentTeam.players.map((player, index) => `
            <div class="edit-player-card">
                <div class="player-photo-small" onclick="teamEditModule.changePlayerPhoto('${player.id}')">
                    ${player.photo_url ? `<img src="${player.photo_url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">` : 
                      `<i class="fas fa-user" style="color: var(--text-secondary);"></i>`}
                    <div class="photo-overlay"><i class="fas fa-camera"></i></div>
                </div>
                <div class="player-info-edit">
                    <div class="player-name-edit">${player.name}</div>
                    <div class="player-meta">№${player.number} • ${player.role}</div>
                    ${player.info ? `<div class="player-bio">${player.info}</div>` : ''}
                </div>
                <div class="player-actions">
                    <button class="icon-btn" onclick="teamEditModule.editPlayer('${player.id}')">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="icon-btn delete" onclick="teamEditModule.deletePlayer('${player.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    showAddPlayerForm() {
        this.editingPlayer = null;
        document.getElementById('player-form-title').textContent = 'Новый игрок';
        document.getElementById('player-name-input').value = '';
        document.getElementById('player-number-input').value = '';
        document.getElementById('player-role-input').value = '';
        document.getElementById('player-info-input').value = '';
        document.getElementById('player-photo-preview').innerHTML = '<i class="fas fa-user"></i>';
        
        const modal = document.getElementById('player-form-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('active');
        }
    },

    hidePlayerForm() {
        const modal = document.getElementById('player-form-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.classList.add('hidden');
        }
        this.editingPlayer = null;
    },

    async editPlayer(playerId) {
        try {
            const player = this.currentTeam.players.find(p => p.id === playerId);
            if (!player) return;

            this.editingPlayer = playerId;
            
            document.getElementById('player-form-title').textContent = 'Редактировать игрока';
            document.getElementById('player-name-input').value = player.name;
            document.getElementById('player-number-input').value = player.number;
            document.getElementById('player-role-input').value = player.role || '';
            document.getElementById('player-info-input').value = player.info || '';
            
            const preview = document.getElementById('player-photo-preview');
            if (preview) {
                if (player.photo_url) {
                    preview.innerHTML = `<img src="${player.photo_url}" style="width: 100%; height: 100%; object-fit: cover;">`;
                } else {
                    preview.innerHTML = '<i class="fas fa-user"></i>';
                }
            }
            
            this.showPlayerForm();

        } catch (error) {
            console.error('❌ Ошибка редактирования игрока:', error);
        }
    },

    async savePlayer() {
        const name = document.getElementById('player-name-input').value.trim();
        const number = parseInt(document.getElementById('player-number-input').value);
        const role = document.getElementById('player-role-input').value.trim();
        const info = document.getElementById('player-info-input').value.trim();

        if (!name || !number) {
            alert('Заполните имя и номер');
            return;
        }

        // Проверяем уникальность номера
        const exists = this.currentTeam.players.find(p => 
            p.number === number && p.id !== this.editingPlayer
        );
        if (exists) {
            alert('Игрок с таким номером уже есть в команде');
            return;
        }

        try {
            if (this.editingPlayer) {
                // Обновляем существующего игрока
                const { error } = await app.supabase
                    .from('team_players')
                    .update({
                        name,
                        number,
                        role: role || 'Игрок',
                        info: info || '',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', this.editingPlayer);

                if (error) throw error;
            } else {
                // Добавляем нового игрока
                const { error } = await app.supabase
                    .from('team_players')
                    .insert([{
                        team_id: this.currentTeam.id,
                        name,
                        number,
                        role: role || 'Игрок',
                        info: info || '',
                        created_at: new Date().toISOString()
                    }]);

                if (error) throw error;
            }

            // Обновляем список игроков
            await this.loadTeamPlayers();
            this.hidePlayerForm();

        } catch (error) {
            console.error('❌ Ошибка сохранения игрока:', error);
            alert('Ошибка сохранения игрока: ' + error.message);
        }
    },

    async deletePlayer(playerId) {
        if (!confirm('Удалить игрока из команды?')) return;
        
        try {
            const { error } = await app.supabase
                .from('team_players')
                .delete()
                .eq('id', playerId);

            if (error) throw error;

            // Обновляем список игроков
            await this.loadTeamPlayers();

        } catch (error) {
            console.error('❌ Ошибка удаления игрока:', error);
            alert('Ошибка удаления игрока');
        }
    },

    async loadTeamPlayers() {
        try {
            const { data: players, error } = await app.supabase
                .from('team_players')
                .select('*')
                .eq('team_id', this.currentTeam.id)
                .order('number');

            if (error) throw error;

            this.currentTeam.players = players;
            this.renderRoster();

        } catch (error) {
            console.error('❌ Ошибка загрузки игроков:', error);
        }
    },

    handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            alert('Фото слишком большое (макс. 2MB)');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('player-photo-preview');
            if (preview) {
                preview.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
            }
            
            // Здесь можно загрузить фото на Supabase Storage
            // и сохранить URL в базе данных
        };
        reader.readAsDataURL(file);
    },

    async changePlayerPhoto(playerId) {
        // Для простоты используем input type=file
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Здесь должна быть загрузка в Supabase Storage
            // и обновление player.photo_url
            
            // Временно просто обновляем локально
            const reader = new FileReader();
            reader.onload = (ev) => {
                // Находим игрока и обновляем фото
                const player = this.currentTeam.players.find(p => p.id === playerId);
                if (player) {
                    player.photo_url = ev.target.result;
                    this.renderRoster();
                }
            };
            reader.readAsDataURL(file);
        };
        input.click();
    },

    async saveTeamChanges() {
        // Сохраняем изменения аватара
        const avatar = document.getElementById('edit-team-avatar').value;
        if (avatar !== this.currentTeam.avatar) {
            try {
                const { error } = await app.supabase
                    .from('teams')
                    .update({ avatar })
                    .eq('id', this.currentTeam.id);

                if (error) throw error;
                
                this.currentTeam.avatar = avatar;
            } catch (error) {
                console.error('❌ Ошибка обновления аватара:', error);
            }
        }

        alert('Изменения сохранены!');
        
        // Обновляем отображение в других модулях
        if (teamModule.currentTeam?.id === this.currentTeam.id) {
            await teamModule.show(this.currentTeam.id);
        }
        
        if (app.renderMyTeams) await app.renderMyTeams();
        screenManager.show('screen-teams');
    },

    showPlayerForm() {
        const modal = document.getElementById('player-form-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('active');
        }
    },

    // Добавим простую инициализацию, которая будет вызвана из app.js
    init: async function() {
        try {
            // Проверяем существование таблицы team_name_changes
            // Ждем, пока app.supabase будет доступен
            if (!app.supabase) {
                console.warn('Supabase еще не инициализирован, пропускаем инициализацию teamEditModule');
                return;
            }
            
            const { error } = await app.supabase
                .from('team_name_changes')
                .select('*')
                .limit(1);

            if (error && error.code === '42P01') {
                console.log('Таблица team_name_changes не существует');
            }
        } catch (error) {
            console.error('❌ Ошибка инициализации teamEditModule:', error);
        }
    }
};

// УДАЛИТЕ весь блок с DOMContentLoaded внизу файла
// Он был причиной ошибки, так как пытался использовать app.supabase до его инициализации