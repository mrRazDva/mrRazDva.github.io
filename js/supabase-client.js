// Инициализация Supabase клиента
// Инициализация Supabase клиента с правильной конфигурацией для файлов
const SUPABASE_URL = 'https://anqvyvtwqljqvldcljat.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFucXZ5dnR3cWxqcXZsZGNsamF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNDA3NTksImV4cCI6MjA4NDkxNjc1OX0.fRnRiPGrvyl3WkyckRjK4q6g_8Gz93MRka-10r4RfHI';

// Создаём кастомный клиент Supabase для работы с файлами
const createSupabaseClient = () => {
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

  // ПАТЧ: Переопределяем метод upload для правильной работы с файлами
  const originalUpload = supabase.storage.from('team-logos').upload;
  
  supabase.storage.from('team-logos').upload = async function(path, file, options = {}) {
    console.log('🔄 Кастомная загрузка файла:', path, file.type, file.size);
    
    // Получаем токен
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    
    if (!token) {
      throw new Error('No auth token');
    }
    
    // Формируем URL
    const fileExt = path.split('.').pop();
    const filePath = `${path}`;
    const url = `${SUPABASE_URL}/storage/v1/object/team-logos/${filePath}`;
    
    try {
      // Используем fetch напрямую с правильным Content-Type
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': file.type, // ОЧЕНЬ ВАЖНО: правильный Content-Type
          'x-upsert': options.upsert ? 'true' : 'false',
          ...(options.cacheControl && { 'cache-control': options.cacheControl })
        },
        body: file
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Ошибка загрузки:', errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Файл загружен успешно:', data);
      return { data, error: null };
      
    } catch (error) {
      console.error('❌ Ошибка в кастомной загрузке:', error);
      return { data: null, error };
    }
  };
  
  return supabase;
};

// Создаём клиент
const supabaseClient = createSupabaseClient();

// Проверяем подключение
supabaseClient.auth.getSession().then(({ data }) => {
  console.log('✅ Supabase клиент инициализирован с кастомной загрузкой файлов');
  console.log('📡 URL:', SUPABASE_URL);
  if (data.session) {
    console.log('👤 Текущая сессия:', data.session.user.email);
  }
}).catch(error => {
  console.error('❌ Ошибка подключения к Supabase:', error);
});

// Экспортируем глобально
window.supabaseClient = supabaseClient;