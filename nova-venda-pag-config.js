// nova-venda-pag-config.js - PARTE 1: Configuração e estrutura básica do modal
// VERSÃO DIVIDIDA PARA MELHOR ORGANIZAÇÃO

class PaymentModalConfig {
    constructor() {
        this.currentTab = 'payment';
        this.paymentData = {};
        this.cardMachines = []; 
        this.currentMachine = null; 
        
        // CORREÇÃO: Carregar configurações do localStorage
        this.paymentConfig = this.loadPaymentConfig();
        
        this.setupModal();
        this.reset(); 
    }

    // NOVA FUNÇÃO: Carregar configurações do localStorage
    loadPaymentConfig() {
        const savedConfig = JSON.parse(localStorage.getItem('pdv-payment-config'));
        
        // Configurações padrão
        const defaultConfig = {
            enableCrediario: false,
            enableCashback: false,
            enableMultiplo: false,
            enableCupom: false,
            cashbackPercentage: 1.0
        };
        
        // Mesclar configurações salvas com padrões
        const config = savedConfig ? { ...defaultConfig, ...savedConfig } : defaultConfig;
        
        console.log('📂 Configurações de pagamento carregadas:', config);
        return config;
    }

    // NOVA FUNÇÃO: Salvar configurações no localStorage
    savePaymentConfig() {
        localStorage.setItem('pdv-payment-config', JSON.stringify(this.paymentConfig));
        console.log('💾 Configurações de pagamento salvas:', this.paymentConfig);
    }

