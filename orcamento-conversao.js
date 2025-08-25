// orcamento-conversao.js - Sistema de Conversão de Orçamento para Venda
// ================================================================

/**
 * Classe para conversão de orçamento em venda
 * Integra com o sistema de pagamento do PDV
 */
class OrcamentoConverter {
    constructor() {
        this.paymentModal = null;
        this.currentOrcamento = null;
        this.init();
    }

    init() {
        // Aguardar carregamento dos dados do usuário
        this.waitForDependencies();
    }

    async waitForDependencies() {
        let attempts = 0;
        const maxAttempts = 50;

        const checkDeps = () => {
            // Verificar se Supabase está disponível
            if (!window.supabaseClient && typeof supabaseClient !== 'undefined') {
                window.supabaseClient = supabaseClient;
            }

            const hasSupabase = window.supabaseClient || typeof supabaseClient !== 'undefined';
            const hasCompany = window.currentCompanyId;
            const hasUser = window.currentUser;

            if (hasSupabase && hasCompany && hasUser) {
                console.log('✅ Todas as dependências carregadas, inicializando modal...');
                this.setupPaymentModal();
                return true;
            }

            attempts++;
            if (attempts >= maxAttempts) {
                console.warn('⚠️ Timeout aguardando dependências, inicializando mesmo assim...');
                this.setupPaymentModal();
                return true;
            }

            return false;
        };

        // Tentar imediatamente
        if (checkDeps()) return;

        // Aguardar eventos
        document.addEventListener('userDataReady', () => {
            if (!checkDeps()) {
                setTimeout(checkDeps, 500);
            }
        });

        // Fallback com polling
        const interval = setInterval(() => {
            if (checkDeps()) {
                clearInterval(interval);
            }
        }, 200);
    }

    /**
     * Configura o modal de pagamento usando o mesmo sistema do PDV
     */
    setupPaymentModal() {
        // Importar CSS do modal de pagamento se não existir
        if (!document.getElementById('payment-modal-styles')) {
            const link = document.createElement('link');
            link.id = 'payment-modal-styles';
            link.rel = 'stylesheet';
            link.href = 'nova-venda-pag.css';
            document.head.appendChild(link);
        }

        // NÃO criar a instância ainda - só marcar como pronto
        this.paymentModalReady = true;

        console.log('✅ Modal de pagamento preparado (não inicializado ainda)');
    }

    /**
     * Cria o modal apenas quando necessário
     */
    createModalWhenNeeded() {
        if (!this.paymentModal) {
            console.log('🔄 Criando modal de pagamento agora...');
            
            // Criar instância do modal AGORA
            this.paymentModal = new PaymentModalConfig();
            
            // Fechar imediatamente se abriu sozinho
            const modal = document.getElementById('advanced-payment-modal');
            if (modal && !modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
                console.log('🔒 Fechando modal que abriu automaticamente');
            }
            
            // Sobrescrever método de confirmação para processar venda do orçamento
            const originalConfirmPayment = this.paymentModal.confirmPayment.bind(this.paymentModal);
            this.paymentModal.confirmPayment = () => {
                this.processOrcamentoSale(originalConfirmPayment);
            };
        }
    }

    /**
     * Converte orçamento em venda abrindo o modal de pagamento
     */
    async convertOrcamentoToSale(orcamentoData) {
        try {
            // Validações básicas
            if (!orcamentoData.items || orcamentoData.items.length === 0) {
                utils.showNotification('Adicione produtos antes de converter', 'warning');
                return false;
            }

            // Salvar orçamento primeiro se não foi salvo
            if (!orcamentoData.id) {
                await saveOrcamento();
            }

            this.currentOrcamento = orcamentoData;

            // Preparar dados no formato do carrinho do PDV
            this.setupCartData(orcamentoData);

            // Criar modal APENAS agora
            const modal = this.createModalOnDemand();

            if (!modal) {
                throw new Error('Não foi possível criar modal de pagamento');
            }

            // Aguardar criação completa
            await new Promise(resolve => setTimeout(resolve, 200));

            // AGORA sim abrir o modal
            console.log('💰 Abrindo modal para total:', orcamentoData.totals.total);
            modal.show(orcamentoData.totals.total);
            
            // Verificar se abriu corretamente
            setTimeout(() => {
                const modalElement = document.getElementById('advanced-payment-modal');
                if (modalElement && modalElement.classList.contains('hidden')) {
                    console.error('❌ Modal não abriu corretamente');
                    utils.showNotification('Erro: Modal não abriu', 'error');
                } else {
                    console.log('✅ Modal aberto com sucesso');
                    utils.showNotification('Modal de pagamento aberto', 'success');
                }
            }, 300);

            return true;

        } catch (error) {
            console.error('Erro ao converter orçamento:', error);
            utils.showNotification('Erro ao abrir modal: ' + error.message, 'error');
            return false;
        }
    }

