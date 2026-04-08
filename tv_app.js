const CONST_URL_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQae4azVxGxHwSNGEcqoMUia0sNSykZxGA0koTpJ2SRcihjopNGaVAIlm2MjOhbxgmU6Y05e0ffzNVB/pub?output=csv';

// Mapas de nombres exactos a como deben aparecer en pantalla, 
// y las claves para buscar en el CSV (normalizadas).
const configuracionPantallas = {
    "1": [
        "MUZZARELLA", "ESPECIAL", "FUGAZZETA", "FUGAZZETTA CON JAMON", 
        "NAPOLITANA", "NAPO CON HUEVO", "NAPO CON JAMON", 
        "ROQUEFORT", "ROQUE Y CEBOLLA", "ROQUE Y JAMON"
    ],
    "2": [
        "VERDURA", "PANCETA", "PANCETA Y HUEVO", "PANCETA Y ROQUE", 
        "PRIMAVERA", "LONGANIZA", "ANANA", "HOT DOG", "PALMITOS"
    ],
    "3": [
        "JAMON CRUDO", "JAMON CRUDO Y RUCULA", "CHAMPIGNON", "CHAMPI Y JAMON",
        "POPULAR", "CUATRO QUESOS", "POLLO", "POLLO Y ROQUE", "CHOCLO", "ANCHOAS"
    ]
};

// Mapeos visuales para sobreescribir el nombre del CSV al nombre en la TV
const mapeoVisualNombres = {
    "FUGAZZETTA CON JAMON": "FUGAZETA CON JAMON",
    "NAPO CON HUEVO": "NAPOLITANA CON HUEVO",
    "NAPO CON JAMON": "NAPOLITANA CON JAMON",
    "ROQUE Y CEBOLLA": "ROQUEFORT Y CEBOLLA",
    "ROQUE Y JAMON": "ROQUEFORT Y JAMON",
    "PANCETA Y ROQUE": "PANCETA Y ROQUEFORT",
    "ANANA": "ANANA",
    "CHAMPI Y JAMON": "CHAMPIGNON CON JAMON",
    "CUATRO QUESOS": "4 QUESOS",
    "POLLO Y ROQUE": "POLLO Y ROQUEFORT"
};

function normalizeText(s) {
    if (!s) return '';
    return s.toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar tildes
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}⭐❄️🔥🌿🌓]/gu, '') // Quitar emojis
        .trim();
}

function formatPrice(n) {
    return n.toLocaleString('es-AR');
}

function initTV() {
    // 1. Obtener qué pantalla somos
    const urlParams = new URLSearchParams(window.location.search);
    const pantallaId = urlParams.get('pantalla') || "1"; // Default a 1 si no se pasa parametro

    cargarDatos(pantallaId);

    // Auto-Actualizar cada 15 minutos en caso de que cambien los precios en G.Sheets
    setInterval(() => {
        console.log("Auto-actualizando precios...");
        cargarDatos(pantallaId, false);
    }, 15 * 60 * 1000);
}

function cargarDatos(pantallaId, mostrarLoading = true) {
    if (mostrarLoading) document.getElementById('loading').style.display = 'flex';
    
    let url = CONST_URL_CSV + '&t=' + new Date().getTime();
    
    fetch(url, { cache: 'no-store' })
    .then(r => r.text())
    .then(csvText => {
        Papa.parse(csvText, {
            header: true, 
            skipEmptyLines: true,
            complete: (res) => {
                procesarMenu(res.data, pantallaId);
                if (mostrarLoading) document.getElementById('loading').style.display = 'none';
                
                // Ajustar escala para encajar en el monitor actual
                ajustarEscala();
            }
        });
    })
    .catch(err => {
        console.error("Error al cargar datos:", err);
        if (mostrarLoading) {
            document.getElementById('loading').innerHTML = "Error de Conexión. Reintentando...";
            setTimeout(() => cargarDatos(pantallaId), 5000);
        }
    });
}

function procesarMenu(data, pantallaId) {
    let extraHorneado = 0;
    const dbPizzas = {};

    data.forEach(item => {
        let nombreUpper = normalizeText(item.NOMBRE);
        let seccionUpper = normalizeText(item.SECCION);
        let p1 = parseInt((item.PRECIO_1 || '').toString().replace(/[^0-9]/g, '')) || 0;
        let p2 = parseInt((item.PRECIO_2 || '').toString().replace(/[^0-9]/g, '')) || 0;

        // Buscar precio extra horneado
        if (seccionUpper === 'EXTRAS' && nombreUpper === 'HORNEADO') {
            extraHorneado = p1;
        }

        if (seccionUpper === 'PIZZAS') {
            dbPizzas[nombreUpper] = { p1, p2 };
        }
    });

    // Actualizar leyenda inferior
    document.getElementById('extra-precio').textContent = `$${formatPrice(extraHorneado)}`;

    // Renderizar pizzas
    renderizarPizzas(dbPizzas, pantallaId);
}

function renderizarPizzas(dbPizzas, pantallaId) {
    const contenedor = document.getElementById('pizza-list');
    contenedor.innerHTML = '';
    
    const listaEsperada = configuracionPantallas[pantallaId] || configuracionPantallas["1"];

    listaEsperada.forEach(nombreClave => {
        let dataPizza = dbPizzas[nombreClave];
        
        let nombreVisual = mapeoVisualNombres[nombreClave] || nombreClave;
        
        let htmlRow = document.createElement('div');
        htmlRow.className = 'item-row';
        
        if (dataPizza) {
            htmlRow.innerHTML = `
                <div class="item-name">${nombreVisual}</div>
                <div class="item-dots"></div>
                <div class="item-prices">
                    <div class="price-box">$${formatPrice(dataPizza.p1)}</div>
                    <div class="price-box">$${formatPrice(dataPizza.p2)}</div>
                </div>
            `;
        } else {
            // Si por alguna razón no se encontró en CSV, se muestra como no disponible
            htmlRow.innerHTML = `
                <div class="item-name">${nombreVisual}</div>
                <div class="item-dots"></div>
                <div class="item-prices">
                    <div class="price-box">-</div>
                    <div class="price-box">-</div>
                </div>
            `;
        }
        contenedor.appendChild(htmlRow);
    });
}

function ajustarEscala() {
    // Escala la UI basandose en la resolucion real del viewport si es menor o mayor a 1920x1080
    const tvContainer = document.querySelector('.tv-container');
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    const scaleX = windowWidth / 1920;
    const scaleY = windowHeight / 1080;
    const scale = Math.min(scaleX, scaleY);
    
    tvContainer.style.transform = `scale(${scale})`;
    
    // Centrar
    const scaledWidth = 1920 * scale;
    const scaledHeight = 1080 * scale;
    const leftOffset = (windowWidth - scaledWidth) / 2;
    const topOffset = (windowHeight - scaledHeight) / 2;
    
    tvContainer.style.left = `${leftOffset}px`;
    tvContainer.style.top = `${topOffset}px`;
    tvContainer.style.position = 'absolute';
}

window.addEventListener('resize', ajustarEscala);
document.addEventListener('DOMContentLoaded', initTV);
