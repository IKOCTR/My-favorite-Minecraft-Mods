// ==========================================================================
// 🛠️ ЧАСТЬ 1: ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И ИНИЦИАЛИЗАЦИЯ ИКОНОК [!]
// ==========================================================================
const searchInput = document.getElementById('search');
const filterLoader = document.getElementById('filter-loader');
const filterSide = document.getElementById('filter-side');
const modItems = document.querySelectorAll('#mods-list li');
const noResultsText = document.getElementById('no-results');
const filterCustomTag = document.getElementById('filter-custom-tag');
const hideLibrariesCheckbox = document.getElementById('hide-libraries');

let selectedVersion = 'all';
let chronologicalVersions = [];

// Вынесенная функция обработки клика по синей кнопке [!]
function handleIconClick(e) {
  e.stopPropagation(); // Останавливаем закрытие плашки документом
  
  const icon = e.currentTarget;
  const helpBox = icon.querySelector('.categories-help-box');
  if (!helpBox) return;

  const isShown = helpBox.classList.contains('show');

  // Закрываем абсолютно все остальные подсказки, открытые на странице
  document.querySelectorAll('.categories-help-box').forEach(box => box.classList.remove('show'));

  if (!isShown) {
    const iconRect = icon.getBoundingClientRect();
    const estimatedBoxHeight = 240; 

    // Сдвигаем влево, если кнопка прижата к правому краю монитора
    if (window.innerWidth - iconRect.left < 300) {
      helpBox.classList.add('to-left');
    } else {
      helpBox.classList.remove('to-left');
    }

    // Разворачиваем вниз, если фильтры подняты к верху экрана
    if (iconRect.top < estimatedBoxHeight) {
      helpBox.classList.add('open-down');
    } else {
      helpBox.classList.remove('open-down');
    }

    // Активируем показ плашки
    helpBox.classList.add('show');
  }
}

// Инициализация синих иконок подсказок [!]
function initInfoIcons() {
  const infoIcons = document.querySelectorAll('.info-icon');
  infoIcons.forEach(icon => {
    const helpBox = icon.querySelector('.categories-help-box');
    if (!helpBox) return;

    // Сбрасываем старые события, чтобы избежать дублирования, и регистрируем заново
    icon.removeEventListener('click', handleIconClick);
    icon.addEventListener('click', handleIconClick);
  });
}

// ==========================================================================
// 🧱 ЧАСТЬ 2: АПИ-ФУНКЦИИ ВЕРСИЙ И КАСТОМНЫЙ ДРОПДАУН ВЕРСИЙ
// ==========================================================================
async function fetchAllMinecraftVersions() {
  try {
    const response = await fetch(`https://api.modrinth.com/v2/tag/game_version`, {
      method: 'GET',
      headers: { 'User-Agent': 'MyFavMinecraftModsWebsite/1.0' }
    });
    if (!response.ok) throw new Error('Сервер ответил с ошибкой');
    const data = await response.json();
    const rawVersions = data.map(v => typeof v === 'object' ? v.version : v);
    const releasesOnly = rawVersions.filter(v => v && !/[a-zA-Z]/.test(v)); 
    const modernVersions = releasesOnly.filter(v => {
      if (v.startsWith('26.')) return true;
      if (v.startsWith('1.')) {
        const minor = parseInt(v.split('.')[1], 10);
        return minor >= 12;
      }
      return false;
    });
    chronologicalVersions = modernVersions.sort((a, b) => {
      return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
    });
    console.log('Список версий успешно обновлен с Modrinth!');
  } catch (err) {
    console.error('Ошибка API, включаем запасной список версий:', err);
    chronologicalVersions = [
      "26.1.2", "26.1", "1.21.4", "1.21.1", "1.21", 
      "1.20.6", "1.20.4", "1.20.1", "1.20", "1.19.4", "1.19.2", 
      "1.18.2", "1.17.1", "1.16.5", "1.15.2", "1.14.4", "1.12.2"
    ];
  }
}

