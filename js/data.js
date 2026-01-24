const mockData = {
    cities: {
        moscow: { name: 'Москва', lat: 55.7558, lng: 37.6173, stats: '12 площадок • 48 команд' },
        kaluga: { name: 'Калуга', lat: 54.5293, lng: 36.2754, stats: '5 площадок • 16 команд' },
        obninsk: { name: 'Обнинск', lat: 55.0968, lng: 36.6101, stats: '3 площадки • 12 команд' }
    },
    teams: {
        'dragons': {
            id: 'dragons', name: 'Драконы', city: 'obninsk', sport: 'football',
            avatar: '🐲', wins: 24, losses: 6, owner: 'user2',
            players: [{ name: 'Александр', number: 10, role: 'Капитан' }]
        },
        'storm': {
            id: 'storm', name: 'Шторм', city: 'obninsk', sport: 'football',
            avatar: '⚡', wins: 18, losses: 12, owner: 'user3',
            players: [{ name: 'Павел', number: 8, role: 'Капитан' }]
        }
    },
    matches: [
        {
            id: 1, sport: 'football', team1: 'dragons', team2: 'storm',
            date: 'Сегодня, 19:00', location: 'Стадион "Белкино"',
            lat: 55.1156, lng: 36.5950, status: 'upcoming', score: '0:0'
        }
    ],
    events: [
        {
            id: 'event1',
            type: 'masterclass',
            title: 'Мастер-класс по йоге',
            description: 'Бесплатное занятие для начинающих. Приносите коврик!',
            date: 'Завтра, 10:00',
            location: 'Парк Победы, площадка #3',
            category: 'wellness',
            price: 'Бесплатно',
            image: '🧘',
            color: '#9b59b6',
            city: 'obninsk'
        },
        {
            id: 'event2',
            type: 'training',
            title: 'Бокс для всех',
            description: 'Открытая тренировка. Перчатки выдаем',
            date: 'Суббота, 14:00',
            location: 'Спортзал "Боец"',
            category: 'boxing',
            price: '500 ₽',
            image: '🥊',
            color: '#e74c3c',
            city: 'obninsk'
        },
        {
            id: 'event3',
            type: 'tournament',
            title: 'Уличный турнир 3x3',
            description: 'Баскетбольный турнир. Призовой фонд: 10 000 ₽',
            date: 'Воскресенье, 12:00',
            location: 'Корты "Олимп"',
            category: 'basketball',
            price: 'Взнос 300 ₽',
            image: '🏀',
            color: '#f39c12',
            city: 'obninsk'
        },
        {
            id: 'event4',
            type: 'masterclass',
            title: 'Работа с мячом',
            description: 'Техника ведения от профи',
            date: 'Пятница, 18:00',
            location: 'Стадион "Белкино"',
            category: 'football',
            price: 'Бесплатно',
            image: '⚽',
            color: '#00ff88',
            city: 'obninsk'
        }
    ]
};

const socialData = {
    comments: [
        {
            id: 1,
            matchId: 1,
            userId: 'user1',
            userName: 'Саня',
            avatar: '👤',
            text: 'Кто пойдет смотреть? Буду с трибуны болеть!',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            likes: 5
        },
        {
            id: 2,
            matchId: 1,
            userId: 'user2',
            userName: 'Леха',
            avatar: '🏆',
            text: 'Драконы сегодня в ударе, жду красивый матч',
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            likes: 3
        }
    ],
    
    reactions: {
        1: {
            'user1': '🔥',
            'user2': '❤️',
            'user3': '👍'
        }
    },
    
    reactionTypes: ['🔥', '❤️', '👍', '😮', '🏆']
};