// js/app-modules/teams.js - Модуль работы с командами
const teamsModule = {
    app: null,
    currentLogoFile: null,
    
    init(appInstance) {
        this.app = appInstance;
        this.initCitySelect();
        this.initDescriptionCounter();
        this.setupDragAndDrop();
    },
    
    // Инициализация выпадающего списка городов
    initCitySelect() {
        const select = document.getElementById('team-city');
        if (!select || !this.app.cities) return;
        
        select.innerHTML = '<option value="">Выберите город</option>';
        
        Object.entries(this.app.cities).forEach(([id, city]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = city.name;
            select.appendChild(option);
        });
        
        // Устанавливаем текущий город по умолчанию
        if (this.app.currentCity) {
            select.value = this.app.currentCity;
        }
    },
    
    // Счетчик символов для описания
    initDescriptionCounter() {
        const textarea = document.getElementById('team-description');
        const counter = document.getElementById('desc-counter');
        if (!textarea || !counter) return;
        
        textarea.addEventListener('input', () => {
            const length = textarea.value.length;
            counter.textContent = `${length} / 500`;
            if (length > 450) {
                counter.style.color = 'var(--accent-pink)';
            } else {
                counter.style.color = 'var(--text-secondary)';
            }
        });
    },
    
    // Drag & Drop для логотипа
    setupDragAndDrop() {
        const uploadArea = document.getElementById('logo-upload-area');
        if (!uploadArea) return;
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('dragover');
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('dragover');
            }, false);
        });
        
        uploadArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0) {
                const file = files[0];
                if (file.type.startsWith('image/')) {
                    this.handleLogoFile(file);
                } else {
                    alert('Пожалуйста, загрузите изображение (PNG, JPG)');
                }
            }
        }, false);
    },
    
    // Обработка превью логотипа
    handleLogoPreview(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.handleLogoFile(file);
    },
    
    handleLogoFile(file) {
        // Валидация
        if (file.size > 5 * 1024 * 1024) {
            alert('Файл слишком большой. Максимальный размер: 5MB');
            return;
        }
        
        if (!file.type.match(/^image\/(jpeg|png|jpg|webp)$/)) {
            alert('Поддерживаются только форматы: JPG, PNG, WebP');
            return;
        }
        
        this.currentLogoFile = file;
        
        // Показываем превью
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('logo-preview');
            const removeBtn = document.getElementById('logo-remove-btn');
            
            if (preview) {
                preview.innerHTML = `<img src="${e.target.result}" alt="Logo preview">`;
            }
            if (removeBtn) {
                removeBtn.classList.remove('hidden');
            }
        };
        reader.readAsDataURL(file);
    },
    
    // Удаление логотипа
    removeLogo() {
        this.currentLogoFile = null;
        const preview = document.getElementById('logo-preview');
        const removeBtn = document.getElementById('logo-remove-btn');
        const input = document.getElementById('team-logo-input');
        
        if (preview) {
            preview.innerHTML = `
                <i class="fas fa-camera"></i>
                <span>Нажмите для загрузки</span>
                <small>PNG, JPG до 5MB</small>
            `;
        }
        if (removeBtn) {
            removeBtn.classList.add('hidden');
        }
        if (input) {
            input.value = '';
        }
    },
    
    // Загрузка логотипа в Supabase Storage
    async uploadTeamLogo(teamId) {
    if (!this.currentLogoFile || !this.app.supabase) {
        console.log('No file or supabase');
        return null;
    }
    
    console.log('🔄 Загрузка логотипа:', this.currentLogoFile.name, 'Type:', this.currentLogoFile.type);
    
    try {
        const fileExt = this.currentLogoFile.name.split('.').pop().toLowerCase();
        const fileName = `${teamId}-${Date.now()}.${fileExt}`;
        
        console.log('📁 Имя файла:', fileName);
        
        // ВАЖНО: Полностью отказываемся от supabase.storage.upload()
        // Используем чистый fetch с правильными заголовками
        
        // 1. Получаем токен доступа
        const { data: { session } } = await this.app.supabase.auth.getSession();
        if (!session) {
            throw new Error('Сессия не найдена');
        }
        
        const token = session.access_token;
        
        // 2. Формируем URL для загрузки
        const uploadUrl = `https://anqvyvtwqljqvldcljat.supabase.co/storage/v1/object/team-logos/${fileName}`;
        
        console.log('🔗 URL загрузки:', uploadUrl);
        console.log('🔑 Токен:', token ? 'Есть' : 'Нет');
        
        // 3. Используем FileReader для получения ArrayBuffer
        const fileReader = new FileReader();
        
        const fileBuffer = await new Promise((resolve, reject) => {
            fileReader.onload = () => resolve(fileReader.result);
            fileReader.onerror = reject;
            fileReader.readAsArrayBuffer(this.currentLogoFile);
        });
        
        // 4. Загружаем через fetch с ПРАВИЛЬНЫМИ заголовками
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': this.currentLogoFile.type,
                'X-Client-Info': 'supabase-js-web',
                'cache-control': '3600',
                'x-upsert': 'false'
            },
            body: fileBuffer
        });
        
        console.log('📤 Ответ сервера:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Ошибка загрузки:', errorText);
            
            // Пробуем альтернативный метод с FormData
            console.log('🔄 Пробуем метод с FormData...');
            
            const formData = new FormData();
            formData.append('file', this.currentLogoFile);
            
            const formResponse = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // Не устанавливаем Content-Type - браузер сам установит multipart/form-data
                },
                body: formData
            });
            
            if (!formResponse.ok) {
                const formErrorText = await formResponse.text();
                throw new Error(`Upload failed: ${formResponse.status} - ${formErrorText}`);
            }
            
            const result = await formResponse.json();
            console.log('✅ Файл загружен через FormData:', result);
        } else {
            const result = await response.json();
            console.log('✅ Файл загружен:', result);
        }
        
        // 5. Получаем публичный URL
        const publicUrl = `https://anqvyvtwqljqvldcljat.supabase.co/storage/v1/object/public/team-logos/${fileName}`;
        
        console.log('🔗 Публичный URL:', publicUrl);
        return publicUrl;
        
    } catch (error) {
        console.error('❌ Финальная ошибка загрузки:', error.message);
        alert('Не удалось загрузить логотип: ' + error.message);
        return null;
    }
},

