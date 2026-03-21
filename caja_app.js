// Configuración y Constantes
const CONST_PASSWORD_HASH = "4ab34cdf3e765ab1629ed66b4d683a8d5bd014b8b7e8f2f3edd4cfab45101031"; // Hash SHA-256 de "1650"
const CONST_URL_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQae4azVxGxHwSNGEcqoMUia0sNSykZxGA0koTpJ2SRcihjopNGaVAIlm2MjOhbxgmU6Y05e0ffzNVB/pub?output=csv';
const CONST_URL_REGISTRO = 'https://script.google.com/macros/s/AKfycbwHNEo_QRRQTm0fZBr_q-DkiKhJhzbMMDqj5xNgvbVv8WghP_i1I14BjGU4YFQ06hFX/exec';
const DOCENA_SIZE = 12;

class PizzeriaPOS {
    constructor() {
        this.catalogo = [];
        this.carrito = [];
        this.subtotalReal = 0;
        this.metodoPago = 'Efectivo';
        
        this.dbClasicas = [];
        this.dbPremium = [];
        this.precioBaseClasica = 0;
        this.promoDocenaItem = null;
        
        this.docenaActual = null;
        this.docenaSeleccion = {};
        this.docenaCantTotal = 0;
        this.docenaPrecioExtra = 0;
        
        this.ventasPendientes = this.cargarPendientes();

        this.init();
    }

