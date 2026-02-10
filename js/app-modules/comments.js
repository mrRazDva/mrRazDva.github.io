// js/app-modules/comments.js - полная исправленная версия
const commentsModule = {
    app: null,
    isProcessingLike: false,
    currentProcessingComment: null,
    
    init(appInstance) {
        this.app = appInstance;
        console.log('✅ Инициализация commentsModule');
    },
    
    // Показать секцию комментариев
    showCommentsSection(matchId) {
        this.renderReactions(matchId);
        this.renderComments(matchId);
    },
    
    // Реакции
    async renderReactions(matchId) {
        const container = document.getElementById('match-reactions');
        if (!container) return;
        
        try {
            const { data: reactions, error } = await this.app.supabase
                .from('reactions')
                .select('emoji, user_id')
                .eq('match_id', matchId);
            
            if (error) throw error;
            
            const reactionStats = {};
            const reactionTypes = ['🔥', '❤️', '👍', '😮', '🏆'];
            
            reactionTypes.forEach(emoji => {
                reactionStats[emoji] = 0;
            });
            
            reactions?.forEach(reaction => {
                if (reactionStats[reaction.emoji] !== undefined) {
                    reactionStats[reaction.emoji]++;
                }
            });
            
            let myReaction = null;
            if (authModule.isAuthenticated()) {
                const myReactionData = reactions?.find(r => r.user_id === authModule.getUserId());
                myReaction = myReactionData?.emoji;
            }
            
            let html = '<div class="reactions-bar">';
            
            reactionTypes.forEach(emoji => {
                const count = reactionStats[emoji] || 0;
                const isActive = myReaction === emoji;
                
                html += `
                    <button class="reaction-btn ${isActive ? 'active' : ''} ${count > 0 ? 'has-count' : ''}" 
                            onclick="commentsModule.toggleReaction('${matchId}', '${emoji}')">
                        <span class="reaction-emoji">${emoji}</span>
                        ${count > 0 ? `<span class="reaction-count">${count}</span>` : ''}
                    </button>
                `;
            });
            
            html += '</div>';
            container.innerHTML = html;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки реакций:', error);
            container.innerHTML = '<div class="empty-state">Ошибка загрузки реакций</div>';
        }
    },
    
    async toggleReaction(matchId, emoji) {
        if (!authModule.isAuthenticated()) {
            alert('Для реакции войдите в систему');
            return;
        }
        
        try {
            const userId = authModule.getUserId();
            
            const { data: existingReaction, error: checkError } = await this.app.supabase
                .from('reactions')
                .select('id, emoji')
                .eq('match_id', matchId)
                .eq('user_id', userId)
                .maybeSingle();
            
            if (checkError) throw checkError;
            
            if (existingReaction) {
                if (existingReaction.emoji === emoji) {
                    const { error: deleteError } = await this.app.supabase
                        .from('reactions')
                        .delete()
                        .eq('id', existingReaction.id);
                    
                    if (deleteError) throw deleteError;
                } else {
                    const { error: updateError } = await this.app.supabase
                        .from('reactions')
                        .update({ emoji })
                        .eq('id', existingReaction.id);
                    
                    if (updateError) throw updateError;
                }
            } else {
                const { error: insertError } = await this.app.supabase
                    .from('reactions')
                    .insert([{
                        match_id: matchId,
                        user_id: userId,
                        emoji,
                        created_at: new Date().toISOString()
                    }]);
                
                if (insertError) throw insertError;
            }
            
            this.renderReactions(matchId);
            
        } catch (error) {
            console.error('❌ Ошибка обработки реакции:', error);
            alert('Ошибка обработки реакции');
        }
    },
    
    // Комментарии
    async renderComments(matchId) {
    const container = document.getElementById('comments-list');
    const countBadge = document.getElementById('comments-count');
    if (!container) return;
    
    try {
        const { data: comments, error } = await this.app.supabase
            .from('comments')
            .select(`
                *,
                user:profiles(id, nickname, avatar_url)
            `)
            .eq('match_id', matchId)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Ошибка загрузки комментариев:', error);
            if (countBadge) countBadge.textContent = '0';
            container.innerHTML = '<div class="empty-comments">Пока нет комментариев. Будь первым!</div>';
            return;
        }
        
        if (countBadge) countBadge.textContent = comments?.length || 0;
        
        if (!comments || comments.length === 0) {
            container.innerHTML = '<div class="empty-comments">Пока нет комментариев. Будь первым!</div>';
            return;
        }
        
        container.innerHTML = comments.map(comment => {
            const userName = comment.user?.nickname || 'Пользователь';
            const avatarUrl = comment.user?.avatar_url;
            const timeAgo = this.app.formatTimeAgo(comment.created_at);
            
            // Формируем HTML для аватарки
            let avatarHtml;
            if (avatarUrl) {
                avatarHtml = `<img src="${avatarUrl}" alt="${userName}" class="comment-avatar-img">`;
            } else {
                const avatarLetter = userName[0].toUpperCase();
                avatarHtml = `<span class="comment-avatar-letter">${avatarLetter}</span>`;
            }
            
            return `
                <div class="comment-item" data-comment-id="${comment.id}">
                    <div class="comment-avatar">${avatarHtml}</div>
                    <div class="comment-content">
                        <div class="comment-header">
                            <span class="comment-author">${userName}</span>
                            <span class="comment-time">${timeAgo}</span>
                        </div>
                        <div class="comment-text">${comment.text}</div>
                        <div class="comment-actions">
                            <button class="comment-like" 
                                    onclick="event.stopPropagation(); event.preventDefault(); commentsModule.likeComment('${comment.id}')">
                                <i class="fas fa-heart"></i>
                                <span class="like-count">${comment.likes || 0}</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки комментариев:', error);
        container.innerHTML = '<div class="empty-comments">Ошибка загрузки комментариев</div>';
    }
},
    
    async addComment(matchId, text) {
        if (!authModule.isAuthenticated()) {
            alert('Для комментирования войдите в систему');
            return;
        }
        
        const commentInput = document.getElementById('comment-input');
        const commentText = text || (commentInput ? commentInput.value : '');
        
        if (!commentText.trim()) {
            alert('Введите текст комментария');
            return;
        }
        
        try {
            const userId = authModule.getUserId();
            
            const { error } = await this.app.supabase
                .from('comments')
                .insert([{
                    match_id: matchId,
                    user_id: userId,
                    text: commentText.trim(),
                    created_at: new Date().toISOString()
                }]);
            
            if (error) {
                console.error('Ошибка добавления комментария:', error);
                alert('Ошибка добавления комментария: ' + error.message);
                return;
            }
            
            if (commentInput) commentInput.value = '';
            
            this.renderComments(matchId);
            
        } catch (error) {
            console.error('❌ Ошибка добавления комментария:', error);
            alert('Ошибка добавления комментария');
        }
    },
    
   async likeComment(commentId) {
    console.log('=== ЛАЙК СТАРТ ===');
    console.log('commentId:', commentId);
    
    // Защита от двойного клика
    if (this.isProcessingLike && this.currentProcessingComment === commentId) {
        console.log('Лайк уже обрабатывается для этого комментария, пропускаем...');
        return;
    }
    
    this.isProcessingLike = true;
    this.currentProcessingComment = commentId;
    
    if (!authModule.isAuthenticated()) {
        alert('Для оценки комментариев войдите в систему');
        this.resetProcessing();
        return;
    }
    
    try {
        const userId = authModule.getUserId();
        
        // Проверяем существующий лайк
        const { data: existingLike, error: checkError } = await this.app.supabase
            .from('comment_likes')
            .select('id')
            .eq('comment_id', commentId)
            .eq('user_id', userId)
            .maybeSingle();
        
        if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
        }
        
        if (existingLike) {
            // Удаляем лайк
            console.log('Удаляем лайк для комментария:', commentId);
            const { error: deleteError } = await this.app.supabase
                .from('comment_likes')
                .delete()
                .eq('id', existingLike.id);
            
            if (deleteError) throw deleteError;
            
            // НЕ обновляем счетчик вручную - триггер сделает это автоматически
            console.log('Лайк удален, триггер обновит счетчик');
            
        } else {
            // Добавляем лайк
            console.log('Добавляем лайк для комментария:', commentId);
            const { error: insertError } = await this.app.supabase
                .from('comment_likes')
                .insert([{
                    comment_id: commentId,
                    user_id: userId,
                    created_at: new Date().toISOString()
                }]);
            
            if (insertError) throw insertError;
            
            // НЕ обновляем счетчик вручную - триггер сделает это автоматически
            console.log('Лайк добавлен, триггер обновит счетчик');
        }
        
        // Ждем небольшое время, чтобы триггер успел обновить данные
        setTimeout(async () => {
            try {
                // Получаем актуальные данные комментария (после работы триггера)
                const { data: updatedComment, error: fetchError } = await this.app.supabase
                    .from('comments')
                    .select('match_id')
                    .eq('id', commentId)
                    .single();
                
                if (fetchError) throw fetchError;
                
                // Обновляем список комментариев
                if (updatedComment.match_id) {
                    this.renderComments(updatedComment.match_id);
                }
                
            } catch (error) {
                console.error('Ошибка при обновлении комментариев:', error);
                // В случае ошибки все равно обновляем интерфейс
                if (this.selectedMatch?.id) {
                    this.renderComments(this.selectedMatch.id);
                }
            } finally {
                this.resetProcessing();
            }
        }, 300); // Даем триггеру 300мс на обновление
        
    } catch (error) {
        console.error('❌ Ошибка обработки лайка:', error);
        alert('Ошибка обработки лайка: ' + error.message);
        this.resetProcessing();
    }
},
    
    resetProcessing() {
        this.isProcessingLike = false;
        this.currentProcessingComment = null;
    }
};

window.commentsModule = commentsModule;