// js/stat-config.js
const sportStatConfig = {
    football: {
        fields: [
            { name: 'goals', label: 'Голы', type: 'number', max: 20 },
            { name: 'assists', label: 'Передачи', type: 'number' },
            { name: 'saves', label: 'Сейвы', type: 'number', visible: (role) => role && role.toLowerCase().includes('вратарь') },
            { name: 'yellow_cards', label: 'ЖК', type: 'number', max: 2 },
            { name: 'red_cards', label: 'КК', type: 'number', max: 1 }
        ]
    },
    hockey: {
        fields: [
            { name: 'goals', label: 'Шайбы', type: 'number' },
            { name: 'assists', label: 'Передачи', type: 'number' },
            { name: 'saves', label: 'Сейвы', type: 'number', visible: (role) => role && role.toLowerCase().includes('вратарь') },
            { name: 'penalty_minutes', label: 'Штраф (мин)', type: 'number' }
        ]
    },
    basketball: {
        fields: [
            { name: 'points', label: 'Очки', type: 'number' },
            { name: 'assists', label: 'Передачи', type: 'number' },
            { name: 'rebounds', label: 'Подборы', type: 'number' }
        ]
    },
    volleyball: {
        fields: [
            { name: 'points', label: 'Очки', type: 'number' },
            { name: 'assists', label: 'Передачи', type: 'number' },
            { name: 'saves', label: 'Сейвы', type: 'number' }
        ]
    },
    tabletennis: {
        fields: [
            { name: 'games_won', label: 'Победы в партиях', type: 'number' },
            { name: 'games_lost', label: 'Поражения в партиях', type: 'number' }
        ]
    }
};

// Делаем глобально доступным
window.sportStatConfig = sportStatConfig;