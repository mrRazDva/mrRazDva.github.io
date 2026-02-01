// js/app-modules/elo.js - Модуль рейтинга ELO
const eloModule = {
    K_FACTOR: 32, // Стандартный K-фактор для ELO
    INITIAL_RATING: 1000, // Начальный рейтинг для новых команд
    
    app: null,
    
    init(appInstance) {
        this.app = appInstance;
    },
    
    // Основная функция расчета ELO
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
    
    // Применить ELO к завершенному матчу
    async applyMatchResult(match) {
        if (!match || match.status !== 'finished') {
            console.warn('Матч не завершен или не существует');
            return null;
        }
        
        const [score1, score2] = match.score.split(':').map(Number);
        
        // Получаем текущие рейтинги команд
        const { data: team1, error: error1 } = await this.app.supabase
            .from('teams')
            .select('elo_rating')
            .eq('id', match.team1)
            .single();
            
        const { data: team2, error: error2 } = await this.app.supabase
            .from('teams')
            .select('elo_rating')
            .eq('id', match.team2)
            .single();
            
        if (error1 || error2) {
            console.error('Ошибка получения рейтингов команд:', error1 || error2);
            return null;
        }
        
        const team1Rating = team1.elo_rating || this.INITIAL_RATING;
        const team2Rating = team2.elo_rating || this.INITIAL_RATING;
        
        let result;
        
        if (score1 > score2) {
            // Победа команды 1
            result = this.calculateElo(team1Rating, team2Rating, false);
            await this.updateTeamRating(match.team1, result.winner, match.id);
            await this.updateTeamRating(match.team2, result.loser, match.id);
        } else if (score2 > score1) {
            // Победа команды 2
            result = this.calculateElo(team2Rating, team1Rating, false);
            await this.updateTeamRating(match.team2, result.winner, match.id);
            await this.updateTeamRating(match.team1, result.loser, match.id);
        } else {
            // Ничья
            result = this.calculateElo(team1Rating, team2Rating, true);
            await this.updateTeamRating(match.team1, result.winner, match.id);
            await this.updateTeamRating(match.team2, result.loser, match.id);
        }
        
        // Записываем историю изменения рейтинга
        await this.logRatingChange({
            matchId: match.id,
            team1Id: match.team1,
            team2Id: match.team2,
            team1OldRating: team1Rating,
            team2OldRating: team2Rating,
            team1NewRating: score1 > score2 ? result.winner : (score2 > score1 ? result.loser : result.winner),
            team2NewRating: score2 > score1 ? result.winner : (score1 > score2 ? result.loser : result.loser),
            score: match.score
        });
        
        return result;
    },
    
    // Обновить рейтинг команды в базе
    async updateTeamRating(teamId, newRating, matchId = null) {
        try {
            const { error } = await this.app.supabase
                .from('teams')
                .update({ 
                    elo_rating: newRating,
                    updated_at: new Date().toISOString()
                })
                .eq('id', teamId);
                
            if (error) throw error;
            
            console.log(`✅ Обновлен рейтинг команды ${teamId}: ${newRating}`);
            
        } catch (error) {
            console.error('❌ Ошибка обновления рейтинга:', error);
        }
    },
    
    // Логирование изменения рейтинга (опционально, создайте таблицу)
    async logRatingChange(data) {
        try {
            // Создайте таблицу elo_history в Supabase:
            /*
            CREATE TABLE elo_history (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                match_id UUID REFERENCES matches(id),
                team_id UUID REFERENCES teams(id),
                old_rating INTEGER,
                new_rating INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            );
            */
            
            const { error } = await this.app.supabase
                .from('elo_history')
                .insert([
                    {
                        match_id: data.matchId,
                        team_id: data.team1Id,
                        old_rating: data.team1OldRating,
                        new_rating: data.team1NewRating,
                        created_at: new Date().toISOString()
                    },
                    {
                        match_id: data.matchId,
                        team_id: data.team2Id,
                        old_rating: data.team2OldRating,
                        new_rating: data.team2NewRating,
                        created_at: new Date().toISOString()
                    }
                ]);
                
            if (error) throw error;
            
        } catch (error) {
            console.error('❌ Ошибка логирования ELO:', error);
        }
    },
    
    // Получить топ команд по рейтингу
    async getTopTeams(city = null, sport = null, limit = 10) {
        try {
            let query = this.app.supabase
                .from('teams')
                .select('*')
                .order('elo_rating', { ascending: false })
                .limit(limit);
                
            if (city) {
                query = query.eq('city', city);
            }
            
            if (sport) {
                query = query.eq('sport', sport);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            
            return data || [];
            
        } catch (error) {
            console.error('❌ Ошибка получения топ команд:', error);
            return [];
        }
    },
    
    // Получить историю изменения рейтинга команды
    async getTeamRatingHistory(teamId, limit = 20) {
        try {
            // Если таблица elo_history не существует, возвращаем пустой массив
            const { data, error } = await this.app.supabase
                .from('elo_history')
                .select(`
                    *,
                    match:matches(*, team1:teams!matches_team1_fkey(*), team2:teams!matches_team2_fkey(*))
                `)
                .eq('team_id', teamId)
                .order('created_at', { ascending: false })
                .limit(limit);
                
            if (error) {
                if (error.code === '42P01') { // Таблица не существует
                    return [];
                }
                throw error;
            }
            
            return data || [];
            
        } catch (error) {
            console.error('❌ Ошибка получения истории рейтинга:', error);
            return [];
        }
    },
    
    // Автоматически вызывать при завершении матча
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
    
    // Получить предсказание исхода матча на основе ELO
    getMatchPrediction(team1Id, team2Id) {
        return new Promise(async (resolve) => {
            try {
                const [{ data: team1 }, { data: team2 }] = await Promise.all([
                    this.app.supabase.from('teams').select('elo_rating').eq('id', team1Id).single(),
                    this.app.supabase.from('teams').select('elo_rating').eq('id', team2Id).single()
                ]);
                
                if (!team1 || !team2) {
                    resolve({ team1Win: 0.5, team2Win: 0.5, draw: 0.05 });
                    return;
                }
                
                const team1Rating = team1.elo_rating || this.INITIAL_RATING;
                const team2Rating = team2.elo_rating || this.INITIAL_RATING;
                
                // Вероятность победы команды 1
                const team1Win = 1 / (1 + Math.pow(10, (team2Rating - team1Rating) / 400));
                const team2Win = 1 - team1Win;
                const draw = 0.1; // Базовый шанс ничьи
                
                resolve({
                    team1Win: Math.round(team1Win * 100),
                    team2Win: Math.round(team2Win * 100),
                    draw: Math.round(draw * 100),
                    ratingDifference: Math.abs(team1Rating - team2Rating)
                });
                
            } catch (error) {
                console.error('❌ Ошибка расчета предсказания:', error);
                resolve({ team1Win: 50, team2Win: 50, draw: 5, ratingDifference: 0 });
            }
        });
    },
    
    // Получить разряд команды на основе ELO
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
    
    // Получить строку прогресса до следующего разряда
    getNextRankProgress(rating) {
        const ranks = [
            2400, 2200, 2000, 1800, 1600, 1400, 1200
        ];
        
        const currentRank = ranks.findIndex(r => rating >= r);
        
        if (currentRank === 0) {
            return { progress: 100, nextRank: null, pointsToNext: 0 };
        }
        
        const nextRankRating = ranks[currentRank - 1] || 2400;
        const prevRankRating = ranks[currentRank] || 0;
        
        const progress = Math.round(((rating - prevRankRating) / (nextRankRating - prevRankRating)) * 100);
        const pointsToNext = nextRankRating - rating;
        
        return {
            progress: Math.min(100, Math.max(0, progress)),
            nextRank: this.getRank(nextRankRating).name,
            pointsToNext
        };
    }
};

// Экспортируем глобально
window.eloModule = eloModule;