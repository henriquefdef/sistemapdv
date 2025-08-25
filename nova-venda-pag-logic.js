// nova-venda-pag-logic.js -  Lógica e funcionalidades do modal

Object.assign(PaymentModalConfig.prototype, {

    async getCashbackBalance(clienteId) {
        try {
            if (!clienteId || !window.currentCompanyId) return 0;

            const { data, error } = await supabaseClient
                .from('cashback')
                .select('saldo_atual')
                .eq('cliente_id', clienteId)
                .eq('id_empresa', window.currentCompanyId)
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) return 0;
            return data && data.length > 0 ? (data[0].saldo_atual || 0) : 0;
        } catch (error) {
            return 0;
        }
    },

    // Validar e atualizar cashback para método múltiplo
    async validateMultipleCashback(methodIndex) {
        const currentCustomer = this.getCurrentCustomer();
        
        if (!currentCustomer || !currentCustomer.id) {
            alert(`Para usar Cashback no método ${methodIndex} é necessário selecionar um cliente.\nClique no botão "Cliente" para selecionar.`);
            document.getElementById(`payment-method-${methodIndex}`).value = 'Dinheiro';
            this.updateMultiplePayment();
            return false;
        }

        const saldoDisponivel = await this.getCashbackBalance(currentCustomer.id);
        this.updateMultipleCashbackInfo(methodIndex, currentCustomer, saldoDisponivel);
        
        const valorInput = document.getElementById(`payment-amount-${methodIndex}`);
        if (valorInput && valorInput.value) {
            const valorSolicitado = parseFloat(valorInput.value) || 0;
            this.validateMultipleCashbackAmount(methodIndex, valorSolicitado, saldoDisponivel, currentCustomer.nome);
        }

        return true;
    },

    // Atualizar informações visuais do cashback múltiplo
    updateMultipleCashbackInfo(methodIndex, customer, saldo) {
        let cashbackInfo = document.getElementById(`cashback-info-${methodIndex}`);
        
        if (!cashbackInfo) {
            const methodContainer = document.getElementById(`payment-method-${methodIndex}`).parentElement;
            cashbackInfo = document.createElement('div');
            cashbackInfo.id = `cashback-info-${methodIndex}`;
            cashbackInfo.className = 'cashback-multiplo-info';
            cashbackInfo.style.cssText = `
                margin-top: 0.5rem; padding: 0.5rem; background-color: rgba(255, 152, 0, 0.1);
                border-radius: 4px; font-size: 0.9rem; color: var(--primary-color);
                font-weight: 500; border: 1px solid rgba(255, 152, 0, 0.2);
            `;
            methodContainer.appendChild(cashbackInfo);
        }
        
        cashbackInfo.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>💰 ${customer.nome}</span>
                <strong>Saldo: ${this.formatCurrency(saldo)}</strong>
            </div>
        `;
        cashbackInfo.style.display = 'block';
    },

    // Esconder informações do cashback múltiplo
    hideMultipleCashbackInfo(methodIndex) {
        const cashbackInfo = document.getElementById(`cashback-info-${methodIndex}`);
        if (cashbackInfo) cashbackInfo.style.display = 'none';
    },

    // Validar valor digitado no cashback múltiplo
    validateMultipleCashbackAmount(methodIndex, valorSolicitado, saldoDisponivel, clienteNome) {
        const valorInput = document.getElementById(`payment-amount-${methodIndex}`);
        
        if (valorSolicitado > saldoDisponivel) {
            alert(`❌ Valor de cashback inválido!\n\nCliente: ${clienteNome}\nSaldo disponível: ${this.formatCurrency(saldoDisponivel)}\nValor solicitado: ${this.formatCurrency(valorSolicitado)}\n\nO valor foi ajustado para o saldo disponível.`);
            valorInput.value = saldoDisponivel.toFixed(2);
            this.updateMultiplePayment();
            return false;
        }
        return true;
    },

    // getCurrentCustomer com busca robusta
    getCurrentCustomer() {
        if (typeof saleState !== 'undefined' && saleState.customer?.id) {
            return saleState.customer;
        }
        
        if (window.saleState?.customer?.id) {
            return window.saleState.customer;
        }
        
        const customerDisplay = document.getElementById('selected-customer-display');
        const customerNameDisplay = document.getElementById('customer-name-display');
        
        if (customerDisplay && !customerDisplay.classList.contains('hidden') && customerNameDisplay) {
            const displayedName = customerNameDisplay.textContent.trim();
            
            if (displayedName && window.customers && window.customers.length > 0) {
                let customer = window.customers.find(c => c.nome === displayedName);
                if (!customer) {
                    customer = window.customers.find(c => 
                        c.nome.toLowerCase().trim() === displayedName.toLowerCase().trim()
                    );
                }
                return customer || null;
            }
        }
        
        return null;
    },

    // Validar se cliente está selecionado
    async validateCustomerForPayment(method) {
        let currentCustomer = null;
        
        if (window.saleState?.customer?.id) {
            currentCustomer = window.saleState.customer;
        }
        
        if (!currentCustomer) {
            const customerDisplay = document.getElementById('selected-customer-display');
            const customerNameDisplay = document.getElementById('customer-name-display');
            
            if (customerDisplay && !customerDisplay.classList.contains('hidden') && customerNameDisplay) {
                const displayedName = customerNameDisplay.textContent.trim();
                
                if (displayedName && window.customers && window.customers.length > 0) {
                    currentCustomer = window.customers.find(c => c.nome === displayedName);
                    
                    if (!currentCustomer) {
                        currentCustomer = window.customers.find(c => 
                            c.nome.toLowerCase().trim() === displayedName.toLowerCase().trim()
                        );
                    }
                    
                    if (!currentCustomer) {
                        currentCustomer = window.customers.find(c => 
                            c.nome.toLowerCase().includes(displayedName.toLowerCase()) ||
                            displayedName.toLowerCase().includes(c.nome.toLowerCase())
                        );
                    }
                }
            }
        }
        
        if (!currentCustomer && window.filteredCustomers && window.filteredCustomers.length > 0) {
            const customerNameEl = document.getElementById('customer-name-display');
            if (customerNameEl && customerNameEl.textContent.trim()) {
                const displayedName = customerNameEl.textContent.trim();
                currentCustomer = window.filteredCustomers.find(c => c.nome === displayedName);
                
                if (!currentCustomer) {
                    currentCustomer = window.filteredCustomers.find(c => 
                        c.nome.toLowerCase().trim() === displayedName.toLowerCase().trim()
                    );
                }
            }
        }
        
        if (!currentCustomer && typeof saleState !== 'undefined' && saleState.customer) {
            currentCustomer = saleState.customer;
        }

        const methodsRequiringCustomer = ['Cashback', 'Crediario'];
        
        if (methodsRequiringCustomer.includes(method)) {
            if (!currentCustomer || !currentCustomer.id) {
                const messages = {
                    'Cashback': 'Para usar Cashback é necessário selecionar um cliente.\nClique no botão "Cliente" para selecionar.',
                    'Crediario': 'Para usar Crediário é necessário selecionar um cliente.\nClique no botão "Cliente" para selecionar.'
                };
                
                alert(messages[method]);
                return false;
            }

            if (!window.saleState) window.saleState = {};
            if (!window.saleState.customer && currentCustomer) {
                window.saleState.customer = currentCustomer;
            }

            if (typeof saleState !== 'undefined' && !saleState.customer && currentCustomer) {
                saleState.customer = currentCustomer;
            }

            if (method === 'Cashback') {
                const saldo = await this.loadCustomerCashback(currentCustomer.id);
                
                const cashbackAvailableField = document.getElementById('cashback-available');
                if (cashbackAvailableField) {
                    cashbackAvailableField.value = saldo.toFixed(2);
                    this.paymentData.cashbackAvailable = saldo;
                }

                if (saldo <= 0) {
                    const continuar = confirm(`O cliente ${currentCustomer.nome} não possui saldo de cashback disponível.\nSaldo atual: R$ ${saldo.toFixed(2)}\n\nDeseja continuar mesmo assim?`);
                    if (!continuar) return false;
                }

                if (typeof showNotification === 'function') {
                    showNotification(`Cashback disponível para ${currentCustomer.nome}: R$ ${saldo.toFixed(2)}`, 'info');
                }
            }

            if (method === 'Crediario') {
                if (typeof showNotification === 'function') {
                    showNotification(`Crediário disponível para ${currentCustomer.nome}`, 'info');
                }
            }
        }

        return true;
    },

    // Melhorar a detecção de cliente ao abrir modal
    async detectAndLoadCustomer() {
        let currentCustomer = null;
        
        if (window.saleState?.customer?.id) {
            currentCustomer = window.saleState.customer;
        } else if (typeof saleState !== 'undefined' && saleState.customer?.id) {
            currentCustomer = saleState.customer;
        } else {
            const customerDisplay = document.getElementById('selected-customer-display');
            const customerNameDisplay = document.getElementById('customer-name-display');
            
            if (customerDisplay && !customerDisplay.classList.contains('hidden') && customerNameDisplay) {
                const displayedName = customerNameDisplay.textContent.trim();
                
                if (displayedName) {
                    if (window.customers && window.customers.length > 0) {
                        currentCustomer = window.customers.find(c => 
                            c.nome.toLowerCase().trim() === displayedName.toLowerCase().trim()
                        );
                    }
                    
                    if (!currentCustomer && window.filteredCustomers && window.filteredCustomers.length > 0) {
                        currentCustomer = window.filteredCustomers.find(c => 
                            c.nome.toLowerCase().trim() === displayedName.toLowerCase().trim()
                        );
                    }
                    
                    if (currentCustomer) {
                        if (!window.saleState) window.saleState = {};
                        window.saleState.customer = currentCustomer;
                        
                        if (typeof saleState !== 'undefined') {
                            saleState.customer = currentCustomer;
                        }
                    }
                }
            }
        }
        
        if (currentCustomer && currentCustomer.id && this.paymentConfig.enableCashback) {
            try {
                const saldo = await this.loadCustomerCashback(currentCustomer.id);
                this.paymentData.cashbackAvailable = saldo;
                
                setTimeout(() => {
                    const cashbackAvailableField = document.getElementById('cashback-available');
                    if (cashbackAvailableField) {
                        cashbackAvailableField.value = saldo.toFixed(2);
                    }
                }, 100);
            } catch (error) {
                console.error('❌ Erro ao pré-carregar cashback:', error);
            }
        }
    },

    // bindEvents melhorado
    bindEvents() {
        const modal = document.getElementById('advanced-payment-modal');
        modal.querySelector('.close-modal-btn').addEventListener('click', () => this.close());
        modal.querySelector('#cancel-payment').addEventListener('click', () => this.close());
        modal.querySelector('#confirm-payment').addEventListener('click', () => this.confirmPayment());
        modal.querySelectorAll('.sidebar-tab').forEach(tab => tab.addEventListener('click', (e) => this.switchTab(e.currentTarget.dataset.tab)));
        
        modal.querySelectorAll('.payment-method-card').forEach(card => {
            card.addEventListener('click', async (e) => {
                const method = e.currentTarget.dataset.method;
                const isValid = await this.validateCustomerForPayment(method);
                if (isValid) {
                    this.selectPaymentMethod(method);
                }
            });
        });
        
        modal.querySelector('#installments').addEventListener('change', () => this.updateCardData());
        modal.querySelector('#amount-received').addEventListener('input', () => this.calculateChange());
        modal.querySelectorAll('.receipt-option').forEach(option => option.addEventListener('click', (e) => this.selectReceiptMethod(e.currentTarget.dataset.receipt)));
        modal.querySelector('#discount-amount').addEventListener('input', () => this.updateTotals());
        modal.querySelector('#surcharge-amount').addEventListener('input', () => this.updateTotals());
        modal.querySelector('#freight-amount').addEventListener('input', () => this.updateTotals());
        modal.querySelector('#freight-payer').addEventListener('change', () => this.updateTotals());
        modal.querySelector('#apply-coupon').addEventListener('click', () => this.applyCoupon());
        modal.querySelector('#apply-coupon-payment').addEventListener('click', () => this.applyCouponPayment());
        modal.querySelectorAll('.channel-option').forEach(channel => channel.addEventListener('click', (e) => this.selectSaleChannel(e.currentTarget.dataset.channel)));
        modal.querySelector('#discount-type-toggle').addEventListener('click', () => this.toggleDiscountType());
        modal.querySelector('#cashback-use-amount').addEventListener('input', () => this.updateCashbackUse());
        
        // Event listeners para validação de cashback múltiplo
        modal.querySelector('#payment-method-1').addEventListener('change', async (e) => {
            if (e.target.value === 'Cashback') {
                const isValid = await this.validateMultipleCashback(1);
                if (!isValid) e.target.value = 'Dinheiro';
            } else {
                this.hideMultipleCashbackInfo(1);
            }
            this.updateMultiplePayment();
        });
        
        modal.querySelector('#payment-method-2').addEventListener('change', async (e) => {
            if (e.target.value === 'Cashback') {
                const isValid = await this.validateMultipleCashback(2);
                if (!isValid) e.target.value = 'Dinheiro';
            } else {
                this.hideMultipleCashbackInfo(2);
            }
            this.updateMultiplePayment();
        });
        
        modal.querySelector('#payment-amount-1').addEventListener('input', async (e) => {
            const method1 = document.getElementById('payment-method-1').value;
            
            if (method1 === 'Cashback') {
                const valorSolicitado = parseFloat(e.target.value) || 0;
                const currentCustomer = this.getCurrentCustomer();
                
                if (currentCustomer && valorSolicitado > 0) {
                    const saldoDisponivel = await this.getCashbackBalance(currentCustomer.id);
                    this.validateMultipleCashbackAmount(1, valorSolicitado, saldoDisponivel, currentCustomer.nome);
                }
            }
            
            this.updateMultiplePayment();
        });
        
        modal.querySelector('#payment-amount-2').addEventListener('input', async (e) => {
            const method2 = document.getElementById('payment-method-2').value;
            
            if (method2 === 'Cashback') {
                const valorSolicitado = parseFloat(e.target.value) || 0;
                const currentCustomer = this.getCurrentCustomer();
                
                if (currentCustomer && valorSolicitado > 0) {
                    const saldoDisponivel = await this.getCashbackBalance(currentCustomer.id);
                    this.validateMultipleCashbackAmount(2, valorSolicitado, saldoDisponivel, currentCustomer.nome);
                }
            }
            
            this.updateMultiplePayment();
        });

        modal.querySelector('#installments-1').addEventListener('change', () => this.updateMultiplePayment());
        modal.querySelector('#installments-2').addEventListener('change', () => this.updateMultiplePayment());
        modal.querySelector('#apply-coupon-1').addEventListener('click', () => this.applyCouponMultiple(1));
        modal.querySelector('#apply-coupon-2').addEventListener('click', () => this.applyCouponMultiple(2));
        
        // Eventos das configurações
        modal.querySelector('#enable-crediario').addEventListener('change', (e) => {
            this.togglePaymentOption('Crediario', e.target.checked);
        });
        modal.querySelector('#enable-cashback').addEventListener('change', (e) => {
            this.togglePaymentOption('Cashback', e.target.checked);
        });
        modal.querySelector('#enable-multiplo').addEventListener('change', (e) => {
            this.togglePaymentOption('Multiplo', e.target.checked);
        });
        modal.querySelector('#enable-cupom').addEventListener('change', (e) => {
            this.togglePaymentOption('Cupom', e.target.checked);
        });
        modal.querySelector('#cashback-percentage').addEventListener('input', (e) => {
            const percentage = parseFloat(e.target.value) || 0;
            this.updateCashbackPercentage(percentage);
        });
        modal.querySelector('#reset-payment-config').addEventListener('click', () => this.resetPaymentConfig());
    },

    toggleDiscountType() {
        const toggleBtn = document.getElementById('discount-type-toggle');
        const discountInput = document.getElementById('discount-amount');
        const currentType = toggleBtn.dataset.type;
        const currentValue = parseFloat(discountInput.value) || 0;
        
        if (currentType === 'currency') {
            toggleBtn.dataset.type = 'percentage';
            toggleBtn.innerHTML = '<span style="font-size: 0.9em; opacity: 0.7;">R$</span> / <span style="font-weight: bold; font-size: 1.1em;">%</span>';
            this.paymentData.discountType = 'percentage';
            
            if (currentValue > 0) {
                const { subtotal } = calculateTotals();
                const percentageEquivalent = subtotal > 0 ? (currentValue / subtotal * 100) : 0;
                discountInput.value = percentageEquivalent.toFixed(2);
            }
        } else {
            toggleBtn.dataset.type = 'currency';
            toggleBtn.innerHTML = '<span style="font-weight: bold; font-size: 1.1em;">R$</span> / <span style="font-size: 0.9em; opacity: 0.7;">%</span>';
            this.paymentData.discountType = 'currency';
            
            if (currentValue > 0) {
                const { subtotal } = calculateTotals();
                const currencyEquivalent = (subtotal * currentValue) / 100;
                discountInput.value = currencyEquivalent.toFixed(2);
            }
        }
        
        if (currentValue > 0) this.updateTotals();
    },
    
    switchTab(tabName) {
        this.currentTab = tabName;
        document.querySelectorAll('.sidebar-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.toggle('active', content.id === `${tabName}-tab-content`));
    },

    selectPaymentMethod(method) {
        if ((method === 'Crediario' && !this.paymentConfig.enableCrediario) ||
            (method === 'Cashback' && !this.paymentConfig.enableCashback) ||
            (method === 'Multiplo' && !this.paymentConfig.enableMultiplo) ||
            (method === 'Cupom' && !this.paymentConfig.enableCupom)) {
            alert(`A forma de pagamento ${method} não está habilitada.`);
            return;
        }
        
        this.paymentData.method = method;
        document.querySelectorAll('.payment-method-card').forEach(card => card.classList.toggle('active', card.dataset.method === method));
        
        document.getElementById('card-options').classList.add('hidden');
        document.getElementById('cash-options').classList.add('hidden');
        document.getElementById('crediario-options').classList.add('hidden');
        document.getElementById('cashback-options').classList.add('hidden');
        document.getElementById('multiplo-options').classList.add('hidden');
        document.getElementById('cupom-options').classList.add('hidden');
        
        switch(method) {
            case 'Cartao':
                document.getElementById('card-options').classList.remove('hidden');
                this.populateInstallmentOptions();
                break;
            case 'Dinheiro':
                document.getElementById('cash-options').classList.remove('hidden');
                break;
            case 'Cupom':
                document.getElementById('cupom-options').classList.remove('hidden');
                break;
            case 'Crediario':
                document.getElementById('crediario-options').classList.remove('hidden');
                this.showCrediarioInfo();
                break;
            case 'Cashback':
                document.getElementById('cashback-options').classList.remove('hidden');
                this.showCashbackInfo();
                break;
            case 'Multiplo':
                document.getElementById('multiplo-options').classList.remove('hidden');
                this.updateMultiplePayment();
                break;
        }
        
        this.updateTotals();
    },

    showCashbackInfo() {
        const currentCustomer = window.saleState?.customer;
        const cashbackInfo = document.getElementById('cashback-customer-info');
        
        if (currentCustomer && cashbackInfo) {
            cashbackInfo.textContent = `Cliente: ${currentCustomer.nome}`;
        }
    },

    showCrediarioInfo() {
        // Método mantido para compatibilidade
    },

    selectReceiptMethod(method) {
        this.paymentData.receiptMethod = method;
        document.querySelectorAll('.receipt-option').forEach(opt => opt.classList.toggle('active', opt.dataset.receipt === method));
        document.getElementById('whatsapp-input').classList.toggle('hidden', method !== 'whatsapp');
        
        if (method === 'whatsapp' && !document.getElementById('whatsapp-number').value) {
            if (window.saleState?.customer?.telefone) {
                let whatsapp = window.saleState.customer.telefone.replace(/\D/g, '');
                if (whatsapp.length >= 10) {
                    if (whatsapp.length === 11) {
                        whatsapp = `(${whatsapp.substring(0, 2)}) ${whatsapp.substring(2, 7)}-${whatsapp.substring(7)}`;
                    } else if (whatsapp.length === 10) {
                        whatsapp = `(${whatsapp.substring(0, 2)}) ${whatsapp.substring(2, 6)}-${whatsapp.substring(6)}`;
                    }
                    document.getElementById('whatsapp-number').value = whatsapp;
                }
            }
        }
    },

    selectSaleChannel(channel) {
        this.paymentData.saleChannel = channel;
        document.querySelectorAll('.channel-option').forEach(opt => opt.classList.toggle('active', opt.dataset.channel === channel));
    },

    async show(totalAmount) {
        this.reset();
        this.paymentData.baseAmount = totalAmount;
        
        await this.detectAndLoadCustomer();
        this.setupPaymentOptions();
        
        document.getElementById('advanced-payment-modal').classList.remove('hidden');
        
        this.setDefaultMachine().then(() => {
            this.updateTotals();
            this.calculateCashback();
        });
        
        this.populateCustomerPhone();
        setTimeout(() => document.getElementById('amount-received')?.focus(), 100);
    },

    populateCustomerPhone() {
        if (window.saleState && window.saleState.customer && window.saleState.customer.telefone) {
            const whatsappNumberField = document.getElementById('whatsapp-number');
            if (whatsappNumberField) {
                let whatsapp = window.saleState.customer.telefone.replace(/\D/g, '');
                if (whatsapp.length >= 10) {
                    if (whatsapp.length === 11) {
                        whatsapp = `(${whatsapp.substring(0, 2)}) ${whatsapp.substring(2, 7)}-${whatsapp.substring(7)}`;
                    } else if (whatsapp.length === 10) {
                        whatsapp = `(${whatsapp.substring(0, 2)}) ${whatsapp.substring(2, 6)}-${whatsapp.substring(6)}`;
                    }
                    whatsappNumberField.value = whatsapp;
                }
            }
        }
    },

    setupPaymentOptions() {
        this.updatePaymentMethodVisibility();
        
        setTimeout(() => {
            const enableCrediario = document.getElementById('enable-crediario');
            const enableCashback = document.getElementById('enable-cashback');
            const enableMultiplo = document.getElementById('enable-multiplo');
            const enableCupom = document.getElementById('enable-cupom');
            const cashbackPercentage = document.getElementById('cashback-percentage');
            
            if (enableCrediario) enableCrediario.checked = this.paymentConfig.enableCrediario;
            if (enableCashback) enableCashback.checked = this.paymentConfig.enableCashback;
            if (enableMultiplo) enableMultiplo.checked = this.paymentConfig.enableMultiplo;
            if (enableCupom) enableCupom.checked = this.paymentConfig.enableCupom;
            if (cashbackPercentage) cashbackPercentage.value = this.paymentConfig.cashbackPercentage;
        }, 100);
    },
    
    togglePaymentOption(method, enabled) {
        switch(method) {
            case 'Crediario':
                this.paymentConfig.enableCrediario = enabled;
                break;
            case 'Cashback':
                this.paymentConfig.enableCashback = enabled;
                break;
            case 'Multiplo':
                this.paymentConfig.enableMultiplo = enabled;
                break;
            case 'Cupom':
                this.paymentConfig.enableCupom = enabled;
                break;
        }
        
        this.updatePaymentMethodVisibility();
        this.savePaymentConfig();
        
        if (typeof showNotification === 'function') {
            const status = enabled ? 'habilitada' : 'desabilitada';
            showNotification(`Forma de pagamento ${method} ${status}`, 'success');
        }
    },

    updatePaymentMethodVisibility() {
        document.getElementById('crediario-btn').style.display = this.paymentConfig.enableCrediario ? 'flex' : 'none';
        document.getElementById('cashback-btn').style.display = this.paymentConfig.enableCashback ? 'flex' : 'none';
        document.getElementById('multiplo-btn').style.display = this.paymentConfig.enableMultiplo ? 'flex' : 'none';
        document.getElementById('cupom-btn').style.display = this.paymentConfig.enableCupom ? 'flex' : 'none';
        
        const cupomSection = document.querySelector('.form-section.compact:nth-child(4)');
        if (cupomSection) {
            cupomSection.style.display = this.paymentConfig.enableCupom ? 'block' : 'none';
        }
        
        document.querySelectorAll('.crediario-option').forEach(option => {
            option.style.display = this.paymentConfig.enableCrediario ? 'block' : 'none';
        });
        
        document.querySelectorAll('.cashback-option').forEach(option => {
            option.style.display = this.paymentConfig.enableCashback ? 'block' : 'none';
        });
        
        document.querySelectorAll('.cupom-option').forEach(option => {
            option.style.display = this.paymentConfig.enableCupom ? 'block' : 'none';
        });
    },

    updateCashbackPercentage(value) {
        const percentage = parseFloat(value) || 1.0;
        this.paymentConfig.cashbackPercentage = Math.max(0, Math.min(100, percentage));
        this.savePaymentConfig();
        this.calculateCashback();
    },

    resetPaymentConfig() {
        if (confirm('Tem certeza que deseja resetar todas as configurações de pagamento?')) {
            this.paymentConfig = {
                enableCrediario: false,
                enableCashback: false,
                enableMultiplo: false,
                enableCupom: false,
                cashbackPercentage: 1.0
            };
            
            this.savePaymentConfig();
            this.setupPaymentOptions();
            
            if (typeof showNotification === 'function') {
                showNotification('Configurações de pagamento resetadas', 'info');
            }
        }
    },

    logPaymentConfig() {
        // Removido logs desnecessários
    },

    // updateMultiplePayment com validação de cashback integrada
    async updateMultiplePayment() {
        const method1 = document.getElementById('payment-method-1').value;
        const method2 = document.getElementById('payment-method-2').value;
        const amount1 = parseFloat(document.getElementById('payment-amount-1').value) || 0;
        const amount2 = parseFloat(document.getElementById('payment-amount-2').value) || 0;
        const total = this.getCurrentTotal();
        const remaining = total - (amount1 + amount2);
        
        this.paymentData.multiplePayment.method1 = method1;
        this.paymentData.multiplePayment.amount1 = amount1;
        this.paymentData.multiplePayment.method2 = method2;
        this.paymentData.multiplePayment.amount2 = amount2;
        
        document.getElementById('card-options-1').classList.toggle('hidden', method1 !== 'Cartao');
        document.getElementById('cupom-options-1').classList.toggle('hidden', method1 !== 'Cupom');
        document.getElementById('card-options-2').classList.toggle('hidden', method2 !== 'Cartao');
        document.getElementById('cupom-options-2').classList.toggle('hidden', method2 !== 'Cupom');
        
        if (method1 === 'Cashback') {
            const currentCustomer = this.getCurrentCustomer();
            if (currentCustomer) {
                const saldo = await this.getCashbackBalance(currentCustomer.id);
                this.updateMultipleCashbackInfo(1, currentCustomer, saldo);
            }
        } else {
            this.hideMultipleCashbackInfo(1);
        }
        
        if (method2 === 'Cashback') {
            const currentCustomer = this.getCurrentCustomer();
            if (currentCustomer) {
                const saldo = await this.getCashbackBalance(currentCustomer.id);
                this.updateMultipleCashbackInfo(2, currentCustomer, saldo);
            }
        } else {
            this.hideMultipleCashbackInfo(2);
        }
        
        document.getElementById('multiplo-remaining').textContent = this.formatCurrency(remaining);
        document.getElementById('multiplo-remaining').style.color = remaining < 0 ? 'red' : (remaining > 0 ? 'var(--primary-color)' : 'green');
    },

    // confirmPayment com validação final de cashback múltiplo
    async confirmPayment() {
        if (this.paymentData.method === 'Multiplo') {
            const method1 = this.paymentData.multiplePayment.method1;
            const method2 = this.paymentData.multiplePayment.method2;
            const amount1 = this.paymentData.multiplePayment.amount1;
            const amount2 = this.paymentData.multiplePayment.amount2;
            const currentCustomer = this.getCurrentCustomer();

            if (method1 === 'Cashback') {
                if (!currentCustomer) {
                    return alert('Cliente deve estar selecionado para usar Cashback no método 1.');
                }
                
                const saldo1 = await this.getCashbackBalance(currentCustomer.id);
                if (amount1 > saldo1) {
                    return alert(`Saldo insuficiente no método 1!\nSaldo disponível: ${this.formatCurrency(saldo1)}\nValor solicitado: ${this.formatCurrency(amount1)}`);
                }
            }

            if (method2 === 'Cashback') {
                if (!currentCustomer) {
                    return alert('Cliente deve estar selecionado para usar Cashback no método 2.');
                }
                
                const saldo2 = await this.getCashbackBalance(currentCustomer.id);
                const totalCashbackUsado = (method1 === 'Cashback' ? amount1 : 0) + amount2;
                
                if (totalCashbackUsado > saldo2) {
                    return alert(`Saldo total de cashback insuficiente!\nSaldo disponível: ${this.formatCurrency(saldo2)}\nTotal solicitado: ${this.formatCurrency(totalCashbackUsado)}`);
                }
            }

            const total = this.getCurrentTotal();
            if (amount1 <= 0 || amount2 <= 0) {
                return alert('Informe valores válidos para ambas as formas de pagamento.');
            }
            if (Math.abs((amount1 + amount2) - total) > 0.01) {
                return alert('A soma dos valores deve ser igual ao total da venda.');
            }
        }

        switch(this.paymentData.method) {
            case 'Dinheiro':
                if (this.paymentData.amountReceived < this.getCurrentTotal()) {
                    return alert('O valor recebido é menor que o total da venda.');
                }
                break;
            case 'Cashback':
                const cashbackUse = parseFloat(document.getElementById('cashback-use-amount').value) || 0;
                const totalVenda = this.getCurrentTotal();
                
                if (cashbackUse <= 0) {
                    return alert('Informe o valor de cashback a ser utilizado.');
                }
                if (cashbackUse > this.paymentData.cashbackAvailable) {
                    return alert('O valor de cashback utilizado não pode ser maior que o disponível.');
                }
                if (cashbackUse < totalVenda) {
                    return alert('O valor de cashback utilizado deve ser igual ou maior que o total da venda para finalizar com cashback.');
                }
                break;
            case 'Crediario':
                if (!document.getElementById('crediario-first-date').value) {
                    return alert('Informe a data da primeira parcela.');
                }
                break;
            case 'Cupom':
                if (!this.paymentData.coupon) {
                    return alert('Nenhum cupom foi aplicado.');
                }
                break;
        }
        
        if (this.paymentData.receiptMethod === 'whatsapp' && !document.getElementById('whatsapp-number').value.trim()) {
            return alert('Digite o número do WhatsApp para envio do comprovante.');
        }
        
        this.paymentData.seller = document.getElementById('seller-select').value;
        this.paymentData.whatsappNumber = document.getElementById('whatsapp-number').value.trim();
        this.paymentData.deliveryPerson = document.getElementById('delivery-person-name').value.trim();
        
        if (this.paymentData.method === 'Crediario') {
            this.paymentData.crediarioInstallments = document.getElementById('crediario-installments').value;
            this.paymentData.crediarioFirstDate = document.getElementById('crediario-first-date').value;
        } else if (this.paymentData.method === 'Cashback') {
            this.paymentData.cashbackUseAmount = parseFloat(document.getElementById('cashback-use-amount').value) || 0;
        } else if (this.paymentData.method === 'Multiplo') {
            this.paymentData.multiplePayment.method1 = document.getElementById('payment-method-1').value;
            this.paymentData.multiplePayment.amount1 = parseFloat(document.getElementById('payment-amount-1').value) || 0;
            this.paymentData.multiplePayment.method2 = document.getElementById('payment-method-2').value;
            this.paymentData.multiplePayment.amount2 = parseFloat(document.getElementById('payment-amount-2').value) || 0;
        }
        
        const simulatedSaleId = Math.floor(10000 + Math.random() * 90000);
        
        const saleDataForFunctions = {
            items: cart,
            customer: saleState.customer,
            totals: calculateTotals(),
            payment: this.paymentData,
            adjustments: {
                discount: this.paymentData.discount || 0,
                surcharge: this.paymentData.surcharge || 0,
                freight: this.paymentData.freight || 0,
                freightPaidBy: this.paymentData.freightPaidBy || 'casa',
                cashback: this.paymentData.cashback || 0
            },
            info: {
                seller: this.paymentData.seller || window.currentUser?.id,
                deliveryPerson: this.paymentData.deliveryPerson || null,
                saleChannel: this.paymentData.saleChannel || 'presencial'
            },
            receipt: {
                method: this.paymentData.receiptMethod || 'none',
                whatsappNumber: this.paymentData.whatsappNumber || null
            }
        };
        
        if (this.paymentData.receiptMethod === 'print') {
            if (typeof window.imprimirCupomVenda === 'function') {
                window.imprimirCupomVenda(saleDataForFunctions, simulatedSaleId);
            }
        } else if (this.paymentData.receiptMethod === 'whatsapp') {
            if (typeof window.enviarWhatsAppVenda === 'function') {
                window.enviarWhatsAppVenda(saleDataForFunctions, simulatedSaleId, this.paymentData.whatsappNumber);
            }
        }
        
        if (typeof window.finalizeAdvancedSale === 'function') {
            window.finalizeAdvancedSale({
                totalAmount: this.getCurrentTotal(),
                method: this.paymentData.method,
                cardType: this.paymentData.cardType,
                installments: this.paymentData.installments,
                amountReceived: this.paymentData.amountReceived,
                change: this.paymentData.change,
                fees: this.paymentData.fees,
                discount: this.paymentData.discount,
                surcharge: this.paymentData.surcharge,
                freight: this.paymentData.freight,
                freightPaidBy: this.paymentData.freightPaidBy,
                cashback: this.paymentData.cashback,
                coupon: this.paymentData.coupon,
                deliveryPerson: this.paymentData.deliveryPerson,
                saleChannel: this.paymentData.saleChannel,
                receiptMethod: this.paymentData.receiptMethod,
                whatsappNumber: this.paymentData.whatsappNumber,
                crediarioInstallments: this.paymentData.crediarioInstallments,
                crediarioFirstDate: this.paymentData.crediarioFirstDate,
                cashbackUseAmount: this.paymentData.cashbackUseAmount,
                multiplePayment: this.paymentData.multiplePayment,
                machineUsed: this.currentMachine?.nome || 'Nenhuma'
            });
        }
        
        this.close();
    }
});

// Integração com instância existente
if (window.paymentModal) {
    Object.assign(window.paymentModal, {
        getCashbackBalance: PaymentModalConfig.prototype.getCashbackBalance,
        validateMultipleCashback: PaymentModalConfig.prototype.validateMultipleCashback,
        updateMultipleCashbackInfo: PaymentModalConfig.prototype.updateMultipleCashbackInfo,
        hideMultipleCashbackInfo: PaymentModalConfig.prototype.hideMultipleCashbackInfo,
        validateMultipleCashbackAmount: PaymentModalConfig.prototype.validateMultipleCashbackAmount,
        getCurrentCustomer: PaymentModalConfig.prototype.getCurrentCustomer,
        updateMultiplePayment: PaymentModalConfig.prototype.updateMultiplePayment,
        confirmPayment: PaymentModalConfig.prototype.confirmPayment,
        bindEvents: PaymentModalConfig.prototype.bindEvents
    });
    
    window.paymentModal.bindEvents();
}

// CSS para cashback múltiplo
const cashbackMultiploStyle = document.createElement('style');
cashbackMultiploStyle.textContent = `
    .cashback-multiplo-info {
        margin-top: 0.5rem; padding: 0.5rem; background-color: rgba(255, 152, 0, 0.1);
        border-radius: 4px; font-size: 0.9rem; color: var(--primary-color);
        font-weight: 500; border: 1px solid rgba(255, 152, 0, 0.2); animation: fadeIn 0.3s ease;
    }
    .cashback-multiplo-info strong { color: var(--primary-dark); font-weight: 600; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    .cashback-invalid { border-color: #ef4444 !important; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2) !important; }
    .cashback-valid { border-color: #10b981 !important; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2) !important; }
`;
document.head.appendChild(cashbackMultiploStyle);