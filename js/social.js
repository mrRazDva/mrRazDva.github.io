const socialModule = {
    currentMatchId: null,

    init() {
        // Загружаем сохраненные комменты из LocalStorage если есть
        const saved = utils.storage.get('socialData');
        if (saved) {
            Object.assign(socialData.comments, saved.comments || []);
            Object.assign(socialData.reactions, saved.reactions || {});
        }
    },

    save() {
        utils.storage.set('socialData', {
            comments: socialData.comments,
            reactions: socialData.reactions
        });
    },

    // Реакции
    toggleReaction(matchId, emoji) {
        if (!socialData.reactions[matchId]) {
            socialData.reactions[matchId] = {};
        }

        const current = socialData.reactions[matchId][app.currentUser.id];
        
        if (current === emoji) {
            // Убираем реакцию если та же
            delete socialData.reactions[matchId][app.currentUser.id];
        } else {
            // Ставим новую
            socialData.reactions[matchId][app.currentUser.id] = emoji;
        }

        this.save();
        this.renderReactions(matchId);
    },

    getReactionStats(matchId) {
        const reactions = socialData.reactions[matchId] || {};
        const stats = {};
        
        Object.values(reactions).forEach(emoji => {
            stats[emoji] = (stats[emoji] || 0) + 1;
        });
        
        return stats;
    },

    renderReactions(matchId) {
        const container = document.getElementById('match-reactions');
        if (!container) return;

        const stats = this.getReactionStats(matchId);
        const myReaction = (socialData.reactions[matchId] || {})[app.currentUser.id];

        let html = '<div class="reactions-bar">';
        
        socialData.reactionTypes.forEach(emoji => {
            const count = stats[emoji] || 0;
            const isActive = myReaction === emoji;
            
            html += `
                <button class="reaction-btn ${isActive ? 'active' : ''} ${count > 0 ? 'has-count' : ''}" 
                        onclick="socialModule.toggleReaction(${matchId}, '${emoji}')">
                    <span class="reaction-emoji">${emoji}</span>
                    ${count > 0 ? `<span class="reaction-count">${count}</span>` : ''}
                </button>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    },

    // Комментарии
    addComment(matchId, text) {
        if (!text.trim()) return;

        const comment = {
            id: Date.now(),
            matchId: matchId,
            userId: app.currentUser.id,
            userName: app.currentUser.nickname,
            avatar: app.currentUser.nickname[0].toUpperCase(),
            text: text.trim(),
            timestamp: new Date().toISOString(),
            likes: 0
        };

        socialData.comments.push(comment);
        this.save();
        this.renderComments(matchId);
        
        // Очищаем поле ввода
        const input = document.getElementById('comment-input');
        if (input) input.value = '';
    },

    likeComment(commentId) {
        const comment = socialData.comments.find(c => c.id === commentId);
        if (comment) {
            comment.likes = (comment.likes || 0) + 1;
            this.save();
            this.renderComments(comment.matchId);
        }
    },

    renderComments(matchId) {
        const container = document.getElementById('comments-list');
        const countBadge = document.getElementById('comments-count');
        if (!container) return;

        const comments = socialData.comments
            .filter(c => c.matchId === matchId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (countBadge) countBadge.textContent = comments.length;

        if (comments.length === 0) {
            container.innerHTML = '<div class="empty-comments">Пока нет комментариев. Будь первым!</div>';
            return;
        }

        container.innerHTML = comments.map(c => `
            <div class="comment-item">
                <div class="comment-avatar">${c.avatar}</div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${c.userName}</span>
                        <span class="comment-time">${this.formatTime(c.timestamp)}</span>
                    </div>
                    <div class="comment-text">${c.text}</div>
                    <div class="comment-actions">
                        <button class="comment-like ${c.likes > 0 ? 'liked' : ''}" onclick="socialModule.likeComment(${c.id})">
                            <i class="fas fa-heart"></i>
                            <span>${c.likes || ''}</span>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = (now - date) / 1000;

        if (diff < 60) return 'только что';
        if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
        return date.toLocaleDateString('ru-RU');
    },

    // Показать секцию комментариев
    showCommentsSection(matchId) {
        this.currentMatchId = matchId;
        this.renderReactions(matchId);
        this.renderComments(matchId);
    }
};