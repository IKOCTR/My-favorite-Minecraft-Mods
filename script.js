// ==========================================================================
// 🛠️ ЧАСТЬ 1: ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И ИНИЦИАЛИЗАЦИЯ ИКОНОК [!]
// ==========================================================================
// Импортируем Firebase модули напрямую в скрипт
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithCredential, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, arrayUnion, arrayRemove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
      // 1. Базовая сортировка по глобальным группам экосистем
      const groupA = (a.getAttribute('data-sort-group') || a.getAttribute('data-slug') || '').toLowerCase().trim();
      const groupB = (b.getAttribute('data-sort-group') || b.getAttribute('data-slug') || '').toLowerCase().trim();

      if (groupA !== groupB) {
        return groupA.localeCompare(groupB, undefined, { numeric: true, sensitivity: 'base' });
      }

      // --- ЖЕСТКИЙ ФИКС ДЛЯ ГЛАВНОГО ОТЦА ---
      // Если один из модов является корнем группы (его slug совпадает с именем группы),
      // он ОБЯЗАН стоять на первом месте, оттесняя любые аддоны
      const slugA = (a.getAttribute('data-slug') || '').toLowerCase().trim();
      const slugB = (b.getAttribute('data-slug') || '').toLowerCase().trim();

      if (slugA === groupA && slugB !== groupB) return -1; // А — главный отец, двигаем вверх
      if (slugB === groupB && slugA !== groupA) return 1;  // Б — главный отец, двигаем вверх

      // 2. Если они оба аддоны внутри одной группы, выстраиваем их по цепочке data-parent
      const getTrace = (currentSlug) => {
        const trace = [];
        let current = currentSlug;
        while (current) {
          trace.unshift(current);
          const element = document.querySelector(`#mods-list li[data-slug="${current}"]`);
          const parent = element ? element.getAttribute('data-parent') : null;
          
          if (!parent || parent === current || trace.includes(parent)) break;
          current = parent.toLowerCase().trim();
        }
        return trace;
      };

      const traceA = getTrace(slugA);
      const traceB = getTrace(slugB);

      // Ищем точку, где пути расходятся
      const minLength = Math.min(traceA.length, traceB.length);
      for (let i = 0; i < minLength; i++) {
        if (traceA[i] !== traceB[i]) {
          const elA = document.querySelector(`#mods-list li[data-slug="${traceA[i]}"]`);
          const elB = document.querySelector(`#mods-list li[data-slug="${traceB[i]}"]`);
          const titleA = elA ? elA.querySelector('.mod-title').textContent : traceA[i];
          const titleB = elB ? elB.querySelector('.mod-title').textContent : traceB[i];
          
          return titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: 'base' });
        }
      }

      return traceA.length - traceB.length;
    });


    sortedLi.forEach(li => listContainer.appendChild(li));

    // ВСТАВЬ ЭТОТ НОВЫЙ ВАРИАНТ ДЛЯ ЗАМЕНЫ:
    sortedLi.forEach(li => {
      const parentSlug = li.getAttribute('data-parent');
      if (parentSlug) {
        // Ищем карточку, чей slug совпадает с ПРЯМЫМ родителем этого аддона
        const parentLi = sortedLi.find(p => p.getAttribute('data-slug') === parentSlug);
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

  // --- ЛОГИКА ИНТЕРАКТИВНОЙ ПОДСВЕТКИ ЦЕПОЧЕК ---
  modItems.forEach(li => {
    li.addEventListener('mouseenter', () => {
      const currentSlug = li.getAttribute('data-slug');
      if (!currentSlug) return;

      // 1. Находим всех родителей вверх по цепочке
      let parentList = [];
      let current = li;
      while (current) {
        const pSlug = current.getAttribute('data-parent');
        if (!pSlug || pSlug === current.getAttribute('data-slug')) break;
        const parentEl = document.querySelector(`#mods-list li[data-slug="${pSlug}"]`);
        if (parentEl && !parentList.includes(parentEl)) {
          parentList.push(parentEl);
          current = parentEl;
        } else {
          break;
        }
      }

      // 2. Находим все аддоны вниз по цепочке (включая аддоны к аддонам)
      let addonList = [];
      const findAddonsRecursively = (slug) => {
        const directAddons = document.querySelectorAll(`#mods-list li[data-parent="${slug}"]`);
        directAddons.forEach(addon => {
          if (!addonList.includes(addon)) {
            addonList.push(addon);
            findAddonsRecursively(addon.getAttribute('data-slug'));
          }
        });
      };
      findAddonsRecursively(currentSlug);

      // 3. Объединяем всех родственников и вешаем класс подсветки
      const allRelations = [...parentList, ...addonList];
      allRelations.forEach(el => el.classList.add('is-related'));
    });

    // Убираем подсветку, когда мышь уходит с карточки
    li.addEventListener('mouseleave', () => {
      modItems.forEach(el => el.classList.remove('is-related'));
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
      const parentInput = document.getElementById('gen-parent-slug')?.value.trim().toLowerCase() || '';
      let finalParent = '';
      let finalSortGroup = slug; // По умолчанию мод сам себе корень
      if (parentInput) {
        finalParent = parentInput;
        // Ищем прямого родителя в уже существующих на сайте модах
        const existingParentEl = document.querySelector(`#mods-list li[data-slug="${parentInput}"]`);


        if (existingParentEl) {
          // Если родитель сам к кому-то привязан, берем его КОРНЕВУЮ группу (самого верхнего предка)
          finalSortGroup = existingParentEl.getAttribute('data-sort-group') || parentInput;
        } else {
          // Если родитель базовый (как сам Create), то его slug и есть корневая группа
          finalSortGroup = parentInput;
        }
      }
      const side = document.getElementById('gen-side').value;
      const noteUrl = document.getElementById('gen-note-url').value.trim();
      const fullNotesContent = document.getElementById('gen-full-notes')?.value.trim() || '';
      const desc = genDescInput.value.trim();
      // Проверяем, открыто ли поле заметок и есть ли там текст
      const notesContainerCheck = document.getElementById('extended-notes-container');
      const isNotesVisible = notesContainerCheck && notesContainerCheck.style.display !== 'none';
      if (!title || !slug) return alert('Пожалуйста, введите Название и Slug мода!');

      let sideText = side === 'both' ? 'Клиент + Сервер' : (side === 'server' ? 'Сервер' : 'Клиент');
      let customTagsHtml = '';
      customTags.split(',').map(t => t.trim()).filter(t => t.length > 0).forEach(tag => {
        customTagsHtml += `\n            <span class="tag custom">${tag}</span>`;
      });

      let iconHtml = finalSortGroup !== slug 
        ? `  <div class="mod-icon-container">\n    <img src="icons/404.png" alt="Иконка" class="mod-icon">\n    <img src="" alt="" class="parent-icon">\n  </div>`
        : ` <img src="icons/404.png" alt="${title}" class="mod-icon">`;

      // let noteBtnHtml = noteUrl ? `\n    <a href="${noteUrl}" class="note-btn" data-tooltip="Нажмите для заметок">?</a>` : '';

      // Подготовка безопасного описания
      const safeDesc = desc.replace(/"/g, '&quot;').replace(/\n/g, ' ');
      
      // Логика проверки: создаем расширенные заметки только если поле видно и в нем есть текст
      let noteBtnHtml = '';
      let finalFullNotesHtml = '';
      if (isNotesVisible && fullNotesContent.length > 0) {
        noteBtnHtml = `<button type="button" class="note-btn" data-tooltip="Открыть справку от IK 27">?</button>`;
        finalFullNotesHtml = `\n        <!-- Блок расширенных заметок -->\n        <div class="mod-full-notes" style="display: none;">\n          ${fullNotesContent}\n        </div>`;
      }
      // Собираем итоговую разметку карточки li
      const resultHtml = `<!-- ${title} -->
      <li data-slug="${slug}" data-side="${side}" data-custom-tags="${customTags}" data-sort-group="${finalSortGroup}" data-parent="${finalParent}">
      ${iconHtml}
        <!-- Панель кнопок лайков и избранного -->
        <div class="mod-interaction-panel">
          <button type="button" class="interaction-btn btn-favorite" title="Добавить в избранное">
            <span class="star-icon">☆</span>
          </button>
          <button type="button" class="interaction-btn btn-like" title="Лайкнуть мод">
            <span class="heart-icon">🤍</span>
            <span class="like-count">0</span>
          </button>
        </div>
        <div class="mod-meta-wrapper">
          <h3 class="mod-title">${title}</h3>
          <div class="mod-tags">
            <span class="tag side">${sideText}</span>
            <span class="api-tags"></span>${customTagsHtml}
          </div>
          <div class="live-versions">Версии: <span>загрузка...</span></div>
        </div>
        <div class="mod-links-group">
          <a href="https://modrinth.com/mod/${slug}" target="_blank" class="modrinth-btn">Modrinth</a>
          ${noteBtnHtml}
        </div>
        <div class="info-text">
          <p class="mod-desc">${safeDesc}</p>
        </div>${finalFullNotesHtml}
      </li>`;


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
  
  // Логика кнопки показа шаблона заметок и авто-высоты поля
  const toggleTemplateBtn = document.getElementById('toggle-template-btn');
  const notesContainer = document.getElementById('extended-notes-container');
  const mainNotesTextArea = document.getElementById('gen-full-notes');

  if (toggleTemplateBtn && notesContainer && mainNotesTextArea) {
    // Функция авто-подгонки высоты под объем текста
    const autoResizeNotes = () => {
      mainNotesTextArea.style.height = 'auto';
      mainNotesTextArea.style.height = mainNotesTextArea.scrollHeight + 'px';
    };

    toggleTemplateBtn.addEventListener('click', () => {
      // Исправлено чтение свойства display: убрано лишнее .style
      if (notesContainer.style.display === 'none' || notesContainer.style.display === '') {
        notesContainer.style.display = 'block';
        toggleTemplateBtn.innerHTML = '❌ Удалить / Скрыть расширенные заметки';
        toggleTemplateBtn.style.border = '1px dashed #ff4757';
        toggleTemplateBtn.style.color = '#ff4757';

        // Записываем шаблон, если поле абсолютно пустое
        if (!mainNotesTextArea.value.trim()) {
          mainNotesTextArea.value = `<h2 style="margin-top:0; color:#00ff88; font-size:22px; font-family:sans-serif;">Справка о моде</h2>
          <p>Краткое описание мода для раскрывающейся плашки...</p>
          
          <!-- Шаблон: Картинка с рамкой -->
          <img src="icons/404.png" alt="Скриншот" style="width:100%; border-radius:8px; margin:15px 0; border:1px solid #333; display:block;">
          
          <!-- Шаблон: Зеленая заметка от IK 27 -->
          <div style="background: rgba(0, 255, 136, 0.1); border-left: 4px solid #00ff88; padding: 12px 15px; border-radius: 0 8px 8px 0; margin: 15px 0; color: #fff;">
            <strong>Заметка от IKOCTR 27:</strong> Текст вашего особого предупреждения.
          </div>
          
          <!-- Шаблон: Видео с YouTube (подставьте свою ссылку на видео) -->
          <div class="video-container" style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; margin:15px 0; border-radius:8px; background:#000;">
            <iframe src="https://youtube.com" style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" allowfullscreen></iframe>
          </div>
          
          <!-- Шаблон: Ссылки и конфиги -->
          <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
            <a href="имя_файла.html" target="_blank" class="nav-btn" style="display:inline-block; text-decoration:none; padding:10px 20px; font-family:sans-serif; border:1px solid #00ff88; color:#00ff88; border-radius:4px;">📄 Открыть HTML-страницу</a>
            <a href="downloads/config.json" download class="nav-btn active" style="display:inline-block; text-decoration:none; padding:10px 20px; font-family:sans-serif; background:#00ff88; color:#000; border-radius:4px; font-weight:bold;">📥 Скачать конфиг</a>
          </div>`;
        }

        // Вызываем перерасчет высоты сразу после вставки шаблона
        autoResizeNotes();
      } else {
        // Очищаем поле при закрытии, чтобы кнопка "?" случайно не сгенерировалась
        notesContainer.style.display = 'none';
        mainNotesTextArea.value = ''; 
        toggleTemplateBtn.innerHTML = '➕ Добавить расширенные заметки (шаблон)';
        toggleTemplateBtn.style.border = '1px dashed #00ff88';
        toggleTemplateBtn.style.color = '#00ff88';
      }
    });

    // Отслеживаем ввод текста пользователем для динамического изменения высоты
    mainNotesTextArea.addEventListener('input', autoResizeNotes);
  }


  // Обязательно активируем иконки подсказок [!]
  initInfoIcons();
});

// Дополнительное закрытие окон по клику мимо
document.addEventListener('click', (e) => {
  if (!e.target.closest('.info-icon')) {
    document.querySelectorAll('.categories-help-box').forEach(box => box.classList.remove('show'));
  }
});


// ==========================================================================
// ЛОГИКА ПОЛНОЭКРАННОГО МОДАЛЬНОГО ОКНА ДЛЯ ЗАМЕТОК (ОБНОВЛЕННАЯ)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('notes-modal');
  const modalBody = document.getElementById('modal-body-content');
  const modalClose = document.querySelector('.modal-close-btn');

  // Ловим нажатие на "?" в списке модов
  document.getElementById('mods-list')?.addEventListener('click', (e) => {
    const noteBtn = e.target.closest('.note-btn');
    if (!noteBtn) return;
    
    e.stopPropagation(); // Стопаем раскрытие карточки мода

    // Находим родительский элемент li конкретного мода
    const li = noteBtn.closest('li');
    if (!li) return;

    // Вытаскиваем из этого li блок с полной разметкой заметок
    const fullNotesSource = li.querySelector('.mod-full-notes');
    
    if (modalBody && modal) {
      if (fullNotesSource) {
        // Копируем весь HTML-контент (текст, фото, видео) внутрь модалки
        modalBody.innerHTML = fullNotesSource.innerHTML;
      } else {
        // Если забыли добавить блок .mod-full-notes в HTML
        modalBody.innerHTML = `<h2 style="margin-top:0; color:#ff4757;">Ошибка</h2><p>Для этого мода еще не созданы расширенные заметки.</p>`;
      }
      
      modal.classList.add('is-active');
      document.body.style.overflow = 'hidden'; // Отключаем скролл сайта
    }
  });

  // Закрытие модального окна (при клике на крестик, фон или кнопку Escape)
  if (modalClose && modal) {
    const closeModal = () => {
      modal.classList.remove('is-active');
      document.body.style.overflow = ''; // Возвращаем скролл сайту
      if (modalBody) modalBody.innerHTML = ''; // Очищаем код (чтобы выключить видео с Ютуба, если оно играло)
    };

    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  }
    // ==========================================================================
  // 🔥 ГИБРИДНАЯ СИСТЕМА ЛАЙКОВ И ИЗБРАННОГО (GOOGLE + FIREBASE)
  // ==========================================================================

  // 1. Инициализация Firebase конфигурации с твоего скриншота
  const firebaseConfig = {
    apiKey: "AIzaSyBYq6OwvHMKxgJRgaqqIHimvvjGn29VvT4",
    authDomain: "ik27-mods-website-98924.firebaseapp.com",
    projectId: "ik27-mods-website-98924",
    storageBucket: "ik27-mods-website-98924.firebasestorage.app",
    messagingSenderId: "355979841287",
    appId: "1:355979841287:web:2d6e8ccb9b500af41c3fa2"
  };

  const GOOGLE_CLIENT_ID = "355979841287-3m3ma4pod2lbavlhmelvepgjguht9niv.apps.googleusercontent.com";

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  // // Локальный авто-вход для тестирования лайков без Google
  // if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
  //     signInAnonymously(auth)
  //         .then(() => {
  //             console.log("Успешно вошли анонимно для теста на localhost!");
  //             currentUser = auth.currentUser; 
  //         })
  //         .catch((error) => {
  //             console.error("Ошибка анонимного входа:", error);
  //         });
  // }

  const db = getFirestore(app);

  let currentUser = null;
  let localFavorites = JSON.parse(localStorage.getItem('ik27_favorites')) || [];
  let globalLikesData = {}; // Тут храним лайки с сервера {slug: count}

    // --- Функция первоначальной подгрузки лайков со всего сервера (Безопасная) ---
  async function loadGlobalLikes() {
    modItems.forEach(async (li) => {
      const slug = li.getAttribute('data-slug');
      if (!slug) return;
      
      const docRef = doc(db, "likes", slug);
      const docSnap = await getDoc(docRef);
      
      let count = 0;
      if (docSnap.exists()) {
        count = docSnap.data().count || 0;
        
        const likeBtn = li.querySelector('.btn-like');
        if (likeBtn && currentUser && docSnap.data().users?.includes(currentUser?.uid)) {
          likeBtn.classList.add('is-liked');
          const heart = likeBtn.querySelector('.heart-icon');
          if (heart) heart.textContent = "❤️";
        }
      }
      globalLikesData[slug] = count;
      
      const countEl = li.querySelector('.like-count');
      if (countEl) countEl.textContent = count;
    });
  }


  // --- Функция синхронизации Избранного (Гибридный режим) ---
  async function syncFavorites(user) {
    const favRef = doc(db, "favorites", user.uid);
    const favSnap = await getDoc(favRef);

    if (favSnap.exists()) {
      // Если в облаке есть данные, объединяем их с тем, что накопилось в localStorage локально
      const cloudFavs = favSnap.data().list || [];
      const mergedFavs = Array.from(new Set([...localFavorites, ...cloudFavs]));
      localFavorites = mergedFavs;
      await setDoc(favRef, { list: mergedFavs });
    } else {
      // Если пользователь зашел первый раз — выгружаем его локальные закладки в облако
      await setDoc(favRef, { list: localFavorites });
    }
    localStorage.setItem('ik27_favorites', JSON.stringify(localFavorites));
    updateFavoritesUI();
  }

  // Обновление иконок звездочек на странице (Исправленная версия)
  function updateFavoritesUI() {
    modItems.forEach(li => {
      const slug = li.getAttribute('data-slug');
      const favBtn = li.querySelector('.btn-favorite');
      if (!favBtn) return; // <--- Проверка исправлена

      const star = favBtn.querySelector('.star-icon');
      if (!star) return;
      
      if (localFavorites.includes(slug)) {
        favBtn.classList.add('is-favorited');
        star.textContent = "★";
      } else {
        favBtn.classList.remove('is-favorited');
        star.textContent = "☆";
      }
    });
  }


  // --- ОБРАБОТКА НАЖАТИЯ НА ЗВЕЗДОЧКУ (ИЗБРАННОЕ) ---
  modItems.forEach(li => {
    const slug = li.getAttribute('data-slug');
    const favBtn = li.querySelector('.btn-favorite');
    if (!favBtn) return;

    favBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); // чтобы карточка не открывалась при клике
      if (favBtn.classList.contains('is-loading')) return; // Если кнопка уже нажата — игнорируем новые клики
      favBtn.classList.add('is-loading');
      setTimeout(() => favBtn.classList.remove('is-loading'), 300); // Разрешаем клик только через 300мс

      if (localFavorites.includes(slug)) {
        localFavorites = localFavorites.filter(id => id !== slug);
        if (currentUser) {
          await setDoc(doc(db, "favorites", currentUser?.uid), { list: arrayRemove(slug) }, { merge: true });
        }
      } else {
        localFavorites.push(slug);
        if (currentUser) {
          await setDoc(doc(db, "favorites", currentUser?.uid), { list: arrayUnion(slug) }, { merge: true });
        }
      }
      localStorage.setItem('ik27_favorites', JSON.stringify(localFavorites));
      updateFavoritesUI();
      applyFiltersAndSorting(); // Перезапускаем фильтр, если включен режим скрытия/показа
    });
  });

  // --- ОБРАБОТКА НАЖАТИЯ НА СЕРДЕЧКО (ЛАЙК) ---
  modItems.forEach(li => {
  const slug = li.getAttribute('data-slug');
  const likeBtn = li.querySelector('.btn-like');
  if (!likeBtn) return;

  likeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (likeBtn.classList.contains('is-loading')) return; // Если кнопка уже нажата — игнорируем новые клики
    likeBtn.classList.add('is-loading');
    setTimeout(() => likeBtn.classList.remove('is-loading'), 300); // Разрешаем клик только через 300мс


    if (!currentUser && auth.currentUser) {
      currentUser = auth.currentUser;
    }

    if (!currentUser) {
      alert("Пожалуйста, авторизуйтесь через Google в один клик вверху страницы, чтобы поставить лайк!");
      document.getElementById('google-login-btn').style.boxShadow = "0 0 15px #ff4545";
      return;
    }

    const docRef = doc(db, "likes", slug);
    const docSnap = await getDoc(docRef);
    const isAlreadyLiked = docSnap.exists() && docSnap.data().users?.includes(currentUser?.uid);

    try {
      if (isAlreadyLiked) {
        // Убираем лайк (безопасный updateDoc)
        await updateDoc(docRef, {
          count: increment(-1),
          users: arrayRemove(currentUser.uid),
          lastUpdated: serverTimestamp() // Пишем время запроса для защиты от кликера
        });
        likeBtn.classList.remove('is-liked');
        likeBtn.querySelector('.heart-icon').textContent = "❤";
        globalLikesData[slug]--;
      } else {
        // Ставим лайк. Если документа еще нет (первый лайк), используем setDoc
        if (!docSnap.exists()) {
          await setDoc(docRef, {
            count: 1,
            users: [currentUser.uid],
            lastUpdated: serverTimestamp()
          });
        } else {
          await updateDoc(docRef, {
            count: increment(1),
            users: arrayUnion(currentUser.uid),
            lastUpdated: serverTimestamp()
          });
        }
        likeBtn.classList.add('is-liked');
        likeBtn.querySelector('.heart-icon').textContent = "❤";
        globalLikesData[slug]++;
      }
      likeBtn.querySelector('.like-count').textContent = globalLikesData[slug];
    } catch (err) {
      console.warn("Слишком частые клики! Запрос заблокирован сервером.");
    }
    });
  });


    // --- ИНТЕГРАЦИЯ С ТВОЕЙ СИСТЕМОЙ СОРТИРОВКИ И ФИЛЬТРАЦИИ ---
  let currentSortMode = 'ecosystem'; 

  function applyFiltersAndSorting() {
    // 1. Сначала скрываем/показываем карточки на основе Избранного
    const showFav = document.getElementById('filter-show-fav')?.checked || false;
    const hideFav = document.getElementById('filter-hide-fav')?.checked || false;

    modItems.forEach(li => {
      const slug = li.getAttribute('data-slug');
      const isFav = localFavorites.includes(slug);

      li.style.display = ""; 

      if (showFav && !isFav) li.style.display = "none";
      if (hideFav && isFav) li.style.display = "none";
    });

    // 2. Сортировка элементов
    let finalOrder = [];
    const listContainer = document.getElementById('mods-list');
    
    if (currentSortMode === 'ecosystem') {
      // ИНТЕГРАЦИЯ: Твоя рабочая сортировка по цепочкам data-parent
      finalOrder = Array.from(modItems).sort((a, b) => {
        const groupA = (a.getAttribute('data-sort-group') || a.getAttribute('data-slug') || '').toLowerCase().trim();
        const groupB = (b.getAttribute('data-sort-group') || b.getAttribute('data-slug') || '').toLowerCase().trim();

        if (groupA !== groupB) {
          return groupA.localeCompare(groupB, undefined, { numeric: true, sensitivity: 'base' });
        }

        const slugA = (a.getAttribute('data-slug') || '').toLowerCase().trim();
        const slugB = (b.getAttribute('data-slug') || '').toLowerCase().trim();

        if (slugA === groupA && slugB !== groupB) return -1;
        if (slugB === groupB && slugA !== groupA) return 1;

        const getTrace = (currentSlug) => {
          const trace = [];
          let current = currentSlug;
          while (current) {
            trace.unshift(current);
            const element = document.querySelector(`#mods-list li[data-slug="${current}"]`);
            const parent = element ? element.getAttribute('data-parent') : null;
            if (!parent || parent === current || trace.includes(parent)) break;
            current = parent.toLowerCase().trim();
          }
          return trace;
        };

        const traceA = getTrace(slugA);
        const traceB = getTrace(slugB);

        const minLength = Math.min(traceA.length, traceB.length);
        for (let i = 0; i < minLength; i++) {
          if (traceA[i] !== traceB[i]) {
            const elA = document.querySelector(`#mods-list li[data-slug="${traceA[i]}"]`);
            const elB = document.querySelector(`#mods-list li[data-slug="${traceB[i]}"]`);
            const titleA = elA ? elA.querySelector('.mod-title').textContent : traceA[i];
            const titleB = elB ? elB.querySelector('.mod-title').textContent : traceB[i];
            return titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: 'base' });
          }
        }
        return traceA.length - traceB.length;
      });

    } else if (currentSortMode === 'likes') {
      // Сортировка по популярности (лайкам)
      finalOrder = Array.from(modItems).sort((a, b) => {
        const likesA = globalLikesData[a.getAttribute('data-slug')] || 0;
        const likesB = globalLikesData[b.getAttribute('data-slug')] || 0;
        return likesB - likesA; 
      });
    }

    // Возвращаем элементы на страницу в правильном порядке
    if (listContainer && finalOrder.length > 0) {
      finalOrder.forEach(li => listContainer.appendChild(li));
    }
    
    // Вызываем базовую фильтрацию по селекторам загрузчиков/версий
    if (typeof filterMods === 'function') filterMods();
  }

  // ИСПРАВЛЕНО: Новый обработчик событий для выпадающего списка сортировки
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSortMode = e.target.value; // Получаем значение ecosystem или likes
      applyFiltersAndSorting();
    });
  }

  // Привязка чекбоксов избранного к фильтрации
  const filterShowFavEl = document.getElementById('filter-show-fav');
  const filterHideFavEl = document.getElementById('filter-hide-fav');

  if (filterShowFavEl) {
    filterShowFavEl.addEventListener('change', (e) => {
      if(e.target.checked && filterHideFavEl) filterHideFavEl.checked = false;
      applyFiltersAndSorting();
    });
  }
  if (filterHideFavEl) {
    filterHideFavEl.addEventListener('change', (e) => {
      if(e.target.checked && filterShowFavEl) filterShowFavEl.checked = false;
      applyFiltersAndSorting();
    });
  }


  // --- НАСТРОЙКА GOOGLE ONE TAP АВТОРИЗАЦИИ ---
  
  // Функция, которую вызывает Google One Tap при успешном входе
  window.handleCredentialResponse = async (response) => {
    try {
      const credential = GoogleAuthProvider.credential(response.credential);
      const result = await signInWithCredential(auth, credential);
      currentUser = result.user;
      console.log("Успешно вошли через Google!", currentUser);
      activateUserUI(currentUser.displayName || "Пользователь");
      await syncFavorites(currentUser);
      updateFavoritesUI();
      await loadGlobalLikes(); 
    } catch (error) {
      console.error("Ошибка входа через Google:", error);
    }
  };

  // Функция для визуального обновления профиля при успешном входе
  function activateUserUI(name) {
    const loginBtn = document.getElementById('google-login-btn');
    const profileStatus = document.getElementById('user-profile-status');
    if (loginBtn) loginBtn.style.display = "none";
    if (profileStatus) {
      profileStatus.textContent = `👋 Привет, ${name}!`;
      profileStatus.style.display = "inline-block";
    }
  }

  // Единая правильная функция инициализации Google One Tap
  function initGoogleOneTap() {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: window.handleCredentialResponse,
        auto_select: true
      });
      google.accounts.id.prompt(); 
    } else if (isLocalhost) {
      console.warn("Google заблокирован CORB или Zapret на localhost. Переводим кнопку в тестовый режим.");
      const loginBtn = document.getElementById('google-login-btn');
      if (loginBtn) {
        loginBtn.textContent = "Войти как Тест-Админ";
        loginBtn.style.border = "1px solid #00ff88";
        loginBtn.style.color = "#00ff88";
      }
    } else {
      // Если скрипт Google еще грузится из сети — повторяем попытку через 100мс
      setTimeout(initGoogleOneTap, 100);
    }
  }

  // Активируем обработчик клика по кнопке ручного входа
  const loginBtn = document.getElementById('google-login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        // Если Google доступен — просто открываем окно
        google.accounts.id.prompt();
      } else if (isLocalhost) {
        // Если Google заблокирован локально — плавно пускаем через анонимного админа
        try {
          const result = await signInAnonymously(auth);
          currentUser = result.user;
          activateUserUI("Тест-Разработчик");
          await syncFavorites(currentUser);
          await loadGlobalLikes();
          console.log("Локальный анонимный вход успешно выполнен!");
        } catch (authError) {
          console.error("Ошибка анонимного входа:", authError);
          alert("Не удалось войти анонимно. Проверьте консоль и статус Zapret.");
        }
      }
    });
  }

  // СТАРТОВЫЙ ЗАПУСК ВСЕХ КОМПОНЕНТОВ СИСТЕМЫ
  updateFavoritesUI(); // Локальное избранное из localStorage будет работать всегда!

  // Проверяем: если мы НЕ на локальном компьютере, то подгружаем данные из Firebase
  if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    loadGlobalLikes();
    onAuthStateChanged(auth, (user) => {
    const loginBtn = document.querySelector('.google-auth-btn'); // Находим вашу кнопку войти (по её классу из HTML)
    
    if (user && user.providerData.some(p => p.providerId === 'google.com')) {
      currentUser = user; // Фиксируем пользователя в глобальной переменной
      
      // Меняем интерфейс кнопки на приветствие
      if (loginBtn) {
        loginBtn.innerHTML = `🟢 Привет, ${user.displayName.split(' ')[0]}!`; // Берем только имя без фамилии
        loginBtn.style.background = "linear-gradient(135deg, #2ecc71, #27ae60)";
        loginBtn.style.boxShadow = "none";
        loginBtn.style.cursor = "default";
      }
    } else {
      // Если пользователь ещё не входил или разлогинился — только тогда включаем всплывающее окно
      if (loginBtn) {
        loginBtn.innerHTML = `Войти через Google`;
        loginBtn.style.background = ""; // Возвращаем стандартный цвет из CSS
      }
      initGoogleOneTap();
    }
  });

} else {
  console.log("Разработка локально: Firebase функции лайков и авторизации отключены.");
}

}); // Самая последняя закрывающая скобка DOMContentLoaded твоего сайта
