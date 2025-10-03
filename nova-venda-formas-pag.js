// nova-venda-formas-pag.js - Controle de Formas de Pagamento Especiais
// ================================================================

/**
 * Processa formas de pagamento especiais após finalização da venda
 * Intercepta e complementa o processo de salvamento
 */

// Função principal que processa todas as formas de pagamento especiais
async function processSpecialPayments(saleData, saleNumber) {
    const results = {
        cashback: { processed: false, success: false },
        crediario: { processed: false, success: false },
        cupom: { processed: false, success: false },
        multiplo: { processed: false, success: false }
    };

    try {
        const paymentMethod = saleData.payment.method;
        const clienteId = saleData.customer?.id || null;

        // 1. PROCESSAR CASHBACK - GERAR APENAS SE HABILITADO E CLIENTE SELECIONADO
        const cashbackEnabled = document.getElementById('enable-cashback')?.checked || false;
        const cashbackValue = saleData.adjustments?.cashback || 0;
        
        if (cashbackEnabled && cashbackValue > 0 && clienteId) {
            results.cashback = await processCashbackGeneration(
                clienteId, 
                saleNumber, 
                cashbackValue
            );
        }

        // 2. PROCESSAR FORMA DE PAGAMENTO PRINCIPAL
        switch (paymentMethod) {
            case 'Cashback':
                // Quando paga COM cashback, debita do saldo (além de gerar se habilitado)
                const cashbackUsage = await processCashbackUsage(
                    clienteId,
                    saleNumber,
                    saleData.payment.cashbackUseAmount || saleData.totals.total
                );
                
                // Se já gerou cashback acima, manter os dois registros
                if (!results.cashback.processed) {
                    results.cashback = cashbackUsage;
                } else {
                    // Ambos os processos (geração E uso)
                    results.cashback.usage = cashbackUsage;
                }
                break;

            case 'Crediario':
                results.crediario = await processCrediario(
                    clienteId,
                    saleNumber,
                    saleData.payment.totalAmount || saleData.totals.total,
                    saleData.payment.crediarioInstallments || 2,
                    saleData.payment.crediarioFirstDate
                );
                break;

            case 'Cupom':
                results.cupom = await processCupomUsage(
                    clienteId,
                    saleNumber,
                    saleData.payment.coupon,
                    saleData.totals.total
                );
                break;

            case 'Multiplo':
                results.multiplo = await processMultiplePayments(
                    clienteId,
                    saleNumber,
                    saleData.payment.multiplePayment,
                    saleData.totals.total
                );
                break;
        }

        // 3. PROCESSAR CUPOM DOS AJUSTES (se usado na aba de ajustes)
        if (saleData.adjustments?.coupon) {
            const cupomResult = await processCupomUsage(
                clienteId,
                saleNumber,
                saleData.adjustments.coupon,
                saleData.totals.total
            );
            
            if (!results.cupom.processed) {
                results.cupom = cupomResult;
            }
        }

        return { success: true, results };

    } catch (error) {
        return { success: false, error: error.message, results };
    }
}

// ===== CASHBACK =====

async function processCashbackGeneration(clienteId, vendaId, valor) {
    try {
        if (valor <= 0) {
            return { processed: false, success: false, reason: 'Valor de cashback inválido' };
        }
        
        if (!clienteId) {
            return { processed: false, success: false, reason: 'Cliente não selecionado para cashback' };
        }

        const result = await creditCashback(clienteId, vendaId, valor, 'Cashback gerado na compra');
        
        return {
            processed: true,
            success: result.success,
            type: 'generation',
            valor: valor,
            novoSaldo: result.novoSaldo,
            clienteId: clienteId,
            message: result.success ? 
                `Cashback de R$ ${valor.toFixed(2)} ${clienteId ? 'creditado ao cliente' : 'gerado na venda'}` : 
                result.error
        };

    } catch (error) {
        return { processed: true, success: false, error: error.message };
    }
}

