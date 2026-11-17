/**
 * SISTEMA DE ZONAS DE ENVÍO Y MAPA INTERACTIVO - PIZZERÍA POPULAR (LA PLATA)
 * Soporta:
 * - Polígonos por sucursal (Zona 1, Zona 2, Zona 3) con prioridad concéntrica (1 -> 2 -> 3)
 * - Precios dinámicos desde MASTER_PRECIOS_POPULAR (ENVIO ZONA 1, ENVIO ZONA 2, ENVIO ZONA 3)
 * - Geocodificador matemático del damero de La Plata + OpenStreetMap Nominatim + GPS
 * - Modo Editor Visual de polígonos (arrastrar vértices + generador por calles de La Plata)
 */

const STORAGE_KEY_ZONAS = 'pizzeria_popular_zonas_v3';

// Coordenadas exactas de referencia en el damero de La Plata para interpolación de calles
// Eje A (Calles 1 a 31, corre de NE a SO) y Eje B (Calles 32 a 90, corre de NO a SE)
function calcularEsquinaLaPlata(calleNE_SO, calleNO_SE) {
    // Punto base calibrado en Plaza España (7 y 66): [-34.92775, -57.93805]
    // y Plaza Azcuénaga (19 y 44): [-34.92070, -57.96760]
    const baseLat = -34.92775;
    const baseLng = -57.93805;

    // Ajuste por calle 52 inexistente en el casco (51 salta a 53)
    const effA = parseFloat(calleNE_SO);
    let effB = parseFloat(calleNO_SE);
    if (effB > 52) effB -= 0.5;

    const dA = effA - 7;     // Diferencia respecto a Av. 7 (positivo hacia Av. 31 / SO)
    const dB = effB - 65.5;  // Diferencia respecto a Av. 66 (positivo hacia Av. 72 / SE)

    // Vectores unitarios por cuadra platense
    const lat = baseLat - (dA * 0.000735) - (dB * 0.000735);
    const lng = baseLng - (dA * 0.000895) + (dB * 0.000895);

    return [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
}

// Genera un cuadrante alineado al damero de La Plata dadas sus 4 calles límite
function crearCuadranteLaPlata(calleNorteNE, calleSurSO, calleOesteNO, calleEsteSE) {
    return [
        calcularEsquinaLaPlata(calleNorteNE, calleOesteNO), // Esquina Norte (ej. 1 y 54)
        calcularEsquinaLaPlata(calleNorteNE, calleEsteSE),  // Esquina Este  (ej. 1 y 72)
        calcularEsquinaLaPlata(calleSurSO, calleEsteSE),    // Esquina Sur   (ej. 13 y 72)
        calcularEsquinaLaPlata(calleSurSO, calleOesteNO)    // Esquina Oeste (ej. 13 y 54)
    ];
}

// Configuración oficial por defecto para ambas sucursales
const DEFAULT_ZONAS_CONFIG = {
  "sucursal1": {
    "id": "sucursal1",
    "nombre": "Sucursal 1 (Calle 6 esq. 66)",
    "direccion": "Calle 6 esq. 66, La Plata",
    "centro": [
      -34.927015,
      -57.937155
    ],
    "zonas": [
      {
        "id": 1,
        "nombre": "Zona 1",
        "configKey": "ENVIO ZONA 1",
        "precioDefault": 3000,
        "color": "#00E676",
        "fillOpacity": 0.25,
        "referenciaCalles": "De Calle 1 a 13 y de Calle 56 a 76",
        "puntos": [
          [
            -34.922974,
            -57.920094
          ],
          [
            -34.924592,
            -57.919879
          ],
          [
            -34.942958,
            -57.939792
          ],
          [
            -34.929149,
            -57.958417
          ],
          [
            -34.923818,
            -57.9564
          ],
          [
            -34.910305,
            -57.94183
          ],
          [
            -34.91488,
            -57.9355
          ],
          [
            -34.913174,
            -57.933526
          ]
        ]
      },
      {
        "id": 2,
        "nombre": "Zona 2",
        "configKey": "ENVIO ZONA 2",
        "precioDefault": 3500,
        "color": "#FFC107",
        "fillOpacity": 0.18,
        "referenciaCalles": "De Av. 122 (-4) a Av. 19 y de Av. 48 a Calle 82",
        "puntos": [
          [
            -34.943046,
            -57.939835
          ],
          [
            -34.949017,
            -57.946712
          ],
          [
            -34.949536,
            -57.948675
          ],
          [
            -34.950239,
            -57.9511
          ],
          [
            -34.950468,
            -57.953696
          ],
          [
            -34.950028,
            -57.958395
          ],
          [
            -34.948322,
            -57.960863
          ],
          [
            -34.934251,
            -57.979853
          ],
          [
            -34.932914,
            -57.980261
          ],
          [
            -34.904798,
            -57.949405
          ],
          [
            -34.91159,
            -57.938461
          ],
          [
            -34.911449,
            -57.931037
          ],
          [
            -34.923554,
            -57.914257
          ],
          [
            -34.939774,
            -57.930136
          ]
        ]
      },
      {
        "id": 3,
        "nombre": "Zona 3",
        "configKey": "ENVIO ZONA 3",
        "precioDefault": 4000,
        "color": "#FF5722",
        "fillOpacity": 0.14,
        "referenciaCalles": "De Calle -8 (Berisso/126) a Av. 25 y de Av. 40 a Calle 90",
        "puntos": [
          [
            -34.911062,
            -57.937603
          ],
          [
            -34.924399,
            -57.909515
          ],
          [
            -34.939053,
            -57.92578
          ],
          [
            -34.951523,
            -57.956314
          ],
          [
            -34.927742,
            -57.989445
          ],
          [
            -34.920212,
            -57.990475
          ],
          [
            -34.906417,
            -57.975969
          ],
          [
            -34.896562,
            -57.965155
          ],
          [
            -34.895083,
            -57.963438
          ],
          [
            -34.894555,
            -57.958267
          ],
          [
            -34.898251,
            -57.952623
          ]
        ]
      }
    ]
  },
  "sucursal2": {
    "id": "sucursal2",
    "nombre": "Sucursal 2 (Diag. 76 e/ 18 y 43)",
    "direccion": "Diagonal 76 e/ 18 y 43, La Plata",
    "centro": [
      -34.920032,
      -57.968032
    ],
    "zonas": [
      {
        "id": 1,
        "nombre": "Zona 1",
        "configKey": "ENVIO ZONA 1",
        "precioDefault": 3000,
        "color": "#00E676",
        "fillOpacity": 0.25,
        "referenciaCalles": "De Calle 11 a Av. 26 y de Av. 34 a Av. 53",
        "puntos": [
          [
            -34.900011,
            -57.968502
          ],
          [
            -34.915567,
            -57.947044
          ],
          [
            -34.93506,
            -57.969446
          ],
          [
            -34.921127,
            -57.989702
          ],
          [
            -34.919015,
            -57.989788
          ]
        ]
      },
      {
        "id": 2,
        "nombre": "Zona 2",
        "configKey": "ENVIO ZONA 2",
        "precioDefault": 3500,
        "color": "#FFC107",
        "fillOpacity": 0.18,
        "referenciaCalles": "De Av. 5 a Av. 31 y de Calle 526 (26) a Av. 60",
        "puntos": [
          [
            -34.900081,
            -57.957945
          ],
          [
            -34.911907,
            -57.941895
          ],
          [
            -34.943714,
            -57.96627
          ],
          [
            -34.926968,
            -57.988415
          ],
          [
            -34.922464,
            -57.990217
          ],
          [
            -34.917608,
            -57.990818
          ],
          [
            -34.895506,
            -57.964725
          ]
        ]
      },
      {
        "id": 3,
        "nombre": "Zona 3",
        "configKey": "ENVIO ZONA 3",
        "precioDefault": 4000,
        "color": "#FF5722",
        "fillOpacity": 0.14,
        "referenciaCalles": "De Av. 1 a Calle 137 (37) y de Calle 520 (20) a Av. 66",
        "puntos": [
          [
            -34.912329,
            -57.939835
          ],
          [
            -34.915004,
            -57.934427
          ],
          [
            -34.946177,
            -57.963266
          ],
          [
            -34.923027,
            -57.991762
          ],
          [
            -34.918452,
            -57.990389
          ],
          [
            -34.904164,
            -57.977171
          ],
          [
            -34.893675,
            -57.964211
          ]
        ]
      }
    ]
  }
};

class GestorZonasEnvio {
    static obtenerConfigCompleta() {
        try {
            const guardado = localStorage.getItem(STORAGE_KEY_ZONAS);
            if (guardado) {
                const parsed = JSON.parse(guardado);
                if (parsed && parsed.sucursal1 && parsed.sucursal2) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('No se pudo leer zonas personalizadas de localStorage:', e);
        }
        return JSON.parse(JSON.stringify(DEFAULT_ZONAS_CONFIG));
    }

    static obtenerSucursalConfig(sucursalKey) {
        const all = this.obtenerConfigCompleta();
        return all[sucursalKey] || all.sucursal1;
    }

    static guardarConfigCompleta(configObj) {
        localStorage.setItem(STORAGE_KEY_ZONAS, JSON.stringify(configObj));
    }

    static restaurarDefault() {
        localStorage.removeItem(STORAGE_KEY_ZONAS);
        return JSON.parse(JSON.stringify(DEFAULT_ZONAS_CONFIG));
    }

    /**
     * Algoritmo Ray-Casting (Point in Polygon)
     * Determina si un punto [lat, lng] cae dentro de un polígono [[lat, lng], ...]
     */
    static puntoEnPoligono(point, vs) {
        const x = point[0], y = point[1];
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i][0], yi = vs[i][1];
            const xj = vs[j][0], yj = vs[j][1];
            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /**
     * Evalúa en orden de prioridad: Zona 1 -> Zona 2 -> Zona 3
     * Permite dibujar zonas concéntricas sin necesidad de recortar huecos interiores.
     */
    static detectarZona(lat, lng, sucursalKey) {
        const sucConfig = this.obtenerSucursalConfig(sucursalKey);
        const zonasOrdenadas = [...sucConfig.zonas].sort((a, b) => a.id - b.id);
        for (const z of zonasOrdenadas) {
            if (z.puntos && z.puntos.length >= 3 && this.puntoEnPoligono([lat, lng], z.puntos)) {
                return z;
            }
        }
        return null; // Fuera de zona de cobertura
    }

    /**
     * Intenta resolver direcciones típicas de La Plata al instante (ej: "Calle 4 1234" + "57 y 58" o "8 y 62")
     * Devuelve [lat, lng] si logra calcular la intersección platense, o null para usar Nominatim.
     */
    static geocodificarDireccionLaPlataLocal(direccionStr, entreCallesStr) {
        const dir = (direccionStr || '').toUpperCase();
        const entre = (entreCallesStr || '').toUpperCase();

        // Extraer número de la calle principal (ej: "CALLE 4 N 1234" -> 4)
        // Evitamos confundir si empieza con Diagonal
        if (dir.includes('DIAG')) {
            // Si es diagonal pero puso entre calles (ej: Diag 74 e/ 18 y 19 o 47 y 48)
            const numsEntre = (entre.match(/\d+/g) || []).map(Number);
            const numsDir = (dir.match(/\d+/g) || []).map(Number);
            if (numsDir[0] === 74 || numsDir[0] === 73 || numsDir[0] === 79 || numsDir[0] === 80 || numsDir[0] === 76) {
                // Si hay calles en entreCalles podemos aproximar
                if (numsEntre.length >= 2) {
                    const prom = (numsEntre[0] + numsEntre[1]) / 2;
                    // En Diag 74/73/76 el número de cuadra da pista
                    if (prom >= 1 && prom <= 31) {
                        // Aproximación en el casco
                        return null; // Dejamos que Nominatim o el pin lo resuelva si es diagonal pura
                    }
                }
            }
        }

        const matchCallePrincipal = dir.match(/(?:CALLE|AV|AVENIDA|BULEVAR|BV)?\s*(\d{1,3})\b/);
        if (!matchCallePrincipal) return null;

        const callePrincipal = parseInt(matchCallePrincipal[1], 10);

        // 1. Caso ideal: El usuario completó "Entre Calles" (ej: "57 y 58" o "4 y 5")
        const numsEntre = (entre.match(/\d{1,3}/g) || []).map(Number);
        if (numsEntre.length >= 1) {
            let calleCruce = numsEntre[0];
            if (numsEntre.length >= 2 && Math.abs(numsEntre[0] - numsEntre[1]) <= 4) {
                calleCruce = (numsEntre[0] + numsEntre[1]) / 2;
            }
            // Verificar que una esté en eje 1..31 (o 115..145) y la otra en eje 32..90 (o 515..532)
            const normEje1 = (n) => (n >= 115 && n <= 155) ? (n - 121) : n; // 122 -> 1, 120 -> -1, 131 -> 10 (Oh wait: 131 is after 31! Let's handle 131+)
            const toEjeA = (n) => {
                if (n >= 1 && n <= 31) return n;
                if (n >= 115 && n <= 130) return n - 122; // 122 es continuación del 1 hacia el Este (-1, 0, etc.)
                if (n >= 131 && n <= 160) return 31 + (n - 131); // 132 es pasando la 31 hacia Los Hornos
                return null;
            };
            const toEjeB = (n) => {
                if (n >= 32 && n <= 99) return n;
                if (n >= 501 && n <= 532) return 32 - (532 - n); // 531 es 1 cuadra al norte de 32
                return null;
            };

            const a1 = toEjeA(callePrincipal), b1 = toEjeB(calleCruce);
            if (a1 !== null && b1 !== null) return calcularEsquinaLaPlata(a1, b1);

            const a2 = toEjeA(calleCruce), b2 = toEjeB(callePrincipal);
            if (a2 !== null && b2 !== null) return calcularEsquinaLaPlata(a2, b2);
        }

        // 2. Caso en que puso esquina en el mismo campo de dirección (ej: "8 y 62" o "Calle 8 esq 62")
        const matchEsquina = dir.match(/\b(\d{1,3})\s*(?:Y|ESQ|ESQUINA)\s*(\d{1,3})\b/);
        if (matchEsquina) {
            const c1 = parseInt(matchEsquina[1], 10);
            const c2 = parseInt(matchEsquina[2], 10);
            if (c1 >= 1 && c1 <= 31 && c2 >= 32 && c2 <= 95) return calcularEsquinaLaPlata(c1, c2);
            if (c2 >= 1 && c2 <= 31 && c1 >= 32 && c1 <= 95) return calcularEsquinaLaPlata(c2, c1);
        }

        // 3. Caso por Altura Platense (ej: "Calle 4 1234" o "Calle 60 850")
        const matchAltura = dir.match(/\b(\d{1,3})\s+(?:N|NRO|N°|#)?\s*(\d{3,4})\b/);
        if (matchAltura) {
            const calle = parseInt(matchAltura[1], 10);
            const altura = parseInt(matchAltura[2], 10);

            // En calles 1 a 31: la numeración arranca en 32 (altura 0 = calle 33 aprox, 50 números por cuadra)
            // Ej: altura 1234 -> 33 + (1234 / 50) = 33 + 24.68 = 57.68 (entre 57 y 58)
            if (calle >= 1 && calle <= 31 && altura >= 100 && altura <= 3500) {
                let calleCruce = 33 + (altura / 50);
                if (calleCruce >= 52) calleCruce += 1; // Salto de la 52
                return calcularEsquinaLaPlata(calle, calleCruce);
            }

            // En calles 32 a 90: la numeración arranca en Av. 1 con el 300 (50 números por cuadra)
            // Ej: altura 850 -> 1 + ((850 - 300) / 50) = 1 + 11 = 12.0 (entre 12 y 13)
            if (calle >= 32 && calle <= 90 && altura >= 300 && altura <= 2200) {
                const calleCruce = 1 + ((altura - 300) / 50);
                return calcularEsquinaLaPlata(calleCruce, calle);
            }
        }

        return null;
    }
}

/**
 * COMPONENTE DE MAPA INTERACTIVO PARA EL CHECKOUT DEL CLIENTE
 */
class MapaCheckoutPizzeria {
    constructor(appInstance, sucursalKey) {
        this.app = appInstance;
        this.sucursalKey = sucursalKey; // 'sucursal1' | 'sucursal2'
        this.map = null;
        this.markerCliente = null;
        this.capasZonas = [];
        this.ubicacionConfirmada = false;
        this.debounceTimer = null;
    }

    init() {
        const container = document.getElementById('mapa-envio-wrapper');
        if (!container || typeof L === 'undefined') return;

        const sucConfig = GestorZonasEnvio.obtenerSucursalConfig(this.sucursalKey);
        const centro = sucConfig.centro;

        this.map = L.map('mapa-checkout', {
            center: centro,
            zoom: 13,
            zoomControl: true
        });

        // Capa oficial de OpenStreetMap (100% libre, sin API Key ni marcas de agua)
        const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Fallback automático en caso de bloqueo local de red
        osmLayer.on('tileerror', function(err) {
            if (err && err.tile && !err.tile.dataset.fallbackApplied) {
                err.tile.dataset.fallbackApplied = '1';
                err.tile.src = err.tile.src.replace('https://tile.openstreetmap.org/', 'https://a.tile.openstreetmap.fr/hot/');
            }
        });

        this.dibujarZonas();

        // Marcador fijo de la sucursal de la pizzería
        const iconoPizzeria = L.divIcon({
            className: 'custom-pizza-marker',
            html: `<div style="background:#FF3D00; color:#fff; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #FFC107; box-shadow:0 2px 8px rgba(0,0,0,0.6); font-size:16px;" title="${sucConfig.nombre}">🍕</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        L.marker(centro, { icon: iconoPizzeria, interactive: true })
            .addTo(this.map)
            .bindPopup(`<b>🍕 ${sucConfig.nombre}</b><br>${sucConfig.direccion}`);

        // Marcador arrastrable del cliente
        const iconoCliente = L.divIcon({
            className: 'custom-client-marker',
            html: `<div style="background:#25D366; color:#fff; width:38px; height:38px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; border:3px solid #fff; box-shadow:0 4px 12px rgba(0,0,0,0.6);"><i class="fas fa-home" style="transform:rotate(45deg); font-size:16px;"></i></div>`,
            iconSize: [38, 38],
            iconAnchor: [19, 38]
        });

        // Iniciamos el pin cerca de la sucursal pero invitamos a tocar o buscar
        this.markerCliente = L.marker(centro, {
            icon: iconoCliente,
            draggable: true,
            autoPan: true
        }).addTo(this.map);

        // Eventos del mapa y del pin
        this.markerCliente.on('dragend', () => {
            const pos = this.markerCliente.getLatLng();
            this.seleccionarPunto(pos.lat, pos.lng, 'Pin movido en el mapa');
        });

        this.map.on('click', (e) => {
            this.markerCliente.setLatLng(e.latlng);
            this.seleccionarPunto(e.latlng.lat, e.latlng.lng, 'Punto marcado en el mapa');
        });

        // Botones de acción del mapa
        const btnGps = document.getElementById('btn-ubicacion-gps');
        if (btnGps) {
            btnGps.addEventListener('click', () => this.usarGPS());
        }

        const btnBuscarDir = document.getElementById('btn-buscar-direccion');
        if (btnBuscarDir) {
            btnBuscarDir.addEventListener('click', () => this.buscarDireccionEscrita(true));
        }

        // Auto-búsqueda inteligente cuando el cliente escribe Calle y Entre Calles
        const inputDir = document.getElementById('cli-direccion');
        const inputEntre = document.getElementById('cli-entrecalles');
        const triggerAutoLocate = () => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.buscarDireccionEscrita(false);
            }, 600);
        };
        if (inputDir) inputDir.addEventListener('input', triggerAutoLocate);
        if (inputEntre) inputEntre.addEventListener('input', triggerAutoLocate);

        // Escuchar cambios en localStorage si Nicolás edita las zonas en otra pestaña
        window.addEventListener('storage', (e) => {
            if (e.key === STORAGE_KEY_ZONAS) {
                this.dibujarZonas();
                if (this.ubicacionConfirmada && this.markerCliente) {
                    const pos = this.markerCliente.getLatLng();
                    this.seleccionarPunto(pos.lat, pos.lng, 'Zonas actualizadas');
                }
            }
        });

        this.actualizarLeyendaPrecios();
    }

    dibujarZonas() {
        if (!this.map) return;
        this.capasZonas.forEach(c => this.map.removeLayer(c));
        this.capasZonas = [];

        const sucConfig = GestorZonasEnvio.obtenerSucursalConfig(this.sucursalKey);
        // Dibujar primero Zona 3 (la más grande al fondo), luego Zona 2, y arriba Zona 1
        const zonasParaDibujar = [...sucConfig.zonas].sort((a, b) => b.id - a.id);

        zonasParaDibujar.forEach(z => {
            if (!z.puntos || z.puntos.length < 3) return;
            const poly = L.polygon(z.puntos, {
                color: z.color,
                weight: 2,
                fillColor: z.color,
                fillOpacity: z.fillOpacity || 0.2,
                interactive: false // Para que el clic pase directo al mapa
            }).addTo(this.map);
            this.capasZonas.push(poly);
        });
    }

    actualizarLeyendaPrecios() {
        const leg1 = document.getElementById('leyenda-precio-z1');
        const leg2 = document.getElementById('leyenda-precio-z2');
        const leg3 = document.getElementById('leyenda-precio-z3');
        if (leg1 && this.app.preciosZonas) leg1.textContent = this.app.formatPrice(this.app.preciosZonas[1]);
        if (leg2 && this.app.preciosZonas) leg2.textContent = this.app.formatPrice(this.app.preciosZonas[2]);
        if (leg3 && this.app.preciosZonas) leg3.textContent = this.app.formatPrice(this.app.preciosZonas[3]);

        // Si ya había una zona seleccionada, refrescar su precio con el valor del CSV
        if (this.ubicacionConfirmada && this.markerCliente) {
            const pos = this.markerCliente.getLatLng();
            this.seleccionarPunto(pos.lat, pos.lng);
        }
    }

    invalidateSize() {
        if (this.map) {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 150);
        }
    }

    centrarEnPuntoGuardado(lat, lng) {
        if (!this.map || !this.markerCliente || typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return;
        this.markerCliente.setLatLng([lat, lng]);
        this.map.setView([lat, lng], 15);
        this.seleccionarPunto(lat, lng, 'Ubicación guardada');
    }

    seleccionarPunto(lat, lng, origenTexto = '') {
        this.ubicacionConfirmada = true;
        const zona = GestorZonasEnvio.detectarZona(lat, lng, this.sucursalKey);
        const badge = document.getElementById('zona-envio-resultado');

        if (zona) {
            const precioZona = (this.app.preciosZonas && this.app.preciosZonas[zona.id]) || zona.precioDefault;
            this.app.setDatosZonaEnvio({
                confirmada: true,
                dentroDeCobertura: true,
                zonaId: zona.id,
                zonaNombre: zona.nombre,
                costo: precioZona,
                lat: Number(lat.toFixed(6)),
                lng: Number(lng.toFixed(6))
            });

            if (badge) {
                badge.style.display = 'flex';
                badge.style.flexDirection = 'row';
                badge.style.alignItems = 'center';
                badge.style.background = 'rgba(0, 230, 118, 0.12)';
                badge.style.borderColor = zona.color;
                badge.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${zona.color};"></span>
                        <strong>${zona.nombre} detectada</strong>
                    </div>
                    <div style="font-family:'Oswald',sans-serif; font-size:1.15rem; color:var(--primary);">
                        🛵 Envío: ${this.app.formatPrice(precioZona)}
                    </div>
                `;
            }
        } else {
            const latFixed = Number(lat.toFixed(6));
            const lngFixed = Number(lng.toFixed(6));
            this.app.setDatosZonaEnvio({
                confirmada: true,
                dentroDeCobertura: false,
                aConsultar: true,
                zonaId: 0,
                zonaNombre: 'Zona a Consultar',
                costo: 0,
                lat: latFixed,
                lng: lngFixed
            });

            // Detector cruzado: verificar si el punto cae dentro de una zona de la OTRA sucursal
            const otraSucKey = this.sucursalKey === 'sucursal1' ? 'sucursal2' : 'sucursal1';
            const zonaOtra = GestorZonasEnvio.detectarZona(lat, lng, otraSucKey);
            let htmlSugerenciaOtraSuc = '';

            if (zonaOtra) {
                const otraSucNombre = otraSucKey === 'sucursal2' ? 'Sucursal 2 (Diag. 76 e/ 18 y 43)' : 'Sucursal 1 (Calle 6 esq. 66)';
                const otraSucUrl = otraSucKey === 'sucursal2' ? 'app_sucursal2.html' : 'index.html';
                const precioOtra = (this.app.preciosZonas && this.app.preciosZonas[zonaOtra.id]) || zonaOtra.precioDefault;
                htmlSugerenciaOtraSuc = `
                    <div style="background:rgba(79,195,247,0.12); border:1px solid #4FC3F7; border-radius:6px; padding:8px; font-size:0.8rem; color:#eee;">
                        <div style="color:#4FC3F7; font-weight:bold; margin-bottom:4px;">
                            💡 ¡Estás dentro de la ${zonaOtra.nombre} (${this.app.formatPrice(precioOtra)}) de nuestra ${otraSucNombre}!
                        </div>
                        <a href="${otraSucUrl}" onclick="if(window.AppPublica && window.AppPublica.guardarDatosClienteLocal) window.AppPublica.guardarDatosClienteLocal();" style="display:flex; align-items:center; justify-content:center; gap:6px; background:#4FC3F7; color:#000; text-decoration:none; font-family:'Oswald',sans-serif; font-weight:bold; padding:6px 10px; border-radius:5px; text-transform:uppercase; font-size:0.85rem; margin-top:6px;">
                            <i class="fas fa-store"></i> Ir al Menú de ${otraSucKey === 'sucursal2' ? 'Sucursal 2 (Diag. 76)' : 'Sucursal 1 (6 y 66)'}
                        </a>
                    </div>
                `;
            }

            if (badge) {
                badge.style.display = 'flex';
                badge.style.flexDirection = 'column';
                badge.style.alignItems = 'stretch';
                badge.style.gap = '8px';
                badge.style.background = 'rgba(255, 193, 7, 0.12)';
                badge.style.borderColor = '#FFC107';
                badge.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:var(--primary); font-weight:bold;">
                            <i class="fas fa-info-circle"></i> Fuera de Zonas 1, 2 y 3
                        </span>
                        <span style="font-family:'Oswald',sans-serif; color:#fff; background:#333; padding:2px 8px; border-radius:4px; font-size:0.85rem;">
                            🛵 Envío a consultar
                        </span>
                    </div>
                    ${htmlSugerenciaOtraSuc}
                    <div style="font-size:0.78rem; color:#ccc; line-height:1.35;">
                        Podés <strong>enviar tu pedido normalmente</strong> con el botón de abajo y te confirmamos el valor del envío por WhatsApp, o consultarnos antes:
                    </div>
                    <button type="button" onclick="window.AppPublica.mapaCheckout.consultarEnvioPorWhatsApp()" style="background:#25D366; color:#fff; border:none; border-radius:6px; padding:8px 10px; font-family:'Oswald',sans-serif; font-size:0.9rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; text-transform:uppercase;">
                        <i class="fab fa-whatsapp"></i> Consultar Envío a esta Ubicación
                    </button>
                `;
            }
        }

        if (this.app && typeof this.app.guardarDatosClienteLocal === 'function') {
            this.app.guardarDatosClienteLocal();
        }
    }

    consultarEnvioPorWhatsApp() {
        const dir = document.getElementById('cli-direccion')?.value.trim() || '';
        const entre = document.getElementById('cli-entrecalles')?.value.trim() || '';
        const pos = this.markerCliente ? this.markerCliente.getLatLng() : null;
        const mapUrl = pos ? `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}` : '';

        let msg = `Hola! Quería consultar si llegan con el envío a mi ubicación y cuánto saldría.\n`;
        if (dir) msg += `*Dirección:* ${dir}${entre ? ' (e/ ' + entre + ')' : ''}\n`;
        if (mapUrl) msg += `*Ubicación en mapa:* ${mapUrl}`;

        const phone = (typeof CONST_WHATSAPP_NUMBER !== 'undefined') ? CONST_WHATSAPP_NUMBER : '542215713693';
        window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`, '_blank');
    }

    usarGPS() {
        const btnGps = document.getElementById('btn-ubicacion-gps');
        if (!navigator.geolocation) {
            alert('Tu navegador no soporta geolocalización. Podés tocar directamente tu cuadra en el mapa.');
            return;
        }
        const originalHtml = btnGps.innerHTML;
        btnGps.disabled = true;
        btnGps.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando GPS...';

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                btnGps.disabled = false;
                btnGps.innerHTML = originalHtml;
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                this.markerCliente.setLatLng([lat, lng]);
                this.map.setView([lat, lng], 15);
                this.seleccionarPunto(lat, lng, 'GPS');
            },
            (err) => {
                btnGps.disabled = false;
                btnGps.innerHTML = originalHtml;
                alert('No pudimos obtener tu ubicación GPS automáticamente. Tocá tu esquina directamente en el mapa o usá el botón "Ubicar dirección".');
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    }

    async buscarDireccionEscrita(mostrarAlertaSiFalla = false) {
        const dir = document.getElementById('cli-direccion')?.value.trim() || '';
        const entre = document.getElementById('cli-entrecalles')?.value.trim() || '';
        if (dir.length < 3) {
            if (mostrarAlertaSiFalla) alert('Escribí primero tu calle y número (y entre calles) para ubicarla en el mapa.');
            return;
        }

        // 1. Intentar primero con el calculador matemático instantáneo del damero de La Plata
        const coordsLocal = GestorZonasEnvio.geocodificarDireccionLaPlataLocal(dir, entre);
        if (coordsLocal) {
            this.markerCliente.setLatLng(coordsLocal);
            this.map.setView(coordsLocal, 15);
            this.seleccionarPunto(coordsLocal[0], coordsLocal[1], 'Damero La Plata');
            return;
        }

        // 2. Fallback a Nominatim (OpenStreetMap) acotado al Partido de La Plata
        if (!mostrarAlertaSiFalla) return; // Solo consultar red al tocar el botón explícitamente

        const btnBuscar = document.getElementById('btn-buscar-direccion');
        const origHtml = btnBuscar ? btnBuscar.innerHTML : '';
        if (btnBuscar) {
            btnBuscar.disabled = true;
            btnBuscar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        try {
            const query = `${dir}, La Plata, Buenos Aires, Argentina`;
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&viewbox=-58.08,-34.84,-57.85,-35.02&bounded=1`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
            const data = await res.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                this.markerCliente.setLatLng([lat, lon]);
                this.map.setView([lat, lon], 15);
                this.seleccionarPunto(lat, lon, 'Búsqueda en mapa');
            } else if (mostrarAlertaSiFalla) {
                alert('No encontramos esa calle exacta automáticamente. Mové el pin o tocá tu cuadra directamente en el mapa.');
            }
        } catch (e) {
            if (mostrarAlertaSiFalla) {
                alert('Tocá directamente tu cuadra en el mapa para confirmar la zona de envío.');
            }
        } finally {
            if (btnBuscar) {
                btnBuscar.disabled = false;
                btnBuscar.innerHTML = origHtml;
            }
        }
    }
}
