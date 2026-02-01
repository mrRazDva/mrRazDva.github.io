-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid,
  from_team_id uuid,
  status text NOT NULL DEFAULT 'pending'::text,
  message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT challenges_pkey PRIMARY KEY (id),
  CONSTRAINT challenges_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT challenges_from_team_id_fkey FOREIGN KEY (from_team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.cities (
  id character varying NOT NULL,
  name character varying NOT NULL,
  lat numeric,
  lng numeric,
  stats character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.comment_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  comment_id uuid,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comment_likes_pkey PRIMARY KEY (id),
  CONSTRAINT comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id),
  CONSTRAINT comment_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid,
  user_id uuid,
  text character varying NOT NULL,
  likes integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['masterclass'::character varying, 'training'::character varying, 'tournament'::character varying, 'workshop'::character varying, 'competition'::character varying]::text[])),
  title character varying NOT NULL,
  description text,
  date timestamp with time zone NOT NULL,
  location character varying NOT NULL,
  category character varying,
  price character varying DEFAULT 'Бесплатно'::character varying,
  icon character varying DEFAULT '??'::character varying,
  color character varying DEFAULT '#00ff88'::character varying,
  city character varying NOT NULL,
  organizer uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_organizer_fkey FOREIGN KEY (organizer) REFERENCES public.profiles(id)
);
CREATE TABLE public.matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sport character varying NOT NULL CHECK (sport::text = ANY (ARRAY['football'::character varying, 'volleyball'::character varying, 'basketball'::character varying]::text[])),
  team1 uuid,
  team2 uuid,
  date timestamp with time zone NOT NULL,
  location character varying NOT NULL,
  city character varying NOT NULL,
  lat numeric,
  lng numeric,
  status character varying DEFAULT 'upcoming'::character varying CHECK (status::text = ANY (ARRAY['upcoming'::character varying, 'live'::character varying, 'finished'::character varying, 'cancelled'::character varying]::text[])),
  score character varying DEFAULT '0:0'::character varying,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  finished_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  format text NOT NULL DEFAULT '5x5'::text,
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT matches_team1_fkey FOREIGN KEY (team1) REFERENCES public.teams(id),
  CONSTRAINT matches_team2_fkey FOREIGN KEY (team2) REFERENCES public.teams(id),
  CONSTRAINT matches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  nickname text NOT NULL,
  role text DEFAULT 'fan'::text,
  subscription_active boolean DEFAULT false,
  subscription_expiry timestamp with time zone,
  phone text,
  city text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid,
  user_id uuid,
  emoji character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reactions_pkey PRIMARY KEY (id),
  CONSTRAINT reactions_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.team_name_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid,
  old_name character varying NOT NULL,
  new_name character varying NOT NULL,
  is_paid boolean DEFAULT false,
  changed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_name_changes_pkey PRIMARY KEY (id),
  CONSTRAINT team_name_changes_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.team_players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid,
  name character varying NOT NULL,
  number integer NOT NULL CHECK (number >= 1 AND number <= 99),
  role character varying,
  info text,
  photo_url text,
  is_captain boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_players_pkey PRIMARY KEY (id),
  CONSTRAINT team_players_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  city character varying NOT NULL,
  sport character varying NOT NULL CHECK (sport::text = ANY (ARRAY['football'::character varying, 'volleyball'::character varying, 'basketball'::character varying]::text[])),
  avatar character varying DEFAULT '?'::character varying,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  draws integer DEFAULT 0,
  owner_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  elo_rating integer DEFAULT 1000,
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
);


================================================================================================================================================

Запасной вариант

-- ВКЛЮЧАЕМ НЕОБХОДИМЫЕ РАСШИРЕНИЯ
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- УДАЛЯЕМ СУЩЕСТВУЮЩИЕ ТАБЛИЦЫ (если они есть)
DROP TABLE IF EXISTS 
  team_name_changes,
  team_players,
  challenges,
  comment_likes,
  reactions,
  comments,
  matches,
  events,
  teams,
  cities,
  profiles
CASCADE;

-- СОЗДАЕМ ТАБЛИЦЫ В ПРАВИЛЬНОМ ПОРЯДКЕ

