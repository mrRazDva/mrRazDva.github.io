const navigationModule = {
    app: null,
    
    init(appInstance) {
        this.app = appInstance;
        this.setupEventListeners();
    },
    
    setupEventListeners() {
        // Навигация по экранам
        this.setupScreenNavigation();
    },
    
    setupScreenNavigation() {
        // Управление видимостью навигации
        this.updateBottomNavVisibility();
    },
    
    // ========== НАВИГАЦИЯ ПО ЭКРАНАМ ==========
    
    // Роли и авторизация
    showRoleSelection() {
        screenManager.show('screen-role');
        this.app.selectedRole = 'fan';
        this.updateRoleUI();
    },
    
    selectRole(role) {
        this.app.selectedRole = role;
        this.updateRoleUI();
    },
    
    updateRoleUI() {
        document.querySelectorAll('.role-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.role === this.app.selectedRole);
        });
        
        utils.toggleActive(
            document.querySelector(`.role-option[data-role="${this.app.selectedRole}"]`),
            document.querySelector('.role-selector')
        );
        
        utils.hide('role-info-fan');
        utils.hide('role-info-organizer');
        utils.show(`role-info-${this.app.selectedRole}`);
        
        const btn = document.getElementById('continue-btn');
        btn.textContent = this.app.selectedRole === 'organizer' ? 'Перейти к оплате' : 'Продолжить';
    },
    
    goToAuth() {
        screenManager.show('screen-auth');
        
        const isOrganizer = this.app.selectedRole === 'organizer';
        document.getElementById('auth-subtitle').textContent = 
            isOrganizer ? 'Оформление подписки PRO' : 'Создай аккаунт болельщика';
        
        if (isOrganizer) {
            utils.show('phone-field');
            utils.hide('reg-btn');
            utils.show('pay-btn');
        } else {
            utils.hide('phone-field');
            utils.show('reg-btn');
            utils.hide('pay-btn');
        }
    },
    
    backToRole() {
        screenManager.show('screen-role');
    },
    
    showLogin() {
        screenManager.show('screen-login');
    },
    
    // ДОБАВЛЕНО: Метод для показа экрана приглашений
    showInvitations() {
        // Просто показываем профиль, так как приглашения уже отображаются там
        this.showProfile();
        
        // Можно добавить скролл к секции приглашений
        setTimeout(() => {
            const invitationsCard = document.getElementById('invitations-card');
            if (invitationsCard) {
                invitationsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
    },
    
    showForgotPassword() {
        const email = prompt('Введите email для восстановления пароля:');
        if (email) {
            authModule.resetPassword(email).then(result => {
                if (result.success) {
                    alert('Инструкции отправлены на ваш email');
                } else {
                    alert('Ошибка: ' + result.error);
                }
            });
        }
    },
    
    // ДОБАВЛЕНО: Метод для показа настроек (заглушка)
    showSettings() {
        alert('Раздел настроек находится в разработке');
        // В будущем можно добавить экран настроек
        // screenManager.show('screen-settings');
    },
    
    // Город
    showCitySelection() {
        screenManager.show('screen-city');
    },
    
    // Главный экран
    showMain() {
        screenManager.show('screen-main');
        this.updateUserUI();
        this.updateRoleBasedUI();
        matchesModule.renderMatches();
        this.updateChallengesNotification();
        
        // Проверяем новые приглашения
        this.checkNewInvitations();
    },
    
    // Хаб
    showHub() {
        screenManager.show('screen-hub');
        eventsModule.renderHub();
    },
    
    // Команды
    showTeams() {
        if (!authModule.isAuthenticated()) {
            alert('Сначала войдите в систему');
            this.showRoleSelection();
            return;
        }
        
        screenManager.show('screen-teams');
        teamsModule.renderMyTeams();
    },
    
    // Создание команды
    showCreateTeam() {
        if (!authModule.isAuthenticated()) {
            alert('Сначала войдите в систему');
            return;
        }
        
        if (!authModule.hasRole('organizer')) {
            alert('Только организаторы могут создавать команды');
            return;
        }
        
        screenManager.show('screen-create-team');
    },
    
    // Создание матча
    showCreateMatch() {
        if (!authModule.isAuthenticated()) {
            alert('Сначала войдите в систему');
            return;
        }
        
        if (!authModule.hasRole('organizer') || !authModule.isProActive()) {
            alert('Только организаторы с активной подпиской могут создавать матчи');
            return;
        }
        
        screenManager.show('screen-create-match');
        matchesModule.loadUserTeamsForMatch();
    },
    
    // Профиль
    async showProfile() {
    screenManager.show('screen-profile');
    
    if (authModule.isAuthenticated()) {
        const user = authModule.currentUser;
        
        // Базовое обновление UI
        const avatarTextEl = document.getElementById('profile-avatar-text');
        if (avatarTextEl) {
            avatarTextEl.textContent = user.nickname[0].toUpperCase();
        }
        
        const nameEl = document.getElementById('profile-name-modern');
        if (nameEl) {
            nameEl.textContent = user.nickname;
        }
        
        // Обновляем роль пользователя
        const userRole = await this.getUserRoleWithTeamInfo(user.id);
        const roleEl = document.getElementById('profile-role-modern');
        if (roleEl) {
            roleEl.textContent = userRole;
        }
        
        // PRO бейдж
        const proBadgeModern = document.getElementById('profile-pro-badge-large');
        if (proBadgeModern) {
            proBadgeModern.classList.toggle('hidden', !authModule.isProActive());
        }
        
        // ОДИН раз обновляем подписку и приглашения
        await this.renderSubscriptionCard(user);
        await this.loadInvitations();
        
        // НЕ вызываем profileModule.updateModernUI() здесь - пусть профиль сам обновляется при входе
    }
},
    
    // ОБНОВЛЕН: Метод для получения роли пользователя с информацией о команде
    async getUserRoleWithTeamInfo(userId) {
    try {
        // Проверяем, является ли пользователем игроком команды
        const { data: teamPlayers, error } = await this.app.supabase
            .from('team_players')
            .select(`
                teams (id, name, logo_url)
            `)
            .eq('user_id', userId)
            .eq('invitation_status', 'accepted')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Ошибка загрузки информации о команде:', error);
            // Возвращаем базовую роль при ошибке
            const user = authModule.currentUser;
            return user.role === 'organizer' ? 'Организатор PRO' : 'Болельщик';
        }

        // Если пользователь состоит в одной или нескольких командах
        if (teamPlayers && teamPlayers.length > 0) {
            const teams = teamPlayers.map(tp => tp.teams);
            
            // Если только одна команда
            if (teams.length === 1) {
                const teamName = teams[0].name;
                // Обрезаем длинное название команды
                if (teamName.length > 30) {
                    return `Игрок команды "${teamName.substring(0, 17)}..."`;
                }
                return `Игрок команды "${teamName}"`;
            }
            
            // Если несколько команд
            return `Игрок (${teams.length} команд)`;
        }

        // Если пользователь не состоит в командах, возвращаем базовую роль
        const user = authModule.currentUser;
        if (user.role === 'organizer') {
            return authModule.isProActive() ? 'Организатор PRO' : 'Организатор';
        } else {
            return 'Болельщик';
        }
        
    } catch (error) {
        console.error('Ошибка в getUserRoleWithTeamInfo:', error);
        const user = authModule.currentUser;
        return user.role === 'organizer' ? 'Организатор PRO' : 'Болельщик';
    }
},

    // ОБНОВЛЕН: Метод для отображения подписки с поддержкой нового дизайна
    async renderSubscriptionCard(user) {
        // Проверяем оба варианта контейнеров
        const subCardOld = document.getElementById('subscription-card');
        const subCardModern = document.getElementById('subscription-card-modern');
        const freeCard = document.getElementById('free-subscription-card');
        
        // Скрываем все карточки сначала
        if (subCardOld) subCardOld.classList.add('hidden');
        if (subCardModern) subCardModern.classList.add('hidden');
        if (freeCard) freeCard.classList.add('hidden');
        
        const statusEl = document.getElementById('sub-status-modern') || document.getElementById('sub-status');
        const dateEl = document.getElementById('sub-date-modern') || document.getElementById('sub-date');
        
        if (user.role === 'organizer') {
            if (authModule.isProActive() && user.subscription_expiry) {
                const expiryDate = new Date(user.subscription_expiry);
                const now = new Date();
                
                // Показываем PRO карточку
                if (subCardModern) {
                    subCardModern.classList.remove('hidden');
                } else if (subCardOld) {
                    subCardOld.classList.remove('hidden');
                }
                
                if (expiryDate > now) {
                    if (statusEl) {
                        statusEl.textContent = 'Активна';
                        statusEl.className = 'info-value status-active';
                        statusEl.style.color = '#00ff88';
                    }
                    if (dateEl) {
                        dateEl.textContent = expiryDate.toLocaleDateString('ru-RU');
                    }
                } else {
                    if (statusEl) {
                        statusEl.textContent = 'Истекла';
                        statusEl.className = 'info-value status-inactive';
                        statusEl.style.color = '#ff6b6b';
                    }
                    if (dateEl) {
                        dateEl.textContent = expiryDate.toLocaleDateString('ru-RU');
                    }
                }
            } else {
                // Если PRO, но подписка неактивна, показываем бесплатную карточку
                if (freeCard) {
                    freeCard.classList.remove('hidden');
                }
                
                if (statusEl) {
                    statusEl.textContent = 'Неактивна';
                    statusEl.className = 'info-value status-inactive';
                    if (dateEl) dateEl.textContent = '—';
                }
            }
        } else {
            // Для болельщиков показываем бесплатную карточку
            if (freeCard) {
                freeCard.classList.remove('hidden');
            } else if (subCardOld) {
                subCardOld.classList.remove('hidden');
            }
            
            if (statusEl) {
                statusEl.textContent = 'Базовый';
                statusEl.className = 'info-value';
                statusEl.style.color = 'var(--text-secondary)';
                if (dateEl && dateEl.parentElement) dateEl.parentElement.style.display = 'none';
            }
        }
    },
    
    // Добавьте новый метод для загрузки приглашений
    async loadInvitations() {
        const userId = authModule.getUserId();
        if (!userId) return;

        try {
            // Получаем приглашения пользователя
            const { data: invitations, error } = await this.app.supabase
                .from('team_players')
                .select(`
                    id,
                    team_id,
                    invitation_status,
                    teams (name, logo_url, sport, city)
                `)
                .eq('user_id', userId)
                .eq('invitation_status', 'pending');

            if (error) throw error;

            // Отображаем приглашения в соответствующем контейнере
            this.renderInvitationsForCurrentDesign(invitations || []);
        } catch (error) {
            console.error('❌ Ошибка загрузки приглашений:', error);
        }
    },
    
    // Новый метод: рендерит приглашения в зависимости от активного дизайна
    renderInvitationsForCurrentDesign(invitations) {
        // Проверяем, какой контейнер существует
        const modernContainer = document.getElementById('invitations-list-modern');
        const oldContainer = document.getElementById('invitations-list');
        
        if (modernContainer) {
            // Используем новый дизайн
            this.renderInvitationsModern(invitations);
            
            // Показываем/скрываем секцию
            const invitationsSection = document.getElementById('invitations-card');
            if (invitationsSection) {
                if (invitations.length === 0) {
                    invitationsSection.classList.add('hidden');
                } else {
                    invitationsSection.classList.remove('hidden');
                }
            }
        } else if (oldContainer) {
            // Используем старый дизайн
            this.renderInvitations(invitations);
            
            // Показываем/скрываем секцию
            const invitationsSection = document.getElementById('invitations-section');
            if (invitationsSection) {
                if (invitations.length === 0) {
                    invitationsSection.classList.add('hidden');
                } else {
                    invitationsSection.classList.remove('hidden');
                }
            }
        }
    },

    // Метод для отображения приглашений в новом дизайне
    renderInvitationsModern(invitations) {
        const container = document.getElementById('invitations-list-modern');
        if (!container) return;

        if (!invitations || invitations.length === 0) {
            container.innerHTML = `
                <div class="empty-invitations">
                    <i class="fas fa-envelope-open"></i>
                    <p>У вас нет новых приглашений</p>
                </div>
            `;
            return;
        }

        container.innerHTML = invitations.map(inv => {
            const team = inv.teams;
            return `
                <div class="invitation-card-modern" data-id="${inv.id}" data-team-id="${inv.team_id}">
                    <div class="invitation-header-modern">
                        <div class="invitation-team-avatar-modern">
                            ${team.logo_url ? 
                                `<img src="${team.logo_url}" alt="${team.name}">` : 
                                `<span>${team.name.charAt(0)}</span>`
                            }
                        </div>
                        <div class="invitation-info-modern">
                            <div class="invitation-team-name-modern">${team.name}</div>
                            <div class="invitation-details-modern">
                                <span class="invitation-sport-modern">
                                    <i class="fas fa-${app.getSportIcon(team.sport)}"></i>
                                    ${app.getSportName(team.sport)}
                                </span>
                                <span class="invitation-city-modern">
                                    <i class="fas fa-map-marker-alt"></i>
                                    ${team.city}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="invitation-actions-modern">
                        <button class="btn btn-accept-modern" onclick="navigationModule.acceptInvitation('${inv.id}')">
                            <i class="fas fa-check"></i> Принять
                        </button>
                        <button class="btn btn-reject-modern" onclick="navigationModule.rejectInvitation('${inv.id}')">
                            <i class="fas fa-times"></i> Отклонить
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    // Метод для отображения приглашений
    renderInvitations(invitations) {
        const container = document.getElementById('invitations-list');
        if (!container) return;

        if (!invitations || invitations.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                    <i class="fas fa-envelope-open" style="font-size: 2rem; margin-bottom: 10px;"></i>
                    <p>У вас нет новых приглашений</p>
                </div>
            `;
            return;
        }

        // Показываем секцию с приглашениями
        document.getElementById('invitations-section').classList.remove('hidden');

        container.innerHTML = invitations.map(inv => `
            <div class="invitation-card" data-id="${inv.id}" data-team-id="${inv.team_id}">
                <div class="invitation-header">
                    <div class="invitation-team-avatar">
                        ${inv.teams.logo_url ? 
                            `<img src="${inv.teams.logo_url}" alt="${inv.teams.name}">` : 
                            `<span>${inv.teams.name.charAt(0)}</span>`
                        }
                    </div>
                    <div class="invitation-info">
                        <div class="invitation-team-name">${inv.teams.name}</div>
                        <div class="invitation-details">
                            <span class="invitation-sport">${app.getSportName(inv.teams.sport)}</span>
                            <span class="invitation-city">${inv.teams.city}</span>
                        </div>
                    </div>
                </div>
                <div class="invitation-actions">
                    <button class="btn btn-accept" onclick="navigationModule.acceptInvitation('${inv.id}')">
                        <i class="fas fa-check"></i> Принять
                    </button>
                    <button class="btn btn-reject" onclick="navigationModule.rejectInvitation('${inv.id}')">
                        <i class="fas fa-times"></i> Отклонить
                    </button>
                </div>
            </div>
        `).join('');
    },

    // Метод для принятия приглашения
    async acceptInvitation(invitationId) {
        try {
            const { error } = await this.app.supabase
                .from('team_players')
                .update({ 
                    invitation_status: 'accepted',
                    is_linked: true
                })
                .eq('id', invitationId);

            if (error) throw error;

            // Обновляем список приглашений
            await this.loadInvitations();
            
            // Обновляем профиль (статистику и роль)
            if (typeof profileModule !== 'undefined' && profileModule.updateModernUI) {
                await profileModule.updateModernUI();
            }
            
            // Обновляем роль в профиле
            await this.updateProfileRole();
            
            // Показываем уведомление
            alert('Приглашение принято! Вы добавлены в команду.');
            
        } catch (error) {
            console.error('❌ Ошибка принятия приглашения:', error);
            alert('Ошибка принятия приглашения');
        }
    },

    // ДОБАВЛЕНО: Метод для обновления роли в профиле
    async updateProfileRole() {
        if (authModule.isAuthenticated()) {
            const user = authModule.currentUser;
            const userRole = await this.getUserRoleWithTeamInfo(user.id);
            const roleElement = document.getElementById('profile-role-modern') || document.getElementById('profile-role');
            
            if (roleElement) {
                roleElement.textContent = userRole;
            }
        }
    },

    // Метод для отклонения приглашения
    async rejectInvitation(invitationId) {
        try {
            const { error } = await this.app.supabase
                .from('team_players')
                .update({ 
                    invitation_status: 'rejected'
                })
                .eq('id', invitationId);

            if (error) throw error;

            // Обновляем список приглашений
            await this.loadInvitations();
            
        } catch (error) {
            console.error('❌ Ошибка отклонения приглашения:', error);
            alert('Ошибка отклонения приглашения');
        }
    },
    
    // Оплата
    showPayment() {
        this.paymentType = 'upgrade';
        document.getElementById('payment-modal').classList.add('active');
    },
    
    closePayment() {
        document.getElementById('payment-modal').classList.remove('active');
        this.paymentType = null;
    },
    
    async processPayment() {
        const paymentBtn = document.querySelector('#payment-modal .btn-gold');
        const originalText = paymentBtn.textContent;
        paymentBtn.textContent = 'Обработка...';
        paymentBtn.disabled = true;
        
        try {
            const result = await authModule.upgradeToPro();
            
            if (result.success) {
                this.app.currentUser = result.user;
                alert('Подписка успешно оформлена!');
                
                this.closePayment();
                this.showMain();
            } else {
                alert('Ошибка: ' + result.error);
            }
        } catch (error) {
            console.error('Ошибка обработки платежа:', error);
            alert('Ошибка обработки платежа');
        } finally {
            paymentBtn.textContent = originalText;
            paymentBtn.disabled = false;
        }
    },
    
    // Выход
    async logout() {
        if (confirm('Выйти из аккаунта?')) {
            const result = await authModule.logout();
            
            if (result.success) {
                this.app.currentUser = null;
                
                // СКРЫВАЕМ нижнее меню при возврате на экран роли
                this.hideBottomNav();
                
                setTimeout(() => {
                    this.showRoleSelection();
                }, 500);
            }
        }
    },
    
    // ========== НОВЫЙ МЕТОД ДЛЯ СКРЫТИЯ НАВИГАЦИИ ==========
    hideBottomNav() {
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) {
            bottomNav.classList.add('hidden');
            bottomNav.style.display = 'none';
        }
    },
    
    async updateChallengesNotification() {
        try {
            const userId = authModule.getUserId();
            if (!userId) return;
            
            // Получаем матчи пользователя, где он владелец команды 1
            const { data: userTeams, error: teamsError } = await app.supabase
                .from('teams')
                .select('id')
                .eq('owner_id', userId);
            
            if (teamsError) throw teamsError;
            
            if (!userTeams || userTeams.length === 0) return;
            
            const teamIds = userTeams.map(t => t.id);
            
            // Получаем матчи, где пользователь владелец команды 1
            const { data: userMatches, error: matchesError } = await app.supabase
                .from('matches')
                .select('id')
                .in('team1', teamIds)
                .is('team2', null); // Только открытые матчи
            
            if (matchesError) throw matchesError;
            
            if (!userMatches || userMatches.length === 0) return;
            
            const matchIds = userMatches.map(m => m.id);
            
            // Получаем количество вызовов для матчей пользователя
            const { data: challenges, error: challengesError } = await app.supabase
                .from('challenges')
                .select('match_id')
                .eq('status', 'pending')
                .in('match_id', matchIds);
            
            if (challengesError) throw challengesError;
            
            const totalChallenges = challenges ? challenges.length : 0;
            
            // Обновляем бейдж в навигации
            this.updateNavChallengeBadge(totalChallenges);
            
        } catch (error) {
            console.error('❌ Ошибка обновления уведомлений о вызовах:', error);
        }
    },

    updateNavChallengeBadge(count) {
        if (count === 0) {
            // Удаляем бейдж, если он есть
            const existingBadge = document.querySelector('.nav-challenges-badge');
            if (existingBadge) {
                existingBadge.remove();
            }
            return;
        }
        
        // Находим кнопку матчей в навигации
        const matchesNavItem = document.querySelector('[data-screen="main"]');
        if (!matchesNavItem) return;
        
        // Проверяем, есть ли уже бейдж
        let badge = matchesNavItem.querySelector('.nav-challenges-badge');
        
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'nav-challenges-badge';
            badge.style.cssText = `
                position: absolute;
                top: -5px;
                right: -5px;
                background: var(--accent-pink);
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.7rem;
                font-weight: 700;
                animation: badgePulse 2s infinite;
                border: 2px solid var(--bg-primary);
                z-index: 1;
            `;
            matchesNavItem.style.position = 'relative';
            matchesNavItem.appendChild(badge);
        }
        
        badge.textContent = count > 9 ? '9+' : count;
        badge.title = `${count} ${this.pluralizeChallenges(count)}`;
    },

    pluralizeChallenges(count) {
        const mod10 = count % 10;
        const mod100 = count % 100;
        
        if (mod100 >= 11 && mod100 <= 14) {
            return 'вызовов';
        }
        if (mod10 === 1) {
            return 'вызов';
        }
        if (mod10 >= 2 && mod10 <= 4) {
            return 'вызова';
        }
        return 'вызовов';
    },

    // Добавьте метод для проверки новых приглашений
    async checkNewInvitations() {
        if (!authModule.isAuthenticated()) return;
        
        try {
            const userId = authModule.getUserId();
            const { data: invitations, error } = await this.app.supabase
                .from('team_players')
                .select('id')
                .eq('user_id', userId)
                .eq('invitation_status', 'pending');
            
            if (error) throw error;
            
            const newInvitations = invitations ? invitations.length : 0;
            
            // Показываем бейдж, если есть новые приглашения
            if (newInvitations > 0) {
                this.showInvitationBadge(newInvitations);
            }
        } catch (error) {
            console.error('❌ Ошибка проверки приглашений:', error);
        }
    },

    // Метод для показа бейджа с приглашениями
    showInvitationBadge(count) {
        // Находим кнопку профиля в навигации
        const profileNavItem = document.querySelector('[data-screen="profile"]');
        if (!profileNavItem) return;
        
        // Удаляем старый бейдж
        const existingBadge = profileNavItem.querySelector('.nav-invitation-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        // Создаем новый бейдж
        const badge = document.createElement('span');
        badge.className = 'nav-invitation-badge';
        badge.textContent = count > 9 ? '9+' : count;
        badge.title = `${count} новых приглашений`;
        badge.style.cssText = `
            position: absolute;
            top: -5px;
            right: -5px;
            background: var(--accent-blue);
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.7rem;
            font-weight: 700;
            animation: badgePulse 2s infinite;
            border: 2px solid var(--bg-primary);
            z-index: 1;
        `;
        
        profileNavItem.style.position = 'relative';
        profileNavItem.appendChild(badge);
    },
    
    // ========== UI ОБНОВЛЕНИЯ ==========
    
    updateUserUI() {
        if (authModule.isAuthenticated()) {
            const user = authModule.currentUser;
            
            // Обновляем аватар в верхнем меню
            const avatarLetter = document.getElementById('avatar-letter');
            if (avatarLetter) {
                avatarLetter.textContent = user.nickname[0].toUpperCase();
            }
            
            // Обновляем PRO бейдж в верхнем меню
            const proBadge = document.getElementById('pro-badge');
            if (proBadge) {
                proBadge.classList.toggle('hidden', !authModule.isProActive());
            }
        }
    },
    
    updateRoleBasedUI() {
        if (!authModule.isAuthenticated()) return;
        
        const user = authModule.currentUser;
        
        utils.toggleVisibility('nav-teams-btn', authModule.hasRole('organizer'));
        utils.toggleVisibility('nav-create-btn', authModule.isProActive());
        
        utils.toggleVisibility('paywall-banner', 
            user.role === 'organizer' && !authModule.isProActive()
        );
        
        utils.toggleVisibility('bottom-nav', true);
    },
    
    updateBottomNavVisibility() {
        if (typeof utils !== 'undefined') {
            utils.toggleVisibility('bottom-nav', authModule.isAuthenticated());
        }
    },
    
    // Назад к матчу
    backToMatch() {
        if (this.app.selectedMatch) {
            matchesModule.showMatchDetail(this.app.selectedMatch.id);
        } else {
            this.showMain();
        }
    }
};

// Экспортируем глобально
window.navigationModule = navigationModule;