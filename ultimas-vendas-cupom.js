// ultimas-vendas-cupom.js - Sistema de Comprovantes para Últimas Vendas
// =====================================================================

/**
 * Gera e imprime comprovante de venda das últimas vendas
 * @param {String} saleId - ID da venda
 * @param {Object} saleData - Dados da venda (opcional, se não fornecido será buscado)
 */
async function gerarComprovanteUltimasVendas(saleId, saleData = null) {
    try {
        console.log('🖨️ Gerando comprovante para venda:', saleId);
        
        // Se não tiver dados da venda, buscar no banco
        if (!saleData) {
            saleData = await buscarDadosVenda(saleId);
        }
        
        // Buscar dados da empresa
        const companyData = await getCompanyDataCupom();
        
        // Gerar HTML do comprovante
        const comprovanteHTML = generateComprovanteHTML(saleData, saleId, companyData);
        
        // Abrir janela de impressão
        openPrintWindowCupom(comprovanteHTML);
        
        return {
            success: true,
            message: 'Comprovante gerado com sucesso!'
        };
        
    } catch (error) {
        console.error('❌ Erro ao gerar comprovante:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Busca dados completos da venda no Supabase
 */
async function buscarDadosVenda(saleId) {
    try {
        console.log('🔍 Buscando dados da venda:', saleId);
        
        // Buscar dados da venda principal
        const { data: vendaData, error: vendaError } = await supabaseClient
            .from('vendas')
            .select('*')
            .eq('id_venda', saleId)
            .eq('id_empresa', window.currentCompanyId);

        if (vendaError) throw vendaError;
        
        if (!vendaData || vendaData.length === 0) {
            throw new Error('Venda não encontrada');
        }

        // Agrupar itens da venda
        const items = vendaData.map(item => ({
            nome: item.produto_nome,
            codigo_sku: item.codigo_sku,
            quantity: item.quantidade_unit,
            preco_venda: item.preco_unit,
            desconto_unit: item.desconto_unit || 0,
            subtotal: item.preco_unit * item.quantidade_unit
        }));

        // Dados da venda principal (pegar do primeiro item)
        const venda = vendaData[0];
        
        return {
            id_venda: saleId,
            cliente_nome: venda.cliente_nome,
            hora_venda: venda.hora_venda,
            total_venda: venda.total_venda,
            forma_pagamento: venda.forma_pagamento,
            vendedor_id: venda.vendedor_id,
            items: items,
            totals: {
                subtotal: items.reduce((acc, item) => acc + item.subtotal, 0),
                totalDiscount: items.reduce((acc, item) => acc + (item.desconto_unit * item.quantity), 0),
                total: venda.total_venda
            }
        };
        
    } catch (error) {
        console.error('❌ Erro ao buscar dados da venda:', error);
        throw error;
    }
}

/**
 * Busca dados da empresa no Supabase
 */
async function getCompanyDataCupom() {
    try {
        const { data, error } = await supabaseClient
            .from('empresas')
            .select('*')
            .eq('id', window.currentCompanyId)
            .single();

        if (error) throw error;

        return data || {
            nome: 'Lume Sistemas',
            endereco: 'Endereço não cadastrado',
            telefone: 'Telefone não cadastrado',
            cnpj: 'CNPJ não cadastrado',
            email: 'email@empresa.com'
        };

    } catch (error) {
        console.warn('⚠️ Erro ao buscar dados da empresa:', error);
        return {
            nome: 'Lume Sistemas',
            endereco: 'Endereço não cadastrado',
            telefone: 'Telefone não cadastrado', 
            cnpj: 'CNPJ não cadastrado',
            email: 'email@empresa.com'
        };
    }
}

/**
 * Gera HTML do comprovante
 */
function generateComprovanteHTML(saleData, saleId, companyData) {
    const dataVenda = new Date(saleData.hora_venda).toLocaleDateString('pt-BR');
    const horaVenda = new Date(saleData.hora_venda).toLocaleTimeString('pt-BR');
    
    // Calcular totais
    const subtotal = saleData.totals?.subtotal || saleData.items.reduce((acc, item) => acc + item.subtotal, 0);
    const totalDesconto = saleData.totals?.totalDiscount || 0;
    const total = saleData.totals?.total || saleData.total_venda;
    
    // Gerar lista de itens
    const itensHTML = saleData.items.map((item, index) => {
        const subtotalItem = item.preco_venda * item.quantity;
        const desconto = item.desconto_unit || 0;
        const totalItem = subtotalItem - (desconto * item.quantity);
        
        return `
            <tr class="item-row">
                <td>${String(index + 1).padStart(3, '0')}</td>
                <td>${item.codigo_sku || 'N/A'}</td>
                <td class="item-desc">${item.nome}</td>
                <td class="text-right">${formatCurrencyComprovante(item.preco_venda)}</td>
            </tr>
            <tr class="item-details">
                <td></td>
                <td colspan="2">${item.quantity}x ${formatCurrencyComprovante(item.preco_venda)}</td>
                <td class="text-right">${formatCurrencyComprovante(totalItem)}</td>
            </tr>
            ${desconto > 0 ? `
            <tr class="discount-row">
                <td></td>
                <td colspan="2">Desconto Unit.</td>
                <td class="text-right">-${formatCurrencyComprovante(desconto * item.quantity)}</td>
            </tr>` : ''}
        `;
    }).join('');

    // Buscar nome do vendedor
    const vendedorNome = window.currentUser?.nome || 'Sistema';
    
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comprovante de Venda - ${saleId}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.2;
            color: #000;
            background: white;
            width: 80mm;
            margin: 0 auto;
            padding: 5mm;
        }
        
        @media print {
            body { margin: 0; padding: 2mm; }
            .no-print { display: none !important; }
        }
        
        .comprovante-container {
            max-width: 70mm;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 8px;
            margin-bottom: 8px;
        }
        
        .company-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 4px;
            text-transform: uppercase;
        }
        
        .company-info {
            font-size: 10px;
            line-height: 1.3;
            margin-bottom: 2px;
        }
        
        .comprovante-title {
            font-size: 14px;
            font-weight: bold;
            margin: 8px 0;
            text-align: center;
            letter-spacing: 1px;
        }
        
        .sale-info {
            border-bottom: 1px dashed #000;
            padding-bottom: 6px;
            margin-bottom: 8px;
        }
        
        .sale-info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
            font-size: 11px;
        }
        
        .items-header {
            border-bottom: 1px solid #000;
            padding: 4px 0;
            font-weight: bold;
            text-align: center;
            margin-bottom: 4px;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
        }
        
        .items-table td {
            padding: 1px 2px;
            font-size: 10px;
            vertical-align: top;
        }
        
        .item-row td:first-child {
            width: 8%;
        }
        
        .item-row td:nth-child(2) {
            width: 15%;
        }
        
        .item-row td:nth-child(3) {
            width: 50%;
        }
        
        .item-row td:last-child {
            width: 27%;
        }
        
        .item-desc {
            word-wrap: break-word;
            max-width: 100px;
        }
        
        .item-details {
            font-size: 9px;
            color: #333;
        }
        
        .discount-row {
            font-size: 9px;
            color: #666;
            font-style: italic;
        }
        
        .text-right {
            text-align: right;
        }
        
        .totals {
            border-top: 1px dashed #000;
            padding-top: 6px;
            margin-top: 8px;
        }
        
        .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
            font-size: 11px;
        }
        
        .total-final {
            font-size: 14px;
            font-weight: bold;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            padding: 4px 0;
            margin: 4px 0;
        }
        
        .payment-info {
            border-top: 1px dashed #000;
            padding-top: 6px;
            margin-top: 8px;
            font-size: 11px;
        }
        
        .footer {
            border-top: 1px dashed #000;
            padding-top: 8px;
            margin-top: 12px;
            text-align: center;
            font-size: 10px;
            line-height: 1.4;
        }
        
        .footer-msg {
            margin: 4px 0;
            font-style: italic;
        }
        
        .print-buttons {
            text-align: center;
            margin: 20px 0;
            padding: 10px;
            background: #f0f0f0;
            border-radius: 5px;
        }
        
        .btn {
            background: #FF9800;
            color: white;
            border: none;
            padding: 10px 20px;
            margin: 0 5px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        }
        
        .btn:hover {
            background: #e68a00;
        }
        
        .btn-secondary {
            background: #6c757d;
        }
        
        .btn-secondary:hover {
            background: #545b62;
        }
    </style>
