// Инициализация Supabase клиента
const SUPABASE_URL = 'https://anqvyvtwqljqvldcljat.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFucXZ5dnR3cWxqcXZsZGNsamF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNDA3NTksImV4cCI6MjA4NDkxNjc1OX0.fRnRiPGrvyl3WkyckRjK4q6g_8Gz93MRka-10r4RfHI';

// Создаём клиент Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'street-league-auth'
  },
  global: {
    headers: {
      'Content-Type': 'application/json'
    }
  }
});

// Проверяем подключение
supabaseClient.auth.getSession().then(({ data }) => {
  console.log('✅ Supabase клиент инициализирован');
  console.log('📡 URL:', SUPABASE_URL);
  if (data.session) {
    console.log('👤 Текущая сессия:', data.session.user.email);
  }
}).catch(error => {
  console.error('❌ Ошибка подключения к Supabase:', error);
});

// Экспортируем глобально
window.supabaseClient = supabaseClient;