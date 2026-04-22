const STORAGE_KEYS = {
  favorites: "thai-study-favorites",
  voice: "thai-study-voice",
  theme: "thai-study-theme",
};

const state = {
  allSentences: [],
  filteredSentences: [],
  selectedId: null,
  focusedListId: null,
  favorites: new Set(loadJson(STORAGE_KEYS.favorites, [])),
  selectedVoice: localStorage.getItem(STORAGE_KEYS.voice) || "",
  voices: [],
  theme: localStorage.getItem(STORAGE_KEYS.theme) || "light",
};

const INLINE_DETAIL_BREAKPOINT = "(max-width: 1100px)";
const MOBILE_BACK_TO_TOP_BREAKPOINT = "(max-width: 700px)";
const BACK_TO_TOP_OFFSET = 320;

const els = {
  searchInput: document.querySelector("#search-input"),
  primaryFilter: document.querySelector("#primary-filter"),
  secondaryFilter: document.querySelector("#secondary-filter"),
  difficultyFilter: document.querySelector("#difficulty-filter"),
  sortFilter: document.querySelector("#sort-filter"),
  favoritesOnly: document.querySelector("#favorites-only"),
  autoPlay: document.querySelector("#auto-play"),
  voiceSelect: document.querySelector("#voice-select"),
  testVoiceBtn: document.querySelector("#test-voice-btn"),
  practiceInput: document.querySelector("#practice-input"),
  practiceSpeakBtn: document.querySelector("#practice-speak-btn"),
  practiceClearBtn: document.querySelector("#practice-clear-btn"),
  practiceHint: document.querySelector("#practice-hint"),
  randomBtn: document.querySelector("#random-btn"),
  showAllBtn: document.querySelector("#show-all-btn"),
  themeToggle: document.querySelector("#theme-toggle"),
  sentenceList: document.querySelector("#sentence-list"),
  resultsHint: document.querySelector("#results-hint"),
  statTotal: document.querySelector("#stat-total"),
  statVisible: document.querySelector("#stat-visible"),
  statFavorites: document.querySelector("#stat-favorites"),
  detailEmpty: document.querySelector("#detail-empty"),
  detailCard: document.querySelector("#detail-card"),
  detailUsage: document.querySelector("#detail-usage"),
  detailBreakdown: document.querySelector("#detail-breakdown"),
  detailTags: document.querySelector("#detail-tags"),
  favoriteBtn: document.querySelector("#favorite-btn"),
  speakBtn: document.querySelector("#speak-btn"),
  backToTopBtn: document.querySelector("#back-to-top-btn"),
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
  updateBackToTopVisibility();

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
    els.sortFilter,
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
      state.focusedListId = randomItem.id;
      renderList();
      if (els.autoPlay.checked) {
        speak(randomItem.thai);
      }
      return;
    }

    state.focusedListId = randomItem.id;
    selectSentence(randomItem.id, true);
    document
      .querySelector(`.sentence-card[data-id="${randomItem.id}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });

  els.showAllBtn.addEventListener("click", () => {
    state.focusedListId = null;
    renderList();
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

  els.backToTopBtn?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });

  window.addEventListener("resize", () => {
    updateBackToTopVisibility();
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
  let hasPreviousVoice = false;

  state.voices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    if (voice.name === previous) {
      option.selected = true;
      hasPreviousVoice = true;
    }
    els.voiceSelect.append(option);
  });

  if (previous && !hasPreviousVoice) {
    state.selectedVoice = "";
    localStorage.removeItem(STORAGE_KEYS.voice);
    els.voiceSelect.value = "";
  }
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
  const sortMode = els.sortFilter.value;
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

  if (sortMode === "newest") {
    state.filteredSentences.sort(compareByNewest);
  }

  state.focusedListId = null;

  if (!state.filteredSentences.length) {
    state.selectedId = null;
    renderList();
    renderEmptyDetail();
    return;
  }

  const currentVisible = state.filteredSentences.some((item) => item.id === state.selectedId);
  if (isInlineDetailMode()) {
    if (!currentVisible) {
      state.selectedId = null;
    }
  } else if (!currentVisible) {
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
  const visibleSentences = getVisibleSentences();
  const compactHeader = window.matchMedia("(max-width: 700px)").matches;

  visibleSentences.forEach((item) => {
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
  els.showAllBtn.hidden = state.focusedListId === null;
  els.resultsHint.textContent =
    state.focusedListId === null
      ? compactHeader
        ? `共 ${state.filteredSentences.length} 条`
        : `共 ${state.filteredSentences.length} 条，点句子展开，再点一次收起`
      : compactHeader
        ? `聚焦 1 / ${state.filteredSentences.length}`
        : `随机聚焦 1 条，可点“显示全部”返回 ${state.filteredSentences.length} 条`;
  els.statVisible.textContent = String(visibleSentences.length);
  els.statFavorites.textContent = String(state.favorites.size);
}

function selectSentence(id, allowSpeech = false) {
  const shouldAutoSpeak = allowSpeech && els.autoPlay.checked;

  if (state.selectedId === id) {
    state.selectedId = null;
    renderList();
    renderEmptyDetail();
    return;
  }

  state.selectedId = id;
  const item = findSentence(id);
  if (!item) return;
  if (shouldAutoSpeak) {
    speak(item.thai);
  }
  renderList();
  renderDetail(item);
}

function renderDetail(item) {
  if (isInlineDetailMode()) {
    els.detailEmpty.classList.add("hidden");
    els.detailCard.classList.add("hidden");
    return;
  }

  els.detailEmpty.classList.add("hidden");
  els.detailCard.classList.remove("hidden");
  els.detailUsage.textContent = item.note || "当前没有额外备注。";
  els.favoriteBtn.textContent = state.favorites.has(item.id) ? "取消收藏" : "收藏";

  els.detailBreakdown.innerHTML = "";
  getVisibleBreakdownParts(item).forEach((part) => {
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
    els.showAllBtn.hidden = true;
    els.resultsHint.textContent = "没有匹配结果，可以换个关键词试试";
    els.statVisible.textContent = "0";
    return;
  }

  els.detailEmpty.classList.remove("hidden");
  els.detailCard.classList.add("hidden");
  els.showAllBtn.hidden = true;
  els.resultsHint.textContent = "没有匹配结果，可以换个关键词试试";
  els.statVisible.textContent = "0";
}

function getVisibleSentences() {
  if (state.focusedListId === null) {
    return state.filteredSentences;
  }

  const focused = state.filteredSentences.find((item) => item.id === state.focusedListId);
  return focused ? [focused] : state.filteredSentences;
}

function buildInlineDetail(item) {
  const detail = document.createElement("article");
  detail.className = "inline-detail-card";
  detail.innerHTML = `
    <div class="inline-detail-card__top">
      <div class="inline-detail-card__actions">
        <button class="ghost-button inline-speak-btn" type="button">朗读</button>
        <button class="favorite-button inline-favorite-btn" type="button">${
          state.favorites.has(item.id) ? "取消收藏" : "收藏"
        }</button>
      </div>
    </div>

    <section class="analysis-block">
      <h4>备注</h4>
      <p>${escapeHtml(item.note || "当前没有额外备注。")}</p>
    </section>

    <section class="analysis-block">
      <h4>拆词感知</h4>
      <div class="breakdown-list">${buildBreakdownMarkup(getVisibleBreakdownParts(item))}</div>
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

function getVisibleBreakdownParts(item) {
  return (item.analysis.wordBreakdown || []).filter(
    (part) => !["整句泰语", "礼貌尾词", "中文核心意思", "备注提醒"].includes(part.label),
  );
}

function compareByNewest(left, right) {
  return Number(right.id || 0) - Number(left.id || 0);
}

function buildTagsMarkup(tags) {
  return tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
}

function isInlineDetailMode() {
  return window.matchMedia(INLINE_DETAIL_BREAKPOINT).matches;
}

function updateBackToTopVisibility() {
  if (!els.backToTopBtn) return;

  const isMobile = window.matchMedia(MOBILE_BACK_TO_TOP_BREAKPOINT).matches;
  const shouldShow = isMobile && window.scrollY > BACK_TO_TOP_OFFSET;
  els.backToTopBtn.classList.toggle("hidden", !shouldShow);
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

  if (!state.voices.length) {
    populateVoiceOptions();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "th-TH";
  utterance.rate = 0.9;
  utterance.pitch = 1;

  const exactVoice = state.voices.find((voice) => voice.name === state.selectedVoice);
  const fallbackVoice = exactVoice || chooseBestVoice();
  if (fallbackVoice) {
    utterance.voice = fallbackVoice;
  }

  window.speechSynthesis.cancel();

  // Some mobile browsers need a short delay after cancel() or the next utterance is dropped.
  window.setTimeout(() => {
    window.speechSynthesis.speak(utterance);
    window.speechSynthesis.resume?.();
  }, 40);
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