</head>
<body>
    <div class="comprovante-container">
        <!-- Cabeçalho da Empresa -->
        <div class="header">
            <div class="company-name">${companyData.nome || 'LUME SISTEMAS'}</div>
            <div class="company-info">${companyData.endereco || 'Endereço não cadastrado'}</div>
            <div class="company-info">Tel: ${companyData.telefone || '(00) 0000-0000'}</div>
            <div class="company-info">CNPJ: ${companyData.cnpj || '00.000.000/0001-00'}</div>
        </div>
        
        <!-- Título do Comprovante -->
        <div class="comprovante-title">COMPROVANTE DE VENDA</div>
        
        <!-- Informações da Venda -->
        <div class="sale-info">
            <div class="sale-info-row">
                <span>VENDA:</span>
                <span>#${saleId}</span>
            </div>
            <div class="sale-info-row">
                <span>DATA:</span>
                <span>${dataVenda}</span>
            </div>
            <div class="sale-info-row">
                <span>HORA:</span>
                <span>${horaVenda}</span>
            </div>
            ${saleData.cliente_nome ? `
            <div class="sale-info-row">
                <span>CLIENTE:</span>
                <span>${saleData.cliente_nome}</span>
            </div>` : ''}
            <div class="sale-info-row">
                <span>VENDEDOR:</span>
                <span>${vendedorNome}</span>
            </div>
        </div>
        
        <!-- Cabeçalho dos Itens -->
        <div class="items-header">ITENS VENDIDOS</div>
        
        <!-- Lista de Itens -->
        <table class="items-table">
            <thead>
                <tr style="font-size: 9px; border-bottom: 1px solid #000;">
                    <th>COD</th>
                    <th>SKU</th>
                    <th>DESCRIÇÃO</th>
                    <th class="text-right">VALOR</th>
                </tr>
            </thead>
            <tbody>
                ${itensHTML}
            </tbody>
        </table>
        
        <!-- Totais -->
        <div class="totals">
            <div class="total-row">
                <span>SUBTOTAL:</span>
                <span>${formatCurrencyComprovante(subtotal)}</span>
            </div>
            ${totalDesconto > 0 ? `
            <div class="total-row">
                <span>DESCONTO:</span>
                <span>-${formatCurrencyComprovante(totalDesconto)}</span>
            </div>` : ''}
            <div class="total-row total-final">
                <span>TOTAL:</span>
                <span>${formatCurrencyComprovante(total)}</span>
            </div>
        </div>
        
        <!-- Informações de Pagamento -->
        <div class="payment-info">
            <div class="total-row">
                <span>PAGAMENTO:</span>
                <span>${saleData.forma_pagamento || 'Não informado'}</span>
            </div>
        </div>
        
        <!-- Rodapé -->
        <div class="footer">
            <div class="footer-msg">Obrigado pela preferência!</div>
            <div class="footer-msg">Volte sempre!</div>
            <div style="margin-top: 8px; font-size: 8px;">
                Sistema Lume - ${new Date().toLocaleString('pt-BR')}
            </div>
        </div>
    </div>
    
    <!-- Botões de Ação (não aparecem na impressão) -->
    <div class="print-buttons no-print">
        <button class="btn" onclick="window.print()">
            🖨️ Imprimir Comprovante
        </button>
        <button class="btn btn-secondary" onclick="window.close()">
            ❌ Fechar
        </button>
    </div>

    <script>
        // Auto-foco na impressão quando abre a janela
        window.onload = function() {
            setTimeout(() => {
                window.print();
            }, 500);
        };
        
        window.onafterprint = function() {
            console.log('Impressão concluída ou cancelada');
        };
    </script>
</body>
</html>`;
}

/**
 * Formata valores monetários para o comprovante
 */
function formatCurrencyComprovante(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

/**
 * Abre janela de impressão
 */
function openPrintWindowCupom(htmlContent) {
    const printWindow = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
    
    if (!printWindow) {
        alert('Bloqueador de pop-up detectado! Permita pop-ups para imprimir o comprovante.');
        return;
    }
    
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    printWindow.focus();
}

/**
 * Função principal para gerar comprovante de venda única
 */
window.gerarComprovanteVenda = async function(saleId, saleData = null) {
    console.log('🖨️ Iniciando geração de comprovante...');
    console.log('ID da venda:', saleId);
    console.log('Dados da venda:', saleData);
    
    const result = await gerarComprovanteUltimasVendas(saleId, saleData);
    
    if (result.success) {
        showNotification('Comprovante gerado! Janela de impressão aberta.', 'success');
    } else {
        showNotification('Erro ao gerar comprovante: ' + result.error, 'error');
    }
    
    return result;
};

// Log de carregamento
console.log('✅ Sistema de comprovantes de últimas vendas carregado');
console.log('Função disponível: gerarComprovanteVenda(saleId, saleData)');