async function initCustomVersionDropdown() {
  const dropdownBtn = document.getElementById('version-dropdown-btn');
  const dropdownMenu = document.getElementById('version-dropdown-menu');
  const searchVersionInput = document.getElementById('version-search');
  const optionsList = document.getElementById('version-options-list');

  await fetchAllMinecraftVersions();

  if (optionsList) {
    chronologicalVersions.forEach(version => {
      const item = document.createElement('div');
      item.className = 'option-item';
      item.setAttribute('data-value', version);
      item.textContent = version;
      optionsList.appendChild(item);
    });
  }

  if (dropdownBtn && dropdownMenu) {
    dropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('show');
      if (dropdownMenu.classList.contains('show') && searchVersionInput) searchVersionInput.focus();
    });
    document.addEventListener('click', () => dropdownMenu.classList.remove('show'));
    dropdownMenu.addEventListener('click', (e) => e.stopPropagation());
  }

  if (searchVersionInput && optionsList) {
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
  }

  if (optionsList) {
    optionsList.addEventListener('click', (e) => {
      const targetItem = e.target.closest('.option-item');
      if (!targetItem) return;
      optionsList.querySelectorAll('.option-item').forEach(i => i.classList.remove('active'));
      targetItem.classList.add('active');
      selectedVersion = targetItem.getAttribute('data-value');
      if (dropdownBtn) dropdownBtn.textContent = targetItem.textContent;
      if (dropdownMenu) dropdownMenu.classList.remove('show');
      filterMods();
    });
  }
}

// ==========================================================================
// 🔍 ЧАСТЬ 3: БЕЗОПАСНАЯ ФИЛЬТРАЦИЯ И ЖИВАЯ ЗАГРУЗКА ДАННЫХ ДЛЯ LI КАРТОЧЕК
// ==========================================================================
function filterMods() {
  const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const selectedLoader = filterLoader ? filterLoader.value.toLowerCase() : 'all';
  const selectedSide = filterSide ? filterSide.value : 'all';
  const selectedCustomTag = filterCustomTag ? filterCustomTag.value.toLowerCase() : 'all';
  const hideLibraries = hideLibrariesCheckbox ? hideLibrariesCheckbox.checked : false;

  let visibleCount = 0;
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
    const matchesCustomTag = selectedCustomTag === 'all' || modCustomTags.includes(selectedCustomTag);
    const matchesLoader = selectedLoader === 'all' || modLoaders.includes(selectedLoader);
    const matchesVersion = selectedVersion === 'all' || modVersions.includes(selectedVersion);
    const isLibrary = modCustomTags.includes('библиотека');

    li.classList.remove('is-hidden', 'is-unsuited');

    if (!matchesSearch || !matchesSide || !matchesCustomTag || (hideLibraries && isLibrary)) {
      li.classList.add('is-hidden');
      li.classList.remove('is-open');
    } else {
      if (matchesLoader && matchesVersion) {
        visibleCount++;
      } else {
        li.classList.add('is-unsuited');
      }
    }
  });

  const filteredCounterEl = document.getElementById('counter-filtered');
  const totalCounterEl = document.getElementById('counter-total');
  if (filteredCounterEl) filteredCounterEl.textContent = visibleCount;
  if (totalCounterEl) totalCounterEl.textContent = totalCount;

  if (noResultsText) {
    const hiddenCount = document.querySelectorAll('#mods-list li.is-hidden').length;
    noResultsText.style.display = (hiddenCount === totalCount) ? 'block' : 'none';
  }
}

async function loadLiveModData(li) {
  const slug = li.getAttribute('data-slug');
  if (!slug) return;
  try {
    const projectResponse = await fetch(`https://api.modrinth.com/v2/project/${slug}`);
    if (projectResponse.ok) {
      const projectData = await projectResponse.json();
      if (projectData && projectData.icon_url) {
        const imgTag = li.querySelector('.mod-icon') || li.querySelector('img');
        if (imgTag) imgTag.src = projectData.icon_url;
      }
    }
    const response = await fetch(`https://api.modrinth.com/v2/project/${slug}/version?include_changelog=false`);
    if (!response.ok) throw new Error('Ошибка сервера Modrinth');
    const data = await response.json();
    const allLoaders = [...new Set(data.flatMap(v => v.loaders))];
    const rawVersions = data.flatMap(v => v.game_versions);
    const cleanVersions = [...new Set(rawVersions)].filter(v => !/[a-zA-Z]/.test(v));
    const sortedVersions = cleanVersions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));

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
    console.error('Ошибка в loadLiveModData для ' + slug + ':', err);
    li.querySelector('.live-versions span').textContent = 'ошибка API';
  }
}

