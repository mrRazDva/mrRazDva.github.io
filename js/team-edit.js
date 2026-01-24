const teamEditModule = {
    currentTeam: null,
    editingPlayer: null,
    nameChangeCost: 299,

    init() {
        // Проверяем LocalStorage для отслеживания бесплатной смены названия
        if (!utils.storage.get('teamNameChanges')) {
            utils.storage.set('teamNameChanges', {});
        }
    },

    show(teamId) {
        const team = mockData.teams[teamId];
        if (!team || team.owner !== app.currentUser.id) {
            alert('У вас нет прав на редактирование этой команды');
            return;
        }

        this.currentTeam = team;
        this.render();
        screenManager.show('screen-team-edit');
    },

    render() {
        // Заполняем форму
        document.getElementById('edit-team-name').value = this.currentTeam.name;
        document.getElementById('edit-team-avatar').value = this.currentTeam.avatar;
        
        // Проверяем возможность смены названия
        this.checkNameChangeAvailability();

        // Рендерим состав
        this.renderRoster();
    },

    checkNameChangeAvailability() {
        const nameChanges = utils.storage.get('teamNameChanges') || {};
        const lastChange = nameChanges[this.currentTeam.id];
        const changeBtn = document.getElementById('change-name-btn');
        const changeInfo = document.getElementById('name-change-info');

        if (!lastChange) {
            // Еще не меняли - можно бесплатно
            changeInfo.innerHTML = '<span style="color: var(--accent-green);">✓ Бесплатная смена доступна (1 раз в год)</span>';
            changeBtn.textContent = 'Изменить название';
            changeBtn.onclick = () => this.changeName(false);
        } else {
            const lastDate = new Date(lastChange);
            const now = new Date();
            const diffTime = Math.abs(now - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
        }
    },

    changeName(isPaid) {
        const newName = document.getElementById('edit-team-name').value.trim();
        if (!newName || newName === this.currentTeam.name) return;

        if (isPaid) {
            // Списываем деньги (в демо просто показываем алерт)
            if (!confirm(`Списать ${this.nameChangeCost} ₽ для смены названия?`)) return;
        }

        // Сохраняем старое название для истории
        if (!this.currentTeam.nameHistory) this.currentTeam.nameHistory = [];
        this.currentTeam.nameHistory.push({
            name: this.currentTeam.name,
            date: new Date().toISOString()
        });

        // Меняем название
        this.currentTeam.name = newName;
        
        // Запоминаем дату изменения
        const nameChanges = utils.storage.get('teamNameChanges') || {};
        nameChanges[this.currentTeam.id] = new Date().toISOString();
        utils.storage.set('teamNameChanges', nameChanges);

        // Обновляем UI
        this.checkNameChangeAvailability();
        alert('Название команды изменено!');
        
        // Обновляем в списке команд если виден
        if (app.renderMyTeams) app.renderMyTeams();
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
        if (!container) return;

        if (!this.currentTeam.players || this.currentTeam.players.length === 0) {
            container.innerHTML = '<div class="empty-state">Нет игроков. Добавьте первого!</div>';
            return;
        }

        container.innerHTML = this.currentTeam.players.map((player, index) => `
            <div class="edit-player-card">
                <div class="player-photo-small" onclick="teamEditModule.changePlayerPhoto(${index})">
                    ${player.photo ? `<img src="${player.photo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">` : 
                      `<i class="fas fa-user" style="color: var(--text-secondary);"></i>`}
                    <div class="photo-overlay"><i class="fas fa-camera"></i></div>
                </div>
                <div class="player-info-edit">
                    <div class="player-name-edit">${player.name}</div>
                    <div class="player-meta">№${player.number} • ${player.role}</div>
                    ${player.info ? `<div class="player-bio">${player.info}</div>` : ''}
                </div>
                <div class="player-actions">
                    <button class="icon-btn" onclick="teamEditModule.editPlayer(${index})">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="icon-btn delete" onclick="teamEditModule.deletePlayer(${index})">
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
    
    // Показываем модал
    const modal = document.getElementById('player-form-modal');
    modal.classList.remove('hidden');
    modal.classList.add('active');
},

hidePlayerForm() {
    const modal = document.getElementById('player-form-modal');
    modal.classList.remove('active');
    modal.classList.add('hidden');
    this.editingPlayer = null;
},

    editPlayer(index) {
        this.editingPlayer = index;
        const player = this.currentTeam.players[index];
        
        document.getElementById('player-form-title').textContent = 'Редактировать игрока';
        document.getElementById('player-name-input').value = player.name;
        document.getElementById('player-number-input').value = player.number;
        document.getElementById('player-role-input').value = player.role;
        document.getElementById('player-info-input').value = player.info || '';
        
        const preview = document.getElementById('player-photo-preview');
        if (player.photo) {
            preview.innerHTML = `<img src="${player.photo}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else {
            preview.innerHTML = '<i class="fas fa-user"></i>';
        }
        
        utils.show('player-form-modal');
    },

    savePlayer() {
        const name = document.getElementById('player-name-input').value.trim();
        const number = parseInt(document.getElementById('player-number-input').value);
        const role = document.getElementById('player-role-input').value.trim();
        const info = document.getElementById('player-info-input').value.trim();
        const photoPreview = document.getElementById('player-photo-preview').querySelector('img');

        if (!name || !number) {
            alert('Заполните имя и номер');
            return;
        }

        // Проверяем уникальность номера
        const exists = this.currentTeam.players.find((p, i) => 
            p.number === number && i !== this.editingPlayer
        );
        if (exists) {
            alert('Игрок с таким номером уже есть в команде');
            return;
        }

        const playerData = {
            name,
            number,
            role: role || 'Игрок',
            info: info || '',
            photo: photoPreview ? photoPreview.src : null
        };

        if (this.editingPlayer !== null) {
            // Редактируем существующего
            this.currentTeam.players[this.editingPlayer] = playerData;
        } else {
            // Добавляем нового
            if (!this.currentTeam.players) this.currentTeam.players = [];
            this.currentTeam.players.push(playerData);
        }

        // Сортируем по номерам
        this.currentTeam.players.sort((a, b) => a.number - b.number);

        this.hidePlayerForm();
        this.renderRoster();
    },

    deletePlayer(index) {
        if (!confirm('Удалить игрока из команды?')) return;
        
        this.currentTeam.players.splice(index, 1);
        this.renderRoster();
    },

    hidePlayerForm() {
        utils.hide('player-form-modal');
        this.editingPlayer = null;
    },

    // Загрузка фото
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
            preview.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
        };
        reader.readAsDataURL(file);
    },

    changePlayerPhoto(index) {
        // Для простоты используем input type=file через клик
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (ev) => {
                this.currentTeam.players[index].photo = ev.target.result;
                this.renderRoster();
            };
            reader.readAsDataURL(file);
        };
        input.click();
    },

    saveTeamChanges() {
        // Сохраняем изменения в mockData (в реальном приложении - API запрос)
        alert('Изменения сохранены!');
        
        // Обновляем отображение в других модулях
        if (teamModule.currentTeam?.id === this.currentTeam.id) {
            teamModule.currentTeam = this.currentTeam;
        }
        
        if (app.renderMyTeams) app.renderMyTeams();
        screenManager.show('screen-teams');
    }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    teamEditModule.init();
});