// CONFIGURACIÓN API
// Cambiar a la URL de tu servidor en producción (ej. 'https://tudominio.com/backend/')
const API_URL = 'backend/';

// FUNCIONES DE PETICIÓN (AJAX con Fetch API)
const api = {
    async get(endpoint) {
        try {
            const res = await fetch(API_URL + endpoint);
            return await res.json();
        } catch (e) {
            console.error('Error GET:', e);
            return null;
        }
    },
    async post(endpoint, data) {
        try {
            const res = await fetch(API_URL + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await res.json();
        } catch (e) {
            console.error('Error POST:', e);
            return null;
        }
    },
    async put(endpoint, data) {
        try {
            const res = await fetch(API_URL + endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await res.json();
        } catch (e) {
            console.error('Error PUT:', e);
            return null;
        }
    },
    async delete(endpoint, id) {
        try {
            const res = await fetch(API_URL + endpoint, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            return await res.json();
        } catch (e) {
            console.error('Error DELETE:', e);
            return null;
        }
    }
};

// ESTADO GLOBAL CACHEADO (para no consultar DB constantemente al crear órdenes)
let cache = {
    products: [],
    providers: [],
    lists: {}
};

async function loadCache() {
    cache.products = await api.get('products.php') || [];
    cache.providers = await api.get('providers.php') || [];
    cache.lists = await api.get('lists.php') || {};
    
    // Sort products and providers alphabetically
    cache.products.sort((a, b) => a.name.localeCompare(b.name));
    cache.providers.sort((a, b) => a.name.localeCompare(b.name));
}

// AUTENTICACIÓN Y ROLES (Real con PHP Backend)
const auth = {
    async login() {
        const u = document.getElementById('login-user').value;
        const p = document.getElementById('login-pass').value;
        const err = document.getElementById('login-error');
        
        err.innerText = "Cargando...";
        const res = await api.post('login.php', { username: u, password: p });
        
        if (res && res.success) {
            localStorage.setItem('loggedUser', JSON.stringify({ username: res.user.username, role: res.user.role, name: res.user.name, id: res.user.id }));
            this.checkAuth();
        } else {
            err.innerText = res?.message || "Error al conectar con el servidor.";
        }
    },

    logout() {
        localStorage.removeItem('loggedUser');
        this.checkAuth();
    },

    async checkAuth() {
        const user = JSON.parse(localStorage.getItem('loggedUser'));
        if (user) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'block';
            document.getElementById('current-user-display').innerText = `Hola, ${user.name}`;
            
            // Mostrar/ocultar tab de configuración según el rol
            const configTab = document.getElementById('tab-btn-config');
            if (configTab) {
                configTab.style.display = user.role === 'admin' ? 'block' : 'none';
            }
            
            await loadCache();
            ui.loadProductsSelect();
            ui.loadProviders();
            ui.openTab('pedidos');
        } else {
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('app-container').style.display = 'none';
        }
    },
    
    getCurrentUser() {
        return JSON.parse(localStorage.getItem('loggedUser')) || { name: 'Desconocido' };
    }
};

// UTILIDADES PARA CRUD
const generateId = () => Date.now().toString();

// ESTADO DE LA APLICACIÓN
let currentOrder = [];
let editingOrderId = null;

// MÓDULO DE LÓGICA DE ÓRDENES
const orderManager = {
    addItem() {
        const pId = document.getElementById('product-select').value;
        const qty = document.getElementById('quantity').value;
        const products = cache.products;
        
        if (pId !== "" && qty > 0) {
            const product = products.find(p => p.id == pId); 
            if (product) {
                currentOrder.push({ ...product, qty: parseFloat(qty) });
                this.render();
                document.getElementById('quantity').value = "";
            }
        }
    },

    updateQty(index, newQty) {
        if (newQty > 0) {
            currentOrder[index].qty = parseFloat(newQty);
        }
    },

    removeItem(index) {
        currentOrder.splice(index, 1);
        this.render();
    },

    render() {
        const list = document.getElementById('order-list');
        list.innerHTML = currentOrder.map((item, idx) => `
            <li class="order-item">
                <span>${item.name} (${item.unit})</span>
                <input type="number" class="qty-edit" value="${item.qty}" 
                       onchange="orderManager.updateQty(${idx}, this.value)">
                <button class="btn-remove" onclick="orderManager.removeItem(${idx})">✕</button>
            </li>
        `).join('');
    },

    async sendOrder() {
        const phone = document.getElementById('provider-phone').value.replace(/\s+/g, '');
        const name = document.getElementById('provider-name').value || "Proveedor";
        const msgIntro = "Buenos días, le envío la orden de compra de El Criollo, ¡muchas gracias!";
        const msgOutro = "Quedo a la espera de confirmación. Saludos cordiales.";

        if (!phone || currentOrder.length === 0) return alert("Falta el teléfono o productos.");

        await this.saveProvider(name, phone);

        let fullMsg = `${msgIntro}\n\n`;
        currentOrder.forEach(i => fullMsg += `• ${i.name}: ${i.qty} ${i.unit}\n`);
        fullMsg += `\n${msgOutro}`;

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(fullMsg)}`, '_blank');

        await this.saveToHistory(name);
        
        // Limpiar
        currentOrder = [];
        this.render();
    },

    async updateOrder() {
        if (!editingOrderId) return;
        const name = document.getElementById('provider-name').value || "Proveedor";
        if (currentOrder.length === 0) return alert("Falta seleccionar productos.");

        const payload = {
            id: editingOrderId,
            provider: name,
            items: currentOrder.map(i => ({ name: i.name, qty: i.qty, unit: i.unit }))
        };

        await api.put('orders.php', payload);
        alert('Orden actualizada correctamente en la base de datos.');
        
        this.cancelEdit();
        ui.renderHistory();
    },

    cancelEdit() {
        editingOrderId = null;
        currentOrder = [];
        document.getElementById('send-whatsapp').style.display = 'block';
        document.getElementById('btn-update-order').style.display = 'none';
        document.getElementById('btn-cancel-edit').style.display = 'none';
        
        // Reset dropdown
        document.getElementById('provider-select').value = 'new';
        ui.handleProviderChange();
        this.render();
    },

    async saveToHistory(provider) {
        const user = auth.getCurrentUser();
        const orderData = {
            provider: provider,
            user: user.name,
            items: currentOrder.map(i => ({ name: i.name, qty: i.qty, unit: i.unit }))
        };
        await api.post('orders.php', orderData);
    },

    async saveProvider(name, phone) {
        if (!cache.providers.find(p => p.phone === phone)) {
            await api.post('providers.php', { name, phone });
            await loadCache(); 
            ui.loadProviders(); 
        }
    }
};

// MÓDULO DE INTERFAZ DE USUARIO (UI)
const ui = {
    openTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        
        const btn = document.querySelector(`.tab-btn[onclick="ui.openTab('${tabId}')"]`);
        if (btn) btn.classList.add('active');
        
        if (tabId === 'historial') this.renderHistory();
    },

    loadProductsSelect(providerId = null) {
        const pSelect = document.getElementById('product-select');
        pSelect.innerHTML = '<option value="" disabled selected>Seleccionar Producto...</option>';
        
        let filteredProducts = cache.products;
        if (providerId && providerId !== 'new') {
            // Un producto ahora puede tener múltiples proveedores, verificamos si está en el array de ids
            filteredProducts = cache.products.filter(p => {
                if (p.provider_ids_array && p.provider_ids_array.includes(providerId.toString())) {
                    return true;
                }
                // Fallback de compatibilidad
                return p.provider_id == providerId;
            });
        }

        filteredProducts.forEach(p => {
            pSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
        
        if (this._tomProduct) this._tomProduct.destroy();
        this._tomProduct = new TomSelect("#product-select", {
            create: false,
            sortField: { field: "text", direction: "asc" }
        });
    },

    loadProviders() {
        const sel = document.getElementById('provider-select');
        const providers = cache.providers;
        sel.innerHTML = '<option value="new">-- Nuevo Proveedor --</option>';
        providers.forEach((p) => {
            sel.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
        
        if (this._tomProvider) this._tomProvider.destroy();
        this._tomProvider = new TomSelect("#provider-select", {
            create: false,
            sortField: { field: "text", direction: "asc" }
        });
    },

    handleProviderChange() {
        const sel = document.getElementById('provider-select');
        const providers = cache.providers;
        const fields = document.getElementById('new-provider-fields');
        
        if (sel.value === 'new') {
            fields.style.display = 'block';
            document.getElementById('provider-name').value = "";
            document.getElementById('provider-phone').value = "";
            this.loadProductsSelect(null);
        } else {
            fields.style.display = 'none';
            const p = providers.find(prov => prov.id == sel.value);
            if(p) {
                document.getElementById('provider-name').value = p.name;
                document.getElementById('provider-phone').value = p.phone;
                this.loadProductsSelect(p.id);
            }
        }
    },

    async renderHistory() {
        const body = document.getElementById('history-body');
        body.innerHTML = '<tr><td colspan="7">Cargando...</td></tr>';
        
        const user = auth.getCurrentUser();
        const history = await api.get(`orders.php?role=${encodeURIComponent(user.role)}&user=${encodeURIComponent(user.name)}`) || [];
        
        window._currentHistory = history; 
        
        const filterUser = document.getElementById('filter-user');
        if (filterUser) {
            filterUser.style.display = user.role === 'admin' ? 'block' : 'none';
        }
        
        this.renderHistoryTable(history);
    },

    renderHistoryTable(historyArray) {
        const body = document.getElementById('history-body');
        
        if (historyArray.length === 0) {
            body.innerHTML = '<tr><td colspan="7">No hay pedidos registrados</td></tr>';
            return;
        }

        body.innerHTML = historyArray.map((o) => {
            const originalIdx = window._currentHistory.findIndex(h => h.id === o.id);
            const user = auth.getCurrentUser();
            let adminActions = '';
            
            if (user.role === 'admin') {
                adminActions = `
                    <button class="btn-icon icon-edit" title="Editar" onclick="ui.editOrder(${originalIdx})"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon icon-delete" title="Eliminar" onclick="ui.deleteOrder(${o.id})"><i class="fas fa-trash"></i></button>
                `;
            }

            return `
                <tr>
                    <td class="check-col"><input type="checkbox" class="history-check" value="${o.id}" onchange="ui.toggleBulkBtn('history')"></td>
                    <td onclick="ui.showDetail(${originalIdx})" style="cursor:pointer"><strong>${o.ref}</strong></td>
                    <td onclick="ui.showDetail(${originalIdx})" style="cursor:pointer">${o.date.split(' ')[0]}</td>
                    <td onclick="ui.showDetail(${originalIdx})" style="cursor:pointer">${o.provider}</td>
                    <td class="text-truncate">${o.items.map(i => i.name).join(', ')}</td>
                    <td style="white-space: nowrap;">
                        <button class="btn-icon icon-copy" title="Reutilizar" onclick="ui.duplicate(${originalIdx})"><i class="fas fa-redo"></i></button>
                        ${adminActions}
                    </td>
                    <td>${o.user || 'N/A'}</td>
                </tr>
            `;
        }).join('');
    },

    toggleSelectAll(sourceCheckbox, targetClass) {
        const checkboxes = document.querySelectorAll(`.${targetClass}`);
        checkboxes.forEach(cb => cb.checked = sourceCheckbox.checked);
        
        let type = '';
        if (targetClass === 'history-check') type = 'history';
        if (targetClass === 'prov-check') type = 'providers';
        if (targetClass === 'prod-check') type = 'products';
        
        this.toggleBulkBtn(type);
    },

    toggleBulkBtn(type) {
        let btnId = '';
        let cbClass = '';
        
        if (type === 'history') { btnId = 'btn-bulk-delete-history'; cbClass = 'history-check'; }
        if (type === 'providers') { btnId = 'btn-bulk-delete-prov'; cbClass = 'prov-check'; }
        if (type === 'products') { btnId = 'btn-bulk-delete-prod'; cbClass = 'prod-check'; }

        const checkedCount = document.querySelectorAll(`.${cbClass}:checked`).length;
        document.getElementById(btnId).style.display = checkedCount > 0 ? 'block' : 'none';
    },

    async bulkDelete(type) {
        let cbClass = '';
        let endpoint = '';
        
        if (type === 'history') { cbClass = 'history-check'; endpoint = 'orders.php'; }
        if (type === 'providers') { cbClass = 'prov-check'; endpoint = 'providers.php'; }
        if (type === 'products') { cbClass = 'prod-check'; endpoint = 'products.php'; }

        const checkedBoxes = document.querySelectorAll(`.${cbClass}:checked`);
        const ids = Array.from(checkedBoxes).map(cb => cb.value);

        if (ids.length === 0) return;

        if (confirm(`¿Seguro que deseas eliminar los ${ids.length} elementos seleccionados?`)) {
            // Eliminar secuencialmente (o en batch si el backend lo soporta, por ahora secuencial por compatibilidad)
            for (const id of ids) {
                await api.delete(endpoint, id);
            }
            
            if (type === 'history') this.renderHistory();
            if (type === 'providers') {
                await loadCache();
                await this.renderAdminProviders();
                this.loadProviders();
            }
            if (type === 'products') {
                await loadCache();
                await this.renderAdminProducts();
                this.loadProductsSelect();
            }
            
            this.toggleBulkBtn(type);
            const theadCb = document.querySelector(`th input[type="checkbox"]`);
            if (theadCb) theadCb.checked = false;
        }
    },

    async deleteOrder(id) {
        if(confirm("¿Seguro que deseas eliminar esta orden del historial por completo?")) {
            await api.delete('orders.php', id);
            this.renderHistory();
        }
    },

    editOrder(idx) {
        const history = window._currentHistory;
        if(!history || !history[idx]) return;
        
        const o = history[idx];
        editingOrderId = o.id;
        
        currentOrder = JSON.parse(JSON.stringify(o.items)); 
        
        const pSelect = document.getElementById('provider-select');
        let optionExists = false;
        Array.from(pSelect.options).forEach(opt => {
            if(opt.text === o.provider) {
                pSelect.value = opt.value;
                optionExists = true;
            }
        });

        if (!optionExists) {
            pSelect.value = 'new';
            document.getElementById('provider-name').value = o.provider;
            document.getElementById('new-provider-fields').style.display = 'block';
        } else {
            this.handleProviderChange();
        }

        document.getElementById('send-whatsapp').style.display = 'none';
        document.getElementById('btn-update-order').style.display = 'block';
        document.getElementById('btn-cancel-edit').style.display = 'block';

        this.openTab('pedidos');
        orderManager.render();
    },

    filterHistory() {
        const ref = document.getElementById('filter-ref').value.toLowerCase();
        const prov = document.getElementById('filter-provider').value.toLowerCase();
        const userFilter = document.getElementById('filter-user').value.toLowerCase();
        const dateStart = document.getElementById('filter-date-start').value;
        const dateEnd = document.getElementById('filter-date-end').value;

        const history = window._currentHistory || [];
        const filtered = history.filter(o => {
            const matchRef = o.ref.toLowerCase().includes(ref);
            const matchProv = o.provider.toLowerCase().includes(prov);
            const matchUser = o.user.toLowerCase().includes(userFilter);
            
            let matchDate = true;
            const orderDate = o.date.split(' ')[0]; // YYYY-MM-DD
            
            if (dateStart && orderDate < dateStart) matchDate = false;
            if (dateEnd && orderDate > dateEnd) matchDate = false;
            
            return matchRef && matchProv && matchUser && matchDate;
        });

        this.renderHistoryTable(filtered);
    },

    clearHistoryFilters() {
        document.getElementById('filter-ref').value = '';
        document.getElementById('filter-provider').value = '';
        document.getElementById('filter-user').value = '';
        document.getElementById('filter-date-start').value = '';
        document.getElementById('filter-date-end').value = '';
        this.renderHistoryTable(window._currentHistory || []);
    },

    sortHistory(column) {
        if (!window._currentHistory) return;
        
        if (this._lastSortCol === column) {
            this._sortAsc = !this._sortAsc;
        } else {
            this._lastSortCol = column;
            this._sortAsc = true;
        }

        window._currentHistory.sort((a, b) => {
            let valA = a[column] ? a[column].toString().toLowerCase() : '';
            let valB = b[column] ? b[column].toString().toLowerCase() : '';
            
            if (column === 'date') {
                valA = new Date(a[column]).getTime();
                valB = new Date(b[column]).getTime();
            }

            if (valA < valB) return this._sortAsc ? -1 : 1;
            if (valA > valB) return this._sortAsc ? 1 : -1;
            return 0;
        });

        this.filterHistory();
    },

    showDetail(idx) {
        const history = window._currentHistory;
        if(!history || !history[idx]) return;
        const o = history[idx];
        document.getElementById('modal-title').innerText = `${o.ref} - ${o.provider}`;
        document.getElementById('modal-items').innerHTML = o.items.map(i => `<p>• ${i.name}: ${i.qty} ${i.unit}</p>`).join('');
        document.getElementById('modal-detalle').style.display = 'block';
    },

    closeModal(modalId) { 
        document.getElementById(modalId).style.display = 'none'; 
    },

    toggleCsv(type) {
        const exp = document.getElementById('export-options');
        const imp = document.getElementById('import-options');
        if (type === 'export') {
            exp.style.display = exp.style.display === 'none' ? 'flex' : 'none';
            imp.style.display = 'none';
        } else if (type === 'import') {
            imp.style.display = imp.style.display === 'none' ? 'flex' : 'none';
            exp.style.display = 'none';
        }
    },

    duplicate(idx) {
        const history = window._currentHistory;
        if(!history || !history[idx]) return;
        currentOrder = JSON.parse(JSON.stringify(history[idx].items)); 
        this.openTab('pedidos');
        orderManager.render();
    },

    duplicateProduct(id) {
        const p = cache.products.find(x => x.id == id);
        if(!p) return;
        document.getElementById('admin-prod-id').value = ''; // Empty ID means create new
        document.getElementById('admin-prod-name').value = p.name + ' (Copia)';
        
        if(this._tomAdminProdProvider) {
            this._tomAdminProdProvider.setValue(p.provider_ids_array || (p.provider_id ? [p.provider_id] : []));
        } else {
            document.getElementById('admin-prod-provider').value = p.provider_id || '';
        }

        document.getElementById('admin-prod-family').value = p.family || '';
        document.getElementById('admin-prod-category').value = p.category || '';
        document.getElementById('admin-prod-subcategory').value = p.subcategory || '';
        document.getElementById('admin-prod-unit').value = p.unit || '';
        document.getElementById('admin-prod-price').value = p.price || '';
        
        alert("Producto copiado. Puedes editar los detalles y presionar Guardar para crear el nuevo registro.");
    },

    populateSelect(selectId, dbListType, placeholder) {
        const select = document.getElementById(selectId);
        const data = cache.lists[dbListType] || [];
        
        let html = `<option value="">${placeholder}</option>`;
        html += data.map(item => `<option value="${item.name}">${item.name}</option>`).join('');
        html += `<option value="__new__">+ Crear nuevo...</option>`;
        select.innerHTML = html;
        
        select.onchange = (e) => this.handleNewOption(e.target, dbListType);
    },

    async handleNewOption(selectElement, dbListType) {
        if (selectElement.value === '__new__') {
            const newItemName = prompt("Ingrese el nombre del nuevo elemento:");
            if (newItemName && newItemName.trim() !== '') {
                const newValue = newItemName.trim();
                
                await api.post('lists.php', { list_type: dbListType, value: newValue });
                await loadCache();
                
                const placeholder = selectElement.options[0].text;
                this.populateSelect(selectElement.id, dbListType, placeholder);
                selectElement.value = newValue;
            } else {
                selectElement.value = "";
            }
        }
    },

    async openProviderManager() {
        document.getElementById('modal-proveedores').style.display = 'block';
        this.populateSelect('admin-prov-family', 'families', 'Familia Asociada...');
        this.populateSelect('admin-prov-payment', 'payment_methods', 'Forma de Pago...');
        await this.renderAdminProviders();
    },

    async renderAdminProviders() {
        cache.providers = await api.get('providers.php') || [];
        const providers = cache.providers;
        const tbody = document.getElementById('admin-prov-list');
        tbody.innerHTML = providers.map((p, idx) => `
            <tr>
                <td class="check-col"><input type="checkbox" class="prov-check" value="${p.id}" onchange="ui.toggleBulkBtn('providers')"></td>
                <td>${p.name}</td>
                <td>${p.phone}</td>
                <td>${p.city || '-'}</td>
                <td>${p.family || '-'}</td>
                <td style="white-space: nowrap;">
                    <button class="btn-icon icon-edit" title="Editar" onclick="ui.editAdminProvider(${p.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon icon-delete" title="Eliminar" onclick="ui.removeAdminProvider(${p.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    },

    async saveAdminProvider() {
        const id = document.getElementById('admin-prov-id').value;
        const name = document.getElementById('admin-prov-name').value;
        const phone = document.getElementById('admin-prov-phone').value;
        const email = document.getElementById('admin-prov-email').value;
        const cif = document.getElementById('admin-prov-cif').value;
        const address = document.getElementById('admin-prov-address').value;
        const city = document.getElementById('admin-prov-city').value;
        const contact = document.getElementById('admin-prov-contact').value;
        const family = document.getElementById('admin-prov-family').value;
        const payment = document.getElementById('admin-prov-payment').value;

        if(!name || !phone) return alert("Nombre y Teléfono son obligatorios");

        const payload = { name, phone, email, cif, address, city, contact, family, payment };
        
        if(id) {
            payload.id = id;
            await api.put('providers.php', payload);
        } else {
            await api.post('providers.php', payload);
        }
        
        this.clearForm('prov');
        await this.renderAdminProviders();
        await loadCache();
        this.loadProviders();
    },

    editAdminProvider(id) {
        const providers = cache.providers;
        const p = providers.find(x => x.id == id);
        if(!p) return;
        document.getElementById('admin-prov-id').value = p.id;
        document.getElementById('admin-prov-name').value = p.name;
        document.getElementById('admin-prov-phone').value = p.phone;
        document.getElementById('admin-prov-email').value = p.email || '';
        document.getElementById('admin-prov-cif').value = p.cif || '';
        document.getElementById('admin-prov-address').value = p.address || '';
        document.getElementById('admin-prov-city').value = p.city || '';
        document.getElementById('admin-prov-contact').value = p.contact || '';
        document.getElementById('admin-prov-family').value = p.family || '';
        document.getElementById('admin-prov-payment').value = p.payment || '';
    },

    async removeAdminProvider(id) {
        if(confirm("¿Seguro que deseas eliminar este proveedor?")) {
            await api.delete('providers.php', id);
            await this.renderAdminProviders();
            await loadCache();
            this.loadProviders();
        }
    },

    clearForm(type) {
        if(type === 'prov') {
            document.getElementById('admin-prov-id').value = '';
            document.getElementById('admin-prov-name').value = '';
            document.getElementById('admin-prov-phone').value = '';
            document.getElementById('admin-prov-email').value = '';
            document.getElementById('admin-prov-cif').value = '';
            document.getElementById('admin-prov-address').value = '';
            document.getElementById('admin-prov-city').value = '';
            document.getElementById('admin-prov-contact').value = '';
            document.getElementById('admin-prov-family').value = '';
            document.getElementById('admin-prov-payment').value = '';
        } else if(type === 'prod') {
            document.getElementById('admin-prod-id').value = '';
            document.getElementById('admin-prod-name').value = '';
            if(this._tomAdminProdProvider) {
                this._tomAdminProdProvider.clear();
            } else {
                document.getElementById('admin-prod-provider').value = '';
            }
            document.getElementById('admin-prod-family').value = '';
            document.getElementById('admin-prod-category').value = '';
            document.getElementById('admin-prod-subcategory').value = '';
            document.getElementById('admin-prod-unit').value = '';
            document.getElementById('admin-prod-price').value = '';
        } else if(type === 'user') {
            document.getElementById('admin-user-id').value = '';
            document.getElementById('admin-user-fullname').value = '';
            document.getElementById('admin-user-name').value = '';
            document.getElementById('admin-user-pass').value = '';
            document.getElementById('admin-user-role').value = 'user';
        }
    },

    // --- CRUD USUARIOS ---
    async openUserManager() {
        document.getElementById('modal-usuarios').style.display = 'block';
        await this.renderAdminUsers();
    },
    async renderAdminUsers() {
        const users = await api.get('users.php') || [];
        window._currentUsers = users; 
        const tbody = document.getElementById('admin-user-list');
        tbody.innerHTML = users.map((u) => `
            <tr>
                <td>${u.name}</td><td>${u.username}</td><td>${u.role}</td>
                <td>
                    <button class="btn-icon icon-edit" title="Editar" onclick="ui.editAdminUser(${u.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon icon-delete" title="Eliminar" onclick="ui.removeAdminUser(${u.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    },
    async saveAdminUser() {
        const id = document.getElementById('admin-user-id').value;
        const name = document.getElementById('admin-user-fullname').value;
        const username = document.getElementById('admin-user-name').value;
        const password = document.getElementById('admin-user-pass').value;
        const role = document.getElementById('admin-user-role').value;

        if(!name || !username || (!id && !password)) return alert("Faltan datos (Nombre, Usuario y Contraseña son obligatorios al crear)");

        const payload = { name, username, password, role };
        
        if(id) {
            payload.id = id;
            await api.put('users.php', payload);
        } else {
            await api.post('users.php', payload);
        }
        
        this.clearForm('user');
        await this.renderAdminUsers();
    },
    editAdminUser(id) {
        const users = window._currentUsers || [];
        const u = users.find(x => x.id == id);
        if(!u) return;
        document.getElementById('admin-user-id').value = u.id;
        document.getElementById('admin-user-fullname').value = u.name;
        document.getElementById('admin-user-name').value = u.username;
        document.getElementById('admin-user-pass').value = ''; 
        document.getElementById('admin-user-role').value = u.role;
    },
    async removeAdminUser(id) {
        if(confirm("¿Eliminar usuario?")) {
            await api.delete('users.php', id);
            await this.renderAdminUsers();
        }
    },

    // --- CRUD PRODUCTOS ---
    async openProductManager() {
        document.getElementById('modal-productos').style.display = 'block';
        
        this.populateSelect('admin-prod-family', 'families', 'Familia');
        this.populateSelect('admin-prod-category', 'categories', 'Categoría');
        this.populateSelect('admin-prod-subcategory', 'subcategories', 'Subcategoría');
        this.populateSelect('admin-prod-unit', 'units', 'Ud. Medida');
        
        const providers = cache.providers;
        const selectProv = document.getElementById('admin-prod-provider');
        selectProv.innerHTML = providers.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

        if(!this._tomAdminProdProvider) {
            this._tomAdminProdProvider = new TomSelect("#admin-prod-provider", {
                plugins: ['remove_button'],
                maxItems: null,
                placeholder: "Seleccione Proveedores...",
                sortField: { field: "text", direction: "asc" }
            });
        } else {
            this._tomAdminProdProvider.sync();
        }

        await this.renderAdminProducts();
    },
    async renderAdminProducts() {
        cache.products = await api.get('products.php') || [];
        const products = cache.products;
        const tbody = document.getElementById('admin-prod-list');
        tbody.innerHTML = products.map((p) => {
            return `
            <tr>
                <td class="check-col"><input type="checkbox" class="prod-check" value="${p.id}" onchange="ui.toggleBulkBtn('products')"></td>
                <td>${p.name}</td><td>${p.provider_name || '-'}</td><td>${p.family || '-'}</td>
                <td>${p.unit}</td><td>$${p.price || 0}</td>
                <td style="white-space: nowrap;">
                    <button class="btn-icon icon-copy" title="Duplicar" onclick="ui.duplicateProduct(${p.id})"><i class="fas fa-copy"></i></button>
                    <button class="btn-icon icon-edit" title="Editar" onclick="ui.editAdminProduct(${p.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon icon-delete" title="Eliminar" onclick="ui.removeAdminProduct(${p.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `}).join('');
    },
    async saveAdminProduct() {
        const id = document.getElementById('admin-prod-id').value;
        const name = document.getElementById('admin-prod-name').value;

        let provider_ids = [];
        if(this._tomAdminProdProvider) {
            provider_ids = this._tomAdminProdProvider.getValue();
        } else {
            const sel = document.getElementById('admin-prod-provider');
            provider_ids = Array.from(sel.selectedOptions).map(opt => opt.value);
        }

        const family = document.getElementById('admin-prod-family').value;
        const category = document.getElementById('admin-prod-category').value;
        const subcategory = document.getElementById('admin-prod-subcategory').value;
        const unit = document.getElementById('admin-prod-unit').value;
        const price = document.getElementById('admin-prod-price').value;

        if(!name || !unit) return alert("Nombre y Unidad son obligatorios");

        const payload = { name, provider_ids, family, category, subcategory, unit, price };

        if(id) {
            payload.id = id;
            await api.put('products.php', payload);
        } else {
            await api.post('products.php', payload);
        }
        
        this.clearForm('prod');
        await this.renderAdminProducts();
        await loadCache();
        this.loadProductsSelect();
    },
    editAdminProduct(id) {
        const products = cache.products;
        const p = products.find(x => x.id == id);
        if(!p) return;
        document.getElementById('admin-prod-id').value = p.id;
        document.getElementById('admin-prod-name').value = p.name;
        
        if(this._tomAdminProdProvider) {
            this._tomAdminProdProvider.setValue(p.provider_ids_array || (p.provider_id ? [p.provider_id] : []));
        } else {
            document.getElementById('admin-prod-provider').value = p.provider_id || '';
        }
        
        document.getElementById('admin-prod-family').value = p.family || '';
        document.getElementById('admin-prod-category').value = p.category || '';
        document.getElementById('admin-prod-subcategory').value = p.subcategory || '';
        document.getElementById('admin-prod-unit').value = p.unit || '';
        document.getElementById('admin-prod-price').value = p.price || '';
    },
    async removeAdminProduct(id) {
        if(confirm("¿Eliminar producto?")) {
            await api.delete('products.php', id);
            await this.renderAdminProducts();
            await loadCache();
            this.loadProductsSelect();
        }
    },

    // --- CRUD LISTAS DINÁMICAS ---
    async openPaymentManager() {
        document.getElementById('modal-pagos').style.display = 'block';
        document.getElementById('admin-pay-id').value = '';
        document.getElementById('admin-pay-name').value = '';
        await this.renderAdminPayments();
    },
    async renderAdminPayments() {
        await loadCache(); 
        const type = document.getElementById('admin-list-type').value;
        const listItems = cache.lists[type] || [];
        const tbody = document.getElementById('admin-pay-list');
        
        tbody.innerHTML = listItems.map((p) => `
            <tr>
                <td>${p.name}</td>
                <td style="white-space: nowrap; width: 100px;">
                    <button class="btn-icon icon-edit" title="Editar" onclick="ui.editAdminPayment(${p.id}, '${p.name}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon icon-delete" title="Eliminar" onclick="ui.removeAdminPayment(${p.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    },
    async saveAdminPayment() {
        const id = document.getElementById('admin-pay-id').value;
        const name = document.getElementById('admin-pay-name').value;
        const type = document.getElementById('admin-list-type').value;
        if(!name) return;

        if (id) {
            await api.put('lists.php', { id, list_type: type, value: name });
        } else {
            await api.post('lists.php', { list_type: type, value: name });
        }

        document.getElementById('admin-pay-id').value = '';
        document.getElementById('admin-pay-name').value = '';
        await this.renderAdminPayments();
    },
    editAdminPayment(id, name) {
        document.getElementById('admin-pay-id').value = id;
        document.getElementById('admin-pay-name').value = name;
    },
    async removeAdminPayment(id) {
        if(confirm("¿Eliminar este elemento?")) {
            await api.delete('lists.php', id);
            await this.renderAdminPayments();
        }
    }
};

// --- IMPORTACIÓN Y EXPORTACIÓN CSV ---
const csv = {
    async export(type) {
        let data = [];
        let filename = '';
        if(type === 'products') {
            data = await api.get('products.php') || [];
            filename = 'productos.csv';
        } else if(type === 'providers') {
            data = await api.get('providers.php') || [];
            filename = 'proveedores.csv';
        } else if(type === 'history') {
            const user = auth.getCurrentUser();
            const history = await api.get(`orders.php?role=${encodeURIComponent(user.role)}&user=${encodeURIComponent(user.name)}`) || [];
            
            data = history.map(h => ({
                ref: h.ref, date: h.date, provider: h.provider, user: h.user, 
                items: h.items.map(i => `${i.name} (${i.qty} ${i.unit})`).join(' | ')
            }));
            filename = 'historial_pedidos.csv';
        }

        if(data.length === 0) return alert("No hay datos para exportar.");

        const headers = Object.keys(data[0]);
        const csvRows = [];
        csvRows.push(headers.join(';'));

        for(const row of data) {
            const values = headers.map(header => {
                const escaped = ('' + (row[header] || '')).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(';'));
        }

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', filename);
        a.click();
    },

    parseCSV(text) {
        let p = '', row = [''], ret = [row], i = 0, r = 0, s = !0, l;
        
        const firstLine = text.split('\n')[0];
        let delimiter = ',';
        if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) {
            delimiter = ';';
        }

        for (l of text) {
            if ('"' === l) {
                if (s && l === p) row[i] += l;
                s = !s;
            } else if (delimiter === l && s) l = row[++i] = '';
            else if ('\n' === l && s) {
                if ('\r' === p) row[i] = row[i].slice(0, -1);
                row = ret[++r] = [l = '']; i = 0;
            } else row[i] += l;
            p = l;
        }
        return ret.filter(r => r.length > 1 || r[0].trim() !== '');
    },

    showLoading(show, message = "Procesando...") {
        let overlay = document.getElementById('csv-loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'csv-loading-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            overlay.style.color = '#fff';
            overlay.style.display = 'flex';
            overlay.style.flexDirection = 'column';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '9999';
            overlay.style.fontSize = '1.5rem';
            
            const spinner = document.createElement('div');
            spinner.style.border = '6px solid #f3f3f3';
            spinner.style.borderTop = '6px solid #e3000f';
            spinner.style.borderRadius = '50%';
            spinner.style.width = '50px';
            spinner.style.height = '50px';
            spinner.style.animation = 'spin 1s linear infinite';
            spinner.style.marginBottom = '20px';
            
            const style = document.createElement('style');
            style.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
            
            const text = document.createElement('div');
            text.id = 'csv-loading-text';
            text.textContent = message;
            
            overlay.appendChild(spinner);
            overlay.appendChild(text);
            document.body.appendChild(overlay);
        }
        
        const textEl = document.getElementById('csv-loading-text');
        if (textEl) textEl.textContent = message;
        
        overlay.style.display = show ? 'flex' : 'none';
    },

    async import(type) {
        const fileInput = document.getElementById('csv-file-input');
        const file = fileInput.files[0];
        if(!file) return alert("Selecciona un archivo CSV primero.");

        const reader = new FileReader();
        reader.onload = async function(e) {
            const text = e.target.result;
            
            const parsedData = csv.parseCSV(text);
            if(parsedData.length < 2) return alert("El archivo está vacío o no tiene datos válidos.");

            // A veces el CSV viene con BOM o espacios extra en la primera columna, asegurémonos de limpiar
            let headers = parsedData[0].map(h => h.replace(/^\uFEFF/, '').trim().toLowerCase());
            
            // Diccionario de mapeo para soportar nombres de columnas en español desde Excel
            const headerMap = {
                'proveedor': 'name',
                'nombre': 'name', // En caso de que se use 'nombre' genérico o para el contacto, priorizamos 'proveedor' para name si existe
                'cif': 'cif',
                'familia': 'family',
                'categoría': 'category',
                'domicilio': 'address',
                'contacto': 'contact',
                'teléfono': 'phone',
                'telefono': 'phone',
                'tel': 'phone',
                'email': 'email',
                'correo': 'email',
                'ciudad': 'city',
                'pago': 'payment',
                // Para productos
                'producto': 'name',
                'unidad': 'unit',
                'ud': 'unit',
                'precio': 'price',
                'subcategoría': 'subcategory'
            };

            // Ajuste específico si hay 'proveedor' (name comercial) y 'nombre' (razón social/contacto)
            if (headers.includes('proveedor') && headers.includes('nombre')) {
                headerMap['nombre'] = 'contact'; // Forzamos que 'nombre' sea contacto si ya hay 'proveedor'
            }

            // Mapear los headers a los nombres esperados por la base de datos
            headers = headers.map(h => headerMap[h] || h);

            let count = 0;

            csv.showLoading(true, `Importando ${type === 'products' ? 'productos' : 'proveedores'}...`);
            
            // Pausa breve para permitir que el navegador dibuje el overlay de carga
            await new Promise(resolve => setTimeout(resolve, 50));

            for(let i=1; i < parsedData.length; i++) {
                const values = parsedData[i];
                let obj = {}; 
                headers.forEach((h, index) => {
                    if(h !== 'id' && h !== '') {
                        obj[h] = values[index] ? values[index].trim() : ''; 
                    }
                });
                
                // Si la fila no tiene nombre válido, saltar
                if (!obj.name || obj.name.trim() === '') continue;

                // Verificación de duplicados básicos en caché
                let isDuplicate = false;
                if (type === 'products' && cache.products.find(p => p.name.toLowerCase() === obj.name.toLowerCase())) isDuplicate = true;
                if (type === 'providers' && cache.providers.find(p => p.name.toLowerCase() === obj.name.toLowerCase())) isDuplicate = true;

                if (!isDuplicate) {
                    if (type === 'products') {
                        // Si el proveedor está especificado por nombre en el CSV pero no tenemos su ID
                        if (obj.provider_name && !obj.provider_id) {
                            const prov = cache.providers.find(p => p.name.toLowerCase() === obj.provider_name.toLowerCase());
                            if (prov) {
                                obj.provider_id = prov.id;
                            }
                        }
                        await api.post('products.php', obj);
                    }
                    if (type === 'providers') {
                        // El backend requiere 'phone', si no viene en el CSV, le ponemos un guión temporal
                        if (!obj.phone) obj.phone = '-';
                        
                        await api.post('providers.php', obj);
                    }
                    count++;
                }
                
                // Refrescar UI ocasionalmente durante loops largos
                if (i % 10 === 0) {
                    csv.showLoading(true, `Procesando ${i} de ${parsedData.length - 1}...`);
                    await new Promise(resolve => setTimeout(resolve, 10)); // Yield to main thread
                }
            }

            csv.showLoading(false);
            
            const msg = count === 0 && parsedData.length > 1 
                ? `No se importaron datos. Verifique que los nombres de columnas estén correctos ("name", "unit", etc) o es posible que los registros ya existan en la base de datos.` 
                : `Se han importado ${count} nuevos registros (se omitieron los repetidos o vacíos).`;
                
            alert(msg);
            
            fileInput.value = '';
            
            // Recargar UI
            await loadCache();
            if(type === 'products') ui.openProductManager();
            if(type === 'providers') ui.openProviderManager();
        };
        reader.readAsText(file);
    }
};

// INICIALIZACIÓN
(function init() {
    auth.checkAuth();
})();