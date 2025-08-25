// ===== LÓGICA PARA CANCELAMENTO DE VENDAS =====

/**
 * Cancela as vendas selecionadas
 * @param {Array} saleIds - Array com os IDs das vendas a serem canceladas
 */
async function cancelSelectedSales(saleIds) {
    console.log('🚫 Iniciando cancelamento de vendas:', saleIds);
    
    if (!saleIds || saleIds.length === 0) {
        console.warn('⚠️ Nenhuma venda selecionada para cancelamento');
        return;
    }
    
    try {
        // Mostrar loading
        const loadingModal = document.createElement('div');
        loadingModal.className = 'modal-overlay';
        loadingModal.innerHTML = `
            <div class="modal-content">
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Cancelando vendas...</p>
                </div>
            </div>
        `;
        document.body.appendChild(loadingModal);
        loadingModal.classList.add('show');
        
        // Buscar todas as vendas que serão canceladas
        const { data: vendasParaCancelar, error: errorBusca } = await supabaseClient
            .from('vendas')
            .select('*')
            .in('id_venda', saleIds)
            .eq('id_empresa', window.currentCompanyId);
            
        if (errorBusca) {
            throw new Error(`Erro ao buscar vendas: ${errorBusca.message}`);
        }
        
        if (!vendasParaCancelar || vendasParaCancelar.length === 0) {
            throw new Error('Nenhuma venda encontrada para cancelamento');
        }
        
        console.log(`📋 ${vendasParaCancelar.length} itens de venda encontrados para cancelamento`);
        
        // Preparar dados para inserir na tabela canceladas
        const vendasCanceladas = vendasParaCancelar.map(venda => ({
            id_venda_original: venda.id_venda,
            id_empresa: venda.id_empresa,
            cliente_nome: venda.cliente_nome,
            cliente_telefone: venda.cliente_telefone,
            cliente_email: venda.cliente_email,
            cliente_cpf: venda.cliente_cpf,
            produto_id: venda.produto_id,
            produto_nome: venda.produto_nome,
            produto_sku: venda.produto_sku,
            produto_preco: venda.produto_preco,
            quantidade: venda.quantidade,
            desconto: venda.desconto,
            total_item: venda.total_item,
            total_venda: venda.total_venda,
            forma_pagamento: venda.forma_pagamento,
            vendedor_id: venda.vendedor_id,
            hora_venda: venda.hora_venda,
            observacoes: venda.observacoes,
            status_original: venda.status,
            data_cancelamento: new Date().toISOString(),
            cancelado_por: window.currentUser?.id || null,
            motivo_cancelamento: 'Cancelamento via sistema'
        }));
        
        // Inserir na tabela canceladas
        const { error: errorInsert } = await supabaseClient
            .from('vendas_canceladas')
            .insert(vendasCanceladas);
            
        if (errorInsert) {
            throw new Error(`Erro ao inserir vendas canceladas: ${errorInsert.message}`);
        }
        
        console.log('✅ Vendas inseridas na tabela canceladas');
        
        // Deletar da tabela vendas
        const { error: errorDelete } = await supabaseClient
            .from('vendas')
            .delete()
            .in('id_venda', saleIds)
            .eq('id_empresa', window.currentCompanyId);
            
        if (errorDelete) {
            throw new Error(`Erro ao deletar vendas: ${errorDelete.message}`);
        }
        
        console.log('✅ Vendas deletadas da tabela principal');
        
        // Remover loading
        document.body.removeChild(loadingModal);
        
        // Mostrar sucesso
        showSuccessMessage(`${saleIds.length} venda(s) cancelada(s) com sucesso!`);
        
        // Limpar seleções e recarregar dados
        state.selectedIds.clear();
        const selectAllCheckbox = document.getElementById('select-all-checkbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
        }
        
        // Recarregar a lista de vendas
        await fetchSales();
        
    } catch (error) {
        console.error('❌ Erro ao cancelar vendas:', error);
        
        // Remover loading se existir
        const loadingModal = document.querySelector('.modal-overlay');
        if (loadingModal) {
            document.body.removeChild(loadingModal);
        }
        
        // Mostrar erro
        showErrorMessage(`Erro ao cancelar vendas: ${error.message}`);
    }
}

/**
 * Mostra mensagem de sucesso
 * @param {string} message - Mensagem a ser exibida
 */
function showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Mostrar toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remover após 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

/**
 * Mostra mensagem de erro
 * @param {string} message - Mensagem a ser exibida
 */
function showErrorMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Mostrar toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remover após 5 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

console.log('🚫 Módulo de cancelamento de vendas carregado');