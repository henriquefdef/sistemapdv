// ===== SISTEMA FINANCEIRO - FUNÇÕES DO BANCO DE DADOS =====

// Cliente Supabase (será inicializado usando as variáveis globais do header.js)
let financeiroSupabaseClient = null;

// Inicializar cliente Supabase
function initializeSupabase() {
    if (!financeiroSupabaseClient) {
        // Usar as constantes globais do header.js
        financeiroSupabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return financeiroSupabaseClient;
}

// ===== FUNÇÕES DE CARREGAMENTO =====

/**
 * Carrega movimentações do banco de dados
 * @returns {Promise<Array>} Array de movimentações
 */
async function loadMovimentacoesFromDB() {
    try {
        const client = initializeSupabase();
        const startDate = `${state.currentYear}-01-01`;
        const endDate = `${state.currentYear}-12-31`;

        const { data, error } = await client
            .from('movimentacoes_financeiras')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .gte('data_vencimento', startDate)
            .lte('data_vencimento', endDate)
            .order('data_vencimento', { ascending: false });

        if (error) throw error;

        // Se há dados no banco, processar
        if (data && data.length > 0) {
            const dadosDB = data.map(mov => ({
                id: mov.id,
                vencimento: formatDateBR(mov.data_vencimento),
                descricao: mov.descricao,
                valor: parseFloat(mov.valor),
                recebido_de: mov.pessoa_empresa || '',
                categoria: mov.categoria || '',
                pago: mov.status === 'PAGO',
                status: mov.status || 'PENDENTE', // Incluir o campo status
                tipo: mov.tipo,
                recorrente: mov.recorrente || false
            }));
            
            // Usar apenas dados do banco
            state.movimentacoes = dadosDB;
        }

        console.log(`Carregadas ${data?.length || 0} movimentações do banco de dados`);
        return data || [];
        
    } catch (error) {
        console.error('Erro ao carregar movimentações do banco:', error);
        // Manter dados de exemplo em caso de erro
        throw error;
    }
}

/**
 * Carrega saldo atual da empresa
 * @returns {Promise<number>} Saldo atual
 */
async function loadSaldoAtual() {
    try {
        const client = initializeSupabase();
        
        const { data, error } = await client
            .from('contas_empresa')
            .select('saldo_atual')
            .eq('id_empresa', window.currentCompanyId)
            .single();

        if (error) throw error;

        return data?.saldo_atual || 0;
        
    } catch (error) {
        console.error('Erro ao carregar saldo atual:', error);
        return 0;
    }
}

/**
 * Carrega configurações financeiras da empresa
 * @returns {Promise<Object>} Configurações financeiras
 */
async function loadConfiguracoes() {
    try {
        const client = initializeSupabase();
        
        const { data, error } = await client
            .from('configuracoes_financeiras')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .single();

        if (error) throw error;

        return {
            metaReceitas: data?.meta_receitas || 7000.00,
            metaDespesas: data?.meta_despesas || 5000.00,
            saldoPrincipal: data?.saldo_principal || 91970.00
        };
        
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        return {
            metaReceitas: 7000.00,
            metaDespesas: 5000.00,
            saldoPrincipal: 91970.00
        };
    }
}

// ===== FUNÇÕES DE SALVAMENTO =====

/**
 * Salva uma nova movimentação no banco
 * @param {Object} movimentacao - Dados da movimentação
 * @returns {Promise<Object>} Movimentação salva
 */
async function saveMovimentacao(movimentacao) {
    try {
        const client = initializeSupabase();
        
        // Remover campos que não existem na tabela
        const movimentacaoLimpa = {
            id_empresa: movimentacao.id_empresa,
            tipo: movimentacao.tipo,
            descricao: movimentacao.descricao,
            valor: movimentacao.valor,
            data_vencimento: movimentacao.data_vencimento,
            categoria: movimentacao.categoria,
            pessoa_empresa: movimentacao.pessoa_empresa,
            recorrente: movimentacao.recorrente,
            status: movimentacao.status
        };
        
        const { data, error } = await client
            .from('movimentacoes_financeiras')
            .insert([movimentacaoLimpa])
            .select()
            .single();

        if (error) throw error;

        console.log('Movimentação salva com sucesso:', data);
        return data;
        
    } catch (error) {
        console.error('Erro ao salvar movimentação:', error);
        throw error;
    }
}

/**
 * Atualiza o status de uma movimentação
 * @param {number} id - ID da movimentação
 * @param {string} status - Novo status ('PAGO', 'PENDENTE', 'VENCIDO')
 * @returns {Promise<Object>} Movimentação atualizada
 */
async function updateMovimentacaoStatus(id, status) {
    try {
        const client = initializeSupabase();
        
        const { data, error } = await client
            .from('movimentacoes_financeiras')
            .update({ status: status })
            .eq('id', id)
            .eq('id_empresa', window.currentCompanyId)
            .select()
            .single();

        if (error) throw error;

        console.log('Status da movimentação atualizado:', data);
        return data;
        
    } catch (error) {
        console.error('Erro ao atualizar status da movimentação:', error);
        throw error;
    }
}

/**
 * Atualiza dados completos de uma movimentação
 * @param {number} id - ID da movimentação
 * @param {Object} dadosAtualizados - Dados para atualizar
 * @returns {Promise<Object>} Movimentação atualizada
 */
async function updateMovimentacao(id, dadosAtualizados) {
    try {
        const client = initializeSupabase();
        
        if (id > 1000) {
            const realId = id - 1000;
            
            const { data, error } = await client
                .from('movimentacoes_financeiras')
                .update(dadosAtualizados)
                .eq('id', realId)
                .eq('id_empresa', window.currentCompanyId)
                .select()
                .single();

            if (error) throw error;

            console.log('Movimentação atualizada:', data);
            return data;
        }
        
    } catch (error) {
        console.error('Erro ao atualizar movimentação:', error);
        throw error;
    }
}

// ===== FUNÇÕES DE REMOÇÃO =====

/**
 * Remove uma movimentação do banco
 * @param {number} id - ID da movimentação
 * @returns {Promise<boolean>} Sucesso da operação
 */
async function deleteMovimentacao(id) {
    try {
        const client = initializeSupabase();
        
        const { error } = await client
            .from('movimentacoes_financeiras')
            .delete()
            .eq('id', id)
            .eq('id_empresa', window.currentCompanyId);

        if (error) throw error;

        console.log('Movimentação removida com sucesso, ID:', id);
        return true;
        
    } catch (error) {
        console.error('Erro ao remover movimentação do banco:', error);
        throw error;
    }
}

/**
 * Remove múltiplas movimentações
 * @param {Array<number>} ids - Array de IDs das movimentações
 * @returns {Promise<boolean>} Sucesso da operação
 */
async function deleteMultipleMovimentacoes(ids) {
    try {
        const client = initializeSupabase();
        
        const realIds = ids
            .filter(id => id > 1000)
            .map(id => id - 1000);
        
        if (realIds.length > 0) {
            const { error } = await client
                .from('movimentacoes_financeiras')
                .delete()
                .in('id', realIds)
                .eq('id_empresa', window.currentCompanyId);

            if (error) throw error;

            console.log('Movimentações removidas:', realIds.length);
        }
        
        return true;
        
    } catch (error) {
        console.error('Erro ao remover múltiplas movimentações:', error);
        throw error;
    }
}

// ===== FUNÇÕES DE RELATÓRIOS =====

/**
 * Gera relatório de movimentações por período
 * @param {Date} dataInicio - Data de início
 * @param {Date} dataFim - Data de fim
 * @returns {Promise<Object>} Relatório com totais
 */
async function gerarRelatorioMovimentacoes(dataInicio, dataFim) {
    try {
        const client = initializeSupabase();
        
        const { data, error } = await client
            .from('movimentacoes_financeiras')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .gte('data_vencimento', dataInicio.toISOString().split('T')[0])
            .lte('data_vencimento', dataFim.toISOString().split('T')[0]);

        if (error) throw error;

        // Calcular totais
        const relatorio = {
            totalReceitas: 0,
            totalDespesas: 0,
            receitasPagas: 0,
            despesasPagas: 0,
            receitasPendentes: 0,
            despesasPendentes: 0,
            movimentacoes: data || []
        };

        data?.forEach(mov => {
            const valor = parseFloat(mov.valor);
            
            if (mov.tipo === 'RECEBER') {
                relatorio.totalReceitas += valor;
                if (mov.status === 'PAGO') {
                    relatorio.receitasPagas += valor;
                } else {
                    relatorio.receitasPendentes += valor;
                }
            } else if (mov.tipo === 'PAGAR') {
                relatorio.totalDespesas += valor;
                if (mov.status === 'PAGO') {
                    relatorio.despesasPagas += valor;
                } else {
                    relatorio.despesasPendentes += valor;
                }
            }
        });

        return relatorio;
        
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        throw error;
    }
}

/**
 * Obtém estatísticas financeiras da empresa
 * @returns {Promise<Object>} Estatísticas financeiras
 */
async function getEstatisticasFinanceiras() {
    try {
        const client = initializeSupabase();
        
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        
        const { data, error } = await client
            .from('movimentacoes_financeiras')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .gte('data_vencimento', inicioMes.toISOString().split('T')[0])
            .lte('data_vencimento', fimMes.toISOString().split('T')[0]);

        if (error) throw error;

        const estatisticas = {
            totalMovimentacoes: data?.length || 0,
            emAtraso: 0,
            venceHoje: 0,
            proximasVencer: 0,
            totalReceitasMes: 0,
            totalDespesasMes: 0
        };

        const hojeBR = hoje.toISOString().split('T')[0];
        const proximaSemana = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        data?.forEach(mov => {
            const valor = parseFloat(mov.valor);
            const vencimento = mov.data_vencimento;
            
            // Contar por status
            if (vencimento < hojeBR && mov.status !== 'PAGO') {
                estatisticas.emAtraso++;
            } else if (vencimento === hojeBR && mov.status !== 'PAGO') {
                estatisticas.venceHoje++;
            } else if (vencimento <= proximaSemana && mov.status !== 'PAGO') {
                estatisticas.proximasVencer++;
            }
            
            // Somar valores por tipo
            if (mov.tipo === 'RECEBER') {
                estatisticas.totalReceitasMes += valor;
            } else if (mov.tipo === 'PAGAR') {
                estatisticas.totalDespesasMes += valor;
            }
        });

        return estatisticas;
        
    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        throw error;
    }
}

// ===== FUNÇÕES DE CONFIGURAÇÃO =====

/**
 * Salva configurações financeiras da empresa
 * @param {Object} configuracoes - Configurações a salvar
 * @returns {Promise<Object>} Configurações salvas
 */
async function saveConfiguracoes(configuracoes) {
    try {
        const client = initializeSupabase();
        
        const { data, error } = await client
            .from('configuracoes_financeiras')
            .upsert({
                id_empresa: window.currentCompanyId,
                ...configuracoes,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        console.log('Configurações salvas:', data);
        return data;
        
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        throw error;
    }
}

/**
 * Atualiza saldo atual da empresa
 * @param {number} novoSaldo - Novo saldo
 * @returns {Promise<Object>} Dados atualizados
 */
async function updateSaldoAtual(novoSaldo) {
    try {
        const client = initializeSupabase();
        
        const { data, error } = await client
            .from('contas_empresa')
            .upsert({
                id_empresa: window.currentCompanyId,
                saldo_atual: novoSaldo,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        console.log('Saldo atualizado:', data);
        return data;
        
    } catch (error) {
        console.error('Erro ao atualizar saldo:', error);
        throw error;
    }
}

// ===== FUNÇÕES DE IMPORTAÇÃO/EXPORTAÇÃO =====

/**
 * Exporta movimentações para CSV
 * @param {Date} dataInicio - Data de início
 * @param {Date} dataFim - Data de fim
 * @returns {Promise<string>} Dados CSV
 */
async function exportarMovimentacoesCSV(dataInicio, dataFim) {
    try {
        const relatorio = await gerarRelatorioMovimentacoes(dataInicio, dataFim);
        
        const csvHeaders = [
            'Data Vencimento',
            'Descrição',
            'Tipo',
            'Valor',
            'Pessoa/Empresa',
            'Categoria',
            'Status',
            'Recorrente',
            'Data Pagamento'
        ];
        
        const csvRows = relatorio.movimentacoes.map(mov => [
            formatDateBR(mov.data_vencimento),
            mov.descricao,
            mov.tipo,
            mov.valor,
            mov.pessoa_empresa || '',
            mov.categoria || '',
            mov.status,
            mov.recorrente ? 'Sim' : 'Não',
            mov.data_pagamento ? formatDateBR(mov.data_pagamento) : ''
        ]);
        
        const csvContent = [csvHeaders, ...csvRows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
        
        return csvContent;
        
    } catch (error) {
        console.error('Erro ao exportar CSV:', error);
        throw error;
    }
}

/**
 * Importa movimentações de array de dados
 * @param {Array} movimentacoes - Array de movimentações
 * @returns {Promise<Array>} Movimentações importadas
 */
async function importarMovimentacoes(movimentacoes) {
    try {
        const client = initializeSupabase();
        
        const movimentacoesFormatadas = movimentacoes.map(mov => ({
            ...mov,
            id_empresa: window.currentCompanyId,
            created_by: window.currentUser?.auth_user_id
        }));
        
        const { data, error } = await client
            .from('movimentacoes_financeiras')
            .insert(movimentacoesFormatadas)
            .select();

        if (error) throw error;

        console.log(`${data.length} movimentações importadas`);
        return data;
        
    } catch (error) {
        console.error('Erro ao importar movimentações:', error);
        throw error;
    }
}

// ===== FUNÇÕES DE CATEGORIAS =====

/**
 * Carrega categorias do banco de dados filtradas por tipo
 * @param {string} tipo - 'RECEBER' ou 'PAGAR' ou null para todas
 * @returns {Promise<Array>} Array de categorias
 */
async function loadCategoriasFromDB(tipo = null) {
    try {
        const client = initializeSupabase();
        
        let query = client
            .from('categoria_financeira')
            .select('*')
            .eq('id_empresa', window.currentCompanyId)
            .order('nome', { ascending: true });
        
        // Filtrar por tipo se especificado
        if (tipo) {
            query = query.eq('tipo', tipo);
        }
        
        const { data, error } = await query;

        if (error) throw error;

        console.log(`Carregadas ${data?.length || 0} categorias do tipo: ${tipo || 'todas'}`);
        return data || [];
        
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        return [];
    }
}

/**
 * Salva uma nova categoria no banco
 * @param {Object} categoria - Dados da categoria
 * @returns {Promise<Object>} Categoria salva
 */
async function saveCategoria(categoria) {
    try {
        const client = initializeSupabase();
        
        const categoriaData = {
            id_empresa: window.currentCompanyId,
            nome: categoria.nome,
            tipo: categoria.tipo
        };
        
        const { data, error } = await client
            .from('categoria_financeira')
            .insert([categoriaData])
            .select()
            .single();

        if (error) throw error;

        console.log('Categoria salva com sucesso:', data);
        return data;
        
    } catch (error) {
        console.error('Erro ao salvar categoria:', error);
        throw error;
    }
}

/**
 * Verifica se uma categoria já existe
 * @param {string} nome - Nome da categoria
 * @param {string} tipo - Tipo da categoria
 * @returns {Promise<boolean>} True se existe
 */
async function categoriaExiste(nome, tipo) {
    try {
        const client = initializeSupabase();
        
        const { data, error } = await client
            .from('categoria_financeira')
            .select('id')
            .eq('id_empresa', window.currentCompanyId)
            .eq('nome', nome.trim())
            .eq('tipo', tipo)
            .limit(1);

        if (error) throw error;

        return data && data.length > 0;
        
    } catch (error) {
        console.error('Erro ao verificar categoria:', error);
        return false;
    }
}

/**
 * Remove uma categoria do banco
 * @param {number} id - ID da categoria
 * @returns {Promise<boolean>} Sucesso da operação
 */
async function deleteCategoria(id) {
    try {
        const client = initializeSupabase();
        
        const { error } = await client
            .from('categoria_financeira')
            .delete()
            .eq('id', id)
            .eq('id_empresa', window.currentCompanyId);

        if (error) throw error;

        console.log('Categoria removida com sucesso, ID:', id);
        return true;
        
    } catch (error) {
        console.error('Erro ao remover categoria:', error);
        throw error;
    }
}

/**
 * Verifica se uma categoria está sendo usada em movimentações
 * @param {string} nomeCategoria - Nome da categoria
 * @returns {Promise<boolean>} True se está sendo usada
 */
async function categoriaEstaEmUso(nomeCategoria) {
    try {
        const client = initializeSupabase();
        
        const { data, error } = await client
            .from('movimentacoes_financeiras')
            .select('id')
            .eq('id_empresa', window.currentCompanyId)
            .eq('categoria', nomeCategoria)
            .limit(1);

        if (error) throw error;

        return data && data.length > 0;
        
    } catch (error) {
        console.error('Erro ao verificar uso da categoria:', error);
        return false;
    }
}

// ===== UTILITÁRIOS =====

/**
 * Formata data para padrão brasileiro
 * @param {string} dateString - Data em formato ISO
 * @returns {string} Data formatada DD/MM/AAAA
 */
function formatDateBR(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

/**
 * Verifica conectividade com o banco
 * @returns {Promise<boolean>} Status da conexão
 */
async function checkDatabaseConnection() {
    try {
        const client = initializeSupabase();
        
        const { data, error } = await client
            .from('movimentacoes_financeiras')
            .select('id')
            .limit(1);

        return !error;
        
    } catch (error) {
        console.error('Erro de conectividade:', error);
        return false;
    }
}