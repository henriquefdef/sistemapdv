// Dados e lógica de negócio - armazena carrinho, busca produtos/clientes e faz cálculos
// Constante de pin removida
const MAX_RECENT_PRODUCTS = 20;
const MIN_SEARCH_CHARS = 2;
const MAX_SEARCH_RESULTS = 8;

let cart = [];
let saleState = { 
    customer: null, 
    generalDiscount: { type: 'none', value: 0 }, 
    paymentMethod: 'Dinheiro', 
    amountReceived: 0, 
    receiptContact: '' 
};
let config = { 
    askForPayment: true, 
    askForReceipt: false, 
    defaultCardMachine: '', 
    showQuickAccess: true,
    showImages: true,
    cardFeesPaidBy: 'casa'
};
let customers = [];
let filteredCustomers = [];
let renderedProducts = [];
let imageCache = new Map();
const IMAGE_CACHE_KEY = 'lume-pdv-image-cache';

// Carregar cache de imagens do localStorage
function loadImageCacheFromStorage() {
    try {
        const cached = localStorage.getItem(IMAGE_CACHE_KEY);
        if (cached) {
            const data = JSON.parse(cached);
            Object.entries(data).forEach(([key, value]) => {
                imageCache.set(key, value);
            });
            console.log(`Cache de imagens carregado: ${imageCache.size} imagens`);
        }
    } catch (error) {
        console.error('Erro ao carregar cache de imagens:', error);
        localStorage.removeItem(IMAGE_CACHE_KEY);
    }
}

// Salvar cache de imagens no localStorage
function saveImageCacheToStorage() {
    try {
        const data = Object.fromEntries(imageCache);
        localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('Erro ao salvar cache de imagens:', error);
    }
}

// Limpar imagens do cache que não estão mais sendo usadas
function cleanImageCache(currentProductIds) {
    const idsToKeep = new Set(currentProductIds);
    
    let removedCount = 0;
    for (const [productId] of imageCache) {
        const numericId = parseInt(productId);
        if (!idsToKeep.has(numericId)) {
            imageCache.delete(productId);
            removedCount++;
        }
    }
    
    if (removedCount > 0) {
        saveImageCacheToStorage();
        console.log(`Cache limpo: ${removedCount} imagens removidas`);
    }
}

// Limpar cache quando produtos são removidos das categorias
function onProductsUpdated(newProducts) {
    if (!newProducts || newProducts.length === 0) return;
    
    const currentIds = newProducts.map(p => p.id);
    cleanImageCache(currentIds);
}

// Função para limpar cache de um produto específico
function removeProductFromCache(productId) {
    if (imageCache.has(productId.toString())) {
        imageCache.delete(productId.toString());
        saveImageCacheToStorage();
        console.log(`Imagem do produto ${productId} removida do cache`);
    }
}

