// ultimas-vendas-modal.js - Modais e Ações para Últimas Vendas (Agrupado por ID_VENDA)
// =====================================================================================

function showReceiptModal(sale) {
    console.log('🧾 Abrindo modal de comprovante para venda:', sale.id_venda);
    
    const receiptContent = `
        <div class="receipt-content">
            <div class="receipt-header">
                <h4>COMPROVANTE DE VENDA</h4>
                <p>Venda Nº: ${sale.id_venda}</p>
                <p>${formatDate(sale.hora_venda)} - ${formatTime(sale.hora_venda)}</p>
            </div>
            <div class="receipt-customer">
                <p><strong>Cliente:</strong> ${sale.cliente_nome || 'Não informado'}</p>
            </div>
            <div class="receipt-total">
                <p><strong>Total:</strong> R$ ${formatCurrency(sale.total_venda)}</p>
                <p><strong>Pagamento:</strong> ${sale.forma_pagamento || 'Dinheiro'}</p>
            </div>
        </div>
    `;
    
    document.getElementById('receipt-content').innerHTML = receiptContent;
    document.getElementById('receipt-modal').classList.add('show');
}

function showReturnModal(sale) {
    console.log('↩️ Abrindo modal de devolução para venda:', sale.id_venda);
    
    document.getElementById('return-sale-number').textContent = sale.id_venda;
    document.getElementById('return-customer-name').textContent = sale.cliente_nome || 'Não informado';
    document.getElementById('return-sale-total').textContent = `R$ ${formatCurrency(sale.total_venda)}`;
    
    document.getElementById('return-modal').classList.add('show');
}

