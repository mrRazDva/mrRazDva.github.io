// js/app-modules/elo.js - Модуль рейтинга ELO
const eloModule = {
    K_FACTOR: 32,
    INITIAL_RATING: 1000,
    
    app: null,
    
    init(appInstance) {
        this.app = appInstance;
    },
    
    calculateElo(winnerRating, loserRating, isDraw = false) {
        const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
        const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));
        
        let winnerScore, loserScore;
        
        if (isDraw) {
            winnerScore = 0.5;
            loserScore = 0.5;
        } else {
            winnerScore = 1;
            loserScore = 0;
        }
        
        const newWinnerRating = Math.round(winnerRating + this.K_FACTOR * (winnerScore - expectedWinner));
        const newLoserRating = Math.round(loserRating + this.K_FACTOR * (loserScore - expectedLoser));
        
        return {
            winner: newWinnerRating,
            loser: newLoserRating,
            pointsGained: newWinnerRating - winnerRating,
            pointsLost: loserRating - newLoserRating
        };
    },
    
    // ПРИМЕНИТЬ ELO - используем функцию БД для обхода RLS
    async applyMatchResult(match) {
        if (!match || match.status !== 'finished') {
            console.warn('Матч не завершен или не существует');
            return null;
        }
        
        try {
            // ВАРИАНТ 1: Если функция создана в БД (рекомендуется)
            const { data, error } = await this.app.supabase.rpc('update_team_elo_after_match', {
                p_match_id: match.id,
                p_team1_id: match.team1,
                p_team2_id: match.team2,
                p_score: match.score
            });
            
            if (error) {
                console.error('Ошибка вызова функции update_team_elo_after_match:', error);
                // Если функции нет - используем fallback
                return await this.applyMatchResultFallback(match);
            }
            
            console.log('✅ ELO и статистика обновлены через функцию БД');
            return data;
            
        } catch (error) {
            console.error('❌ Ошибка применения ELO:', error);
            return await this.applyMatchResultFallback(match);
        }
    },
    
    // Fallback метод (если функция не создана)
    async applyMatchResultFallback(match) {
        console.log('🔄 Используем fallback метод для ELO');
        
        const [score1, score2] = match.score.split(':').map(Number);
        
        // Получаем данные команд
        const { data: team1, error: error1 } = await this.app.supabase
            .from('teams')
            .select('elo_rating, wins, losses, draws')
            .eq('id', match.team1)
            .single();
            
        const { data: team2, error: error2 } = await this.app.supabase
            .from('teams')
            .select('elo_rating, wins, losses, draws')
            .eq('id', match.team2)
            .single();
            
        if (error1 || error2) {
            console.error('Ошибка получения данных команд:', error1 || error2);
            return null;
        }
        
        const team1Rating = team1.elo_rating || this.INITIAL_RATING;
        const team2Rating = team2.elo_rating || this.INITIAL_RATING;
        
        let result;
        let team1Stats = { wins: team1.wins || 0, losses: team1.losses || 0, draws: team1.draws || 0 };
        let team2Stats = { wins: team2.wins || 0, losses: team2.losses || 0, draws: team2.draws || 0 };
        
        if (score1 > score2) {
            result = this.calculateElo(team1Rating, team2Rating, false);
            team1Stats.wins++;
            team2Stats.losses++;
        } else if (score2 > score1) {
            result = this.calculateElo(team2Rating, team1Rating, false);
            team2Stats.wins++;
            team1Stats.losses++;
        } else {
            result = this.calculateElo(team1Rating, team2Rating, true);
            team1Stats.draws++;
            team2Stats.draws++;
        }
        
        // Определяем новые рейтинги
        const team1NewRating = score1 > score2 ? result.winner : (score2 > score1 ? result.loser : result.winner);
        const team2NewRating = score2 > score1 ? result.winner : (score1 > score2 ? result.loser : result.loser);
        
        // Пробуем обновить через отдельные запросы с обработкой ошибок
        const updates = [];
        
        // Обновляем команду 1
        updates.push(
            this.app.supabase
                .from('teams')
                .update({ 
                    elo_rating: team1NewRating,
                    wins: team1Stats.wins,
                    losses: team1Stats.losses,
                    draws: team1Stats.draws,
                    updated_at: new Date().toISOString()
                })
                .eq('id', match.team1)
                .then(({ error }) => {
                    if (error) console.error(`❌ Ошибка обновления команды ${match.team1}:`, error);
                    else console.log(`✅ Команда ${match.team1} обновлена`);
                })
        );
        
        // Обновляем команду 2
        updates.push(
            this.app.supabase
                .from('teams')
                .update({ 
                    elo_rating: team2NewRating,
                    wins: team2Stats.wins,
                    losses: team2Stats.losses,
                    draws: team2Stats.draws,
                    updated_at: new Date().toISOString()
                })
                .eq('id', match.team2)
                .then(({ error }) => {
                    if (error) console.error(`❌ Ошибка обновления команды ${match.team2}:`, error);
                    else console.log(`✅ Команда ${match.team2} обновлена`);
                })
        );
        
        await Promise.all(updates);
        
        // Логируем изменения
        await this.logRatingChange({
            matchId: match.id,
            team1Id: match.team1,
            team2Id: match.team2,
            team1OldRating: team1Rating,
            team2OldRating: team2Rating,
            team1NewRating: team1NewRating,
            team2NewRating: team2NewRating,
            score: match.score
        });
        
        return result;
    },
    
    async logRatingChange(data) {
        try {
            const { error } = await this.app.supabase
                .from('elo_history')
                .insert([
                    {
                        match_id: data.matchId,
                        team_id: data.team1Id,
                        old_rating: data.team1OldRating,
                        new_rating: data.team1NewRating,
                        rating_change: data.team1NewRating - data.team1OldRating,
                        created_at: new Date().toISOString()
                    },
                    {
                        match_id: data.matchId,
                        team_id: data.team2Id,
                        old_rating: data.team2OldRating,
                        new_rating: data.team2NewRating,
                        rating_change: data.team2NewRating - data.team2OldRating,
                        created_at: new Date().toISOString()
                    }
                ]);
                
            if (error) throw error;
            
        } catch (error) {
            console.error('❌ Ошибка логирования ELO:', error);
        }
    },
    
    async getTopTeams(city = null, sport = null, limit = 10) {
        try {
            let query = this.app.supabase
                .from('teams')
                .select('*')
                .order('elo_rating', { ascending: false })
                .limit(limit);
                
            if (city) query = query.eq('city', city);
            if (sport) query = query.eq('sport', sport);
            
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
            
        } catch (error) {
            console.error('❌ Ошибка получения топ команд:', error);
            return [];
        }
    },
    
    async getTeamRatingHistory(teamId, limit = 20) {
        try {
            const { data, error } = await this.app.supabase
                .from('elo_history')
                .select(`*, match:matches(*)`)
                .eq('team_id', teamId)
                .order('created_at', { ascending: false })
                .limit(limit);
                
            if (error) {
                if (error.code === '42P01') return [];
                throw error;
            }
            return data || [];
            
        } catch (error) {
            console.error('❌ Ошибка получения истории рейтинга:', error);
            return [];
        }
    },
    
    async onMatchFinished(matchId) {
        try {
            const { data: match, error } = await this.app.supabase
                .from('matches')
                .select('*')
                .eq('id', matchId)
                .single();
                
            if (error) throw error;
            
            if (match.status === 'finished' && match.team1 && match.team2) {
                return await this.applyMatchResult(match);
            }
            return null;
            
        } catch (error) {
            console.error('❌ Ошибка обработки завершенного матча:', error);
            return null;
        }
    },
    
    getMatchPrediction(team1Id, team2Id) {
        return new Promise(async (resolve) => {
            try {
                const [{ data: team1 }, { data: team2 }] = await Promise.all([
                    this.app.supabase.from('teams').select('elo_rating').eq('id', team1Id).single(),
                    this.app.supabase.from('teams').select('elo_rating').eq('id', team2Id).single()
                ]);
                
                if (!team1 || !team2) {
                    resolve({ team1Win: 50, team2Win: 50, draw: 0, ratingDifference: 0 });
                    return;
                }
                
                const team1Rating = team1.elo_rating || this.INITIAL_RATING;
                const team2Rating = team2.elo_rating || this.INITIAL_RATING;
                
                const team1Win = 1 / (1 + Math.pow(10, (team2Rating - team1Rating) / 400));
                const team2Win = 1 - team1Win;
                
                resolve({
                    team1Win: Math.round(team1Win * 100),
                    team2Win: Math.round(team2Win * 100),
                    draw: 10,
                    ratingDifference: Math.abs(team1Rating - team2Rating)
                });
                
            } catch (error) {
                console.error('❌ Ошибка расчета предсказания:', error);
                resolve({ team1Win: 50, team2Win: 50, draw: 10, ratingDifference: 0 });
            }
        });
    },
    
    getRank(rating) {
        const ranks = [
            { min: 2400, name: 'Гроссмейстер', color: '#ffd700' },
            { min: 2200, name: 'Мастер', color: '#c0c0c0' },
            { min: 2000, name: 'Кандидат в мастера', color: '#cd7f32' },
            { min: 1800, name: 'Эксперт', color: '#8a2be2' },
            { min: 1600, name: 'Специалист', color: '#00bfff' },
            { min: 1400, name: 'Любитель', color: '#32cd32' },
            { min: 1200, name: 'Новичок', color: '#ffa500' },
            { min: 0, name: 'Начинающий', color: '#a9a9a9' }
        ];
        
        return ranks.find(rank => rating >= rank.min) || ranks[ranks.length - 1];
    },
    
    getNextRankProgress(rating) {
        const ranks = [2400, 2200, 2000, 1800, 1600, 1400, 1200];
        const currentRank = ranks.findIndex(r => rating >= r);
        
        if (currentRank === 0) {
            return { progress: 100, nextRank: null, pointsToNext: 0 };
        }
        
        const nextRankRating = ranks[currentRank - 1] || 2400;
        const prevRankRating = ranks[currentRank] || 0;
        
        const progress = Math.round(((rating - prevRankRating) / (nextRankRating - prevRankRating)) * 100);
        
        return {
            progress: Math.min(100, Math.max(0, progress)),
            nextRank: this.getRank(nextRankRating).name,
            pointsToNext: nextRankRating - rating
        };
    }
};

window.eloModule = eloModule;