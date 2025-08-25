// ===== ORÇAMENTO - JAVASCRIPT OTIMIZADO =====

// === ESTADO GLOBAL ===
let orcamento = {
    id: null,
    numero: null,
    cliente: null,
    items: [],
    desconto: { tipo: 'percent', valor: 0 },
    frete: 0,
    observacoes: '',
    totals: { subtotal: 0, desconto: 0, frete: 0, total: 0 }
};

let customers = [];
let searchTimeout;

// === ELEMENTOS DOM ===
const $ = id => document.getElementById(id);
const $$ = selector => document.querySelector(selector);
const $$$ = selector => document.querySelectorAll(selector);

const elements = {
    searchInput: $('search-input'),
    productsContainer: $('products-container'),
    customerBtn: $('customer-btn'),
    cartItems: $('cart-items'),
    itemCount: $('item-count'),
    discountType: $('discount-type'),
    discountInput: $('discount-input'),
    freightInput: $('freight-input'),
    observations: $('observations'),
    subtotal: $('subtotal'),
    discountTotal: $('discount-total'),
    freightTotal: $('freight-total'),
    grandTotal: $('grand-total'),
    saveBtn: $('save-btn'),
    convertBtn: $('convert-btn'),
    pdfBtn: $('pdf-btn'),
    whatsappBtn: $('whatsapp-btn'),
    clearBtn: $('clear-btn'),
    newBtn: $('new-btn'),
    listBtn: $('list-btn'),
    customerModal: $('customer-modal'),
    customerSearch: $('customer-search'),
    customerList: $('customer-list'),
    customerDisplay: $('customer-display'),
    customerName: $('customer-name'),
    customerContact: $('customer-contact'),
    removeCustomerBtn: $('remove-customer-btn'),
    orcamentoNumber: $('orcamento-number'),
    orcamentoDate: $('orcamento-date'),
    listModal: $('list-modal'),
    orcamentosTable: $('orcamentos-table')
};

// === UTILITÁRIOS ===
const utils = {
    formatCurrency: (value) => new Intl.NumberFormat('pt-BR', {
        style: 'currency', currency: 'BRL'
    }).format(value || 0),

    formatPhone: (phone) => {
        if (!phone) return '';
        const clean = phone.replace(/\D/g, '');
        if (clean.length === 11) return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        if (clean.length === 10) return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        return phone;
    },

    formatDate: (date) => {
        if (!date) return new Date().toLocaleDateString('pt-BR');
        return new Date(date).toLocaleDateString('pt-BR');
    },

    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    generateNumber: () => {
        const now = new Date();
        return `ORC${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${now.getTime().toString().slice(-4)}`;
    },

    showNotification: (message, type = 'info') => {
        const colors = {
            success: '#10b981',
            error: '#ef4444', 
            warning: '#f59e0b',
            info: '#3b82f6'
        };

        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 1rem; right: 1rem; z-index: 9999;
            background: ${colors[type]}; color: white; 
            padding: 1rem 1.5rem; border-radius: 0.5rem;
            font-weight: 600; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            transform: translateX(100%); transition: transform 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.style.transform = 'translateX(0)', 100);
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
};

// === FUNÇÕES PRINCIPAIS ===

