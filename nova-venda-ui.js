// Interface e eventos - controla tela, cliques, modais e atalhos, atualiza carrinho em tempo real
const searchInput = document.getElementById('search-input');
const searchSpinner = document.getElementById('search-spinner');
const recentProductsGrid = document.getElementById('recent-products-grid');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartItemCount = document.getElementById('cart-item-count');
const subtotalValue = document.getElementById('subtotal-value');
const discountValue = document.getElementById('discount-value');
const totalValue = document.getElementById('total-value');
const finalizeSaleBtn = document.getElementById('finalize-sale-btn');
const editItemModal = document.getElementById('edit-item-modal');
const customerSelectionModal = document.getElementById('customer-selection-modal');
const settingsModal = document.getElementById('settings-modal');
const successModal = document.getElementById('success-modal');

const customerSearchInput = document.getElementById('customer-search-input');
const customerSearchSpinner = document.getElementById('customer-search-spinner');

function setupSearchDropdown() {
    const dropdown = document.createElement('div');
    dropdown.id = 'search-dropdown';
    dropdown.className = 'search-dropdown hidden';
    
    // Anexar ao body para evitar problemas de contexto de empilhamento
    document.body.appendChild(dropdown);
    
    document.addEventListener('click', (e) => {
        const searchBar = document.querySelector('.search-bar');
        if (!searchBar.contains(e.target) && !dropdown.contains(e.target)) {
            hideSearchDropdown();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideSearchDropdown();
        }
    });
}

function showSearchDropdown(products) {
    const dropdown = document.getElementById('search-dropdown');
    const searchBar = document.querySelector('.search-bar');
    
    // Posicionar o dropdown em relação ao campo de busca
    const searchBarRect = searchBar.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = `${searchBarRect.bottom + 4}px`;
    dropdown.style.left = `${searchBarRect.left}px`;
    dropdown.style.width = `${searchBarRect.width}px`;
    dropdown.style.zIndex = '999999';
    
    if (!products || products.length === 0) {
        dropdown.innerHTML = `
            <div class="dropdown-item no-results">
                <i class="fa-solid fa-search"></i>
                <span>Nenhum produto encontrado</span>
            </div>`;
    } else {
        dropdown.innerHTML = products.map(product => {
            const imageUrl = getImageUrl(product);
            
            // Debug da imagem no dropdown
            console.log(`🔍 Dropdown - ${product.nome} -> ${imageUrl}`);
            
            return `
                <div class="dropdown-item" data-product-id="${product.id}">
                    <img src="${imageUrl}" 
                         alt="${product.nome}" 
                         class="dropdown-item-img"
                         onerror="this.onerror=null; this.src='nofoto.png'; console.error('❌ Dropdown - Falha:', '${imageUrl}');"
                         onload="console.log('✅ Dropdown - Carregada:', '${imageUrl}');">
                    <div class="dropdown-item-details">
                        <div class="dropdown-item-name">${product.nome}</div>
                        <div class="dropdown-item-info">
                            <span class="dropdown-item-sku">SKU: ${product.codigo_sku || 'N/A'}</span>
                            <span class="dropdown-item-price">${formatCurrency(product.preco_venda)}</span>
                        </div>
                    </div>
                </div>`;
        }).join('');
        
        dropdown.querySelectorAll('.dropdown-item').forEach(item => {
            if (!item.classList.contains('no-results')) {
                item.addEventListener('click', () => {
                    const selectedProduct = products.find(p => p.id == item.dataset.productId);
                    if (selectedProduct) {
                        addToCart(selectedProduct);
                        searchInput.value = '';
                        searchInput.focus();
                        hideSearchDropdown();
                    }
                });
            }
        });
    }
    
    dropdown.classList.remove('hidden');
}

function hideSearchDropdown() {
    const dropdown = document.getElementById('search-dropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
    }
}