// ==========================================================================
// 🏁 ЧАСТЬ 4: ОБРАБОТКА ЗАГРУЗКИ DOM, СОРТИРОВКА, ГЕНЕРАТОР КАРТОЧЕК И ХОТКЕИ
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
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
      return a.querySelector('.mod-title').textContent.toLowerCase().trim().localeCompare(b.querySelector('.mod-title').textContent.toLowerCase().trim());
    });
    sortedLi.forEach(li => listContainer.appendChild(li));

    sortedLi.forEach(li => {
      const sortGroup = li.getAttribute('data-sort-group');
      const currentSlug = li.getAttribute('data-slug');
      if (sortGroup && sortGroup !== currentSlug) {
        const parentLi = sortedLi.find(p => p.getAttribute('data-slug') === sortGroup);
        if (parentLi) {
          const parentImgSrc = parentLi.querySelector('.mod-icon');
          const targetParentIcon = li.querySelector('.parent-icon');
          if (parentImgSrc && targetParentIcon) {
            const observer = new MutationObserver(() => { targetParentIcon.src = parentImgSrc.src; });
            observer.observe(parentImgSrc, { attributes: true, attributeFilter: ['src'] });
            if (parentImgSrc.src && !parentImgSrc.src.includes('picsum')) targetParentIcon.src = parentImgSrc.src;
          }
        }
      }
    });

    document.querySelectorAll('.option-item-cb').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const checkbox = item.querySelector('input[type="checkbox"]');
          if (checkbox) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
          }
        }
      });
    });
  }

  if (searchInput) searchInput.addEventListener('input', filterMods);
  if (filterLoader) filterLoader.addEventListener('change', filterMods);
  if (filterSide) filterSide.addEventListener('change', filterMods);
  if (filterCustomTag) filterCustomTag.addEventListener('change', filterMods);
  if (hideLibrariesCheckbox) hideLibrariesCheckbox.addEventListener('change', filterMods);

  const promises = Array.from(modItems).map(li => loadLiveModData(li));
  initCustomVersionDropdown().then(() => { filterMods(); });
  Promise.all(promises).then(() => { filterMods(); }).catch(() => filterMods());

  modItems.forEach(li => {
    li.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      li.classList.toggle('is-open');
    });
  });

  // Логика генератора
  const genBtn = document.getElementById('gen-btn');
  const genSlugInput = document.getElementById('gen-slug');
  const genTitleInput = document.getElementById('gen-title');
  const genDescInput = document.getElementById('gen-desc');
  const catsBtn = document.getElementById('gen-cats-btn');
  const catsMenu = document.getElementById('gen-cats-menu');

  if (genSlugInput) {
    genSlugInput.addEventListener('change', async () => {
      const slug = genSlugInput.value.trim().toLowerCase();
      if (!slug) return;
      if (genTitleInput) genTitleInput.placeholder = "Загрузка названия...";
      if (genDescInput) genDescInput.placeholder = "Загрузка и перевод описания...";
      try {
        const response = await fetch(`https://api.modrinth.com/v2/project/${slug}`);
        if (!response.ok) throw new Error('Мод не найден');
        const data = await response.json();
        if (data.title && genTitleInput) genTitleInput.value = data.title;
        if (data.description && genDescInput) {
          let cleanDesc = data.description.replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim();
          try {
            const transResponse = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanDesc)}&langpair=en|ru`);
            const transData = await transResponse.json();
            genDescInput.value = (transData && transData.responseData) ? transData.responseData.translatedText : cleanDesc;
          } catch {
            genDescInput.value = cleanDesc;
          }
        }
      } catch {
        if (genTitleInput) genTitleInput.placeholder = "Введите вручную.";
        if (genDescInput) genDescInput.placeholder = "Введите вручную.";
      }
    });
  }

  if (catsBtn && catsMenu) {
    catsBtn.addEventListener('click', (e) => { e.stopPropagation(); catsMenu.classList.toggle('show'); });
    catsMenu.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => catsMenu.classList.remove('show'));
    catsMenu.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const checkedBoxes = catsMenu.querySelectorAll('input[type="checkbox"]:checked');
        catsBtn.textContent = checkedBoxes.length === 0 ? 'Выбрать категории...' : Array.from(checkedBoxes).map(cb => cb.value).join(', ');
      });
    });
  }

  if (genBtn) {
    genBtn.addEventListener('click', () => {
      const title = genTitleInput.value.trim();
      const slug = genSlugInput.value.trim();
      const checkedBoxes = document.querySelectorAll('#gen-cats-options input[type="checkbox"]:checked');
      const customTags = Array.from(checkedBoxes).map(cb => cb.value).join(', ');
      let sortGroup = document.getElementById('gen-sort-group').value.trim() || slug;
      const side = document.getElementById('gen-side').value;
      const noteUrl = document.getElementById('gen-note-url').value.trim();
      const desc = genDescInput.value.trim();

      if (!title || !slug) return alert('Пожалуйста, введите Название и Slug мода!');

      let sideText = side === 'both' ? 'Клиент + Сервер' : (side === 'server' ? 'Сервер' : 'Клиент');
      let customTagsHtml = '';
      customTags.split(',').map(t => t.trim()).filter(t => t.length > 0).forEach(tag => {
        customTagsHtml += `\n      <span class="tag custom">${tag}</span>`;
      });

      let iconHtml = sortGroup !== slug 
        ? `  <div class="mod-icon-container">\n      <img src="icons/404.png" alt="Иконка" class="mod-icon">\n      <img src="" alt="" class="parent-icon">\n    </div>`
        : `  <img src="icons/404.png" alt="${title}" class="mod-icon">`;

      let noteBtnHtml = noteUrl ? `\n    <a href="${noteUrl}" class="note-btn" data-tooltip="Нажмите для заметок">?</a>` : '';

      const resultHtml = `<!-- ${title} -->\n  <li data-slug="${slug}" data-side="${side}" data-custom-tags="${customTags}" data-sort-group="${sortGroup}">\n  ${iconHtml}\n    \n    <div class="mod-meta-wrapper">\n      <h3 class="mod-title">${title}</h3>\n      <div class="mod-tags">\n        <span class="tag side">${sideText}</span>\n        <span class="api-tags"></span>${customTagsHtml}\n      </div>\n      <div class="live-versions">Версии: <span>загрузка...</span></div>\n    </div>\n    \n    <div class="mod-links-group">\n      <a href="https://modrinth.com/mod/${slug}" target="_blank" class="modrinth-btn">Modrinth</a>${noteBtnHtml}\n    </div>\n    \n    <div class="info-text">\n      <p class="mod-desc">${desc}</p>\n    </div>\n  </li>`;

      const resultArea = document.getElementById('gen-result');
      if (resultArea) {
        resultArea.value = resultHtml;
        resultArea.select();
        navigator.clipboard.writeText(resultHtml).then(() => {
          const originalText = genBtn.textContent;
          genBtn.textContent = '✔ Копирование успешно!';
          genBtn.style.backgroundColor = '#16a085';
          setTimeout(() => { genBtn.textContent = originalText; genBtn.style.backgroundColor = ''; }, 1500);
        });
      }
    });
  }

  // Админ-панель Shift + I + K
  const pressedKeys = new Set();
  window.addEventListener('keydown', (e) => {
    pressedKeys.add(e.code);
    if (e.shiftKey && pressedKeys.has('KeyI') && pressedKeys.has('KeyK')) {
      e.preventDefault();
      const panel = document.querySelector('.generator-section');
      if (panel) panel.classList.toggle('is-visible');
    }
  });
  window.addEventListener('keyup', (e) => pressedKeys.delete(e.code));

  // Обязательно активируем иконки подсказок [!]
  initInfoIcons();
});

// Дополнительное закрытие окон по клику мимо
document.addEventListener('click', (e) => {
  if (!e.target.closest('.info-icon')) {
    document.querySelectorAll('.categories-help-box').forEach(box => box.classList.remove('show'));
  }
});