// Buscar produtos
const searchProducts = utils.debounce(async (query) => {
    if (!query || query.length < 2) {
        elements.productsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>Buscar Produtos</h3>
                <p>Digite o nome ou código do produto para começar</p>
            </div>
        `;
        return;
    }

    try {
        elements.productsContainer.innerHTML = '<div class="loading" style="margin: 2rem auto;"></div>';

        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .or(`nome.ilike.%${query}%,codigo_sku.ilike.%${query}%,codigo_barras.ilike.%${query}%`)
            .limit(20);

        if (error) throw error;

        if (!data || data.length === 0) {
            elements.productsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <h3>Nenhum produto encontrado</h3>
                    <p>Tente uma busca diferente</p>
                </div>
            `;
            return;
        }

        elements.productsContainer.innerHTML = data.map(product => {
            const stock = product.estoque_atual || 0;
            const stockClass = stock > 10 ? 'stock-ok' : stock > 0 ? 'stock-low' : 'stock-out';
            const stockText = stock > 0 ? `${stock} em estoque` : 'Sem estoque';

            return `
                <div class="product-card" onclick="addProduct(${JSON.stringify(product).replace(/"/g, '&quot;')})">
                    <img src="${product.imagem_url || 'https://via.placeholder.com/50x50/f3f4f6/6b7280?text=' + encodeURIComponent(product.nome?.substring(0,1) || 'P')}" 
                         alt="${product.nome}" class="product-image">
                    <div class="product-info">
                        <div class="product-name">${product.nome}</div>
                        <div class="product-details">
                            <span>SKU: ${product.codigo_sku || 'N/A'}</span>
                            <span class="product-stock ${stockClass}">${stockText}</span>
                        </div>
                    </div>
                    <div class="product-price">${utils.formatCurrency(product.preco_venda)}</div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        utils.showNotification('Erro ao buscar produtos', 'error');
        elements.productsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Erro na busca</h3>
                <p>Tente novamente</p>
            </div>
        `;
    }
}, 300);

// Adicionar produto
function addProduct(product) {
    const existing = orcamento.items.find(item => item.id === product.id);
    
    if (existing) {
        existing.quantidade += 1;
        existing.total = existing.quantidade * existing.preco_unitario;
    } else {
        orcamento.items.push({
            id: product.id,
            nome: product.nome,
            codigo_sku: product.codigo_sku,
            preco_unitario: parseFloat(product.preco_venda) || 0,
            quantidade: 1,
            total: parseFloat(product.preco_venda) || 0
        });
    }
    
    updateCart();
    calculateTotals();
    utils.showNotification(`${product.nome} adicionado!`, 'success');
}

// Remover produto
function removeProduct(id) {
    orcamento.items = orcamento.items.filter(item => item.id !== id);
    updateCart();
    calculateTotals();
}

// Atualizar quantidade
function updateQuantity(id, quantidade) {
    const item = orcamento.items.find(item => item.id === id);
    if (item && quantidade > 0) {
        item.quantidade = quantidade;
        item.total = item.quantidade * item.preco_unitario;
        updateCart();
        calculateTotals();
    } else if (quantidade <= 0) {
        removeProduct(id);
    }
}

// Atualizar carrinho
function updateCart() {
    elements.itemCount.textContent = orcamento.items.length;
    
    if (orcamento.items.length === 0) {
        elements.cartItems.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-cart"></i>
                <p>Nenhum item adicionado</p>
            </div>
        `;
    } else {
        elements.cartItems.innerHTML = orcamento.items.map(item => `
            <div class="cart-item">
                <div class="cart-item-header">
                    <div class="cart-item-name">${item.nome}</div>
                    <button class="remove-btn" onclick="removeProduct(${item.id})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="cart-item-controls">
                    <div class="qty-controls">
                        <button class="qty-btn" onclick="updateQuantity(${item.id}, ${item.quantidade - 1})">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="number" class="qty-input" value="${item.quantidade}" min="1"
                               onchange="updateQuantity(${item.id}, parseInt(this.value))">
                        <button class="qty-btn" onclick="updateQuantity(${item.id}, ${item.quantidade + 1})">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <div class="item-total">${utils.formatCurrency(item.total)}</div>
                </div>
            </div>
        `).join('');
    }
    
    updateButtons();
}

// Calcular totais
function calculateTotals() {
    orcamento.totals.subtotal = orcamento.items.reduce((sum, item) => sum + item.total, 0);
    
    // Desconto
    if (orcamento.desconto.tipo === 'percent') {
        orcamento.totals.desconto = (orcamento.totals.subtotal * orcamento.desconto.valor) / 100;
    } else {
        orcamento.totals.desconto = orcamento.desconto.valor;
    }
    
    orcamento.totals.frete = orcamento.frete;
    orcamento.totals.total = Math.max(0, orcamento.totals.subtotal - orcamento.totals.desconto + orcamento.totals.frete);
    
    // Atualizar display
    elements.subtotal.textContent = utils.formatCurrency(orcamento.totals.subtotal);
    elements.discountTotal.textContent = '- ' + utils.formatCurrency(orcamento.totals.desconto);
    elements.freightTotal.textContent = utils.formatCurrency(orcamento.totals.frete);
    elements.grandTotal.textContent = utils.formatCurrency(orcamento.totals.total);
}

// Atualizar botões
function updateButtons() {
    const hasItems = orcamento.items.length > 0;
    elements.saveBtn.disabled = !hasItems;
    elements.convertBtn.disabled = !hasItems;
    elements.pdfBtn.disabled = !hasItems;
    elements.whatsappBtn.disabled = !hasItems;
}

// Carregar clientes
async function loadCustomers() {
    try {
        const { data, error } = await supabaseClient
            .from('clientes')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .order('nome');
            
        if (error) throw error;
        customers = data || [];
        displayCustomers(customers);
        
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        elements.customerList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erro ao carregar clientes</p>
            </div>
        `;
    }
}

// Exibir clientes
function displayCustomers(customerList) {
    if (customerList.length === 0) {
        elements.customerList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>Nenhum cliente encontrado</p>
            </div>
        `;
        return;
    }
    
    elements.customerList.innerHTML = customerList.map(customer => `
        <div class="customer-item" onclick="selectCustomer(${JSON.stringify(customer).replace(/"/g, '&quot;')})">
            <div class="customer-item-name">${customer.nome}</div>
            <div class="customer-item-details">
                ${customer.telefone ? `📞 ${utils.formatPhone(customer.telefone)}` : ''}
                ${customer.email ? ` • ✉️ ${customer.email}` : ''}
            </div>
        </div>
    `).join('');
}

// Selecionar cliente
function selectCustomer(customer) {
    orcamento.cliente = customer;
    elements.customerName.textContent = customer.nome;
    elements.customerContact.textContent = [
        customer.telefone ? utils.formatPhone(customer.telefone) : '',
        customer.email || ''
    ].filter(Boolean).join(' • ');
    
    elements.customerDisplay.style.display = 'flex';
    closeModal('customer-modal');
    utils.showNotification(`Cliente ${customer.nome} selecionado`, 'success');
}

// Remover cliente
function removeCustomer() {
    orcamento.cliente = null;
    elements.customerDisplay.style.display = 'none';
    utils.showNotification('Cliente removido', 'success');
}

// Salvar orçamento
async function saveOrcamento() {
    if (orcamento.items.length === 0) {
        utils.showNotification('Adicione produtos antes de salvar', 'warning');
        return;
    }
    
    try {
        elements.saveBtn.innerHTML = '<div class="loading"></div> Salvando...';
        elements.saveBtn.disabled = true;
        
        const data = {
            numero: orcamento.numero || utils.generateNumber(),
            data_orcamento: new Date().toISOString().split('T')[0],
            id_cliente: orcamento.cliente?.id || null,
            cliente_nome: orcamento.cliente?.nome || null,
            itens: JSON.stringify(orcamento.items),
            subtotal: orcamento.totals.subtotal,
            desconto_tipo: orcamento.desconto.tipo,
            desconto_valor: orcamento.desconto.valor,
            desconto: orcamento.totals.desconto,
            frete: orcamento.totals.frete,
            total: orcamento.totals.total,
            observacoes: orcamento.observacoes,
            status: 'rascunho',
            id_empresa: window.currentCompanyId,
            id_usuario: window.currentUser?.id
        };
        
        let result;
        if (orcamento.id) {
            const { data: updateData, error } = await supabaseClient
                .from('orcamentos')
                .update(data)
                .eq('id', orcamento.id)
                .select()
                .single();
            if (error) throw error;
            result = updateData;
        } else {
            const { data: insertData, error } = await supabaseClient
                .from('orcamentos')
                .insert([data])
                .select()
                .single();
            if (error) throw error;
            result = insertData;
            orcamento.id = result.id;
        }
        
        orcamento.numero = result.numero;
        elements.orcamentoNumber.textContent = result.numero;
        utils.showNotification('Orçamento salvo com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao salvar:', error);
        utils.showNotification('Erro ao salvar orçamento', 'error');
    } finally {
        elements.saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Orçamento';
        elements.saveBtn.disabled = false;
    }
}

// Converter em venda
async function convertToSale() {
    if (orcamento.items.length === 0) {
        utils.showNotification('Adicione produtos antes de converter', 'warning');
        return;
    }
    
    // Salvar orçamento primeiro se não foi salvo
    if (!orcamento.id) {
        await saveOrcamento();
    }
    
    // Preparar dados para venda
    const saleData = {
        source: 'orcamento',
        orcamento_id: orcamento.id,
        cliente: orcamento.cliente,
        items: orcamento.items,
        desconto: orcamento.desconto,
        frete: orcamento.frete,
        observacoes: orcamento.observacoes,
        totals: orcamento.totals
    };
    
    localStorage.setItem('pendingSaleData', JSON.stringify(saleData));
    utils.showNotification('Redirecionando para vendas...', 'success');
    
    setTimeout(() => {
        window.location.href = 'nova-venda.html';
    }, 1000);
}

// Gerar PDF
function generatePDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(20);
        doc.text('ORÇAMENTO', 105, 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.text(`Número: ${orcamento.numero || 'Novo'}`, 20, 40);
        doc.text(`Data: ${utils.formatDate()}`, 20, 50);
        
        if (orcamento.cliente) {
            doc.text('CLIENTE:', 20, 70);
            doc.text(orcamento.cliente.nome, 20, 80);
            if (orcamento.cliente.telefone) {
                doc.text(`Tel: ${utils.formatPhone(orcamento.cliente.telefone)}`, 20, 90);
            }
        }
        
        // Items
        let y = orcamento.cliente ? 110 : 80;
        doc.text('ITENS:', 20, y);
        y += 15;
        
        orcamento.items.forEach((item, index) => {
            doc.text(`${index + 1}. ${item.nome}`, 20, y);
            doc.text(`Qtd: ${item.quantidade} x ${utils.formatCurrency(item.preco_unitario)}`, 30, y + 10);
            doc.text(`Total: ${utils.formatCurrency(item.total)}`, 150, y + 10);
            y += 25;
        });
        
        // Totals
        y += 10;
        doc.text(`Subtotal: ${utils.formatCurrency(orcamento.totals.subtotal)}`, 150, y);
        if (orcamento.totals.desconto > 0) {
            y += 10;
            doc.text(`Desconto: -${utils.formatCurrency(orcamento.totals.desconto)}`, 150, y);
        }
        if (orcamento.totals.frete > 0) {
            y += 10;
            doc.text(`Frete: ${utils.formatCurrency(orcamento.totals.frete)}`, 150, y);
        }
        y += 15;
        doc.setFontSize(14);
        doc.text(`TOTAL: ${utils.formatCurrency(orcamento.totals.total)}`, 150, y);
        
        if (orcamento.observacoes) {
            y += 20;
            doc.setFontSize(12);
            doc.text('OBSERVAÇÕES:', 20, y);
            doc.text(orcamento.observacoes, 20, y + 10);
        }
        
        doc.save(`Orcamento_${orcamento.numero || 'Novo'}.pdf`);
        utils.showNotification('PDF gerado com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        utils.showNotification('Erro ao gerar PDF', 'error');
    }
}

// Enviar WhatsApp
function sendWhatsApp() {
    let message = `*ORÇAMENTO ${orcamento.numero || 'NOVO'}*\n`;
    message += `Data: ${utils.formatDate()}\n\n`;
    
    if (orcamento.cliente) {
        message += `*Cliente:* ${orcamento.cliente.nome}\n\n`;
    }
    
    message += `*ITENS:*\n`;
    orcamento.items.forEach((item, index) => {
        message += `${index + 1}. ${item.nome}\n`;
        message += `   Qtd: ${item.quantidade} x ${utils.formatCurrency(item.preco_unitario)} = ${utils.formatCurrency(item.total)}\n`;
    });
    
    message += `\n*TOTAL: ${utils.formatCurrency(orcamento.totals.total)}*`;
    
    if (orcamento.observacoes) {
        message += `\n\n*Observações:*\n${orcamento.observacoes}`;
    }
    
    let phone = '';
    if (orcamento.cliente?.telefone) {
        phone = orcamento.cliente.telefone.replace(/\D/g, '');
        if (phone.length === 11) phone = '55' + phone;
        else if (phone.length === 10) phone = '55' + phone;
    }
    
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    utils.showNotification('Abrindo WhatsApp...', 'success');
}

// Limpar orçamento
function clearOrcamento() {
    if (orcamento.items.length === 0 && !orcamento.cliente) return;
    
    if (confirm('Limpar orçamento atual?')) {
        newOrcamento();
        utils.showNotification('Orçamento limpo', 'success');
    }
}

// Novo orçamento
function newOrcamento() {
    orcamento = {
        id: null,
        numero: null,
        cliente: null,
        items: [],
        desconto: { tipo: 'percent', valor: 0 },
        frete: 0,
        observacoes: '',
        totals: { subtotal: 0, desconto: 0, frete: 0, total: 0 }
    };
    
    elements.orcamentoNumber.textContent = 'Novo';
    elements.orcamentoDate.textContent = utils.formatDate();
    elements.customerDisplay.style.display = 'none';
    elements.discountInput.value = '';
    elements.freightInput.value = '';
    elements.observations.value = '';
    
    updateCart();
    calculateTotals();
}

// Listar orçamentos
async function listOrcamentos() {
    try {
        openModal('list-modal');
        elements.orcamentosTable.innerHTML = '<div class="loading" style="margin: 2rem auto;"></div>';
        
        const { data, error } = await supabaseClient
            .from('orcamentos')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .order('created_at', { ascending: false })
            .limit(50);
            
        if (error) throw error;
        
        if (!data || data.length === 0) {
            elements.orcamentosTable.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-invoice"></i>
                    <h3>Nenhum orçamento encontrado</h3>
                </div>
            `;
            return;
        }
        
        elements.orcamentosTable.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Número</th>
                        <th>Cliente</th>
                        <th>Data</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(orc => `
                        <tr>
                            <td><strong>${orc.numero}</strong></td>
                            <td>${orc.cliente_nome || 'Sem cliente'}</td>
                            <td>${utils.formatDate(orc.data_orcamento)}</td>
                            <td><strong>${utils.formatCurrency(orc.total)}</strong></td>
                            <td><span class="status-badge status-${orc.status}">${orc.status}</span></td>
                            <td class="table-actions">
                                <button class="btn-sm btn-view" onclick="loadOrcamento(${orc.id})" title="Carregar">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn-sm btn-delete" onclick="deleteOrcamento(${orc.id})" title="Excluir">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
    } catch (error) {
        console.error('Erro ao listar orçamentos:', error);
        elements.orcamentosTable.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Erro ao carregar orçamentos</h3>
            </div>
        `;
    }
}