    /**
     * Configura dados do carrinho para simular PDV
     */
    setupCartData(orcamentoData) {
        // Simular variáveis globais do PDV
        window.cart = orcamentoData.items.map(item => ({
            id: item.id,
            nome: item.nome,
            codigo_sku: item.codigo_sku || null,
            preco_venda: item.preco_unitario,
            quantity: item.quantidade,
            discount: { type: 'none', value: 0 }
        }));

        window.saleState = {
            customer: orcamentoData.cliente || null,
            generalDiscount: {
                type: orcamentoData.desconto?.tipo === 'percent' ? 'percent' : 'fixed',
                value: orcamentoData.desconto?.valor || 0
            }
        };

        // Função de cálculo de totais compatível
        window.calculateTotals = () => {
            const subtotal = window.cart.reduce((acc, item) => acc + (item.preco_venda * item.quantity), 0);
            
            let totalDiscount = 0;
            if (window.saleState.generalDiscount.type === 'percent') {
                totalDiscount = (subtotal * window.saleState.generalDiscount.value) / 100;
            } else {
                totalDiscount = window.saleState.generalDiscount.value;
            }

            // Adicionar frete se existir
            const freight = orcamentoData.frete || 0;
            const total = subtotal - totalDiscount + freight;

            return {
                subtotal: subtotal,
                totalDiscount: totalDiscount,
                total: Math.max(0, total)
            };
        };
    }

    /**
     * Processa a venda do orçamento
     */
    async processOrcamentoSale(originalConfirmPayment) {
        try {
            // Executar validações do modal original
            const paymentData = this.extractPaymentData();

            if (!this.validatePayment(paymentData)) {
                return; // Validação falhou, parar processo
            }

            // Preparar dados da venda
            const saleData = this.prepareSaleData(paymentData);

            // Salvar venda no Supabase
            const result = await this.saveSaleToSupabase(saleData);

            if (result.success) {
                // Atualizar status do orçamento
                await this.updateOrcamentoStatus(this.currentOrcamento.id, 'convertido');

                // Processar comprovantes se necessário
                await this.processReceipts(saleData, result.saleNumber, paymentData);

                // Mostrar sucesso
                this.showSaleSuccess(result.saleNumber);

                // Fechar modal e limpar orçamento
                this.paymentModal.close();
                newOrcamento();

            } else {
                throw new Error(result.message || 'Erro ao salvar venda');
            }

        } catch (error) {
            console.error('Erro ao processar venda do orçamento:', error);
            utils.showNotification('Erro ao finalizar venda: ' + error.message, 'error');
        }
    }

    /**
     * Extrai dados de pagamento do modal
     */
    extractPaymentData() {
        return {
            method: this.paymentModal.paymentData.method || 'Dinheiro',
            totalAmount: this.paymentModal.getCurrentTotal(),
            cardType: this.paymentModal.paymentData.cardType,
            installments: this.paymentModal.paymentData.installments,
            amountReceived: this.paymentModal.paymentData.amountReceived,
            change: this.paymentModal.paymentData.change,
            fees: this.paymentModal.paymentData.fees,
            discount: this.paymentModal.paymentData.discount,
            surcharge: this.paymentModal.paymentData.surcharge,
            freight: this.paymentModal.paymentData.freight,
            freightPaidBy: this.paymentModal.paymentData.freightPaidBy,
            cashback: this.paymentModal.paymentData.cashback,
            coupon: this.paymentModal.paymentData.coupon,
            deliveryPerson: this.paymentModal.paymentData.deliveryPerson,
            saleChannel: this.paymentModal.paymentData.saleChannel,
            receiptMethod: this.paymentModal.paymentData.receiptMethod,
            whatsappNumber: this.paymentModal.paymentData.whatsappNumber,
            seller: this.paymentModal.paymentData.seller,
            machineUsed: this.paymentModal.currentMachine?.nome || 'Nenhuma',
            // Dados específicos do crediário
            crediarioInstallments: this.paymentModal.paymentData.crediarioInstallments,
            crediarioFirstDate: this.paymentModal.paymentData.crediarioFirstDate,
            // Dados específicos do cashback
            cashbackUseAmount: this.paymentModal.paymentData.cashbackUseAmount,
            // Dados específicos do múltiplo
            multiplePayment: this.paymentModal.paymentData.multiplePayment
        };
    }

