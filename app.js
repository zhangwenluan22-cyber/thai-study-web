const STORAGE_KEYS = {
  favorites: "thai-study-favorites",
  voice: "thai-study-voice",
  theme: "thai-study-theme",
};

const state = {
  allSentences: [],
  filteredSentences: [],
  selectedId: null,
  favorites: new Set(loadJson(STORAGE_KEYS.favorites, [])),
  selectedVoice: localStorage.getItem(STORAGE_KEYS.voice) || "",
  voices: [],
  theme: localStorage.getItem(STORAGE_KEYS.theme) || "light",
};

const INLINE_DETAIL_BREAKPOINT = "(max-width: 1100px)";

const els = {
  searchInput: document.querySelector("#search-input"),
  primaryFilter: document.querySelector("#primary-filter"),
  secondaryFilter: document.querySelector("#secondary-filter"),
  difficultyFilter: document.querySelector("#difficulty-filter"),
  favoritesOnly: document.querySelector("#favorites-only"),
  autoPlay: document.querySelector("#auto-play"),
  voiceSelect: document.querySelector("#voice-select"),
  testVoiceBtn: document.querySelector("#test-voice-btn"),
  practiceInput: document.querySelector("#practice-input"),
  practiceSpeakBtn: document.querySelector("#practice-speak-btn"),
  practiceClearBtn: document.querySelector("#practice-clear-btn"),
  practiceHint: document.querySelector("#practice-hint"),
  randomBtn: document.querySelector("#random-btn"),
  themeToggle: document.querySelector("#theme-toggle"),
  sentenceList: document.querySelector("#sentence-list"),
  resultsHint: document.querySelector("#results-hint"),
  statTotal: document.querySelector("#stat-total"),
  statVisible: document.querySelector("#stat-visible"),
  statFavorites: document.querySelector("#stat-favorites"),
  detailEmpty: document.querySelector("#detail-empty"),
  detailCard: document.querySelector("#detail-card"),
  detailCategory: document.querySelector("#detail-category"),
  detailChinese: document.querySelector("#detail-chinese"),
  detailThai: document.querySelector("#detail-thai"),
  detailRoman: document.querySelector("#detail-roman"),
  detailDifficulty: document.querySelector("#detail-difficulty"),
  detailType: document.querySelector("#detail-type"),
  detailUsage: document.querySelector("#detail-usage"),
  detailTip: document.querySelector("#detail-tip"),
  detailBreakdown: document.querySelector("#detail-breakdown"),
  detailTags: document.querySelector("#detail-tags"),
  favoriteBtn: document.querySelector("#favorite-btn"),
  speakBtn: document.querySelector("#speak-btn"),
  template: document.querySelector("#sentence-item-template"),
};

