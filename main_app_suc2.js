const CONST_URL_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQae4azVxGxHwSNGEcqoMUia0sNSykZxGA0koTpJ2SRcihjopNGaVAIlm2MjOhbxgmU6Y05e0ffzNVB/pub?output=csv';
const CONST_WHATSAPP_NUMBER = "5492214389280"; 
const CONST_URL_REGISTRO = 'https://script.google.com/macros/s/AKfycbxZETP1WxkmcnBdaimHc-F8CMQmLCJxeSlkNfvgbj2v4d-L5sPfptHA1B8fXLcfTty_/exec';
const DOCENA_SIZE = 12;

class PizzeriaApp {
    constructor() {
        this.cart = [];
        this.costoDeEnvio = 0;
        this.aliasTransferencia = "Consultar por WhatsApp";

        this.dbClasicas = [];
        this.dbPremium = [];
        this.precioBaseClasica = 0;

        this.pendingDocena = null;
        this.docenaSelection = {};
        this.docenaTotalQty = 0;
        this.docenaExtraPrice = 0;

        this.init();
    }

    // --- UTILS ---
    normalize(str) { return str ? str.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ') : ''; }
    cleanPrice(priceStr) { return parseInt((priceStr||"").toString().replace(/[^0-9]/g, '')) || 0; }
    formatPrice(num) { return (!num || num === 0) ? '' : '$' + num.toLocaleString('es-AR'); }
    sanitize(str) { let temp = document.createElement('div'); temp.textContent = str; return temp.innerHTML; }
    cleanEmojis(str) { return str.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}⭐❄️🔥🌓🥟🍕🥤]/gu, '').trim(); }

    init() {
        this.bindEvents();
        this.checkStatus();
        setInterval(() => this.checkStatus(), 60000);
        this.cargarMenu();
    }

    bindEvents() {
        // Modal Carrito
        document.getElementById('cart-btn').addEventListener('click', () => this.toggleCart());
        document.getElementById('btn-close-cart').addEventListener('click', () => this.toggleCart());
        
        // Checkout Form Interactivity
        document.getElementById('cli-entrega').addEventListener('change', () => { this.toggleDeliveryFields(); this.updateCartUI(); });
        document.getElementById('cli-horario').addEventListener('change', () => this.toggleHorarioFields());
        document.getElementById('cli-pago').addEventListener('change', () => this.togglePagoFields());
        
        // Actual submit handled natively by the <form> to leverage required fields HTML5
        document.getElementById('checkout-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.enviarPedido();
        });

        // Modal Docena
        document.getElementById('btn-close-docena').addEventListener('click', () => this.closeDocenaModal());
        document.getElementById('btn-confirm-docena').addEventListener('click', () => this.confirmDocena());
    }

    // --- CARGA Y RENDERIZADO DEL MENÚ (DOM Seguro y Optimo) ---
    cargarMenu() {
        Papa.parse(CONST_URL_CSV + '&t=' + new Date().getTime(), {
            download: true, header: true, skipEmptyLines: true,
            complete: (results) => {
                document.getElementById('loading-msg').style.display = 'none';
                this.menuItems = results.data; // Guardar para buscar descripciones después
                this.renderMenu(results.data);
            },
            error: (err) => {
                document.getElementById('loading-msg').innerHTML = '<i class="fas fa-exclamation-triangle" style="color:red;"></i> Error al conectar con el sistema.';
            }
        });
    }

    renderMenu(items) {
        const containerMap = {
            'promos-list': ['PROMOS', 'PROMOCIONES', 'PROMO', 'SECCION PROMOCIONES'],
            'pizzas-list': ['PIZZAS', 'PIZZA', 'NUESTRAS PIZZAS', 'SECCION PIZZAS'],
            'medias-pizzas-list': ['MEDIAS PIZZAS', 'MEDIA PIZZA'],
            'empanadas-clasicas-list': ['EMPANADAS CLASICAS', 'EMPANADAS', 'CLASICAS', 'EMPANADAS_CLASICAS'],
            'empanadas-premium-list': ['EMPANADAS PREMIUM', 'PREMIUM', 'EMPANADAS ESPECIALES', 'EMPANADAS_PREMIUM'],
            'fatays-list': ['FATAYS', 'FATAY', 'FATAY (CARNE)'],
            'bebidas-unificadas-list': ['BEBIDAS SIN ALCOHOL', 'BEBIDAS', 'GASEOSAS', 'SIN ALCOHOL', 'BEBIDAS_SIN_ALCOHOL', 'CERVEZAS', 'CERVEZA', 'ALCOHOL']
        };

        items.forEach(item => {
            if (!item.SECCION || !item.NOMBRE) return;
            if (item['SUCURSAL 2'] && this.normalize(item['SUCURSAL 2']) === 'NO') return;

            const cleanSection = this.normalize(item.SECCION).replace(/_/g, ' ');
            const isDocena = item.NOMBRE.toUpperCase().includes('DOCENA');

            if (isDocena && (item.NOMBRE.toUpperCase().includes('ESPECIAL') || item.NOMBRE.toUpperCase().includes('FATAY'))) return;

            if (cleanSection === 'CONFIGURACION') {
                if (this.normalize(item.NOMBRE) === 'ENVIO') this.costoDeEnvio = this.cleanPrice(item.PRECIO_1);
                if (this.normalize(item.NOMBRE) === 'ALIAS SUCURSAL 2') {
                    this.aliasTransferencia = item.DESCRIPCION || item.PRECIO_1 || "Consultar por WhatsApp";
                    document.getElementById('display-alias').textContent = this.aliasTransferencia;
                }
                return;
            }

            if (cleanSection.includes('CLASICAS') && !isDocena) {
                this.dbClasicas.push(item);
                if (this.precioBaseClasica === 0) this.precioBaseClasica = this.cleanPrice(item.PRECIO_1);
            }
            if (cleanSection.includes('PREMIUM') && !isDocena) this.dbPremium.push(item);

            let targetId = null;
            for (const [id, synonyms] of Object.entries(containerMap)) {
                if (synonyms.includes(cleanSection)) { targetId = id; break; }
            }
            if (!targetId) return;

            const p1Num = this.cleanPrice(item.PRECIO_1);
            const p2Num = this.cleanPrice(item.PRECIO_2);
            const isPopular = item.NOMBRE.toUpperCase().includes('POPULAR');
            
            // Creación limpia mediante el DOM general
            let uiElement = this.buildProductNode(targetId, item, p1Num, p2Num, isPopular, isDocena);
            if (uiElement) {
                if (isDocena) document.getElementById(targetId).prepend(uiElement);
                else document.getElementById(targetId).appendChild(uiElement);
            }
        });

        // Hide empty sections dynamically (H2 titles and Nav pills)
        const sections = [
            { id: 'fatays', lists: ['fatays-list'] },
            { id: 'promos', lists: ['promos-list'] },
            { id: 'pizzas', lists: ['pizzas-list'] },
            { id: 'medias-pizzas', lists: ['medias-pizzas-list'] },
            { id: 'bebidas', lists: ['bebidas-unificadas-list'] },
            { id: 'empanadas', lists: ['empanadas-clasicas-list', 'empanadas-premium-list'] }
        ];

        sections.forEach(sec => {
            let totalItems = 0;
            sec.lists.forEach(lId => {
                let list = document.getElementById(lId);
                if (list) {
                    totalItems += list.children.length;
                    if (list.children.length === 0 && list.previousElementSibling && list.previousElementSibling.classList.contains('subsection-title')) {
                        list.previousElementSibling.style.display = 'none';
                    }
                }
            });

            if (totalItems === 0) {
                let h2 = document.getElementById(sec.id);
                if (h2) h2.style.display = 'none';
                let pill = document.querySelector(`a[href="#${sec.id}"]`);
                if (pill) pill.style.display = 'none';
            }
        });
    }

    buildProductNode(targetId, item, p1Num, p2Num, isPopular, isDocena) {
        let wrapper = document.createElement('div');

        const createStepper = (variant, price) => {
            let sWrap = document.createElement('div'); sWrap.className = 'stepper';
            if (targetId === 'pizzas-list' || targetId === 'medias-pizzas-list') sWrap.style.height = '32px';

            let btnMin = document.createElement('button'); 
            btnMin.innerHTML = '<i class="fas fa-minus"></i>'; btnMin.setAttribute('aria-label', 'Quitar');
            btnMin.onclick = () => this.updateMenuQty(item.NOMBRE, price, variant, -1);
            
            let qtyDisplay = document.createElement('span'); 
            qtyDisplay.className = 'qty-display'; qtyDisplay.setAttribute('data-name', item.NOMBRE); qtyDisplay.setAttribute('data-variant', variant);
            qtyDisplay.textContent = '0';
            
            let btnPlus = document.createElement('button'); 
            btnPlus.innerHTML = '<i class="fas fa-plus"></i>'; btnPlus.setAttribute('aria-label', 'Agregar');
            btnPlus.onclick = () => this.updateMenuQty(item.NOMBRE, price, variant, 1);
            
            sWrap.appendChild(btnMin); sWrap.appendChild(qtyDisplay); sWrap.appendChild(btnPlus);
            return sWrap;
        };

        if (targetId === 'pizzas-list' || targetId === 'medias-pizzas-list') {
            wrapper.style = `background: #1a1a1a; border-radius: 12px; margin-bottom: 16px; border: 1px solid ${isPopular ? 'gold' : '#333'}; box-shadow: 0 4px 6px rgba(0,0,0,0.2); overflow: hidden;`;
            
            let topDiv = document.createElement('div'); topDiv.style = `padding: 15px; background: ${isPopular ? 'rgba(255,215,0,0.05)' : 'transparent'};`;
            let topTitle = document.createElement('h3'); topTitle.style = `margin: 0; font-family: 'Oswald', sans-serif; font-size: 1.3rem; color: ${isPopular ? 'var(--primary)' : '#fff'};`;
            topTitle.innerHTML = `${isPopular ? '<i class="fas fa-star" style="color:gold; font-size:1rem; margin-right:5px;"></i>' : ''} ${this.sanitize(item.NOMBRE)}`;
            topDiv.appendChild(topTitle);
            if (item.DESCRIPCION) { let desc = document.createElement('p'); desc.style = "margin: 5px 0 0 0; font-size: 0.85rem; color: #aaa;"; desc.textContent = item.DESCRIPCION; topDiv.appendChild(desc); }
            wrapper.appendChild(topDiv);

            let botDiv = document.createElement('div'); botDiv.style = "background: #0f0f0f; padding: 12px 15px; border-top: 1px solid #222;";
            
            let v1Wrap = document.createElement('div'); v1Wrap.style = "display: flex; justify-content: space-between; align-items: center;";
            v1Wrap.innerHTML = `<div style="display: flex; align-items: center; gap: 8px;"><span style="color: #4FC3F7; font-size: 0.9rem; font-weight: bold; text-transform: uppercase;">❄️ Para Hornear</span><span style="color: #fff; font-family: 'Oswald', sans-serif; font-size: 1rem; opacity: 0.9;">${this.formatPrice(p1Num)}</span></div>`;
            v1Wrap.appendChild(createStepper('Para Hornear', p1Num));
            botDiv.appendChild(v1Wrap);

            if (p2Num > 0) {
                let v2Wrap = document.createElement('div'); v2Wrap.style = "display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #333; margin-top: 10px; padding-top: 10px;";
                v2Wrap.innerHTML = `<div style="display: flex; align-items: center; gap: 8px;"><span style="color: #FF5722; font-size: 0.9rem; font-weight: bold; text-transform: uppercase;">🔥 Horneada</span><span style="color: #fff; font-family: 'Oswald', sans-serif; font-size: 1rem; opacity: 0.9;">${this.formatPrice(p2Num)}</span></div>`;
                v2Wrap.appendChild(createStepper('Horneada', p2Num));
                botDiv.appendChild(v2Wrap);
            }
            wrapper.appendChild(botDiv);
        } else if (targetId === 'promos-list') {
            wrapper.className = 'list-item'; wrapper.style = "flex-direction: column; align-items: flex-start; gap: 8px; border: 1px solid var(--primary); background: rgba(255,193,7,0.05); border-radius: 8px; padding: 15px; margin-bottom: 10px;";
            
            let topBar = document.createElement('div'); topBar.style = "width: 100%; display: flex; justify-content: space-between; align-items: baseline;";
            let tgWrap = document.createElement('div'); tgWrap.style="flex:1;";
            tgWrap.innerHTML = `<span class="promo-tag" ${isPopular ? 'style="background-color:gold; color:black;"' : ''}>${isPopular ? 'POPULAR' : 'PROMO'}</span><span class="list-name" style="color: var(--primary); font-size: 1.15rem; display:block;">${this.sanitize(item.NOMBRE)}</span>`;
            topBar.appendChild(tgWrap);
            let prc = document.createElement('span'); prc.className="list-price"; prc.style="font-size: 1.3rem;"; prc.textContent = this.formatPrice(p1Num);
            topBar.appendChild(prc);
            wrapper.appendChild(topBar);

            if(item.DESCRIPCION) { let dsc = document.createElement('div'); dsc.style="font-size: 0.85rem; color: #ccc;"; dsc.textContent = item.DESCRIPCION; wrapper.appendChild(dsc); }

            let cPanel = document.createElement('div'); cPanel.style = "width: 100%; display: flex; justify-content: flex-end; margin-top: 5px;";
            cPanel.appendChild(createStepper('', p1Num));
            wrapper.appendChild(cPanel);
        } else {
            wrapper.className = 'list-item'; 
            if (isDocena) {
                wrapper.style = "margin-bottom: 15px; border: 2px solid var(--primary); background: rgba(255,193,7,0.15); border-radius: 12px; padding: 18px; box-shadow: 0 4px 15px rgba(255,193,7,0.25);";
            }
            
            let dLeft = document.createElement('div'); dLeft.style = "flex: 1; padding-right: 15px;";
            let lbl = document.createElement('div'); lbl.className = 'list-name';
            if (isDocena) lbl.style = "font-weight:800; font-size:1.4rem; color:var(--primary); text-shadow: 0 0 10px rgba(255,193,7,0.5); letter-spacing: 0.5px;";
            lbl.textContent = item.NOMBRE;
            dLeft.appendChild(lbl);
            if(item.DESCRIPCION) { let dsc = document.createElement('div'); dsc.style = "font-size: 0.85rem; color: #ccc; margin-top: 5px;"; dsc.textContent = item.DESCRIPCION; dLeft.appendChild(dsc); }
            wrapper.appendChild(dLeft);

            let dRight = document.createElement('div'); dRight.style="display:flex; align-items:center; gap:15px;";
            let prc = document.createElement('span'); prc.className="list-price"; prc.textContent = this.formatPrice(p1Num);
            dRight.appendChild(prc);
            dRight.appendChild(createStepper('', p1Num));
            wrapper.appendChild(dRight);
        }
        return wrapper;
    }

    // --- LÓGICA DEL CARRITO ---
    updateMenuQty(name, price, variant, change) {
        const isDocena = name.toUpperCase().includes('DOCENA');
        const isFatay = name.toUpperCase().includes('FATAY');

        if (isDocena && !isFatay) {
            if (change > 0) { this.openDocenaModal(name, price); return; }
            if (change < 0) {
                for (let i = this.cart.length - 1; i >= 0; i--) {
                    if (this.cart[i].name === name && this.cart[i].isDocena) {
                        this.cart[i].quantity -= 1;
                        if (this.cart[i].quantity <= 0) this.cart.splice(i, 1);
                        break;
                    }
                }
                this.updateCartUI(); return;
            }
        }

        let existing = null;
        if (isDocena && isFatay) existing = this.cart.find(i => i.name === name && i.isDocena);
        else existing = this.cart.find(i => i.name === name && i.variant === variant && !i.isDocena);

        if (change > 0) {
            if (existing) existing.quantity += change;
            else this.cart.push({ name, price, variant: variant, quantity: 1, isDocena: (isDocena && isFatay) });
            const btn = document.getElementById('cart-btn'); btn.style.transform = 'scale(1.2)'; setTimeout(() => btn.style.transform = 'scale(1)', 200);
        } else if (change < 0 && existing) {
            existing.quantity += change;
            if (existing.quantity <= 0) this.cart.splice(this.cart.indexOf(existing), 1);
        }
        this.updateCartUI();
    }

    updateCartItemQty(index, change) {
        this.cart[index].quantity += change;
        if (this.cart[index].quantity <= 0) this.cart.splice(index, 1);
        this.updateCartUI();
    }

    updateCartUI() {
        const container = document.getElementById('cart-items');
        const tipoEntrega = document.getElementById('cli-entrega').value;
        container.innerHTML = '';
        let subtotal = 0; let count = 0;

        if (this.cart.length === 0) {
            container.innerHTML = '<p style="color:#aaa; text-align:center; margin-top:30px;">El carrito está vacío</p>';
            document.getElementById('checkout-form').style.display = 'none';
            document.getElementById('cart-btn').style.display = 'none';
        } else {
            document.getElementById('cart-btn').style.display = 'flex';
            document.getElementById('checkout-form').style.display = 'flex';

            this.cart.forEach((item, index) => {
                subtotal += item.price * item.quantity;
                count += item.quantity;

                let row = document.createElement('div'); row.className = 'cart-item';
                let divL = document.createElement('div'); divL.style = "flex:1; padding-right: 10px;";
                let ttl = document.createElement('div'); ttl.className = 'cart-item-title'; ttl.textContent = item.name; divL.appendChild(ttl);
                
                if (item.isDocena && item.variant) {
                    let flavors = item.variant.split('|');
                    let varD = document.createElement('div'); varD.style="font-size: 0.75rem; color: #aaa; margin-top: 5px; line-height: 1.4;";
                    varD.innerHTML = `↳ ${flavors.map(f => this.sanitize(f)).join('<br>↳ ')}`;
                    divL.appendChild(varD);
                } else if (!item.isDocena && item.variant) {
                    let varV = document.createElement('div'); varV.className="cart-item-variant"; varV.textContent = item.variant; divL.appendChild(varV);
                }
                row.appendChild(divL);

                let divR = document.createElement('div'); divR.style="display:flex; align-items:center; gap:10px;";
                let ctrl = document.createElement('div'); ctrl.className="stepper"; ctrl.style="height:32px; background:#111; border-color:#333;";
                
                let bMin = document.createElement('button'); bMin.style="color:var(--accent); width:28px;"; bMin.innerHTML='<i class="fas fa-minus"></i>';
                bMin.onclick = () => this.updateCartItemQty(index, -1);
                let lblC = document.createElement('span'); lblC.style="font-weight:bold; font-size:1rem; width:20px; text-align:center;"; lblC.textContent = item.quantity;
                let bPl = document.createElement('button'); bPl.style="color:var(--primary); width:28px;"; bPl.innerHTML='<i class="fas fa-plus"></i>';
                bPl.onclick = () => this.updateCartItemQty(index, 1);
                
                ctrl.appendChild(bMin); ctrl.appendChild(lblC); ctrl.appendChild(bPl);
                
                let prc = document.createElement('div'); prc.className="cart-item-price"; prc.style="margin:0; width:65px; text-align:right;"; prc.textContent = this.formatPrice(item.price * item.quantity);
                
                divR.appendChild(ctrl); divR.appendChild(prc);
                row.appendChild(divR);
                container.appendChild(row);
            });

            if (tipoEntrega === 'delivery' && this.costoDeEnvio > 0) {
                let rDlv = document.createElement('div'); rDlv.className="cart-item"; rDlv.style="background: rgba(255,193,7,0.1); border-radius: 8px; padding: 10px; border: 1px solid rgba(255,193,7,0.3); margin-top: 10px;";
                rDlv.innerHTML = `<div style="flex:1"><div class="cart-item-title" style="color: var(--primary);">🛵 Costo de Envío</div></div><div class="cart-item-price" style="color: var(--primary); margin-right:0;">${this.formatPrice(this.costoDeEnvio)}</div>`;
                container.appendChild(rDlv);
            }
        }

        let totalFinal = tipoEntrega === 'delivery' ? subtotal + this.costoDeEnvio : subtotal;
        document.getElementById('cart-count').textContent = count;
        document.getElementById('cart-total').textContent = `Total: ${this.formatPrice(totalFinal)}`;

        document.querySelectorAll('.qty-display').forEach(display => {
            const name = display.getAttribute('data-name');
            const variant = display.getAttribute('data-variant');
            const isDocena = name.toUpperCase().includes('DOCENA');
            const isFatay = name.toUpperCase().includes('FATAY');

            let qty = 0;
            if (isDocena && !isFatay) qty = this.cart.filter(i => i.name === name).reduce((sum, i) => sum + i.quantity, 0);
            else if (isDocena && isFatay) { let it = this.cart.find(i => i.name === name && i.isDocena); if (it) qty = it.quantity; }
            else { let it = this.cart.find(i => i.name === name && i.variant === variant && !i.isDocena); if (it) qty = it.quantity; }

            display.textContent = qty;
            display.style.color = qty > 0 ? 'var(--primary)' : '#fff';
        });
    }

    // --- DOCENAS MODAL LÓGICA (DOM Optimo) ---
    openDocenaModal(name, basePrice) {
        this.pendingDocena = { name, basePrice };
        this.docenaSelection = {}; this.docenaTotalQty = 0; this.docenaExtraPrice = 0;

        document.getElementById('docena-title').textContent = name;
        this.updateDocenaModalUI();

        let container = document.getElementById('docena-flavors-container');
        container.innerHTML = ''; // reset content

        let createGroup = (arr, title, isPremium) => {
            let hdr = document.createElement('h4');
            hdr.style = `color:${isPremium ? 'var(--accent)' : '#aaa'}; border-bottom:1px solid #333; padding-bottom:5px; margin-top:20px;`;
            hdr.textContent = title;
            container.appendChild(hdr);

            arr.forEach(emp => {
                let extra = isPremium ? Math.max(0, this.cleanPrice(emp.PRECIO_1) - this.precioBaseClasica) : 0;
                let itemNameId = emp.NOMBRE.replace(/\s+/g, '');
                
                let row = document.createElement('div'); row.style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #222;";
                let nm = document.createElement('div'); nm.style="flex:1; font-size:1.05rem;"; nm.innerHTML = `${this.sanitize(emp.NOMBRE)} ${isPremium ? `<span style="color:var(--accent); font-size:0.85rem; font-weight:bold; display:block;">(+${this.formatPrice(extra)})</span>` : ''}`;
                
                let ctrl = document.createElement('div'); ctrl.className="stepper"; ctrl.style="height:32px;";
                let btMin = document.createElement('button'); btMin.innerHTML = '<i class="fas fa-minus"></i>';
                btMin.onclick = () => this.updateDocenaFlavor(emp.NOMBRE, -1, isPremium, extra, itemNameId);
                let spQty = document.createElement('span'); spQty.id = `docena-qty-${itemNameId}`; spQty.style="width:25px; text-align:center; font-weight:bold;"; spQty.textContent = "0";
                let btPlu = document.createElement('button'); btPlu.innerHTML = '<i class="fas fa-plus"></i>';
                btPlu.onclick = () => this.updateDocenaFlavor(emp.NOMBRE, 1, isPremium, extra, itemNameId);

                ctrl.appendChild(btMin); ctrl.appendChild(spQty); ctrl.appendChild(btPlu);
                row.appendChild(nm); row.appendChild(ctrl); container.appendChild(row);
            });
        };

        createGroup(this.dbClasicas, "Clásicas", false);
        createGroup(this.dbPremium, "Premium (Con Recargo)", true);

        document.getElementById('docena-modal').style.display = 'flex';
    }

    updateDocenaFlavor(name, change, isPremium, extraCost, idDom) {
        let current = this.docenaSelection[name] || 0;
        if (change > 0 && this.docenaTotalQty >= DOCENA_SIZE) return;
        if (change < 0 && current <= 0) return;
        
        this.docenaSelection[name] = current + change;
        this.docenaTotalQty += change;
        
        document.getElementById(`docena-qty-${idDom}`).textContent = this.docenaSelection[name];
        this.updateDocenaModalUI();
    }

    updateDocenaModalUI() {
        document.getElementById('docena-count').textContent = this.docenaTotalQty;
        
        let sumExtraPremium = 0;
        let hayClasica = false;
        let minExtraPremium = Infinity;

        for (let [name, qty] of Object.entries(this.docenaSelection)) {
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

        let ajuste = (this.docenaTotalQty === DOCENA_SIZE && !hayClasica && minExtraPremium !== Infinity) ? minExtraPremium : 0;
        this.docenaExtraPrice = sumExtraPremium - ajuste;

        document.getElementById('docena-total-price').textContent = this.formatPrice(this.pendingDocena.basePrice + this.docenaExtraPrice);

        const btn = document.getElementById('btn-confirm-docena');
        if (this.docenaTotalQty === DOCENA_SIZE) {
            btn.disabled = false; btn.style.opacity = '1'; btn.style.background = '#25D366';
        } else {
            btn.disabled = true; btn.style.opacity = '0.5'; btn.style.background = 'var(--primary)';
        }
    }

    closeDocenaModal() {
        document.getElementById('docena-modal').style.display = 'none';
        this.pendingDocena = null;
    }

    confirmDocena() {
        if (this.docenaTotalQty !== DOCENA_SIZE) return;
        let flavorsArr = [];
        for (let [flavor, qty] of Object.entries(this.docenaSelection)) { if (qty > 0) flavorsArr.push(`${qty}x ${flavor}`); }
        
        let variantString = flavorsArr.join('|');
        let finalPrice = this.pendingDocena.basePrice + this.docenaExtraPrice;

        this.cart.push({ name: this.pendingDocena.name, price: finalPrice, variant: variantString, quantity: 1, isDocena: true });
        this.updateCartUI();
        const btn = document.getElementById('cart-btn'); btn.style.transform = 'scale(1.2)'; setTimeout(() => btn.style.transform = 'scale(1)', 200);
        this.closeDocenaModal();
    }

    // --- FORMULARIO Y UTILS INTERFAZ ---
    toggleCart() {
        const modal = document.getElementById('cart-modal');
        modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
    }
    toggleDeliveryFields() {
        const entrega = document.getElementById('cli-entrega').value;
        const reqFields = ['cli-direccion', 'cli-entrecalles'];
        reqFields.forEach(id => { document.getElementById(id).required = (entrega === 'delivery'); });
        document.getElementById('delivery-fields').style.display = entrega === 'delivery' ? 'flex' : 'none';
    }
    toggleHorarioFields() {
        const isProg = document.getElementById('cli-horario').value === 'Programado';
        document.getElementById('cli-horario-exacto').required = isProg;
        document.getElementById('horario-exacto-container').style.display = isProg ? 'flex' : 'none';
    }
    togglePagoFields() {
        const isEfectivo = document.getElementById('cli-pago').value === 'Efectivo';
        document.getElementById('cli-abona').required = isEfectivo;
        document.getElementById('info-transferencia').style.display = !isEfectivo ? 'block' : 'none';
        document.getElementById('efectivo-fields').style.display = isEfectivo ? 'flex' : 'none';
    }
    checkStatus() {
        const now = new Date(); const day = now.getDay(); const currentMins = now.getHours() * 60 + now.getMinutes();
        const badge = document.getElementById('status-badge');
        
        if (day === 1) { badge.innerHTML = '🔴 CERRADO (Lunes)'; badge.style.color = '#FF5252'; badge.style.borderColor = '#FF5252'; return; }
        if (currentMins >= 1140 && currentMins < 1380) { badge.innerHTML = '🟢 ABIERTO AHORA'; badge.style.color = '#4CAF50'; badge.style.borderColor = '#4CAF50'; } 
        else { badge.innerHTML = '🔴 CERRADO - Abre 19:00hs'; badge.style.color = '#FF5252'; badge.style.borderColor = '#FF5252'; }
    }

    // --- ENVÍO DE PEDIDO (Solución Race Condition Fetch+WhatsApp) ---
    async enviarPedido() {
        const btnSubmit = document.getElementById('btn-submit-order');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando Pedido...';

        const nombre = document.getElementById('cli-nombre').value.trim();
        const telefono = document.getElementById('cli-telefono').value.trim();
        const entrega = document.getElementById('cli-entrega').value;
        const direccion = document.getElementById('cli-direccion').value.trim();
        const entreCalles = document.getElementById('cli-entrecalles').value.trim();
        const depto = document.getElementById('cli-depto').value.trim();
        const tipoHorario = document.getElementById('cli-horario').value;
        const horaExacta = document.getElementById('cli-horario-exacto').value;
        const pago = document.getElementById('cli-pago').value;
        const abona = document.getElementById('cli-abona').value.trim();
        const notas = document.getElementById('cli-notas').value.trim();

        const fechaActual = new Date().toLocaleDateString('es-AR');
        const horaActual = new Date().toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'});
        let direccionFinal = entrega === 'delivery' ? `${direccion} (e/ ${entreCalles}) ${depto ? 'Depto: '+depto : ''}` : 'Retira por el local';
        
        let texto = `*NUEVO PEDIDO*\n\n*CLIENTE:* ${nombre}\n*TELÉFONO:* ${telefono}\n\n`;
        
        if(entrega === 'delivery') {
            texto += `*TIPO DE ENTREGA:* Delivery\n*DIRECCIÓN:* ${direccion}\n*ENTRE CALLES:* ${entreCalles}\n`;
            if(depto) texto += `*DEPTO/PISO:* ${depto}\n\n`; else texto += `\n`;
        } else { texto += `*TIPO DE ENTREGA:* Retira por el local\n\n`; }
        
        texto += `*HORARIO:* ${tipoHorario === 'Lo antes posible' ? 'Lo antes posible' : `${horaExacta} hs`}\n`;
        texto += (pago === 'Efectivo') ? `*PAGO:* Efectivo (Abona con $${abona})\n` : `*PAGO:* Transferencia\n`;
        if(notas) texto += `*ACLARACIONES:* ${notas}\n`;
        texto += `\n*DETALLE DEL PEDIDO:*\n`;

        let subtotal = 0; let detalleParaExcel = [];

        this.cart.forEach(item => {
            let cleanName = this.cleanEmojis(item.name).replace(/\s{2,}/g, ' ').trim();
            let cleanVariant = item.variant ? this.cleanEmojis(item.variant).replace(/\s{2,}/g, ' ').trim() : '';
            let varianteFormat = '';
            
            if (item.isDocena && cleanVariant) {
                let flavorsArray = cleanVariant.split('|');
                varianteFormat = '\n   - ' + flavorsArray.join('\n   - ');
            } else if (!item.isDocena && cleanVariant) varianteFormat = ` (${cleanVariant})`;
            
            let totalItem = item.price * item.quantity;
            subtotal += totalItem;
            
            if (item.isDocena) {
                texto += `${item.quantity}x ${cleanName} - ${this.formatPrice(totalItem)}${varianteFormat}\n`;
                detalleParaExcel.push(`${item.quantity}x ${cleanName} [${cleanVariant.replace(/\|/g, ', ')}]`);
            } else {
                texto += `${item.quantity}x ${cleanName}${varianteFormat} - ${this.formatPrice(totalItem)}\n`;
                detalleParaExcel.push(`${item.quantity}x ${cleanName}${cleanVariant ? ' ('+cleanVariant+')' : ''}`);
            }
        });

        if (entrega === 'delivery' && this.costoDeEnvio > 0) texto += `Costo de Envío - ${this.formatPrice(this.costoDeEnvio)}\n`;

        let totalFinal = entrega === 'delivery' ? subtotal + this.costoDeEnvio : subtotal;
        texto += `\n*TOTAL A ABONAR: ${this.formatPrice(totalFinal)}*\n\n`;
        if(pago === 'Transferencia') texto += `*NOTA:* Te adjunto el comprobante de transferencia al alias: ${this.aliasTransferencia}\n`;

        // Preparar el carrito para el Excel, desglosando las Promos de Pizzas en items individuales
        let carritoModificado = [];
        this.cart.forEach(item => {
            let clone = { ...item };
            let menuItem = (this.menuItems || []).find(m => m.NOMBRE === item.name);
            
            if (menuItem && this.normalize(menuItem.SECCION).includes('EXTRA')) clone.categoria = "Extra";
            
            // Si es una Promo, primero la mandamos tal cual para sumar ventas de esa "Promo X"
            carritoModificado.push(clone);

            // Y además desglosamos sus pizzas para el control de stock / sabores más pedidos
            if (menuItem && this.normalize(menuItem.SECCION) === 'PROMOCIONES' && !item.isDocena) {
                if (menuItem.DESCRIPCION) {
                    // Dividir "1 Muzzarella + 1 Especial" -> ["1 ", "Muzzarella", "1 ", "Especial"]
                    let parts = menuItem.DESCRIPCION.split('+');
                    parts.forEach(part => {
                        part = part.replace('★', '').trim();
                        let subQtyMatch = part.match(/^\d+/);
                        let subQty = subQtyMatch ? parseInt(subQtyMatch[0]) : 1;
                        let subName = part.replace(/^\d+/, '').trim();
                        
                        carritoModificado.push({
                            name: subName,
                            price: 0,
                            variant: "Para Hornear",
                            quantity: item.quantity * subQty,
                            isDocena: false,
                            categoria: "Pizza (De Promo)"
                        });
                    });
                }
            }
        });

        let payload = {
            fecha: fechaActual, hora: horaActual,
            cliente: nombre, telefono: telefono,
            tipoEntrega: entrega === 'delivery' ? 'Delivery' : 'Retiro',
            direccion: direccionFinal,
            pago: pago, total: totalFinal,
            envio: entrega === 'delivery' ? this.costoDeEnvio : 0,
            detalleResumen: detalleParaExcel.join(' + '),
            carrito: carritoModificado 
        };

        // Fire-and-forget con keepalive: asegura envío en 2do plano sin freezar la pantalla
        try {
            fetch(CONST_URL_REGISTRO, { 
                method: 'POST', 
                mode: 'no-cors', 
                keepalive: true, 
                headers: { 'Content-Type': 'text/plain' }, 
                body: JSON.stringify(payload) 
            });
        } catch(e) {
            console.error("Fallo menor de registro en sheet. Continuará el redirect.", e);
        }

        // Abre WhatsApp casi al instante
        setTimeout(() => {
            const urlWhatsApp = `https://api.whatsapp.com/send?phone=${CONST_WHATSAPP_NUMBER}&text=${encodeURIComponent(texto)}`;
            window.location.href = urlWhatsApp; 
            
            // Revert changes on the button 
            btnSubmit.innerHTML = '<i class="fab fa-whatsapp"></i> Enviado con Éxito';
            setTimeout(() => { btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="fab fa-whatsapp"></i> Enviar Pedido por WhatsApp'; }, 3000);
        }, 150);
    }
}

// Bootstrap
document.addEventListener("DOMContentLoaded", () => {
    window.AppPublica = new PizzeriaApp();
});