// Função para limpar cache de múltiplos produtos
function removeProductsFromCache(productIds) {
    let removedCount = 0;
    
    productIds.forEach(productId => {
        // Remove produto do cache
        if (imageCache.has(productId.toString())) {
            imageCache.delete(productId.toString());
            removedCount++;
        }
    });
    
    if (removedCount > 0) {
        saveImageCacheToStorage();
        console.log(`${removedCount} imagens removidas do cache`);
    }
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function getImageUrl(produto) {
    if (!produto) return 'nofoto.png';

    if (imageCache.has(produto.id)) {
        return imageCache.get(produto.id);
    }

    let url = 'nofoto.png';

    if (produto.imageUrl && produto.imageUrl.trim()) {
        url = produto.imageUrl;
    } else if (produto.imagem_url && produto.imagem_url.trim()) {
        url = produto.imagem_url;
    } else if (produto.imagem && produto.imagem.trim()) {
        url = produto.imagem;
    } else if (produto.codigo_sku && produto.codigo_sku.trim() && window.currentCompanyId && supabaseClient) {
        const sku = produto.codigo_sku.trim();
        const baseUrl = `${supabaseClient.supabaseUrl}/storage/v1/object/public/product-images/${window.currentCompanyId}`;
        url = `${baseUrl}/${sku}.jpg`;
    }

    imageCache.set(produto.id, url);
    return url;
}

async function fetchProductImages(produtos) {
    if (!produtos || produtos.length === 0) return;
    
    try {
        // Primeiro, verificar quais produtos já têm imagens no cache
        const uncachedProducts = produtos.filter(p => !imageCache.has(p.id));
        const uncachedIds = uncachedProducts.map(p => p.id);
        
        // Aplicar imagens do cache aos produtos
        produtos.forEach(produto => {
            if (imageCache.has(produto.id)) {
                produto.imageUrl = imageCache.get(produto.id);
            }
        });
        
        // Limpar cache de produtos que não estão mais sendo exibidos
        onProductsUpdated(produtos);
        
        // Se todos os produtos já estão no cache, não precisa buscar no banco
        if (uncachedIds.length === 0) {
            console.log('Todas as imagens carregadas do cache local');
            return;
        }
        
        console.log(`Buscando ${uncachedIds.length} imagens no banco de dados`);
        
        const { data: images, error } = await supabaseClient
            .from('produto_imagens')
            .select('produto_id, url')
            .in('produto_id', uncachedIds);

        if (error) return;

        if (images && images.length > 0) {
            let newImagesCount = 0;
            images.forEach(img => {
                if (!imageCache.has(img.produto_id)) {
                    imageCache.set(img.produto_id, img.url);
                    newImagesCount++;
                }
                
                const produto = produtos.find(p => p.id === img.produto_id);
                if (produto) {
                    produto.imageUrl = img.url;
                }
            });
            
            if (newImagesCount > 0) {
                // Salvar cache atualizado no localStorage
                saveImageCacheToStorage();
                console.log(`${newImagesCount} novas imagens adicionadas ao cache`);
            }
        }
    } catch (error) {
        console.error('Erro ao buscar imagens:', error);
    }
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.pdv-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `pdv-notification ${type}`;
    
    const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6';
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    
    notification.style.cssText = `
        position: fixed; top: 2rem; right: 2rem; background-color: ${bgColor}; color: white;
        padding: 1rem 1.5rem; border-radius: 8px; font-weight: 500; z-index: 1001;
        max-width: 400px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideInRight 0.3s ease; display: flex; align-items: center; gap: 0.5rem;
    `;
    
    notification.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" 
                style="background: none; border: none; color: white; margin-left: auto; cursor: pointer; padding: 0.25rem;">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(notification);
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
}

// Funções de pin removidas

async function fetchRecentProducts() {
    const recentProductsGrid = document.getElementById('recent-products-grid');
    recentProductsGrid.innerHTML = '<p>Carregando produtos...</p>';
    
    try {
        const { data } = await supabaseClient
            .from('produtos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('ativo', true)
            .order('created_at', { ascending: false })
            .limit(MAX_RECENT_PRODUCTS);
        
        const recentProducts = data || [];
        await fetchProductImages(recentProducts);
        renderRecentProducts(recentProducts);

    } catch (error) {
        console.error("Erro ao buscar produtos:", error);
        recentProductsGrid.innerHTML = '<p>Erro ao carregar produtos.</p>';
    }
}

function renderRecentProducts(products) {
    const recentProductsGrid = document.getElementById('recent-products-grid');
    renderedProducts = products;
    if (!products || products.length === 0) {
        recentProductsGrid.innerHTML = '<p>Nenhum produto encontrado.</p>';
        return;
    }
    
    recentProductsGrid.innerHTML = products.map(product => {
        return createProductCard(product);
    }).join('');
}

function createProductCard(product) {
    const imageUrl = getImageUrl(product);
    
    return `
        <div class="product-card" data-product-id="${product.id}">
            <img src="${imageUrl}" alt="${product.nome}" class="product-card-img" 
                 onerror="this.onerror=null; this.src='nofoto.png';">
            <div class="product-card-info">
                <div class="product-card-name">${product.nome}</div>
                <div class="product-card-price">${formatCurrency(product.preco_venda)}</div>
            </div>
        </div>`;
}

let searchTimeout;
async function handleSearch() {
    const searchInput = document.getElementById('search-input');
    const searchSpinner = document.getElementById('search-spinner');
    const query = searchInput.value.trim();
    
    if (!query) {
        hideSearchDropdown();
        return;
    }
    
    if (query.length < MIN_SEARCH_CHARS && !/^\d{3,}$/.test(query)) {
        hideSearchDropdown();
        return;
    }
    
    searchSpinner.classList.remove('hidden');
    
    try {
        let queryBuilder = supabaseClient
            .from('produtos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('ativo', true)
            .limit(MAX_SEARCH_RESULTS);

        if (/^\d{3,}$/.test(query)) {
            queryBuilder = queryBuilder.or(`codigo_barras.eq.${query},codigo_sku.ilike.%${query}%`);
        } else if (query.length >= MIN_SEARCH_CHARS) {
            queryBuilder = queryBuilder.or(`nome.ilike.%${query}%,codigo_sku.ilike.%${query}%`);
        }
        
        const { data: products } = await queryBuilder;

        if (products && products.length > 0) {
            await fetchProductImages(products);
        }

        if (products && products.length === 1) {
            addToCart(products[0]);
            searchInput.value = '';
            searchInput.focus();
            hideSearchDropdown();
        } else {
            showSearchDropdown(products);
        }
    } catch (error) {
        console.error("Erro na busca:", error);
        showSearchDropdown(null);
    } finally {
        searchSpinner.classList.add('hidden');
    }
}

async function loadCustomers() {
    try {
        const { data, error } = await supabaseClient
            .from('clientes')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .order('nome', { ascending: true });

        if (error) {
            console.error('Erro ao carregar clientes:', error);
            return;
        }

        customers = data || [];
        filteredCustomers = customers;

    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        showNotification('Erro ao carregar clientes', 'error');
    }
}

let customerSearchTimeout;
function handleCustomerSearch() {
    const customerSearchInput = document.getElementById('customer-search-input');
    clearTimeout(customerSearchTimeout);
    customerSearchTimeout = setTimeout(() => {
        const query = customerSearchInput.value.trim().toLowerCase();
        
        if (!query) {
            filteredCustomers = customers;
        } else {
            filteredCustomers = customers.filter(customer => 
                customer.nome.toLowerCase().includes(query) ||
                (customer.telefone && customer.telefone.toLowerCase().includes(query)) ||
                (customer.email && customer.email.toLowerCase().includes(query))
            );
        }
        
        renderCustomersList();
    }, 300);
}

function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ 
            ...product, 
            quantity: 1, 
            discount: { type: 'none', value: 0 } 
        });
    }
    renderCart();
}