-- 1. Базовая таблица профилей
CREATE TABLE profiles (
  id uuid NOT NULL,
  nickname text NOT NULL,
  role text DEFAULT 'fan'::text,
  subscription_active boolean DEFAULT false,
  subscription_expiry timestamp with time zone,
  phone text,
  city text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

-- 2. Города (независимая таблица)
CREATE TABLE cities (
  id character varying NOT NULL,
  name character varying NOT NULL,
  lat numeric,
  lng numeric,
  stats character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cities_pkey PRIMARY KEY (id)
);

-- 3. Команды
CREATE TABLE teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  city character varying NOT NULL,
  sport character varying NOT NULL,
  avatar character varying DEFAULT '?'::character varying,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  draws integer DEFAULT 0,
  owner_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  elo_rating integer DEFAULT 1000,
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id),
  CONSTRAINT teams_sport_check CHECK (sport::text = ANY (ARRAY['football'::character varying, 'volleyball'::character varying, 'basketball'::character varying]::text[]))
);

-- 4. Игроки команд
CREATE TABLE team_players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid,
  name character varying NOT NULL,
  number integer NOT NULL,
  role character varying,
  info text,
  photo_url text,
  is_captain boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_players_pkey PRIMARY KEY (id),
  CONSTRAINT team_players_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id),
  CONSTRAINT team_players_number_check CHECK (number >= 1 AND number <= 99)
);

-- 5. Матчи
CREATE TABLE matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sport character varying NOT NULL,
  team1 uuid,
  team2 uuid,
  date timestamp with time zone NOT NULL,
  location character varying NOT NULL,
  city character varying NOT NULL,
  lat numeric,
  lng numeric,
  status character varying DEFAULT 'upcoming'::character varying,
  score character varying DEFAULT '0:0'::character varying,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  finished_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  format text NOT NULL DEFAULT '5x5'::text,
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT matches_team1_fkey FOREIGN KEY (team1) REFERENCES teams(id),
  CONSTRAINT matches_team2_fkey FOREIGN KEY (team2) REFERENCES teams(id),
  CONSTRAINT matches_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id),
  CONSTRAINT matches_sport_check CHECK (sport::text = ANY (ARRAY['football'::character varying, 'volleyball'::character varying, 'basketball'::character varying]::text[])),
  CONSTRAINT matches_status_check CHECK (status::text = ANY (ARRAY['upcoming'::character varying, 'live'::character varying, 'finished'::character varying, 'cancelled'::character varying]::text[]))
);

-- 6. Вызовы на матч
CREATE TABLE challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid,
  from_team_id uuid,
  status text NOT NULL DEFAULT 'pending'::text,
  message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT challenges_pkey PRIMARY KEY (id),
  CONSTRAINT challenges_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id),
  CONSTRAINT challenges_from_team_id_fkey FOREIGN KEY (from_team_id) REFERENCES teams(id)
);

-- 7. Комментарии
CREATE TABLE comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid,
  user_id uuid,
  text character varying NOT NULL,
  likes integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id),
  CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- 8. Лайки комментариев
CREATE TABLE comment_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  comment_id uuid,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comment_likes_pkey PRIMARY KEY (id),
  CONSTRAINT comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES comments(id),
  CONSTRAINT comment_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- 9. Реакции
CREATE TABLE reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid,
  user_id uuid,
  emoji character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reactions_pkey PRIMARY KEY (id),
  CONSTRAINT reactions_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id),
  CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- 10. События
CREATE TABLE events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type character varying NOT NULL,
  title character varying NOT NULL,
  description text,
  date timestamp with time zone NOT NULL,
  location character varying NOT NULL,
  category character varying,
  price character varying DEFAULT 'Бесплатно'::character varying,
  icon character varying DEFAULT '??'::character varying,
  color character varying DEFAULT '#00ff88'::character varying,
  city character varying NOT NULL,
  organizer uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_organizer_fkey FOREIGN KEY (organizer) REFERENCES profiles(id),
  CONSTRAINT events_type_check CHECK (type::text = ANY (ARRAY['masterclass'::character varying, 'training'::character varying, 'tournament'::character varying, 'workshop'::character varying, 'competition'::character varying]::text[]))
);