    /**
     * Valida dados de pagamento
     */
    validatePayment(paymentData) {
        // Validações básicas copiadas do modal original
        switch(paymentData.method) {
            case 'Dinheiro':
                if (paymentData.amountReceived < paymentData.totalAmount) {
                    utils.showNotification('O valor recebido é menor que o total da venda.', 'error');
                    return false;
                }
                break;

            case 'Cashback':
                if (!paymentData.cashbackUseAmount || paymentData.cashbackUseAmount <= 0) {
                    utils.showNotification('Informe o valor de cashback a ser utilizado.', 'error');
                    return false;
                }
                break;

            case 'Multiplo':
                const amount1 = paymentData.multiplePayment?.amount1 || 0;
                const amount2 = paymentData.multiplePayment?.amount2 || 0;
                const total = paymentData.totalAmount;
                
                if (amount1 <= 0 || amount2 <= 0) {
                    utils.showNotification('Informe valores válidos para ambas as formas de pagamento.', 'error');
                    return false;
                }
                if (Math.abs((amount1 + amount2) - total) > 0.01) {
                    utils.showNotification('A soma dos valores deve ser igual ao total da venda.', 'error');
                    return false;
                }
                break;

            case 'Crediario':
                if (!paymentData.crediarioFirstDate) {
                    utils.showNotification('Informe a data da primeira parcela.', 'error');
                    return false;
                }
                break;
        }

        if (paymentData.receiptMethod === 'whatsapp' && !paymentData.whatsappNumber?.trim()) {
            utils.showNotification('Digite o número do WhatsApp para envio do comprovante.', 'error');
            return false;
        }

        return true;
    }

    /**
     * Prepara dados da venda para salvar no Supabase
     */
    prepareSaleData(paymentData) {
        const totals = window.calculateTotals();
        
        return {
            items: window.cart,
            customer: window.saleState.customer,
            totals: totals,
            payment: paymentData,
            adjustments: {
                discount: paymentData.discount || 0,
                surcharge: paymentData.surcharge || 0,
                freight: paymentData.freight || 0,
                freightPaidBy: paymentData.freightPaidBy || 'casa',
                cashback: paymentData.cashback || 0
            },
            info: {
                seller: paymentData.seller || window.currentUser?.id,
                deliveryPerson: paymentData.deliveryPerson || null,
                saleChannel: paymentData.saleChannel || 'presencial',
                sourceType: 'orcamento',
                sourceId: this.currentOrcamento.id
            },
            receipt: {
                method: paymentData.receiptMethod || 'none',
                whatsappNumber: paymentData.whatsappNumber || null
            }
        };
    }

