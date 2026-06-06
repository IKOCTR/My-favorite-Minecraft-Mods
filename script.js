const searchInput = document.getElementById('search');
const filterLoader = document.getElementById('filter-loader');
const filterSide = document.getElementById('filter-side');
const modItems = document.querySelectorAll('#mods-list li');
const noResultsText = document.getElementById('no-results');
const filterCustomTag = document.getElementById('filter-custom-tag');
const showUnsuitedCheckbox = document.getElementById('show-unsuited');
const hideLibrariesCheckbox = document.getElementById('hide-libraries');



// Переменная для хранения текущей выбранной версии в кастомном меню
let selectedVersion = 'all';

// Изначально массив пустой — JS сам заполнит его актуальными данными из интернета
let chronologicalVersions = [];
// 'https://api.modrinth.com/v2/tag/game_version'
// Функция автоматического получения ВСЕХ существующих версий игры с Modrinth
// Полностью заменяем эту функцию в script.js
async function fetchAllMinecraftVersions() {
  try {
    const response = await fetch('https://api.modrinth.com/v2/tag/game_version', {
      method: 'GET',
      headers: { 'User-Agent': 'MyFavMinecraftModsWebsite/1.0' }
    });
    
    if (!response.ok) throw new Error('Сервер ответил с ошибкой');
    const data = await response.json();

    // 1. Извлекаем чистые строки версий (в зависимости от структуры ответа Modrinth)
    const rawVersions = data.map(v => typeof v === 'object' ? v.version : v);

    // 2. Оставляем только полноценные релизы, убираем снапшоты, беты и пре-релизы
    const releasesOnly = rawVersions.filter(v => {
      if (!v) return false;
      // Релиз не содержит букв (pre, rc, snapshot, w24)
      return !/[a-zA-Z]/.test(v); 
    });

    // 3. Отсекаем все версии младше 1.12
    const modernVersions = releasesOnly.filter(v => {
      // Оставляем новые drops (например, 26.1) и все версии, которые начинаются с 1.12 и выше
      if (v.startsWith('26.')) return true;
      if (v.startsWith('1.')) {
        const minor = parseInt(v.split('.')[1], 10);
        return minor >= 12; // Условие: версия >= 1.12
      }
      return false;
    });

    // 4. Сортируем версии хронологически: от Самых Новых к Старым
    // Чтобы гарантировать правильный порядок независимо от того, как прислал сервер
    chronologicalVersions = modernVersions.sort((a, b) => {
      return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
    });

    console.log('Список версий успешно обновлен и отсортирован с Modrinth!');

  } catch (err) {
    console.error('Не удалось получить данные с API, включаем запасной список:', err);
    // Наш надежный резервный список в правильном порядке
    chronologicalVersions = [
      "26.1.2", "26.1", "1.21.4", "1.21.1", "1.21", 
      "1.20.6", "1.20.4", "1.20.1", "1.20", "1.19.4", "1.19.2", 
      "1.18.2", "1.17.1", "1.16.5", "1.15.2", "1.14.4", "1.12.2"
    ];
  }
}



// Измененная функция инициализации кастомного выпадающего списка
async function initCustomVersionDropdown() {
  const dropdownBtn = document.getElementById('version-dropdown-btn');
  const dropdownMenu = document.getElementById('version-dropdown-menu');
  const searchVersionInput = document.getElementById('version-search');
  const optionsList = document.getElementById('version-options-list');

  // Ждем, пока скачается самый свежий список версий из интернета
  await fetchAllMinecraftVersions();

  // Генерируем элементы версий из динамического массива
  chronologicalVersions.forEach(version => {
    const item = document.createElement('div');
    item.className = 'option-item';
    item.setAttribute('data-value', version);
    item.textContent = version;
    optionsList.appendChild(item);
  });

  // Открытие/закрытие меню по клику на кнопку
  dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('show');
    if (dropdownMenu.classList.contains('show')) searchVersionInput.focus();
  });

  // Закрытие меню при клике в любое другое место
  document.addEventListener('click', () => {
    dropdownMenu.classList.remove('show');
  });

  dropdownMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Живой поиск внутри списка версий
  searchVersionInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const items = optionsList.querySelectorAll('.option-item');

    items.forEach(item => {
      const val = item.getAttribute('data-value');
      if (val === 'all' || val.toLowerCase().includes(query)) {
        item.classList.remove('is-hidden');
      } else {
        item.classList.add('is-hidden');
      }
    });
  });

  // Обработка выбора версии
  optionsList.addEventListener('click', (e) => {
    const targetItem = e.target.closest('.option-item');
    if (!targetItem) return;

    optionsList.querySelectorAll('.option-item').forEach(i => i.classList.remove('active'));
    targetItem.classList.add('active');

    selectedVersion = targetItem.getAttribute('data-value');
    dropdownBtn.textContent = targetItem.textContent;

    dropdownMenu.classList.remove('show');
    filterMods();
  });
}


