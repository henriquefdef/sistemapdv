// ===== LÓGICA PARA EXPORTAÇÃO DE VENDAS PARA EXCEL =====

/**
 * Exporta vendas para Excel com duas abas: Vendas e Vendas Canceladas
 */
async function exportToExcel() {
    console.log('📊 Iniciando exportação para Excel...');
    
    try {
        // Mostrar loading
        const loadingModal = document.createElement('div');
        loadingModal.className = 'modal-overlay';
        loadingModal.innerHTML = `
            <div class="modal-content">
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Gerando arquivo Excel...</p>
                </div>
            </div>
        `;
        document.body.appendChild(loadingModal);
        loadingModal.classList.add('show');
        
        // Buscar dados de vendas
        const vendasData = await fetchVendasForExcel();
        const vendasCanceladasData = await fetchVendasCanceladasForExcel();
        
        // Criar workbook
        const workbook = XLSX.utils.book_new();
        
        // Criar aba de vendas
        const vendasWorksheet = createVendasWorksheet(vendasData);
        XLSX.utils.book_append_sheet(workbook, vendasWorksheet, 'Vendas');
        
        // Criar aba de vendas canceladas
        const vendasCanceladasWorksheet = createVendasCanceladasWorksheet(vendasCanceladasData);
        XLSX.utils.book_append_sheet(workbook, vendasCanceladasWorksheet, 'Vendas Canceladas');
        
        // Gerar nome do arquivo com data
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `vendas_${dateStr}_${timeStr}.xlsx`;
        
        // Fazer download
        XLSX.writeFile(workbook, filename);
        
        // Remover loading
        document.body.removeChild(loadingModal);
        
        // Mostrar sucesso
        showSuccessMessage(`Arquivo Excel exportado com sucesso: ${filename}`);
        
        console.log('✅ Exportação concluída:', filename);
        
    } catch (error) {
        console.error('❌ Erro ao exportar Excel:', error);
        
        // Remover loading se existir
        const loadingModal = document.querySelector('.modal-overlay');
        if (loadingModal) {
            document.body.removeChild(loadingModal);
        }
        
        showErrorMessage(`Erro ao exportar Excel: ${error.message}`);
    }
}

/**
 * Busca dados de vendas para exportação
 */
async function fetchVendasForExcel() {
    console.log('🛒 Buscando dados de vendas para Excel...');
    
    let query = supabaseClient
        .from('vendas')
        .select(`
            id_venda,
            cliente_nome,
            produto_nome,
            produto_sku,
            preco_unitario,
            quantidade_unit,
            valor_desconto_unit,
            subtotal_item,
            total_venda,
            forma_pagamento,
            vendedor_id,
            hora_venda,
            status
        `)
        .eq('id_empresa', window.currentCompanyId);
    
    // Aplicar filtros de data se existirem
    if (state.filters.startDate) {
        query = query.gte('hora_venda', state.filters.startDate);
    }
    
    if (state.filters.endDate) {
        query = query.lte('hora_venda', `${state.filters.endDate} 23:59:59`);
    }
    
    // Aplicar outros filtros
    if (state.filters.paymentMethod) {
        query = query.eq('forma_pagamento', state.filters.paymentMethod);
    }
    
    if (state.filters.vendor) {
        query = query.eq('vendedor_id', state.filters.vendor);
    }
    
    query = query.order('hora_venda', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
        throw new Error(`Erro ao buscar vendas: ${error.message}`);
    }
    
    console.log(`✅ ${data.length} registros de vendas encontrados`);
    return data || [];
}

/**
 * Busca dados de vendas canceladas para exportação
 */
async function fetchVendasCanceladasForExcel() {
    console.log('🚫 Buscando dados de vendas canceladas para Excel...');
    
    let query = supabaseClient
        .from('vendas_canceladas')
        .select(`
            id_venda_original,
            cliente_nome,
            produto_nome,
            produto_sku,
            produto_preco,
            quantidade,
            desconto,
            total_item,
            total_venda,
            forma_pagamento,
            vendedor_id,
            hora_venda,
            status_original,
            data_cancelamento,
            cancelado_por,
            motivo_cancelamento
        `)
        .eq('id_empresa', window.currentCompanyId);
    
    // Aplicar filtros de data se existirem (baseado na data original da venda)
    if (state.filters.startDate) {
        query = query.gte('hora_venda', state.filters.startDate);
    }
    
    if (state.filters.endDate) {
        query = query.lte('hora_venda', `${state.filters.endDate} 23:59:59`);
    }
    
    query = query.order('data_cancelamento', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
        console.warn('⚠️ Tabela vendas_canceladas não encontrada ou erro:', error.message);
        return [];
    }
    
    console.log(`✅ ${data.length} registros de vendas canceladas encontrados`);
    return data || [];
}

/**
 * Cria worksheet para vendas
 */