// --- RENDERIZAÇÃO DO CARRINHO ---
function renderCart() {
    const cancelBtn = document.getElementById('cancel-sale-btn');
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="empty-cart-message">
                <i class="fa-solid fa-basket-shopping"></i>
                <p>Seu carrinho está vazio.</p>
                <span>Adicione produtos para iniciar uma venda.</span>
            </div>`;
        
        if (cancelBtn) {
            cancelBtn.disabled = true;
        }
    } else {
        cartItemsContainer.innerHTML = cart.map(item => {
            const imageUrl = getImageUrl(item);
            
            // Debug da imagem no carrinho
            console.log(`🛒 Carrinho - ${item.nome} -> ${imageUrl}`);
            
            return `
                <div class="cart-item" data-product-id="${item.id}">
                    <img src="${imageUrl}" 
                         alt="${item.nome}" 
                         class="cart-item-img" 
                         onerror="this.onerror=null; this.src='nofoto.png'; console.error('❌ Carrinho - Falha:', '${imageUrl}');"
                         onload="console.log('✅ Carrinho - Carregada:', '${imageUrl}');">
                    <div class="cart-item-details">
                        <div class="cart-item-name">${item.nome}</div>
                        <div class="cart-item-price-qty">${item.quantity}x ${formatCurrency(item.preco_venda)}</div>
                    </div>
                    <div class="cart-item-total">${formatCurrency(getItemTotal(item))}</div>
                </div>`;
        }).join('');
        
        document.querySelectorAll('.cart-item').forEach(el => {
            el.addEventListener('click', () => showEditItemModal(el.dataset.productId));
        });
        
        if (cancelBtn) {
            cancelBtn.disabled = false;
        }
    }
    
    updateTotalsDisplay();
    cartItemCount.textContent = cart.reduce((acc, item) => acc + item.quantity, 0);
    finalizeSaleBtn.disabled = cart.length === 0;
}

function updateTotalsDisplay() {
    const { subtotal, totalDiscount, total } = calculateTotals();
    
    subtotalValue.textContent = formatCurrency(subtotal);
    discountValue.textContent = `- ${formatCurrency(totalDiscount)}`;
    totalValue.textContent = formatCurrency(total);
}

// --- RENDERIZAÇÃO DE CLIENTES ---
function renderCustomersList() {
    const list = document.getElementById('customer-list');
    
    if (filteredCustomers.length === 0) {
        if (customers.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>Nenhum cliente cadastrado</h3>
                    <p>Cadastre clientes para selecioná-los nas vendas</p>
                </div>`;
        } else {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>Nenhum resultado encontrado</h3>
                    <p>Tente buscar por outro nome ou telefone</p>
                </div>`;
        }
    } else {
        list.innerHTML = filteredCustomers.map(c => `
            <div class="customer-item" data-customer-id="${c.id}">
                <div class="customer-info">
                    <strong class="customer-name">${c.nome}</strong>
                    <p class="customer-phone">${c.telefone || 'Telefone não informado'}</p>
                    ${c.email ? `<p class="customer-email">${c.email}</p>` : ''}
                </div>
            </div>
        `).join('');

        // Adicionar event listeners para seleção de clientes
        list.querySelectorAll('.customer-item').forEach(item => {
            item.addEventListener('click', () => selectCustomer(item.dataset.customerId));
        });
    }
}

function selectCustomer(customerId) {
    const selectedCustomer = filteredCustomers.find(c => c.id == customerId);
    if (selectedCustomer) {
        // Atualizar ambas as variáveis de estado
        saleState.customer = selectedCustomer;
        if (!window.saleState) window.saleState = {};
        window.saleState.customer = selectedCustomer;
        
        updateCustomerDisplay();
        closeModal(customerSelectionModal);
        showNotification(`Cliente ${selectedCustomer.nome} selecionado`, 'success');
        
        // Popular automaticamente o telefone no modal de pagamento se estiver aberto
        const whatsappNumberField = document.getElementById('whatsapp-number');
        if (whatsappNumberField && selectedCustomer.telefone) {
            whatsappNumberField.value = selectedCustomer.telefone;
        }
        
        // Disparar evento global de mudança de cliente
        document.dispatchEvent(new CustomEvent('customerSelected', { detail: selectedCustomer }));
        
        // Limpar busca e resetar lista
        customerSearchInput.value = '';
        filteredCustomers = customers;
        renderCustomersList();
        
        console.log('Cliente selecionado na tela principal:', selectedCustomer);
        console.log('window.saleState.customer:', window.saleState?.customer);
        console.log('saleState.customer:', saleState.customer);
    }
}

function updateCustomerDisplay() {
    const display = document.getElementById('selected-customer-display');
    if (saleState.customer) {
        document.getElementById('customer-name-display').textContent = saleState.customer.nome;
        display.classList.remove('hidden');
    } else {
        display.classList.add('hidden');
    }
}

// --- MODAIS ---
function openModal(modal) { 
    modal.classList.remove('hidden'); 
    // Reduzir z-index da barra de pesquisa quando modal abre
    const searchAndActions = document.querySelector('.search-and-actions');
    const searchBar = document.querySelector('.search-bar');
    if (searchAndActions) searchAndActions.style.zIndex = '1';
    if (searchBar) searchBar.style.zIndex = '1';
}

function closeModal(modal) { 
    modal.classList.add('hidden'); 
    // Restaurar z-index da barra de pesquisa quando modal fecha
    const searchAndActions = document.querySelector('.search-and-actions');
    const searchBar = document.querySelector('.search-bar');
    if (searchAndActions) searchAndActions.style.zIndex = '9999';
    if (searchBar) searchBar.style.zIndex = '9999';
}

function showEditItemModal(productId) {
    const item = cart.find(i => i.id == productId);
    if (!item) return;

    document.getElementById('edit-item-title').textContent = `Editar ${item.nome}`;
    document.getElementById('item-quantity').value = item.quantity;
    document.getElementById('item-discount-type').value = item.discount.type;
    document.getElementById('item-discount-value').value = item.discount.value;

    document.getElementById('save-item-changes-btn').onclick = () => {
        const newQuantity = parseInt(document.getElementById('item-quantity').value);
        const newDiscount = {
            type: document.getElementById('item-discount-type').value,
            value: parseFloat(document.getElementById('item-discount-value').value) || 0
        };
        if (newQuantity > 0) {
            updateCartItem(item.id, newQuantity, newDiscount);
        }
        closeModal(editItemModal);
    };

    document.getElementById('remove-item-btn').onclick = () => {
        removeFromCart(item.id);
        closeModal(editItemModal);
    };

    openModal(editItemModal);
}

function showCustomerSelectionModal() {
    customerSearchInput.value = '';
    filteredCustomers = customers;
    renderCustomersList();
    openModal(customerSelectionModal);
    
    setTimeout(() => {
        customerSearchInput.focus();
    }, 100);
}

function showSuccessScreen(saleId) {
    document.getElementById('sale-id-display').textContent = `#${saleId}`;
    openModal(successModal);
}