    /**
     * Salva venda no Supabase usando o sistema existente
     */
    async saveSaleToSupabase(saleData) {
        try {
            // Usar função existente do sistema de vendas
            if (typeof window.saveSaleToSupabase === 'function') {
                return await window.saveSaleToSupabase(saleData);
            }

            // Fallback: implementação direta
            return await this.directSaveSale(saleData);

        } catch (error) {
            console.error('Erro ao salvar venda:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Implementação direta de salvamento (fallback)
     */
    async directSaveSale(saleData) {
        const saleNumber = this.generateSaleNumber();
        
        const saleRecords = saleData.items.map(item => ({
            id_venda: saleNumber,
            auth_user_id: window.currentUser?.auth_user_id || null,
            id_empresa: window.currentCompanyId,
            hora_venda: new Date().toISOString(),
            cliente_id: saleData.customer?.id || null,
            cliente_nome: saleData.customer?.nome || null,
            produto_nome: item.nome,
            produto_codigo_barras: item.codigo_barras || null,
            produto_sku: item.codigo_sku || null,
            quantidade_unit: item.quantity,
            preco_unitario: item.preco_venda,
            subtotal_item: item.preco_venda * item.quantity,
            subtotal_venda: saleData.totals?.subtotal || 0,
            desconto_total: saleData.totals?.totalDiscount || 0,
            total_venda: saleData.totals?.total || 0,
            forma_pagamento: saleData.payment?.method || 'Dinheiro',
            status: 'ATIVO',
            origem: 'orcamento',
            id_origem: this.currentOrcamento.id
        }));

        const { data, error } = await supabaseClient
            .from('vendas')
            .insert(saleRecords)
            .select();

        if (error) throw error;

        return {
            success: true,
            data: data,
            saleId: data[0]?.id || null,
            saleNumber: saleNumber,
            message: 'Venda registrada com sucesso!'
        };
    }

    /**
     * Gera número único da venda
     */
    generateSaleNumber() {
        return Math.floor(100000000 + Math.random() * 900000000).toString();
    }

    /**
     * Atualiza status do orçamento
     */
    async updateOrcamentoStatus(orcamentoId, status) {
        try {
            const { error } = await supabaseClient
                .from('orcamentos')
                .update({ 
                    status: status,
                    data_conversao: new Date().toISOString()
                })
                .eq('id', orcamentoId);

            if (error) throw error;
            
            console.log(`✅ Status do orçamento ${orcamentoId} atualizado para: ${status}`);

        } catch (error) {
            console.error('Erro ao atualizar status do orçamento:', error);
            // Não falhar a venda por causa disso
        }
    }

    /**
     * Processa comprovantes (impressão/WhatsApp)
     */
    async processReceipts(saleData, saleNumber, paymentData) {
        try {
            if (paymentData.receiptMethod === 'print') {
                if (typeof window.imprimirCupomVenda === 'function') {
                    await window.imprimirCupomVenda(saleData, saleNumber);
                    utils.showNotification('Cupom sendo impresso...', 'info');
                }
            } else if (paymentData.receiptMethod === 'whatsapp') {
                if (typeof window.enviarWhatsAppVenda === 'function') {
                    await window.enviarWhatsAppVenda(saleData, saleNumber, paymentData.whatsappNumber);
                    utils.showNotification(`Comprovante enviado para ${paymentData.whatsappNumber}`, 'success');
                }
            }
        } catch (error) {
            console.error('Erro ao processar comprovantes:', error);
            utils.showNotification('Venda realizada, mas erro ao processar comprovante', 'warning');
        }
    }

    /**
     * Mostra tela de sucesso
     */
    showSaleSuccess(saleNumber) {
        utils.showNotification(`🎉 Venda #${saleNumber} realizada com sucesso!`, 'success');
        
        // Criar modal de sucesso simples
        const successModal = document.createElement('div');
        successModal.className = 'modal';
        successModal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; text-align: center;">
                <div class="modal-body">
                    <div style="color: var(--success); font-size: 3rem; margin-bottom: 1rem;">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h3>Venda Realizada!</h3>
                    <p>Orçamento convertido com sucesso</p>
                    <p><strong>Número da venda: #${saleNumber}</strong></p>
                    <div style="margin-top: 2rem;">
                        <button class="btn btn-primary" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-check"></i> OK
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(successModal);
        
        // Auto-remover após 5 segundos
        setTimeout(() => {
            if (successModal.parentNode) {
                successModal.remove();
            }
        }, 5000);
    }
}

// Instância global
let orcamentoConverter;

/**
 * Função principal para converter orçamento (integração com o código existente)
 */
async function convertToSaleWithModal() {
    console.log('🔄 Botão "Converter em Venda" clicado');
    
    // Validar se há itens no orçamento
    if (!orcamento.items || orcamento.items.length === 0) {
        utils.showNotification('Adicione produtos antes de converter', 'warning');
        return;
    }

    // Fechar qualquer modal que possa estar aberto
    const existingModal = document.getElementById('advanced-payment-modal');
    if (existingModal && !existingModal.classList.contains('hidden')) {
        existingModal.classList.add('hidden');
        document.body.style.overflow = '';
        console.log('🔒 Fechando modal existente');
    }

    // Inicializar sistema se necessário
    if (!orcamentoConverter) {
        console.log('🔄 Inicializando sistema de conversão...');
        orcamentoConverter = new OrcamentoConverter();
        
        // Aguardar apenas que esteja pronto
        let attempts = 0;
        while (!orcamentoConverter.modalReady && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!orcamentoConverter.modalReady) {
            console.error('❌ Sistema não inicializou');
            utils.showNotification('Erro na inicialização', 'error');
            return;
        }
    }

    // Tentar conversão com modal
    try {
        console.log('🚀 Executando conversão...');
        const success = await orcamentoConverter.convertOrcamentoToSale(orcamento);
        
        if (!success) {
            console.warn('⚠️ Conversão com modal falhou, tentando fallback');
            await convertToSaleSimple();
        }
    } catch (error) {
        console.error('❌ Erro na conversão:', error);
        await convertToSaleSimple();
    }
}

/**
 * Função para sobrescrever a conversão existente
 */
function overrideConvertToSale() {
    // Substituir função existente
    window.convertToSale = convertToSaleWithModal;
    
    // Atualizar event listener do botão se existir
    const convertBtn = document.getElementById('convert-btn');
    if (convertBtn) {
        // Remove event listeners antigos
        convertBtn.replaceWith(convertBtn.cloneNode(true));
        const newConvertBtn = document.getElementById('convert-btn');
        newConvertBtn.addEventListener('click', convertToSaleWithModal);
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar carregamento completo
    setTimeout(() => {
        overrideConvertToSale();
        console.log('✅ Sistema de conversão de orçamento inicializado');
    }, 2000);
});

// Também inicializar quando dados estiverem prontos
document.addEventListener('userDataReady', () => {
    setTimeout(() => {
        overrideConvertToSale();
        console.log('✅ Sistema de conversão de orçamento configurado com dados do usuário');
    }, 1000);
});

// Exportar para uso global
window.OrcamentoConverter = OrcamentoConverter;
window.convertToSaleWithModal = convertToSaleWithModal;