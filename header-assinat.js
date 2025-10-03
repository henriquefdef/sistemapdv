// header-assinat.js - Sistema completo de verificação de assinatura
// Funciona em TODAS as páginas, verifica pagamentos e controla acesso

document.addEventListener('userDataReady', () => {
    if (!window.currentUser || !window.currentCompanyId) {
        console.error("Dados do usuário não encontrados");
        return;
    }
    
    console.log('🚀 Iniciando sistema de assinatura para empresa:', window.currentCompanyId);
    
    // Configurações
    const MP_ACCESS_TOKEN = 'APP_USR-5563069263691299-090209-dc5e7e6edf934cd58b0bf74c9570485a-2666857124';
    const supabaseClient = window.supabaseClient || supabase.createClient(
        'https://gnehkswoqlpchtlgyjyj.supabase.co', 
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduZWhrc3dvcWxwY2h0bGd5anlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4OTY3NjYsImV4cCI6MjA2OTQ3Mjc2Nn0.8giA1bDvCzg_pkimGO9qHRF2I0QfhG6nx9U_tdY'
    );

    // Variáveis globais
    window.assinaturaStatus = null;
    window.verificandoAssinatura = false;

    // INICIO AUTOMÁTICO
    iniciarSistemaAssinatura();

    // ===== FUNÇÃO PRINCIPAL =====
    async function iniciarSistemaAssinatura() {
        try {
            if (window.verificandoAssinatura) return;
            window.verificandoAssinatura = true;

            console.log('🔍 Verificando status da assinatura...');
            
            // PASSO 1: Busca assinatura no Supabase
            const assinatura = await buscarAssinaturaSupabase();
            
            // PASSO 2: Determina se precisa verificar Mercado Pago
            const precisaVerificarMP = avaliarNecessidadeVerificacaoMP(assinatura);
            
            if (precisaVerificarMP) {
                console.log('📡 Consultando Mercado Pago por pagamentos recentes...');
                await verificarPagamentosRecentes();
                
                // Busca novamente após verificar MP
                const assinaturaAtualizada = await buscarAssinaturaSupabase();
                window.assinaturaStatus = assinaturaAtualizada;
            } else {
                window.assinaturaStatus = assinatura;
            }
            
            // PASSO 3: Aplica controle de acesso
            aplicarControleAcesso(window.assinaturaStatus);
            
            // PASSO 4: Configura menu baseado no tipo de usuário
            configurarMenuPorTipoUsuario();
            
            console.log('✅ Sistema de assinatura inicializado');
            
        } catch (error) {
            console.error('❌ Erro no sistema de assinatura:', error);
        } finally {
            window.verificandoAssinatura = false;
        }
    }

    // ===== BUSCAR ASSINATURA NO SUPABASE =====
    async function buscarAssinaturaSupabase() {
        try {
            // Tenta buscar assinatura existente
            const { data: assinatura, error } = await supabaseClient
                .from('assinaturas')
                .select('*')
                .eq('auth_user_id', window.currentUser.auth_user_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!error && assinatura) {
                console.log('📄 Assinatura encontrada:', assinatura.plano, assinatura.status);
                
                // Calcula dias restantes
                const hoje = new Date();
                const vencimento = new Date(assinatura.data_vencimento + 'T00:00:00');
                assinatura.dias_restantes = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));
                
                return assinatura;
            }

            // Se não tem assinatura, calcula período de teste
            console.log('🎁 Calculando período de teste...');
            return calcularPeriodoTeste();

        } catch (error) {
            console.error('❌ Erro ao buscar assinatura:', error);
            return calcularPeriodoTeste();
        }
    }

    // ===== CALCULAR PERÍODO DE TESTE =====
    function calcularPeriodoTeste() {
        const dataCadastro = new Date(window.currentUser.created_at);
        const hoje = new Date();
        const fimTeste = new Date(dataCadastro);
        fimTeste.setDate(fimTeste.getDate() + 30);

        const diasRestantes = Math.ceil((fimTeste - hoje) / (1000 * 60 * 60 * 24));

        const periodoTeste = {
            plano: 'teste',
            data_inicio: dataCadastro.toISOString().split('T')[0],
            data_vencimento: fimTeste.toISOString().split('T')[0],
            status: diasRestantes > 0 ? 'teste_ativo' : 'teste_vencido',
            dias_restantes: diasRestantes,
            valor_pago: 0,
            forma_pagamento: 'gratuito'
        };

        console.log('🎁 Período de teste:', periodoTeste.status, `(${diasRestantes} dias)`);
        return periodoTeste;
    }

    // ===== AVALIAR NECESSIDADE DE VERIFICAR MP =====
    function avaliarNecessidadeVerificacaoMP(assinatura) {
        if (!assinatura) return true;

        // Se está em período de teste e ainda válido, não precisa verificar
        if (assinatura.plano === 'teste' && assinatura.dias_restantes > 0) {
            return false;
        }

        // Se tem assinatura paga com mais de 3 dias válidos, não precisa
        if (assinatura.plano !== 'teste' && assinatura.dias_restantes > 3) {
            return false;
        }

        // Nos demais casos, verifica MP
        return true;
    }

    // ===== VERIFICAR PAGAMENTOS MERCADO PAGO =====
    async function verificarPagamentosRecentes() {
        const external_reference = `empresa_${window.currentCompanyId}`;
        
        try {
            // Busca pagamentos da empresa
            const response = await fetch(
                `https://api.mercadopago.com/v1/payments/search?external_reference=${external_reference}&limit=10&offset=0`, 
                {
                    headers: {
                        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                console.warn('⚠️ Erro na consulta MP:', response.status);
                return;
            }

            const data = await response.json();
            const pagamentos = data.results || [];
            
            console.log(`💳 Encontrados ${pagamentos.length} pagamentos para empresa ${window.currentCompanyId}`);

            // Processa pagamentos aprovados recentes (últimas 72h)
            for (const pagamento of pagamentos) {
                if (pagamento.status === 'approved' && isRecentPayment(pagamento.date_approved, 72)) {
                    await processarPagamentoAprovado(pagamento);
                }
            }

        } catch (error) {
            console.error('❌ Erro ao verificar MP:', error);
        }
    }

    // ===== PROCESSAR PAGAMENTO APROVADO =====
    async function processarPagamentoAprovado(pagamento) {
        try {
            console.log('💰 Processando pagamento aprovado:', pagamento.id);
            
            // Verifica se já foi processado
            const { data: existente } = await supabaseClient
                .from('assinaturas')
                .select('id')
                .eq('mercadopago_payment_id', pagamento.id.toString())
                .single();

            if (existente) {
                console.log('ℹ️ Pagamento já processado anteriormente');
                return;
            }

            // Extrai dados do external_reference
            const external_ref = pagamento.external_reference;
            const parts = external_ref.split('_');
            
            if (parts.length < 4) {
                console.warn('⚠️ External reference inválido:', external_ref);
                return;
            }

            const [, empresaId, , plano] = parts;
            
            // Verifica se é da empresa atual
            if (parseInt(empresaId) !== window.currentCompanyId) {
                console.log('ℹ️ Pagamento de outra empresa, ignorando');
                return;
            }

            // Calcula datas da nova assinatura
            const dataInicio = new Date().toISOString().split('T')[0];
            const dataVencimento = new Date();
            
            if (plano === 'mensal') {
                dataVencimento.setMonth(dataVencimento.getMonth() + 1);
            } else if (plano === 'anual') {
                dataVencimento.setFullYear(dataVencimento.getFullYear() + 1);
            } else {
                console.warn('⚠️ Plano não reconhecido:', plano);
                return;
            }

            // Dados da assinatura
            const assinaturaData = {
                id_empresa: parseInt(empresaId),
                auth_user_id: window.currentUser.auth_user_id,
                plano: plano,
                valor_pago: pagamento.transaction_details.total_paid_amount,
                data_inicio: dataInicio,
                data_vencimento: dataVencimento.toISOString().split('T')[0],
                status: 'ativa',
                forma_pagamento: pagamento.payment_method_id,
                mercadopago_payment_id: pagamento.id.toString()
            };

            // Salva no Supabase
            const { error } = await supabaseClient
                .from('assinaturas')
                .upsert(assinaturaData, { 
                    onConflict: 'auth_user_id',
                    returning: 'minimal'
                });

            if (error) {
                console.error('❌ Erro ao salvar assinatura:', error);
                return;
            }

            console.log('✅ Assinatura salva/atualizada no Supabase');
            
            // Dispara evento para outras páginas
            document.dispatchEvent(new CustomEvent('assinaturaAtualizada', {
                detail: assinaturaData
            }));

        } catch (error) {
            console.error('❌ Erro ao processar pagamento:', error);
        }
    }

    // ===== CONTROLE DE ACESSO =====
    function aplicarControleAcesso(assinatura) {
        if (!assinatura) {
            mostrarBloqueio('Erro ao verificar assinatura');
            return;
        }

        // Regras de bloqueio
        if (assinatura.status === 'teste_vencido' && assinatura.dias_restantes < -3) {
            mostrarBloqueio(`Período gratuito expirou há ${Math.abs(assinatura.dias_restantes)} dias`);
            return;
        }

        if (assinatura.status === 'vencida' && assinatura.dias_restantes < -7) {
            mostrarBloqueio(`Assinatura vencida há ${Math.abs(assinatura.dias_restantes)} dias`);
            return;
        }

        // Se chegou até aqui, acesso liberado
        removerBloqueio();
    }

    // ===== MOSTRAR BLOQUEIO =====
    function mostrarBloqueio(motivo) {
        // Remove bloqueio existente
        const existente = document.getElementById('bloqueio-overlay');
        if (existente) existente.remove();

        // Cria overlay de bloqueio
        const overlay = document.createElement('div');
        overlay.id = 'bloqueio-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(10px);
        `;

        overlay.innerHTML = `
            <div style="
                background: white;
                padding: 40px;
                border-radius: 16px;
                text-align: center;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            ">
                <i class="fas fa-exclamation-triangle" style="
                    font-size: 4rem;
                    color: #e74c3c;
                    margin-bottom: 20px;
                "></i>
                <h2 style="margin: 0 0 15px 0; color: #2c3e50;">Acesso Bloqueado</h2>
                <p style="color: #7f8c8d; margin-bottom: 30px;">${motivo}</p>
                <button onclick="window.location.href='pagamento.html'" style="
                    background: linear-gradient(135deg, #FF9800, #FB8C00);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: bold;
                    cursor: pointer;
                    margin-right: 10px;
                ">
                    Renovar Assinatura
                </button>
                <button onclick="window.location.href='inicio.html'" style="
                    background: #95a5a6;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                ">
                    Voltar
                </button>
            </div>
        `;

        document.body.appendChild(overlay);
        console.log('🚫 Acesso bloqueado:', motivo);
    }

    // ===== REMOVER BLOQUEIO =====
    function removerBloqueio() {
        const overlay = document.getElementById('bloqueio-overlay');
        if (overlay) {
            overlay.remove();
            console.log('✅ Acesso liberado');
        }
    }

    // ===== CONFIGURAR MENU POR TIPO DE USUÁRIO =====
    function configurarMenuPorTipoUsuario() {
        if (window.currentUser.funcao === 'funcionario') {
            setTimeout(() => {
                // Oculta menu de Relatórios para funcionários
                const relatoriosMenu = document.querySelector('.fa-chart-bar');
                if (relatoriosMenu) {
                    const menuItem = relatoriosMenu.closest('.menu-item');
                    if (menuItem) {
                        menuItem.style.display = 'none';
                        console.log('📊 Menu Relatórios ocultado para funcionário');
                    }
                }
            }, 500);
        }
    }

    // ===== UTILITÁRIOS =====
    function isRecentPayment(dateString, hoursLimit) {
        if (!dateString) return false;
        
        const paymentDate = new Date(dateString);
        const now = new Date();
        const diffHours = Math.abs(now - paymentDate) / (1000 * 60 * 60);
        
        return diffHours <= hoursLimit;
    }

    // Expõe função para uso externo
    window.verificarAssinaturaManual = iniciarSistemaAssinatura;
    window.mostrarStatusAssinatura = () => console.log('Status atual:', window.assinaturaStatus);
});