// --- Modal de detalhes da venda ---
async function showSaleDetailsModal(saleId) {
    console.log('👁️ Abrindo modal de detalhes para venda:', saleId);
    
    try {
        // Buscar todos os itens da venda
        const { data: saleItems, error } = await supabaseClient
            .from('vendas')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .eq('id_venda', saleId)
            .order('produto_nome', { ascending: true });

        if (error) throw error;

        if (!saleItems || saleItems.length === 0) {
            console.error('❌ Nenhum item encontrado para a venda:', saleId);
            return;
        }

        const firstItem = saleItems[0];
        const vendorName = state.vendors.get(firstItem.vendedor_id) || 'N/A';
        
        // Cabeçalho com informações da venda
        const saleInfoHtml = `
            <div class="sale-info-item">
                <label>Número da Venda</label>
                <span>#${firstItem.id_venda}</span>
            </div>
            <div class="sale-info-item">
                <label>Data/Hora</label>
                <span>${formatDate(firstItem.hora_venda)} às ${formatTime(firstItem.hora_venda)}</span>
            </div>
            <div class="sale-info-item">
                <label>Cliente</label>
                <span>${firstItem.cliente_nome || 'Cliente não informado'}</span>
            </div>
            <div class="sale-info-item">
                <label>Total da Venda</label>
                <span>R$ ${formatCurrency(firstItem.total_venda)}</span>
            </div>
            <div class="sale-info-item">
                <label>Forma de Pagamento</label>
                <span>${firstItem.forma_pagamento || 'Dinheiro'}</span>
            </div>
            <div class="sale-info-item">
                <label>Vendedor</label>
                <span>${vendorName}</span>
            </div>
        `;
        
        // Itens da venda
        const itemsHtml = saleItems.map(item => {
            const subtotal = (item.preco_unitario || 0) * (item.quantidade_unit || 0);
            const discountAmount = item.tipo_desconto_unit === 'percent' 
                ? subtotal * ((item.valor_desconto_unit || 0) / 100)
                : (item.valor_desconto_unit || 0) * (item.quantidade_unit || 0);
            
            // Verificar campos SKU disponíveis
            const skuField = item.produto_sku || item.codigo_sku || item.sku || 'N/A';
            console.log('🔍 Debug SKU para item:', {
                id: item.id,
                produto_sku: item.produto_sku, // Campo correto na tabela vendas
                codigo_sku: item.codigo_sku,
                sku: item.sku,
                skuField: skuField
            });
            
            return `
                <tr>
                    <td class="item-name">${item.produto_nome || 'N/A'}</td>
                    <td class="item-sku">${skuField}</td>
                    <td class="item-quantity">${item.quantidade_unit || 0}</td>
                    <td class="item-price">R$ ${formatCurrency(item.preco_unitario)}</td>
                    <td class="item-discount">
                        ${discountAmount > 0 ? 
                            `R$ ${formatCurrency(discountAmount)} ${item.tipo_desconto_unit === 'percent' ? `(${item.valor_desconto_unit}%)` : ''}` 
                            : '-'
                        }
                    </td>
                    <td class="item-subtotal">R$ ${formatCurrency(item.subtotal_item || subtotal)}</td>
                    <td class="item-actions">
                        <div class="action-buttons">
                            <button class="btn-action details-btn" title="Ver Detalhes do Item" data-action="item-details" data-item-id="${item.id}">
                                <i class="fas fa-info-circle"></i>
                            </button>
                            ${skuField !== 'N/A' ? `
                            <button class="btn-action history-btn" title="Ver Movimentação" data-action="item-movement" data-item-sku="${skuField}">
                                <i class="fas fa-history"></i>
                            </button>
                            ` : `
                            <button class="btn-action history-btn" title="SKU não encontrado" disabled style="opacity: 0.3;">
                                <i class="fas fa-history"></i>
                            </button>
                            `}
                            <button class="btn-action return-btn" title="Devolver Item" data-action="item-return" data-item-id="${item.id}">
                                <i class="fas fa-undo"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Atualizar modal
        document.getElementById('sale-info-header').innerHTML = saleInfoHtml;
        document.getElementById('sale-items-tbody').innerHTML = itemsHtml;
        
        // Remover event listener anterior e adicionar novo
        const itemsTableBody = document.getElementById('sale-items-tbody');
        const existingHandler = itemsTableBody.getAttribute('data-handler-attached');
        
        if (!existingHandler) {
            itemsTableBody.addEventListener('click', handleItemAction);
            itemsTableBody.setAttribute('data-handler-attached', 'true');
        }
        
        document.getElementById('sale-details-modal').classList.add('show');
        
    } catch (error) {
        console.error('❌ Erro ao mostrar detalhes da venda:', error);
        alert('Erro ao carregar detalhes da venda.');
    }
}

// --- Handler para ações dos itens ---
function handleItemAction(e) {
    const button = e.target.closest('.btn-action');
    if (!button) return;

    const action = button.dataset.action;
    const itemId = parseInt(button.dataset.itemId);
    const itemSku = button.dataset.itemSku;

    console.log('🎬 Ação do item:', { action, itemId, itemSku });

    switch (action) {
        case 'item-details':
            showItemDetailsModal(itemId);
            break;
        case 'item-movement':
            // Validar SKU e chamar função de movimentação
            if (itemSku && itemSku !== 'N/A' && itemSku !== 'undefined') {
                console.log('✅ Abrindo movimentação para SKU:', itemSku);
                showMovementModal(itemSku);
            } else {
                console.error('❌ SKU inválido para movimentação:', itemSku);
                alert('SKU não encontrado ou inválido para mostrar movimentação.');
            }
            break;
        case 'item-return':
            showItemReturnModal(itemId);
            break;
    }
}

// --- Modal de detalhes do item ---
async function showItemDetailsModal(itemId) {
    console.log('👁️ Abrindo modal de detalhes para item:', itemId);
    
    try {
        const { data: itemData, error } = await supabaseClient
            .from('vendas')
            .select('*')
            .eq('id', itemId)
            .single();

        if (error) throw error;

        if (!itemData) {
            console.error('❌ Item não encontrado:', itemId);
            return;
        }

        // Gerar HTML com detalhes do item
        const detailsHtml = `
            <div class="details-grid">
                ${Object.entries(itemData).map(([key, value]) => {
                    let displayValue = value;
                    if (value === null || value === '') displayValue = '-';
                    else if (typeof value === 'boolean') displayValue = value ? 'Sim' : 'Não';
                    else if (key.includes('preco') || key.includes('valor') || key.includes('total')) displayValue = `R$ ${formatCurrency(value)}`;
                    else if (key.includes('hora_venda') || key.includes('created_at') || key.includes('updated_at')) displayValue = new Date(value).toLocaleString('pt-BR');
                    
                    return `<div class="detail-item"><label>${key.replace(/_/g, ' ')}</label><p>${displayValue}</p></div>`;
                }).join('')}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="showMovementModal('${itemData.produto_sku || itemData.codigo_sku}')">
                    <i class="fas fa-history"></i> Ver Movimentação
                </button>
            </div>
        `;
        
        document.getElementById('item-details-content').innerHTML = detailsHtml;
        document.getElementById('item-details-modal').classList.add('show');
        
    } catch (error) {
        console.error('❌ Erro ao mostrar detalhes do item:', error);
        alert('Erro ao carregar detalhes do item.');
    }
}

// --- Modal de devolução do item ---
async function showItemReturnModal(itemId) {
    console.log('↩️ Abrindo modal de devolução para item:', itemId);
    
    try {
        const { data: itemData, error } = await supabaseClient
            .from('vendas')
            .select('*')
            .eq('id', itemId)
            .single();

        if (error) throw error;

        if (!itemData) {
            console.error('❌ Item não encontrado:', itemId);
            return;
        }

        // Preencher dados do modal
        document.getElementById('return-item-name').textContent = itemData.produto_nome || 'N/A';
        document.getElementById('return-item-sku').textContent = itemData.codigo_sku || 'N/A';
        document.getElementById('return-item-quantity').textContent = itemData.quantidade_unit || 0;
        document.getElementById('return-item-price').textContent = `R$ ${formatCurrency(itemData.preco_unitario)}`;
        
        // Configurar quantidade máxima para devolução
        const qtyInput = document.getElementById('return-item-qty');
        qtyInput.max = itemData.quantidade_unit || 1;
        qtyInput.value = 1;
        
        // Armazenar ID do item para confirmação
        document.getElementById('confirm-item-return-btn').dataset.itemId = itemId;
        
        document.getElementById('item-return-modal').classList.add('show');
        
    } catch (error) {
        console.error('❌ Erro ao mostrar modal de devolução do item:', error);
        alert('Erro ao carregar dados do item.');
    }
}

// --- Movimentação de produtos (delegação) ---
async function showMovementModal(sku) {
    // Delegar para o arquivo correto: ultimas-vendas-movimentacao.js
    if (window.showMovementModal && typeof window.showMovementModal === 'function') {
        console.log('📦 Chamando função de movimentação do arquivo correto...');
        return window.showMovementModal(sku);
    } else {
        console.error('❌ Função showMovementModal não encontrada no ultimas-vendas-movimentacao.js');
        alert('Erro: Sistema de movimentação não carregado.');
    }
}

function closeMovementModal() {
    // Delegar para o arquivo correto: ultimas-vendas-movimentacao.js
    if (window.closeMovementModal && typeof window.closeMovementModal === 'function') {
        return window.closeMovementModal();
    }
    
    // Fallback se a função não estiver disponível
    const modal = document.getElementById('movement-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// --- Criação de modais dinâmicos ---
function createModal(id, title, content, actions) {
    const container = document.getElementById('dynamic-container');
    container.innerHTML = `
        <div id="${id}" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">${content}</div>
                ${actions ? `<div class="modal-footer">${actions}</div>` : ''}
            </div>
        </div>
    `;
    
    const modal = document.getElementById(id);
    const closeModal = () => {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    };
    
    modal.querySelector('.close-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target.id === id) closeModal(); });
    
    setTimeout(() => modal.classList.add('show'), 10);
    return modal;
}

// --- Ações dos modais ---
function printSaleDetails() {
    console.log('🖨️ Função de impressão de detalhes ainda não implementada');
    alert('Função de impressão será implementada em breve...');
}

function sendSaleDetailsWhatsApp() {
    console.log('📱 Função de WhatsApp de detalhes ainda não implementada');
    alert('Função de WhatsApp será implementada em breve...');
}

function printReceipt(saleId) {
    console.log('🖨️ Gerando comprovante para venda:', saleId);
    if (window.gerarComprovanteVenda) {
        window.gerarComprovanteVenda(saleId);
    } else {
        console.error('Função de geração de comprovante não encontrada');
        alert('Erro ao gerar comprovante. Verifique se o arquivo ultimas-vendas-cupom.js está carregado.');
    }
}

function sendReceiptWhatsApp() {
    console.log('📱 Função de WhatsApp de comprovante ainda não implementada');
    alert('Função de WhatsApp será implementada em breve...');
}

function exportSelectedSales() {
    console.log('📊 Função de exportação ainda não implementada');
    const selectedCount = state.selectedIds.size;
    alert(`Função de exportação para ${selectedCount} vendas será implementada em breve...`);
}

function cancelSelectedSales(ids) {
    console.log('❌ Função de cancelamento ainda não implementada:', ids);
    alert(`Função de cancelamento para ${ids.length} vendas será implementada em breve...`);
}

function showConfirmModal(message, callback) {
    console.log('⚠️ Modal de confirmação:', message);
    if (confirm(message)) {
        callback();
    }
}

// --- Exportar funções para uso global ---
window.showReceiptModal = showReceiptModal;
window.showReturnModal = showReturnModal;
window.showSaleDetailsModal = showSaleDetailsModal;
window.showItemDetailsModal = showItemDetailsModal;
window.showItemReturnModal = showItemReturnModal;
window.handleItemAction = handleItemAction;
window.createModal = createModal;
window.printSaleDetails = printSaleDetails;
window.sendSaleDetailsWhatsApp = sendSaleDetailsWhatsApp;
window.printReceipt = printReceipt;
window.sendReceiptWhatsApp = sendReceiptWhatsApp;
window.exportSelectedSales = exportSelectedSales;
window.cancelSelectedSales = cancelSelectedSales;
window.showConfirmModal = showConfirmModal;


console.log('✅ Sistema de modais de últimas vendas (SEM DUPLICATAS) carregado');