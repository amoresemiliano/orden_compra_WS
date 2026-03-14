// DATOS DE PRODUCTOS
const PRODUCT_MASTER = [
    { name: "Limón", unit: "ud" }, { name: "Aguacate", unit: "kg" },
    { name: "Cebolla", unit: "kg" }, { name: "Cebolla Morada", unit: "kg" },
    { name: "Piña", unit: "kg" }, { name: "Pimiento Rojo", unit: "kg" },
    { name: "Pimiento Verde", unit: "kg" }, { name: "Cilantro", unit: "ud" }
];

// ESTADO DE LA APLICACIÓN
let currentOrder = [];

// MÓDULO DE LÓGICA DE ÓRDENES (Principios SOLID)
const orderManager = {
    addItem() {
        const pIdx = document.getElementById('product-select').value;
        const qty = document.getElementById('quantity').value;
        
        if (pIdx !== "" && qty > 0) {
            const product = PRODUCT_MASTER[pIdx];
            // Si ya existe, avisar o simplemente añadir
            currentOrder.push({ ...product, qty: parseFloat(qty) });
            this.render();
            document.getElementById('quantity').value = "";
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

    sendOrder() {
        const phone = document.getElementById('provider-phone').value.replace(/\s+/g, '');
        const name = document.getElementById('provider-name').value || "Proveedor";
        const msgIntro = document.getElementById('custom-message').value;

        if (!phone || currentOrder.length === 0) return alert("Falta el teléfono o productos.");

        this.saveProvider(name, phone);

        let fullMsg = `${msgIntro}\n\n`;
        currentOrder.forEach(i => fullMsg += `• ${i.name}: ${i.qty} ${i.unit}\n`);

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(fullMsg)}`, '_blank');

        this.saveToHistory(name);
        
        // Limpiar
        currentOrder = [];
        this.render();
    },

    saveToHistory(provider) {
        const history = JSON.parse(localStorage.getItem('orderHistory')) || [];
        const order = {
            ref: `#${Math.floor(1000 + Math.random() * 9000)}`,
            date: new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }),
            provider,
            items: [...currentOrder]
        };
        history.push(order);
        localStorage.setItem('orderHistory', JSON.stringify(history));
    },

    saveProvider(name, phone) {
        let providers = JSON.parse(localStorage.getItem('providers')) || [];
        if (!providers.find(p => p.phone === phone)) {
            providers.push({ name, phone });
            localStorage.setItem('providers', JSON.stringify(providers));
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
        event.currentTarget.classList.add('active');
        if (tabId === 'historial') this.renderHistory();
    },

    loadProviders() {
        const sel = document.getElementById('provider-select');
        const providers = JSON.parse(localStorage.getItem('providers')) || [];
        sel.innerHTML = '<option value="new">-- Nuevo Proveedor --</option>';
        providers.forEach((p, idx) => {
            sel.innerHTML += `<option value="${idx}">${p.name}</option>`;
        });
    },

    handleProviderChange() {
        const sel = document.getElementById('provider-select');
        const providers = JSON.parse(localStorage.getItem('providers')) || [];
        const fields = document.getElementById('new-provider-fields');
        
        if (sel.value === 'new') {
            fields.style.display = 'block';
            document.getElementById('provider-name').value = "";
            document.getElementById('provider-phone').value = "";
        } else {
            fields.style.display = 'none';
            const p = providers[sel.value];
            document.getElementById('provider-name').value = p.name;
            document.getElementById('provider-phone').value = p.phone;
        }
    },

    renderHistory() {
        const body = document.getElementById('history-body');
        const history = JSON.parse(localStorage.getItem('orderHistory')) || [];
        body.innerHTML = history.slice().reverse().map((o, idx) => {
            const originalIdx = history.length - 1 - idx;
            return `
                <tr>
                    <td onclick="ui.showDetail(${originalIdx})"><strong>${o.ref}</strong></td>
                    <td onclick="ui.showDetail(${originalIdx})">${o.date}</td>
                    <td onclick="ui.showDetail(${originalIdx})">${o.provider}</td>
                    <td class="text-truncate">${o.items.map(i => i.name).join(', ')}</td>
                    <td><button class="btn-duplicate" onclick="ui.duplicate(${originalIdx})">Duplicar</button></td>
                </tr>
            `;
        }).join('');
    },

    showDetail(idx) {
        const history = JSON.parse(localStorage.getItem('orderHistory'));
        const o = history[idx];
        document.getElementById('modal-title').innerText = `${o.ref} - ${o.provider}`;
        document.getElementById('modal-items').innerHTML = o.items.map(i => `<p>• ${i.name}: ${i.qty} ${i.unit}</p>`).join('');
        document.getElementById('modal-detalle').style.display = 'block';
    },

    closeModal() { document.getElementById('modal-detalle').style.display = 'none'; },

    duplicate(idx) {
        const history = JSON.parse(localStorage.getItem('orderHistory'));
        currentOrder = JSON.parse(JSON.stringify(history[idx].items)); // Deep copy
        this.openTab('pedidos');
        orderManager.render();
    }
};

// INICIALIZACIÓN
(function init() {
    const pSelect = document.getElementById('product-select');
    pSelect.innerHTML = '<option value="" disabled selected>Seleccionar Producto...</option>';
    PRODUCT_MASTER.forEach((p, i) => pSelect.innerHTML += `<option value="${i}">${p.name}</option>`);
    ui.loadProviders();
})();