// Главная функция фильтрации страницы
function filterMods() {
  const searchQuery = searchInput.value.toLowerCase().trim();
  const selectedLoader = filterLoader.value.toLowerCase();
  const selectedSide = filterSide.value;
  const selectedCustomTag = filterCustomTag ? filterCustomTag.value.toLowerCase() : 'all';
  
  // Проверяем, активна ли галочка скрытия библиотек
  const hideLibraries = hideLibrariesCheckbox ? hideLibrariesCheckbox.checked : false;

  let visibleCount = 0;
  const totalCount = modItems.length; 

  modItems.forEach(li => {
    const modLoaders = (li.getAttribute('data-api-loaders') || '').toLowerCase().split(',').map(l => l.trim());
    const modVersions = (li.getAttribute('data-api-versions') || '').split(',');
    const modSide = li.getAttribute('data-side');
    
    // Считываем кастомные теги (категории) мода
    const modCustomTags = (li.getAttribute('data-custom-tags') || '').toLowerCase().split(',').map(t => t.trim());

    const titleText = li.querySelector('.mod-title').textContent.toLowerCase();
    const descText = li.querySelector('.mod-desc').textContent.toLowerCase();

    // ГРУППА 1: Жесткие фильтры (Поиск, Сторона, Кастомные категории)
    const matchesSearch = titleText.includes(searchQuery) || descText.includes(searchQuery);
    const matchesSide = selectedSide === 'all' || modSide === selectedSide;
    const matchesCustomTag = selectedCustomTag === 'all' || modCustomTags.includes(selectedCustomTag);

    // ГРУППА 2: Технические мягкие фильтры (Загрузчик и Версия игры)
    const matchesLoader = selectedLoader === 'all' || modLoaders.includes(selectedLoader);
    const matchesVersion = selectedVersion === 'all' || modVersions.includes(selectedVersion);

    // Проверяем: является ли этот мод библиотекой (есть ли у него тег "библиотека")
    const isLibrary = modCustomTags.includes('библиотека');

    // Убираем старые классы состояния перед новой проверкой
    li.classList.remove('is-hidden', 'is-unsuited');

    // ЛОГИКА ОТОБРАЖЕНИЯ:
    // 1. Если мод не подошел под жесткие фильтры (поиск, категория)
    // ИЛИ если включена галочка "Скрыть библиотеки" и этот мод является библиотекой
    if (!matchesSearch || !matchesSide || !matchesCustomTag || (hideLibraries && isLibrary)) {
      li.classList.add('is-hidden');
      li.classList.remove('is-open');
    } else {
      // 2. Если по смыслу мод должен быть на экране, проверяем его техническую совместимость
      if (matchesLoader && matchesVersion) {
        // Мод полностью подходит!
        visibleCount++;
      } else {
        // Мод не подходит по версии/загрузчику: ВСЕГДА уносим его блеклым в самый конец списка
        li.classList.add('is-unsuited');
      }
    }
  });

  // Обновляем счетчики на экране
  const filteredCounterEl = document.getElementById('counter-filtered');
  const totalCounterEl = document.getElementById('counter-total');
  
  if (filteredCounterEl) filteredCounterEl.textContent = visibleCount;
  if (totalCounterEl) totalCounterEl.textContent = totalCount;

  // Показываем надпись "Ничего не найдено", если скрылись вообще все моды на сайте
  const hiddenCount = document.querySelectorAll('#mods-list li.is-hidden').length;
  noResultsText.style.display = (hiddenCount === totalCount) ? 'block' : 'none';
}





