const utils = {
    // Показать/скрыть элементы
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

    toggleVisibility: (id, show) => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.toggle('hidden', !show);
        }
    },

    // Toggle active class
    toggleActive: (element, parent) => {
        if (parent) {
            parent.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
        }
        if (element) {
            element.classList.add('active');
        }
    },
	
	
	

    // Format date for datetime-local input
    formatDateTimeLocal: (date) => {
        const d = new Date(date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
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
    }
};




window.utils = utils;