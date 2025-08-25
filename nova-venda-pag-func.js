// Faz a janela de pagamento funcionar - carrega vendedores/máquinas, calcula taxas e finaliza vendas

class PaymentModal extends PaymentModalConfig {
    constructor() {
        super();
        this.loadSellers();
        this.loadCardMachines();
        this.setupPaymentOptions();
    }

    async loadSellers() {
        try {
            console.log('🔍 Carregando vendedores da tabela user...');
            
            if (!window.currentCompanyId || !window.currentUser) {
                console.log('⏳ Aguardando dados do usuário...');
                
                for (let i = 0; i < 50; i++) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                    if (window.currentCompanyId && window.currentUser) {
                        console.log('✅ Dados carregados!');
                        break;
                    }
                    
                    if (i === 49) {
                        console.error('❌ Timeout: Dados não carregaram');
                        return;
                    }
                }
            }

            const { data, error } = await supabaseClient
                .from('user')
                .select('id, nome, funcao')
                .eq('id_empresa', window.currentCompanyId)
                .order('nome', { ascending: true });

            if (error) throw error;

            const sellerSelect = document.getElementById('seller-select');
            sellerSelect.innerHTML = '<option value="">Selecione um vendedor</option>';

            if (data && data.length > 0) {
                data.forEach(seller => {
                    const displayName = seller.funcao 
                        ? `${seller.nome} (${seller.funcao})` 
                        : seller.nome;
                    
                    const option = document.createElement('option');
                    option.value = seller.id;
                    option.textContent = displayName;
                    sellerSelect.appendChild(option);
                });

                if (window.currentUser?.id) {
                    const currentUserOption = sellerSelect.querySelector(`option[value="${window.currentUser.id}"]`);
                    if (currentUserOption) {
                        currentUserOption.selected = true;
                        this.paymentData.seller = window.currentUser.id;
                    }
                }
            } else {
                sellerSelect.innerHTML = '<option value="">Nenhum vendedor disponível</option>';
            }

        } catch (error) {
            console.error('❌ Erro ao carregar vendedores:', error);
            document.getElementById('seller-select').innerHTML = '<option value="">Erro ao carregar vendedores</option>';
        }
    }

    // ===== CARREGAR MÁQUINAS DE CARTÃO =====
    async loadCardMachines() {
        try {
            console.log('🏧 Carregando máquinas de cartão...');
            
            if (!window.currentCompanyId || !window.currentUser) {
                console.log('⏳ Aguardando dados do usuário para máquinas...');
                
                for (let i = 0; i < 50; i++) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                    if (window.currentCompanyId && window.currentUser) {
                        console.log('✅ Dados carregados para máquinas!');
                        break;
                    }
                    
                    if (i === 49) {
                        console.error('❌ Timeout: Dados não carregaram para máquinas');
                        this.currentMachine = null;
                        return;
                    }
                }
            }

            const { data, error } = await supabaseClient
                .from('maquinas')
                .select('*')
                .eq('id_empresa', window.currentCompanyId)
                .order('nome', { ascending: true });

            if (error) throw error;

            this.cardMachines = data || [];
            console.log('💳 Máquinas carregadas:', this.cardMachines);
            
            await this.setDefaultMachine();
            
        } catch (error) {
            console.error('❌ Erro ao carregar máquinas de cartão:', error);
            this.currentMachine = null;
        }
    }

    // ===== DEFINIR MÁQUINA PADRÃO =====
    async setDefaultMachine() {
        try {
            if (this.cardMachines.length === 0) {
                console.warn('⚠️ Nenhuma máquina cadastrada');
                this.currentMachine = null;
                return;
            }

            const savedConfig = JSON.parse(localStorage.getItem('pdv-config')) || {};
            const defaultMachineId = savedConfig.defaultCardMachine;
            
            console.log('🎯 ID da máquina padrão configurada:', defaultMachineId);
            
            if (defaultMachineId) {
                const selectedMachine = this.cardMachines.find(m => m.id == defaultMachineId);
                
                if (selectedMachine) {
                    this.currentMachine = selectedMachine;
                    console.log('✅ Máquina padrão definida:', selectedMachine.nome);
                } else {
                    this.currentMachine = this.cardMachines[0];
                    console.log('⚠️ Máquina configurada não encontrada, usando primeira:', this.currentMachine.nome);
                }
            } else {
                this.currentMachine = this.cardMachines[0];
                console.log('📋 Usando primeira máquina disponível:', this.currentMachine.nome);
            }
            
        } catch (error) {
            console.error('❌ Erro ao definir máquina padrão:', error);
            this.currentMachine = this.cardMachines[0] || null;
        }
    }

    // ===== POPULAR OPÇÕES DE PARCELAMENTO =====
    populateInstallmentOptions() {
        const select = document.getElementById('installments');
        select.innerHTML = '';
        
        if (!this.currentMachine) {
            console.warn('⚠️ Nenhuma máquina configurada');
            select.innerHTML = '<option value="">Nenhuma máquina configurada</option>';
            return;
        }
        
        console.log(`💳 Populando opções para máquina: ${this.currentMachine.nome}`);
        
        const options = [
            { key: 'debito', label: 'Débito à Vista', taxField: 'taxa_debito' },
            { key: '1x', label: 'Crédito 1x', taxField: 'taxa_1x' },
            { key: '2x', label: 'Crédito 2x', taxField: 'taxa_2x' },
            { key: '3x', label: 'Crédito 3x', taxField: 'taxa_3x' },
            { key: '4x', label: 'Crédito 4x', taxField: 'taxa_4x' },
            { key: '5x', label: 'Crédito 5x', taxField: 'taxa_5x' },
            { key: '6x', label: 'Crédito 6x', taxField: 'taxa_6x' },
            { key: '7x', label: 'Crédito 7x', taxField: 'taxa_7x' },
            { key: '8x', label: 'Crédito 8x', taxField: 'taxa_8x' },
            { key: '9x', label: 'Crédito 9x', taxField: 'taxa_9x' },
            { key: '10x', label: 'Crédito 10x', taxField: 'taxa_10x' },
            { key: '11x', label: 'Crédito 11x', taxField: 'taxa_11x' },
            { key: '12x', label: 'Crédito 12x', taxField: 'taxa_12x' }
        ];
        
        options.forEach(option => {
            const taxValue = this.currentMachine[option.taxField] || 0;
            
            // Só mostrar se a taxa foi configurada (> 0)
            if (taxValue > 0) {
                const optionElement = document.createElement('option');
                optionElement.value = option.key;
                optionElement.textContent = `${option.label} (${taxValue.toFixed(2)}%)`;
                select.appendChild(optionElement);
            }
        });
        
        // Popular selects do pagamento múltiplo também
        this.populateMultipleInstallmentOptions();
        
        if (select.children.length === 0) {
            select.innerHTML = '<option value="">Nenhuma taxa configurada</option>';
            console.warn('⚠️ Nenhuma taxa configurada para esta máquina');
        }
        
        this.updateCardData();
    }

    // ===== POPULAR OPÇÕES PARA PAGAMENTO MÚLTIPLO =====
    populateMultipleInstallmentOptions() {
        const selects = ['installments-1', 'installments-2'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select || !this.currentMachine) return;
            
            select.innerHTML = '';
            
            const options = [
                { key: 'debito', label: 'Débito à Vista', taxField: 'taxa_debito' },
                { key: '1x', label: 'Crédito 1x', taxField: 'taxa_1x' },
                { key: '2x', label: 'Crédito 2x', taxField: 'taxa_2x' },
                { key: '3x', label: 'Crédito 3x', taxField: 'taxa_3x' },
                { key: '4x', label: 'Crédito 4x', taxField: 'taxa_4x' },
                { key: '5x', label: 'Crédito 5x', taxField: 'taxa_5x' },
                { key: '6x', label: 'Crédito 6x', taxField: 'taxa_6x' },
                { key: '7x', label: 'Crédito 7x', taxField: 'taxa_7x' },
                { key: '8x', label: 'Crédito 8x', taxField: 'taxa_8x' },
                { key: '9x', label: 'Crédito 9x', taxField: 'taxa_9x' },
                { key: '10x', label: 'Crédito 10x', taxField: 'taxa_10x' },
                { key: '11x', label: 'Crédito 11x', taxField: 'taxa_11x' },
                { key: '12x', label: 'Crédito 12x', taxField: 'taxa_12x' }
            ];
            
            options.forEach(option => {
                const taxValue = this.currentMachine[option.taxField] || 0;
                
                if (taxValue > 0) {
                    const optionElement = document.createElement('option');
                    optionElement.value = option.key;
                    optionElement.textContent = `${option.label} (${taxValue.toFixed(2)}%)`;
                    select.appendChild(optionElement);
                }
            });
        });
    }

    // ===== CÁLCULOS E ATUALIZAÇÕES =====

    updateCardData() {
        const selectedOption = document.getElementById('installments').value;
        
        if (selectedOption === 'debito') {
            this.paymentData.cardType = 'Debito';
            this.paymentData.installments = 1;
        } else if (selectedOption) {
            this.paymentData.cardType = 'Credito';
            this.paymentData.installments = parseInt(selectedOption.replace('x', ''), 10);
        }
        
        this.calculateFees();
    }
    
    calculateFees() {
        this.paymentData.fees = 0;
        
        if (this.paymentData.method === 'Cartao' && this.currentMachine) {
            const total = this.getCurrentTotal();
            const selectedOption = document.getElementById('installments').value;
            
            if (!selectedOption) {
                console.log('💳 Nenhuma modalidade selecionada');
                document.getElementById('fees-display').textContent = this.formatCurrency(0);
                document.getElementById('fees-payer').textContent = `  Máquina: ${this.currentMachine.nome}`;
                return;
            }
            
            let taxField = '';
            if (selectedOption === 'debito') {
                taxField = 'taxa_debito';
            } else {
                taxField = `taxa_${selectedOption}`;
            }
            
            const taxRate = this.currentMachine[taxField] || 0;
            this.paymentData.fees = (total * taxRate) / 100;
            
            console.log(`💰 Taxa: ${this.currentMachine.nome} - ${taxField} = ${taxRate}% = ${this.formatCurrency(this.paymentData.fees)}`);
        }
        
        document.getElementById('fees-display').textContent = this.formatCurrency(this.paymentData.fees);
        document.getElementById('fees-payer').textContent = this.currentMachine ? `  Máquina: ${this.currentMachine.nome}` : '';
        this.updateTotalDisplay();
    }
    
    // ✅ CORREÇÃO: Cálculo de troco agora está correto
    calculateChange() {
            // Pega uma referência ao modal correto para evitar conflito de IDs
            const modal = document.getElementById('advanced-payment-modal');
            if (!modal) return;

            // Procura os elementos APENAS dentro do modal correto
            const receivedInput = modal.querySelector('#amount-received');
            const changeDisplay = modal.querySelector('#change-amount');
            if (!receivedInput || !changeDisplay) return;

            const received = parseFloat(receivedInput.value) || 0;
            this.paymentData.amountReceived = received;
            
            const total = this.getCurrentTotal();
            let change = 0;
            
            if (received > total) {
                change = received - total;
            }
            
            this.paymentData.change = change;
            changeDisplay.textContent = this.formatCurrency(change);
            
            console.log(`💰 Troco: Recebido ${this.formatCurrency(received)} - Total ${this.formatCurrency(total)} = ${this.formatCurrency(change)}`);
        }

    calculateCashback() {
        const total = this.getCurrentTotal();
        const cashbackEnabled = this.paymentConfig.enableCashback;
        const cashbackPercentage = this.paymentConfig.cashbackPercentage || 0;
        
        // Só gerar cashback se estiver habilitado
        if (cashbackEnabled) {
            this.paymentData.cashback = total * (cashbackPercentage / 100);
        } else {
            this.paymentData.cashback = 0;
        }
        
        document.getElementById('cashback-amount').value = this.paymentData.cashback.toFixed(2);
        
        if (this.paymentData.method === 'Cashback') {
            document.getElementById('cashback-generated').textContent = this.formatCurrency(0);
        } else {
            document.getElementById('cashback-generated').textContent = this.formatCurrency(this.paymentData.cashback);
        }
    }

    updateTotals() {
        const discountValue = parseFloat(document.getElementById('discount-amount').value) || 0;
        const discountType = document.getElementById('discount-type-toggle').dataset.type || 'currency';
        
        // CORREÇÃO: Calcular desconto baseado no tipo usando a estrutura correta do carrinho
        if (discountType === 'percentage') {
            // Usar a função calculateTotals() que já existe e funciona corretamente
            const { subtotal } = calculateTotals();
            this.paymentData.discount = (subtotal * discountValue) / 100;
        } else {
            this.paymentData.discount = discountValue;
        }
        
        this.paymentData.surcharge = parseFloat(document.getElementById('surcharge-amount').value) || 0;
        this.paymentData.freight = parseFloat(document.getElementById('freight-amount').value) || 0;
        this.paymentData.freightPaidBy = document.getElementById('freight-payer').value;
        if (this.paymentData.method === 'Cartao') this.calculateFees();
        this.updateTotalDisplay();
        this.calculateChange();
        this.calculateCashback();
    }

    updateCashbackPercentage(value) {
        const percentage = parseFloat(value) || 1.0;
        this.paymentConfig.cashbackPercentage = Math.max(0, Math.min(100, percentage));
        this.calculateCashback();
    }

    // ===== FUNCIONALIDADES DE CUPOM =====

    applyCoupon() {
        if (!this.paymentConfig.enableCupom) {
            alert('A funcionalidade de cupom não está habilitada.');
            return;
        }
        
        const couponCode = document.getElementById('coupon-code').value.trim().toUpperCase();
        if (!couponCode) return;
        const discount = ({ 'DESC10': 10, 'FRETE5': 5 })[couponCode];
        if (discount) {
            document.getElementById('discount-amount').value = discount;
            this.paymentData.coupon = couponCode;
            this.updateTotals();
            alert(`Cupom '${couponCode}' aplicado!`);
        } else {
            alert('Cupom inválido!');
        }
    }
    
    applyCouponPayment() {
        if (!this.paymentConfig.enableCupom) {
            alert('A funcionalidade de cupom não está habilitada.');
            return;
        }
        
        const couponCode = document.getElementById('cupom-code-payment').value.trim().toUpperCase();
        if (!couponCode) return;
        const discount = ({ 'DESC10': 10, 'FRETE5': 5 })[couponCode];
        if (discount) {
            this.paymentData.coupon = couponCode;
            const cupomAppliedElement = document.getElementById('cupom-applied');
            cupomAppliedElement.innerHTML = `<span class="cupom-applied-code">${couponCode}</span> (${discount} reais de desconto)`;
            alert(`Cupom '${couponCode}' aplicado!`);
        } else {
            alert('Cupom inválido!');
        }
    }

    applyCouponMultiple(index) {
        if (!this.paymentConfig.enableCupom) {
            alert('A funcionalidade de cupom não está habilitada.');
            return;
        }
        
        const couponCode = document.getElementById(`cupom-code-${index}`).value.trim().toUpperCase();
        if (!couponCode) return;
        
        const discount = ({ 'DESC10': 10, 'FRETE5': 5 })[couponCode];
        if (discount) {
            this.paymentData.multiplePayment[`coupon${index}`] = couponCode;
            const cupomAppliedElement = document.getElementById(`cupom-applied-${index}`);
            cupomAppliedElement.innerHTML = `<span class="cupom-applied-code">${couponCode}</span> (${discount} reais de desconto)`;
            alert(`Cupom '${couponCode}' aplicado ao método de pagamento ${index}!`);
            this.updateMultiplePayment();
        } else {
            alert('Cupom inválido!');
        }
    }

    // ===== FUNCIONALIDADES DE PAGAMENTO MÚLTIPLO =====
    
    updateMultiplePayment() {
        const amount1 = parseFloat(document.getElementById('payment-amount-1').value) || 0;
        const amount2 = parseFloat(document.getElementById('payment-amount-2').value) || 0;
        const total = this.getCurrentTotal();
        const remaining = total - (amount1 + amount2);
        
        const method1 = document.getElementById('payment-method-1').value;
        const method2 = document.getElementById('payment-method-2').value;
        
        this.paymentData.multiplePayment.method1 = method1;
        this.paymentData.multiplePayment.amount1 = amount1;
        this.paymentData.multiplePayment.method2 = method2;
        this.paymentData.multiplePayment.amount2 = amount2;
        
        document.getElementById('card-options-1').classList.toggle('hidden', method1 !== 'Cartao');
        document.getElementById('cupom-options-1').classList.toggle('hidden', method1 !== 'Cupom');
        document.getElementById('card-options-2').classList.toggle('hidden', method2 !== 'Cartao');
        document.getElementById('cupom-options-2').classList.toggle('hidden', method2 !== 'Cupom');
        
        document.getElementById('multiplo-remaining').textContent = this.formatCurrency(remaining);
        document.getElementById('multiplo-remaining').style.color = remaining < 0 ? 'red' : (remaining > 0 ? 'var(--primary-color)' : 'green');
    }

    // ===== FUNCIONALIDADES DE CASHBACK =====
    
    updateCashbackUse() {
        const useAmount = parseFloat(document.getElementById('cashback-use-amount').value) || 0;
        const available = this.paymentData.cashbackAvailable;
        
        if (useAmount > available) {
            alert(`Você só possui ${this.formatCurrency(available)} de cashback disponível.`);
            document.getElementById('cashback-use-amount').value = available.toFixed(2);
            this.paymentData.cashbackUseAmount = available;
        } else {
            this.paymentData.cashbackUseAmount = useAmount;
        }
    }

    // ===== CONFIRMAÇÃO DA VENDA - CORRIGIDO =====

    confirmPayment() {
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
            case 'Multiplo':
                const amount1 = parseFloat(document.getElementById('payment-amount-1').value) || 0;
                const amount2 = parseFloat(document.getElementById('payment-amount-2').value) || 0;
                const total = this.getCurrentTotal();
                if (amount1 <= 0 || amount2 <= 0) {
                    return alert('Informe valores válidos para ambas as formas de pagamento.');
                }
                if (Math.abs((amount1 + amount2) - total) > 0.01) {
                    return alert('A soma dos valores deve ser igual ao total da venda.');
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
        
        // ===== AQUI É O LOCAL CORRETO PARA CHAMAR AS FUNÇÕES =====
        const simulatedSaleId = Math.floor(10000 + Math.random() * 90000);
        
        // Preparar dados da venda para as funções
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
        
        // CHAMAR FUNÇÕES DE COMPROVANTE ANTES DE FINALIZAR
        if (this.paymentData.receiptMethod === 'print') {
            console.log('🖨️ Chamando função de impressão...');
            if (typeof window.imprimirCupomVenda === 'function') {
                window.imprimirCupomVenda(saleDataForFunctions, simulatedSaleId);
            } else {
                console.error('❌ Função imprimirCupomVenda não encontrada');
            }
        } else if (this.paymentData.receiptMethod === 'whatsapp') {
            console.log('📱 Chamando função do WhatsApp...');
            if (typeof window.enviarWhatsAppVenda === 'function') {
                window.enviarWhatsAppVenda(saleDataForFunctions, simulatedSaleId, this.paymentData.whatsappNumber);
            } else {
                console.error('❌ Função enviarWhatsAppVenda não encontrada');
            }
        }
        
        // 🔥 PRINCIPAL CORREÇÃO: Garantir que totalAmount correto é enviado
        if (typeof window.finalizeAdvancedSale === 'function') {
            window.finalizeAdvancedSale({
                totalAmount: this.getCurrentTotal(),  // ← VALOR CORRETO DO MODAL
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
        } else {
            console.log('Dados da Venda Final:', this.paymentData);
            alert('Venda finalizada com sucesso!');
        }
        
        this.close();
    }
}

// Criar instância global
window.paymentModal = new PaymentModal();