// --- CONFIGURAÇÕES DE EVENTOS ---
function setupEventListeners() {
    // Busca de produtos
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(handleSearch, 300);
    });

    searchInput.addEventListener('blur', () => {
        setTimeout(() => hideSearchDropdown(), 150);
    });

    // Busca de clientes
    if (customerSearchInput) {
        customerSearchInput.addEventListener('input', handleCustomerSearch);
    }

    // ======= CORREÇÃO: REMOVER EVENT LISTENER ANTIGO E USAR DELEGAÇÃO =======
    // Produtos da barra inferior - usando delegação de eventos para evitar duplicação
    if (recentProductsGrid) {
        // Remover qualquer listener antigo
        recentProductsGrid.replaceWith(recentProductsGrid.cloneNode(true));
        const newGrid = document.getElementById('recent-products-grid');
        
        // Adicionar apenas um listener usando delegação
        newGrid.addEventListener('click', handleProductClick);
    }

    // Modais - fechar ao clicar fora ou no X
    const allModals = document.querySelectorAll('.modal-overlay');
    allModals.forEach(modal => {
        modal.addEventListener('click', (e) => { 
            if (e.target === modal) closeModal(modal); 
        });
        modal.querySelector('.close-modal-btn')?.addEventListener('click', () => closeModal(modal));
    });

    // Botões de ação
    document.getElementById('customer-btn').addEventListener('click', showCustomerSelectionModal);
    
    document.getElementById('remove-customer-btn').addEventListener('click', removeSelectedCustomer);
    
    // Configurações
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettingsModal);
    }
    
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettingsAndClose);
    }
    
    // Pagamento
    document.querySelectorAll('.payment-method-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelector('.payment-method-btn.active').classList.remove('active');
            btn.classList.add('active');
            saleState.paymentMethod = btn.dataset.method;
            document.getElementById('cash-payment-details').style.display = saleState.paymentMethod === 'Dinheiro' ? 'block' : 'none';
        });
    });
    
    // Finalizar venda
    finalizeSaleBtn.addEventListener('click', finalizeSale);
    
    // Cancelar venda
    const cancelSaleBtn = document.getElementById('cancel-sale-btn');
    if (cancelSaleBtn) {
        cancelSaleBtn.addEventListener('click', cancelSale);
    }
    
    // Tela de sucesso
    document.getElementById('new-sale-btn').addEventListener('click', startNewSale);
    document.getElementById('print-receipt-btn').addEventListener('click', () => {
        alert('Funcionalidade de impressão será implementada em breve...');
    });
    
    // Atalhos de teclado
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F4') { 
            e.preventDefault(); 
            finalizeSale(); 
        }
        if (e.key === 'Escape') { 
            hideSearchDropdown();
            allModals.forEach(modal => closeModal(modal));
            if (window.paymentModal) {
                window.paymentModal.close();
            }
        }
    });
}

