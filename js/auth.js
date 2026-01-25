// js/auth.js - модуль аутентификации для фронтенда
const authModule = {
  API_URL: window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://street-league-backend.onrender.com',
  
  currentUser: null,
  token: null,
  
  // Инициализация
  init() {
    this.loadFromStorage();
    this.setupAuthInterceptor();
  },
  
  // Загрузка из localStorage
  loadFromStorage() {
    try {
      const savedUser = localStorage.getItem('streetLeagueUser');
      const savedToken = localStorage.getItem('streetLeagueToken');
      
      if (savedUser && savedToken) {
        this.currentUser = JSON.parse(savedUser);
        this.token = savedToken;
        console.log('Пользователь загружен из localStorage');
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователя:', error);
      this.clearAuth();
    }
  },
  
  // Сохранение в localStorage
  saveToStorage() {
    if (this.currentUser && this.token) {
      localStorage.setItem('streetLeagueUser', JSON.stringify(this.currentUser));
      localStorage.setItem('streetLeagueToken', this.token);
    }
  },
  
  // Очистка авторизации
  clearAuth() {
    this.currentUser = null;
    this.token = null;
    localStorage.removeItem('streetLeagueUser');
    localStorage.removeItem('streetLeagueToken');
  },
  
  // Регистрация
  async register(userData) {
    try {
      const response = await fetch(`${this.API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.currentUser = data.user;
        this.token = data.token;
        this.saveToStorage();
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      return { success: false, error: 'Ошибка сети' };
    }
  },
  
  // Вход
 async login(credentials) {
    try {
        const response = await fetch(`${this.API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(credentials)
        });
        
        const data = await response.json();
        
        if (data.success) {
            this.currentUser = data.user;
            this.token = data.token;
            this.saveToStorage();
            return { success: true, user: data.user };
        } else {
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
        return { success: false, error: 'Ошибка сети' };
    }
},
  
  // Выход
  logout() {
    this.clearAuth();
    window.location.href = '/';
  },
  
  // Проверка авторизации
  isAuthenticated() {
    return !!this.currentUser && !!this.token;
  },
  
  // Проверка роли
  hasRole(role) {
    return this.currentUser && this.currentUser.role === role;
  },
  
  // Проверка PRO подписки
  isProActive() {
    if (!this.currentUser) return false;
    
    // Если пользователь - болельщик
    if (this.currentUser.role === 'fan') return false;
    
    // Если подписка активна и не истекла
    if (this.currentUser.subscriptionActive) {
      if (this.currentUser.subscriptionExpiry) {
        const expiryDate = new Date(this.currentUser.subscriptionExpiry);
        return expiryDate > new Date();
      }
      return true;
    }
    
    return false;
  },
  
  // Получение заголовков с токеном
  getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };
  },
  
  // Настройка перехватчика для всех fetch запросов
  setupAuthInterceptor() {
    const originalFetch = window.fetch;
    
    window.fetch = async function(...args) {
      const [url, options = {}] = args;
      
      // Если запрос к нашему API и есть токен, добавляем заголовок
      if (url.includes(authModule.API_URL) && authModule.token) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${authModule.token}`
        };
      }
      
      const response = await originalFetch(url, options);
      
      // Если токен истек (401 ошибка), пробуем обновить
      if (response.status === 401 && authModule.token) {
        const refreshResult = await authModule.refreshToken();
        if (refreshResult.success) {
          // Повторяем запрос с новым токеном
          options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${authModule.token}`
          };
          return originalFetch(url, options);
        } else {
          // Если не удалось обновить, выходим
          authModule.logout();
          return response;
        }
      }
      
      return response;
    };
  },
  
  // Обновление токена
  async refreshToken() {
    if (!this.token) return { success: false };
    
    try {
      const response = await fetch(`${this.API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: this.token })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.token = data.token;
        this.saveToStorage();
        return { success: true };
      } else {
        return { success: false };
      }
    } catch (error) {
      console.error('Ошибка обновления токена:', error);
      return { success: false };
    }
  },
  
  // Получение профиля пользователя
  async getProfile() {
    try {
      const response = await fetch(`${this.API_URL}/api/auth/profile`, {
        headers: this.getAuthHeaders()
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.currentUser = data.user;
        this.saveToStorage();
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Ошибка получения профиля:', error);
      return { success: false, error: 'Ошибка сети' };
    }
  }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
  authModule.init();
});

window.authModule = authModule;