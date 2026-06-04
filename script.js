const searchInput = document.getElementById('search');
const filterLoader = document.getElementById('filter-loader');
const filterSide = document.getElementById('filter-side');
const modItems = document.querySelectorAll('#mods-list li');
const noResultsText = document.getElementById('no-results');
const filterCustomTag = document.getElementById('filter-custom-tag');

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

  let visibleCount = 0;
  // Считаем вообще все ручные карточки li на сайте (минус абзац "ничего не найдено")
  const totalCount = modItems.length; 

  modItems.forEach(li => {
    const modLoaders = (li.getAttribute('data-api-loaders') || '').toLowerCase().split(',').map(l => l.trim());
    const modVersions = (li.getAttribute('data-api-versions') || '').split(',');
    const modSide = li.getAttribute('data-side');
    const modCustomTags = (li.getAttribute('data-custom-tags') || '').toLowerCase().split(',').map(t => t.trim());

    const titleText = li.querySelector('.mod-title').textContent.toLowerCase();
    const descText = li.querySelector('.mod-desc').textContent.toLowerCase();

    const matchesSearch = titleText.includes(searchQuery) || descText.includes(searchQuery);
    const matchesSide = selectedSide === 'all' || modSide === selectedSide;
    const matchesLoader = selectedLoader === 'all' || modLoaders.includes(selectedLoader);
    const matchesVersion = selectedVersion === 'all' || modVersions.includes(selectedVersion);
    const matchesCustomTag = selectedCustomTag === 'all' || modCustomTags.includes(selectedCustomTag);

    if (matchesSearch && matchesSide && matchesLoader && matchesVersion && matchesCustomTag) {
      li.classList.remove('is-hidden');
      visibleCount++; // Увеличиваем счётчик отфильтрованных модов
    } else {
      li.classList.add('is-hidden');
      li.classList.remove('is-open');
    }
  });

  /* ==========================================================================
     ОБНОВЛЕНИЕ СЧЁТЧИКОВ НА ЭКРАНЕ
     ========================================================================== */
  const filteredCounterEl = document.getElementById('counter-filtered');
  const totalCounterEl = document.getElementById('counter-total');
  
  if (filteredCounterEl) filteredCounterEl.textContent = visibleCount;
  if (totalCounterEl) totalCounterEl.textContent = totalCount;

  noResultsText.style.display = visibleCount === 0 ? 'block' : 'none';
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

// Инициализация при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
  // 1. Мгновенно включаем отслеживание поиска, загрузчиков и сторон мода
  searchInput.addEventListener('input', filterMods);
  filterLoader.addEventListener('change', filterMods);
  filterSide.addEventListener('change', filterMods);
  filterCustomTag.addEventListener('change', filterMods);

  // 2. Запускаем параллельную сборку данных о модах с Modrinth
  const promises = Array.from(modItems).map(li => loadLiveModData(li));
  
  // 3. Асинхронно скачиваем и строим кастомный список версий игры
  initCustomVersionDropdown().then(() => {
    // Когда версии прилетели, связываем их поиск с общей фильтрацией
    filterMods();
  });

  // Как только данные по модам загрузятся, обновляем карточки
  Promise.all(promises).then(() => {
    filterMods();
  });
});

// Клик по карточкам li
modItems.forEach(li => {
  li.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') return;
    li.classList.toggle('is-open');
  });
});
