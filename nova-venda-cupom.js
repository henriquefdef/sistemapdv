// nova-venda-cupom.js - Sistema Profissional de Impressão de Cupom
// ================================================================

/**
 * Gera e imprime cupom fiscal profissional
 * @param {Object} saleData - Dados completos da venda
 * @param {String} saleId - ID da venda
 */
async function printProfessionalCupom(saleData, saleId) {
    try {
        console.log('🖨️ Gerando cupom profissional para impressão...');
        
        // Buscar dados da empresa
        const companyData = await getCompanyData();
        
        // Gerar HTML do cupom
        const cupomHTML = generateCupomHTML(saleData, saleId, companyData);
        
        // Abrir janela de impressão
        openPrintWindow(cupomHTML);
        
        return {
            success: true,
            message: 'Cupom gerado com sucesso!'
        };
        
    } catch (error) {
        console.error('❌ Erro ao gerar cupom:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Busca dados da empresa no Supabase
 */
async function getCompanyData() {
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
 * Gera HTML profissional do cupom
 */
function generateCupomHTML(saleData, saleId, companyData) {
    const now = new Date();
    const dataVenda = now.toLocaleDateString('pt-BR');
    const horaVenda = now.toLocaleTimeString('pt-BR');
    
    // Calcular totais
    const subtotal = saleData.items.reduce((acc, item) => acc + (item.preco_venda * item.quantity), 0);
    const totalDesconto = saleData.totals?.totalDiscount || 0;
    const total = saleData.totals?.total || subtotal;
    
    // Gerar lista de itens
    const itensHTML = saleData.items.map((item, index) => {
        const subtotalItem = item.preco_venda * item.quantity;
        const desconto = item.discount?.value || 0;
        const totalItem = subtotalItem - (item.discount?.type === 'fixed' ? desconto * item.quantity : 
                         item.discount?.type === 'percent' ? subtotalItem * (desconto / 100) : 0);
        
        return `
            <tr class="item-row">
                <td>${String(index + 1).padStart(3, '0')}</td>
                <td>${item.codigo_sku || 'N/A'}</td>
                <td class="item-desc">${item.nome}</td>
                <td class="text-right">${formatCurrencyCupom(item.preco_venda)}</td>
            </tr>
            <tr class="item-details">
                <td></td>
                <td colspan="2">${item.quantity}x ${formatCurrencyCupom(item.preco_venda)}</td>
                <td class="text-right">${formatCurrencyCupom(totalItem)}</td>
            </tr>
            ${desconto > 0 ? `
            <tr class="discount-row">
                <td></td>
                <td colspan="2">Desconto ${item.discount.type === 'percent' ? desconto + '%' : formatCurrencyCupom(desconto)}</td>
                <td class="text-right">-${formatCurrencyCupom(item.discount.type === 'fixed' ? desconto * item.quantity : subtotalItem * (desconto / 100))}</td>
            </tr>` : ''}
        `;
    }).join('');

    // Informações de pagamento
    const pagamentoInfo = getPagamentoInfo(saleData.payment);
    
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cupom Fiscal - ${saleId}</title>
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
        
        .cupom-container {
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
        
        .cupom-title {
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
        
        .qr-placeholder {
            width: 80px;
            height: 80px;
            border: 1px dashed #000;
            margin: 8px auto;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            color: #666;
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
    <div class="cupom-container">
        <!-- Cabeçalho da Empresa -->
        <div class="header">
            <div class="company-name">${companyData.nome || 'LUME SISTEMAS'}</div>
            <div class="company-info">${companyData.endereco || 'Endereço não cadastrado'}</div>
            <div class="company-info">Tel: ${companyData.telefone || '(00) 0000-0000'}</div>
            <div class="company-info">CNPJ: ${companyData.cnpj || '00.000.000/0001-00'}</div>
        </div>
        
        <!-- Título do Cupom -->
        <div class="cupom-title">CUPOM NÃO FISCAL</div>
        
        <!-- Informações da Venda -->
        <div class="sale-info">
            <div class="sale-info-row">
                <span>CUPOM:</span>
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
            ${saleData.customer ? `
            <div class="sale-info-row">
                <span>CLIENTE:</span>
                <span>${saleData.customer.nome}</span>
            </div>` : ''}
            <div class="sale-info-row">
                <span>VENDEDOR:</span>
                <span>${window.currentUser?.nome || 'Sistema'}</span>
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
                <span>${formatCurrencyCupom(subtotal)}</span>
            </div>
            ${totalDesconto > 0 ? `
            <div class="total-row">
                <span>DESCONTO:</span>
                <span>-${formatCurrencyCupom(totalDesconto)}</span>
            </div>` : ''}
            ${saleData.adjustments?.freight > 0 ? `
            <div class="total-row">
                <span>FRETE:</span>
                <span>${formatCurrencyCupom(saleData.adjustments.freight)}</span>
            </div>` : ''}
            <div class="total-row total-final">
                <span>TOTAL:</span>
                <span>${formatCurrencyCupom(total)}</span>
            </div>
        </div>
        
        <!-- Informações de Pagamento -->
        <div class="payment-info">
            ${pagamentoInfo}
        </div>
        
        <!-- QR Code Placeholder -->
        <div class="qr-placeholder">
            QR CODE
        </div>
        
        <!-- Rodapé -->
        <div class="footer">
            <div class="footer-msg">Obrigado pela preferência!</div>
            <div class="footer-msg">Volte sempre!</div>
            <div style="margin-top: 8px; font-size: 8px;">
                Sistema Lume - ${now.toLocaleString('pt-BR')}
            </div>
        </div>
    </div>
    
    <!-- Botões de Ação (não aparecem na impressão) -->
    <div class="print-buttons no-print">
        <button class="btn" onclick="window.print()">
            🖨️ Imprimir Cupom
        </button>
        <button class="btn btn-secondary" onclick="window.close()">
            ❌ Fechar
        </button>
    </div>

    <script>
        // Auto-foco na impressão quando abre a janela
        window.onload = function() {
            // Aguarda um pouco para a página carregar completamente
            setTimeout(() => {
                window.print();
            }, 500);
        };
        
        // Detecta se usuário cancelou a impressão
        window.onafterprint = function() {
            console.log('Impressão concluída ou cancelada');
        };
    </script>
</body>
</html>`;
}

/**
 * Gera informações de pagamento formatadas
 */
function getPagamentoInfo(paymentData) {
    if (!paymentData) return '<div>Forma de pagamento: Dinheiro</div>';
    
    let info = `<div class="total-row"><span>PAGAMENTO:</span><span>${paymentData.method}</span></div>`;
    
    switch (paymentData.method) {
        case 'Dinheiro':
            if (paymentData.amountReceived && paymentData.change) {
                info += `
                    <div class="total-row"><span>RECEBIDO:</span><span>${formatCurrencyCupom(paymentData.amountReceived)}</span></div>
                    <div class="total-row"><span>TROCO:</span><span>${formatCurrencyCupom(paymentData.change)}</span></div>
                `;
            }
            break;
            
        case 'Cartao':
        case 'Cartão':
            info += `<div class="total-row"><span>MODALIDADE:</span><span>${paymentData.cardType || 'N/A'}</span></div>`;
            if (paymentData.installments > 1) {
                info += `<div class="total-row"><span>PARCELAS:</span><span>${paymentData.installments}x</span></div>`;
            }
            if (paymentData.fees > 0) {
                info += `<div class="total-row"><span>TAXA:</span><span>${formatCurrencyCupom(paymentData.fees)}</span></div>`;
            }
            break;
            
        case 'PIX':
            info += `<div style="font-size: 10px; margin-top: 4px;">Pagamento instantâneo via PIX</div>`;
            break;
            
        case 'Crediario':
            if (paymentData.crediarioInstallments) {
                info += `<div class="total-row"><span>PARCELAS:</span><span>${paymentData.crediarioInstallments}x</span></div>`;
            }
            break;
    }
    
    return info;
}

/**
 * Formata valores monetários para o cupom
 */
function formatCurrencyCupom(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

/**
 * Abre janela de impressão
 */
function openPrintWindow(htmlContent) {
    const printWindow = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
    
    if (!printWindow) {
        alert('Bloqueador de pop-up detectado! Permita pop-ups para imprimir o cupom.');
        return;
    }
    
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Foca na janela de impressão
    printWindow.focus();
}

/**
 * Função principal chamada pelo sistema de vendas
 */
window.imprimirCupomVenda = async function(saleData, saleId) {
    console.log('🖨️ Iniciando impressão de cupom...');
    console.log('Dados da venda:', saleData);
    console.log('ID da venda:', saleId);
    
    const result = await printProfessionalCupom(saleData, saleId);
    
    if (result.success) {
        showNotification('Cupom gerado! Janela de impressão aberta.', 'success');
    } else {
        showNotification('Erro ao gerar cupom: ' + result.error, 'error');
    }
    
    return result;
};

// Log de carregamento
console.log('✅ Sistema de impressão de cupom carregado');
console.log('Função disponível: imprimirCupomVenda(saleData, saleId)');