function createVendasWorksheet(data) {
    console.log('📋 Criando worksheet de vendas...');
    
    // Preparar dados formatados
    const formattedData = data.map(venda => {
        const vendorName = state.vendors.get(venda.vendedor_id) || 'N/A';
        
        return {
            'ID Venda': venda.id_venda,
            'Data/Hora': formatDateTimeForExcel(venda.hora_venda),
            'Cliente': venda.cliente_nome || 'Não informado',
            'Produto': venda.produto_nome || '',
            'SKU': venda.produto_sku || '',
            'Preço Unitário': parseFloat(venda.preco_unitario || 0),
            'Quantidade': parseInt(venda.quantidade_unit || 0),
            'Desconto': parseFloat(venda.valor_desconto_unit || 0),
            'Total Item': parseFloat(venda.subtotal_item || 0),
            'Total Venda': parseFloat(venda.total_venda || 0),
            'Forma Pagamento': venda.forma_pagamento || 'Dinheiro',
            'Vendedor': vendorName,
            'Status': venda.status || 'VENDIDO'
        };
    });
    
    // Criar worksheet
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    
    // Definir larguras das colunas
    const columnWidths = [
        { wch: 12 }, // ID Venda
        { wch: 18 }, // Data/Hora
        { wch: 25 }, // Cliente
        { wch: 30 }, // Produto
        { wch: 15 }, // SKU
        { wch: 12 }, // Preço Unitário
        { wch: 10 }, // Quantidade
        { wch: 10 }, // Desconto
        { wch: 12 }, // Total Item
        { wch: 15 }, // Total Venda
         { wch: 15 }, // Forma Pagamento
         { wch: 20 }, // Vendedor
         { wch: 12 }  // Status
    ];
    
    worksheet['!cols'] = columnWidths;
    
    return worksheet;
}

/**
 * Cria worksheet para vendas canceladas
 */
function createVendasCanceladasWorksheet(data) {
    console.log('🚫 Criando worksheet de vendas canceladas...');
    
    if (data.length === 0) {
        // Criar worksheet vazio com cabeçalhos
        const emptyData = [{
            'ID Venda Original': '',
            'Data/Hora Venda': '',
            'Cliente': '',
            'Produto': '',
            'SKU': '',
            'Preço Unitário': '',
            'Quantidade': '',
            'Desconto': '',
            'Total Item': '',
            'Total Venda': '',
            'Forma Pagamento': '',
            'Vendedor': '',
            'Status Original': '',
            'Data Cancelamento': '',
            'Cancelado Por': '',
            'Motivo Cancelamento': ''
        }];
        
        const worksheet = XLSX.utils.json_to_sheet(emptyData);
        // Remover a linha de dados vazia, mantendo apenas o cabeçalho
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        range.e.r = 0; // Manter apenas a primeira linha (cabeçalho)
        worksheet['!ref'] = XLSX.utils.encode_range(range);
        
        return worksheet;
    }
    
    // Preparar dados formatados
    const formattedData = data.map(venda => {
        const vendorName = state.vendors.get(venda.vendedor_id) || 'N/A';
        const canceledByName = state.vendors.get(venda.cancelado_por) || 'N/A';
        
        return {
            'ID Venda Original': venda.id_venda_original,
            'Data/Hora Venda': formatDateTimeForExcel(venda.hora_venda),
            'Cliente': venda.cliente_nome || 'Não informado',
            'Produto': venda.produto_nome || '',
            'SKU': venda.produto_sku || '',
            'Preço Unitário': parseFloat(venda.produto_preco || 0),
            'Quantidade': parseInt(venda.quantidade || 0),
            'Desconto': parseFloat(venda.desconto || 0),
            'Total Item': parseFloat(venda.total_item || 0),
            'Total Venda': parseFloat(venda.total_venda || 0),
            'Forma Pagamento': venda.forma_pagamento || 'Dinheiro',
            'Vendedor': vendorName,
            'Status Original': venda.status_original || '',
            'Data Cancelamento': formatDateTimeForExcel(venda.data_cancelamento),
            'Cancelado Por': canceledByName,
            'Motivo Cancelamento': venda.motivo_cancelamento || ''
        };
    });
    
    // Criar worksheet
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    
    // Definir larguras das colunas
    const columnWidths = [
        { wch: 15 }, // ID Venda Original
        { wch: 18 }, // Data/Hora Venda
        { wch: 25 }, // Cliente
        { wch: 30 }, // Produto
        { wch: 15 }, // SKU
        { wch: 12 }, // Preço Unitário
        { wch: 10 }, // Quantidade
        { wch: 10 }, // Desconto
        { wch: 12 }, // Total Item
        { wch: 12 }, // Total Venda
        { wch: 15 }, // Forma Pagamento
        { wch: 20 }, // Vendedor
        { wch: 12 }, // Status Original
        { wch: 18 }, // Data Cancelamento
        { wch: 20 }, // Cancelado Por
        { wch: 30 }  // Motivo Cancelamento
    ];
    
    worksheet['!cols'] = columnWidths;
    
    return worksheet;
}

/**
 * Formata data e hora para Excel
 */
function formatDateTimeForExcel(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (error) {
        console.warn('⚠️ Erro ao formatar data:', dateString, error);
        return dateString;
    }
}

/**
 * Carrega a biblioteca SheetJS se não estiver carregada
 */
function loadSheetJSLibrary() {
    return new Promise((resolve, reject) => {
        // Verificar se já está carregada
        if (typeof XLSX !== 'undefined') {
            resolve();
            return;
        }
        
        // Carregar biblioteca
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = () => {
            console.log('✅ Biblioteca SheetJS carregada');
            resolve();
        };
        script.onerror = () => {
            reject(new Error('Erro ao carregar biblioteca SheetJS'));
        };
        document.head.appendChild(script);
    });
}

/**
 * Função principal de exportação que carrega a biblioteca e executa
 */
async function exportSelectedSales() {
    try {
        console.log('📊 Iniciando processo de exportação...');
        
        // Carregar biblioteca se necessário
        await loadSheetJSLibrary();
        
        // Executar exportação
        await exportToExcel();
        
    } catch (error) {
        console.error('❌ Erro no processo de exportação:', error);
        showErrorMessage(`Erro ao exportar: ${error.message}`);
    }
}

console.log('📊 Módulo de exportação Excel carregado');