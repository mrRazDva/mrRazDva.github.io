// js/app-modules/map.js - Модуль работы с картами
const mapModule = {
    app: null,
    map: null,
    locationMap: null,
    selectedPlacemark: null,
    selectedCoords: null,
    ymapsReady: false,
    
    init(appInstance) {
        this.app = appInstance;
        
        // Инициализация Яндекс Карт
        if (typeof ymaps !== 'undefined') {
            ymaps.ready(() => {
                this.ymapsReady = true;
                console.log('✅ Яндекс Карты готовы');
            });
        }
    },
    
    // Инициализация карты на экране деталей матча
initMap(lat, lng, location) {
    if (!this.ymapsReady) {
        setTimeout(() => this.initMap(lat, lng, location), 500);
        return;
    }
    
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    if (this.map) {
        this.map.destroy();
    }
    
    // Устанавливаем фиксированную высоту
    mapContainer.style.height = '250px';
    mapContainer.style.minHeight = '250px';
    
    this.map = new ymaps.Map("map", {
        center: [lat, lng],
        zoom: 15,
        controls: ['zoomControl']
    });
    
    const placemark = new ymaps.Placemark([lat, lng], {
        hintContent: location,
        balloonContent: `<strong>${location}</strong>`
    }, {
        preset: 'islands#greenDotIconWithCaption'
    });
    
    this.map.geoObjects.add(placemark);
    this.map.behaviors.disable('scrollZoom');
},
    
    // Метод открытия карты для выбора местоположения
openMapForLocation() {
    const modal = document.getElementById('location-picker-modal');
    modal.classList.remove('hidden');
    modal.classList.add('active');
	
	 // Скрыть нижнее меню
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = 'none';
    }
    
    setTimeout(() => {
        this.initLocationMap();
    }, 100);
},

// Инициализация карты для выбора места
initLocationMap() {
    if (!this.ymapsReady) {
        alert('Карты загружаются. Попробуйте через пару секунд.');
        return;
    }
    
    const mapContainer = document.getElementById('location-map');
    if (!mapContainer) return;
    
    // Устанавливаем высоту контейнера в соответствии с новым дизайном
    mapContainer.style.minHeight = '250px';
    mapContainer.style.height = '100%';
    
    const city = this.app.cities[this.app.currentCity];
    const center = city ? [city.lat, city.lng] : [55.7558, 37.6173];
    
    this.locationMap = new ymaps.Map("location-map", {
        center: center,
        zoom: 13,
        controls: ['zoomControl', 'searchControl', 'fullscreenControl']
    });
    
    this.locationMap.events.add('click', (e) => {
        this.handleMapClick(e);
    });
    
    const lat = document.getElementById('match-lat').value;
    const lng = document.getElementById('match-lng').value;
    
    if (lat && lng) {
        this.showSelectedPoint([parseFloat(lat), parseFloat(lng)]);
        this.reverseGeocode([parseFloat(lat), parseFloat(lng)]);
    }
},
    
    // Обработка клика на карту
    handleMapClick(e) {
        const coords = e.get('coords');
        
        if (this.selectedPlacemark) {
            this.locationMap.geoObjects.remove(this.selectedPlacemark);
        }
        
        this.selectedPlacemark = new ymaps.Placemark(coords, {
            hintContent: 'Выбранное место',
            balloonContent: 'Место проведения матча'
        }, {
            preset: 'islands#redDotIcon',
            draggable: true
        });
        
        this.locationMap.geoObjects.add(this.selectedPlacemark);
        this.selectedCoords = coords;
       
        this.reverseGeocode(coords);
        
        this.selectedPlacemark.events.add('dragend', () => {
            const newCoords = this.selectedPlacemark.geometry.getCoordinates();
            this.selectedCoords = newCoords;
            this.updateCoordinatesDisplay(newCoords);
            this.reverseGeocode(newCoords);
        });
    },
    
    
    
    // Обратное геокодирование (получение адреса по координатам)
    reverseGeocode(coords) {
        ymaps.geocode(coords).then((res) => {
            const firstGeoObject = res.geoObjects.get(0);
            
            if (firstGeoObject) {
                const address = firstGeoObject.getAddressLine();
                const name = firstGeoObject.getLocalities().length > 0 ? 
                    firstGeoObject.getLocalities()[0] : 
                    firstGeoObject.getThoroughfare() || 'Выбранное место';
                
                document.getElementById('location-name').value = name;
                document.getElementById('location-address').value = address;
                
                this.selectedPlacemark.properties.set({
                    hintContent: name,
                    balloonContent: address
                });
            }
        }).catch((error) => {
            console.error('Ошибка геокодирования:', error);
        });
    },
    
    // Показать уже выбранную точку
    showSelectedPoint(coords) {
        if (!this.locationMap) return;
        
        this.selectedCoords = coords;
        this.selectedPlacemark = new ymaps.Placemark(coords, {
            hintContent: 'Выбранное место',
            balloonContent: 'Место проведения матча'
        }, {
            preset: 'islands#greenDotIcon'
        });
        
        this.locationMap.geoObjects.add(this.selectedPlacemark);
        this.locationMap.setCenter(coords, 15);
        
    },
    
    // Подтверждение выбора места
    confirmLocation() {
        if (!this.selectedCoords) {
            alert('Выберите место на карте!');
            return;
        }
        
        const name = document.getElementById('location-name').value;
        const address = document.getElementById('location-address').value;
        const [lat, lng] = this.selectedCoords;
        
        document.getElementById('match-lat').value = lat;
        document.getElementById('match-lng').value = lng;
        
        let locationText = name;
        if (address) {
            locationText += ` (${address})`;
        }
        document.getElementById('match-location').value = locationText;
        
        document.getElementById('location-coordinates').innerHTML = `
            <i class="fas fa-check-circle" style="color: var(--accent-green);"></i>
            Место выбрано
        `;
        
        this.closeLocationPicker();
    },
    
    // Закрытие окна выбора места
    closeLocationPicker() {
        const modal = document.getElementById('location-picker-modal');
        modal.classList.remove('active');
        modal.classList.add('hidden');
        
		// Показать нижнее меню
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = 'flex';
    }
		
        if (this.locationMap) {
            this.locationMap.destroy();
            this.locationMap = null;
        }
        this.selectedPlacemark = null;
        
        document.getElementById('location-name').value = '';
        document.getElementById('location-address').value = '';
        
    }
};