    // NOVA FUNÇÃO: Buscar saldo de cashback do cliente
    async loadCustomerCashback(clienteId) {
        try {
            if (!clienteId || !window.currentCompanyId) {
                console.log('❌ Cliente ou empresa não identificados para buscar cashback');
                return 0;
            }

            console.log(`🔍 Buscando saldo de cashback para cliente ID: ${clienteId}`);

            const { data, error } = await supabaseClient
                .from('cashback')
                .select('saldo_atual')
                .eq('cliente_id', clienteId)
                .eq('id_empresa', window.currentCompanyId)
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) {
                console.error('❌ Erro ao buscar cashback:', error);
                return 0;
            }

            const saldo = data && data.length > 0 ? (data[0].saldo_atual || 0) : 0;
            
            console.log(`💰 Saldo de cashback encontrado: R$ ${saldo.toFixed(2)}`);
            return saldo;

        } catch (error) {
            console.error('❌ Erro na busca de cashback:', error);
            return 0;
        }
    }

    setupModal() {
        this.createModalHTML();
        this.bindEvents();
    }

    createModalHTML() {
        const existingModal = document.getElementById('advanced-payment-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHTML = `
            <div id="advanced-payment-modal" class="modal-overlay hidden">
                <div class="modal-content payment-modal-content">
                    <div class="modal-header">
                        <h3>Finalizar Venda</h3>
                        <button class="close-modal-btn">&times;</button>
                    </div>
                    
                    <div class="payment-modal-body-container">
                        <div class="modal-sidebar">
                            <button class="sidebar-tab active" data-tab="payment"><i class="fa-solid fa-credit-card"></i><span>Pagamento</span></button>
                            <button class="sidebar-tab" data-tab="adjustments"><i class="fa-solid fa-calculator"></i><span>Ajustes</span></button>
                            <button class="sidebar-tab" data-tab="info"><i class="fa-solid fa-info-circle"></i><span>Informações</span></button>
                            <div class="sidebar-spacer"></div>
                            <button class="sidebar-tab sidebar-tab-config" data-tab="config"><i class="fa-solid fa-gear"></i><span>Configurações</span></button>
                        </div>

                        <div class="modal-main-content">
                            <div class="payment-total-display">
                                <span>Total a Pagar</span>
                                <strong id="payment-total-amount">R$ 0,00</strong>
                            </div>

                            <div id="payment-tab-content" class="tab-content active">
                                <div class="form-section">
                                    <h4>Forma de Pagamento</h4>
                                    <div class="payment-methods-grid">
                                        <button class="payment-method-card active" data-method="Dinheiro"><i class="fa-solid fa-money-bill-wave"></i><span>Dinheiro</span></button>
                                        <button class="payment-method-card" data-method="Cartao"><i class="fa-solid fa-credit-card"></i><span>Cartão</span></button>
                                        <button class="payment-method-card" data-method="PIX"><i class="fa-brands fa-pix"></i><span>PIX</span></button>
                                        <button class="payment-method-card" data-method="Crediario" id="crediario-btn"><i class="fa-solid fa-handshake"></i><span>Crediário</span></button>
                                        <button class="payment-method-card" data-method="Cashback" id="cashback-btn"><i class="fa-solid fa-piggy-bank"></i><span>Cashback</span></button>
                                        <button class="payment-method-card" data-method="Multiplo" id="multiplo-btn"><i class="fa-solid fa-layer-group"></i><span>Múltiplo</span></button>
                                        <button class="payment-method-card" data-method="Cupom" id="cupom-btn"><i class="fa-solid fa-ticket"></i><span>Cupom</span></button>
                                    </div>
                                </div>
                                <div id="card-options" class="form-section hidden">
                                    <div class="form-group"><label for="installments">Modalidade</label><select id="installments"><option value="">Carregando opções...</option></select></div>
                                    <div class="fees-info"><span>Taxa da máquina: <strong id="fees-display">R$ 0,00</strong></span><small id="fees-payer"></small></div>
                                </div>
                                <div id="cash-options" class="form-section">
                                    <div class="form-group"><label for="amount-received">Valor Recebido (R$)</label><input type="number" id="amount-received" placeholder="0,00" step="0.01"></div>
                                    <div class="change-display"><span>Troco:</span><strong id="change-amount">R$ 0,00</strong></div>
                                </div>
                                <div id="crediario-options" class="form-section hidden">
                                    <div class="form-group"><label for="crediario-installments">Número de Parcelas</label><select id="crediario-installments">
                                        <option value="2">2x</option>
                                        <option value="3">3x</option>
                                        <option value="4">4x</option>
                                        <option value="5">5x</option>
                                        <option value="6">6x</option>
                                    </select></div>
                                    <div class="form-group"><label for="crediario-first-date">Data da Primeira Parcela</label><input type="date" id="crediario-first-date"></div>
                                </div>
                                <div id="cashback-options" class="form-section hidden">
                                    <div class="form-group">
                                        <label for="cashback-available">Cashback Disponível</label>
                                        <div class="input-with-currency">
                                            <span class="currency-symbol">R$</span>
                                            <input type="number" id="cashback-available" placeholder="0,00" step="0.01" readonly>
                                        </div>
                                        <small id="cashback-customer-info" style="color: var(--primary-color); font-weight: 500;"></small>
                                    </div>
                                    <div class="form-group">
                                        <label for="cashback-use-amount">Valor a Utilizar</label>
                                        <div class="input-with-currency">
                                            <span class="currency-symbol">R$</span>
                                            <input type="number" id="cashback-use-amount" placeholder="0,00" step="0.01">
                                        </div>
                                    </div>
                                </div>
                                <div id="multiplo-options" class="form-section hidden">
                                    <div class="form-group">
                                        <label for="payment-method-1">Primeira Forma de Pagamento</label>
                                        <select id="payment-method-1" class="multiplo-method">
                                            <option value="Dinheiro">Dinheiro</option>
                                            <option value="Cartao">Cartão</option>
                                            <option value="PIX">PIX</option>
                                            <option value="Crediario" class="crediario-option" style="display: none;">Crediário</option>
                                            <option value="Cashback" class="cashback-option" style="display: none;">Cashback</option>
                                            <option value="Cupom" class="cupom-option" style="display: none;">Cupom</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label for="payment-amount-1">Valor (R$)</label>
                                        <input type="number" id="payment-amount-1" placeholder="0,00" step="0.01" class="multiplo-amount">
                                    </div>
                                    
                                    <div id="card-options-1" class="form-group hidden">
                                        <label for="installments-1">Modalidade</label>
                                        <select id="installments-1" class="multiplo-installments"></select>
                                    </div>
                                    
                                    <div id="cupom-options-1" class="form-group hidden">
                                        <label for="cupom-code-1">Código do Cupom</label>
                                        <div class="coupon-group">
                                            <input type="text" id="cupom-code-1" placeholder="Código do cupom">
                                            <button type="button" id="apply-coupon-1" class="btn-secondary">Aplicar</button>
                                        </div>
                                        <div class="coupon-info">
                                            <span>Cupom aplicado: <strong id="cupom-applied-1">Nenhum</strong></span>
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label for="payment-method-2">Segunda Forma de Pagamento</label>
                                        <select id="payment-method-2" class="multiplo-method">
                                            <option value="Dinheiro">Dinheiro</option>
                                            <option value="Cartao">Cartão</option>
                                            <option value="PIX">PIX</option>
                                            <option value="Crediario" class="crediario-option" style="display: none;">Crediário</option>
                                            <option value="Cashback" class="cashback-option" style="display: none;">Cashback</option>
                                            <option value="Cupom" class="cupom-option" style="display: none;">Cupom</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label for="payment-amount-2">Valor (R$)</label>
                                        <input type="number" id="payment-amount-2" placeholder="0,00" step="0.01" class="multiplo-amount">
                                    </div>
                                    
                                    <div id="card-options-2" class="form-group hidden">
                                        <label for="installments-2">Modalidade</label>
                                        <select id="installments-2" class="multiplo-installments"></select>
                                    </div>
                                    
                                    <div id="cupom-options-2" class="form-group hidden">
                                        <label for="cupom-code-2">Código do Cupom</label>
                                        <div class="coupon-group">
                                            <input type="text" id="cupom-code-2" placeholder="Código do cupom">
                                            <button type="button" id="apply-coupon-2" class="btn-secondary">Aplicar</button>
                                        </div>
                                        <div class="coupon-info">
                                            <span>Cupom aplicado: <strong id="cupom-applied-2">Nenhum</strong></span>
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <div class="multiplo-total-info">
                                            <span>Valor Restante:</span>
                                            <strong id="multiplo-remaining">R$ 0,00</strong>
                                        </div>
                                    </div>
                                </div>
                                <div id="cupom-options" class="form-section hidden">
                                    <div class="form-group">
                                        <label for="cupom-code-payment">Código do Cupom</label>
                                        <div class="coupon-group">
                                            <input type="text" id="cupom-code-payment" placeholder="Código do cupom">
                                            <button type="button" id="apply-coupon-payment" class="btn-secondary">Aplicar</button>
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <div class="coupon-info">
                                            <span>Cupom aplicado: <strong id="cupom-applied">Nenhum</strong></span>
                                        </div>
                                    </div>
                                </div>
                                <div class="form-section">
                                    <h4>Comprovante</h4>
                                    <div class="receipt-options">
                                        <button class="receipt-option active" data-receipt="none"><i class="fa-solid fa-ban"></i>Não enviar</button>
                                        <button class="receipt-option" data-receipt="print"><i class="fa-solid fa-print"></i>Imprimir</button>
                                        <button class="receipt-option" data-receipt="whatsapp"><i class="fa-brands fa-whatsapp"></i>WhatsApp</button>
                                    </div>
                                    <div id="whatsapp-input" class="form-group hidden"><label for="whatsapp-number">Número do WhatsApp</label><input type="tel" id="whatsapp-number" placeholder="(11) 99999-9999"></div>
                                </div>
                            </div>

                            <div id="adjustments-tab-content" class="tab-content">
                                <div class="form-section compact">
                                    <h4>Desconto</h4>
                                    <div class="form-group">
                                        <div class="input-with-toggle">
                                            <button type="button" id="discount-type-toggle" class="toggle-btn" data-type="currency">R$</button>
                                            <input type="number" id="discount-amount" placeholder="0,00" step="0.01">
                                        </div>
                                    </div>
                                </div>
                                <div class="form-section compact">
                                    <h4>Acréscimo</h4>
                                    <div class="form-group"><div class="input-with-currency"><span class="currency-symbol">R$</span><input type="number" id="surcharge-amount" placeholder="0,00" step="0.01"></div></div>
                                </div>
                                <div class="form-section compact">
                                    <h4>Frete</h4>
                                    <div class="form-row"><div class="form-group flex-grow"><div class="input-with-currency"><span class="currency-symbol">R$</span><input type="number" id="freight-amount" placeholder="0,00" step="0.01"></div></div><div class="form-group"><label>Pago por</label><select id="freight-payer"><option value="casa">Casa</option><option value="cliente">Cliente</option></select></div></div>
                                </div>
                                <div class="form-section compact">
                                    <h4>Cupom</h4>
                                    <div class="form-group coupon-group"><input type="text" id="coupon-code" placeholder="Código do cupom"><button type="button" id="apply-coupon" class="btn-secondary">Aplicar</button></div>
                                </div>
                                <div class="form-section compact">
                                    <h4>Cashback</h4>
                                    <div class="form-group">
                                        <div class="input-with-currency"><span class="currency-symbol">R$</span><input type="number" id="cashback-amount" placeholder="0,00" step="0.01" readonly></div>
                                        <small>Calculado sobre o valor final da compra.</small>
                                    </div>
                                    <div class="cashback-info">
                                        <span>Cashback gerado nesta compra: <strong id="cashback-generated">R$ 0,00</strong></span>
                                    </div>
                                </div>
                            </div>

                            <div id="info-tab-content" class="tab-content">
                                 <div class="form-section"><h4>Vendedor</h4><div class="form-group"><select id="seller-select"><option value="">Carregando vendedores...</option></select></div></div>
                                     <div class="form-section">
                                <h4>Entregador</h4>
                                <div class="form-group">
                                    <input type="text" id="delivery-person-name" class="input-field" placeholder="Digite o nome do entregador (opcional)">
                                </div>
                            </div>
                                <div class="form-section"><h4>Canal de Venda</h4><div class="sale-channels"><button class="channel-option active" data-channel="presencial"><i class="fa-solid fa-store"></i>Presencial</button><button class="channel-option" data-channel="instagram"><i class="fa-brands fa-instagram"></i>Instagram</button><button class="channel-option" data-channel="facebook"><i class="fa-brands fa-facebook"></i>Facebook</button><button class="channel-option" data-channel="publicidade"><i class="fa-solid fa-bullhorn"></i>Publicidade</button></div></div>
                            </div>
                            
                            <div id="config-tab-content" class="tab-content">
                                <div class="form-section">
                                    <h4>Opções de Pagamento</h4>
                                    <div class="settings-option">
                                        <input type="checkbox" id="enable-crediario">
                                        <label for="enable-crediario">Habilitar Crediário</label>
                                    </div>
                                    <div class="settings-option">
                                        <input type="checkbox" id="enable-cashback">
                                        <label for="enable-cashback">Habilitar Cashback</label>
                                    </div>
                                    <div class="settings-option">
                                        <input type="checkbox" id="enable-multiplo">
                                        <label for="enable-multiplo">Habilitar Pagamento Múltiplo</label>
                                    </div>
                                    <div class="settings-option">
                                        <input type="checkbox" id="enable-cupom">
                                        <label for="enable-cupom">Habilitar Cupom</label>
                                    </div>
                                    
                                    <!-- NOVO BOTÃO DE RESET -->
                                    <div class="settings-option" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                                        <button type="button" id="reset-payment-config" class="btn-secondary" style="font-size: 0.9rem;">
                                            <i class="fas fa-undo"></i> Resetar Configurações
                                        </button>
                                    </div>
                                </div>
                                <div class="form-section">
                                    <h4>Configurações de Cashback</h4>
                                    <div class="form-group">
                                        <label for="cashback-percentage">Porcentagem de Cashback</label>
                                        <div class="input-with-percentage">
                                            <input type="number" id="cashback-percentage" placeholder="1.0" step="0.1" value="1.0">
                                            <span class="percentage-symbol">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button id="cancel-payment" class="btn-secondary">Cancelar</button>
                        <button id="confirm-payment" class="btn-primary"><i class="fa-solid fa-check"></i>Finalizar Venda</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // ===== MÉTODOS UTILITÁRIOS =====
    
    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    }

    getCurrentTotal() {
        let total = this.paymentData.baseAmount || 0;
        total -= this.paymentData.discount;
        total += this.paymentData.surcharge;
        if (this.paymentData.freightPaidBy === 'cliente') total += this.paymentData.freight;
        return Math.max(0, total);
    }

    updateTotalDisplay() {
        document.getElementById('payment-total-amount').textContent = this.formatCurrency(this.getCurrentTotal());
    }

    close() {
        document.getElementById('advanced-payment-modal').classList.add('hidden');
    }

    reset() {
        this.paymentData = {
            baseAmount: 0, method: 'Dinheiro', cardType: null, installments: 1,
            amountReceived: 0, change: 0, fees: 0, discount: 0, surcharge: 0,
            freight: 0, freightPaidBy: 'casa', cashback: 0, coupon: '',
            seller: window.currentUser?.id || null, saleChannel: 'presencial',
            receiptMethod: 'none', whatsappNumber: '',
            crediarioInstallments: 2,
            crediarioFirstDate: null,
            cashbackAvailable: 0,
            cashbackUseAmount: 0,
            multiplePayment: {
                method1: 'Dinheiro',
                amount1: 0,
                method2: 'Cartao',
                amount2: 0,
                coupon1: '',
                coupon2: ''
            }
        };
        
        document.getElementById('discount-amount').value = '';
        document.getElementById('surcharge-amount').value = '';
        document.getElementById('freight-amount').value = '';
        document.getElementById('amount-received').value = '';
        document.getElementById('coupon-code').value = '';
        document.getElementById('cupom-code-payment').value = '';
        document.getElementById('cupom-applied').textContent = 'Nenhum';
        document.getElementById('cashback-amount').value = '';
        document.getElementById('cashback-available').value = '0.00';
        document.getElementById('cashback-use-amount').value = '';
        document.getElementById('payment-amount-1').value = '';
        document.getElementById('payment-amount-2').value = '';
        document.getElementById('multiplo-remaining').textContent = this.formatCurrency(0);
        document.getElementById('cupom-code-1').value = '';
        document.getElementById('cupom-code-2').value = '';
        document.getElementById('cupom-applied-1').textContent = 'Nenhum';
        document.getElementById('cupom-applied-2').textContent = 'Nenhum';

        const cashbackInfo = document.getElementById('cashback-customer-info');
        if (cashbackInfo) {
            cashbackInfo.textContent = '';
        }

        const toggleBtn = document.getElementById('discount-type-toggle');
            if (toggleBtn) {
                toggleBtn.dataset.type = 'currency';
                toggleBtn.innerHTML = '<span style="font-weight: bold; font-size: 1.1em;">R$</span>/<span style="font-size: 0.9em; opacity: 0.7;">%</span>';
            }
        
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30);
        const dateStr = defaultDate.toISOString().split('T')[0];
        document.getElementById('crediario-first-date').value = dateStr;
        this.paymentData.crediarioFirstDate = dateStr;
        
        this.selectPaymentMethod('PIX');
        this.switchTab('payment');
    }

    // ===== MÉTODOS VAZIOS PARA IMPLEMENTAÇÃO NA PARTE 2 =====
    
    bindEvents() {
        // Implementado na parte 2
    }
    
    validateCustomerForPayment(method) {
        // Implementado na parte 2
        return true;
    }
    
    detectAndLoadCustomer() {
        // Implementado na parte 2
    }
    
    show(totalAmount) {
        // Implementado na parte 2
    }
    
    selectPaymentMethod(method) {
        // Implementado na parte 2
    }
    
    switchTab(tabName) {
        // Implementado na parte 2
    }
    
    setupPaymentOptions() {
        // Implementado na parte 2
    }
    
    togglePaymentOption(method, enabled) {
        // Implementado na parte 2
    }
    
    updatePaymentMethodVisibility() {
        // Implementado na parte 2
    }
    
    updateCashbackPercentage(value) {
        // Implementado na parte 2
    }
    
    resetPaymentConfig() {
        // Implementado na parte 2
    }
    
    logPaymentConfig() {
        // Implementado na parte 2
    }

    // Métodos vazios para implementação na classe filha
    loadSellers() {}
    loadCardMachines() { return Promise.resolve(); }
    setDefaultMachine() { return Promise.resolve(); }
    populateInstallmentOptions() {}
    populateMultipleInstallmentOptions() {}
    updateCardData() {}
    calculateFees() {}
    calculateChange() {}
    calculateCashback() {}
    updateTotals() {}
    applyCoupon() {}
    applyCouponPayment() {}
    applyCouponMultiple(index) {}
    updateMultiplePayment() {}
    updateCashbackUse() {}
    confirmPayment() {}
}

window.PaymentModalConfig = PaymentModalConfig;

console.log('✅ PARTE 1: Configuração e estrutura do modal carregada');
console.log('📂 Aguardando PARTE 2 para funcionalidades completas');