-- 11. История переименований команд
CREATE TABLE team_name_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid,
  old_name character varying NOT NULL,
  new_name character varying NOT NULL,
  is_paid boolean DEFAULT false,
  changed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_name_changes_pkey PRIMARY KEY (id),
  CONSTRAINT team_name_changes_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- СООБЩЕНИЕ ОБ УСПЕХЕ
DO $$ 
BEGIN
    RAISE NOTICE '? Все таблицы успешно созданы!';
    RAISE NOTICE '?? Количество таблиц: 11';
    RAISE NOTICE '? База данных готова к работе (структура)';
END $$;


=========================================================================================================================

-- ВОССТАНОВЛЕНИЕ СТРУКТУРЫ БАЗЫ ДАННЫХ
-- ВЕРСИЯ: Обновленная (добавлены hockey и tabletennis)

-- ВКЛЮЧАЕМ НЕОБХОДИМЫЕ РАСШИРЕНИЯ
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- УДАЛЯЕМ СУЩЕСТВУЮЩИЕ ТАБЛИЦЫ (если они есть) в правильном порядке
DROP TABLE IF EXISTS 
  team_name_changes,
  team_players,
  challenges,
  comment_likes,
  reactions,
  comments,
  events,
  matches,
  teams,
  cities,
  profiles
CASCADE;

-- СОЗДАЕМ ТАБЛИЦЫ В ПРАВИЛЬНОМ ПОРЯДКЕ (учитывая зависимости)

-- 1. Профили пользователей (базовая таблица, не зависит от других)
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  nickname text NOT NULL,
  role text DEFAULT 'fan'::text,
  subscription_active boolean DEFAULT false,
  subscription_expiry timestamp with time zone,
  phone text,
  city text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

-- 2. Города (независимая таблица)
CREATE TABLE public.cities (
  id character varying NOT NULL,
  name character varying NOT NULL,
  lat numeric,
  lng numeric,
  stats character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cities_pkey PRIMARY KEY (id)
);

-- 3. Команды (зависит от profiles)
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  city character varying NOT NULL,
  sport character varying NOT NULL CHECK (sport::text = ANY (ARRAY['football'::character varying::text, 'volleyball'::character varying::text, 'basketball'::character varying::text, 'hockey'::character varying::text, 'tabletennis'::character varying::text])),
  avatar character varying DEFAULT '?'::character varying,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  draws integer DEFAULT 0,
  owner_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  elo_rating integer DEFAULT 1000,
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
);

-- 4. Матчи (зависит от teams и profiles)
CREATE TABLE public.matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sport character varying NOT NULL CHECK (sport::text = ANY (ARRAY['football'::character varying::text, 'volleyball'::character varying::text, 'basketball'::character varying::text, 'hockey'::character varying::text, 'tabletennis'::character varying::text])),
  team1 uuid,
  team2 uuid,
  date timestamp with time zone NOT NULL,
  location character varying NOT NULL,
  city character varying NOT NULL,
  lat numeric,
  lng numeric,
  status character varying DEFAULT 'upcoming'::character varying CHECK (status::text = ANY (ARRAY['upcoming'::character varying::text, 'live'::character varying::text, 'finished'::character varying::text, 'cancelled'::character varying::text])),
  score character varying DEFAULT '0:0'::character varying,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  finished_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  format text NOT NULL DEFAULT '5x5'::text,
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT matches_team1_fkey FOREIGN KEY (team1) REFERENCES public.teams(id),
  CONSTRAINT matches_team2_fkey FOREIGN KEY (team2) REFERENCES public.teams(id),
  CONSTRAINT matches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- 5. Вызовы на матч (зависит от matches и teams)
CREATE TABLE public.challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid,
  from_team_id uuid,
  status text NOT NULL DEFAULT 'pending'::text,
  message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT challenges_pkey PRIMARY KEY (id),
  CONSTRAINT challenges_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT challenges_from_team_id_fkey FOREIGN KEY (from_team_id) REFERENCES public.teams(id)
);