// ======= NOVA FUNÇÃO PARA LIDAR COM CLIQUES NOS PRODUTOS =======
function handleProductClick(event) {
    const card = event.target.closest('.product-card');
    if (!card) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const productId = parseInt(card.dataset.productId);
    
    // Clique no produto para adicionar ao carrinho
    let product = null;
    
    // Procurar o produto nos diferentes arrays disponíveis
    if (typeof window.renderedProducts !== 'undefined' && window.renderedProducts) {
        product = window.renderedProducts.find(p => p.id === productId);
    }
    
    if (!product && typeof renderedProducts !== 'undefined' && renderedProducts) {
        product = renderedProducts.find(p => p.id === productId);
    }
    
    if (product && typeof addToCart === 'function') {
        addToCart(product);
    }
}

// --- INICIALIZAÇÃO ---
function init() {
    if (!window.currentCompanyId) {
        alert("Erro de autenticação. Por favor, faça login novamente.");
        return;
    }
    
    // Carregar cache de imagens do localStorage
    loadImageCacheFromStorage();
    
    loadSettings();
    setupSearchDropdown();
    setupEventListeners();
    fetchRecentProducts();
    loadCustomers();
    renderCart();
    
    setTimeout(() => {
        updateQuickAccessVisibility();
        updateImageVisibility();
    }, 200);
    
    searchInput.focus();
}

function applyGeneralDiscount() {
    const discountType = prompt("Tipo de desconto: 'percent' ou 'fixed'?", saleState.generalDiscount.type);
    const discountValue = parseFloat(prompt("Valor do desconto?", saleState.generalDiscount.value));
    
    if ((discountType === 'percent' || discountType === 'fixed') && !isNaN(discountValue)) {
        saleState.generalDiscount = { type: discountType, value: discountValue };
        renderCart();
        showNotification('Desconto aplicado!', 'success');
    }
}

function removeSelectedCustomer() {
    // Limpar ambas as variáveis de estado
    saleState.customer = null;
    if (window.saleState) {
        window.saleState.customer = null;
    }
    
    updateCustomerDisplay();
    showNotification('Cliente removido da venda', 'info');
    
    // Disparar evento global de mudança de cliente
    document.dispatchEvent(new CustomEvent('customerSelected', { detail: null }));
    
    console.log('Cliente removido da tela principal');
    console.log('window.saleState.customer:', window.saleState?.customer);
    console.log('saleState.customer:', saleState.customer);
}

function openSettingsModal() {
    openModal(settingsModal);
    setTimeout(() => loadCardMachines(), 100);
}

function saveSettingsAndClose() {
    saveSettings();
    closeModal(settingsModal);
}

document.addEventListener('userDataReady', init);

document.addEventListener('DOMContentLoaded', () => {
    if (window.currentCompanyId) {
        init();
    }
});