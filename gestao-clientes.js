// ===== GESTÃO DE CLIENTES - ARQUIVO PRINCIPAL =====
// Este arquivo coordena os módulos: core, charts e interface

// Importar scripts dos módulos
const scriptModules = [
    'gestao-clientes-core.js',
    'gestao-clientes-charts.js', 
    'gestao-clientes-interface.js'
];

// Carregar módulos dinamicamente
scriptModules.forEach(module => {
    const script = document.createElement('script');
    script.src = module;
    script.async = false; // Manter ordem de carregamento
    document.head.appendChild(script);
});

// ===== INICIALIZAÇÃO PRINCIPAL =====
// A inicialização real está no gestao-clientes-core.js
// Este arquivo apenas coordena o carregamento

// Event listener principal - delegado para o core
document.addEventListener('userDataReady', async () => {
    // A inicialização real acontece no gestao-clientes-core.js
    console.log('📋 Gestão de Clientes - Arquivo principal carregado');
});

// Função de inicialização movida para gestao-clientes-core.js

// Event listeners movidos para gestao-clientes-interface.js

// Funções de carregamento de dados movidas para gestao-clientes-core.js

// Processamento de dados movido para gestao-clientes-core.js

// Renderização movida para gestao-clientes-interface.js

// Função updateTopClientes movida para gestao-clientes-interface.js

// ===== ANÁLISE DE FREQUÊNCIA =====
// Funções de frequência movidas para gestao-clientes-interface.js

// Filtros de frequência movidos para gestao-clientes-interface.js

// Gráficos movidos para gestao-clientes-charts.js

// Funções de WhatsApp e comunicação movidas para gestao-clientes-interface.js

// Funções de modal de detalhes do cliente movidas para gestao-clientes-interface.js

// ===== MODAL DE FREQUÊNCIA (REUTILIZADO) =====
async function openFrequencyModal() {
    // Reutilizar a lógica do modal de frequência do relatório de vendas
    // mas adaptado para esta tela
    showNotification('Funcionalidade em desenvolvimento', 'info');
}

// ===== CONTROLE DE PERÍODO =====
// Funções movidas para gestao-clientes-interface.js para evitar conflitos de dependência

// Funções utilitárias, exportação e debug movidas para os módulos específicos

console.log('📋 Script de Gestão de Clientes carregado');