-- 6. Комментарии (зависит от matches и profiles)
CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid,
  user_id uuid,
  text character varying NOT NULL,
  likes integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- 7. Лайки комментариев (зависит от comments и profiles)
CREATE TABLE public.comment_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  comment_id uuid,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comment_likes_pkey PRIMARY KEY (id),
  CONSTRAINT comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id),
  CONSTRAINT comment_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- 8. Реакции (зависит от matches и profiles)
CREATE TABLE public.reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid,
  user_id uuid,
  emoji character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reactions_pkey PRIMARY KEY (id),
  CONSTRAINT reactions_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- 9. События (зависит от profiles)
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['masterclass'::character varying::text, 'training'::character varying::text, 'tournament'::character varying::text, 'workshop'::character varying::text, 'competition'::character varying::text])),
  title character varying NOT NULL,
  description text,
  date timestamp with time zone NOT NULL,
  location character varying NOT NULL,
  category character varying,
  price character varying DEFAULT 'Бесплатно'::character varying,
  icon character varying DEFAULT '??'::character varying,
  color character varying DEFAULT '#00ff88'::character varying,
  city character varying NOT NULL,
  organizer uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_organizer_fkey FOREIGN KEY (organizer) REFERENCES public.profiles(id)
);

-- 10. Игроки команд (зависит от teams)
CREATE TABLE public.team_players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid,
  name character varying NOT NULL,
  number integer NOT NULL CHECK (number >= 1 AND number <= 99),
  role character varying,
  info text,
  photo_url text,
  is_captain boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_players_pkey PRIMARY KEY (id),
  CONSTRAINT team_players_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);

-- 11. История переименований команд (зависит от teams)
CREATE TABLE public.team_name_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid,
  old_name character varying NOT NULL,
  new_name character varying NOT NULL,
  is_paid boolean DEFAULT false,
  changed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_name_changes_pkey PRIMARY KEY (id),
  CONSTRAINT team_name_changes_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);

-- СОЗДАЕМ ИНДЕКСЫ ДЛЯ УЛУЧШЕНИЯ ПРОИЗВОДИТЕЛЬНОСТИ

-- Индексы для таблицы matches
CREATE INDEX IF NOT EXISTS idx_matches_date ON public.matches(date);
CREATE INDEX IF NOT EXISTS idx_matches_city ON public.matches(city);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_sport ON public.matches(sport);

-- Индексы для таблицы teams
CREATE INDEX IF NOT EXISTS idx_teams_city ON public.teams(city);
CREATE INDEX IF NOT EXISTS idx_teams_sport ON public.teams(sport);
CREATE INDEX IF NOT EXISTS idx_teams_owner ON public.teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_elo ON public.teams(elo_rating);

-- Индексы для таблицы events
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date);
CREATE INDEX IF NOT EXISTS idx_events_city ON public.events(city);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(type);

-- Индексы для таблицы challenges
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_match ON public.challenges(match_id);

-- Индексы для таблицы comments
CREATE INDEX IF NOT EXISTS idx_comments_match ON public.comments(match_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON public.comments(created_at);

-- Индексы для таблицы team_players
CREATE INDEX IF NOT EXISTS idx_team_players_team ON public.team_players(team_id);
CREATE INDEX IF NOT EXISTS idx_team_players_captain ON public.team_players(is_captain) WHERE is_captain = true;

-- СООБЩЕНИЕ ОБ УСПЕХЕ
DO $$ 
DECLARE
    table_count integer;
BEGIN
    -- Подсчитываем количество созданных таблиц
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public';
    
    RAISE NOTICE '? Все таблицы успешно созданы!';
    RAISE NOTICE '?? Количество таблиц: %', table_count;
    RAISE NOTICE '?? Добавлены новые виды спорта: hockey, tabletennis';
    RAISE NOTICE '? База данных готова к работе (структура восстановлена)';
    RAISE NOTICE '?? Созданы оптимизирующие индексы для производительности';
END $$;

-- ПРОВЕРОЧНЫЙ ЗАПРОС
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as columns_count
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;