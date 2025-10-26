// ===== Tela Baixar Excel - Exportação multi-tabelas =====

// Lista de fontes de dados e metadados
const DATA_SOURCES = [
  { key: 'vendas', label: 'Vendas', icon: 'fa-shopping-cart', table: 'vendas', dateColumn: 'hora_venda', statusColumn: 'status', desc: 'Itens vendidos por cliente e forma de pagamento' },
  { key: 'vendas_canceladas', label: 'Vendas Canceladas', icon: 'fa-ban', table: 'vendas_canceladas', dateColumn: 'data_cancelamento', statusColumn: 'status_original', desc: 'Histórico de cancelamento de vendas' },
  { key: 'clientes', label: 'Clientes', icon: 'fa-user', table: 'clientes', dateColumn: 'created_at', statusColumn: null, desc: 'Cadastro de clientes da empresa' },
  { key: 'produtos', label: 'Produtos', icon: 'fa-boxes', table: 'produtos', dateColumn: 'created_at', statusColumn: null, desc: 'Cadastro de produtos e estoque' },
  { key: 'estoque_movimentacoes', label: 'Movimentações de Estoque', icon: 'fa-exchange-alt', table: 'estoque_movimentacoes', dateColumn: 'data_movimentacao', statusColumn: null, desc: 'Entradas/Saídas e ajustes de estoque' },
  { key: 'entradas_estoque', label: 'Entradas de Estoque', icon: 'fa-arrow-down', table: 'entradas_estoque', dateColumn: 'data_entrada', statusColumn: null, desc: 'Notas e entradas de produtos' },
  { key: 'fornecedores', label: 'Fornecedores', icon: 'fa-truck', table: 'fornecedores', dateColumn: 'created_at', statusColumn: null, desc: 'Cadastro de fornecedores' },
  { key: 'maquinas', label: 'Máquinas de Cartão', icon: 'fa-credit-card', table: 'maquinas', dateColumn: 'created_at', statusColumn: null, desc: 'Cadastro de máquinas e taxas' },
  { key: 'movimentacoes_financeiras', label: 'Movimentações Financeiras', icon: 'fa-dollar-sign', table: 'movimentacoes_financeiras', dateColumn: 'data_vencimento', statusColumn: 'status', desc: 'Contas a pagar/receber' },
  { key: 'categoria_financeira', label: 'Categorias Financeiras', icon: 'fa-folder', table: 'categoria_financeira', dateColumn: null, statusColumn: null, desc: 'Categorias de receitas e despesas' },
  { key: 'crediario', label: 'Crediário', icon: 'fa-money-check-alt', table: 'crediario', dateColumn: 'data_vencimento', statusColumn: 'status', desc: 'Parcelas e carnês de clientes' },
  { key: 'cashback', label: 'Cashback', icon: 'fa-money-bill-wave', table: 'cashback', dateColumn: 'created_at', statusColumn: null, desc: 'Créditos e resgates de cashback' },
  { key: 'servicos', label: 'Serviços', icon: 'fa-wrench', table: 'servicos', dateColumn: 'created_at', statusColumn: null, desc: 'Catálogo de serviços' },
  { key: 'agendamentos', label: 'Agendamentos', icon: 'fa-calendar-check', table: 'agendamentos', dateColumn: 'data_agendamento', statusColumn: 'status', desc: 'Agenda de serviços e compromissos' },
  { key: 'orcamentos', label: 'Orçamentos', icon: 'fa-file-invoice-dollar', table: 'orcamentos', dateColumn: 'created_at', statusColumn: 'status', desc: 'Propostas e orçamentos' },
  { key: 'empresas', label: 'Empresa', icon: 'fa-building', table: 'empresas', dateColumn: 'created_at', statusColumn: null, desc: 'Dados da empresa' },
  { key: 'funcionarios', label: 'Funcionários', icon: 'fa-users', table: 'funcionarios', dateColumn: 'created_at', statusColumn: 'ativo', desc: 'Colaboradores e perfis' },
  { key: 'marcas', label: 'Marcas', icon: 'fa-tag', table: 'marcas', dateColumn: null, statusColumn: null, desc: 'Marcas de produtos' },
  { key: 'categorias', label: 'Categorias', icon: 'fa-folder-open', table: 'categorias', dateColumn: null, statusColumn: null, desc: 'Categorias de produtos' },
  { key: 'produtos_excluidos', label: 'Produtos Excluídos', icon: 'fa-trash', table: 'produtos_excluidos', dateColumn: 'deleted_at', statusColumn: null, desc: 'Histórico de exclusão' },
];