// Carregar orçamento específico
async function loadOrcamento(id) {
    try {
        const { data, error } = await supabaseClient
            .from('orcamentos')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error) throw error;
        
        orcamento.id = data.id;
        orcamento.numero = data.numero;
        orcamento.items = JSON.parse(data.itens || '[]');
        orcamento.desconto = {
            tipo: data.desconto_tipo || 'percent',
            valor: data.desconto_valor || 0
        };
        orcamento.frete = data.frete || 0;
        orcamento.observacoes = data.observacoes || '';
        
        if (data.id_cliente) {
            orcamento.cliente = {
                id: data.id_cliente,
                nome: data.cliente_nome
            };
        }
        
        elements.orcamentoNumber.textContent = data.numero;
        elements.orcamentoDate.textContent = utils.formatDate(data.data_orcamento);
        elements.discountInput.value = orcamento.desconto.valor;
        elements.freightInput.value = orcamento.frete;
        elements.observations.value = orcamento.observacoes;
        
        if (orcamento.cliente) {
            elements.customerName.textContent = orcamento.cliente.nome;
            elements.customerDisplay.style.display = 'flex';
        }
        
        updateCart();
        calculateTotals();
        closeModal('list-modal');
        utils.showNotification('Orçamento carregado', 'success');
        
    } catch (error) {
        console.error('Erro ao carregar orçamento:', error);
        utils.showNotification('Erro ao carregar orçamento', 'error');
    }
}

