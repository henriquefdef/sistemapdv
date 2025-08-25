// ARQUIVO: header.js 
// ==================================================

const SUPABASE_URL = 'https://gnehkswoqlpchtlgyjyj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduZWhrc3dvcWxwY2h0bGd5anlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4OTY3NjYsImV4cCI6MjA2OTQ3Mjc2Nn0.8giA1bDvCzgvlcW_pkimGO9qHRF2I0QfhG6nx9U_tdY';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variáveis globais para serem usadas por outras páginas
window.currentUser = null;
window.currentCompanyId = null;

/**
 * NOVA FUNÇÃO: Configura menu baseado no tipo de usuário
 * @param {object} userData - Dados do usuário da tabela 'user'
 */
function setupMenuByUserType(userData) {
    if (userData.funcao === 'funcionario') {
        hideFunctionarioMenuItems();
        console.log('Menu configurado para funcionário - Relatórios ocultado');
    }
}

/**
 * NOVA FUNÇÃO: Oculta itens do menu para funcionários
 */
function hideFunctionarioMenuItems() {
    // Aguarda um pouco para garantir que o DOM do header foi carregado
    setTimeout(() => {
        // Busca pelo ícone de relatórios
        const relatoriosIcon = document.querySelector('.fa-chart-bar');
        if (relatoriosIcon) {
            const menuItem = relatoriosIcon.closest('.menu-item');
            if (menuItem) {
                menuItem.style.display = 'none';
                console.log('Menu Relatórios ocultado para funcionário');
            }
        }

        // Método alternativo: busca pelo texto
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            const menuText = item.querySelector('.menu-text');
            if (menuText && menuText.textContent.trim() === 'Relatórios') {
                item.style.display = 'none';
                console.log('Menu Relatórios ocultado (método alternativo)');
            }
        });
    }, 300); // Aguarda 300ms para garantir que o DOM foi carregado
}

/**
 * Função principal que orquestra o carregamento do header.
 * 1. Desenha a interface estática do header imediatamente.
 * 2. Em paralelo, busca os dados do usuário e os preenche quando estiverem prontos.
 */
async function loadHeader() {
    // ETAPA 1: Renderização Imediata da Interface
    try {
        const response = await fetch('header.html');
        if (!response.ok) throw new Error('Falha ao carregar o arquivo header.html');
        
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            headerContainer.innerHTML = await response.text();
            setupStaticEventListeners(); // Configura eventos que não dependem do usuário
        }
    } catch (error) {
        console.error('Erro crítico ao renderizar a interface do header:', error);
        return; // Interrompe a execução se a UI base não puder ser carregada
    }

    // ETAPA 2: Busca e Preenchimento dos Dados do Usuário
    try {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) throw sessionError;

        if (!session) {
            window.location.href = 'login.html'; // Se não há sessão, redireciona para o login
            return;
        }

        const authUser = session.user;
        const { data: userData, error: userError } = await supabaseClient
            .from('user')
            .select('*')
            .eq('auth_user_id', authUser.id)
            .single();

        if (userError) throw new Error('Falha ao buscar dados do perfil do usuário.');

        // Preenche as variáveis globais que outras páginas usarão
        window.currentUser = userData;
        window.currentCompanyId = userData.id_empresa;

        // Atualiza a interface com os dados do usuário
        populateUserData(userData);
        setupMenuByUserType(userData); // ← NOVA LINHA ADICIONADA
        setupUserSpecificEventListeners();

        // Dispara um evento global para avisar outras páginas que os dados estão prontos
        document.dispatchEvent(new CustomEvent('userDataReady'));

    } catch (error) {
        console.error('Erro de autenticação ou busca de dados:', error);
        // Em caso de erro aqui, o ideal é deslogar e redirecionar
        await supabaseClient.auth.signOut();
        // window.location.href = 'login.html';
    }
}

/**
 * Configura os listeners de eventos que funcionam independentemente do login,
 * como a expansão da barra lateral.
 */
function setupStaticEventListeners() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    sidebar.addEventListener('mouseenter', () => document.body.classList.add('sidebar-expanded'));
    sidebar.addEventListener('mouseleave', () => document.body.classList.remove('sidebar-expanded'));
}

/**
 * Preenche a interface com os dados do usuário.
 * @param {object} userData - O objeto do usuário vindo da sua tabela 'user'.
 */
function populateUserData(userData) {
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) {
        userNameEl.textContent = userData.nome || 'Usuário';
        userNameEl.classList.remove('loading-placeholder'); // Remove o efeito de carregamento
    }
}

/**
 * NOVA FUNÇÃO: Configura menu baseado no tipo de usuário
 * @param {object} userData - Dados do usuário da tabela 'user'
 */
function setupMenuByUserType(userData) {
    if (userData.funcao === 'funcionario') {
        hideFunctionarioMenuItems();
        console.log('Menu configurado para funcionário - itens restritos ocultados');
    }
}

/**
 * NOVA FUNÇÃO: Oculta itens do menu para funcionários
 */
function hideFunctionarioMenuItems() {
    // Aguarda um pouco para garantir que o DOM do header foi carregado
    setTimeout(() => {
        // Lista de itens que funcionários NÃO devem ver
        const restrictedSelectors = [
            // Relatórios (menu inteiro)
            '.menu-item:has(.menu-text:contains("Relatórios"))',
            // Se a seleção acima não funcionar, use esta alternativa:
            '.menu-header:has(.fa-chart-bar)'
        ];

        restrictedSelectors.forEach(selector => {
            try {
                const element = document.querySelector(selector);
                if (element) {
                    // Oculta o item do menu inteiro
                    element.closest('.menu-item').style.display = 'none';
                } else {
                    // Método alternativo: busca pelo texto
                    const menuItems = document.querySelectorAll('.menu-item');
                    menuItems.forEach(item => {
                        const menuText = item.querySelector('.menu-text');
                        if (menuText && menuText.textContent.trim() === 'Relatórios') {
                            item.style.display = 'none';
                        }
                    });
                }
            } catch (error) {
                console.warn('Erro ao ocultar item do menu:', error);
            }
        });

        // Método mais direto: busca por ícone específico
        const relatoriosIcon = document.querySelector('.fa-chart-bar');
        if (relatoriosIcon) {
            const menuItem = relatoriosIcon.closest('.menu-item');
            if (menuItem) {
                menuItem.style.display = 'none';
            }
        }
    }, 300); // Aguarda 500ms para garantir que o DOM foi carregado
}

function setupUserSpecificEventListeners() {
    const userBtn = document.querySelector('.user-btn');
    const userDropdownContent = document.querySelector('.user-dropdown-content');
    const logoutBtn = document.getElementById('logout-btn');

    if (userBtn) {
        userBtn.disabled = false; // Habilita o botão do usuário
        userBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdownContent?.classList.toggle('show');
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await supabaseClient.auth.signOut();
            window.location.href = 'login.html';
        });
    }

    // Fecha o dropdown se clicar fora dele
    document.addEventListener('click', () => {
        userDropdownContent?.classList.remove('show');
    });
}


// Ponto de entrada: Inicia o carregamento do header quando o DOM está pronto.
document.addEventListener('DOMContentLoaded', loadHeader);