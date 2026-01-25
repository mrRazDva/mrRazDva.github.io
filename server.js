const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========== ПОДКЛЮЧЕНИЕ К БАЗЕ ==========
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// ========== MIDDLEWARE ==========
// Разрешаем все CORS запросы
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.use(express.json());

// ========== ПРОВЕРКА ЗДОРОВЬЯ ==========
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        message: 'Street League API работает',
        cors: 'enabled'
    });
});

// ========== АВТОРИЗАЦИЯ ==========
const SECRET_KEY = process.env.JWT_SECRET || 'street-league-secret-key-2024';

// Создание таблиц при запуске
async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                nickname VARCHAR(100) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'fan',
                subscription_active BOOLEAN DEFAULT false,
                subscription_expiry DATE,
                phone VARCHAR(20),
                city VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
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
        `);
        console.log('✅ Таблицы созданы/проверены');
    } catch (error) {
        console.error('❌ Ошибка создания таблиц:', error.message);
    }
}

// Регистрация
app.post('/api/auth/register', async (req, res) => {
    console.log('📝 Регистрация пользователя:', req.body);
    
    try {
        const { nickname, email, password, role, phone } = req.body;
        
        if (!nickname || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Заполните все обязательные поля'
            });
        }
        
        // Проверяем существующего пользователя
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR nickname = $2',
            [email, nickname]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Пользователь с таким email или никнеймом уже существует'
            });
        }
        
        // Хэшируем пароль (в демо-режиме просто сохраняем как есть)
        const hashedPassword = password; // В реальном приложении: await bcrypt.hash(password, 10)
        
        // Создаем пользователя
        const result = await pool.query(
            `INSERT INTO users (nickname, email, password_hash, role, phone, subscription_active, subscription_expiry) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING id, nickname, email, role, phone, subscription_active, subscription_expiry, created_at`,
            [
                nickname,
                email,
                hashedPassword,
                role || 'fan',
                phone || null,
                role === 'organizer', // Если организатор - активная подписка
                role === 'organizer' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null
            ]
        );
        
        const user = result.rows[0];
        
        // Создаем JWT токен
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email,
                role: user.role 
            },
            SECRET_KEY,
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            user: {
                id: user.id,
                nickname: user.nickname,
                email: user.email,
                role: user.role,
                subscriptionActive: user.subscription_active,
                subscriptionExpiry: user.subscription_expiry,
                phone: user.phone
            },
            token
        });
        
    } catch (error) {
        console.error('❌ Ошибка регистрации:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера при регистрации' 
        });
    }
});

// Вход
app.post('/api/auth/login', async (req, res) => {
    console.log('🔑 Вход пользователя:', req.body.email);
    
    try {
        const { email, password } = req.body;
        
        // Ищем пользователя
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Неверный email или пароль'
            });
        }
        
        const user = result.rows[0];
        
        // Проверяем пароль (в демо-режиме просто сравниваем строки)
        const isValidPassword = user.password_hash === password; // В реальном приложении: await bcrypt.compare(password, user.password_hash)
        
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Неверный email или пароль'
            });
        }
        
        // Создаем JWT токен
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email,
                role: user.role 
            },
            SECRET_KEY,
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            user: {
                id: user.id,
                nickname: user.nickname,
                email: user.email,
                role: user.role,
                subscriptionActive: user.subscription_active,
                subscriptionExpiry: user.subscription_expiry,
                phone: user.phone
            },
            token
        });
        
    } catch (error) {
        console.error('❌ Ошибка входа:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера при входе' 
        });
    }
});

// Проверка токена
app.get('/api/auth/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Токен не предоставлен'
            });
        }
        
        const decoded = jwt.verify(token, SECRET_KEY);
        
        const result = await pool.query(
            'SELECT id, nickname, email, role, subscription_active, subscription_expiry, phone, city, created_at FROM users WHERE id = $1',
            [decoded.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }
        
        res.json({
            success: true,
            user: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Ошибка проверки профиля:', error);
        return res.status(403).json({
            success: false,
            error: 'Недействительный токен'
        });
    }
});

// ========== ЗАПУСК СЕРВЕРА ==========
if (process.env.NODE_ENV === 'production') {
  // Для Vercel Serverless Functions
  module.exports = app;
} else {
  // Для локальной разработки
  app.listen(PORT, async () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📡 API доступно по адресу: http://localhost:${PORT}/api`);
    console.log(`🌐 CORS разрешен для всех доменов`);
    
    // Инициализируем базу данных
    await initDatabase();
    
    // Проверяем подключение
    try {
      const client = await pool.connect();
      console.log('✅ Подключено к PostgreSQL');
      client.release();
    } catch (error) {
      console.error('❌ Ошибка подключения к PostgreSQL:', error.message);
    }
  });
}