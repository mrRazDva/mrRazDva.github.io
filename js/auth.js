// Модуль аутентификации для Street League с Supabase
const authModule = {
    supabase: null,
    currentUser: null,
    
    async init() {
        try {
            this.supabase = window.supabaseClient;
            
            if (!this.supabase) {
                throw new Error('Supabase клиент не найден');
            }
            
            // Проверяем текущую сессию
            await this.checkSession();
            
            // Настраиваем слушатель
            this.setupAuthListener();
            
            return this.isAuthenticated();
            
        } catch (error) {
            console.error('❌ Ошибка инициализации AuthModule:', error);
            return false;
        }
		
		
    },
  
  
  
    // ========== РЕГИСТРАЦИЯ ==========
    async register(userData) {
        try {
            const { nickname, email, password, role, phone } = userData;
            
            console.log('📝 Регистрация пользователя:', { nickname, email, role });
            
            // Регистрация в Supabase
            const { data: authData, error: authError } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        nickname: nickname,
                        role: role || 'fan',
                        phone: phone || null
                    },
                    emailRedirectTo: window.location.origin
                }
            });
            
            if (authError) throw authError;
            
            console.log('✅ Пользователь зарегистрирован в Auth:', authData.user?.id);
            
            // Ждем немного и пытаемся получить профиль
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            let profile = null;
            if (authData.user) {
                profile = await this.getProfile(authData.user.id);
                
                // Если профиля нет, создаем вручную
                if (!profile) {
                    console.log('📝 Создаем профиль вручную...');
                    const { error: upsertError } = await this.supabase
                        .from('profiles')
                        .upsert([
                            {
                                id: authData.user.id,
                                nickname: nickname,
                                role: role || 'fan',
                                subscription_active: role === 'organizer',
                                subscription_expiry: role === 'organizer' 
                                    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                                    : null,
                                phone: phone || null,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }
                        ], {
                            onConflict: 'id'
                        });
                    
                    if (!upsertError) {
                        profile = await this.getProfile(authData.user.id);
                    }
                }
            }
            
            // Автоматически входим после регистрации
            if (authData.user && !authData.session) {
                const { data: signInData, error: signInError } = await this.supabase.auth.signInWithPassword({
                    email,
                    password
                });
                
                if (!signInError) {
                    authData.session = signInData.session;
                    authData.user = signInData.user;
                }
            }
            
            return {
                success: true,
                user: profile || {
                    id: authData.user?.id,
                    nickname,
                    email,
                    role: role || 'fan',
                    subscriptionActive: role === 'organizer',
                    subscriptionExpiry: role === 'organizer' 
                        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        : null,
                    phone: phone || null
                },
                message: 'Регистрация успешна! Проверьте email для подтверждения.'
            };
            
        } catch (error) {
            console.error('❌ Ошибка регистрации:', error);
            
            let errorMessage = error.message;
            
            if (error.message.includes('already registered') || error.message.includes('User already registered')) {
                errorMessage = 'Пользователь с таким email уже существует';
            } else if (error.message.includes('password') || error.message.includes('Password')) {
                errorMessage = 'Пароль должен быть не менее 6 символов';
            } else if (error.message.includes('email') || error.message.includes('Email')) {
                errorMessage = 'Неверный формат email';
            } else if (error.message.includes('Failed to fetch') || error.message.includes('Network error')) {
                errorMessage = 'Проблемы с подключением к серверу. Проверьте интернет-соединение.';
            }
            
            return {
                success: false,
                error: errorMessage
            };
        }
    },
    
    // ========== ВХОД ==========
    async login(credentials) {
        try {
            const { email, password } = credentials;
            
            console.log('🔑 Вход пользователя:', email);
            
            // Вход в Supabase
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            console.log('✅ Успешный вход:', data.user?.id);
            
            // Получаем профиль пользователя
            const profile = await this.getProfile(data.user.id);
            
            return {
                success: true,
                user: profile,
                session: data.session
            };
            
        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            
            let errorMessage = error.message;
            
            if (error.message.includes('Invalid login credentials')) {
                errorMessage = 'Неверный email или пароль';
            } else if (error.message.includes('Email not confirmed')) {
                errorMessage = 'Подтвердите email перед входом. Проверьте вашу почту.';
            } else if (error.message.includes('Failed to fetch') || error.message.includes('Network error')) {
                errorMessage = 'Проблемы с подключением к серверу. Проверьте интернет-соединение.';
            } else if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
                errorMessage = 'Слишком много попыток входа. Попробуйте позже.';
            }
            
            return {
                success: false,
                error: errorMessage
            };
        }
    },
    
    // ========== ВЫХОД ==========
    async logout() {
        try {
            const { error } = await this.supabase.auth.signOut();
            
            if (error) throw error;
            
            this.currentUser = null;
            console.log('👋 Пользователь вышел из системы');
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Ошибка выхода:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ========== ПРОВЕРКА СЕССИИ ==========
    async checkSession() {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) throw error;
            
            if (session?.user) {
                const profile = await this.getProfile(session.user.id);
                this.currentUser = profile;
                console.log('✅ Сессия активна:', profile?.nickname);
            } else {
                this.currentUser = null;
            }
            
            return { success: true, user: this.currentUser };
            
        } catch (error) {
            console.error('❌ Ошибка проверки сессии:', error);
            this.currentUser = null;
            return { success: false, error: error.message };
        }
    },
    
    // ========== ПОЛУЧЕНИЕ ПРОФИЛЯ ==========
    async getProfile(userId) {
        try {
            if (!userId) {
                const { data: { user } } = await this.supabase.auth.getUser();
                userId = user?.id;
            }
            
            if (!userId) return null;
            
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            
            if (error) {
                console.warn('⚠️ Ошибка получения профиля:', error.message);
                return null;
            }
            
            // Добавляем email из auth
            if (!profile.email) {
                const { data: { user } } = await this.supabase.auth.getUser();
                profile.email = user?.email;
            }
            
            return profile;
            
        } catch (error) {
            console.error('❌ Ошибка получения профиля:', error);
            return null;
        }
    },
    
    // ========== ОБНОВЛЕНИЕ ПРОФИЛЯ ==========
    async updateProfile(updates) {
        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            
            if (!user) {
                throw new Error('Пользователь не авторизован');
            }
            
            const { data, error } = await this.supabase
                .from('profiles')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id)
                .select()
                .single();
            
            if (error) throw error;
            
            // Обновляем текущего пользователя
            this.currentUser = data;
            
            return {
                success: true,
                user: data
            };
            
        } catch (error) {
            console.error('❌ Ошибка обновления профиля:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // ========== СБРОС ПАРОЛЯ ==========
    async resetPassword(email) {
        try {
            const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`
            });
            
            if (error) throw error;
            
            return {
                success: true,
                message: 'Инструкции по сбросу пароля отправлены на email'
            };
            
        } catch (error) {
            console.error('❌ Ошибка сброса пароля:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // ========== УПРАВЛЕНИЕ ПОДПИСКОЙ ==========
    async upgradeToPro() {
        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            
            if (!user) {
                throw new Error('Пользователь не авторизован');
            }
            
            const { data, error } = await this.supabase
                .from('profiles')
                .update({
                    role: 'organizer',
                    subscription_active: true,
                    subscription_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id)
                .select()
                .single();
            
            if (error) throw error;
            
            this.currentUser = data;
            
            return {
                success: true,
                user: data,
                message: 'Подписка PRO активирована!'
            };
            
        } catch (error) {
            console.error('❌ Ошибка обновления подписки:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // ========== ПРОВЕРКИ ==========
    isAuthenticated() {
        return !!this.currentUser;
    },
    
    hasRole(role) {
        return this.currentUser?.role === role;
    },
    
    isProActive() {
        if (!this.currentUser || this.currentUser.role !== 'organizer') {
            return false;
        }
        
        if (!this.currentUser.subscription_active) {
            return false;
        }
        
        if (this.currentUser.subscription_expiry) {
            const expiryDate = new Date(this.currentUser.subscription_expiry);
            return expiryDate > new Date();
        }
        
        return true;
    },
    
    // ========== СЛУШАТЕЛЬ ИЗМЕНЕНИЙ АУТЕНТИФИКАЦИИ ==========
    setupAuthListener() {
        this.supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('🔄 Изменение состояния аутентификации:', event);
            
            switch (event) {
                case 'SIGNED_IN':
                    if (session?.user) {
                        this.currentUser = await this.getProfile(session.user.id);
                        console.log('✅ Пользователь вошёл:', this.currentUser?.nickname);
                        
                        // Обновляем UI
                        if (typeof navigationModule !== 'undefined' && navigationModule.updateUserUI) {
                            navigationModule.updateUserUI();
                        }
                        
                        // Показываем главный экран через навигацию
                        setTimeout(() => {
                            if (typeof navigationModule !== 'undefined' && navigationModule.showMain) {
                                navigationModule.showMain();
                            } else if (typeof app !== 'undefined' && app.showMain) {
                                app.showMain();
                            }
                        }, 100);
                    }
                    break;
                    
                case 'SIGNED_OUT':
                    this.currentUser = null;
                    console.log('👋 Пользователь вышел');
                    
                    // Возвращаем на экран выбора роли
                    if (typeof screenManager !== 'undefined') {
                        setTimeout(() => screenManager.show('screen-role'), 100);
                    }
                    break;
                    
                case 'USER_UPDATED':
                    if (session?.user) {
                        this.currentUser = await this.getProfile(session.user.id);
                        console.log('📝 Профиль обновлён');
                        
                        // Обновляем UI
                        if (typeof navigationModule !== 'undefined' && navigationModule.updateUserUI) {
                            navigationModule.updateUserUI();
                        }
                    }
                    break;
                    
                case 'TOKEN_REFRESHED':
                    console.log('♻️ Токен обновлён');
                    break;
            }
        });
    },
    
    // ========== ПОЛУЧЕНИЕ ТОКЕНА ==========
    async getAccessToken() {
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            return session?.access_token || null;
        } catch (error) {
            console.error('❌ Ошибка получения токена:', error);
            return null;
        }
    },
    
    // ========== ПОЛУЧЕНИЕ ID ПОЛЬЗОВАТЕЛЯ ==========
    getUserId() {
        return this.currentUser?.id || null;
    },
    
    // ========== ПРОВЕРКА EMAIL ==========
    async checkEmailAvailability(email) {
        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('email')
                .eq('email', email)
                .single();
            
            // Если ошибка "не найдено" - email свободен
            if (error && error.code === 'PGRST116') {
                return { available: true };
            }
            
            if (error) throw error;
            
            return { available: false, message: 'Email уже используется' };
            
        } catch (error) {
            console.error('❌ Ошибка проверки email:', error);
            return { available: false, error: error.message };
        }
    }
};

// Инициализация при загрузке документа
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Инициализация AuthModule...');
    
    // Даем время на загрузку Supabase
    setTimeout(() => {
        authModule.init().then(() => {
            console.log('✅ AuthModule готов к работе');
            
            // Если пользователь авторизован, показываем главный экран
            if (authModule.isAuthenticated() && typeof navigationModule !== 'undefined') {
                setTimeout(() => {
                    navigationModule.showMain();
                }, 500);
            }
        }).catch(error => {
            console.error('❌ Ошибка инициализации AuthModule:', error);
        });
    }, 1000);
});



// Экспортируем глобально
window.authModule = authModule;