async function processCashbackUsage(clienteId, vendaId, valor) {
    try {
        if (!clienteId || valor <= 0) {
            return { processed: false, success: false, reason: 'Cliente não selecionado ou valor inválido' };
        }

        const result = await debitCashback(clienteId, vendaId, valor, 'Cashback utilizado na compra');
        
        return {
            processed: true,
            success: result.success,
            type: 'usage',
            valor: valor,
            novoSaldo: result.novoSaldo,
            message: result.success ? `Cashback de R$ ${valor.toFixed(2)} utilizado` : result.error
        };

    } catch (error) {
        return { processed: true, success: false, error: error.message };
    }
}

// ===== CREDIÁRIO =====

async function processCrediario(clienteId, vendaId, valorTotal, numeroParcelas, dataPrimeiraParcela) {
    try {
        if (!clienteId) {
            return { processed: false, success: false, reason: 'Cliente não selecionado' };
        }

        if (!dataPrimeiraParcela) {
            const dataDefault = new Date();
            dataDefault.setDate(dataDefault.getDate() + 30);
            dataPrimeiraParcela = dataDefault.toISOString().split('T')[0];
        }

        const result = await createCrediario(clienteId, vendaId, valorTotal, numeroParcelas, dataPrimeiraParcela);
        
        return {
            processed: true,
            success: result.success,
            valorTotal: valorTotal,
            numeroParcelas: numeroParcelas,
            valorParcela: result.valorParcela,
            dataPrimeiraParcela: dataPrimeiraParcela,
            message: result.success ? 
                `Crediário criado: ${numeroParcelas}x de R$ ${result.valorParcela?.toFixed(2)}` : 
                result.error
        };

    } catch (error) {
        return { processed: true, success: false, error: error.message };
    }
}

// ===== CUPOM =====

async function processCupomUsage(clienteId, vendaId, codigoCupom, valorCompra) {
    try {
        if (!codigoCupom || !codigoCupom.trim()) {
            return { processed: false, success: false, reason: 'Nenhum cupom informado' };
        }

        const result = await useCupom(codigoCupom, vendaId, clienteId, valorCompra);
        
        return {
            processed: true,
            success: result.success,
            codigo: codigoCupom,
            valorDesconto: result.valorDesconto,
            message: result.success ? 
                `Cupom ${codigoCupom} utilizado - Desconto: R$ ${result.valorDesconto?.toFixed(2)}` : 
                result.error
        };

    } catch (error) {
        return { processed: true, success: false, error: error.message };
    }
}

// ===== PAGAMENTO MÚLTIPLO =====

async function processMultiplePayments(clienteId, vendaId, multipleData, valorTotal) {
    try {
        const results = [];

        if (multipleData.method1 && multipleData.amount1 > 0) {
            const result1 = await processSingleMultiplePayment(
                clienteId, 
                vendaId, 
                multipleData.method1, 
                multipleData.amount1,
                {
                    installments: multipleData.installments1,
                    coupon: multipleData.coupon1
                }
            );
            results.push({ method: multipleData.method1, ...result1 });
        }

        if (multipleData.method2 && multipleData.amount2 > 0) {
            const result2 = await processSingleMultiplePayment(
                clienteId, 
                vendaId, 
                multipleData.method2, 
                multipleData.amount2,
                {
                    installments: multipleData.installments2,
                    coupon: multipleData.coupon2
                }
            );
            results.push({ method: multipleData.method2, ...result2 });
        }

        return {
            processed: true,
            success: results.every(r => r.success),
            results: results,
            message: `Pagamento múltiplo processado: ${results.length} métodos`
        };

    } catch (error) {
        return { processed: true, success: false, error: error.message };
    }
}

async function processSingleMultiplePayment(clienteId, vendaId, method, amount, options = {}) {
    switch (method) {
        case 'Cashback':
            return await processCashbackUsage(clienteId, vendaId, amount);
            
        case 'Cupom':
            if (options.coupon) {
                return await processCupomUsage(clienteId, vendaId, options.coupon, amount);
            }
            return { success: false, error: 'Cupom não informado' };
            
        case 'Crediario':
            const dataDefault = new Date();
            dataDefault.setDate(dataDefault.getDate() + 30);
            return await processCrediario(clienteId, vendaId, amount, 2, dataDefault.toISOString().split('T')[0]);
            
        default:
            return { success: true, message: `${method} processado normalmente` };
    }
}