async getAccessToken() {
    // Получаем токен из текущей сессии
    const { data: { session } } = await this.app.supabase.auth.getSession();
    return session?.access_token || '';
},
    
    // Создание команды (обновленное)
    async createTeam() {
        const name = document.getElementById('team-name').value.trim();
        const avatar = document.getElementById('team-avatar')?.value || '⚽';
        const sport = document.getElementById('team-sport').value;
        const city = document.getElementById('team-city').value;
        const description = document.getElementById('team-description').value.trim();
        
        // Валидация
        if (!name) {
            alert('Введите название команды');
            return;
        }
        
        if (!city) {
            alert('Выберите город');
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
        const userNickname = authModule.currentUser?.nickname;
        if (!userId || !userNickname) {
            alert('Ошибка получения данных пользователя');
            return;
        }
        
        const submitBtn = document.getElementById('create-team-submit');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создание...';
        }
        
        try {
            // Создаём команду в Supabase (без логотипа сначала)
            const { data: team, error } = await this.app.supabase
                .from('teams')
                .insert([{
                    name,
                    city,
                    sport,
                    avatar, // fallback emoji
                    description: description || null,
                    owner_id: userId,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();
            
            if (error) throw error;
            
            // Если есть логотип - загружаем его
            let logoUrl = null;
            if (this.currentLogoFile) {
                logoUrl = await this.uploadTeamLogo(team.id);
                
                // Обновляем команду с URL логотипа
                if (logoUrl) {
                    const { error: updateError } = await this.app.supabase
                        .from('teams')
                        .update({ logo_url: logoUrl })
                        .eq('id', team.id);
                    
                    if (updateError) {
                        console.warn('Не удалось обновить logo_url:', updateError);
                    }
                }
            }
            
            // ВАЖНОЕ ИЗМЕНЕНИЕ: Создаём запись владельца как привязанного игрока
            await this.app.supabase
                .from('team_players')
                .insert([{
                    team_id: team.id,
                    user_id: userId, // Привязываем к пользователю
                    name: userNickname,
                    number: 10,
                    role: 'Капитан',
                    is_captain: true,
                    is_linked: true, // Галочка привязанности
                    invitation_status: 'accepted', // Статус принят
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }]);
            
            // Сброс формы
            this.resetForm();
            
            alert('Команда создана успешно! Вы автоматически добавлены в состав как капитан.');
            navigationModule.showTeams();
            
        } catch (error) {
            console.error('❌ Ошибка создания команды:', error);
            alert('Ошибка создания команды: ' + error.message);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-plus"></i> Создать команду';
            }
        }
    },
    
    resetForm() {
        document.getElementById('create-team-form')?.reset();
        this.removeLogo();
        const counter = document.getElementById('desc-counter');
        if (counter) counter.textContent = '0 / 500';
    },
    
    // Отображение моих команд (обновленное для поддержки логотипов)
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
        id,
        name,
        city,
        sport,
        avatar,
        logo_url,
        description,
        created_at,
        players:team_players(count)
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
        const playerCount = team.players?.[0]?.count || 0;
        
        // Отладка
        console.log('Team:', team.name, 'Logo:', team.logo_url);
        
        // Правильное формирование аватарки
        let logoHtml;
        if (team.logo_url) {
    logoHtml = `<img src="${team.logo_url}" style="width:100%;height:100%;object-fit:cover;">`;
} else {
    logoHtml = `<span style="font-size:1.5rem">${team.avatar || '⚽'}</span>`;
}
        
        return `
            <div class="team-manage-card" onclick="teamEditModule.show('${team.id}')">
                <div class="team-avatar" style="width: 50px; height: 50px; border: 2px solid var(--accent-green); border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--bg-secondary);">
                    ${logoHtml}
                </div>
                <div class="team-info">
                    <div class="team-name">${team.name}</div>
                    <div class="team-stats">${this.app.cities[team.city]?.name || team.city} • ${playerCount} игроков</div>
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
    
    // Загрузка команд для выпадающего списка (без изменений)
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