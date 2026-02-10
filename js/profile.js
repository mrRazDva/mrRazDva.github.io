const profileModule = {
    app: null,
    isSaving: false,
    isInitialized: false,
    pendingAvatar: null,
    
    init(appInstance) {
        if (this.isInitialized) return;
        
        this.app = appInstance;
        this.isInitialized = true;
        this.setupEventListeners();
        
        // Инициализация при загрузке (однократно)
        if (authModule.isAuthenticated()) {
            setTimeout(() => {
                this.onPageLoad();
                this.initHeaderAvatar(); // Инициализируем аватар в шапке
            }, 100);
        }
    },
    
    setupEventListeners() {
        console.log('🔧 Настройка обработчиков профиля...');
        
        // Удаляем все inline обработчики из формы
        const form = document.getElementById('profile-edit-form-modern');
        if (form) {
            form.removeAttribute('onsubmit');
            
            // ОДИН обработчик для формы
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation(); // Останавливаем все другие обработчики
                this.saveProfileModern();
            });
        }
        
        // Био счетчик
        const bioTextareaModern = document.getElementById('edit-bio-modern');
        if (bioTextareaModern) {
            bioTextareaModern.addEventListener('input', (e) => {
                const counter = document.getElementById('bio-counter-modern');
                if (counter) {
                    counter.textContent = `${e.target.value.length} / 500`;
                }
            });
        }
        
        // Старая версия счетчика (для совместимости)
        const bioTextarea = document.getElementById('edit-bio');
        if (bioTextarea) {
            bioTextarea.addEventListener('input', (e) => {
                const counter = document.getElementById('bio-counter');
                if (counter) {
                    counter.textContent = `${e.target.value.length} / 500`;
                }
            });
        }
    },
    
    // ========== МЕТОДЫ ДЛЯ АВАТАРА ==========

    // Открыть диалог выбора файла
    openAvatarPicker() {
        document.getElementById('avatar-upload-input').click();
    },

    // Обработка загрузки аватара
    async handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Проверка размера файла (макс. 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Файл слишком большой. Максимальный размер: 5MB');
            return;
        }

        // Проверка типа файла
        if (!file.type.match('image/jpeg') && !file.type.match('image/png') && !file.type.match('image/webp')) {
            alert('Пожалуйста, выберите файл в формате JPEG, PNG или WebP');
            return;
        }

        try {
            // Показываем прогресс загрузки
            this.showUploadProgress();

            // Чтение файла для предпросмотра
            const reader = new FileReader();
            reader.onload = (e) => {
                // Сохраняем данные для предпросмотра
                this.pendingAvatar = {
                    dataUrl: e.target.result,
                    file: file,
                    type: file.type
                };

                // Показываем предпросмотр
                this.updateAvatarPreviewImage(e.target.result);
            };
            reader.readAsDataURL(file);

        } catch (error) {
            console.error('❌ Ошибка загрузки аватара:', error);
            alert('Ошибка загрузки файла');
        }
    },

    // Показать прогресс загрузки
    showUploadProgress() {
        const progressBar = document.createElement('div');
        progressBar.className = 'upload-progress';
        progressBar.innerHTML = `
            <div class="upload-progress-bar"></div>
            <div class="upload-progress-text">Загрузка...</div>
        `;
        document.body.appendChild(progressBar);

        setTimeout(() => {
            progressBar.remove();
        }, 2000);
    },

    // Обновить изображение предпросмотра аватара
    updateAvatarPreviewImage(dataUrl) {
        const img = document.getElementById('edit-avatar-img');
        const text = document.getElementById('edit-avatar-text');
        
        if (img && text) {
            img.src = dataUrl;
            img.classList.remove('hidden');
            text.style.display = 'none';
        }
    },

    // Загрузить аватар в Supabase Storage
    async uploadAvatarToStorage() {
        if (!this.pendingAvatar || !this.pendingAvatar.file) {
            return null;
        }

        try {
            const userId = authModule.getUserId();
            if (!userId) {
                throw new Error('Пользователь не авторизован');
            }

            // Генерируем уникальное имя файла
            const timestamp = Date.now();
            const fileExt = this.pendingAvatar.file.name.split('.').pop();
            const fileName = `avatar_${userId}_${timestamp}.${fileExt}`;

            console.log('📤 Загрузка аватара в Storage:', fileName, 'Type:', this.pendingAvatar.file.type);

            // 1. Получаем токен доступа
            const { data: { session } } = await this.app.supabase.auth.getSession();
            if (!session) {
                throw new Error('Сессия не найдена');
            }

            const token = session.access_token;
            const uploadUrl = `https://anqvyvtwqljqvldcljat.supabase.co/storage/v1/object/avatars/${fileName}`;

            console.log('🔗 URL загрузки:', uploadUrl);
            console.log('🔑 Токен:', token ? 'Есть' : 'Нет');

            // 2. Используем FileReader для получения ArrayBuffer
            const fileReader = new FileReader();
            const fileBuffer = await new Promise((resolve, reject) => {
                fileReader.onload = () => resolve(fileReader.result);
                fileReader.onerror = reject;
                fileReader.readAsArrayBuffer(this.pendingAvatar.file);
            });

            // 3. Загружаем через fetch с правильными заголовками
            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': this.pendingAvatar.file.type,
                    'X-Client-Info': 'supabase-js-web',
                    'cache-control': '3600',
                    'x-upsert': 'true'
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
                formData.append('file', this.pendingAvatar.file);
                
                const formResponse = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
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

            // 4. Получаем публичный URL
            const publicUrl = `https://anqvyvtwqljqvldcljat.supabase.co/storage/v1/object/public/avatars/${fileName}`;
            
            console.log('🔗 Публичный URL:', publicUrl);

            // Удаляем старый аватар, если он существует
            await this.deleteOldAvatar(userId);

            return publicUrl;

        } catch (error) {
            console.error('❌ Ошибка загрузки аватара:', error);
            throw error;
        }
    },

    // Удалить старый аватар из Storage
    async deleteOldAvatar(userId) {
        try {
            // Получаем текущий аватар пользователя
            const { data: profile, error } = await this.app.supabase
                .from('profiles')
                .select('avatar_url')
                .eq('id', userId)
                .single();

            if (error || !profile || !profile.avatar_url) {
                return;
            }

            // Извлекаем имя файла из URL
            const urlParts = profile.avatar_url.split('/');
            const oldFileName = urlParts[urlParts.length - 1];
            if (!oldFileName || !oldFileName.includes('avatar_')) {
                console.log('❌ Не удалось извлечь имя файла:', profile.avatar_url);
                return;
            }

            console.log('🗑️ Удаление старого аватара:', oldFileName);

            // Удаляем старый файл через REST API
            const { data: { session } } = await this.app.supabase.auth.getSession();
            const token = session?.access_token;
            
            if (!token) {
                console.warn('⚠️ Нет токена для удаления файла');
                return;
            }

            const deleteUrl = `https://anqvyvtwqljqvldcljat.supabase.co/storage/v1/object/avatars/${oldFileName}`;
            
            const response = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                console.log('✅ Старый аватар удален:', oldFileName);
            } else {
                console.warn('⚠️ Не удалось удалить старый аватар:', await response.text());
            }

        } catch (error) {
            console.warn('⚠️ Ошибка при удалении старого аватара:', error);
        }
    },

    // Обновить аватар ВО ВСЕХ МЕСТАХ (главный метод)
    updateAllAvatars(avatarUrl, nickname) {
        console.log('🔄 Обновление аватара во всех местах:', avatarUrl);
        
        // 1. Обновляем в шапке главного экрана
        this.updateHeaderAvatar(avatarUrl, nickname);
        
        // 2. Обновляем в шапках других экранов
        this.updateOtherHeaders(avatarUrl, nickname);
        
        // 3. Обновляем в профиле
        this.updateProfileAvatar(avatarUrl, nickname);
    },

    // Обновить аватар в шапке главного экрана
    updateHeaderAvatar(avatarUrl, nickname) {
        const headerImg = document.getElementById('header-avatar-img');
        const headerLetter = document.getElementById('header-avatar-letter');
        
        if (headerImg && headerLetter) {
            if (avatarUrl) {
                headerImg.src = avatarUrl;
                headerImg.classList.remove('hidden');
                headerLetter.style.display = 'none';
            } else {
                headerImg.classList.add('hidden');
                headerLetter.style.display = 'block';
                if (nickname) {
                    headerLetter.textContent = nickname[0].toUpperCase();
                }
            }
        }
    },

    // Обновить аватар в шапках других экранов
    updateOtherHeaders(avatarUrl, nickname) {
        // Находим все кнопки user-avatar, кроме основной
        const userAvatars = document.querySelectorAll('.user-avatar:not([id*="header-avatar"])');
        
        userAvatars.forEach(avatar => {
            // Проверяем, есть ли внутри img
            let img = avatar.querySelector('img');
            let textSpan = avatar.querySelector('span:not(.pro-badge)');
            let icon = avatar.querySelector('i.fa-user');
            
            if (avatarUrl) {
                // Если изображения нет, создаем его
                if (!img) {
                    img = document.createElement('img');
                    img.className = 'header-avatar-img';
                    avatar.insertBefore(img, avatar.firstChild);
                }
                img.src = avatarUrl;
                img.classList.remove('hidden');
                
                // Скрываем текст/иконку
                if (textSpan) textSpan.style.display = 'none';
                if (icon) icon.style.display = 'none';
            } else {
                // Показываем текст/иконку
                if (textSpan) {
                    textSpan.style.display = 'block';
                    if (nickname && !textSpan.querySelector('i')) {
                        textSpan.textContent = nickname[0].toUpperCase();
                    }
                }
                if (icon) icon.style.display = 'block';
                
                // Скрываем изображение, если есть
                if (img) {
                    img.classList.add('hidden');
                }
            }
        });
    },

    // Обновить аватар в профиле
    updateProfileAvatar(avatarUrl, nickname) {
        // В профиле редактирования
        const editImg = document.getElementById('edit-avatar-img');
        const editText = document.getElementById('edit-avatar-text');
        
        if (editImg && editText) {
            if (avatarUrl) {
                editImg.src = avatarUrl;
                editImg.classList.remove('hidden');
                editText.style.display = 'none';
            } else {
                editImg.classList.add('hidden');
                editText.style.display = 'block';
                if (nickname) {
                    editText.textContent = nickname[0].toUpperCase();
                }
            }
        }

        // В основном профиле
        const profileImg = document.getElementById('profile-avatar-img');
        const profileText = document.getElementById('profile-avatar-text');
        
        if (profileImg && profileText) {
            if (avatarUrl) {
                profileImg.src = avatarUrl;
                profileImg.classList.remove('hidden');
                profileText.style.display = 'none';
            } else {
                profileImg.classList.add('hidden');
                profileText.style.display = 'block';
                if (nickname) {
                    profileText.textContent = nickname[0].toUpperCase();
                }
            }
        }
    },

    // Инициализировать аватар в шапке при загрузке
    initHeaderAvatar() {
        if (!authModule.isAuthenticated()) return;
        
        const user = authModule.currentUser;
        console.log('👤 Инициализация аватара для пользователя:', user);
        
        // Загружаем данные профиля для получения аватара
        this.app.supabase
            .from('profiles')
            .select('avatar_url, nickname')
            .eq('id', user.id)
            .single()
            .then(({ data, error }) => {
                if (!error && data) {
                    console.log('✅ Загружен аватар профиля:', data.avatar_url);
                    this.updateAllAvatars(data.avatar_url, data.nickname || user.nickname);
                } else if (error && error.code === 'PGRST116') {
                    console.log('📝 Профиль не найден, используем никнейм');
                    this.updateAllAvatars(null, user.nickname);
                }
            })
            .catch(error => {
                console.error('❌ Ошибка загрузки аватара для шапки:', error);
                this.updateAllAvatars(null, user.nickname);
            });
    },
    
    // Показать экран редактирования профиля (модерн версия)
    showEditProfile() {
        if (!authModule.isAuthenticated()) {
            alert('Сначала войдите в систему');
            return;
        }
        
        // Сначала скрываем текущий экран
        const currentScreen = document.querySelector('.screen.active');
        if (currentScreen) {
            currentScreen.classList.remove('active');
        }
        
        // Показываем экран редактирования
        screenManager.show('screen-profile-edit');
        
        // Загружаем данные профиля (один раз)
        this.loadProfileDataModern();
    },
    
    // Загрузить данные профиля в новую форму
    async loadProfileDataModern() {
        try {
            console.log('🔄 Загрузка данных профиля для редактирования...');
            const user = authModule.currentUser;
            
            let { data, error } = await this.app.supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (error && error.code === 'PGRST116') {
                console.log('📝 Профиль не найден, создаем...');
                await this.ensureProfileExists(user);
                
                const result = await this.app.supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                    
                data = result.data;
                error = result.error;
            }
            
            if (error) {
                console.error('❌ Ошибка загрузки профиля:', error);
                return;
            }
            
            console.log('✅ Загружены данные профиля:', data);
            
            // Заполняем модерн форму
            this.fillModernForm(data, user);
            
            // Загружаем аватар
            this.loadAvatarFromProfile(data);
            
            // Обновляем счетчик био
            const bioCounter = document.getElementById('bio-counter-modern');
            if (bioCounter && data.bio) {
                bioCounter.textContent = `${data.bio.length} / 500`;
            }
            
            // Обновляем предпросмотр аватара
            this.updateAvatarPreview(data.nickname || user.nickname);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных профиля:', error);
        }
    },

    // Загрузить аватар из данных профиля
    loadAvatarFromProfile(profileData) {
        if (profileData.avatar_url) {
            this.updateProfileAvatar(profileData.avatar_url, profileData.nickname);
        } else {
            // Скрываем изображение и показываем букву
            const editImg = document.getElementById('edit-avatar-img');
            const editText = document.getElementById('edit-avatar-text');
            
            if (editImg && editText) {
                editImg.classList.add('hidden');
                editText.style.display = 'block';
            }
        }
    },

    // Заполнить модерн форму данными
    fillModernForm(profileData, userData) {
        console.log('📝 Заполнение формы данными профиля...');
        
        // Никнейм
        const nicknameInput = document.getElementById('edit-nickname');
        if (nicknameInput) {
            nicknameInput.value = profileData.nickname || userData.nickname || '';
        }
        
        // ФИО
        const fullNameInput = document.getElementById('edit-full-name-modern');
        if (fullNameInput) {
            fullNameInput.value = profileData.full_name || '';
        }
        
        // ВК
        const vkInput = document.getElementById('edit-vk-url-modern');
        if (vkInput) {
            vkInput.value = profileData.vk_url || '';
        }
        
        // Возраст
        const ageInput = document.getElementById('edit-age-modern');
        if (ageInput) {
            ageInput.value = profileData.age || '';
        }
        
        // Био
        const bioInput = document.getElementById('edit-bio-modern');
        if (bioInput) {
            bioInput.value = profileData.bio || '';
        }
        
        // Email
        const emailInput = document.getElementById('edit-email');
        if (emailInput) {
            emailInput.value = userData.email || '';
        }
        
        // Телефон
        const phoneInput = document.getElementById('edit-phone');
        if (phoneInput) {
            phoneInput.value = profileData.phone || '';
        }
        
        // Пол
        const gender = profileData.gender || 'not_set';
        const genderRadio = document.getElementById(`edit-gender-${gender}`);
        if (genderRadio) {
            genderRadio.checked = true;
        } else {
            const defaultRadio = document.getElementById('edit-gender-not-set');
            if (defaultRadio) defaultRadio.checked = true;
        }
        
        // Город
        const citySelect = document.getElementById('edit-city');
        if (citySelect) {
            citySelect.value = profileData.city || '';
        }
    },
    
    // Сохранить изменения профиля (модерн версия) - ОДИН вызов
    async saveProfileModern() {
        // Защита от повторных вызовов
        if (this.isSaving) {
            console.log('⚠️ Сохранение уже в процессе, пропускаем...');
            return;
        }

        this.isSaving = true;

        if (!authModule.isAuthenticated()) {
            alert('Сначала войдите в систему');
            this.isSaving = false;
            return;
        }

        const userId = authModule.getUserId();
        const btn = document.querySelector('.btn-save-large');
        const originalText = btn ? btn.innerHTML : '';

        try {
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
                btn.disabled = true;
            }
            
            // Загружаем аватар, если есть
            let avatarUrl = null;
            if (this.pendingAvatar) {
                avatarUrl = await this.uploadAvatarToStorage();
            }
            
            // Собираем данные из модерн формы
            const profileData = {
                full_name: this.getValue('edit-full-name-modern'),
                vk_url: this.getValue('edit-vk-url-modern'),
                gender: this.getSelectedGender(),
                age: this.getNumberValue('edit-age-modern'),
                bio: this.getValue('edit-bio-modern'),
                phone: this.getValue('edit-phone'),
                city: this.getValue('edit-city'),
                updated_at: new Date().toISOString()
            };
            
            // Добавляем URL аватара, если он был загружен
            if (avatarUrl) {
                profileData.avatar_url = avatarUrl;
            }
            
            console.log('📤 Отправка данных профиля:', profileData);
            
            // Проверка возраста
            if (profileData.age && (profileData.age < 1 || profileData.age > 120)) {
                alert('Пожалуйста, укажите корректный возраст (от 1 до 120 лет)');
                this.isSaving = false;
                return;
            }
            
            // ОДИН запрос к базе данных
            const { data, error } = await this.app.supabase
                .from('profiles')
                .update(profileData)
                .eq('id', userId)
                .select();
            
            if (error) {
                console.error('❌ Ошибка Supabase при сохранении:', error);
                throw new Error(error.message || 'Ошибка сервера');
            }
            
            console.log('✅ Данные профиля успешно сохранены:', data);
            
            // Обновляем текущего пользователя
            if (authModule.currentUser) {
                authModule.currentUser = {
                    ...authModule.currentUser,
                    ...profileData
                };
            }
            
            // Обновляем аватар ВО ВСЕХ МЕСТАХ
            const nickname = this.getValue('edit-nickname') || authModule.currentUser.nickname;
            this.updateAllAvatars(avatarUrl, nickname);
            
            // Сбрасываем pending avatar
            this.pendingAvatar = null;
            
            // Показываем уведомление об успехе
            this.showSuccessMessage();
            
            // Возвращаемся к профилю
            setTimeout(() => {
                this.backToProfile();
                this.isSaving = false;
            }, 1000);
            
        } catch (error) {
            console.error('❌ Ошибка сохранения профиля:', error);
            alert('Ошибка сохранения профиля: ' + (error.message || 'Неизвестная ошибка'));
            this.isSaving = false;
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    },
    
    // Вспомогательные методы
    getValue(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return null;
        const value = element.value.trim();
        return value || null;
    },
    
    getNumberValue(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return null;
        const value = element.value.trim();
        return value ? parseInt(value) : null;
    },
    
    getSelectedGender() {
        const selectedRadio = document.querySelector('input[name="gender"]:checked');
        return selectedRadio ? selectedRadio.value : 'not_set';
    },
    
    // Вернуться к профилю (без лишних обновлений)
    backToProfile() {
        console.log('🔙 Возврат к профилю...');
        
        // Просто показываем экран профиля
        screenManager.show('screen-profile');
        
        // Обновляем профиль - но ОДИН раз и без рекурсии
        setTimeout(() => {
            if (typeof navigationModule !== 'undefined' && navigationModule.showProfile) {
                navigationModule.showProfile();
            }
        }, 100);
    },
    
    // Загрузить данные профиля в старую форму (для совместимости)
    async loadProfileData() {
        try {
            const user = authModule.currentUser;
            
            const { data, error } = await this.app.supabase
                .from('profiles')
                .select('full_name, vk_url, gender, age, bio')
                .eq('id', user.id)
                .single();
            
            if (error) {
                console.error('❌ Ошибка загрузки профиля:', error);
                return;
            }
            
            // Заполняем старую форму
            document.getElementById('edit-full-name').value = data.full_name || '';
            document.getElementById('edit-vk-url').value = data.vk_url || '';
            document.getElementById('edit-gender').value = data.gender || 'not_set';
            document.getElementById('edit-age').value = data.age || '';
            document.getElementById('edit-bio').value = data.bio || '';
            
            const bioCounter = document.getElementById('bio-counter');
            if (bioCounter) {
                bioCounter.textContent = `${data.bio?.length || 0} / 500`;
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных профиля:', error);
        }
    },
    
    // Сохранить изменения профиля (старая версия)
    async saveProfile() {
        if (!authModule.isAuthenticated()) {
            alert('Сначала войдите в систему');
            return;
        }
        
        const userId = authModule.getUserId();
        const btn = document.querySelector('#profile-edit-form .btn-primary');
        const originalText = btn ? btn.innerHTML : '';
        
        try {
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
                btn.disabled = true;
            }
            
            const profileData = {
                full_name: document.getElementById('edit-full-name').value.trim() || null,
                vk_url: document.getElementById('edit-vk-url').value.trim() || null,
                gender: document.getElementById('edit-gender').value,
                age: document.getElementById('edit-age').value ? parseInt(document.getElementById('edit-age').value) : null,
                bio: document.getElementById('edit-bio').value.trim() || null,
                updated_at: new Date().toISOString()
            };
            
            if (profileData.age && (profileData.age < 1 || profileData.age > 120)) {
                alert('Пожалуйста, укажите корректный возраст (от 1 до 120 лет)');
                return;
            }
            
            const { data, error } = await this.app.supabase
                .from('profiles')
                .update(profileData)
                .eq('id', userId)
                .select();
            
            if (error) throw error;
            
            authModule.currentUser = { ...authModule.currentUser, ...profileData };
            
            this.showSuccessMessage();
            
            setTimeout(() => {
                this.backToProfile();
            }, 1500);
            
        } catch (error) {
            console.error('❌ Ошибка сохранения профиля:', error);
            alert('Ошибка сохранения профиля: ' + error.message);
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    },
    
    // Показать сообщение об успешном сохранении
    showSuccessMessage() {
        const notification = document.createElement('div');
        notification.className = 'save-success-message show';
        notification.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, var(--accent-green), #00cc6a);
            color: #000;
            padding: 16px 24px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-weight: 600;
            box-shadow: 0 10px 30px rgba(0, 255, 136, 0.3);
            z-index: 1000;
            animation: slideInUp 0.3s ease-out;
        `;
        notification.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>Профиль успешно сохранен</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutDown 0.3s ease-in';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 2000);
    },
    
    // Обновить отображение личной информации в профиле (старая версия)
    async updatePersonalInfoDisplay() {
        if (!authModule.isAuthenticated()) return;
        
        try {
            const user = authModule.currentUser;
            
            const { data, error } = await this.app.supabase
                .from('profiles')
                .select('full_name, vk_url, gender, age, bio')
                .eq('id', user.id)
                .single();
            
            if (error) {
                console.error('❌ Ошибка загрузки личной информации:', error);
                return;
            }
            
            // ФИО
            const fullNameEl = document.getElementById('profile-full-name-value');
            if (fullNameEl) {
                if (data.full_name) {
                    fullNameEl.textContent = data.full_name;
                    document.getElementById('profile-full-name-row').classList.remove('hidden');
                } else {
                    document.getElementById('profile-full-name-row').classList.add('hidden');
                }
            }
            
            // ВК
            const vkEl = document.getElementById('profile-vk-value');
            const vkRow = document.getElementById('profile-vk-row');
            if (vkEl && vkRow) {
                if (data.vk_url) {
                    vkEl.href = data.vk_url;
                    vkEl.textContent = data.vk_url.replace('https://', '');
                    vkRow.classList.remove('hidden');
                } else {
                    vkRow.classList.add('hidden');
                }
            }
            
            // Пол
            const genderEl = document.getElementById('profile-gender-value');
            if (genderEl) {
                const genderMap = {
                    'not_set': 'Не указан',
                    'male': 'Мужской',
                    'female': 'Женский'
                };
                genderEl.textContent = genderMap[data.gender] || 'Не указан';
                document.getElementById('profile-gender-row').classList.remove('hidden');
            }
            
            // Возраст
            const ageEl = document.getElementById('profile-age-value');
            if (ageEl) {
                if (data.age) {
                    ageEl.textContent = `${data.age} лет`;
                    document.getElementById('profile-age-row').classList.remove('hidden');
                } else {
                    document.getElementById('profile-age-row').classList.add('hidden');
                }
            }
            
            // О себе
            const bioEl = document.getElementById('profile-bio-value');
            if (bioEl) {
                if (data.bio) {
                    bioEl.textContent = data.bio;
                    document.getElementById('profile-bio-row').classList.remove('hidden');
                } else {
                    document.getElementById('profile-bio-row').classList.add('hidden');
                }
            }
            
        } catch (error) {
            console.error('❌ Ошибка обновления личной информации:', error);
        }
    },
    
    // ========== МЕТОДЫ ДЛЯ НОВОГО ДИЗАЙНА ==========
    
    // Обновить весь модерн UI профиля
    async updateModernUI() {
        if (!authModule.isAuthenticated()) return;
        
        const user = authModule.currentUser;
        
        // Обновляем отображение профиля
        await this.updateProfileDisplay();
        
        // Обновляем статистику
        await this.loadProfileStats();
        
        // Обновляем подписку
        await this.updateSubscriptionModern();
        
        // Загружаем команды пользователя
        await this.loadUserTeams();
        
        // Обновляем роль пользователя
        await this.updateUserRole();
        
        // Обновляем бейджи приглашений
        await this.updateInvitationsBadge();
    },
    
    // Загрузить статистику профиля
    async loadProfileStats() {
        try {
            const userId = authModule.getUserId();
            
            // 1. Получаем количество команд пользователя
            const { data: teamsData, error: teamsError } = await this.app.supabase
                .from('team_players')
                .select('team_id')
                .eq('user_id', userId)
                .eq('invitation_status', 'accepted');
            
            let teamsCount = teamsData?.length || 0;
            
            // 2. Получаем количество матчей пользователя через его команды
            let matchesCount = 0;
            if (teamsCount > 0) {
                const teamIds = teamsData.map(t => t.team_id);
                
                // Используем правильный синтаксис для or запроса
                const { data: matchesData, error: matchesError } = await this.app.supabase
                    .from('matches')
                    .select('id')
                    .or(`team1.in.(${teamIds.join(',')}),team2.in.(${teamIds.join(',')})`);
                
                if (!matchesError && matchesData) {
                    matchesCount = matchesData.length;
                }
            }
            
            // 3. Вместо друзей считаем количество уникальных пользователей в тех же командах
            let connectionsCount = 0;
            if (teamsCount > 0) {
                const teamIds = teamsData.map(t => t.team_id);
                
                // Получаем всех участников тех же команд (исключая текущего пользователя)
                const { data: teamPlayers, error: teamPlayersError } = await this.app.supabase
                    .from('team_players')
                    .select('user_id')
                    .in('team_id', teamIds)
                    .eq('invitation_status', 'accepted')
                    .neq('user_id', userId);
                
                if (!teamPlayersError && teamPlayers) {
                    // Убираем дубликаты по user_id
                    const uniqueConnections = [...new Set(teamPlayers.map(p => p.user_id))];
                    connectionsCount = Math.min(uniqueConnections.length, 99);
                }
            }
            
            // 4. Обновляем DOM элементы
            const matchesEl = document.getElementById('profile-matches-count');
            const teamsEl = document.getElementById('profile-teams-count');
            const friendsEl = document.getElementById('profile-friends-count');
            
            if (matchesEl) matchesEl.textContent = matchesCount;
            if (teamsEl) teamsEl.textContent = teamsCount;
            if (friendsEl) friendsEl.textContent = connectionsCount;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            
            // Устанавливаем значения по умолчанию при ошибке
            const matchesEl = document.getElementById('profile-matches-count');
            const teamsEl = document.getElementById('profile-teams-count');
            const friendsEl = document.getElementById('profile-friends-count');
            
            if (matchesEl) matchesEl.textContent = '0';
            if (teamsEl) teamsEl.textContent = '0';
            if (friendsEl) friendsEl.textContent = '0';
        }
    },
    
    // Обновить отображение профиля на главном экране
    async updateProfileDisplay() {
        try {
            const user = authModule.currentUser;
            
            // Загружаем данные профиля
            const { data, error } = await this.app.supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (error) {
                console.error('❌ Ошибка загрузки профиля для отображения:', error);
                return;
            }
            
            console.log('📊 Данные для отображения в профиле:', data);
            
            // Обновляем все элементы
            this.updateProfileElements(data, user);
            
        } catch (error) {
            console.error('❌ Ошибка updateProfileDisplay:', error);
        }
    },
    
    // Обновить элементы профиля
    updateProfileElements(profileData, userData) {
    // ФИО - показываем как бейдж
    const fullNameValue = profileData.full_name;
    const fullNameBadge = document.getElementById('profile-full-name-badge');
    const fullNameEl = document.getElementById('profile-full-name-value-modern');
    
    if (fullNameBadge && fullNameEl) {
        if (fullNameValue) {
            fullNameEl.textContent = fullNameValue;
            fullNameBadge.classList.remove('hidden');
        } else {
            fullNameBadge.classList.add('hidden');
        }
    }
    
    // Возраст - показываем как бейдж
    const ageValue = profileData.age;
    const ageBadge = document.getElementById('profile-age-badge');
    const ageEl = document.getElementById('profile-age-value-modern');
    
    if (ageBadge && ageEl) {
        if (ageValue) {
            ageEl.textContent = ageValue + ' лет';
            ageBadge.classList.remove('hidden');
        } else {
            ageBadge.classList.add('hidden');
        }
    }
    
    // Пол - показываем как бейдж
    const genderValue = profileData.gender;
    const genderBadge = document.getElementById('profile-gender-badge');
    const genderEl = document.getElementById('profile-gender-value-modern');
    
    if (genderBadge && genderEl) {
        if (genderValue && genderValue !== 'not_set') {
            const genderMap = {
                'male': 'Мужской',
                'female': 'Женский'
            };
            genderEl.textContent = genderMap[genderValue] || genderValue;
            genderBadge.classList.remove('hidden');
        } else {
            genderBadge.classList.add('hidden');
        }
    }
    
    // ВК - показываем как соц.ссылку
    const vkValue = profileData.vk_url;
    const vkLink = document.getElementById('profile-vk-link');
    
    if (vkLink) {
        if (vkValue) {
            vkLink.href = vkValue;
            vkLink.classList.remove('hidden');
        } else {
            vkLink.classList.add('hidden');
        }
    }
    
    // Телефон - показываем как соц.ссылку
    const phoneValue = profileData.phone;
    const phoneLink = document.getElementById('profile-phone-link');
    
    if (phoneLink) {
        if (phoneValue) {
            phoneLink.href = 'tel:' + phoneValue;
            const phoneLabel = phoneLink.querySelector('.social-label');
            if (phoneLabel) phoneLabel.textContent = phoneValue;
            phoneLink.classList.remove('hidden');
        } else {
            phoneLink.classList.add('hidden');
        }
    }
    
    // Биография - основной текст
    const bioValue = profileData.bio;
    const bioContainer = document.getElementById('profile-bio-container');
    const bioEl = document.getElementById('profile-bio-value-modern');
    
    if (bioContainer && bioEl) {
        if (bioValue) {
            bioEl.textContent = bioValue;
            bioEl.classList.remove('placeholder');
        } else {
            bioEl.textContent = 'Расскажите о своих спортивных интересах и достижениях';
            bioEl.classList.add('placeholder');
        }
    }
    
    // Проверяем, есть ли вообще данные для показа
    this.checkEmptyState();
    
    // Город
    const cityEl = document.getElementById('profile-city-modern');
    if (cityEl && profileData.city) {
        cityEl.innerHTML = `<i class="fas fa-map-marker-alt" style="font-size: 0.7rem;"></i> ${this.getCityName(profileData.city)}`;
    }
    
    // Имя пользователя
    const nameEl = document.getElementById('profile-name-modern');
    if (nameEl) {
        nameEl.textContent = profileData.nickname || userData.nickname || 'User';
    }
    
    // Обновляем аватар ВО ВСЕХ МЕСТАХ
    this.updateAllAvatars(profileData.avatar_url, profileData.nickname || userData.nickname);
},

// Проверить, нужно ли показывать пустое состояние
checkEmptyState() {
    const hasFullName = !document.getElementById('profile-full-name-badge')?.classList.contains('hidden');
    const hasAge = !document.getElementById('profile-age-badge')?.classList.contains('hidden');
    const hasGender = !document.getElementById('profile-gender-badge')?.classList.contains('hidden');
    const hasVk = !document.getElementById('profile-vk-link')?.classList.contains('hidden');
    const hasPhone = !document.getElementById('profile-phone-link')?.classList.contains('hidden');
    const hasBio = document.getElementById('profile-bio-value-modern')?.textContent && 
                   !document.getElementById('profile-bio-value-modern')?.classList.contains('placeholder');

    const hasAnyData = hasFullName || hasAge || hasGender || hasVk || hasPhone || hasBio;

    const emptyState = document.getElementById('about-empty-state');
    const contentElements = document.querySelectorAll('.about-bio, .about-badges, .about-socials');
    
    if (emptyState) {
        if (hasAnyData) {
            emptyState.classList.add('hidden');
            contentElements.forEach(el => el.style.display = '');
        } else {
            emptyState.classList.remove('hidden');
            contentElements.forEach(el => el.style.display = 'none');
        }
    }
},
    
    // Обновить элемент информации (помощник)
    updateInfoItemModern(containerId, valueId, value, placeholder, isLink = false) {
        const container = document.getElementById(containerId);
        const valueEl = document.getElementById(valueId);
        
        if (!container || !valueEl) return;
        
        if (value && value.trim() !== '') {
            container.classList.remove('hidden');
            
            if (isLink && valueEl.tagName === 'A') {
                valueEl.href = value;
                valueEl.textContent = value.replace('https://', '').replace('www.', '');
            } else {
                valueEl.textContent = value;
            }
        } else {
            if (placeholder) {
                container.classList.remove('hidden');
                valueEl.textContent = placeholder;
                if (valueEl.classList) {
                    valueEl.classList.add('placeholder-text');
                }
            } else {
                container.classList.add('hidden');
            }
        }
    },
    
    // Обновить отображение подписки
    async updateSubscriptionModern() {
        if (!authModule.isAuthenticated()) return;
        
        const user = authModule.currentUser;
        const proCard = document.getElementById('subscription-card-modern');
        const freeCard = document.getElementById('free-subscription-card');
        
        if (user.role === 'organizer' && authModule.isProActive()) {
            // Показываем PRO карточку
            if (proCard) proCard.classList.remove('hidden');
            if (freeCard) freeCard.classList.add('hidden');
            
            // Обновляем статус
            const statusEl = document.getElementById('sub-status-modern');
            const dateEl = document.getElementById('sub-date-modern');
            
            if (user.subscription_expiry) {
                const expiryDate = new Date(user.subscription_expiry);
                const now = new Date();
                
                if (expiryDate > now) {
                    if (statusEl) {
                        statusEl.textContent = 'Активна';
                        statusEl.style.color = '#00ff88';
                    }
                    if (dateEl) {
                        dateEl.textContent = expiryDate.toLocaleDateString('ru-RU');
                    }
                } else {
                    if (statusEl) {
                        statusEl.textContent = 'Истекла';
                        statusEl.style.color = '#ff6b6b';
                    }
                    if (dateEl) {
                        dateEl.textContent = expiryDate.toLocaleDateString('ru-RU');
                    }
                }
            }
        } else {
            // Показываем бесплатную карточку
            if (proCard) proCard.classList.add('hidden');
            if (freeCard) freeCard.classList.remove('hidden');
        }
    },
    
    // Загрузить команды пользователя
    async loadUserTeams() {
        try {
            const userId = authModule.getUserId();
            const teamsCard = document.getElementById('my-teams-card');
            const teamsList = document.getElementById('profile-teams-list');
            
            if (!teamsCard || !teamsList) return;
            
            const { data: teams, error } = await this.app.supabase
                .from('team_players')
                .select(`
                    teams (
                        id,
                        name,
                        logo_url,
                        sport,
                        city
                    )
                `)
                .eq('user_id', userId)
                .eq('invitation_status', 'accepted');
            
            if (error) throw error;
            
            if (!teams || teams.length === 0) {
                teamsCard.classList.add('hidden');
                return;
            }
            
            teamsCard.classList.remove('hidden');
            
            // Отображаем первые 3 команды
            const displayTeams = teams.slice(0, 3);
            
            teamsList.innerHTML = displayTeams.map(item => {
    const team = item.teams;
    return `
        <div class="team-card-mini" onclick="teamModule.show('${team.id}')">
            <div class="team-avatar-mini">
                ${team.logo_url ? 
                    `<img src="${team.logo_url}" alt="${team.name}">` : 
                    `<span>${team.name.charAt(0)}</span>`
                }
            </div>
            <div class="team-info-mini">
                <div class="team-name-mini">${team.name}</div>
                <div class="team-meta-mini">
                    <span class="team-sport-mini">${app.getSportName(team.sport)}</span>
                    <span class="team-city-mini">${initModule.cities[team.city]?.name || team.city}</span>
                </div>
            </div>
        </div>
    `;
}).join('');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки команд пользователя:', error);
        }
    },
    
    // Обновить роль пользователя
    async updateUserRole() {
        if (!authModule.isAuthenticated()) return;
        
        const user = authModule.currentUser;
        const roleEl = document.getElementById('profile-role-modern');
        const proBadge = document.getElementById('profile-pro-badge-large');
        
        if (!roleEl) return;
        
        // Обновляем PRO бейдж
        if (proBadge) {
            proBadge.classList.toggle('hidden', !authModule.isProActive());
        }
        
        // Определяем текст роли (только роль, без команд)
        let roleText = '';
        
        if (user.role === 'organizer') {
            if (authModule.isProActive()) {
                roleText = 'Организатор PRO';
            } else {
                roleText = 'Организатор';
            }
        } else {
            roleText = 'Болельщик';
        }
        
        roleEl.textContent = roleText;
    },
    
    // Обновить бейдж приглашений
    async updateInvitationsBadge() {
        try {
            const userId = authModule.getUserId();
            const { data: invitations, error } = await this.app.supabase
                .from('team_players')
                .select('id')
                .eq('user_id', userId)
                .eq('invitation_status', 'pending');
            
            if (error) throw error;
            
            const badgeCount = invitations ? invitations.length : 0;
            const badgeElement = document.getElementById('invitations-badge');
            const countBadge = document.getElementById('invitations-count-badge');
            
            if (badgeElement) {
                if (badgeCount > 0) {
                    badgeElement.textContent = badgeCount > 9 ? '9+' : badgeCount;
                    badgeElement.classList.remove('hidden');
                } else {
                    badgeElement.classList.add('hidden');
                }
            }
            
            if (countBadge) {
                if (badgeCount > 0) {
                    countBadge.textContent = badgeCount > 9 ? '9+' : badgeCount;
                    countBadge.classList.remove('hidden');
                } else {
                    countBadge.classList.add('hidden');
                }
            }
            
        } catch (error) {
            console.error('❌ Ошибка обновления бейджа приглашений:', error);
        }
    },
    
    // Получить название города по коду
    getCityName(cityCode) {
        const cityMap = {
            'obninsk': 'Обнинск',
            'moscow': 'Москва',
            'spb': 'Санкт-Петербург',
            'kazan': 'Казань',
            'ekb': 'Екатеринбург',
            'novosibirsk': 'Новосибирск'
        };
        
        return cityMap[cityCode] || cityCode;
    },
    
    // Обновить предпросмотр аватара
    updateAvatarPreview(nickname) {
        const avatarText = document.getElementById('edit-avatar-text');
        if (avatarText) {
            avatarText.textContent = nickname[0].toUpperCase();
        }
    },
    
    
    
    // Инициализация при загрузке страницы
    onPageLoad() {
        if (authModule.isAuthenticated()) {
            // Обновляем UI профиля
            this.updateModernUI();
            
            // Проверяем, находимся ли мы на экране профиля
            if (document.getElementById('screen-profile')?.classList.contains('active')) {
                this.updateModernUI();
            }
        }
    }
};

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    // Экспортируем глобально
    window.profileModule = profileModule;
});