// Функция, которая идет на Modrinth для каждого вашего li
async function loadLiveModData(li) {
  const slug = li.getAttribute('data-slug');
  if (!slug) return;

  try {
    // 1. ЗАПРОС ИКОНКИ (Строки склеиваются через обычный плюс, никаких скобок и багов)
    const projectResponse = await fetch(`https://api.modrinth.com/v2/project/${slug}`, {
      method: 'GET',
      headers: { 'User-Agent': 'MyFavMinecraftModsWebsite/1.0' }
    });
    
    if (projectResponse.ok) {
      const projectData = await projectResponse.json();
      if (projectData && projectData.icon_url) {
        const imgTag = li.querySelector('.mod-icon') || li.querySelector('img');
        if (imgTag) imgTag.src = projectData.icon_url;
      }
    }

    // 2. ЗАПРОС ВЕРСИЙ И ЗАГРУЗЧИКОВ
    const response = await fetch(`https://api.modrinth.com/v2/project/${slug}/version?include_changelog=false`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GitHub/MyFavMinecraftModsWebsite/1.0'
      }
    });

    if (!response.ok) throw new Error('Ошибка сервера Modrinth');
    const data = await response.json();

    const allLoaders = [...new Set(data.flatMap(v => v.loaders))];
    const rawVersions = data.flatMap(v => v.game_versions);
    const cleanVersions = [...new Set(rawVersions)].filter(v => !/[a-zA-Z]/.test(v));

    const sortedVersions = cleanVersions.sort((a, b) => {
      return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
    });

    li.setAttribute('data-api-loaders', allLoaders.join(','));
    li.setAttribute('data-api-versions', sortedVersions.join(','));

    li.querySelector('.live-versions span').textContent = sortedVersions.slice(0, 4).join(', ');

    const tagsContainer = li.querySelector('.api-tags');
    if (tagsContainer) {
      tagsContainer.innerHTML = '';
      allLoaders.forEach(loader => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = loader;
        tagsContainer.appendChild(span);
      });
    }

  } catch (err) {
    console.error('Ошибка в loadLiveModData для мода ' + slug + ':', err);
    li.querySelector('.live-versions span').textContent = 'ошибка API';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // 🛠️ 1. АВТОМАТИЧЕСКАЯ СОРТИРОВКА ПО АЛФАВИТУ И МИНИ-ГРУППАМ
  const listContainer = document.getElementById('mods-list');
  if (listContainer) {
    const sortedLi = Array.from(modItems).sort((a, b) => {
      const groupA = (a.getAttribute('data-sort-group') || a.querySelector('.mod-title').textContent).toLowerCase().trim();
      const groupB = (b.getAttribute('data-sort-group') || b.querySelector('.mod-title').textContent).toLowerCase().trim();
      if (groupA !== groupB) return groupA.localeCompare(groupB, undefined, { numeric: true, sensitivity: 'base' });
      
      const slugA = (a.getAttribute('data-slug') || '').toLowerCase().trim();
      const slugB = (b.getAttribute('data-slug') || '').toLowerCase().trim();
      if (slugA === groupA) return -1;
      if (slugB === groupB) return 1;
      
      const titleA = a.querySelector('.mod-title').textContent.toLowerCase().trim();
      const titleB = b.querySelector('.mod-title').textContent.toLowerCase().trim();
      return titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: 'base' });
    });
    sortedLi.forEach(li => listContainer.appendChild(li));

    // 🛠️ 2. АВТОПОДСТАНОВКА РОДИТЕЛЬСКИХ ИКОНКА ДЛЯ АДДОНОВ
    sortedLi.forEach(li => {
      const sortGroup = li.getAttribute('data-sort-group');
      const currentSlug = li.getAttribute('data-slug');
      
      if (sortGroup && sortGroup !== currentSlug) {
        const parentLi = sortedLi.find(p => p.getAttribute('data-slug') === sortGroup);
        if (parentLi) {
          const parentImgSrc = parentLi.querySelector('.mod-icon');
          const targetParentIcon = li.querySelector('.parent-icon');
          
          if (parentImgSrc && targetParentIcon) {
            const observer = new MutationObserver(() => {
              targetParentIcon.src = parentImgSrc.src;
            });
            observer.observe(parentImgSrc, { attributes: true, attributeFilter: ['src'] });
            if (parentImgSrc.src && !parentImgSrc.src.includes('picsum')) {
              targetParentIcon.src = parentImgSrc.src;
            }
          }
        }
      }
    });
  }

  // Включение живых фильтров страницы
  searchInput.addEventListener('input', filterMods);
  filterLoader.addEventListener('change', filterMods);
  filterSide.addEventListener('change', filterMods);
  if (filterCustomTag) filterCustomTag.addEventListener('change', filterMods);
  if (hideLibrariesCheckbox) hideLibrariesCheckbox.addEventListener('change', filterMods);

  const promises = Array.from(modItems).map(li => loadLiveModData(li));
  initCustomVersionDropdown().then(() => { filterMods(); });
  Promise.all(promises).then(() => { filterMods(); });

  modItems.forEach(li => {
    li.addEventListener('click', (e) => {
      // Если кликнули строго по кнопке-ссылке (Modrinth или знак вопроса)
      if (e.target.closest('a')) return;
      
      // В любом другом случае — плавно открываем или закрываем карточку!
      li.classList.toggle('is-open');
    });
  });

    /* ==========================================================================
     🛠️ ОБНОВЛЕННЫЙ АВТОГЕНЕРАТОР КАРТОЧЕК С АВТОЗАПОЛНЕНИЕМ
     ========================================================================== */
  const genBtn = document.getElementById('gen-btn');
  const genSlugInput = document.getElementById('gen-slug');
  const genTitleInput = document.getElementById('gen-title');
  const genDescInput = document.getElementById('gen-desc');

  // Автоматическое получение названия и описания с Modrinth при вводе Slug
    // Автоматическое получение названия, описания и его перевод на русский язык
  if (genSlugInput) {
    genSlugInput.addEventListener('change', async () => {
      const slug = genSlugInput.value.trim().toLowerCase();
      if (!slug) return;

      if (genTitleInput) genTitleInput.placeholder = "Загрузка названия...";
      if (genDescInput) genDescInput.placeholder = "Загрузка и перевод описания...";

      try {
        // 1. Получаем данные с Modrinth
        const response = await fetch(`https://api.modrinth.com/v2/project/${slug}`, {
          method: 'GET',
          headers: { 'User-Agent': 'MyFavMinecraftModsWebsite/1.0' }
        });

        if (!response.ok) throw new Error('Мод не найден');
        const data = await response.json();

        if (data.title && genTitleInput) genTitleInput.value = data.title;
        
        if (data.description && genDescInput) {
          // Очищаем текст от разметки Markdown перед переводом
          let cleanDesc = data.description
            .replace(/[#*_`>]/g, '') 
            .replace(/\s+/g, ' ')
            .trim();

          try {
            // 2. Отправляем очищенное описание в бесплатный API переводчика
            const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanDesc)}&langpair=en|ru`;
            const transResponse = await fetch(translateUrl);
            
            if (!transResponse.ok) throw new Error('Ошибка перевода');
            const transData = await transResponse.json();
            
            // Если перевод успешен — вставляем русский текст, иначе — оригинальный английский
            if (transData && transData.responseData) {
              genDescInput.value = transData.responseData.translatedText;
            } else {
              genDescInput.value = cleanDesc; // Запасной вариант (английский)
            }
          } catch (transErr) {
            console.warn('Не удалось перевести текст, оставляем английский:', transErr);
            genDescInput.value = cleanDesc;
          }
        }

      } catch (err) {
        console.error('Не удалось автозаполнить данные: ', err);
        if (genTitleInput) {
          genTitleInput.value = "";
          genTitleInput.placeholder = "Не удалось найти мод. Введите вручную.";
        }
        if (genDescInput) {
          genDescInput.value = "";
          genDescInput.placeholder = "Введите описание вручную.";
        }
      }
    });
  }


  // Генерация и автокопирование HTML-кода
  if (genBtn) {
    genBtn.addEventListener('click', () => {
      const title = genTitleInput.value.trim();
      const slug = genSlugInput.value.trim();
      const customTags = document.getElementById('gen-custom-tags').value.trim();
      let sortGroup = document.getElementById('gen-sort-group').value.trim();
      const side = document.getElementById('gen-side').value;
      const noteUrl = document.getElementById('gen-note-url').value.trim();
      const desc = genDescInput.value.trim();

      if (!title || !slug) {
        alert('Пожалуйста, введите хотя бы Название и Slug мода!');
        return;
      }

      if (!sortGroup) {
        sortGroup = slug;
      }

      // Исправленное определение русского текста для тега стороны мода
      let sideText = 'Клиент';
      if (side === 'both') sideText = 'Клиент + Сервер';
      if (side === 'server') sideText = 'Сервер';

      const tagsArray = customTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      let customTagsHtml = '';
      tagsArray.forEach(tag => {
        customTagsHtml += `\n      <span class="tag custom">${tag}</span>`;
      });

      let iconHtml = '';
      if (sortGroup !== slug) {
        iconHtml = `  <div class="mod-icon-container">
      <img src="icons/404.png" alt="Иконка" class="mod-icon">
      <img src="" alt="" class="parent-icon">
    </div>`;
      } else {
        iconHtml = `  <img src="icons/404.png" alt="${title}" class="mod-icon">`;
      }

      let noteBtnHtml = '';
      if (noteUrl) {
        noteBtnHtml = `\n    <a href="${noteUrl}" class="note-btn" data-tooltip="Нажмите для более подробной информации/заметки от IKOCTR 27">?</a>`;
      }

      // Генерация финальной разметки
      const resultHtml = `<!-- ${title} -->
  <li data-slug="${slug}" data-side="${side}" data-custom-tags="${customTags}" data-sort-group="${sortGroup}">
  ${iconHtml}
    
    <div class="mod-meta-wrapper">
      <h3 class="mod-title">${title}</h3>
      <div class="mod-tags">
        <span class="tag side">${sideText}</span>
        <span class="api-tags"></span>${customTagsHtml}
      </div>
      <div class="live-versions">Версии: <span>загрузка...</span></div>
    </div>
    
    <div class="mod-links-group">
      <a href="https://modrinth.com/mod/${slug}" target="_blank" class="modrinth-btn">Modrinth</a>${noteBtnHtml}
    </div>
    
    <div class="info-text">
      <p class="mod-desc">${desc}</p>
    </div>
  </li>`;

      const resultArea = document.getElementById('gen-result');
      resultArea.value = resultHtml;

      // Автоматическое копирование кода и индикация на кнопке
      if (resultArea.value) {
        resultArea.select();
        resultArea.setSelectionRange(0, 99999);

        navigator.clipboard.writeText(resultArea.value).then(() => {
          const originalText = genBtn.textContent;
          genBtn.textContent = '✔ Копирование успешно!';
          genBtn.style.backgroundColor = '#16a085';

          setTimeout(() => {
            genBtn.textContent = originalText;
            genBtn.style.backgroundColor = '';
          }, 1500);
        }).catch(err => {
          console.error('Ошибка буфера обмена: ', err);
        });
      }
    });

    // Повторное копирование при клике на текстовое поле с результатом
    const resultArea = document.getElementById('gen-result');
    if (resultArea) {
      resultArea.addEventListener('click', () => {
        if (!resultArea.value) return;
        resultArea.select();
        navigator.clipboard.writeText(resultArea.value).then(() => {
          genBtn.textContent = '✔ Копирование успешно!';
          genBtn.style.backgroundColor = '#16a085';
          setTimeout(() => {
            genBtn.textContent = 'Сгенерировать HTML-код мода';
            genBtn.style.backgroundColor = '';
          }, 1500);
        });
      });
    }
  }

       /* ==========================================================================
     🔒 ИДЕАЛЬНЫЙ СЛУШАТОР КЛАВИАТУРЫ ДЛЯ АДМИНА (Shift + I + K)
     ========================================================================== */
      // Создаем хранилище для одновременно зажатых кнопок
      const pressedKeys = new Set();

      window.addEventListener('keydown', (e) => {
        // Запоминаем код нажатой клавиши (KeyI, KeyK и т.д.)
        pressedKeys.add(e.code);

        // Проверяем идеальное сочетание: зажат Shift И в хранилище одновременно есть KeyI и KeyK
        if (e.shiftKey && pressedKeys.has('KeyI') && pressedKeys.has('KeyK')) {
          e.preventDefault(); 
          
          const generatorPanel = document.querySelector('.generator-section');
          if (generatorPanel) {
            generatorPanel.classList.toggle('is-visible');
            console.log('Панель администратора переключена!');
          }
        }
      });

      // Обязательно ловим момент, когда вы отпускаете клавиши, и стираем их из памяти
      window.addEventListener('keyup', (e) => {
        pressedKeys.delete(e.code);
      });
});

