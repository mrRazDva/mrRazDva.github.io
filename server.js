// server.js - основной серверный файл
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json());

// Раздача статических файлов (ваш фронтенд)
app.use(express.static(path.join(__dirname)));

// ========== ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ ==========
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Обязательно для Render
  }
});

// Проверка подключения к БД
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Ошибка подключения к PostgreSQL:', err.message);
  } else {
    console.log('✅ Подключено к PostgreSQL');
    release();
  }
});

// ========== ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ==========
async function initDatabase() {
  try {
    await pool.query(`
      -- Таблица пользователей
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        nickname VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255),
        role VARCHAR(20) DEFAULT 'fan',
        subscription_active BOOLEAN DEFAULT false,
        subscription_expiry DATE,
        phone VARCHAR(20),
        city VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Таблица команд
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        city VARCHAR(100) NOT NULL,
        sport VARCHAR(50) NOT NULL,
        avatar VARCHAR(10) DEFAULT '⚽',
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        owner_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Таблица игроков
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        number INTEGER,
        role VARCHAR(100),
        photo_url TEXT,
        info TEXT,
        is_captain BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Таблица матчей
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        sport VARCHAR(50) NOT NULL,
        team1_id INTEGER REFERENCES teams(id),
        team2_id INTEGER REFERENCES teams(id),
        date TIMESTAMP NOT NULL,
        location VARCHAR(255) NOT NULL,
        lat DECIMAL(9,6),
        lng DECIMAL(9,6),
        status VARCHAR(20) DEFAULT 'upcoming',
        score VARCHAR(10) DEFAULT '0:0',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Таблица комментариев
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        match_id INTEGER REFERENCES matches(id),
        user_id INTEGER REFERENCES users(id),
        text TEXT NOT NULL,
        likes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Таблица реакций
      CREATE TABLE IF NOT EXISTS reactions (
        id SERIAL PRIMARY KEY,
        match_id INTEGER REFERENCES matches(id),
        user_id INTEGER REFERENCES users(id),
        emoji VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(match_id, user_id)
      );
    `);
    console.log('✅ Таблицы созданы/проверены');
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error.message);
  }
}

// ========== API ENDPOINTS ==========

// Проверка здоровья сервера
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Street League API работает'
  });
});

// Регистрация пользователя
app.post('/api/register', async (req, res) => {
  try {
    const { nickname, email, password, role, phone } = req.body;
    
    // В реальном приложении нужно хэшировать пароль!
    const result = await pool.query(
      `INSERT INTO users (nickname, email, password_hash, role, phone) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, nickname, email, role, created_at`,
      [nickname, email, password, role || 'fan', phone]
    );
    
    res.json({ 
      success: true, 
      user: result.rows[0],
      token: 'demo-token-' + Date.now() // В реальном приложении - JWT
    });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Получение матчей по городу
app.get('/api/matches/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const { sport } = req.query; // фильтр по виду спорта
    
    let query = `
      SELECT m.*, 
        t1.name as team1_name, t1.avatar as team1_avatar,
        t2.name as team2_name, t2.avatar as team2_avatar,
        t1.city as team1_city, t2.city as team2_city
      FROM matches m
      LEFT JOIN teams t1 ON m.team1_id = t1.id
      LEFT JOIN teams t2 ON m.team2_id = t2.id
      WHERE (t1.city = $1 OR t2.city = $1)
    `;
    
    const params = [city];
    
    if (sport && sport !== 'all') {
      query += ' AND m.sport = $2';
      params.push(sport);
    }
    
    query += ' ORDER BY m.date DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения матчей:', error);
    res.status(500).json({ error: error.message });
  }
});

// Создание команды
app.post('/api/teams', async (req, res) => {
  try {
    const { name, city, sport, avatar, owner_id } = req.body;
    
    const result = await pool.query(
      `INSERT INTO teams (name, city, sport, avatar, owner_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [name, city, sport, avatar || '⚽', owner_id]
    );
    
    // Создаем капитана (владельца) в таблице игроков
    await pool.query(
      `INSERT INTO players (team_id, name, number, role, is_captain)
       VALUES ($1, $2, $3, $4, true)`,
      [result.rows[0].id, 'Владелец', 1, 'Капитан']
    );
    
    res.json({ success: true, team: result.rows[0] });
  } catch (error) {
    console.error('Ошибка создания команды:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получение команд пользователя
app.get('/api/users/:userId/teams', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(
      `SELECT t.*, 
        COUNT(p.id) as players_count
       FROM teams t
       LEFT JOIN players p ON t.id = p.team_id
       WHERE t.owner_id = $1
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения команд:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получение деталей команды
app.get('/api/teams/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    
    const teamResult = await pool.query(
      'SELECT * FROM teams WHERE id = $1',
      [teamId]
    );
    
    const playersResult = await pool.query(
      'SELECT * FROM players WHERE team_id = $1 ORDER BY number',
      [teamId]
    );
    
    const matchesResult = await pool.query(
      `SELECT * FROM matches 
       WHERE team1_id = $1 OR team2_id = $1
       ORDER BY date DESC`,
      [teamId]
    );
    
    res.json({
      team: teamResult.rows[0],
      players: playersResult.rows,
      matches: matchesResult.rows
    });
  } catch (error) {
    console.error('Ошибка получения команды:', error);
    res.status(500).json({ error: error.message });
  }
});

// Создание матча
app.post('/api/matches', async (req, res) => {
  try {
    const { team_id, opponent_id, date, location, sport } = req.body;
    
    const result = await pool.query(
      `INSERT INTO matches (team1_id, team2_id, date, location, sport) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [team_id, opponent_id || null, date, location, sport]
    );
    
    res.json({ success: true, match: result.rows[0] });
  } catch (error) {
    console.error('Ошибка создания матча:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== ЗАГРУЗКА СТАТИЧЕСКИХ ФАЙЛОВ ==========
// Все запросы, которые не API, отправляем на index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// ========== ЗАПУСК СЕРВЕРА ==========
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📡 API доступно по адресу: http://localhost:${PORT}/api`);
  console.log(`🌐 Фронтенд доступен по адресу: http://localhost:${PORT}`);
  
  // Инициализируем базу данных
  await initDatabase();
  
  // Добавляем тестовые данные, если таблицы пустые
  try {
    const usersCount = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(usersCount.rows[0].count) === 0) {
      console.log('📝 Добавляю тестовые данные...');
      // Здесь можно добавить тестовые данные
    }
  } catch (error) {
    console.log('Пропускаю добавление тестовых данных');
  }
});