    // --- UTILS ---
    formatPrice(n) { return n.toLocaleString('es-AR'); }
    cleanPrice(s) { return parseInt(s.toString().replace(/[^0-9]/g, '')) || 0; }
    normalize(s) { return s ? s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ') : ''; }
    cleanEmojis(str) { return str.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}⭐❄️🔥🌓]/gu, '').trim(); }
    
    // Función simple de hash para evitar exponer en Base64
    async sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    mostrarToast(msg) {
        const x = document.getElementById("toast");
        x.textContent = msg; // sanitize
        x.className = "show";
        setTimeout(() => { x.className = x.className.replace("show", ""); }, 3000);
    }

    // --- INIT & EVENTS ---
    init() {
        this.bindEvents();
        this.actualizarUIInternet();
    }

    bindEvents() {
        // Bloqueo
        document.getElementById('pass').addEventListener('keydown', (e) => { if(e.key === 'Enter') this.validarLogin(); });
        document.getElementById('btn-login').addEventListener('click', () => this.validarLogin());
        
        // WA Modal
        document.getElementById('btn-modal-wa').addEventListener('click', () => {
            document.getElementById('wa-modal').style.display = 'flex';
            document.getElementById('wa-text').value = '';
            document.getElementById('wa-text').focus();
        });
        document.getElementById('btn-cerrar-wa').addEventListener('click', () => document.getElementById('wa-modal').style.display = 'none');
        document.getElementById('btn-imprimir-wa').addEventListener('click', () => this.imprimirWA());
        
        // Historial
        document.getElementById('btn-historial').addEventListener('click', () => this.abrirHistorial());
        document.getElementById('btn-cerrar-historial').addEventListener('click', () => document.getElementById('historial-modal').style.display = 'none');
        document.getElementById('btn-limpiar-historial').addEventListener('click', () => this.limpiarHistorial());
        
        // Filtros Menu
        const btnFiltros = document.querySelectorAll('.btn-filtro');
        btnFiltros.forEach(btn => {
            if(btn.id !== 'btn-login') {
                btn.addEventListener('click', (e) => this.filtrarCatalogo(e.target.dataset.categoria, e.target));
            }
        });
        
        // Modal Docenas
        document.getElementById('btn-cerrar-md-docena').addEventListener('click', () => document.getElementById('modal-docena').style.display = 'none');
        document.getElementById('btn-confirmar-docena').addEventListener('click', () => this.confirmarDocena());
        
        // Descuentos
        document.getElementById('btn-abrir-descuento').addEventListener('click', () => {
            document.getElementById('desc-modal').style.display = 'flex';
            document.getElementById('input-desc').value = '';
        });
        document.getElementById('btn-cerrar-desc').addEventListener('click', () => document.getElementById('desc-modal').style.display = 'none');
        document.getElementById('btn-desc-porcentaje').addEventListener('click', () => this.aplicarDescuento('%'));
        document.getElementById('btn-desc-monto').addEventListener('click', () => this.aplicarDescuento('$'));
        
        // Total Inputs
        document.getElementById('total-display').addEventListener('input', () => this.calcularVuelto());
        document.getElementById('paga-con').addEventListener('input', () => this.calcularVuelto());
        
        // Pagos y Cobros
        const btnPagos = document.querySelectorAll('.btn-pago');
        btnPagos.forEach(btn => btn.addEventListener('click', (e) => this.setMetodoPago(e.target.dataset.metodo)));
        document.getElementById('btn-cobrar').addEventListener('click', () => this.cobrar());
        
        // Auto-docena Toggle
        document.getElementById('toggle-autodocena').addEventListener('change', (e) => {
            if(e.target.checked) this.autoEmp();
            this.updateCarritoUI();
        });
        
        // Retry Syncing when online connection established
        window.addEventListener('online', () => this.intentarSincronizarPendientes());
        window.addEventListener('offline', () => this.actualizarUIInternet());
    }

    async validarLogin() {
        const inputVal = document.getElementById('pass').value;
        const hashedInput = await this.sha256(inputVal);
        
        if (hashedInput === CONST_PASSWORD_HASH) {
            document.getElementById('bloqueo').style.display = 'none';
            document.getElementById('app-caja').style.display = 'flex';
            this.cargarMenu();
            this.intentarSincronizarPendientes(); // Start background sync if any pending
        } else {
            alert("Clave Incorrecta");
            document.getElementById('pass').value = '';
        }
    }

    // --- Carga de Datos CSV ---
    cargarMenu() {
        document.getElementById('loading').style.display = 'block';
        let urlActualizada = CONST_URL_CSV + '&t=' + new Date().getTime();
        
        fetch(urlActualizada, { cache: 'no-store' })
        .then(r => r.text())
        .then(csvText => {
            localStorage.setItem('menuPizzeria', csvText); 
            this.parsearCSV(csvText);
            this.actualizarUIInternet(true);
        })
        .catch(err => {
            console.warn("Sin internet, intentando cargar menú guardado...");
            this.actualizarUIInternet(false);
            let menuGuardado = localStorage.getItem('menuPizzeria');
            if(menuGuardado) {
                this.mostrarToast("⚠️ Modo Offline: Usando menú guardado");
                this.parsearCSV(menuGuardado);
            } else {
                document.getElementById('loading').style.display = 'none';
                alert("No hay conexión a internet y no hay menú guardado en caché.");
            }
        });
    }

    parsearCSV(csvText) {
        document.getElementById('loading').style.display = 'none';
        Papa.parse(csvText, {
            header: true, skipEmptyLines: true,
            complete: (r) => {
                this.menuItems = r.data;
                this.procesarDatos(r.data);
            }
        });
    }

    procesarDatos(data) {
        this.catalogo = []; this.dbClasicas = []; this.dbPremium = []; 
        this.precioBaseClasica = 0; this.promoDocenaItem = null;
        
        data.forEach(item => {
            if (!item.SECCION || !item.NOMBRE || this.normalize(item.SECCION) === 'CONFIGURACION') return;
            if (item['SUCURSAL 1'] && item['SUCURSAL 1'].trim().toUpperCase() !== 'SI') return;
            if (item.NOMBRE.toUpperCase().includes('DOCENA') && (item.NOMBRE.toUpperCase().includes('ESPECIAL') || item.NOMBRE.toUpperCase().includes('FATAY'))) return;
            
            let p1 = this.cleanPrice(item.PRECIO_1), p2 = this.cleanPrice(item.PRECIO_2), seccion = this.normalize(item.SECCION);
            let isDocena = item.NOMBRE.toUpperCase().includes('DOCENA') && !item.NOMBRE.toUpperCase().includes('ESPECIAL');
            let isFatay = item.NOMBRE.toUpperCase().includes('FATAY') || seccion.includes('FATAY');

            if (isDocena && !isFatay && !this.promoDocenaItem) this.promoDocenaItem = { nombre: item.NOMBRE, precio: p1 };
            if (seccion.includes('CLASICAS') && !isDocena) { this.dbClasicas.push(item); if (this.precioBaseClasica === 0) this.precioBaseClasica = p1; }
            if (seccion.includes('PREMIUM') && !isDocena) this.dbPremium.push(item);

            if (isDocena && !isFatay) return;

            let prodObj = { nombre: item.NOMBRE, descripcion: item.DESCRIPCION || "", variante: "", precio: p1, categoria: "", isDocena: isDocena };

            if (seccion.includes('MEDIA')) {
                if(p2 > 0) this.catalogo.push({ ...prodObj, variante: 'Horneada', precio: p2, categoria: 'MEDIAS_HORNEADAS', isDocena: false });
                if(p1 > 0) this.catalogo.push({ ...prodObj, variante: 'Para Hornear', precio: p1, categoria: 'MEDIAS_HORNEAR', isDocena: false });
            } else if(seccion.includes('PIZZA')) {
                if(p2 > 0) this.catalogo.push({ ...prodObj, variante: 'Horneada', precio: p2, categoria: 'PIZZAS_HORNEADAS', isDocena: false });
                if(p1 > 0) this.catalogo.push({ ...prodObj, variante: 'Para Hornear', precio: p1, categoria: 'PIZZAS_HORNEAR', isDocena: false });
            } else if(isFatay) { this.catalogo.push({ ...prodObj, categoria: 'FATAYS' });
            } else if(seccion.includes('EMPANADA')) { this.catalogo.push({ ...prodObj, categoria: 'EMPANADAS' });
            } else if(seccion.includes('PROMO')) { this.catalogo.push({ ...prodObj, categoria: 'PROMOS' });
            } else if(seccion.includes('BEBIDA')) { this.catalogo.push({ ...prodObj, categoria: 'BEBIDAS' });
            } else if(seccion.includes('EXTRA')) { this.catalogo.push({ ...prodObj, categoria: 'EXTRAS' }); }
        });
        
        this.catalogo.sort((a, b) => (a.isDocena && !b.isDocena) ? 1 : (!a.isDocena && b.isDocena) ? -1 : 0);
        // Default filter
        const defaultBtn = document.querySelector('.btn-filtro[data-categoria="PIZZAS_HORNEADAS"]');
        this.filtrarCatalogo('PIZZAS_HORNEADAS', defaultBtn);
    }

    filtrarCatalogo(categoria, btnElement) {
        document.querySelectorAll('#contenedor-filtros .btn-filtro').forEach(b => b.classList.remove('active'));
        if(btnElement) btnElement.classList.add('active');
        
        const grid = document.getElementById('grid-productos'); 
        grid.innerHTML = '';
        
        this.catalogo.filter(i => i.categoria === categoria).forEach(item => {
            let btn = document.createElement('button'); 
            btn.className = 'btn-producto';
            
            // XSS Prevention using DOM Creation instead of innerHTML directly where user data goes
            let nombreDiv = document.createElement('div');
            nombreDiv.className = 'nombre';
            nombreDiv.textContent = item.nombre;
            btn.appendChild(nombreDiv);

            if(item.variante) {
                let varDiv = document.createElement('div');
                varDiv.className = 'variante';
                varDiv.textContent = item.variante;
                btn.appendChild(varDiv);
            }

            if(categoria === 'PROMOS' && item.descripcion) {
                let descDiv = document.createElement('div');
                descDiv.className = 'desc-promo';
                descDiv.textContent = item.descripcion;
                btn.appendChild(descDiv);
            }

            let precioDiv = document.createElement('div');
            precioDiv.className = 'precio';
            precioDiv.textContent = `$${this.formatPrice(item.precio)}`;
            btn.appendChild(precioDiv);

            btn.addEventListener('click', () => { 
                if (item.isDocena && item.categoria !== 'FATAYS') this.abrirModalDocena(item); 
                else this.agregarAlCarrito(item.nombre, item.variante, item.precio, item.isDocena, item.categoria, item.descripcion); 
            });
            
            grid.appendChild(btn);
        });
    }

    // --- Logica Carrito ---
    agregarAlCarrito(n, v, p, d, c, desc = "") {
        let ex = this.carrito.find(i => i.nombre === n && i.variante === v);
        if (ex && !d) ex.cantidad++; 
        else this.carrito.push({ nombre: n, variante: v, precio: p, cantidad: 1, isDocena: d, categoria: c, descripcion: desc });
        this.autoEmp(); 
        this.updateCarritoUI();
    }

    autoEmp() {
        if (!document.getElementById('toggle-autodocena').checked || !this.promoDocenaItem) return;

        let sueltas = this.carrito.filter(i => i.categoria === 'EMPANADAS' && !i.isDocena);
        let totalSueltas = sueltas.reduce((s, i) => s + i.cantidad, 0);
        
        while (totalSueltas >= DOCENA_SIZE) {
            let sab = {}, rec = 0, sumExtraPremium = 0, minExtraPremium = Infinity, hayClasica = false;
            for (let i = 0; i < this.carrito.length; i++) {
                let it = this.carrito[i];
                if (it.categoria === 'EMPANADAS' && !it.isDocena) {
                    while (it.cantidad > 0 && rec < DOCENA_SIZE) {
                        it.cantidad--; rec++; sab[it.nombre] = (sab[it.nombre] || 0) + 1;
                        let pPremium = this.dbPremium.find(p => p.NOMBRE === it.nombre);
                        if (pPremium) {
                            let extra = Math.max(0, this.cleanPrice(pPremium.PRECIO_1) - this.precioBaseClasica);
                            sumExtraPremium += extra;
                            if (extra < minExtraPremium) minExtraPremium = extra;
                        } else {
                            hayClasica = true;
                        }
                    }
                }
                if (rec === DOCENA_SIZE) break;
            }
            this.carrito = this.carrito.filter(i => i.cantidad > 0);
            
            let ajuste = (!hayClasica && minExtraPremium !== Infinity) ? minExtraPremium : 0;
            let extraPrice = sumExtraPremium - ajuste;
            
            let v = Object.entries(sab).map(([n, c]) => `${c}x ${n}`).join(' | ');
            this.agregarAlCarrito(this.promoDocenaItem.nombre, v, this.promoDocenaItem.precio + extraPrice, true, 'PROMOS', "");
            totalSueltas -= DOCENA_SIZE;
        }
    }

    cambiarCantidad(index, diff) {
        this.carrito[index].cantidad += diff; 
        if (this.carrito[index].cantidad <= 0) this.carrito.splice(index, 1); 
        this.autoEmp(); 
        this.updateCarritoUI(); 
    }

    eliminarItemCarrito(index) {
        this.carrito.splice(index, 1);
        this.autoEmp();
        this.updateCarritoUI();
    }

    updateCarritoUI() {
        const container = document.getElementById('cart-items'); 
        this.subtotalReal = 0;
        
        if (this.carrito.length === 0) { 
            container.innerHTML = '<p style="text-align:center; color:#666; margin-top:40px;">No hay productos</p>'; 
            document.getElementById('btn-cobrar').disabled = true; 
        } else {
            document.getElementById('btn-cobrar').disabled = false;
            container.innerHTML = ''; // Limpiar
            
            this.carrito.forEach((item, i) => {
                let total = item.precio * item.cantidad; 
                this.subtotalReal += total;
                
                // Creación de nodos para seguridad
                let cartItem = document.createElement('div');
                cartItem.className = 'item-cart';
                
                let infoDiv = document.createElement('div');
                infoDiv.style = "max-width: 45%; word-wrap: break-word;";
                let titleB = document.createElement('b'); titleB.style="line-height:1.1; display:block;"; titleB.textContent = item.nombre;
                let varSmall = document.createElement('small'); varSmall.style="color:#aaa;"; varSmall.textContent = item.variante;
                infoDiv.appendChild(titleB); infoDiv.appendChild(varSmall);
                
                let ctrlDiv = document.createElement('div');
                ctrlDiv.className = 'item-cart-controles';
                let btnMinus = document.createElement('button'); btnMinus.className = "btn-qty"; btnMinus.textContent = "-"; btnMinus.onclick = () => this.cambiarCantidad(i, -1);
                let qtyB = document.createElement('b'); qtyB.textContent = item.cantidad;
                let btnPlus = document.createElement('button'); btnPlus.className = "btn-qty"; btnPlus.textContent = "+"; btnPlus.onclick = () => this.cambiarCantidad(i, 1);
                ctrlDiv.appendChild(btnMinus); ctrlDiv.appendChild(qtyB); ctrlDiv.appendChild(btnPlus);

                let utilDiv = document.createElement('div'); utilDiv.style="display:flex; align-items:center; gap:10px;";
                let priceSpan = document.createElement('span'); priceSpan.textContent = `$${this.formatPrice(total)}`;
                let trashBtn = document.createElement('button'); trashBtn.className = "btn-trash"; trashBtn.title = "Eliminar"; trashBtn.innerHTML = '<i class="fas fa-trash"></i>';
                trashBtn.onclick = () => this.eliminarItemCarrito(i);
                utilDiv.appendChild(priceSpan); utilDiv.appendChild(trashBtn);

                cartItem.appendChild(infoDiv); cartItem.appendChild(ctrlDiv); cartItem.appendChild(utilDiv);
                container.appendChild(cartItem);
            });
        }
        document.getElementById('total-display').value = this.subtotalReal; 
        this.calcularVuelto();
    }

    // --- Pagos y Cobros ---
    setMetodoPago(m) {
        this.metodoPago = m;
        document.querySelectorAll('.btn-pago').forEach(b => b.classList.toggle('active', b.dataset.metodo === m));
        document.getElementById('box-vuelto').style.opacity = m === 'Efectivo' ? '1' : '0.2'; 
        document.getElementById('paga-con').disabled = m !== 'Efectivo';
    }

    calcularVuelto() {
        let pagaInput = document.getElementById('paga-con');
        let paga = parseFloat(pagaInput.value) || 0; 
        let t = parseFloat(document.getElementById('total-display').value) || 0;
        
        if (paga < 0) { pagaInput.value = ''; paga = 0; }
        
        let v = paga - t; 
        document.getElementById('display-vuelto').innerText = (paga >= t && t > 0) ? "$"+this.formatPrice(v) : "$0"; 
    }

    aplicarDescuento(tipo) {
        let val = parseFloat(document.getElementById('input-desc').value);
        if(!val) return;
        let nuevoTotal = this.subtotalReal;
        if(tipo === '%') nuevoTotal = this.subtotalReal - (this.subtotalReal * val / 100);
        else nuevoTotal = this.subtotalReal - val;
        
        document.getElementById('total-display').value = Math.max(0, nuevoTotal);
        document.getElementById('desc-modal').style.display = 'none';
        this.calcularVuelto();
    }

    // --- Docenas Modal ---
    abrirModalDocena(item) {
        this.docenaActual = item; 
        this.docenaSeleccion = {}; 
        this.docenaCantTotal = 0; 
        this.docenaPrecioExtra = 0;
        
        document.getElementById('md-title').textContent = item.nombre;
        const bodyContent = document.getElementById('md-sabores');
        bodyContent.innerHTML = '';
        
        let renderGroup = (arr, title, isPremium) => {
            let h4 = document.createElement('h4');
            h4.style = `border-bottom:1px solid #333; padding-bottom:5px; ${isPremium ? 'color:var(--accent);' : ''}`;
            h4.textContent = title;
            bodyContent.appendChild(h4);

            arr.forEach(e => {
                let extraPrice = isPremium ? (this.cleanPrice(e.PRECIO_1) - this.precioBaseClasica) : 0;
                let itemNameId = e.NOMBRE.replace(/\s+/g,'');

                let row = document.createElement('div');
                row.style = "display:flex; justify-content:space-between; margin-bottom:12px;";
                
                let spanName = document.createElement('span');
                spanName.textContent = isPremium ? `${e.NOMBRE} (+${extraPrice})` : e.NOMBRE;
                
                let stepDiv = document.createElement('div');
                stepDiv.className = "stepper-docena";
                
                let btnMin = document.createElement('button'); btnMin.textContent = "-";
                btnMin.onclick = () => this.cambiarGustoDocena(e.NOMBRE, -1, isPremium, extraPrice, itemNameId);
                
                let spanQty = document.createElement('span'); spanQty.id = `md-qty-${itemNameId}`;
                spanQty.style = "width:30px; text-align:center;"; spanQty.textContent = "0";
                
                let btnPlu = document.createElement('button'); btnPlu.textContent = "+";
                btnPlu.onclick = () => this.cambiarGustoDocena(e.NOMBRE, 1, isPremium, extraPrice, itemNameId);
                
                stepDiv.appendChild(btnMin); stepDiv.appendChild(spanQty); stepDiv.appendChild(btnPlu);
                row.appendChild(spanName); row.appendChild(stepDiv);
                bodyContent.appendChild(row);
            });
        };

        renderGroup(this.dbClasicas, "Clásicas", false);
        renderGroup(this.dbPremium, "Premium", true);

        document.getElementById('modal-docena').style.display = 'flex'; 
        this.actualizarUIDocena();
    }

    cambiarGustoDocena(n, d, p, e, idDom) {
        let a = this.docenaSeleccion[n] || 0; 
        if ((d > 0 && this.docenaCantTotal >= DOCENA_SIZE) || (d < 0 && a <= 0)) return;
        
        this.docenaSeleccion[n] = a + d; 
        this.docenaCantTotal += d; 
        
        document.getElementById(`md-qty-${idDom}`).textContent = this.docenaSeleccion[n]; 
        this.actualizarUIDocena();
    }

    actualizarUIDocena() {
        document.getElementById('md-count').textContent = this.docenaCantTotal;
        
        let sumExtraPremium = 0;
        let hayClasica = false;
        let minExtraPremium = Infinity;

        for (let name in this.docenaSeleccion) {
            let qty = this.docenaSeleccion[name];
            if (qty > 0) {
                let pPremium = this.dbPremium.find(p => p.NOMBRE === name);
                if (pPremium) {
                    let extra = Math.max(0, this.cleanPrice(pPremium.PRECIO_1) - this.precioBaseClasica);
                    sumExtraPremium += (qty * extra);
                    if (extra < minExtraPremium) minExtraPremium = extra;
                } else {
                    hayClasica = true;
                }
            }
        }
        let ajuste = (this.docenaCantTotal === DOCENA_SIZE && !hayClasica && minExtraPremium !== Infinity) ? minExtraPremium : 0;
        this.docenaPrecioExtra = sumExtraPremium - ajuste;
        
        document.getElementById('md-total').textContent = "$"+this.formatPrice(this.docenaActual.precio + this.docenaPrecioExtra);
        document.getElementById('btn-confirmar-docena').disabled = this.docenaCantTotal !== DOCENA_SIZE;
    }

    confirmarDocena() {
        let s = Object.entries(this.docenaSeleccion).filter(([n, c]) => c > 0).map(([n, c]) => `${c}x ${n}`).join(' | ');
        this.agregarAlCarrito(this.docenaActual.nombre, s, this.docenaActual.precio + this.docenaPrecioExtra, true, 'PROMOS', ""); 
        document.getElementById('modal-docena').style.display = 'none';
    }

    // --- COBRO y TICKETS Offline/Online Queue ---
    cobrar() {
        let cli = document.getElementById('input-cliente').value || "Mostrador";
        let fec = new Date().toLocaleDateString('es-AR');
        let hor = new Date().toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'});
        let numTurno = Math.floor(100+Math.random()*900);
        let totalCargar = parseFloat(document.getElementById('total-display').value) || 0;

        let t = `<div class="t-center t-bold">PIZZERIA POPULAR</div><div class="t-center">Turno: #${numTurno}</div><div class="t-line"></div><div>Fecha: ${fec} ${hor}</div><div>Cliente: ${this.sanitizeForHTML(cli)}</div><div class="t-line"></div>`;
        let detExcel = [], scriptCart = [];
        
        this.carrito.forEach(it => {
            let cleanName = this.cleanEmojis(it.nombre);
            let cleanVar = this.cleanEmojis(it.variante);
            
            let vTicket = '';
            if (it.isDocena && it.variante) { vTicket = cleanVar.split('|').map(s => `<div class="t-var">- ${this.sanitizeForHTML(s.trim())}</div>`).join(''); } 
            else if (it.variante) { vTicket = `<div class="t-var">- ${this.sanitizeForHTML(cleanVar)}</div>`; }
            let descHtml = (it.categoria === 'PROMOS' && it.descripcion) ? `<div class="t-desc">Inc: ${this.sanitizeForHTML(this.cleanEmojis(it.descripcion))}</div>` : "";
            
            t += `<div class="t-item"><div><b>${it.cantidad}x ${this.sanitizeForHTML(cleanName)}</b>${vTicket}${descHtml}</div><div>$${this.formatPrice(it.precio*it.cantidad)}</div></div>`;
            detExcel.push(`${it.cantidad}x ${cleanName} [${cleanVar}]`);
            
            // Agregar ítem base al scriptCart (si es Promo, etiquetarla para Excel)
            let clone = { name: cleanName, variant: cleanVar, quantity: it.cantidad, price: it.precio, isDocena: it.isDocena };
            if (it.categoria === 'PROMOS' && !it.isDocena) clone.categoria = "Promo";
            scriptCart.push(clone);

            // Desglose de pizzas de Promo para control de stock
            if (it.categoria === 'PROMOS' && !it.isDocena && it.descripcion) {
                let parts = it.descripcion.split('+');
                parts.forEach(part => {
                    part = part.replace('★', '').trim();
                    let subQtyMatch = part.match(/^\d+/);
                    let subQty = subQtyMatch ? parseInt(subQtyMatch[0]) : 1;
                    let subName = part.replace(/^\d+/, '').trim();
                    
                    scriptCart.push({
                        name: subName,
                        price: 0,
                        variant: "Para Hornear",
                        quantity: it.cantidad * subQty,
                        isDocena: false,
                        categoria: "Pizza (De Promo)"
                    });
                });
            }
        });
        
        t += `<div class="t-line"></div><div class="t-total" style="font-size:18px; font-weight:900; text-align:right;">TOTAL: $${this.formatPrice(totalCargar)}</div><div>Pago: ${this.metodoPago}</div><div class="t-line"></div><div class="t-center" style="margin-top:10px; font-weight:900; font-size:16px;">PARA COCINA - #${numTurno}</div>`;
        document.getElementById('ticket-impresion').innerHTML = t;
        
        // Save local history logic
        try { 
            let hist = JSON.parse(localStorage.getItem('ticketsPizzeria')) || []; 
            hist.unshift({ id: numTurno, cliente: cli, total: totalCargar, fecha: fec, time: hor, html: t }); 
            if(hist.length > 50) hist.pop(); 
            localStorage.setItem('ticketsPizzeria', JSON.stringify(hist)); 
        } catch(e) { console.error("Error guardando historial local", e); }
        
        window.print();

        // Enqueue Fetch request
        let ventaData = { fecha: fec, hora: hor, cliente: cli, telefono: "-", tipoEntrega: "Mostrador", direccion: "Local", pago: this.metodoPago, total: totalCargar, envio: 0, detalleResumen: detExcel.join(' + '), carrito: scriptCart };
        
        this.encolarVenta(ventaData);
        
        // Reset state
        this.carrito = []; 
        document.getElementById('paga-con').value = ''; 
        document.getElementById('input-cliente').value = ''; 
        this.updateCarritoUI();
        this.mostrarToast("✅ Venta registrada");
    }

    sanitizeForHTML(str) {
        let temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }

    // --- Offline Sales Queue (Encola Ventas si no hay internet) ---
    cargarPendientes() {
        try {
            return JSON.parse(localStorage.getItem('ventasPendientesOffline')) || [];
        } catch(e) { return []; }
    }

    guardarPendientes() {
        localStorage.setItem('ventasPendientesOffline', JSON.stringify(this.ventasPendientes));
        this.actualizarUIInternet();
    }

    encolarVenta(ventaData) {
        const ventaContainer = { id: Date.now(), data: ventaData, retries: 0 };
        this.ventasPendientes.push(ventaContainer);
        this.guardarPendientes();
        this.intentarSincronizarPendientes();
    }

    async intentarSincronizarPendientes() {
        if (!navigator.onLine || this.ventasPendientes.length === 0) {
            this.actualizarUIInternet();
            return;
        }

        // Processing a copy of the queue (or simply just the first element iteratively)
        const pendingRef = [...this.ventasPendientes];
        let remaining = [];

        for (let item of pendingRef) {
            try {
                // Important: we can't fully "await" a no-cors, we can just hope it fired. 
                // But catching fetch network error works to check if literally offline immediately.
                await fetch(CONST_URL_REGISTRO, { 
                    method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, 
                    body: JSON.stringify(item.data) 
                });
                // If it passes await, consider it successful (since it's no-cors we can't read response anyway)
                console.log(`[Sync] Venta ${item.id} sincronizada correctamente.`);
            } catch (e) {
                console.warn(`[Sync] Falló sincronización venta ${item.id}`, e);
                item.retries++;
                remaining.push(item);
            }
        }
        
        this.ventasPendientes = remaining;
        this.guardarPendientes();
    }

    actualizarUIInternet(forceEstado = null) {
        const ind = document.getElementById('sync-status-indicator');
        const txt = document.getElementById('sync-text');
        
        if(!ind) return;

        ind.style.display = 'flex';
        let isOnline = forceEstado !== null ? forceEstado : navigator.onLine;

        if (!isOnline) {
            ind.className = "sync-status sync-error";
            txt.textContent = "Offline";
            ind.title = "Sistema sin internet o servidor fallando.";
        } else if (this.ventasPendientes.length > 0) {
            ind.className = "sync-status sync-error";
            txt.textContent = `Pendientes: ${this.ventasPendientes.length}`;
            ind.title = "Click para intentar subir las ventas guardadas offline.";
            ind.onclick = () => this.intentarSincronizarPendientes();
        } else {
            ind.className = "sync-status sync-ok";
            txt.textContent = "Sincronizado";
            ind.title = "Sincronización al día.";
            ind.onclick = null;
        }
    }

    // --- Historial Modals ---
    abrirHistorial() {
        let hist = []; 
        try { hist = JSON.parse(localStorage.getItem('ticketsPizzeria')) || []; } catch(e) {}
        
        let cont = document.getElementById('lista-historial'); 
        cont.innerHTML = '';
        
        if(hist.length === 0) { 
            cont.innerHTML = '<p style="text-align:center; color:#aaa; margin-top:20px;">No hay tickets guardados</p>'; 
        } else {
            let fechaHoy = new Date().toLocaleDateString('es-AR');
            hist.forEach((t, i) => {
                let isHoy = t.fecha === fechaHoy;
                
                let itemC = document.createElement('div');
                itemC.style = "background:#222; padding:15px; margin-bottom:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;";
                
                let df = isHoy ? '<span style="color:#25D366; font-weight:bold;">HOY</span>' : `<span style="color:#FF3D00; font-weight:bold;">${this.sanitizeForHTML(t.fecha || 'Anterior')}</span>`;
                
                let txtDiv = document.createElement('div');
                txtDiv.innerHTML = `<b style="color:var(--primary); font-size:1.1rem;">Turno #${t.id}</b> - ${df} ${t.time}<br><span style="color:#ddd;">Cliente: ${this.sanitizeForHTML(t.cliente)}</span><br><b>$${this.formatPrice(t.total)}</b>`;
                
                let btn = document.createElement('button');
                btn.style = "background:var(--primary); color:#000; border:none; padding:12px 20px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:1.2rem;";
                btn.innerHTML = '<i class="fas fa-print"></i>';
                btn.onclick = () => this.reimprimirTicket(i);
                
                itemC.appendChild(txtDiv); itemC.appendChild(btn);
                cont.appendChild(itemC);
            });
        }
        document.getElementById('historial-modal').style.display = 'flex';
    }

    limpiarHistorial() {
        if(confirm("¿Borrar historial local de esta PC?")) {
            localStorage.removeItem('ticketsPizzeria');
            this.abrirHistorial();
        }
    }

    reimprimirTicket(index) {
        let hist = JSON.parse(localStorage.getItem('ticketsPizzeria')) || []; 
        if(hist[index]) { 
            document.getElementById('ticket-impresion').innerHTML = hist[index].html; 
            window.print(); 
        }
    }

    // --- Impresión de WA ---
    imprimirWA() {
        let texto = document.getElementById('wa-text').value.trim(); 
        if (!texto) { alert("Tenés que pegar el texto del pedido primero."); return; }
        
        // XSS Defense: sanitize ALL wa text before creating html structure.
        let sanitizedText = this.sanitizeForHTML(texto);

        // Transformar asteriscos en bold
        let htmlTexto = sanitizedText.replace(/\*(.*?)\*/g, '<b style="font-size:15px; text-transform:uppercase;">$1</b>');
        
        // Reemplazar líneas
        htmlTexto = htmlTexto.replace(/-{4,}/g, '</div><div class="t-line"></div><div style="font-size:14px; line-height:1.4; padding: 5px 0;">');
        
        // Separador gigante de COCINA
        htmlTexto = htmlTexto.replace(/(<b>.*?PEDIDO.*?<\/b>)/i, '<div class="t-line" style="margin-top:15px; border-top: 3px dashed black;"></div><div class="t-center" style="font-size:20px; font-weight:900; margin:10px 0;">--- COCINA ---</div><div class="t-line" style="margin-bottom:10px; border-top: 3px dashed black;"></div>');
        
        // Saltos de línea
        htmlTexto = htmlTexto.replace(/\n/g, '<br>');

        document.getElementById('ticket-impresion').innerHTML = `<div class="t-center t-bold">PIZZERIA POPULAR</div><div class="t-center" style="margin-bottom: 10px;">PEDIDO APP / WA</div><div class="t-line"></div><div style="font-size:14px; line-height:1.4; padding: 5px 0;">${htmlTexto}</div><div class="t-line"></div><div class="t-center" style="margin-top:10px; font-weight:900; font-size:16px;">FIN DEL TICKET</div>`;
        window.print(); 
        document.getElementById('wa-modal').style.display = 'none';
    }
}

// Inicializar Aplicación al cargar el DOM completo
document.addEventListener("DOMContentLoaded", () => {
    window.AppCaja = new PizzeriaPOS();
});
