// nova-venda-whats.js - Sistema Profissional de WhatsApp
// ================================================================

/**
 * Envia cupom via WhatsApp usando a tela unificada
 * @param {Object} saleData - Dados completos da venda
 * @param {String} saleId - ID da venda
 * @param {String} phoneNumber - Número do WhatsApp
 */
async function sendCupomWhatsApp(saleData, saleId, phoneNumber) {
    try {
        console.log('📱 Preparando envio via WhatsApp...');
        console.log('Telefone:', phoneNumber);
        
        // Usar a função unificada do nova-venda-cupom.js
        if (window.enviarComprovanteWhatsApp) {
            return await window.enviarComprovanteWhatsApp(saleData, saleId);
        } else {
            // Fallback caso a função não esteja disponível
            console.warn('Função enviarComprovanteWhatsApp não encontrada, usando método antigo');
            
            // Buscar dados da empresa
            const companyData = await getCompanyDataWhats();
            
            // Gerar HTML do cupom (mesmo formato da impressão)
            const cupomHTML = generateCupomHTMLForWhatsApp(saleData, saleId, companyData, phoneNumber);
            
            // Abrir janela com o comprovante para o usuário visualizar e enviar
            openWhatsAppWithReceipt(cupomHTML, phoneNumber);
            
            return {
                success: true,
                message: 'Comprovante aberto! Você pode visualizar e enviar via WhatsApp.',
                data: {
                    saleId: saleId,
                    companyData: companyData,
                    phoneNumber: phoneNumber,
                    cupomHTML: cupomHTML
                }
            };
        }
        
    } catch (error) {
        console.error('❌ Erro ao enviar via WhatsApp:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Busca dados da empresa para WhatsApp
 */
async function getCompanyDataWhats() {
    try {
        const { data, error } = await supabaseClient
            .from('empresas')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .single();

        if (error) throw error;

        if (data) {
            // Montar endereço completo
            let endereco = '';
            if (data.rua) endereco += data.rua;
            if (data.numero) endereco += `, ${data.numero}`;
            if (data.complemento) endereco += `, ${data.complemento}`;
            if (data.bairro) endereco += ` - ${data.bairro}`;
            if (data.cidade) endereco += ` - ${data.cidade}`;
            if (data.cep) endereco += ` - CEP: ${data.cep}`;
            
            return {
                nome: data.nome_fantasia || data.razao_social || 'Lume Sistemas',
                endereco: endereco || 'Endereço não cadastrado',
                telefone: data.telefone_empresa || 'Telefone não cadastrado',
                cnpj: data.cnpj || 'CNPJ não cadastrado',
                email: data.email_empresa || 'email@empresa.com'
            };
        }

        return {
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
 * Gera HTML do cupom para WhatsApp (mesmo formato da impressão)
 */
function generateCupomHTMLForWhatsApp(saleData, saleId, companyData, phoneNumber = '') {
    const now = new Date();
    const dataVenda = now.toLocaleDateString('pt-BR');
    const horaVenda = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
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
        
        let itemHTML = `
            <tr>
                <td style="text-align: left; padding: 2px 0; border-bottom: 1px dotted #ccc;">
                    ${String(index + 1).padStart(2, '0')}. ${item.nome}
                </td>
            </tr>
            <tr>
                <td style="text-align: right; padding: 2px 0; font-size: 10px; color: #666;">
                    ${item.quantity}x ${formatCurrencyWhats(item.preco_venda)} = ${formatCurrencyWhats(totalItem)}
                </td>
            </tr>`;
        
        if (desconto > 0) {
            const descontoTexto = item.discount.type === 'percent' ? `${desconto}%` : formatCurrencyWhats(desconto);
            itemHTML += `
            <tr>
                <td style="text-align: right; padding: 2px 0; font-size: 10px; color: #e74c3c;">
                    💰 Desconto: ${descontoTexto}
                </td>
            </tr>`;
        }
        
        return itemHTML;
    }).join('');

    // Informações de pagamento
    const pagamentoInfo = getPagamentoInfoWhats(saleData.payment);
    
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comprovante - ${saleId}</title>
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
            width: 100%;
            max-width: 400px;
            margin: 20px auto;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
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
        
        .sale-info {
            margin: 8px 0;
            font-size: 10px;
        }
        
        .items-table {
            width: 100%;
            margin: 8px 0;
        }
        
        .totals {
            border-top: 1px dashed #000;
            padding-top: 8px;
            margin-top: 8px;
        }
        
        .total-line {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
            font-size: 11px;
        }
        
        .total-final {
            font-weight: bold;
            font-size: 14px;
            border-top: 1px solid #000;
            padding-top: 4px;
            margin-top: 4px;
        }
        
        .footer {
            text-align: center;
            margin-top: 15px;
            padding-top: 8px;
            border-top: 1px dashed #000;
            font-size: 10px;
        }
        
        .whatsapp-actions {
            text-align: center;
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
            border: 1px solid #e9ecef;
        }
        
        .btn {
            background: #25D366;
            color: white;
            border: none;
            padding: 12px 20px;
            margin: 5px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            text-decoration: none;
            display: inline-block;
        }
        
        .btn:hover {
            background: #128C7E;
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
    <!-- Cabeçalho da Empresa -->
    <div class="header">
        <div class="company-name">${companyData.nome}</div>
        <div class="company-info">${companyData.endereco}</div>
        <div class="company-info">Tel: ${companyData.telefone}</div>
        <div class="company-info">CNPJ: ${companyData.cnpj}</div>
    </div>
    
    <!-- Informações da Venda -->
    <div class="sale-info">
        <div><strong>🧾 CUPOM NÃO FISCAL</strong></div>
        <div>🔢 Número: <strong>#${saleId}</strong></div>
        <div>📅 Data: ${dataVenda}</div>
        <div>🕐 Hora: ${horaVenda}</div>
        <div>👤 Vendedor: ${window.currentUser?.nome || 'Sistema'}</div>
    </div>
    
    <!-- Lista de Itens -->
    <table class="items-table">
        <tr><td style="font-weight: bold; border-bottom: 1px solid #000; padding: 4px 0;">📋 ITENS COMPRADOS:</td></tr>
        ${itensHTML}
    </table>
    
    <!-- Totais -->
    <div class="totals">
        <div class="total-line">
            <span>Subtotal:</span>
            <span>${formatCurrencyWhats(subtotal)}</span>
        </div>
        ${totalDesconto > 0 ? `
        <div class="total-line" style="color: #e74c3c;">
            <span>Desconto:</span>
            <span>-${formatCurrencyWhats(totalDesconto)}</span>
        </div>` : ''}
        <div class="total-line total-final">
            <span>💰 TOTAL:</span>
            <span>${formatCurrencyWhats(total)}</span>
        </div>
    </div>
    
    <!-- Informações de Pagamento -->
    <div style="margin: 8px 0; font-size: 10px;">
        <div><strong>💳 FORMA DE PAGAMENTO:</strong></div>
        <div>${pagamentoInfo}</div>
    </div>
    
    <!-- Rodapé -->
    <div class="footer">
        <div>Obrigado pela preferência!</div>
        <div>Volte sempre! 😊</div>
        <div style="margin-top: 8px; font-size: 8px; color: #666;">
            Sistema: Lume PDV | ${new Date().toLocaleString('pt-BR')}
        </div>
    </div>
    
    <!-- Ações do WhatsApp -->
    <div class="whatsapp-actions">
        <h4 style="margin-bottom: 10px;">📱 Enviar via WhatsApp</h4>
        <p style="margin-bottom: 15px; font-size: 12px;">Clique no botão abaixo para abrir o WhatsApp e enviar este comprovante:</p>
        <a href="https://wa.me/${phoneNumber ? phoneNumber.replace(/\D/g, '') : ''}?text=Olá! Segue o comprovante da sua compra. Obrigado pela preferência! 😊" 
           class="btn" target="_blank" rel="noopener" ${!phoneNumber ? 'onclick="alert(\'Número do WhatsApp não informado\'); return false;"' : ''}>
            <i class="fab fa-whatsapp"></i> Abrir WhatsApp
        </a>
        <button class="btn btn-secondary" onclick="window.print()">
            <i class="fas fa-print"></i> Imprimir
        </button>
    </div>
</body>
</html>`;
}

/**
 * Gera texto profissional do cupom para WhatsApp (mantido para compatibilidade)
 */
function generateCupomText(saleData, saleId, companyData) {
    const now = new Date();
    const dataVenda = now.toLocaleDateString('pt-BR');
    const horaVenda = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Calcular totais
    const subtotal = saleData.items.reduce((acc, item) => acc + (item.preco_venda * item.quantity), 0);
    const totalDesconto = saleData.totals?.totalDiscount || 0;
    const total = saleData.totals?.total || subtotal;
    
    // Saudação personalizada baseada no horário
    const saudacao = getSaudacao();
    
    // Nome do cliente ou tratamento genérico
    const nomeCliente = saleData.customer?.nome || 'Cliente';
    
    // Gerar lista de itens
    const itensText = saleData.items.map((item, index) => {
        const subtotalItem = item.preco_venda * item.quantity;
        const desconto = item.discount?.value || 0;
        const totalItem = subtotalItem - (item.discount?.type === 'fixed' ? desconto * item.quantity : 
                         item.discount?.type === 'percent' ? subtotalItem * (desconto / 100) : 0);
        
        let itemText = `${String(index + 1).padStart(2, '0')}. ${item.nome}`;
        itemText += `\n    ${item.quantity}x ${formatCurrencyWhats(item.preco_venda)} = ${formatCurrencyWhats(totalItem)}`;
        
        if (desconto > 0) {
            const descontoTexto = item.discount.type === 'percent' ? `${desconto}%` : formatCurrencyWhats(desconto);
            itemText += `\n    💰 Desconto: ${descontoTexto}`;
        }
        
        return itemText;
    }).join('\n\n');

    // Informações de pagamento
    const pagamentoInfo = getPagamentoInfoWhats(saleData.payment);
    
    // Montar mensagem completa
    let message = `${saudacao} ${nomeCliente}! 😊\n\n`;
    message += `Obrigado pela sua compra na *${companyData.nome}*!\n`;
    message += `Segue abaixo o seu cupom não fiscal:\n\n`;
    
    // Cabeçalho decorativo
    message += `═══════════════════════════\n`;
    message += `🏪 *${companyData.nome.toUpperCase()}*\n`;
    message += `${companyData.endereco}\n`;
    message += `📞 ${companyData.telefone}\n`;
    message += `🆔 CNPJ: ${companyData.cnpj}\n`;
    message += `═══════════════════════════\n\n`;
    
    // Informações da venda
    message += `🧾 *CUPOM NÃO FISCAL*\n`;
    message += `🔢 Número: *#${saleId}*\n`;
    message += `📅 Data: ${dataVenda}\n`;
    message += `🕐 Hora: ${horaVenda}\n`;
    message += `👤 Vendedor: ${window.currentUser?.nome || 'Sistema'}\n\n`;
    
    // Lista de itens
    message += `📋 *ITENS COMPRADOS:*\n`;
    message += `───────────────────────────\n`;
    message += `${itensText}\n\n`;
    
    // Totais
    message += `💰 *RESUMO FINANCEIRO:*\n`;
    message += `───────────────────────────\n`;
    message += `Subtotal: ${formatCurrencyWhats(subtotal)}\n`;
    
    if (totalDesconto > 0) {
        message += `Desconto: -${formatCurrencyWhats(totalDesconto)} 💚\n`;
    }
    
    if (saleData.adjustments?.freight > 0) {
        message += `Frete: ${formatCurrencyWhats(saleData.adjustments.freight)}\n`;
    }
    
    message += `\n💳 *TOTAL PAGO: ${formatCurrencyWhats(total)}*\n\n`;
    
    // Forma de pagamento
    message += `🔄 *FORMA DE PAGAMENTO:*\n`;
    message += `${pagamentoInfo}\n\n`;
    
    // Mensagem de agradecimento
    message += `🎉 *Muito obrigado pela sua preferência!*\n`;
    message += `Esperamos vê-lo(a) novamente em breve! 🤝\n\n`;
    
    // Informações adicionais
    if (saleData.adjustments?.cashback > 0) {
        message += `🎁 *Cashback gerado:* ${formatCurrencyWhats(saleData.adjustments.cashback)}\n`;
        message += `Use em sua próxima compra!\n\n`;
    }
    
    // Rodapé
    message += `───────────────────────────\n`;
    message += `🌟 Avalie nossa loja!\n`;
    message += `💬 Dúvidas? Entre em contato conosco\n`;
    message += `🚀 Sistema Lume - ${now.toLocaleString('pt-BR')}\n`;
    message += `═══════════════════════════`;
    
    return message;
}

/**
 * Gera saudação baseada no horário
 */
function getSaudacao() {
    const hora = new Date().getHours();
    
    if (hora >= 5 && hora < 12) {
        return 'Bom dia';
    } else if (hora >= 12 && hora < 18) {
        return 'Boa tarde';
    } else {
        return 'Boa noite';
    }
}

/**
 * Gera informações de pagamento para WhatsApp
 */
function getPagamentoInfoWhats(paymentData) {
    if (!paymentData) return '💵 Dinheiro';
    
    let info = '';
    
    switch (paymentData.method) {
        case 'Dinheiro':
            info = '💵 *Dinheiro*';
            if (paymentData.amountReceived && paymentData.change) {
                info += `\n   💸 Recebido: ${formatCurrencyWhats(paymentData.amountReceived)}`;
                info += `\n   💰 Troco: ${formatCurrencyWhats(paymentData.change)}`;
            }
            break;
            
        case 'Cartao':
        case 'Cartão':
            info = '💳 *Cartão*';
            if (paymentData.cardType) {
                info += ` (${paymentData.cardType})`;
            }
            if (paymentData.installments > 1) {
                info += `\n   📊 ${paymentData.installments}x parcelas`;
            }
            if (paymentData.fees > 0) {
                info += `\n   💼 Taxa: ${formatCurrencyWhats(paymentData.fees)}`;
            }
            break;
            
        case 'PIX':
            info = '🔄 *PIX*\n   ⚡ Pagamento instantâneo';
            break;
            
        case 'Crediario':
            info = '📋 *Crediário*';
            if (paymentData.crediarioInstallments) {
                info += `\n   📅 ${paymentData.crediarioInstallments}x parcelas`;
            }
            break;
            
        case 'Cashback':
            info = '🎁 *Cashback*';
            if (paymentData.cashbackUseAmount) {
                info += `\n   💰 Utilizado: ${formatCurrencyWhats(paymentData.cashbackUseAmount)}`;
            }
            break;
            
        case 'Cupom':
            info = '🎫 *Cupom de Desconto*';
            if (paymentData.coupon) {
                info += `\n   🏷️ Código: ${paymentData.coupon}`;
            }
            break;
            
        case 'Multiplo':
            info = '🔄 *Pagamento Múltiplo*';
            if (paymentData.multiplePayment) {
                const mp = paymentData.multiplePayment;
                if (mp.method1 && mp.amount1) {
                    info += `\n   1️⃣ ${mp.method1}: ${formatCurrencyWhats(mp.amount1)}`;
                }
                if (mp.method2 && mp.amount2) {
                    info += `\n   2️⃣ ${mp.method2}: ${formatCurrencyWhats(mp.amount2)}`;
                }
            }
            break;
            
        default:
            info = `💰 ${paymentData.method}`;
    }
    
    return info;
}

/**
 * Formata valores monetários para WhatsApp
 */
function formatCurrencyWhats(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

/**
 * Abre uma nova janela com o comprovante HTML para WhatsApp
 */
function openWhatsAppWithReceipt(cupomHTML, phoneNumber) {
    // Criar uma nova janela com o comprovante
    const newWindow = window.open('', '_blank', 'width=450,height=700,scrollbars=yes,resizable=yes');
    
    if (newWindow) {
        // Adicionar funcionalidades de captura e conversão
        const enhancedHTML = cupomHTML.replace(
            '</head>',
            `
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
        <script>
            // Função para capturar como imagem
            function captureAsImage() {
                const element = document.querySelector('.receipt-container') || document.body;
                html2canvas(element, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    useCORS: true,
                    allowTaint: true
                }).then(canvas => {
                    // Criar link para download da imagem
                    const link = document.createElement('a');
                    link.download = 'comprovante-${new Date().getTime()}.png';
                    link.href = canvas.toDataURL();
                    link.click();
                    
                    // Também copiar para clipboard se possível
                    canvas.toBlob(blob => {
                        if (navigator.clipboard && window.ClipboardItem) {
                            navigator.clipboard.write([
                                new ClipboardItem({ 'image/png': blob })
                            ]).then(() => {
                                alert('Comprovante copiado como imagem! Cole no WhatsApp.');
                            }).catch(() => {
                                alert('Imagem salva! Envie o arquivo baixado pelo WhatsApp.');
                            });
                        } else {
                            alert('Imagem salva! Envie o arquivo baixado pelo WhatsApp.');
                        }
                    });
                });
            }
            
            // Função para gerar PDF
            function generatePDF() {
                const { jsPDF } = window.jspdf;
                const element = document.querySelector('.receipt-container') || document.body;
                
                html2canvas(element, {
                    backgroundColor: '#ffffff',
                    scale: 2
                }).then(canvas => {
                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new jsPDF({
                        orientation: 'portrait',
                        unit: 'mm',
                        format: 'a4'
                    });
                    
                    const imgWidth = 190;
                    const pageHeight = 295;
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;
                    let heightLeft = imgHeight;
                    let position = 0;
                    
                    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                    
                    while (heightLeft >= 0) {
                        position = heightLeft - imgHeight;
                        pdf.addPage();
                        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                        heightLeft -= pageHeight;
                    }
                    
                    pdf.save('comprovante-${new Date().getTime()}.pdf');
                    alert('PDF gerado! Envie o arquivo pelo WhatsApp.');
                });
            }
            
            // Função para abrir WhatsApp com texto simples
            function openWhatsAppText() {
                const phoneNum = '${phoneNumber ? phoneNumber.replace(/\D/g, '') : ''}';
                if (!phoneNum) {
                    alert('Número do WhatsApp não informado');
                    return;
                }
                const message = encodeURIComponent('Olá! Segue o comprovante da sua compra. Obrigado pela preferência! 😊');
                window.open('https://wa.me/' + phoneNum + '?text=' + message, '_blank');
            }
        </script>
        </head>`
        );
        
        // Adicionar classe container e botões melhorados
        const finalHTML = enhancedHTML.replace(
            '<body>',
            '<body><div class="receipt-container">'
        ).replace(
            '<!-- Ações do WhatsApp -->',
            '</div><!-- Ações do WhatsApp -->'
        ).replace(
            /<div class="whatsapp-actions">[\s\S]*?<\/div>/,
            `<div class="whatsapp-actions">
                <h4 style="margin-bottom: 15px;">📱 Enviar Comprovante</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
                    <button class="btn" onclick="captureAsImage()" style="background: #28a745;">
                        🖼️ Salvar como Imagem
                    </button>
                    <button class="btn" onclick="generatePDF()" style="background: #dc3545;">
                        📄 Gerar PDF
                    </button>
                    <button class="btn" onclick="openWhatsAppText()">
                        💬 Abrir WhatsApp
                    </button>
                    <button class="btn btn-secondary" onclick="window.print()">
                        🖨️ Imprimir
                    </button>
                </div>
                <p style="margin-top: 15px; font-size: 11px; color: #666; text-align: center;">
                    💡 <strong>Dica:</strong> Clique em "Salvar como Imagem" e cole diretamente no WhatsApp!
                </p>
            </div>`
        );
        
        newWindow.document.write(finalHTML);
        newWindow.document.close();
        newWindow.focus();
        
        // Adicionar evento para fechar a janela após envio
        newWindow.addEventListener('beforeunload', () => {
            console.log('Janela do comprovante fechada');
        });
    } else {
        alert('Não foi possível abrir a janela do comprovante. Verifique se o bloqueador de pop-ups está desabilitado.');
    }
}

/**
 * Copia texto para área de transferência
 */
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            // Método moderno (HTTPS)
            await navigator.clipboard.writeText(text);
            console.log('✅ Texto copiado para área de transferência (clipboard API)');
        } else {
            // Método alternativo (fallback)
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                console.log('✅ Texto copiado para área de transferência (execCommand)');
            } else {
                throw new Error('Falha ao copiar texto');
            }
        }
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao copiar para área de transferência:', error);
        
        // Mostrar modal com o texto para cópia manual
        showManualCopyModal(text);
        return false;
    }
}

/**
 * Abre WhatsApp Web ou Desktop
 */
function openWhatsApp(phoneNumber) {
    // Limpar número (remover caracteres especiais)
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    // Verificar se é um número brasileiro válido
    let formattedNumber = cleanNumber;
    if (cleanNumber.length === 11 && cleanNumber.startsWith('11')) {
        // Número de São Paulo com 9 dígitos
        formattedNumber = '55' + cleanNumber;
    } else if (cleanNumber.length === 10) {
        // Número com DDD sem o 9
        formattedNumber = '55' + cleanNumber;
    } else if (cleanNumber.length === 11) {
        // Número com DDD e 9 dígitos
        formattedNumber = '55' + cleanNumber;
    } else if (!cleanNumber.startsWith('55') && cleanNumber.length > 10) {
        // Já tem código do país
        formattedNumber = cleanNumber;
    } else if (cleanNumber.length <= 9) {
        // Número sem DDD - assumir código local
        formattedNumber = '5511' + cleanNumber;
    }
    
    // URL do WhatsApp Web
    const whatsappURL = `https://wa.me/${formattedNumber}`;
    
    console.log('📱 Abrindo WhatsApp para:', formattedNumber);
    console.log('URL:', whatsappURL);
    
    // Tentar abrir em nova aba
    const whatsappWindow = window.open(whatsappURL, '_blank');
    
    if (!whatsappWindow) {
        // Se bloqueado, tentar método alternativo
        console.warn('⚠️ Pop-up bloqueado, tentando método alternativo...');
        window.location.href = whatsappURL;
    }
    
    return formattedNumber;
}

/**
 * Modal para cópia manual (caso falhe a cópia automática)
 */
function showManualCopyModal(text) {
    // Remover modal existente
    const existingModal = document.getElementById('manual-copy-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Criar modal
    const modal = document.createElement('div');
    modal.id = 'manual-copy-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            padding: 30px;
            border-radius: 12px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        ">
            <h3 style="margin-bottom: 20px; color: #333;">
                📱 Copiar Cupom para WhatsApp
            </h3>
            <p style="margin-bottom: 15px; color: #666;">
                Selecione todo o texto abaixo e copie (Ctrl+C):
            </p>
            <textarea id="manual-copy-text" readonly style="
                width: 100%;
                height: 300px;
                padding: 15px;
                border: 2px solid #FF9800;
                border-radius: 8px;
                font-family: monospace;
                font-size: 12px;
                line-height: 1.4;
                resize: vertical;
            ">${text}</textarea>
            <div style="
                margin-top: 20px;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            ">
                <button id="select-all-btn" style="
                    background: #FF9800;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                ">
                    📋 Selecionar Tudo
                </button>
                <button id="close-manual-modal" style="
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                ">
                    ✖️ Fechar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    const textArea = document.getElementById('manual-copy-text');
    const selectAllBtn = document.getElementById('select-all-btn');
    const closeBtn = document.getElementById('close-manual-modal');
    
    selectAllBtn.addEventListener('click', () => {
        textArea.select();
        textArea.setSelectionRange(0, 99999); // Para dispositivos móveis
    });
    
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Auto-selecionar texto
    setTimeout(() => {
        textArea.select();
    }, 100);
}

/**
 * Função principal chamada pelo sistema de vendas
 */
window.enviarWhatsAppVenda = async function(saleData, saleId, phoneNumber) {
    console.log('📱 Iniciando envio via WhatsApp...');
    console.log('Dados da venda:', saleData);
    console.log('ID da venda:', saleId);
    console.log('Telefone:', phoneNumber);
    
    if (!phoneNumber || phoneNumber.trim() === '') {
        showNotification('Número do WhatsApp não informado!', 'error');
        return {
            success: false,
            error: 'Número do WhatsApp é obrigatório'
        };
    }
    
    const result = await sendCupomWhatsApp(saleData, saleId, phoneNumber);
    
    if (result.success) {
        showNotification('Cupom copiado! Cole no WhatsApp com Ctrl+V', 'success');
        
        // Mostrar instruções adicionais
        setTimeout(() => {
            showNotification('WhatsApp aberto! Cole a mensagem e envie 📱', 'info');
        }, 2000);
    } else {
        showNotification('Erro ao preparar WhatsApp: ' + result.error, 'error');
    }
    
    return result;
};

/**
 * Função para testar o sistema
 */
window.testarWhatsApp = async function() {
    const saleDataTeste = {
        items: [
            {
                nome: 'Produto Teste WhatsApp',
                preco_venda: 25.50,
                quantity: 2,
                discount: { type: 'percent', value: 10 }
            }
        ],
        customer: {
            nome: 'Cliente Teste'
        },
        totals: {
            subtotal: 51.00,
            totalDiscount: 5.10,
            total: 45.90
        },
        payment: {
            method: 'Dinheiro',
            amountReceived: 50.00,
            change: 4.10
        },
        adjustments: {
            cashback: 0.46
        }
    };
    
    const resultado = await window.enviarWhatsAppVenda(saleDataTeste, '12345', '11999999999');
    console.log('Resultado do teste:', resultado);
    
    return resultado;
};


console.log('✅ Sistema de WhatsApp carregado');
console.log('Funções disponíveis:');
console.log('- enviarWhatsAppVenda(saleData, saleId, phoneNumber)');
console.log('- testarWhatsApp()');

// Teste automático de detecção de recursos
setTimeout(() => {
    if (navigator.clipboard) {
        console.log('✅ Clipboard API disponível');
    } else {
        console.log('⚠️ Clipboard API não disponível, usando fallback');
    }
    
    if (window.isSecureContext) {
        console.log('✅ Contexto seguro (HTTPS)');
    } else {
        console.log('⚠️ Contexto não seguro (HTTP)');
    }
}, 1000);