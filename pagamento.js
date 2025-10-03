// pagamento.js - Sistema completo de pagamento com Mercado Pago + Supabase
// Versão funcional que realmente salva e verifica pagamentos

document.addEventListener('userDataReady', () => {
    if (!window.currentCompanyId || !window.currentUser) {
        console.error("Dados necessários não encontrados");
        return;
    }
    
    console.log('💳 Iniciando sistema de pagamento para empresa:', window.currentCompanyId);
    
    // Configurações
    const MP_ACCESS_TOKEN = 'APP_USR-5563069263691299-090209-dc5e7e6edf934cd58b0bf74c9570485a-2666857124';
    const supabaseClient = window.supabaseClient || supabase.createClient(
        'https://gnehkswoqlpchtlgyjyj.supabase.co', 
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduZWhrc3dvcWxwY2h0bGd5anlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4OTY3NjYsImV4cCI6MjA2OTQ3Mjc2Nn0.8giA1bDvCzg_pkimGO9qHRF2I0QfhG6nx9U_tdY'
    );

    // Elementos DOM
    const planoCards = document.querySelectorAll('.plano-card');
    const pagamentoCards = document.querySelectorAll('.pagamento-card');
    const pagamentoSection = document.getElementById('pagamento-section');
    const btnPagar = document.getElementById('btn-pagar');
    const messageDiv = document.getElementById('message');
    
    // Estado da aplicação
    let planoSelecionado = null;
    let pagamentoSelecionado = null;
    let processandoPagamento = false;
    let assinaturaAtual = null;

    // Preços
    const precos = {
        mensal: { pix: 27.00, cartao: 29.99 },
        anual: { pix: 279.00, cartao: 309.99 }
    };

    // INICIALIZAÇÃO
    setupEventListeners();
    carregarStatusAssinatura();
    verificarRetornoMercadoPago();
    carregarHistorico();

    // ===== EVENT LISTENERS =====
    function setupEventListeners() {
        // Seleção de planos
        planoCards.forEach(card => {
            card.addEventListener('click', () => {
                if (processandoPagamento) return;
                
                planoCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                planoSelecionado = card.dataset.plano;
                
                atualizarPrecos();
                pagamentoSection.classList.add('show');
                atualizarBotaoPagar();
            });
        });

        // Seleção de forma de pagamento
        pagamentoCards.forEach(card => {
            card.addEventListener('click', () => {
                if (processandoPagamento) return;
                
                pagamentoCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                pagamentoSelecionado = card.dataset.pagamento;
                
                atualizarBotaoPagar();
            });
        });

        // Botão de pagamento
        btnPagar.addEventListener('click', iniciarProcessoPagamento);
    }

    // ===== CARREGAR STATUS DA ASSINATURA =====
    async function carregarStatusAssinatura() {
        try {
            console.log('📋 Carregando status da assinatura...');
            
            // Busca assinatura existente
            const { data: assinatura, error } = await supabaseClient
                .from('assinaturas')
                .select('*')
                .eq('auth_user_id', window.currentUser.auth_user_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!error && assinatura) {
                assinaturaAtual = assinatura;
                console.log('✅ Assinatura encontrada:', assinatura.plano);
            } else {
                // Calcula período de teste
                assinaturaAtual = calcularPeriodoTeste();
                console.log('🎁 Usando período de teste');
            }

            atualizarInterfaceStatus();

        } catch (error) {
            console.error('❌ Erro ao carregar status:', error);
            assinaturaAtual = calcularPeriodoTeste();
            atualizarInterfaceStatus();
        }
    }

    function calcularPeriodoTeste() {
        const dataCadastro = new Date(window.currentUser.created_at);
        const hoje = new Date();
        const fimTeste = new Date(dataCadastro);
        fimTeste.setDate(fimTeste.getDate() + 30);
        
        const diasRestantes = Math.ceil((fimTeste - hoje) / (1000 * 60 * 60 * 24));

        return {
            plano: 'teste',
            data_inicio: dataCadastro.toISOString().split('T')[0],
            data_vencimento: fimTeste.toISOString().split('T')[0],
            status: diasRestantes > 0 ? 'teste_ativo' : 'teste_vencido',
            dias_restantes: diasRestantes,
            valor_pago: 0
        };
    }

    // ===== ATUALIZAR INTERFACE =====
    function atualizarInterfaceStatus() {
        const statusIcon = document.getElementById('status-icon');
        const statusTitle = document.getElementById('status-title');
        const statusDetails = document.getElementById('status-details');
        const statusDate = document.getElementById('status-date');

        if (!assinaturaAtual) {
            statusIcon.className = 'fas fa-exclamation-triangle status-icon status-vencida';
            statusTitle.textContent = 'Erro ao carregar';
            statusDetails.textContent = 'Não foi possível verificar status';
            statusDate.textContent = 'Recarregue a página';
            return;
        }

        const diasRestantes = assinaturaAtual.dias_restantes;

        // Status baseado no tipo e dias restantes
        if (assinaturaAtual.plano === 'teste') {
            if (diasRestantes > 0) {
                statusIcon.className = 'fas fa-gift status-icon status-ativa';
                statusTitle.textContent = 'Período Gratuito Ativo';
                statusDetails.textContent = `${diasRestantes} dias restantes do período de teste`;
                statusDate.textContent = `Válido até ${formatarData(assinaturaAtual.data_vencimento)}`;
                statusDate.className = 'status-date date-ativa';
            } else {
                statusIcon.className = 'fas fa-hourglass-end status-icon status-vencida';
                statusTitle.textContent = 'Período Gratuito Expirado';
                statusDetails.textContent = `Teste expirou há ${Math.abs(diasRestantes)} dias`;
                statusDate.textContent = 'Assine um plano para continuar';
                statusDate.className = 'status-date date-vencida';
            }
        } else {
            // Assinatura paga
            if (diasRestantes > 7) {
                statusIcon.className = 'fas fa-check-circle status-icon status-ativa';
                statusTitle.textContent = `Plano ${assinaturaAtual.plano.charAt(0).toUpperCase() + assinaturaAtual.plano.slice(1)} Ativo`;
                statusDetails.textContent = `${diasRestantes} dias restantes`;
                statusDate.textContent = `Renova em ${formatarData(assinaturaAtual.data_vencimento)}`;
                statusDate.className = 'status-date date-ativa';
            } else if (diasRestantes > 0) {
                statusIcon.className = 'fas fa-exclamation-triangle status-icon status-vencendo';
                statusTitle.textContent = 'Assinatura Vencendo';
                statusDetails.textContent = `Apenas ${diasRestantes} dias restantes`;
                statusDate.textContent = `Vence em ${formatarData(assinaturaAtual.data_vencimento)}`;
                statusDate.className = 'status-date date-vencendo';
            } else {
                statusIcon.className = 'fas fa-times-circle status-icon status-vencida';
                statusTitle.textContent = 'Assinatura Vencida';
                statusDetails.textContent = `Venceu há ${Math.abs(diasRestantes)} dias`;
                statusDate.textContent = 'Renove para continuar usando';
                statusDate.className = 'status-date date-vencida';
            }
        }
    }

    function atualizarPrecos() {
        if (!planoSelecionado) return;
        
        const valorPix = precos[planoSelecionado].pix;
        const valorCartao = precos[planoSelecionado].cartao;
        
        document.getElementById('valor-pix').textContent = `R$ ${valorPix.toFixed(2).replace('.', ',')}`;
        document.getElementById('valor-cartao').textContent = `R$ ${valorCartao.toFixed(2).replace('.', ',')}`;
    }

    function atualizarBotaoPagar() {
        if (processandoPagamento) {
            btnPagar.disabled = true;
            btnPagar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando pagamento...';
            return;
        }

        if (planoSelecionado && pagamentoSelecionado) {
            const valor = precos[planoSelecionado][pagamentoSelecionado];
            btnPagar.disabled = false;
            btnPagar.innerHTML = `<i class="fas fa-credit-card"></i> Pagar R$ ${valor.toFixed(2).replace('.', ',')} - ${pagamentoSelecionado.toUpperCase()}`;
        } else {
            btnPagar.disabled = true;
            btnPagar.innerHTML = '<i class="fas fa-lock"></i> Selecione um plano e forma de pagamento';
        }
    }

    // ===== PROCESSO DE PAGAMENTO =====
    async function iniciarProcessoPagamento() {
        if (!planoSelecionado || !pagamentoSelecionado || processandoPagamento) return;

        const valor = precos[planoSelecionado][pagamentoSelecionado];
        processandoPagamento = true;
        atualizarBotaoPagar();

        try {
            mostrarMensagem('Criando preferência de pagamento...', 'info');
            
            const preference = await criarPreferenciaMercadoPago(valor);
            
            mostrarMensagem('Redirecionando para o Mercado Pago...', 'info');
            
            // Salva dados do pagamento para verificação posterior
            localStorage.setItem('lume_pagamento_dados', JSON.stringify({
                plano: planoSelecionado,
                valor: valor,
                forma_pagamento: pagamentoSelecionado,
                preference_id: preference.id,
                timestamp: Date.now(),
                empresa_id: window.currentCompanyId
            }));

            // Aguarda um pouco para o usuário ver a mensagem
            setTimeout(() => {
                window.location.href = preference.init_point;
            }, 1500);
            
        } catch (error) {
            console.error('❌ Erro ao criar pagamento:', error);
            mostrarMensagem('Erro ao criar pagamento. Tente novamente.', 'error');
            processandoPagamento = false;
            atualizarBotaoPagar();
        }
    }

    async function criarPreferenciaMercadoPago(valor) {
        const timestamp = Date.now();
        const external_reference = `empresa_${window.currentCompanyId}_plano_${planoSelecionado}_${timestamp}`;
        
        const preferenceData = {
            items: [{
                title: `Sistema Lume - Plano ${planoSelecionado.charAt(0).toUpperCase() + planoSelecionado.slice(1)}`,
                quantity: 1,
                unit_price: valor,
                currency_id: 'BRL'
            }],
            external_reference: external_reference,
            back_urls: {
                success: `${window.location.origin}/pagamento.html?status=success`,
                failure: `${window.location.origin}/pagamento.html?status=failure`,
                pending: `${window.location.origin}/pagamento.html?status=pending`
            },
            payment_methods: {
                excluded_payment_types: [],
                installments: pagamentoSelecionado === 'cartao' ? 12 : 1
            }
        };

        console.log('📤 Enviando preferência para MP:', external_reference);

        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(preferenceData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Erro MP: ${errorData.message || 'Erro desconhecido'}`);
        }

        const preference = await response.json();
        console.log('✅ Preferência criada:', preference.id);
        return preference;
    }

    // ===== VERIFICAR RETORNO DO MERCADO PAGO =====
    function verificarRetornoMercadoPago() {
        const urlParams = new URLSearchParams(window.location.search);
        const status = urlParams.get('status');
        const paymentId = urlParams.get('payment_id');
        const preferenceId = urlParams.get('preference_id');
        
        if (status) {
            // Remove parâmetros da URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            switch (status) {
                case 'success':
                    mostrarMensagem('Pagamento aprovado! Verificando e ativando sua assinatura...', 'success');
                    setTimeout(() => {
                        processarPagamentoSucesso(paymentId, preferenceId);
                    }, 2000);
                    break;
                    
                case 'pending':
                    mostrarMensagem('Pagamento pendente. Aguarde a confirmação bancária.', 'warning');
                    break;
                    
                case 'failure':
                    mostrarMensagem('Pagamento cancelado ou falhou. Tente novamente.', 'error');
                    limparDadosPagamento();
                    break;
            }
        }
    }

    // ===== PROCESSAR PAGAMENTO APROVADO =====
    async function processarPagamentoSucesso(paymentId, preferenceId) {
        try {
            console.log('🎉 Processando pagamento aprovado:', paymentId);
            
            // Busca dados salvos localmente
            const dadosSalvos = localStorage.getItem('lume_pagamento_dados');
            if (!dadosSalvos) {
                console.warn('⚠️ Dados do pagamento não encontrados localmente');
                return;
            }
            
            const dadosPagamento = JSON.parse(dadosSalvos);
            
            // Verifica se o pagamento já foi processado
            const { data: existente } = await supabaseClient
                .from('assinaturas')
                .select('id')
                .eq('mercadopago_payment_id', paymentId)
                .single();

            if (existente) {
                console.log('ℹ️ Pagamento já processado anteriormente');
                mostrarMensagem('Assinatura já ativada!', 'success');
                limparDadosPagamento();
                return;
            }

            // Calcula datas da nova assinatura
            const dataInicio = new Date().toISOString().split('T')[0];
            const dataVencimento = new Date();
            
            if (dadosPagamento.plano === 'mensal') {
                dataVencimento.setMonth(dataVencimento.getMonth() + 1);
            } else if (dadosPagamento.plano === 'anual') {
                dataVencimento.setFullYear(dataVencimento.getFullYear() + 1);
            }

            // Dados para salvar no Supabase
            const assinaturaData = {
                id_empresa: window.currentCompanyId,
                auth_user_id: window.currentUser.auth_user_id,
                plano: dadosPagamento.plano,
                valor_pago: dadosPagamento.valor,
                data_inicio: dataInicio,
                data_vencimento: dataVencimento.toISOString().split('T')[0],
                status: 'ativa',
                forma_pagamento: dadosPagamento.forma_pagamento,
                mercadopago_payment_id: paymentId || 'pending'
            };

            console.log('💾 Salvando assinatura:', assinaturaData);

            // Salva ou atualiza assinatura no Supabase
            const { error } = await supabaseClient
                .from('assinaturas')
                .upsert(assinaturaData, { 
                    onConflict: 'auth_user_id',
                    returning: 'minimal'
                });

            if (error) {
                console.error('❌ Erro ao salvar assinatura:', error);
                mostrarMensagem('Erro ao ativar assinatura. Contate o suporte.', 'error');
                return;
            }

            console.log('✅ Assinatura salva com sucesso!');
            mostrarMensagem('Assinatura ativada com sucesso!', 'success');
            
            // Limpa dados temporários
            limparDadosPagamento();
            
            // Recarrega o status
            setTimeout(() => {
                carregarStatusAssinatura();
            }, 2000);

            // Dispara evento global
            document.dispatchEvent(new CustomEvent('assinaturaAtivada', {
                detail: assinaturaData
            }));

        } catch (error) {
            console.error('❌ Erro ao processar pagamento:', error);
            mostrarMensagem('Erro ao ativar assinatura. Contate o suporte.', 'error');
        }
    }

    // ===== CARREGAR HISTÓRICO =====
    async function carregarHistorico() {
        try {
            console.log('📜 Carregando histórico de pagamentos...');
            
            const { data: historico, error } = await supabaseClient
                .from('assinaturas')
                .select('*')
                .eq('auth_user_id', window.currentUser.auth_user_id)
                .order('created_at', { ascending: false });

            if (error && error.code !== 'PGRST116') {
                console.error('❌ Erro ao carregar histórico:', error);
                return;
            }

            atualizarHistoricoInterface(historico || []);

        } catch (error) {
            console.error('❌ Erro ao buscar histórico:', error);
        }
    }

    function atualizarHistoricoInterface(historico) {
        const container = document.getElementById('historico-container');
        if (!container) return;

        if (!historico || historico.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <h3>Nenhum pagamento encontrado</h3>
                    <p>Seus pagamentos aparecerão aqui após a primeira compra</p>
                </div>
            `;
            return;
        }

        const historicoHTML = historico.map(item => {
            const dataFormatada = formatarData(item.created_at);
            const valorFormatado = `R$ ${item.valor_pago.toFixed(2).replace('.', ',')}`;
            const statusClass = item.status === 'ativa' ? 'status-ativa' : 'status-vencida';
            const statusText = item.status === 'ativa' ? 'Ativa' : 'Vencida';
            
            return `
                <div class="historico-item">
                    <div class="historico-info">
                        <div class="historico-data">${dataFormatada}</div>
                        <div class="historico-detalhes">
                            Plano ${item.plano.charAt(0).toUpperCase() + item.plano.slice(1)} - 
                            ${item.forma_pagamento} - 
                            <span class="${statusClass}">${statusText}</span>
                        </div>
                    </div>
                    <div class="historico-valor">${valorFormatado}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = historicoHTML;
    }

    // ===== BOTÃO DE VERIFICAÇÃO MANUAL =====
    function adicionarBotaoVerificacao() {
        const existente = document.getElementById('btn-verificar-manual');
        if (existente) return;

        const button = document.createElement('button');
        button.id = 'btn-verificar-manual';
        button.style.cssText = `
            background: #3498db;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            margin: 10px 0;
            cursor: pointer;
            font-size: 0.9rem;
        `;
        button.innerHTML = '<i class="fas fa-sync"></i> Verificar Pagamentos Pendentes';
        
        button.addEventListener('click', async () => {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
            
            try {
                await verificarPagamentosPendentes();
                mostrarMensagem('Verificação concluída!', 'success');
            } catch (error) {
                mostrarMensagem('Erro na verificação', 'error');
            }
            
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-sync"></i> Verificar Pagamentos Pendentes';
        });

        const messageDiv = document.getElementById('message');
        messageDiv.parentNode.insertBefore(button, messageDiv);
    }

    // ===== VERIFICAÇÃO MANUAL DE PAGAMENTOS =====
    async function verificarPagamentosPendentes() {
        try {
            console.log('🔍 Verificação manual de pagamentos...');
            
            const external_reference = `empresa_${window.currentCompanyId}`;
            
            const response = await fetch(
                `https://api.mercadopago.com/v1/payments/search?external_reference=${external_reference}&limit=20`, 
                {
                    headers: {
                        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Erro MP: ${response.status}`);
            }

            const data = await response.json();
            const pagamentos = data.results || [];
            
            console.log(`💳 Encontrados ${pagamentos.length} pagamentos`);

            let pagamentosProcessados = 0;

            for (const pagamento of pagamentos) {
                if (pagamento.status === 'approved') {
                    // Verifica se já foi processado
                    const { data: existente } = await supabaseClient
                        .from('assinaturas')
                        .select('id')
                        .eq('mercadopago_payment_id', pagamento.id.toString())
                        .single();

                    if (!existente) {
                        console.log('💰 Processando pagamento aprovado:', pagamento.id);
                        
                        // Processar o pagamento aqui
                        const external_ref = pagamento.external_reference;
                        const parts = external_ref.split('_');
                        
                        if (parts.length >= 4) {
                            const [, empresaId, , plano] = parts;
                            
                            if (parseInt(empresaId) === window.currentCompanyId) {
                                await processarPagamentoAprovadoManual(pagamento, plano);
                                pagamentosProcessados++;
                            }
                        }
                    }
                }
            }

            if (pagamentosProcessados > 0) {
                mostrarMensagem(`${pagamentosProcessados} pagamento(s) processado(s)!`, 'success');
                carregarStatusAssinatura();
                carregarHistorico();
            } else {
                mostrarMensagem('Nenhum pagamento novo encontrado', 'info');
            }

        } catch (error) {
            console.error('❌ Erro na verificação:', error);
            throw error;
        }
    }

    async function processarPagamentoAprovadoManual(pagamento, plano) {
        const dataInicio = new Date().toISOString().split('T')[0];
        const dataVencimento = new Date();
        
        if (plano === 'mensal') {
            dataVencimento.setMonth(dataVencimento.getMonth() + 1);
        } else if (plano === 'anual') {
            dataVencimento.setFullYear(dataVencimento.getFullYear() + 1);
        }

        const assinaturaData = {
            id_empresa: window.currentCompanyId,
            auth_user_id: window.currentUser.auth_user_id,
            plano: plano,
            valor_pago: pagamento.transaction_details.total_paid_amount,
            data_inicio: dataInicio,
            data_vencimento: dataVencimento.toISOString().split('T')[0],
            status: 'ativa',
            forma_pagamento: pagamento.payment_method_id,
            mercadopago_payment_id: pagamento.id.toString()
        };

        const { error } = await supabaseClient
            .from('assinaturas')
            .upsert(assinaturaData, { 
                onConflict: 'auth_user_id',
                returning: 'minimal'
            });

        if (error) {
            throw new Error('Erro ao salvar assinatura');
        }

        console.log('✅ Pagamento manual processado');
    }

    // ===== UTILITÁRIOS =====
    function mostrarMensagem(texto, tipo = 'info') {
        messageDiv.textContent = texto;
        messageDiv.className = `message-${tipo}`;
        messageDiv.style.display = 'block';
        
        if (tipo === 'success' || tipo === 'info') {
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 5000);
        }
    }

    function formatarData(dateString) {
        if (!dateString) return 'Data inválida';
        
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric'
        });
    }

    function limparDadosPagamento() {
        localStorage.removeItem('lume_pagamento_dados');
    }

    // Adiciona botão de verificação manual após carregamento
    setTimeout(adicionarBotaoVerificacao, 1000);

    // Expõe função para debug
    window.verificarPagamentosManual = verificarPagamentosPendentes;
    window.recarregarStatus = carregarStatusAssinatura;
});