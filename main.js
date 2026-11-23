/* ==========================================================================
   EvakuaPE (SismoTech) — Lógica de Aplicación SPA, Mapas Reales y Triaje
   ========================================================================== */

(() => {
  'use strict';

  const STORAGE_REPORTS_KEY = 'evakuape_reports_v2';
  const STORAGE_OFFLINE_KEY = 'evakuape_offline_queue_v2';

  // Reportes iniciales georreferenciados en Lima Metropolitana
  const DEFAULT_REPORTS = [
    {
      id: 'EVK-1042',
      district: 'Cercado de Lima · Barrios Altos',
      address: 'Jr. Ancash 1140, Cercado de Lima',
      lat: -12.0478,
      lng: -77.0185,
      score: 96,
      severity: 'critical',
      status: 'Pendiente',
      damages: ['Grieta en forma de "X"', 'Fierros internos expuestos'],
      timestamp: 'Hace 3 min',
      housePhoto: '',
      anomalyPhoto: '',
      source: 'Ciudadano'
    },
    {
      id: 'EVK-1045',
      district: 'San Juan de Lurigancho · Canto Grande',
      address: 'Av. Canto Grande 2410, S.J. Lurigancho',
      lat: -11.9884,
      lng: -77.0061,
      score: 91,
      severity: 'critical',
      status: 'Brigada Asignada',
      damages: ['Fierros internos expuestos'],
      timestamp: 'Hace 6 min',
      housePhoto: '',
      anomalyPhoto: '',
      source: 'Ciudadano'
    },
    {
      id: 'EVK-1039',
      district: 'La Victoria · El Porvenir',
      address: 'Jr. Sebastián Barranca 1520, La Victoria',
      lat: -12.0672,
      lng: -77.0224,
      score: 88,
      severity: 'critical',
      status: 'Pendiente',
      damages: ['Grieta en forma de "X"'],
      timestamp: 'Hace 9 min',
      housePhoto: '',
      anomalyPhoto: '',
      source: 'Ciudadano'
    },
    {
      id: 'EVK-1048',
      district: 'Villa El Salvador · Sector 2',
      address: 'Av. César Vallejo cruce con Av. Revolución, VES',
      lat: -12.2091,
      lng: -76.9412,
      score: 64,
      severity: 'moderate',
      status: 'Pendiente',
      damages: ['Fisura > moneda de S/ 1'],
      timestamp: 'Hace 12 min',
      housePhoto: '',
      anomalyPhoto: '',
      source: 'Ciudadano'
    },
    {
      id: 'EVK-1033',
      district: 'Miraflores · Av. Pardo',
      address: 'Av. José Pardo 640, Miraflores',
      lat: -12.1191,
      lng: -77.0349,
      score: 12,
      severity: 'aesthetic',
      status: 'Descartado (Estético)',
      damages: ['Solo caída de tarrajeo'],
      timestamp: 'Hace 15 min',
      housePhoto: '',
      anomalyPhoto: '',
      source: 'Ciudadano'
    },
    {
      id: 'EVK-1037',
      district: 'San Miguel · Av. La Marina',
      address: 'Av. La Marina 2150, San Miguel',
      lat: -12.0776,
      lng: -77.0825,
      score: 10,
      severity: 'aesthetic',
      status: 'Descartado (Estético)',
      damages: ['Solo caída de tarrajeo'],
      timestamp: 'Hace 18 min',
      housePhoto: '',
      anomalyPhoto: '',
      source: 'Ciudadano'
    }
  ];

  // Diccionario rápido de respaldo para búsquedas en Perú si no hay conexión a Nominatim
  const PERU_PLACES_FALLBACK = [
    { keys: ['lima', 'cercado', 'plaza mayor', 'centro'], lat: -12.0464, lng: -77.0428, label: 'Cercado de Lima · Plaza Mayor, Lima' },
    { keys: ['sjl', 'san juan de lurigancho', 'canto grande', 'zarate'], lat: -11.9884, lng: -77.0061, label: 'San Juan de Lurigancho, Lima' },
    { keys: ['miraflores', 'pardo', 'larco', 'kennedy'], lat: -12.1191, lng: -77.0349, label: 'Miraflores, Lima' },
    { keys: ['la victoria', 'gamarra', 'manco capac'], lat: -12.0653, lng: -77.0280, label: 'La Victoria, Lima' },
    { keys: ['villa el salvador', 'ves'], lat: -12.2091, lng: -76.9412, label: 'Villa El Salvador, Lima' },
    { keys: ['san miguel', 'la marina'], lat: -12.0776, lng: -77.0825, label: 'San Miguel, Lima' },
    { keys: ['arequipa', 'av arequipa', 'lince', 'san isidro'], lat: -12.0886, lng: -77.0348, label: 'Av. Arequipa · Lince / San Isidro, Lima' },
    { keys: ['callao', 'bellavista', 'la perla'], lat: -12.0566, lng: -77.1181, label: 'Callao, Provincia Constitucional del Callao' },
    { keys: ['surco', 'santiago de surco', 'benavides'], lat: -12.1353, lng: -76.9904, label: 'Santiago de Surco, Lima' },
    { keys: ['los olivos', 'mega plaza', 'independencia'], lat: -11.9911, lng: -77.0706, label: 'Los Olivos, Lima Norte' }
  ];

  // Estado Global de la Aplicación
  const state = {
    currentView: 'home',
    isOnline: true,
    highContrast: false,
    wizard: {
      step: 1,
      locationConfirmed: false,
      lat: null,
      lng: null,
      address: '',
      panoramicPhoto: null,
      panoramicName: '',
      detailPhoto: null,
      detailName: '',
      selectedDamages: new Set(),
      countdownTimer: null,
      countdownValue: 5
    },
    coe: {
      filter: 'all',
      heatmap: false,
      selectedReportId: null,
      hasNewReportAlert: false
    },
    reports: loadSavedReports(),
    offlineQueue: loadOfflineQueue()
  };

  if (state.reports.length > 0) {
    state.coe.selectedReportId = state.reports[0].id;
  }

  // Referencias a instancias de Leaflet
  let citizenMap = null;
  let citizenMarker = null;
  let coeMap = null;
  let coeMarkersLayer = null;

  // ==========================================================================
  // PERSISTENCIA EN LOCALSTORAGE
  // ==========================================================================
  function loadSavedReports() {
    try {
      const raw = localStorage.getItem(STORAGE_REPORTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      // Ignorar si almacenamiento bloqueado
    }
    return JSON.parse(JSON.stringify(DEFAULT_REPORTS));
  }

  function saveReportsToStorage() {
    try {
      localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(state.reports));
    } catch (e) {
      // Si excede cuota por imágenes grandes, guardar sin base64 pesado
      try {
        const lite = state.reports.map(r => ({ ...r, housePhoto: '', anomalyPhoto: '' }));
        localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(lite));
      } catch (err) {
        // Silencioso
      }
    }
    updateGlobalReportBadges();
  }

  function loadOfflineQueue() {
    try {
      const raw = localStorage.getItem(STORAGE_OFFLINE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveOfflineQueue() {
    try {
      localStorage.setItem(STORAGE_OFFLINE_KEY, JSON.stringify(state.offlineQueue));
    } catch (e) {
      // Silencioso
    }
  }

  function updateGlobalReportBadges() {
    const total = state.reports.length;
    const navBadge = document.getElementById('nav-reports-badge');
    const homeLive = document.getElementById('home-live-count');
    if (navBadge) navBadge.textContent = String(total);
    if (homeLive) homeLive.textContent = `${total} reportes activos`;
  }

  // ==========================================================================
  // SESIÓN INSTITUCIONAL (LOGIN DE RESCATISTAS Y COE)
  // ==========================================================================
  const AUTH_KEY = 'evakuape_auth_v3';
  const CREDENTIALS = {
    resc: { user: '12345678', pass: 'Brigada2026' },
    coe: { user: 'rluna@indeci.gob.pe', pass: 'COE2026' }
  };
  function readAuth() { try { return JSON.parse(sessionStorage.getItem(AUTH_KEY)) || {}; } catch (e) { return {}; } }
  function isAuth(kind) { return Boolean(readAuth()[kind]); }
  function setAuth(kind, value) {
    const a = readAuth(); a[kind] = value;
    try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(a)); } catch (e) { /* sin almacenamiento */ }
  }

  // ==========================================================================
  // NAVEGACIÓN ENTRE PANTALLAS (SPA SIN ABRIR NUEVAS PESTAÑAS)
  // ==========================================================================
  function switchView(viewName, scrollTargetId = null) {
    const validViews = ['home', 'report', 'indeci', 'rescatista', 'login-resc', 'login-coe'];
    if (!validViews.includes(viewName)) return;
    // Los entornos institucionales exigen iniciar sesión primero
    if (viewName === 'indeci' && !isAuth('coe')) viewName = 'login-coe';
    if (viewName === 'rescatista' && !isAuth('resc')) viewName = 'login-resc';

    state.currentView = viewName;

    // Mostrar solo la pantalla seleccionada
    validViews.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) {
        el.classList.toggle('hidden', v !== viewName);
        el.classList.toggle('active', v === viewName);
      }
    });

    // Actualizar estado activo en enlaces del menú
    document.querySelectorAll('.nav-link').forEach(link => {
      const target = link.getAttribute('data-view-target');
      const scrollAttr = link.getAttribute('data-scroll');
      if (viewName === 'home') {
        link.classList.toggle('active', target === 'home' && (!scrollTargetId || scrollAttr === scrollTargetId));
      } else {
        link.classList.toggle('active', target === viewName);
      }
    });

    // Cerrar menú sándwich en móvil/tablet si estaba abierto
    closeMobileMenu();

    // Inicializar / refrescar componentes específicos de cada pantalla
    if (viewName === 'report') {
      setTimeout(() => {
        initCitizenMap();
        if (citizenMap) citizenMap.invalidateSize();
      }, 60);
    } else if (viewName === 'indeci') {
      renderCoeDashboard();
      setTimeout(() => {
        initCoeMap();
        if (coeMap) {
          coeMap.invalidateSize();
          renderCoeMapMarkers();
        }
      }, 60);
    } else if (viewName === 'rescatista') {
      renderRescuerConsole();
    }

    if (scrollTargetId && viewName === 'home') {
      const section = document.getElementById(scrollTargetId);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================================================
  // MENÚ SÁNDWICH RESPONSIVE (3 LÍNEAS)
  // ==========================================================================
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navDrawer = document.getElementById('primary-nav-drawer');

  function toggleMobileMenu() {
    if (!hamburgerBtn || !navDrawer) return;
    const isOpen = navDrawer.classList.toggle('open');
    hamburgerBtn.classList.toggle('is-open', isOpen);
    hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
    hamburgerBtn.setAttribute('aria-label', isOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
  }

  function closeMobileMenu() {
    if (!hamburgerBtn || !navDrawer) return;
    navDrawer.classList.remove('open');
    hamburgerBtn.classList.remove('is-open');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    hamburgerBtn.setAttribute('aria-label', 'Abrir menú de navegación');
  }

  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', toggleMobileMenu);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileMenu();
      const mapWrapper = document.getElementById('report-map-wrapper');
      if (mapWrapper && mapWrapper.classList.contains('is-maximized')) {
        toggleCitizenMapSize(false);
      }
    }
  });

  // Delegación global de navegación entre vistas
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-view-target]');
    if (trigger) {
      e.preventDefault();
      const targetView = trigger.getAttribute('data-view-target');
      const scrollId = trigger.getAttribute('data-scroll');
      switchView(targetView, scrollId);
    }
  });

  // Botones principales de la Landing Page (Hero Figma Split)
  document.getElementById('btn-start-emergency')?.addEventListener('click', () => {
    resetWizardForNewReport();
    switchView('report');
  });

  document.getElementById('btn-go-indeci')?.addEventListener('click', () => {
    switchView('indeci');
  });

  document.getElementById('btn-go-rescuer')?.addEventListener('click', () => {
    switchView('rescatista');
  });

  // ==========================================================================
  // CONTROLES DE CABECERA: MODO ALTO CONTRASTE Y SIMULACIÓN DE RED
  // ==========================================================================
  const btnHighContrast = document.getElementById('btn-high-contrast');
  const btnRescuerContrast = document.getElementById('btn-rescuer-contrast');

  function toggleHighContrast() {
    state.highContrast = !state.highContrast;
    document.body.classList.toggle('high-contrast', state.highContrast);
    if (btnHighContrast) btnHighContrast.setAttribute('aria-pressed', String(state.highContrast));
  }

  btnHighContrast?.addEventListener('click', toggleHighContrast);
  btnRescuerContrast?.addEventListener('click', toggleHighContrast);

  const btnToggleNetwork = document.getElementById('btn-toggle-network');
  const networkLabel = document.getElementById('network-label');
  const citizenOfflineBanner = document.getElementById('citizen-offline-banner');

  function setHomeNet(on) {
    const t = document.getElementById('home-net-title'), x = document.getElementById('home-net-text');
    document.getElementById('home-net-card')?.classList.toggle('offline', !on);
    if (t) t.textContent = on ? 'Red disponible' : 'Sin conexión';
    if (x) x.textContent = on ? 'Puede enviar su reporte.' : 'Su reporte se guardará localmente.';
  }

  function showSyncToast(msg) {
    const toast = document.getElementById('sync-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
  }

  function updateNetworkUI() {
    if (!btnToggleNetwork || !networkLabel) return;
    if (state.isOnline) {
      document.getElementById('rescuer-offline-banner')?.classList.add('hidden');
      btnToggleNetwork.classList.remove('status-offline');
      btnToggleNetwork.classList.add('status-online');
      btnToggleNetwork.setAttribute('aria-pressed', 'false');
      networkLabel.textContent = 'Red Activa';
      setHomeNet(true);
      citizenOfflineBanner?.classList.add('hidden');
      syncOfflineReportsIfNeeded();
    } else {
      document.getElementById('rescuer-offline-banner')?.classList.remove('hidden');
      btnToggleNetwork.classList.remove('status-online');
      btnToggleNetwork.classList.add('status-offline');
      btnToggleNetwork.setAttribute('aria-pressed', 'true');
      networkLabel.textContent = 'Sin Red (Offline)';
      setHomeNet(false);
      citizenOfflineBanner?.classList.remove('hidden');
    }
  }

  btnToggleNetwork?.addEventListener('click', () => {
    state.isOnline = !state.isOnline;
    updateNetworkUI();
  });

  function syncOfflineReportsIfNeeded() {
    if (state.offlineQueue.length === 0) {
      renderOfflineQueuePanel();
      return;
    }
    const itemsToSync = [...state.offlineQueue];
    state.offlineQueue = [];
    saveOfflineQueue();

    itemsToSync.forEach(rep => {
      rep.timestamp = 'Sincronizado ahora';
      state.reports.unshift(rep);
    });
    state.reports.sort((a, b) => b.score - a.score);
    saveReportsToStorage();
    state.coe.hasNewReportAlert = true;
    showSyncToast(`✓ ${itemsToSync.length} reporte(s) offline sincronizado(s) con Defensa Civil.`);
    renderOfflineQueuePanel();
    if (state.currentView === 'indeci') {
      renderCoeDashboard();
      renderCoeMapMarkers();
    }
  }

  function renderOfflineQueuePanel() {
    const panel = document.getElementById('offline-queue-panel');
    const countBadge = document.getElementById('offline-queue-count');
    const list = document.getElementById('offline-queue-list');
    if (!panel || !countBadge || !list) return;

    if (state.offlineQueue.length === 0) {
      panel.classList.add('hidden');
      return;
    }

    panel.classList.remove('hidden');
    countBadge.textContent = `${state.offlineQueue.length} pendiente(s)`;
    list.innerHTML = state.offlineQueue
      .map(item => `<li><strong>${item.id}</strong> — ${item.address} (${item.damages.join(', ')})</li>`)
      .join('');
  }

  // ==========================================================================
  // PASO 1: MAPA REAL INTERACTIVO (MAXIMIZAR/MINIMIZAR, BÚSQUEDA, UBICACIÓN)
  // ==========================================================================
  function initCitizenMap() {
    const container = document.getElementById('citizen-leaflet-map');
    if (!container || typeof L === 'undefined') return;

    if (!citizenMap) {
      citizenMap = L.map('citizen-leaflet-map', {
        center: [-12.0464, -77.0428],
        zoom: 13
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(citizenMap);

      // Permitir hacer clic en cualquier punto del mapa para fijar la vivienda
      citizenMap.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setCitizenLocation(lat, lng, null, true);
      });
    }
  }

  function setCitizenLocation(lat, lng, explicitAddress = null, shouldReverseGeocode = false) {
    state.wizard.lat = Number(lat.toFixed(5));
    state.wizard.lng = Number(lng.toFixed(5));
    state.wizard.locationConfirmed = true;

    if (citizenMap && typeof L !== 'undefined') {
      if (!citizenMarker) {
        citizenMarker = L.marker([state.wizard.lat, state.wizard.lng], { draggable: true }).addTo(citizenMap);
        citizenMarker.on('dragend', () => {
          const pos = citizenMarker.getLatLng();
          setCitizenLocation(pos.lat, pos.lng, null, true);
        });
      } else {
        citizenMarker.setLatLng([state.wizard.lat, state.wizard.lng]);
      }
      citizenMap.flyTo([state.wizard.lat, state.wizard.lng], Math.max(citizenMap.getZoom(), 15), {
        duration: 0.7
      });
    }

    const baseLabel = explicitAddress || `Ubicación marcada (${state.wizard.lat}, ${state.wizard.lng})`;
    state.wizard.address = baseLabel;
    updateStep1LocationUI();

    if (citizenMarker) {
      citizenMarker.bindPopup(`<strong>Vivienda reportada</strong><br>${state.wizard.address}`).openPopup();
    }

    // Geocodificación inversa en segundo plano si se marcó manualmente en el mapa
    if (shouldReverseGeocode && state.isOnline) {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${state.wizard.lat}&lon=${state.wizard.lng}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.display_name) {
            const parts = data.display_name.split(',').slice(0, 3).join(',').trim();
            state.wizard.address = parts;
            updateStep1LocationUI();
            if (citizenMarker) {
              citizenMarker.setPopupContent(`<strong>Vivienda reportada</strong><br>${state.wizard.address}`);
            }
          }
        })
        .catch(() => {
          // Mantener coordenadas confirmadas si no hay respuesta
        });
    }
  }

  function updateStep1LocationUI() {
    const statusBox = document.getElementById('location-status-box');
    const badge = document.getElementById('location-badge');
    const addrText = document.getElementById('selected-address-text');
    const coordsText = document.getElementById('selected-coords-text');
    const btnToStep2 = document.getElementById('btn-to-step-2');

    if (state.wizard.locationConfirmed) {
      statusBox?.classList.add('confirmed');
      if (badge) {
        badge.className = 'badge badge-green';
        badge.textContent = 'UBICACIÓN CONFIRMADA';
      }
      if (addrText) addrText.textContent = state.wizard.address;
      if (coordsText) coordsText.textContent = `Lat: ${state.wizard.lat} , Lng: ${state.wizard.lng}`;
      if (btnToStep2) btnToStep2.disabled = false;
    } else {
      statusBox?.classList.remove('confirmed');
      if (badge) {
        badge.className = 'badge badge-amber';
        badge.textContent = 'UBICACIÓN PENDIENTE';
      }
      if (addrText) {
        addrText.textContent = 'Aún no has seleccionado una ubicación. Busca una dirección, haz clic en el mapa o pulsa "Usar mi ubicación".';
      }
      if (coordsText) coordsText.textContent = 'Lat: -- , Lng: --';
      if (btnToStep2) btnToStep2.disabled = true;
    }
  }

  // Búsqueda de direcciones dentro del mapa
  const mapSearchForm = document.getElementById('map-search-form');
  const mapAddressInput = document.getElementById('map-address-input');

  mapSearchForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = (mapAddressInput?.value || '').trim();
    if (!query) return;

    const addrText = document.getElementById('selected-address-text');
    if (addrText) addrText.textContent = `Buscando "${query}" en el mapa...`;

    // 1. Intentar búsqueda real en OpenStreetMap Nominatim
    if (state.isOnline) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pe&q=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        if (response.ok) {
          const results = await response.json();
          if (Array.isArray(results) && results.length > 0) {
            const hit = results[0];
            const cleanName = hit.display_name.split(',').slice(0, 3).join(',').trim();
            setCitizenLocation(parseFloat(hit.lat), parseFloat(hit.lon), cleanName, false);
            return;
          }
        }
      } catch (err) {
        // Continuar al respaldo local
      }
    }

    // 2. Respaldo inteligente local para distritos y vías del Perú
    const normalized = query.toLowerCase();
    const match = PERU_PLACES_FALLBACK.find(p => p.keys.some(k => normalized.includes(k)));
    if (match) {
      setCitizenLocation(match.lat, match.lng, `${query} (${match.label})`, false);
    } else {
      // Centrar en Lima con la dirección ingresada por el usuario
      setCitizenLocation(-12.0553, -77.0365, `${query}, Lima - Perú`, false);
    }
  });

  // Botón "Usar mi ubicación" (Geolocalización real del navegador)
  document.getElementById('btn-use-my-location')?.addEventListener('click', () => {
    const addrText = document.getElementById('selected-address-text');
    if (addrText) addrText.textContent = 'Detectando tu ubicación actual mediante GPS...';

    if (!navigator.geolocation) {
      setCitizenLocation(-12.0464, -77.0428, 'Ubicación detectada · Lima Metropolitana', false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCitizenLocation(position.coords.latitude, position.coords.longitude, null, true);
      },
      () => {
        // Si el navegador bloquea permisos GPS en entorno local, fijar punto de referencia en Lima para no bloquear al usuario
        setCitizenLocation(-12.0464, -77.0428, 'Ubicación GPS referencial · Cercado de Lima', false);
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  });

  // Botones rápidos de zonas de referencia
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const lat = parseFloat(chip.getAttribute('data-lat'));
      const lng = parseFloat(chip.getAttribute('data-lng'));
      const label = chip.getAttribute('data-label');
      setCitizenLocation(lat, lng, label, false);
    });
  });

  // Botón Maximizar / Minimizar Mapa
  const btnToggleMapSize = document.getElementById('btn-toggle-map-size');
  const mapSizeLabel = document.getElementById('map-size-label');

  function toggleCitizenMapSize(forceState = null) {
    const wrapper = document.getElementById('report-map-wrapper');
    if (!wrapper) return;
    const nextState = forceState !== null ? forceState : !wrapper.classList.contains('is-maximized');
    wrapper.classList.toggle('is-maximized', nextState);
    if (btnToggleMapSize) btnToggleMapSize.setAttribute('aria-pressed', String(nextState));
    if (mapSizeLabel) mapSizeLabel.textContent = nextState ? 'Minimizar Mapa' : 'Maximizar Mapa';

    setTimeout(() => {
      if (citizenMap) citizenMap.invalidateSize();
    }, 100);
  }

  btnToggleMapSize?.addEventListener('click', () => toggleCitizenMapSize());

  // Navegación Paso 1 -> Paso 2 (Bloqueada si no hay ubicación confirmada)
  document.getElementById('btn-to-step-2')?.addEventListener('click', () => {
    if (!state.wizard.locationConfirmed) return;
    toggleCitizenMapSize(false);
    goToWizardStep(2);
  });

  // ==========================================================================
  // PASO 2: CARGA OBLIGATORIA DE IMÁGENES DE VIVIENDA Y ANOMALÍA
  // ==========================================================================
  function createSamplePhotoDataUrl(type) {
    return type === 'house' ? 'imagenes/imagen_casa_demo.jpg' : 'imagenes/imagen_grieta_demo.jpg';
  }

  // Reduce el tamaño de las fotos subidas para poder guardarlas en el navegador
  function readImageFile(file, done) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 900 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        done(c.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => done(reader.result);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function handlePhotoSelected(targetType, dataUrl, fileName) {
    if (targetType === 'house') {
      state.wizard.panoramicPhoto = dataUrl;
      state.wizard.panoramicName = fileName;
      document.getElementById('panoramic-guide-overlay')?.classList.add('hidden');
      const preview = document.getElementById('panoramic-preview-area');
      if (preview) {
        preview.classList.remove('hidden');
        preview.innerHTML = `<img src="${dataUrl}" alt="Vista previa de vivienda reportada" /><span class="photo-filename">Archivo cargado: ${fileName}</span>`;
      }
      document.getElementById('card-upload-house')?.classList.add('completed');
      const tag = document.getElementById('house-photo-status');
      if (tag) {
        tag.className = 'upload-state-tag done';
        tag.textContent = 'Cargada';
      }
    } else {
      state.wizard.detailPhoto = dataUrl;
      state.wizard.detailName = fileName;
      document.getElementById('detail-guide-overlay')?.classList.add('hidden');
      const preview = document.getElementById('detail-preview-area');
      if (preview) {
        preview.classList.remove('hidden');
        preview.innerHTML = `<img src="${dataUrl}" alt="Vista previa de anomalía observada" /><span class="photo-filename">Archivo cargado: ${fileName}</span>`;
      }
      document.getElementById('card-upload-anomaly')?.classList.add('completed');
      const tag = document.getElementById('anomaly-photo-status');
      if (tag) {
        tag.className = 'upload-state-tag done';
        tag.textContent = 'Cargada';
      }
    }

    validateStep2Completion();
  }

  function validateStep2Completion() {
    const houseLoaded = Boolean(state.wizard.panoramicPhoto);
    const btnToStep3 = document.getElementById('btn-to-step-3');
    const notice = document.getElementById('step2-requirement-msg');

    if (btnToStep3) btnToStep3.disabled = !houseLoaded;
    if (notice) {
      notice.classList.toggle('ready', houseLoaded);
      notice.textContent = houseLoaded
        ? 'Foto panorámica lista. Ya puedes continuar al Paso 3 (la foto de detalle es opcional).'
        : 'Sube la foto panorámica de la vivienda (obligatoria) para habilitar el Paso 3.';
    }
  }

  document.getElementById('input-panoramic-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readImageFile(file, url => handlePhotoSelected('house', url, file.name));
  });

  document.getElementById('input-detail-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readImageFile(file, url => handlePhotoSelected('anomaly', url, file.name));
  });

  document.getElementById('btn-sample-panoramic')?.addEventListener('click', () => {
    handlePhotoSelected('house', createSamplePhotoDataUrl('house'), 'fachada_vivienda.jpg');
  });

  document.getElementById('btn-sample-detail')?.addEventListener('click', () => {
    handlePhotoSelected('anomaly', createSamplePhotoDataUrl('anomaly'), 'detalle_anomalia.jpg');
  });

  document.getElementById('btn-back-to-1')?.addEventListener('click', () => goToWizardStep(1));
  document.getElementById('btn-to-step-3')?.addEventListener('click', () => {
    if (!state.wizard.panoramicPhoto) return;
    goToWizardStep(3);
  });

  // ==========================================================================
  // PASO 3: SELECCIÓN DE TIPOS DE DAÑOS OBSERVADOS Y ENVÍO
  // ==========================================================================
  const DAMAGE_LABELS = {
    x_crack: 'Grieta en forma de "X"',
    exposed_rebar: 'Fierros internos expuestos',
    coin_width: 'Fisura > moneda de S/ 1',
    plaster_only: 'Solo caída de tarrajeo'
  };

  const damageCards = document.querySelectorAll('.damage-card');

  damageCards.forEach(card => {
    card.addEventListener('click', () => {
      const code = card.getAttribute('data-damage');
      if (!code) return;

      if (code === 'plaster_only') {
        const selectingPlaster = !state.wizard.selectedDamages.has('plaster_only');
        state.wizard.selectedDamages.clear();
        if (selectingPlaster) {
          state.wizard.selectedDamages.add('plaster_only');
        }
      } else {
        state.wizard.selectedDamages.delete('plaster_only');
        if (state.wizard.selectedDamages.has(code)) {
          state.wizard.selectedDamages.delete(code);
        } else {
          state.wizard.selectedDamages.add(code);
        }
      }

      syncDamageCardsUI();
    });
  });

  function syncDamageCardsUI() {
    const plasterSelected = state.wizard.selectedDamages.has('plaster_only');

    damageCards.forEach(card => {
      const code = card.getAttribute('data-damage');
      const isSelected = state.wizard.selectedDamages.has(code);
      card.classList.toggle('selected', isSelected);
      card.setAttribute('aria-pressed', String(isSelected));
      card.disabled = plasterSelected && code !== 'plaster_only';
    });

    const hasSelection = state.wizard.selectedDamages.size > 0;
    const btnSubmit = document.getElementById('btn-submit-report');
    const summaryBox = document.getElementById('summary-dynamic-text');

    if (btnSubmit) btnSubmit.disabled = !hasSelection;

    if (summaryBox) {
      if (!hasSelection) {
        summaryBox.innerHTML = 'Selecciona al menos un tipo de daño observado arriba para habilitar el envío.';
      } else {
        const names = Array.from(state.wizard.selectedDamages).map(k => DAMAGE_LABELS[k]);
        summaryBox.innerHTML = `
          <strong>Ubicación:</strong> ${state.wizard.address} (${state.wizard.lat}, ${state.wizard.lng})<br/>
          <strong>Evidencias adjuntas:</strong> ${state.wizard.panoramicName} y ${state.wizard.detailName}<br/>
          <strong>Daños seleccionados:</strong> ${names.join(' · ')}
        `;
      }
    }
  }

  document.getElementById('btn-back-to-2')?.addEventListener('click', () => goToWizardStep(2));

  function goToWizardStep(stepNumber) {
    state.wizard.step = stepNumber;

    [1, 2, 3].forEach(num => {
      const panel = document.getElementById(`wizard-step-${num}`);
      const pill = document.getElementById(`step-indicator-${num}`);
      if (panel) panel.classList.toggle('active', num === stepNumber);
      if (pill) {
        pill.classList.toggle('active', num === stepNumber);
        pill.classList.toggle('completed', num < stepNumber);
      }
    });

    if (stepNumber === 1 && citizenMap) {
      setTimeout(() => citizenMap.invalidateSize(), 60);
    }
  }

  function resetWizardForNewReport() {
    state.wizard.step = 1;
    state.wizard.locationConfirmed = false;
    state.wizard.lat = null;
    state.wizard.lng = null;
    state.wizard.address = '';
    state.wizard.panoramicPhoto = null;
    state.wizard.panoramicName = '';
    state.wizard.detailPhoto = null;
    state.wizard.detailName = '';
    state.wizard.selectedDamages.clear();

    if (citizenMarker && citizenMap) {
      citizenMap.removeLayer(citizenMarker);
      citizenMarker = null;
    }

    // Restablecer Paso 2
    document.getElementById('panoramic-guide-overlay')?.classList.remove('hidden');
    document.getElementById('detail-guide-overlay')?.classList.remove('hidden');
    document.getElementById('panoramic-preview-area')?.classList.add('hidden');
    document.getElementById('detail-preview-area')?.classList.add('hidden');
    document.getElementById('card-upload-house')?.classList.remove('completed');
    document.getElementById('card-upload-anomaly')?.classList.remove('completed');

    const hTag = document.getElementById('house-photo-status');
    const aTag = document.getElementById('anomaly-photo-status');
    if (hTag) { hTag.className = 'upload-state-tag pending'; hTag.textContent = 'Obligatoria'; }
    if (aTag) { aTag.className = 'upload-state-tag pending'; aTag.textContent = 'Opcional'; }

    const inputPan = document.getElementById('input-panoramic-file');
    const inputDet = document.getElementById('input-detail-file');
    if (inputPan) inputPan.value = '';
    if (inputDet) inputDet.value = '';

    updateStep1LocationUI();
    validateStep2Completion();
    syncDamageCardsUI();
    goToWizardStep(1);
  }

  // ==========================================================================
  // TEMPORIZADOR DE 5 SEGUNDOS Y GUARDADO PARA DEFENSA CIVIL / BRIGADISTAS
  // ==========================================================================
  const modalCountdown = document.getElementById('modal-countdown');
  const countdownNumber = document.getElementById('countdown-number');

  document.getElementById('btn-submit-report')?.addEventListener('click', () => {
    if (state.wizard.selectedDamages.size === 0) return;

    const dmg = Array.from(state.wizard.selectedDamages).map(k => DAMAGE_LABELS[k]);
    document.getElementById('cd-house').src = state.wizard.panoramicPhoto;
    document.getElementById('cd-anomaly').src = state.wizard.detailPhoto;
    document.getElementById('cd-summary').innerHTML = dmg.map(d => `<div>&#10003; ${d}</div>`).join('') +
      `<small>GPS: ${state.wizard.lat}, ${state.wizard.lng}</small>`;
    state.wizard.countdownValue = 5;
    if (countdownNumber) countdownNumber.textContent = '5';
    modalCountdown?.classList.remove('hidden');

    clearInterval(state.wizard.countdownTimer);
    state.wizard.countdownTimer = setInterval(() => {
      state.wizard.countdownValue -= 1;
      if (countdownNumber) countdownNumber.textContent = String(state.wizard.countdownValue);
      if (state.wizard.countdownValue <= 0) {
        clearInterval(state.wizard.countdownTimer);
        modalCountdown?.classList.add('hidden');
        finalizeAndPersistCitizenReport();
      }
    }, 1000);
  });

  document.getElementById('btn-cancel-countdown')?.addEventListener('click', () => {
    clearInterval(state.wizard.countdownTimer);
    modalCountdown?.classList.add('hidden');
  });

  function finalizeAndPersistCitizenReport() {
    const selected = Array.from(state.wizard.selectedDamages);
    const hasCritical = selected.includes('x_crack') || selected.includes('exposed_rebar');
    const hasModerate = selected.includes('coin_width');

    let severity = 'aesthetic';
    let score = 15;
    if (hasCritical) {
      severity = 'critical';
      score = selected.includes('x_crack') && selected.includes('exposed_rebar') ? 98 : 92;
    } else if (hasModerate) {
      severity = 'moderate';
      score = 68;
    }

    const newReport = {
      id: `EVK-${Math.floor(1050 + Math.random() * 8900)}`,
      district: state.wizard.address,
      address: state.wizard.address,
      lat: state.wizard.lat || -12.0464,
      lng: state.wizard.lng || -77.0428,
      score,
      severity,
      status: severity === 'aesthetic' ? 'Descartado (Estético)' : 'Pendiente',
      damages: selected.map(k => DAMAGE_LABELS[k]),
      timestamp: 'Recién enviado',
      housePhoto: state.wizard.panoramicPhoto || '',
      anomalyPhoto: state.wizard.detailPhoto || 'OMITTED',
      source: 'Reporte Web Ciudadano'
    };

    if (state.isOnline) {
      state.reports.unshift(newReport);
      state.reports.sort((a, b) => b.score - a.score);
      state.coe.selectedReportId = newReport.id;
      state.coe.hasNewReportAlert = true;
      saveReportsToStorage();
      showFinalFeedbackModal(newReport);
    } else {
      state.offlineQueue.push(newReport);
      saveOfflineQueue();
      renderOfflineQueuePanel();

      // Animación de guardado offline (HU-44)
      const loaderModal = document.getElementById('modal-offline-loader');
      const spinner = document.getElementById('offline-spinner');
      const check = document.getElementById('offline-check');
      const text = document.getElementById('offline-loader-text');
      spinner?.classList.remove('hidden');
      check?.classList.add('hidden');
      if (text) text.textContent = 'Guardando reporte localmente...';
      loaderModal?.classList.remove('hidden');

      setTimeout(() => {
        spinner?.classList.add('hidden');
        check?.classList.remove('hidden');
        if (text) text.textContent = '¡Guardado en caché local!';
        setTimeout(() => {
          loaderModal?.classList.add('hidden');
          showFinalFeedbackModal(newReport);
        }, 650);
      }, 850);
    }

    showFinalFeedbackModal(newReport);
  }

  function showFinalFeedbackModal(report) {
    const modal = document.getElementById('modal-feedback');
    const surface = document.getElementById('feedback-modal-surface');
    if (!modal || !surface) return;

    const isDanger = report.severity === 'critical' || report.severity === 'moderate';
    surface.classList.toggle('feedback-danger', isDanger);
    surface.classList.toggle('feedback-safe', !isDanger);

    document.getElementById('feedback-icon-wrap').innerHTML = isDanger
      ? '<svg width="56" height="56" viewBox="0 0 24 24" fill="none"><path d="M12 3L22 20H2L12 3Z" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 10V14M12 17H12.01" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>'
      : '<svg width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M6 12.5L10.5 17L18 8" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    document.getElementById('feedback-title').innerHTML = isDanger ? 'Riesgo Inminente<br>¡NO REINGRESE!' : 'Daño Superficial';
    document.getElementById('feedback-instruction').textContent = isDanger
      ? 'Aléjese de la vivienda y diríjase a una zona segura.'
      : 'Selección reportada: solo cayó el tarrajeo.';

    const saved = state.isOnline
      ? (isDanger ? 'Pendiente de triaje en el COE.' : 'Pendiente de evaluación especializada.')
      : 'Guardado localmente. Se enviará a Defensa Civil al volver la conexión.';
    const received = `<div class="fb-received ${isDanger ? 'blue' : 'green'}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 12.5L10 17.5L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg><div><strong>Reporte recibido · ${report.id}</strong><span>${saved}</span></div></div>`;
    const btn = `<button type="button" id="btn-feedback-home" class="fb-btn ${isDanger ? 'red' : 'green'}">${isDanger ? 'ENTENDIDO / SALIR' : 'ENTENDIDO / VOLVER AL INICIO'}</button>`;

    let body;
    if (isDanger) {
      body = `<div class="fb-two"><div><h3>Señales reportadas</h3><ul class="fb-signs">${report.damages.map(d => `<li>&#10003; ${d}</li>`).join('')}</ul><p>Evaluación visual preliminar. Requiere verificación por personal especializado.</p></div>
        <div class="fb-photos"><figure><img src="${report.housePhoto}" alt="Panorámica" /><figcaption>Panorámica</figcaption></figure><figure><img src="${report.anomalyPhoto}" alt="Detalle" /><figcaption>Detalle</figcaption></figure></div></div>${received}${btn}`;
    } else {
      body = `<h3>Evaluación visual preliminar</h3><p>Esta evaluación no certifica la seguridad de la vivienda. Un especialista debe verificar el daño.</p>
        <div class="fb-warn"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3L22 20H2L12 3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10V14M12 17H12.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><div><strong>No reingrese si hay señales de peligro</strong><span>Grietas nuevas, inclinación, ruidos o caída de materiales: aléjese y reporte el riesgo.</span></div></div>${received}${btn}`;
    }
    document.getElementById('feedback-content').innerHTML = body;
    modal.scrollTop = 0;
    modal.classList.remove('hidden');
  }

  // Botón del resultado (se crea dinámicamente): vuelve a la página principal
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#btn-feedback-home')) return;
    document.getElementById('modal-feedback')?.classList.add('hidden');
    resetWizardForNewReport();
    switchView('home');
  });


  // ==========================================================================
  // PANTALLA 3: DASHBOARD CENTRAL DEFENSA CIVIL (COE - INDECI)
  // ==========================================================================
  ['resc', 'coe'].forEach(kind => {
    document.getElementById(`form-login-${kind}`)?.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = document.getElementById(`login-${kind}-user`).value.trim();
      const pass = document.getElementById(`login-${kind}-pass`).value;
      const err = document.getElementById(`login-${kind}-error`);
      if (!user || !pass) {
        err.textContent = 'Ingrese su usuario y contraseña.'; err.classList.remove('hidden'); return;
      }
      if (user.toLowerCase() === CREDENTIALS[kind].user && pass === CREDENTIALS[kind].pass) {
        err.classList.add('hidden'); setAuth(kind, true); e.target.reset();
        switchView(kind === 'coe' ? 'indeci' : 'rescatista');
      } else {
        err.textContent = 'Credenciales inválidas. Verifique los datos e intente nuevamente.'; err.classList.remove('hidden');
      }
    });
  });

  document.addEventListener('click', (e) => {
    const eye = e.target.closest('[data-toggle-pass]');
    if (eye) {
      const input = document.getElementById(eye.getAttribute('data-toggle-pass'));
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
      return;
    }
    const out = e.target.closest('[data-logout]');
    if (out) { setAuth(out.getAttribute('data-logout'), false); switchView('home'); }
  });

  function initCoeMap() {
    const el = document.getElementById('coe-leaflet-map');
    if (!el || typeof L === 'undefined') return;

    if (!coeMap) {
      coeMap = L.map('coe-leaflet-map', {
        center: [-12.065, -77.035],
        zoom: 11
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(coeMap);
      coeMarkersLayer = L.layerGroup().addTo(coeMap);
    }
  }

  function getFilteredReports() {
    if (state.coe.filter === 'critical') {
      return state.reports.filter(r => r.severity === 'critical');
    }
    if (state.coe.filter === 'hide_false') {
      return state.reports.filter(r => r.severity !== 'aesthetic');
    }
    return state.reports;
  }

  function renderCoeMapMarkers() {
    if (!coeMap || !coeMarkersLayer || typeof L === 'undefined') return;
    coeMarkersLayer.clearLayers();
    if (state.coe.heatmap) return;

    const filtered = getFilteredReports();
    filtered.forEach(rep => {
      let color = '#D32F2F';
      if (rep.status === 'Brigada Asignada') color = '#0056B3';
      else if (rep.severity === 'moderate') color = '#B45309';
      else if (rep.severity === 'aesthetic') color = '#2E7D32';

      const marker = L.circleMarker([rep.lat, rep.lng], {
        radius: 11,
        fillColor: color,
        color: '#FFFFFF',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.92
      });

      marker.bindPopup(`
        <strong>${rep.id} · ${rep.district}</strong><br/>
        Estado: ${rep.status}<br/>
        Daños: ${rep.damages.join(', ')}
      `);

      marker.on('click', () => {
        state.coe.selectedReportId = rep.id;
        renderCoeDashboard();
      });

      marker.addTo(coeMarkersLayer);
    });
  }

  function renderCoeDashboard() {
    // Actualizar KPIs
    const criticalCount = state.reports.filter(r => r.severity === 'critical').length;
    const moderateCount = state.reports.filter(r => r.severity === 'moderate').length;
    const falseCount = state.reports.filter(r => r.severity === 'aesthetic').length;
    const assignedCount = state.reports.filter(r => r.status === 'Brigada Asignada').length;

    const kCrit = document.getElementById('kpi-critical-count');
    const kMod = document.getElementById('kpi-moderate-count');
    const kFalse = document.getElementById('kpi-false-count');
    const kAssig = document.getElementById('kpi-assigned-count');

    if (kCrit) kCrit.textContent = String(criticalCount);
    if (kMod) kMod.textContent = String(moderateCount);
    if (kFalse) kFalse.textContent = String(falseCount);
    if (kAssig) kAssig.textContent = String(assignedCount);

    const filtered = getFilteredReports();
    const badgeCount = document.getElementById('triage-count-badge');
    if (badgeCount) badgeCount.textContent = `${filtered.length} reporte(s)`;

    const listContainer = document.getElementById('triage-list-container');
    if (listContainer) {
      if (filtered.length === 0) {
        listContainer.innerHTML = '<p>No hay reportes que coincidan con el filtro actual.</p>';
      } else {
        if (!filtered.some(r => r.id === state.coe.selectedReportId)) {
          state.coe.selectedReportId = filtered[0].id;
        }
        listContainer.innerHTML = filtered
          .map(rep => {
            const sevBadge = rep.severity === 'critical'
              ? '<span class="badge badge-red">CRÍTICO</span>'
              : rep.severity === 'moderate'
                ? '<span class="badge badge-amber">MODERADO</span>'
                : '<span class="badge badge-green">ESTÉTICO</span>';
            const isActive = rep.id === state.coe.selectedReportId ? 'active' : '';
            return `
              <button type="button" class="triage-item ${isActive}" data-select-report="${rep.id}" role="listitem">
                <div class="triage-item-top">
                  <span class="triage-item-title">${rep.id} · ${rep.district}</span>
                  ${sevBadge}
                </div>
                <div class="triage-item-meta">
                  ${rep.damages.join(', ')} · <strong>${rep.status}</strong> (${rep.timestamp})
                </div>
              </button>
            `;
          })
          .join('');
      }
    }

    renderCoeDetailInspector();
  }

  function renderCoeDetailInspector() {
    const detailPanel = document.getElementById('triage-detail-panel');
    if (!detailPanel) return;

    document.getElementById('coe-live-alert')?.classList.toggle('hidden', !state.coe.hasNewReportAlert);

    const rep = state.reports.find(r => r.id === state.coe.selectedReportId) || state.reports[0];
    if (!rep) {
      detailPanel.innerHTML = '<p>Selecciona un reporte de la bandeja para ver sus evidencias.</p>';
      return;
    }

    const houseImgSrc = rep.housePhoto || createSamplePhotoDataUrl('house');
    const hasDetail = rep.anomalyPhoto !== 'OMITTED';
    const anomalyImgSrc = hasDetail ? (rep.anomalyPhoto || createSamplePhotoDataUrl('anomaly')) : '';
    const hasCoin = rep.damages.some(d => d.toLowerCase().includes('moneda'));

    detailPanel.innerHTML = `
      <div class="card-topbar">
        <h3>Detalle del Reporte ${rep.id}</h3>
        <span class="badge badge-blue">${rep.status}</span>
      </div>
      <p><strong>Ubicación:</strong> ${rep.address}</p>
      <div class="gps-row">
        <span><strong>GPS:</strong> <code>${rep.lat}, ${rep.lng}</code></span>
        <button type="button" class="btn btn-outline btn-sm" data-copy-gps="${rep.lat}, ${rep.lng}">Copiar GPS</button>
      </div>
      <div class="coin-indicator ${hasCoin ? 'coin-yes' : ''}">
        Grosor de fisura &gt; Moneda: ${hasCoin ? 'Sí' : 'No'}
      </div>
      <p><strong>Daños reportados:</strong> ${rep.damages.join(' · ')}</p>

      <button type="button" class="btn btn-secondary btn-sm btn-block" id="btn-toggle-evidence" aria-expanded="false">
        Ver Evidencia Fotográfica &#9662;
      </button>

      <div id="evidence-collapse-body" class="detail-photos-row hidden">
        <div class="detail-photo-box">
          <img src="${houseImgSrc}" alt="Foto panorámica de ${rep.id}" data-zoom-img="${houseImgSrc}" data-zoom-title="Panorámica · ${rep.id}" />
          <span>Vista de Vivienda (Clic para zoom)</span>
        </div>
        <div class="detail-photo-box">
          ${hasDetail
            ? `<img src="${anomalyImgSrc}" alt="Foto de anomalía de ${rep.id}" data-zoom-img="${anomalyImgSrc}" data-zoom-title="Detalle · ${rep.id}" /><span>Detalle de Anomalía (Clic para zoom)</span>`
            : `<div class="no-evidence-box">Evidencia no proporcionada</div><span>Detalle omitido</span>`
          }
        </div>
      </div>

      <div class="detail-actions">
        <button type="button" class="btn btn-institutional btn-block" data-assign-brigade="${rep.id}">
          Asignar Brigada de Rescate
        </button>
        <button type="button" class="btn btn-secondary btn-block" data-downgrade-report="${rep.id}">
          Reclasificar como Daño Estético
        </button>
      </div>
    `;
  }

  // Delegación de eventos en el Dashboard COE
  document.addEventListener('click', (e) => {
    const selectBtn = e.target.closest('[data-select-report]');
    if (selectBtn) {
      state.coe.selectedReportId = selectBtn.getAttribute('data-select-report');
      renderCoeDashboard();
      const rep = state.reports.find(r => r.id === state.coe.selectedReportId);
      if (rep && coeMap) {
        coeMap.flyTo([rep.lat, rep.lng], 14, { duration: 0.6 });
      }
      return;
    }

    const assignBtn = e.target.closest('[data-assign-brigade]');
    if (assignBtn) {
      const id = assignBtn.getAttribute('data-assign-brigade');
      const rep = state.reports.find(r => r.id === id);
      if (rep) {
        rep.status = 'Brigada Asignada';
        saveReportsToStorage();
        renderCoeDashboard();
        renderCoeMapMarkers();
      }
      return;
    }

    const downBtn = e.target.closest('[data-downgrade-report]');
    if (downBtn) {
      const id = downBtn.getAttribute('data-downgrade-report');
      const rep = state.reports.find(r => r.id === id);
      if (rep) {
        rep.severity = 'aesthetic';
        rep.score = 15;
        rep.status = 'Descartado (Estético)';
        rep.damages = ['Reclasificado: Daño estético'];
        saveReportsToStorage();
        renderCoeDashboard();
        renderCoeMapMarkers();
      }
    }
  });

  // Filtros de bandeja COE
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.coe.filter = btn.getAttribute('data-filter') || 'all';
      renderCoeDashboard();
      renderCoeMapMarkers();
    });
  });

  // Toggle Heatmap
  const btnToggleHeatmap = document.getElementById('btn-toggle-heatmap');
  const heatmapOverlay = document.getElementById('heatmap-overlay');
  btnToggleHeatmap?.addEventListener('click', () => {
    state.coe.heatmap = !state.coe.heatmap;
    heatmapOverlay?.classList.toggle('hidden', !state.coe.heatmap);
    btnToggleHeatmap.setAttribute('aria-pressed', String(state.coe.heatmap));
    btnToggleHeatmap.textContent = state.coe.heatmap ? 'Ocultar Vista Heatmap' : 'Activar Vista Heatmap';
    renderCoeMapMarkers();
  });

  // Exportar CSV
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    const headers = ['ID', 'Ubicacion', 'Latitud', 'Longitud', 'Severidad', 'Estado', 'Danos'];
    const rows = state.reports.map(r => [
      r.id,
      `"${r.address.replace(/"/g, '""')}"`,
      r.lat,
      r.lng,
      r.severity,
      `"${r.status}"`,
      `"${r.damages.join(' / ')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reportes_evakuape_coe.csv';
    link.click();
    URL.revokeObjectURL(url);
  });

  // ==========================================================================
  // PANTALLA 4: CONSOLA DE BRIGADISTAS / RESCATISTAS
  // ==========================================================================
  function renderRescuerConsole() {
    const container = document.getElementById('rescuer-tasks-container');
    if (!container) return;

    const fieldReports = state.reports.filter(r => r.severity !== 'aesthetic' || r.status === 'Brigada Asignada');

    if (fieldReports.length === 0) {
      container.innerHTML = '<p>No hay emergencias estructurales pendientes de verificación en campo.</p>';
      return;
    }

    container.innerHTML = fieldReports
      .map(rep => {
        const badgeClass = rep.severity === 'critical' ? 'badge-red' : 'badge-amber';
        return `
          <article class="rescuer-card">
            <div class="card-topbar">
              <span class="badge ${badgeClass}">${rep.id} · PRIORIDAD ${rep.severity === 'critical' ? 'ALTA' : 'MEDIA'}</span>
              <span class="badge badge-blue">${rep.status}</span>
            </div>
            <h3>${rep.address}</h3>
            <img class="rescuer-photo-thumb" src="${rep.housePhoto || createSamplePhotoDataUrl('house')}" alt="Fachada ${rep.id}" />
            <p><strong>Coordenadas:</strong> <code>${rep.lat}, ${rep.lng}</code></p>
            <p><strong>Indicadores reportados:</strong> ${rep.damages.join(' · ')}</p>
            <div class="rescuer-card-actions">
              <button type="button" class="btn btn-danger btn-massive btn-block" data-field-confirm="${rep.id}">
                CONFIRMAR DAÑO ESTRUCTURAL (FICHA EDAN)
              </button>
              <button type="button" class="btn btn-success btn-massive btn-block" data-field-discard="${rep.id}">
                DESCARTAR FALSA ALARMA EN CAMPO
              </button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  document.addEventListener('click', (e) => {
    const confirmBtn = e.target.closest('[data-field-confirm]');
    if (confirmBtn) {
      const id = confirmBtn.getAttribute('data-field-confirm');
      const rep = state.reports.find(r => r.id === id);
      if (rep) {
        rep.status = 'Confirmado en Campo (EDAN)';
        saveReportsToStorage();
        renderRescuerConsole();
      }
      return;
    }

    const discardBtn = e.target.closest('[data-field-discard]');
    if (discardBtn) {
      const id = discardBtn.getAttribute('data-field-discard');
      const rep = state.reports.find(r => r.id === id);
      if (rep) {
        rep.severity = 'aesthetic';
        rep.score = 10;
        rep.status = 'Descartado (Estético)';
        saveReportsToStorage();
        renderRescuerConsole();
      }
    }
  });

  // Inicialización al cargar
  updateGlobalReportBadges();
  // Eventos de las mejoras: Copiar GPS, Acordeón, Zoom y Alerta COE
  document.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('[data-copy-gps]');
    if (copyBtn) {
      navigator.clipboard?.writeText(copyBtn.getAttribute('data-copy-gps')).catch(() => {});
      copyBtn.textContent = '¡Copiado!';
      setTimeout(() => { copyBtn.textContent = 'Copiar GPS'; }, 1800);
      return;
    }
    const accBtn = e.target.closest('#btn-toggle-evidence');
    if (accBtn) {
      const body = document.getElementById('evidence-collapse-body');
      const isHidden = body?.classList.toggle('hidden');
      accBtn.setAttribute('aria-expanded', String(!isHidden));
      accBtn.innerHTML = isHidden ? 'Ver Evidencia Fotográfica &#9662;' : 'Ocultar Evidencia Fotográfica &#9652;';
      return;
    }
    const zoomImg = e.target.closest('[data-zoom-img]');
    if (zoomImg) {
      document.getElementById('zoom-photo-img').src = zoomImg.getAttribute('data-zoom-img');
      document.getElementById('zoom-photo-title').textContent = zoomImg.getAttribute('data-zoom-title');
      document.getElementById('modal-photo-zoom')?.classList.remove('hidden');
      return;
    }
    if (e.target.closest('#btn-close-zoom')) {
      document.getElementById('modal-photo-zoom')?.classList.add('hidden');
      return;
    }
    if (e.target.closest('#btn-dismiss-coe-alert')) {
      state.coe.hasNewReportAlert = false;
      document.getElementById('coe-live-alert')?.classList.add('hidden');
    }
  });
  renderOfflineQueuePanel();
})();