function updateCartItem(productId, newQuantity, newDiscount) {
    const item = cart.find(i => i.id == productId);
    if (item) {
        item.quantity = newQuantity;
        item.discount = newDiscount;
        renderCart();
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id != productId);
    renderCart();
}

function getItemTotal(item) {
    let total = item.preco_venda * item.quantity;
    if (item.discount.type === 'fixed') {
        total -= item.discount.value * item.quantity;
    } else if (item.discount.type === 'percent') {
        total -= total * (item.discount.value / 100);
    }
    return total;
}

function calculateTotals() {
    const subtotal = cart.reduce((acc, item) => acc + (item.preco_venda * item.quantity), 0);
    
    const itemDiscounts = cart.reduce((acc, item) => {
        if (item.discount.type === 'fixed') return acc + (item.discount.value * item.quantity);
        if (item.discount.type === 'percent') return acc + ((item.preco_venda * item.quantity) * (item.discount.value / 100));
        return acc;
    }, 0);

    let generalDiscountAmount = 0;
    const subtotalAfterItemDiscounts = subtotal - itemDiscounts;
    if (saleState.generalDiscount.type === 'fixed') {
        generalDiscountAmount = saleState.generalDiscount.value;
    } else if (saleState.generalDiscount.type === 'percent') {
        generalDiscountAmount = subtotalAfterItemDiscounts * (saleState.generalDiscount.value / 100);
    }

    const totalDiscount = itemDiscounts + generalDiscountAmount;
    const total = subtotal - totalDiscount;

    return { subtotal, totalDiscount, total };
}

async function loadCardMachines() {
    const select = document.getElementById('default-card-machine');
    if (!select || !window.currentCompanyId) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('maquinas')
            .select('id, nome')
            .eq('id_empresa', window.currentCompanyId)
            .order('nome', { ascending: true });

        if (error) throw error;

        select.innerHTML = '<option value="">Selecione uma máquina</option>';
        
        if (data && data.length > 0) {
            data.forEach(machine => {
                const option = document.createElement('option');
                option.value = machine.id;
                option.textContent = machine.nome;
                select.appendChild(option);
            });
            
            if (config.defaultCardMachine) {
                select.value = config.defaultCardMachine;
            }
        } else {
            select.innerHTML = '<option value="">Nenhuma máquina cadastrada</option>';
        }

    } catch (error) {
        console.error('Erro ao carregar máquinas:', error);
        select.innerHTML = '<option value="">Erro ao carregar máquinas</option>';
    }
}

function loadSettings() {
    const savedConfig = JSON.parse(localStorage.getItem('pdv-config'));
    if (savedConfig) config = { ...config, ...savedConfig };
    
    setTimeout(() => {
        const askPaymentEl = document.getElementById('setting-ask-payment');
        const askReceiptEl = document.getElementById('setting-ask-receipt');
        const showQuickAccessEl = document.getElementById('setting-show-quick-access');
        const showImagesEl = document.getElementById('setting-show-images');
        const defaultCardMachineEl = document.getElementById('default-card-machine');
        const cardFeesPayerEl = document.getElementById('card-fees-payer');
        
        if (askPaymentEl) askPaymentEl.checked = config.askForPayment;
        if (askReceiptEl) askReceiptEl.checked = config.askForReceipt;
        if (showQuickAccessEl) showQuickAccessEl.checked = config.showQuickAccess;
        if (showImagesEl) showImagesEl.checked = config.showImages;
        if (defaultCardMachineEl) defaultCardMachineEl.value = config.defaultCardMachine || '';
        if (cardFeesPayerEl) cardFeesPayerEl.value = config.cardFeesPaidBy || 'casa';

        loadCardMachines();
    }, 100);
}