// Estado local
const exportState = {
  selectedKeys: new Set(),
  filters: {
    startDate: null,
    endDate: null
  }
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  renderSources();

  // Eventos filtros
  document.getElementById('start-date')?.addEventListener('change', (e) => {
    exportState.filters.startDate = e.target.value || null;
  });
  document.getElementById('end-date')?.addEventListener('change', (e) => {
    exportState.filters.endDate = e.target.value || null;
  });

  // Ações
  document.getElementById('export-btn')?.addEventListener('click', handleExport);
});

function renderSources() {
  const grid = document.getElementById('sources-grid');
  if (!grid) return;
  grid.innerHTML = '';

  DATA_SOURCES.forEach(src => {
    const item = document.createElement('div');
    item.className = 'source-item';
    item.innerHTML = `
      <input type="checkbox" class="source-check" data-key="${src.key}">
      <div class="source-icon"><i class="fas ${src.icon}"></i></div>
      <div class="source-info">
        <div class="source-title">${src.label}</div>
        <div class="source-desc">${src.desc}</div>
      </div>
    `;
    item.addEventListener('click', (e) => {
      const check = item.querySelector('.source-check');
      if (e.target !== check) check.checked = !check.checked;
      toggleSelection(src.key, check.checked);
    });
    item.querySelector('.source-check').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSelection(src.key, e.target.checked);
    });
    grid.appendChild(item);
  });
}

function toggleSelection(key, checked) {
  if (checked) exportState.selectedKeys.add(key);
  else exportState.selectedKeys.delete(key);
}

// Buscar dados genérico por tabela
async function fetchTableData(client, table, dateColumn, statusColumn) {
  if (!window.currentCompanyId) throw new Error('ID da empresa não encontrado');
  let query = client.from(table).select('*').eq('id_empresa', window.currentCompanyId);

  // Filtros por data (se houver coluna conhecida)
  if (dateColumn) {
    if (exportState.filters.startDate) query = query.gte(dateColumn, exportState.filters.startDate);
    if (exportState.filters.endDate) query = query.lte(dateColumn, `${exportState.filters.endDate} 23:59:59`);
  }

  // Filtro de status (se houver)
  // Removido filtro de status conforme solicitação

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Funções de pré-visualização removidas

// Exportação
async function handleExport() {
  try {
    const btn = document.getElementById('export-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';

    const client = window.supabaseClient || supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const selected = DATA_SOURCES.filter(s => exportState.selectedKeys.has(s.key));
    if (selected.length === 0) {
      showNotification('Selecione ao menos uma fonte para exportar', 'warning');
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Baixar Excel';
      return;
    }

    const wb = XLSX.utils.book_new();

    for (const src of selected) {
      try {
        const data = await fetchTableData(client, src.table, src.dateColumn, src.statusColumn);
        const sheet = XLSX.utils.json_to_sheet(data);
        // largura básica de colunas
        sheet['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: 18 }));
        XLSX.utils.book_append_sheet(wb, sheet, sanitizeSheetName(src.label));
      } catch (err) {
        console.warn(`Falha ao buscar ${src.label}:`, err.message);
        const sheet = XLSX.utils.aoa_to_sheet([[`${src.label}: erro - ${err.message}`]]);
        XLSX.utils.book_append_sheet(wb, sheet, sanitizeSheetName(src.label));
      }
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `export_${dateStr}_${timeStr}.xlsx`;
    XLSX.writeFile(wb, filename);

    showNotification(`Arquivo ${filename} exportado com sucesso!`, 'success');
  } catch (error) {
    console.error('Erro na exportação:', error);
    showNotification('Erro ao exportar dados para Excel', 'error');
  } finally {
    const btn = document.getElementById('export-btn');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-download"></i> Baixar Excel';
  }
}

function sanitizeSheetName(name) {
  return name.replace(/[\\\/*\[\]:?]/g, ' ').substring(0, 31);
}

console.log('📎 Tela Baixar Excel carregada');