async function init() {
  const payload = window.THAI_STUDY_DATA;
  if (!payload?.sentences?.length) {
    throw new Error("Sentence data missing");
  }
  state.allSentences = payload.sentences;

  applyTheme(state.theme);
  populateFilters();
  populateVoiceOptions();
  bindEvents();
  applyFilters();

  els.statTotal.textContent = String(state.allSentences.length);
  els.statFavorites.textContent = String(state.favorites.size);

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function bindEvents() {
  [
    els.searchInput,
    els.primaryFilter,
    els.secondaryFilter,
    els.difficultyFilter,
    els.favoritesOnly,
  ].forEach((element) => element.addEventListener("input", applyFilters));

  els.autoPlay.addEventListener("change", () => {
    if (state.selectedId && els.autoPlay.checked) {
      const current = findSentence(state.selectedId);
      if (current) {
        speak(current.thai);
      }
    }
  });

  els.voiceSelect.addEventListener("change", () => {
    state.selectedVoice = els.voiceSelect.value;
    localStorage.setItem(STORAGE_KEYS.voice, state.selectedVoice);
  });

  els.testVoiceBtn.addEventListener("click", () => {
    speak("สวัสดีค่ะ ยินดีต้อนรับสู่แบบฝึกภาษาไทย");
  });

  els.practiceSpeakBtn.addEventListener("click", () => {
    const text = els.practiceInput.value.trim();
    if (!text) {
      els.practiceHint.textContent = "先输入一点泰文，再点“朗读泰文”会更有帮助。";
      els.practiceInput.focus();
      return;
    }

    els.practiceHint.textContent = "正在使用当前泰语声音朗读这段内容。";
    speak(text);
  });

  els.practiceClearBtn.addEventListener("click", () => {
    els.practiceInput.value = "";
    els.practiceHint.textContent =
      "小提示：这里适合自己输入或粘贴泰文内容，系统会尽量用设备里的泰语语音读出来。";
    els.practiceInput.focus();
  });

  els.randomBtn.addEventListener("click", () => {
    if (!state.filteredSentences.length) return;
    const candidates =
      state.filteredSentences.length > 1
        ? state.filteredSentences.filter((item) => item.id !== state.selectedId)
        : state.filteredSentences;
    const randomItem = candidates[Math.floor(Math.random() * candidates.length)];
    if (!randomItem) return;

    if (randomItem.id === state.selectedId) {
      if (els.autoPlay.checked) {
        speak(randomItem.thai);
      }
      return;
    }

    selectSentence(randomItem.id, true);
    document
      .querySelector(`.sentence-card[data-id="${randomItem.id}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });

  els.themeToggle.addEventListener("click", () => {
    const nextTheme = state.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  });

  els.favoriteBtn.addEventListener("click", () => {
    if (state.selectedId === null) return;
    toggleFavorite(state.selectedId);
    const item = findSentence(state.selectedId);
    if (item) {
      renderDetail(item);
      renderList();
    }
  });

  els.speakBtn.addEventListener("click", () => {
    const current = findSentence(state.selectedId);
    if (current) {
      speak(current.thai);
    }
  });

  window.addEventListener("resize", () => {
    renderList();
    const current = findSentence(state.selectedId);
    if (current) {
      renderDetail(current);
    } else {
      renderEmptyDetail();
    }
  });

  window.speechSynthesis?.addEventListener("voiceschanged", populateVoiceOptions);
}

function applyTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem(STORAGE_KEYS.theme, state.theme);

  const isDark = state.theme === "dark";
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute("content", isDark ? "#16211f" : "#f4efe6");
  }

  if (els.themeToggle) {
    els.themeToggle.setAttribute("aria-pressed", String(isDark));
    els.themeToggle.setAttribute("aria-label", isDark ? "切换到白天模式" : "切换到深夜模式");
    const label = els.themeToggle.querySelector(".theme-toggle__label");
    const icon = els.themeToggle.querySelector(".theme-toggle__icon");
    if (label) label.textContent = isDark ? "白天" : "深夜";
    if (icon) icon.textContent = isDark ? "☼" : "☽";
  }
}

function populateFilters() {
  fillSelect(els.primaryFilter, uniqueValues("primaryCategory"));
  fillSelect(els.secondaryFilter, uniqueValues("secondaryCategory"));
  fillSelect(els.difficultyFilter, uniqueValues("difficulty"));
}

function populateVoiceOptions() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  state.voices = voices.filter(
    (voice) => voice.lang.toLowerCase().includes("th") || /thai/i.test(voice.name),
  );

  const previous = state.selectedVoice;
  els.voiceSelect.innerHTML = '<option value="">自动选择系统最佳泰语声音</option>';

  state.voices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    if (voice.name === previous) {
      option.selected = true;
    }
    els.voiceSelect.append(option);
  });
}

function fillSelect(select, values) {
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function uniqueValues(key) {
  return [...new Set(state.allSentences.map((item) => item[key]).filter(Boolean))];
}

function applyFilters() {
  const keyword = els.searchInput.value.trim().toLowerCase();
  const primary = els.primaryFilter.value;
  const secondary = els.secondaryFilter.value;
  const difficulty = els.difficultyFilter.value;
  const favoritesOnly = els.favoritesOnly.checked;

  state.filteredSentences = state.allSentences.filter((item) => {
    const haystack = [
      item.chinese,
      item.thai,
      item.romanization,
      item.primaryCategory,
      item.secondaryCategory,
      item.note,
    ]
      .join(" ")
      .toLowerCase();

    if (keyword && !haystack.includes(keyword)) return false;
    if (primary && item.primaryCategory !== primary) return false;
    if (secondary && item.secondaryCategory !== secondary) return false;
    if (difficulty && item.difficulty !== difficulty) return false;
    if (favoritesOnly && !state.favorites.has(item.id)) return false;
    return true;
  });

  if (!state.filteredSentences.length) {
    state.selectedId = null;
    renderList();
    renderEmptyDetail();
    return;
  }

  const currentVisible = state.filteredSentences.some((item) => item.id === state.selectedId);
  if (!currentVisible) {
    state.selectedId = state.filteredSentences[0].id;
  }

  renderList();
  const current = findSentence(state.selectedId);
  if (current) {
    renderDetail(current);
  }
}

function renderList() {
  els.sentenceList.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const inlineDetailMode = isInlineDetailMode();

  state.filteredSentences.forEach((item) => {
    const wrapper = document.createElement("div");
    wrapper.className = "sentence-entry";

    const node = els.template.content.firstElementChild.cloneNode(true);
    node.dataset.id = String(item.id);
    node.classList.toggle("is-active", item.id === state.selectedId);
    node.querySelector(".sentence-card__category").textContent = formatCategory(item);
    node.querySelector(".sentence-card__thai").textContent = item.thai || "暂缺泰语";
    node.querySelector(".sentence-card__chinese").textContent = item.chinese || "暂缺中文";
    node.querySelector(".sentence-card__roman").textContent =
      item.romanization || "暂缺罗马音";
    node.querySelector(".sentence-card__favorite").textContent = state.favorites.has(item.id)
      ? "★"
      : "☆";
    node.addEventListener("click", () => selectSentence(item.id, true));

    wrapper.append(node);

    if (inlineDetailMode && item.id === state.selectedId) {
      wrapper.append(buildInlineDetail(item));
    }

    fragment.append(wrapper);
  });

  els.sentenceList.append(fragment);
  els.resultsHint.textContent = `共 ${state.filteredSentences.length} 条，点句子展开，再点一次收起`;
  els.statVisible.textContent = String(state.filteredSentences.length);
  els.statFavorites.textContent = String(state.favorites.size);
}

function selectSentence(id, allowSpeech = false) {
  if (state.selectedId === id) {
    state.selectedId = null;
    renderList();
    renderEmptyDetail();
    return;
  }

  state.selectedId = id;
  renderList();
  const item = findSentence(id);
  if (!item) return;
  renderDetail(item);
  if (allowSpeech && els.autoPlay.checked) {
    speak(item.thai);
  }
}

function renderDetail(item) {
  if (isInlineDetailMode()) {
    els.detailEmpty.classList.add("hidden");
    els.detailCard.classList.add("hidden");
    return;
  }

  els.detailEmpty.classList.add("hidden");
  els.detailCard.classList.remove("hidden");
  els.detailCategory.textContent = formatCategory(item);
  els.detailChinese.textContent = item.chinese || "暂缺中文";
  els.detailThai.textContent = item.thai || "暂缺泰语";
  els.detailRoman.textContent = item.romanization || "暂缺罗马音";
  els.detailDifficulty.textContent = item.difficulty || "未标注";
  els.detailType.textContent = item.analysis.sentenceType;
  els.detailUsage.textContent = item.note || "当前没有额外备注。";
  els.detailTip.textContent = item.analysis.studyTip;
  els.favoriteBtn.textContent = state.favorites.has(item.id) ? "取消收藏" : "收藏";

  els.detailBreakdown.innerHTML = "";
  (item.analysis.wordBreakdown || []).forEach((part) => {
    const box = document.createElement("div");
    box.className = "breakdown-item";
    box.innerHTML = `
      <strong>${escapeHtml(part.label)}: ${escapeHtml(part.value)}</strong>
      <p class="breakdown-item__hint">${escapeHtml(part.hint)}</p>
    `;
    els.detailBreakdown.append(box);
  });

  els.detailTags.innerHTML = "";
  item.analysis.tags.forEach((tag) => {
    const span = document.createElement("span");
    span.textContent = tag;
    els.detailTags.append(span);
  });
}

function renderEmptyDetail() {
  if (isInlineDetailMode()) {
    els.detailEmpty.classList.add("hidden");
    els.detailCard.classList.add("hidden");
    els.resultsHint.textContent = "没有匹配结果，可以换个关键词试试";
    els.statVisible.textContent = "0";
    return;
  }

  els.detailEmpty.classList.remove("hidden");
  els.detailCard.classList.add("hidden");
  els.resultsHint.textContent = "没有匹配结果，可以换个关键词试试";
  els.statVisible.textContent = "0";
}

function buildInlineDetail(item) {
  const detail = document.createElement("article");
  detail.className = "inline-detail-card";
  detail.innerHTML = `
    <div class="inline-detail-card__top">
      <div>
        <p class="detail-card__category">${escapeHtml(formatCategory(item))}</p>
        <h3>${escapeHtml(item.chinese || "暂缺中文")}</h3>
      </div>
      <div class="inline-detail-card__actions">
        <button class="ghost-button inline-speak-btn" type="button">朗读</button>
        <button class="favorite-button inline-favorite-btn" type="button">${
          state.favorites.has(item.id) ? "取消收藏" : "收藏"
        }</button>
      </div>
    </div>

    <div class="detail-card__thai">${escapeHtml(item.thai || "暂缺泰语")}</div>
    <div class="detail-card__roman">${escapeHtml(item.romanization || "暂缺罗马音")}</div>

    <div class="detail-card__meta">
      <span class="pill">${escapeHtml(item.difficulty || "未标注")}</span>
      <span class="pill">${escapeHtml(item.analysis.sentenceType)}</span>
    </div>

    <section class="analysis-block">
      <h4>备注</h4>
      <p>${escapeHtml(item.note || "当前没有额外备注。")}</p>
    </section>

    <section class="analysis-block">
      <h4>学习建议</h4>
      <p>${escapeHtml(item.analysis.studyTip)}</p>
    </section>

    <section class="analysis-block">
      <h4>拆词感知</h4>
      <div class="breakdown-list">${buildBreakdownMarkup(item.analysis.wordBreakdown || [])}</div>
    </section>

    <section class="analysis-block">
      <h4>标签</h4>
      <div class="tag-list">${buildTagsMarkup(item.analysis.tags || [])}</div>
    </section>

  `;

  detail.querySelector(".inline-speak-btn").addEventListener("click", (event) => {
    event.stopPropagation();
    speak(item.thai);
  });

  detail.querySelector(".inline-favorite-btn").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(item.id);
    renderList();
  });

  return detail;
}

function buildBreakdownMarkup(parts) {
  return parts
    .map(
      (part) => `
        <div class="breakdown-item">
          <strong>${escapeHtml(part.label)}: ${escapeHtml(part.value)}</strong>
          <p class="breakdown-item__hint">${escapeHtml(part.hint)}</p>
        </div>
      `,
    )
    .join("");
}

function buildTagsMarkup(tags) {
  return tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
}

function isInlineDetailMode() {
  return window.matchMedia(INLINE_DETAIL_BREAKPOINT).matches;
}

function formatCategory(item) {
  return [item.primaryCategory, item.secondaryCategory].filter(Boolean).join(" / ");
}

function findSentence(id) {
  return state.allSentences.find((item) => item.id === id);
}

function toggleFavorite(id) {
  if (state.favorites.has(id)) {
    state.favorites.delete(id);
  } else {
    state.favorites.add(id);
  }
  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify([...state.favorites]));
}

function speak(text) {
  if (!text || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "th-TH";
  utterance.rate = 0.9;
  utterance.pitch = 1;

  const exactVoice = state.voices.find((voice) => voice.name === state.selectedVoice);
  utterance.voice = exactVoice || chooseBestVoice();

  window.speechSynthesis.speak(utterance);
}

function chooseBestVoice() {
  return (
    state.voices.find((voice) => /female|หญิง|siri/i.test(voice.name)) ||
    state.voices[0] ||
    null
  );
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

init().catch(() => {
  els.resultsHint.textContent = "数据加载失败，请确认 sentences.js 和 app.js 在同一目录。";
});
