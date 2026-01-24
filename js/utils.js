const utils = {
    // Format date for datetime-local input
    formatDateTimeLocal: (date) => {
        const d = new Date(date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    },

    // Format currency
    formatPrice: (price) => {
        return new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
    },

    // Generate ID
    generateId: () => {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // Validate email
    isValidEmail: (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    // LocalStorage helpers
    storage: {
        get: (key) => {
            try {
                return JSON.parse(localStorage.getItem(key));
            } catch (e) {
                return null;
            }
        },
        set: (key, value) => {
            localStorage.setItem(key, JSON.stringify(value));
        },
        remove: (key) => {
            localStorage.removeItem(key);
        }
    },

    // Show/hide elements
    show: (element) => {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) element.classList.remove('hidden');
    },

    hide: (element) => {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) element.classList.add('hidden');
    },

    // Toggle active class
    toggleActive: (element, parent) => {
        if (parent) {
            parent.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
        }
        element.classList.add('active');
    }
};