function saveSettings() {
    const askPaymentEl = document.getElementById('setting-ask-payment');
    const askReceiptEl = document.getElementById('setting-ask-receipt');
    const showQuickAccessEl = document.getElementById('setting-show-quick-access');
    const showImagesEl = document.getElementById('setting-show-images');
    const defaultCardMachineEl = document.getElementById('default-card-machine');
    const cardFeesPayerEl = document.getElementById('card-fees-payer');
    
    if (askPaymentEl) config.askForPayment = askPaymentEl.checked;
    if (askReceiptEl) config.askForReceipt = askReceiptEl.checked;
    if (showQuickAccessEl) config.showQuickAccess = showQuickAccessEl.checked;
    if (showImagesEl) config.showImages = showImagesEl.checked;
    if (defaultCardMachineEl) config.defaultCardMachine = defaultCardMachineEl.value;
    if (cardFeesPayerEl) config.cardFeesPaidBy = cardFeesPayerEl.value;
    
    localStorage.setItem('pdv-config', JSON.stringify(config));
    updateQuickAccessVisibility();
    updateImageVisibility();
    
    showNotification('Configurações salvas com sucesso!', 'success');
}

function updateQuickAccessVisibility() {
    const quickAccessBar = document.querySelector('.bottom-products-bar');
    if (quickAccessBar) {
        quickAccessBar.style.display = config.showQuickAccess ? 'flex' : 'none';
    }
}

function updateImageVisibility() {
    const body = document.body;
    if (config.showImages) {
        body.classList.remove('hide-images');
    } else {
        body.classList.add('hide-images');
    }
}

function processSale() {
    const { subtotal, totalDiscount, total } = calculateTotals();
    const simulatedSaleId = Math.floor(10000 + Math.random() * 90000);
    
    showNotification('Venda realizada com sucesso!', 'success');
    startNewSale();
}

function finalizeSale() {
    if (cart.length === 0) return;
    
    if (!config.askForPayment) {
        saleState.paymentMethod = 'Dinheiro';
        const { total } = calculateTotals();
        saleState.amountReceived = total;
        processSale();
    } else {
        showPaymentModal();
    }
}

function showPaymentModal() {
    const { total } = calculateTotals();
    
    if (window.paymentModal) {
        window.paymentModal.show(total);
    } else {
        console.error('Modal de pagamento não encontrado');
    }
}

window.finalizeAdvancedSale = function(paymentData) {
    const { subtotal, totalDiscount } = calculateTotals();
    const finalTotal = paymentData.totalAmount || 0;
    const simulatedSaleId = Math.floor(10000 + Math.random() * 90000);
    
    if (paymentData.receiptMethod === 'print') {
        showNotification('Comprovante sendo impresso...', 'info');
    } else if (paymentData.receiptMethod === 'whatsapp') {
        showNotification(`Comprovante enviado para ${paymentData.whatsappNumber}`, 'success');
    }
    
    showSuccessScreen(simulatedSaleId);
}

function startNewSale() {
    cart = [];
    saleState = {
        customer: null,
        generalDiscount: { type: 'none', value: 0 },
        paymentMethod: 'Dinheiro',
        amountReceived: 0,
        receiptContact: ''
    };
    renderCart();
    updateCustomerDisplay();
    
    if (imageCache.size > 100) {
        imageCache.clear();
    }
    document.getElementById('search-input').focus();
    hideSearchDropdown();
}

function cancelSale() {
    if (cart.length === 0) return;
    
    const confirmCancel = confirm('Tem certeza que deseja cancelar esta venda? Todos os itens serão removidos do carrinho.');
    
    if (confirmCancel) {
        cart = [];
        saleState.customer = null;
        saleState.generalDiscount = { type: 'none', value: 0 };
        
        // Sincronizar com window.saleState
        if (window.saleState) {
            window.saleState.customer = null;
        }
        
        renderCart();
        updateCustomerDisplay();
        document.getElementById('search-input').focus();
        hideSearchDropdown();
        
        // Disparar evento global para sincronizar com modal de pagamento
        document.dispatchEvent(new CustomEvent('customerSelected', { detail: null }));
        
        showNotification('Venda cancelada com sucesso!', 'info');
    }
}

// Expor funções de cache globalmente
window.removeProductFromCache = removeProductFromCache;
window.removeProductsFromCache = removeProductsFromCache;
window.cleanImageCache = cleanImageCache;
window.onProductsUpdated = onProductsUpdated;