// Deletar orçamento
async function deleteOrcamento(id) {
    if (!confirm('Excluir este orçamento?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('orcamentos')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        
        utils.showNotification('Orçamento excluído', 'success');
        listOrcamentos(); // Recarregar lista
        
    } catch (error) {
        console.error('Erro ao excluir:', error);
        utils.showNotification('Erro ao excluir orçamento', 'error');
    }
}

// === MODAIS ===
function openModal(modalId) {
    const modal = $(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = $(modalId);
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

// === EVENT LISTENERS ===

// Busca de produtos
elements.searchInput?.addEventListener('input', (e) => {
    searchProducts(e.target.value.trim());
});

// Busca de clientes
elements.customerSearch?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const filtered = customers.filter(customer => 
        customer.nome.toLowerCase().includes(query) ||
        (customer.telefone && customer.telefone.includes(query)) ||
        (customer.email && customer.email.toLowerCase().includes(query))
    );
    displayCustomers(filtered);
});

// Desconto
elements.discountType?.addEventListener('click', () => {
   orcamento.desconto.tipo = orcamento.desconto.tipo === 'percent' ? 'value' : 'percent';
   elements.discountType.textContent = orcamento.desconto.tipo === 'percent' ? '%' : 'R$';
   calculateTotals();
});

elements.discountInput?.addEventListener('input', (e) => {
    orcamento.desconto.valor = parseFloat(e.target.value) || 0;
    calculateTotals();
});

// Frete
elements.freightInput?.addEventListener('input', (e) => {
    orcamento.frete = parseFloat(e.target.value) || 0;
    calculateTotals();
});

// Observações
elements.observations?.addEventListener('input', (e) => {
    orcamento.observacoes = e.target.value;
});

// Botões principais
elements.customerBtn?.addEventListener('click', () => {
    openModal('customer-modal');
    loadCustomers();
});

elements.removeCustomerBtn?.addEventListener('click', removeCustomer);
elements.clearBtn?.addEventListener('click', clearOrcamento);
elements.newBtn?.addEventListener('click', newOrcamento);
elements.saveBtn?.addEventListener('click', saveOrcamento);
elements.convertBtn?.addEventListener('click', convertToSale);
elements.pdfBtn?.addEventListener('click', generatePDF);
elements.whatsappBtn?.addEventListener('click', sendWhatsApp);
elements.listBtn?.addEventListener('click', listOrcamentos);

// Modais - fechar
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-close')) {
        const modal = e.target.closest('.modal');
        if (modal) modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
    
    if (e.target.classList.contains('modal')) {
        e.target.classList.add('hidden');
        document.body.style.overflow = '';
    }
});

// ESC para fechar modais
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const openModal = $('.modal:not(.hidden)');
        if (openModal) {
            openModal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }
});

// === INICIALIZAÇÃO ===
function initOrcamento() {
    if (!window.currentCompanyId || !window.currentUser) {
        setTimeout(initOrcamento, 500);
        return;
    }
    
    newOrcamento();
    console.log('✅ Sistema de orçamentos inicializado');
}

// Aguardar dados do usuário
document.addEventListener('userDataReady', initOrcamento);

// Fallback se já estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initOrcamento, 1000);
});

console.log('🚀 Módulo de orçamentos carregado');