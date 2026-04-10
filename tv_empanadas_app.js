const CONST_URL_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQae4azVxGxHwSNGEcqoMUia0sNSykZxGA0koTpJ2SRcihjopNGaVAIlm2MjOhbxgmU6Y05e0ffzNVB/pub?output=csv';

function normalizeText(s) {
    if (!s) return '';
    return s.toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar tildes
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}⭐❄️🔥🌿🌓🌶️🍷🧅🥟]/gu, '') // Quitar emojis
        .trim();
}

function formatPrice(n) {
    return n.toLocaleString('es-AR');
}

function initTV() {
    cargarDatos();

    // Auto-Actualizar cada 15 minutos en caso de que cambien los precios
    setInterval(() => {
        console.log("Auto-actualizando precios...");
        cargarDatos(false);
    }, 15 * 60 * 1000);
}

function cargarDatos(mostrarLoading = true) {
    if (mostrarLoading) document.getElementById('loading').style.display = 'flex';
    
    let url = CONST_URL_CSV + '&t=' + new Date().getTime();
    
    fetch(url, { cache: 'no-store' })
    .then(r => r.text())
    .then(csvText => {
        Papa.parse(csvText, {
            header: true, 
            skipEmptyLines: true,
            complete: (res) => {
                procesarMenu(res.data);
                if (mostrarLoading) document.getElementById('loading').style.display = 'none';
                
                ajustarEscala();
            }
        });
    })
    .catch(err => {
        console.error("Error al cargar datos:", err);
        if (mostrarLoading) {
            document.getElementById('loading').innerHTML = "Error de Conexión. Reintentando...";
            setTimeout(() => cargarDatos(), 5000);
        }
    });
}

function procesarMenu(data) {
    const clasicas = [];
    const especiales = [];
    const fatay = [];
    const promos = [];

    // Precios unificados por categoria
    let precioClasicas = 0;
    let precioEspeciales = 0;
    let precioFatay = 0;

    data.forEach(item => {
        let seccionUpper = normalizeText(item.SECCION);
        let nombreOriginal = item.NOMBRE || "";
        let nombreUpper = normalizeText(nombreOriginal);
        let p1 = parseInt((item.PRECIO_1 || '').toString().replace(/[^0-9]/g, '')) || 0;

        if (p1 === 0) return;

        // Detectar promociones por la palabra "DOCENA" o "PROMO"
        if (nombreUpper === "PROMO DOCENA") {
            promos.push({ titulo: "PROMO DOCENA", precio: p1 });
            return; 
        } else if (nombreUpper.includes("DOCENA") || nombreUpper.includes("PROMO") && !nombreOriginal.toUpperCase().includes("PROMO")) {
            // Wait, we just want to discard any other that has "DOCENA" in the name
            if(nombreUpper.includes("DOCENA")) return;
        }

        const empanadaObj = { nombre: nombreOriginal.replace(/[🌿🔥⭐❄️]/g, '').trim(), precio: p1 };

        if (seccionUpper === 'EMPANADAS_CLASICAS') {
            clasicas.push(empanadaObj);
            if (precioClasicas === 0) precioClasicas = p1;
        } else if (seccionUpper === 'EMPANADAS_PREMIUM') {
            especiales.push(empanadaObj);
            if (precioEspeciales === 0) precioEspeciales = p1;
        } else if (seccionUpper === 'FATAYS') {
            fatay.push(empanadaObj);
            if (precioFatay === 0) precioFatay = p1;
        }
    });

    // Fijar precios en los encabezados
    document.getElementById('price-clasicas').textContent = `$${formatPrice(precioClasicas)}`;
    document.getElementById('price-especiales').textContent = `$${formatPrice(precioEspeciales)}`;
    document.getElementById('price-fatay').textContent = `$${formatPrice(precioFatay)}`;

    renderizarNombresGrid('list-clasicas', clasicas);
    renderizarNombresGrid('list-especiales', especiales);
    renderizarNombresGrid('list-fatay', fatay);
    renderizarPromos(promos);
}

function renderizarNombresGrid(containerId, items) {
    const contenedor = document.getElementById(containerId);
    contenedor.innerHTML = '';
    
    items.forEach(item => {
        let htmlRow = document.createElement('div');
        htmlRow.className = 'item-row';
        htmlRow.innerHTML = item.nombre;
        contenedor.appendChild(htmlRow);
    });
}

function renderizarPromos(promos) {
    const contenedor = document.getElementById('promo-container');
    contenedor.innerHTML = '';

    promos.forEach(promo => {
        let promoCard = document.createElement('div');
        promoCard.className = 'promo-card';
        promoCard.innerHTML = `
            <div class="promo-title">🔥 ${promo.titulo}</div>
            <div class="promo-price">$${formatPrice(promo.precio)}</div>
        `;
        contenedor.appendChild(promoCard);
    });
}

function ajustarEscala() {
    const tvContainer = document.querySelector('.tv-container');
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    const scaleX = windowWidth / 1080;
    const scaleY = windowHeight / 1920;
    const scale = Math.min(scaleX, scaleY);
    
    tvContainer.style.transform = `scale(${scale})`;
    
    const scaledWidth = 1080 * scale;
    const scaledHeight = 1920 * scale;
    const leftOffset = (windowWidth - scaledWidth) / 2;
    const topOffset = (windowHeight - scaledHeight) / 2;
    
    tvContainer.style.left = `${leftOffset}px`;
    tvContainer.style.top = `${topOffset}px`;
    tvContainer.style.position = 'absolute';
}

window.addEventListener('resize', ajustarEscala);
document.addEventListener('DOMContentLoaded', initTV);
