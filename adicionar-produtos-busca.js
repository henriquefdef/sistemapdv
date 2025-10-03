// ===== SELECT COM FUNCIONALIDADE DE BUSCA =====

/**
 * Transforma um select comum em um campo com funcionalidade de busca
 * @param {string} selectId - ID do elemento select
 * @param {Object} options - Opções de configuração
 */
function createSearchableSelect(selectId, options = {}) {
    const originalSelect = document.getElementById(selectId);
    if (!originalSelect) {
        console.warn(`Select com ID '${selectId}' não encontrado`);
        return;
    }

    // Configurações padrão
    const config = {
        placeholder: options.placeholder || 'Digite para buscar...',
        noResultsText: options.noResultsText || 'Nenhum resultado encontrado',
        maxHeight: options.maxHeight || '200px',
        ...options
    };

    // Cria o container principal
    const container = document.createElement('div');
    container.className = 'searchable-select-container';
    container.dataset.selectId = selectId;

    // Cria o campo de input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'searchable-select-input';
    input.placeholder = config.placeholder;
    input.autocomplete = 'off';

    // Cria o botão dropdown
    const dropdownBtn = document.createElement('button');
    dropdownBtn.type = 'button';
    dropdownBtn.className = 'searchable-select-dropdown-btn';
    dropdownBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';

    // Cria a lista de opções
    const optionsList = document.createElement('div');
    optionsList.className = 'searchable-select-options';
    optionsList.style.maxHeight = config.maxHeight;

    // Monta a estrutura
    const inputContainer = document.createElement('div');
    inputContainer.className = 'searchable-select-input-container';
    inputContainer.appendChild(input);
    inputContainer.appendChild(dropdownBtn);
    
    container.appendChild(inputContainer);
    container.appendChild(optionsList);

    // Armazena as opções originais
    const originalOptions = Array.from(originalSelect.options).map(option => ({
        value: option.value,
        text: option.textContent,
        selected: option.selected
    }));

    // Substitui o select original
    originalSelect.style.display = 'none';
    originalSelect.parentNode.insertBefore(container, originalSelect);

    // Adiciona métodos para atualizar o select
    container.updateOptions = function(newOptions) {
        // Limpa as opções atuais
        originalSelect.innerHTML = '';
        
        // Adiciona as novas opções ao select original
        newOptions.forEach(option => {
            const optElement = document.createElement('option');
            optElement.value = option.value;
            optElement.textContent = option.text;
            if (option.selected) optElement.selected = true;
            originalSelect.appendChild(optElement);
        });
        
        // Atualiza as opções armazenadas
        originalOptions.length = 0;
        originalOptions.push(...newOptions);
        filteredOptions = [...originalOptions];
        
        // Re-renderiza
        renderOptions();
    };
    
    container.setValue = function(value) {
        const option = originalOptions.find(opt => opt.value === value);
        if (option) {
            selectOption(option);
        }
    };

    // Estado do componente
    let isOpen = false;
    let selectedOption = null;
    let filteredOptions = [...originalOptions];

    // Inicializa com a opção selecionada
    const preSelected = originalOptions.find(opt => opt.selected);
    if (preSelected && preSelected.value) {
        selectedOption = preSelected;
        input.value = preSelected.text;
    }

    // Função para renderizar as opções
    function renderOptions(options = filteredOptions) {
        optionsList.innerHTML = '';
        
        if (options.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'searchable-select-no-results';
            noResults.textContent = config.noResultsText;
            optionsList.appendChild(noResults);
            return;
        }

        options.forEach(option => {
            const optionElement = document.createElement('div');
            optionElement.className = 'searchable-select-option';
            optionElement.textContent = option.text;
            optionElement.dataset.value = option.value;
            
            if (selectedOption && selectedOption.value === option.value) {
                optionElement.classList.add('selected');
            }

            optionElement.addEventListener('click', () => selectOption(option));
            optionsList.appendChild(optionElement);
        });
    }

    // Função para selecionar uma opção
    function selectOption(option) {
        selectedOption = option;
        input.value = option.text;
        originalSelect.value = option.value;
        
        // Dispara evento change no select original
        const changeEvent = new Event('change', { bubbles: true });
        originalSelect.dispatchEvent(changeEvent);
        
        closeDropdown();
        renderOptions();
    }

    // Função para filtrar opções
    function filterOptions(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        
        if (!term) {
            filteredOptions = [...originalOptions];
        } else {
            filteredOptions = originalOptions.filter(option => 
                option.text.toLowerCase().includes(term)
            );
        }
        
        renderOptions(filteredOptions);
    }

    // Função para abrir dropdown
    function openDropdown() {
        if (isOpen) return;
        
        isOpen = true;
        container.classList.add('open');
        optionsList.style.display = 'block';
        
        // Posiciona o dropdown
        const rect = inputContainer.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        if (spaceBelow < 200 && spaceAbove > spaceBelow) {
            optionsList.classList.add('dropdown-up');
        } else {
            optionsList.classList.remove('dropdown-up');
        }
        
        renderOptions();
    }

    // Função para fechar dropdown
    function closeDropdown() {
        if (!isOpen) return;
        
        isOpen = false;
        container.classList.remove('open');
        optionsList.style.display = 'none';
    }

    // Event listeners
    input.addEventListener('input', (e) => {
        filterOptions(e.target.value);
        if (!isOpen) openDropdown();
    });

    input.addEventListener('focus', () => {
        openDropdown();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDropdown();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const firstOption = optionsList.querySelector('.searchable-select-option');
            if (firstOption) firstOption.focus();
        }
    });

    dropdownBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (isOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    });

    // Fecha dropdown ao clicar fora
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            closeDropdown();
        }
    });

    // Função pública para atualizar opções
    container.updateOptions = function(newOptions) {
        // Limpa o select original
        originalSelect.innerHTML = '';
        
        // Adiciona novas opções ao select original
        newOptions.forEach(option => {
            const optElement = document.createElement('option');
            optElement.value = option.value;
            optElement.textContent = option.text;
            if (option.selected) optElement.selected = true;
            originalSelect.appendChild(optElement);
        });
        
        // Atualiza as opções armazenadas
        originalOptions.length = 0;
        originalOptions.push(...newOptions);
        filteredOptions = [...originalOptions];
        
        // Re-renderiza
        renderOptions();
    };

    // Função pública para obter o valor selecionado
    container.getValue = function() {
        return originalSelect.value;
    };

    // Função pública para definir o valor
    container.setValue = function(value) {
        const option = originalOptions.find(opt => opt.value === value);
        if (option) {
            selectOption(option);
        }
    };

    // Renderiza as opções iniciais
    renderOptions();

    return container;
}

/**
 * Inicializa todos os selects com funcionalidade de busca
 * @param {Array} selectIds - Array com IDs dos selects para converter
 */
function initializeSearchableSelects(selectIds = []) {
    selectIds.forEach(selectId => {
        createSearchableSelect(selectId, {
            placeholder: 'Digite para buscar...'
        });
    });
}

// Exporta as funções
window.createSearchableSelect = createSearchableSelect;
window.initializeSearchableSelects = initializeSearchableSelects;