// ===== INTEGRAÇÃO COM O SISTEMA PRINCIPAL =====

// Interceptar a função original de processamento de vendas
const processAndSaveSaleOriginalFormas = window.processAndSaveSale;

window.processAndSaveSale = async function(paymentData) {
    try {
        // 1. Executar processo original (vendas + estoque)
        const originalResult = await processAndSaveSaleOriginalFormas(paymentData);

        console.log('🔍 DEBUG - Resultado original:', originalResult);

        if (!originalResult.success) {
            console.log('❌ Venda não foi salva, retornando erro');
            return originalResult;
        }

        // 2. NOTIFICAÇÃO PRINCIPAL DE SUCESSO (sempre aparece)
        console.log('✅ Mostrando notificação principal de sucesso');
        if (originalResult.saleNumber) {
            console.log('📝 Número da venda:', originalResult.saleNumber);
            showNotification(`🎉 Venda #${originalResult.saleNumber} realizada com sucesso!`, 'success');
        } else {
            console.log('⚠️ Sem número da venda, usando mensagem genérica');
            showNotification('🎉 Venda realizada com sucesso!', 'success');
        }

        // 3. Processar formas de pagamento especiais
        const saleData = {
            items: cart,
            customer: saleState.customer,
            totals: calculateTotals(),
            payment: paymentData,
            adjustments: {
                discount: paymentData.discount || 0,
                surcharge: paymentData.surcharge || 0,
                freight: paymentData.freight || 0,
                freightPaidBy: paymentData.freightPaidBy || 'casa',
                cashback: paymentData.cashback || 0,
                coupon: paymentData.coupon || ''
            }
        };

        const paymentResult = await processSpecialPayments(saleData, originalResult.saleNumber);

        if (paymentResult.success) {
            // Aguardar um pouco antes das notificações específicas
            setTimeout(() => {
                showPaymentNotifications(paymentResult.results);
            }, 1500); // 1.5 segundos de delay
        } else {
            if (typeof showNotification === 'function') {
                showNotification('Venda salva, mas houve erro ao processar formas de pagamento', 'warning');
            }
        }

        // Retornar resultado original com informações das formas de pagamento
        return {
            ...originalResult,
            paymentProcessing: paymentResult
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};

// ===== NOTIFICAÇÕES =====

function showPaymentNotifications(results) {
    // Notificações para cashback - só exibe se há cliente
    if (results.cashback.processed && results.cashback.success && results.cashback.clienteId) {
        if (results.cashback.type === 'generation') {
            showNotification(`💰 ${results.cashback.message}`, 'success');
        } else if (results.cashback.type === 'usage') {
            showNotification(`💸 ${results.cashback.message}`, 'info');
        }
    }

    // Notificações para crediário
    if (results.crediario.processed && results.crediario.success) {
        showNotification(`📋 ${results.crediario.message}`, 'success');
    }

    // Notificações para cupom
    if (results.cupom.processed && results.cupom.success) {
        showNotification(`🎫 ${results.cupom.message}`, 'success');
    }

    // Notificações para pagamento múltiplo
    if (results.multiplo.processed && results.multiplo.success) {
        showNotification(`💳 ${results.multiplo.message}`, 'success');
    }
}

// ===== FUNÇÕES AUXILIARES DO CASHBACK/CREDIÁRIO/CUPOM =====

async function creditCashback(clienteId, vendaId, valor, descricao) {
    // Não permite crédito de cashback sem cliente
    if (!clienteId) {
        return { success: false, error: 'Cliente é obrigatório para crédito de cashback' };
    }
    
    let saldoAnterior = 0;
    let novoSaldo = valor;
    
    const { data: ultimoRegistro } = await supabaseClient
        .from('cashback')
        .select('saldo_atual')
        .eq('cliente_id', clienteId)
        .eq('id_empresa', window.currentCompanyId)
        .order('created_at', { ascending: false })
        .limit(1);

    saldoAnterior = ultimoRegistro?.[0]?.saldo_atual || 0;
    novoSaldo = saldoAnterior + valor;

    const { error } = await supabaseClient
        .from('cashback')
        .insert([{
            cliente_id: clienteId,
            venda_id: vendaId,
            tipo_operacao: 'credito',
            valor: valor,
            saldo_anterior: saldoAnterior,
            saldo_atual: novoSaldo,
            descricao: descricao,
            id_empresa: window.currentCompanyId,
            auth_user_id: window.currentUser.auth_user_id
        }]);

    return { success: !error, novoSaldo, error: error?.message };
}

async function debitCashback(clienteId, vendaId, valor, descricao) {
    const { data: ultimoRegistro } = await supabaseClient
        .from('cashback')
        .select('saldo_atual')
        .eq('cliente_id', clienteId)
        .eq('id_empresa', window.currentCompanyId)
        .order('created_at', { ascending: false })
        .limit(1);

    const saldoAnterior = ultimoRegistro?.[0]?.saldo_atual || 0;
    
    if (saldoAnterior < valor) {
        return { success: false, error: 'Saldo de cashback insuficiente' };
    }

    const novoSaldo = saldoAnterior - valor;

    const { error } = await supabaseClient
        .from('cashback')
        .insert([{
            cliente_id: clienteId,
            venda_id: vendaId,
            tipo_operacao: 'debito',
            valor: valor,
            saldo_anterior: saldoAnterior,
            saldo_atual: novoSaldo,
            descricao: descricao,
            id_empresa: window.currentCompanyId,
            auth_user_id: window.currentUser.auth_user_id
        }]);

    return { success: !error, novoSaldo, error: error?.message };
}

async function createCrediario(clienteId, vendaId, valorTotal, numeroParcelas, dataPrimeiraParcela) {
    const valorParcela = valorTotal / numeroParcelas;
    const parcelas = [];

    for (let i = 1; i <= numeroParcelas; i++) {
        const dataVencimento = new Date(dataPrimeiraParcela);
        dataVencimento.setMonth(dataVencimento.getMonth() + (i - 1));

        parcelas.push({
            cliente_id: clienteId,
            venda_id: vendaId,
            numero_parcela: i,
            valor_parcela: valorParcela,
            valor_total: valorTotal,
            data_vencimento: dataVencimento.toISOString().split('T')[0],
            status: 'pendente',
            id_empresa: window.currentCompanyId,
            auth_user_id: window.currentUser.auth_user_id
        });
    }

    const { error } = await supabaseClient
        .from('crediario')
        .insert(parcelas);

    return { success: !error, valorParcela, error: error?.message };
}

async function useCupom(codigo, vendaId, clienteId, valorCompra) {
    const { data: cupom, error: buscarError } = await supabaseClient
        .from('cupons')
        .select('*')
        .eq('codigo', codigo.toUpperCase())
        .eq('id_empresa', window.currentCompanyId)
        .eq('status', 'ativo')
        .single();

    if (buscarError || !cupom) {
        return { success: false, error: 'Cupom não encontrado ou inválido' };
    }

    if (cupom.valor_minimo && valorCompra < cupom.valor_minimo) {
        return { success: false, error: `Valor mínimo para usar este cupom: R$ ${cupom.valor_minimo.toFixed(2)}` };
    }

    if (cupom.data_fim && new Date() > new Date(cupom.data_fim)) {
        return { success: false, error: 'Cupom expirado' };
    }

    if (cupom.uso_atual >= cupom.limite_uso) {
        return { success: false, error: 'Cupom esgotado' };
    }

    let valorDesconto = 0;
    if (cupom.tipo_desconto === 'valor_fixo') {
        valorDesconto = cupom.valor_desconto;
    } else if (cupom.tipo_desconto === 'percentual') {
        valorDesconto = (valorCompra * cupom.valor_desconto) / 100;
    }

    const { error: updateError } = await supabaseClient
        .from('cupons')
        .update({
            uso_atual: cupom.uso_atual + 1,
            status: (cupom.uso_atual + 1) >= cupom.limite_uso ? 'usado' : 'ativo',
            venda_id: vendaId,
            cliente_id: clienteId,
            data_uso: new Date().toISOString()
        })
        .eq('id', cupom.id);

    return { success: !updateError, valorDesconto, error: updateError?.message };
}

// Exportar para uso global
window.processSpecialPayments = processSpecialPayments;