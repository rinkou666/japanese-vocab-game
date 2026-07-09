import { N5_SOURCE_WORDS } from "../data/n5.js";
import { N4_SOURCE_WORDS } from "../data/n4.js";
import { N3_SOURCE_WORDS } from "../data/n3.js";
import { N2_SOURCE_WORDS } from "../data/n2.js";
import { N1_SOURCE_WORDS } from "../data/n1.js";
import { CHALLENGE_SOURCE_WORDS } from "../data/challenge.js";
import { buildStages, normalizeWords } from "./stages.js";
import { createProgressStorage } from "./storage.js";

const TOTAL_TIME = 100;
const VISIBLE_ROWS = 6;
const WORDS_PER_STAGE = 20;
const STORAGE_KEY = "japanese-vocab-match-progress-v6";
const LEGACY_STORAGE_KEYS = [
  "japanese-vocab-match-progress-v1",
  "japanese-vocab-match-progress-v2",
  "japanese-vocab-match-progress-v3",
  "japanese-vocab-match-progress-v4",
  "japanese-vocab-match-progress-v5"
];
LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
const progressStorage = createProgressStorage(STORAGE_KEY);

const n5Stages = buildStages(normalizeWords(N5_SOURCE_WORDS), WORDS_PER_STAGE);
const n4Stages = buildStages(normalizeWords(N4_SOURCE_WORDS), WORDS_PER_STAGE, n5Stages.length + 1);
const n3Stages = buildStages(
  normalizeWords(N3_SOURCE_WORDS),
  WORDS_PER_STAGE,
  n5Stages.length + n4Stages.length + 1
);
const n2Stages = buildStages(
  normalizeWords(N2_SOURCE_WORDS),
  WORDS_PER_STAGE,
  n5Stages.length + n4Stages.length + n3Stages.length + 1
);
const n1Stages = buildStages(
  normalizeWords(N1_SOURCE_WORDS),
  WORDS_PER_STAGE,
  n5Stages.length + n4Stages.length + n3Stages.length + n2Stages.length + 1
);
const challengeStages = buildStages(
  normalizeWords(CHALLENGE_SOURCE_WORDS),
  WORDS_PER_STAGE,
  n5Stages.length + n4Stages.length + n3Stages.length + n2Stages.length + n1Stages.length + 1
);
const stages = [...n5Stages, ...n4Stages, ...n3Stages, ...n2Stages, ...n1Stages, ...challengeStages];
const firstStageNumberByLevel = new Map([
  ["N5", n5Stages[0]?.number],
  ["N4", n4Stages[0]?.number],
  ["N3", n3Stages[0]?.number],
  ["N2", n2Stages[0]?.number],
  ["N1", n1Stages[0]?.number],
  ["CHALLENGE", challengeStages[0]?.number]
]);
const stageIndexById = new Map(stages.map((stage, index) => [stage.id, index]));

const screens = {
  home: document.querySelector("#homeScreen"),
  map: document.querySelector("#mapScreen"),
  game: document.querySelector("#gameScreen"),
  wordbook: document.querySelector("#wordbookScreen"),
  profile: document.querySelector("#profileScreen")
};

const stageMap = document.querySelector("#stageMap");
const homeNavButton = document.querySelector("#homeNavButton");
const mapNavButton = document.querySelector("#mapNavButton");
const wordbookNavButton = document.querySelector("#wordbookNavButton");
const profileNavButton = document.querySelector("#profileNavButton");
const levelButtons = document.querySelectorAll(".level-button");

const jpColumn = document.querySelector("#jpColumn");
const cnColumn = document.querySelector("#cnColumn");
const timerEl = document.querySelector("#timer");
const progressFill = document.querySelector("#progressFill");
const matchedCountEl = document.querySelector("#matchedCount");
const stageWordCountEl = document.querySelector("#stageWordCount");
const gameTitle = document.querySelector("#gameTitle");
const backToMapButton = document.querySelector("#backToMapButton");

const resultScreen = document.querySelector("#resultScreen");
const starsEl = document.querySelector("#stars");
const resultTitle = document.querySelector("#resultTitle");
const accuracyEl = document.querySelector("#accuracy");
const finishTimeEl = document.querySelector("#finishTime");
const finalScoreEl = document.querySelector("#finalScore");
const againButton = document.querySelector("#againButton");
const nextButton = document.querySelector("#nextButton");
const resultMapButton = document.querySelector("#resultMapButton");

const todayClearedEl = document.querySelector("#todayCleared");
const todayStarsEl = document.querySelector("#todayStars");
const totalClearedEl = document.querySelector("#totalCleared");
const totalStarsEl = document.querySelector("#totalStars");
const journeyClearedEl = document.querySelector("#journeyCleared");
const journeyTotalEl = document.querySelector("#journeyTotal");
const journeyFillEl = document.querySelector("#journeyFill");
const journeyMarkerEl = document.querySelector("#journeyMarker");
const journeyLevelsEl = document.querySelector("#journeyLevels");
const hiddenClearedEl = document.querySelector("#hiddenCleared");
const hiddenTotalEl = document.querySelector("#hiddenTotal");
const hiddenFillEl = document.querySelector("#hiddenFill");
const hiddenMarkerEl = document.querySelector("#hiddenMarker");
const favoriteCountEl = document.querySelector("#favoriteCount");
const startFlashButton = document.querySelector("#startFlashButton");
const wordbookList = document.querySelector("#wordbookList");
const flashScreen = document.querySelector("#flashScreen");
const flashProgressEl = document.querySelector("#flashProgress");
const flashCard = document.querySelector("#flashCard");
const flashLabelEl = document.querySelector("#flashLabel");
const flashMainEl = document.querySelector("#flashMain");
const flashSubEl = document.querySelector("#flashSub");
const exitFlashButton = document.querySelector("#exitFlashButton");
const prevFlashButton = document.querySelector("#prevFlashButton");
const nextFlashButton = document.querySelector("#nextFlashButton");

let progress = progressStorage.load();
let currentStage = stages[0];
let deck = [];
let visible = [];
let selectedJp = null;
let selectedCn = null;
let matched = 0;
let attempts = 0;
let correctAttempts = 0;
let remainingTime = TOTAL_TIME;
let startTime = 0;
let timerId = null;
let timerStarted = false;
let isResolving = false;
let finished = false;
let activeStartLevel = "N5";
let flashDeck = [];
let flashIndex = 0;
let flashRevealed = false;

function getLevelLabel(level) {
  return level === "CHALLENGE" ? "挑战" : level;
}

function showScreen(name, options = {}) {
  if (options.level) activeStartLevel = options.level;
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
  document.body.classList.toggle("game-active", name === "game");
  document.body.classList.toggle("map-active", name === "map");
  homeNavButton.classList.toggle("active", name === "home");
  mapNavButton.classList.toggle("active", name === "map");
  wordbookNavButton.classList.toggle("active", name === "wordbook");
  profileNavButton.classList.toggle("active", name === "profile");
  if (name === "map") renderMap(options);
  if (name === "wordbook") renderWordbook();
  if (name === "profile") renderProfile();
}

function renderMap(target = {}) {
  stageMap.innerHTML = "";
  const pathSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  pathSvg.classList.add("path-lines");
  pathSvg.setAttribute("aria-hidden", "true");
  stageMap.appendChild(pathSvg);

  const displayedStages = [...stages].reverse();
  const positionCycle = ["center", "right", "center", "left"];

  displayedStages.forEach((stage, displayIndex) => {
    const stars = getStageStars(stage.id);
    const unlocked = isMapStageUnlocked(stage);
    const completed = stars > 0;
    const position = positionCycle[displayIndex % positionCycle.length];
    const step = document.createElement("div");
    const statusClass = completed ? " completed" : unlocked ? " current" : " locked";
    step.className = `path-step level-${stage.level.toLowerCase()} position-${position}${statusClass}`;
    step.dataset.stageId = stage.id;
    step.dataset.level = stage.level;
    step.dataset.stageNumber = stage.number;
    const node = document.createElement("button");
    node.className = "stage-node";
    node.type = "button";
    node.disabled = !unlocked;
    node.setAttribute("aria-label", `${stage.title}，${unlocked ? "可挑战" : "未解锁"}`);
    node.innerHTML = `
      <span class="stage-number">${stage.number}</span>
      <span class="stage-stars" aria-hidden="true">
        ${[1, 2, 3].map((value) => `<span class="${value <= stars ? "earned" : ""}">★</span>`).join("")}
      </span>
    `;
    node.addEventListener("click", () => startStage(stage));
    step.appendChild(node);

    if (firstStageNumberByLevel.get(stage.level) === stage.number) {
      const badge = document.createElement("div");
      badge.className = "level-flag";
      badge.innerHTML = `<span>${getLevelLabel(stage.level)}</span><i class="flag-base" aria-hidden="true"></i>`;
      badge.setAttribute("aria-label", `${getLevelLabel(stage.level)}阶段`);
      step.appendChild(badge);
    }

    stageMap.appendChild(step);
  });

  const scrollToTarget = () => scrollMapToTarget(target);

  drawMapCurves();
  requestAnimationFrame(drawMapCurves);
  requestAnimationFrame(scrollToTarget);
  setTimeout(() => {
    drawMapCurves();
    scrollToTarget();
  }, 80);
  setTimeout(scrollToTarget, 240);
}

function scrollMapToTarget(target = {}) {
  if (!target.level && !target.stageNumber) {
    scrollMapToBottom();
    return;
  }

  const stageNumber = target.stageNumber || firstStageNumberByLevel.get(target.level);
  const step = stageMap.querySelector(`.path-step[data-stage-number="${stageNumber}"]`);
  if (!step) {
    scrollMapToBottom();
    return;
  }

  const screenRect = screens.map.getBoundingClientRect();
  const stepRect = step.getBoundingClientRect();
  const targetTop = screens.map.scrollTop + stepRect.top - screenRect.top - screenRect.height * 0.45;
  screens.map.scrollTo({
    top: Math.max(0, targetTop),
    behavior: "auto"
  });
}

function scrollMapToBottom() {
  screens.map.scrollTo({
    top: screens.map.scrollHeight,
    behavior: "auto"
  });
}

function isMapStageUnlocked(stage) {
  const index = stageIndexById.get(stage.id);
  const startNumber = firstStageNumberByLevel.get(activeStartLevel) || 1;
  const startIndex = stages.findIndex((item) => item.number === startNumber);
  if (index < startIndex) return false;
  if (index === startIndex) return true;
  return getStageStars(stages[index - 1].id) > 0;
}

function drawMapCurves() {
  const svg = stageMap.querySelector(".path-lines");
  const steps = [...stageMap.querySelectorAll(".path-step")];
  if (!svg || steps.length < 2) return;

  const mapRect = stageMap.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${mapRect.width} ${mapRect.height}`);
  svg.innerHTML = "";

  for (let index = 0; index < steps.length - 1; index += 1) {
    const upper = steps[index];
    const lower = steps[index + 1];
    const upperNode = upper.querySelector(".stage-node").getBoundingClientRect();
    const lowerNode = lower.querySelector(".stage-node").getBoundingClientRect();
    const x1 = upperNode.left + upperNode.width / 2 - mapRect.left;
    const y1 = upperNode.top + upperNode.height / 2 - mapRect.top;
    const x2 = lowerNode.left + lowerNode.width / 2 - mapRect.left;
    const y2 = lowerNode.top + lowerNode.height / 2 - mapRect.top;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const curveDirection = x2 >= x1 ? 1 : -1;
    const controlX = midX + curveDirection * 14;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("path-line");
    path.setAttribute("d", `M ${x1} ${y1} Q ${controlX} ${midY}, ${x2} ${y2}`);
    const stroke = upper.classList.contains("completed") ? "#ff9500" : "#d1d5db";
    path.setAttribute("stroke", stroke);
    svg.appendChild(path);
  }
}

function renderProfile() {
  todayClearedEl.textContent = progress.todayCleared;
  todayStarsEl.textContent = progress.todayStars;
  totalClearedEl.textContent = progress.totalCleared;
  totalStarsEl.textContent = progress.totalStars;
  renderJourneyProgress();
}

function renderJourneyProgress() {
  const totalStages = stages.length;
  const clearedStages = stages.filter((stage) => getStageStars(stage.id) > 0).length;
  const progressPercent = totalStages === 0 ? 0 : (clearedStages / totalStages) * 100;

  journeyClearedEl.textContent = clearedStages;
  journeyTotalEl.textContent = totalStages;
  journeyFillEl.style.width = `${progressPercent}%`;
  setMarkerPosition(journeyMarkerEl, progressPercent);

  const levelGroups = [
    { level: "N5", count: n5Stages.length },
    { level: "N4", count: n4Stages.length },
    { level: "N3", count: n3Stages.length },
    { level: "N2", count: n2Stages.length },
    { level: "N1", count: n1Stages.length },
    { level: "挑战", count: challengeStages.length }
  ];
  let completedBefore = 0;
  journeyLevelsEl.innerHTML = levelGroups.map(({ level, count }) => {
    const centerPercent = ((completedBefore + count / 2) / totalStages) * 100;
    completedBefore += count;
    return `<span style="left:${centerPercent}%">${level}</span>`;
  }).join("");

  const challengeCleared = challengeStages.filter((stage) => getStageStars(stage.id) > 0).length;
  const challengePercent = challengeStages.length === 0 ? 0 : (challengeCleared / challengeStages.length) * 100;
  hiddenClearedEl.textContent = challengeCleared;
  hiddenTotalEl.textContent = challengeStages.length;
  hiddenFillEl.style.width = `${challengePercent}%`;
  setMarkerPosition(hiddenMarkerEl, challengePercent);
}

function setMarkerPosition(element, percent) {
  if (percent <= 0) {
    element.style.left = "9px";
  } else if (percent >= 100) {
    element.style.left = "calc(100% - 9px)";
  } else {
    element.style.left = `${percent}%`;
  }
}

function getStageStars(stageId) {
  return progress.stages[stageId]?.stars || 0;
}

function getFavoriteWords() {
  return Object.values(progress.favorites || {})
    .sort((first, second) => (second.savedAt || 0) - (first.savedAt || 0));
}

function isFavorite(item) {
  return Boolean(progress.favorites?.[item.id]);
}

function toggleFavorite(item, button) {
  progress.favorites = progress.favorites || {};
  if (progress.favorites[item.id]) {
    delete progress.favorites[item.id];
    button?.classList.remove("favorited");
  } else {
    progress.favorites[item.id] = {
      id: item.id,
      jp: item.jp,
      kana: item.kana,
      cn: item.cn,
      level: currentStage.level,
      levelLabel: getLevelLabel(currentStage.level),
      stageNumber: currentStage.number,
      savedAt: Date.now()
    };
    button?.classList.add("favorited");
  }
  progressStorage.save(progress);
  button?.setAttribute("aria-pressed", String(isFavorite(item)));
}

function removeFavorite(id) {
  progress.favorites = progress.favorites || {};
  delete progress.favorites[id];
  progressStorage.save(progress);
  renderWordbook();
}

function renderWordbook() {
  const favorites = getFavoriteWords();
  favoriteCountEl.textContent = favorites.length;
  startFlashButton.disabled = favorites.length === 0;

  if (favorites.length === 0) {
    wordbookList.innerHTML = `
      <div class="empty-wordbook">
        <strong>还没有收藏单词</strong>
        <span>在闯关时长按左侧日语词卡，就可以加入单词本。</span>
      </div>
    `;
    return;
  }

  wordbookList.innerHTML = "";
  favorites.forEach((word) => {
    const card = document.createElement("article");
    card.className = "wordbook-card";
    card.innerHTML = `
      <div class="wordbook-word">
        <strong>${word.jp}</strong>
        <span>${word.kana || ""}</span>
      </div>
      <div class="wordbook-meaning">${word.cn}</div>
      <div class="wordbook-source">${word.levelLabel || getLevelLabel(word.level)} 第${word.stageNumber}关</div>
      <button class="favorite-remove" type="button" aria-label="取消收藏 ${word.jp}">★</button>
    `;
    card.querySelector(".favorite-remove").addEventListener("click", () => removeFavorite(word.id));
    wordbookList.appendChild(card);
  });
}

function isStageUnlocked(index) {
  const startNumber = firstStageNumberByLevel.get(activeStartLevel) || 1;
  const startIndex = stages.findIndex((stage) => stage.number === startNumber);
  if (index < startIndex) return false;
  if (index === startIndex) return true;
  return getStageStars(stages[index - 1].id) > 0;
}

function getRecommendedStage() {
  return stages.find((stage, index) => isStageUnlocked(index) && getStageStars(stage.id) === 0) || stages[stages.length - 1];
}

function startStage(stage) {
  currentStage = stage;
  resultScreen.classList.remove("show");
  showScreen("game");
  startGame();
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function startGame() {
  gameTitle.textContent = currentStage.title;
  stageWordCountEl.textContent = currentStage.words.length;
  deck = shuffle(currentStage.words);
  visible = [];
  selectedJp = null;
  selectedCn = null;
  matched = 0;
  attempts = 0;
  correctAttempts = 0;
  remainingTime = TOTAL_TIME;
  finished = false;
  isResolving = false;
  timerStarted = false;
  startTime = 0;
  fillVisible();
  renderBoard();
  updateHud();
  clearInterval(timerId);
  timerId = null;
}

function fillVisible() {
  while (visible.length < VISIBLE_ROWS && deck.length > 0) {
    visible.push(deck.shift());
  }
}

function renderBoard() {
  const jpItems = [...visible];
  const cnItems = shuffle(visible);
  jpColumn.innerHTML = "";
  cnColumn.innerHTML = "";
  for (let i = 0; i < visible.length; i += 1) {
    jpColumn.appendChild(createJapaneseTile(jpItems[i]));
    cnColumn.appendChild(createChineseTile(cnItems[i]));
  }
  validateRenderedPairs();
  matchedCountEl.textContent = matched;
}

function validateRenderedPairs() {
  const visibleIds = visible.map((item) => item.id).sort();
  const jpIds = [...jpColumn.querySelectorAll(".tile")].map((tile) => tile.dataset.id).sort();
  const cnIds = [...cnColumn.querySelectorAll(".tile")].map((tile) => tile.dataset.id).sort();
  const expected = visibleIds.join("|");
  if (jpIds.join("|") !== expected || cnIds.join("|") !== expected || jpIds.length !== cnIds.length) {
    throw new Error("左右词卡配对数据不一致");
  }
}

function createJapaneseTile(item) {
  const button = document.createElement("button");
  let longPressTimer = null;
  let longPressTriggered = false;
  button.type = "button";
  button.className = `tile${isFavorite(item) ? " favorited" : ""}`;
  button.dataset.id = item.id;
  button.setAttribute("aria-pressed", String(isFavorite(item)));
  button.innerHTML = `
    <span class="favorite-star" aria-hidden="true">★</span>
    <span class="word">${item.jp}</span>
    <span class="kana">${item.kana}</span>
  `;
  button.addEventListener("pointerdown", () => {
    longPressTriggered = false;
    longPressTimer = setTimeout(() => {
      longPressTriggered = true;
      toggleFavorite(item, button);
    }, 560);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
    button.addEventListener(eventName, () => clearTimeout(longPressTimer));
  });
  button.addEventListener("contextmenu", (event) => event.preventDefault());
  button.addEventListener("click", (event) => {
    if (longPressTriggered) {
      event.preventDefault();
      longPressTriggered = false;
      return;
    }
    selectTile(button, item, "jp");
  });
  return button;
}

function createChineseTile(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tile";
  button.dataset.id = item.id;
  button.innerHTML = `<span class="meaning">${item.cn}</span>`;
  button.addEventListener("click", () => selectTile(button, item, "cn"));
  return button;
}

function selectTile(button, item, side) {
  if (finished || isResolving || button.disabled) return;
  startTimer();

  const current = side === "jp" ? selectedJp : selectedCn;
  if (current?.button === button) {
    button.classList.remove("selected");
    if (side === "jp") selectedJp = null;
    if (side === "cn") selectedCn = null;
    return;
  }

  clearSideSelection(side);
  button.classList.add("selected");
  if (side === "jp") selectedJp = { button, item };
  if (side === "cn") selectedCn = { button, item };
  if (selectedJp && selectedCn) checkMatch();
}

function clearSideSelection(side) {
  const target = side === "jp" ? selectedJp : selectedCn;
  if (target) target.button.classList.remove("selected");
  if (side === "jp") selectedJp = null;
  if (side === "cn") selectedCn = null;
}

function checkMatch() {
  attempts += 1;
  isResolving = true;
  const jpSelection = selectedJp;
  const cnSelection = selectedCn;
  const isCorrect = jpSelection.item.id === cnSelection.item.id;

  if (isCorrect) {
    const matchedId = jpSelection.item.id;
    correctAttempts += 1;
    jpSelection.button.classList.add("correct");
    cnSelection.button.classList.add("correct");
    setTimeout(() => {
      visible = visible.filter((item) => item.id !== matchedId);
      matched += 1;
      selectedJp = null;
      selectedCn = null;
      fillVisible();
      renderBoard();
      updateHud();
      isResolving = false;
      if (matched === currentStage.words.length) endGame(true);
    }, 260);
  } else {
    jpSelection.button.classList.add("wrong");
    cnSelection.button.classList.add("wrong");
    setTimeout(() => {
      jpSelection.button.classList.remove("selected", "wrong");
      cnSelection.button.classList.remove("selected", "wrong");
      selectedJp = null;
      selectedCn = null;
      isResolving = false;
    }, 380);
  }
}

function startTimer() {
  if (timerStarted) return;
  timerStarted = true;
  startTime = Date.now();
  clearInterval(timerId);
  timerId = setInterval(tick, 250);
}

function tick() {
  const elapsed = (Date.now() - startTime) / 1000;
  remainingTime = Math.max(0, TOTAL_TIME - elapsed);
  updateHud();
  if (remainingTime <= 0) endGame(false);
}

function updateHud() {
  timerEl.textContent = `${Math.ceil(remainingTime)}s`;
  progressFill.style.width = `${(remainingTime / TOTAL_TIME) * 100}%`;
  matchedCountEl.textContent = matched;
}

function endGame(completed) {
  if (finished) return;
  finished = true;
  clearInterval(timerId);

  const elapsed = completed ? Math.min(TOTAL_TIME, (Date.now() - startTime) / 1000) : TOTAL_TIME;
  const accuracy = attempts === 0 ? 0 : Math.round((correctAttempts / attempts) * 100);
  const stars = completed ? getStars(elapsed) : 0;
  saveStageResult(stars, elapsed, accuracy);

  starsEl.textContent = stars > 0 ? "🌟".repeat(stars) : "再挑战一次";
  resultTitle.textContent = completed ? "太棒了！" : "时间到！";
  resultScreen.classList.toggle("completed", completed);
  resultScreen.classList.toggle("failed", !completed);
  accuracyEl.textContent = `${accuracy}%`;
  finishTimeEl.textContent = `${elapsed.toFixed(1)}s`;
  finalScoreEl.textContent = `${matched}/${currentStage.words.length}`;
  nextButton.disabled = !completed || !getNextStage();
  nextButton.textContent = getNextStage() ? "下一关" : "已到最后";
  resultScreen.classList.add("show");
}

function saveStageResult(stars, elapsed, accuracy) {
  const old = progress.stages[currentStage.id] || { stars: 0 };
  const bestStars = Math.max(old.stars || 0, stars);
  const gainedStars = bestStars - (old.stars || 0);
  const firstClear = (old.stars || 0) === 0 && stars > 0;

  progress.stages[currentStage.id] = {
    stars: bestStars,
    bestTime: old.bestTime ? Math.min(old.bestTime, elapsed) : elapsed,
    bestAccuracy: old.bestAccuracy ? Math.max(old.bestAccuracy, accuracy) : accuracy
  };

  if (firstClear) {
    progress.todayCleared += 1;
    progress.totalCleared += 1;
  }
  if (gainedStars > 0) {
    progress.todayStars += gainedStars;
    progress.totalStars += gainedStars;
  }
  progressStorage.save(progress);
}

function getStars(seconds) {
  if (seconds <= 50) return 3;
  if (seconds <= 70) return 2;
  return 1;
}

function getNextStage() {
  const index = stages.findIndex((stage) => stage.id === currentStage.id);
  return stages[index + 1] || null;
}

function startFlashReview() {
  flashDeck = getFavoriteWords();
  if (flashDeck.length === 0) return;
  flashIndex = 0;
  flashRevealed = false;
  renderFlashCard();
  flashScreen.classList.add("show");
}

function renderFlashCard() {
  const word = flashDeck[flashIndex];
  if (!word) return;
  flashProgressEl.textContent = `${flashIndex + 1} / ${flashDeck.length}`;
  flashCard.classList.toggle("revealed", flashRevealed);
  flashLabelEl.textContent = flashRevealed ? "中文" : "日语";
  flashMainEl.textContent = flashRevealed ? word.cn : word.jp;
  flashSubEl.textContent = flashRevealed
    ? `${word.levelLabel || getLevelLabel(word.level)} 第${word.stageNumber}关`
    : (word.kana || "");
  prevFlashButton.disabled = flashDeck.length <= 1;
  nextFlashButton.textContent = flashIndex === flashDeck.length - 1 ? "回到第一张" : "下一张";
}

function moveFlash(step) {
  if (flashDeck.length === 0) return;
  flashIndex = (flashIndex + step + flashDeck.length) % flashDeck.length;
  flashRevealed = false;
  renderFlashCard();
}

homeNavButton.addEventListener("click", () => showScreen("home"));
mapNavButton.addEventListener("click", () => showScreen("map"));
wordbookNavButton.addEventListener("click", () => showScreen("wordbook"));
profileNavButton.addEventListener("click", () => showScreen("profile"));
levelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showScreen("map", { level: button.dataset.level });
  });
});
backToMapButton.addEventListener("click", () => {
  clearInterval(timerId);
  showScreen("map", { level: currentStage.level, stageNumber: currentStage.number });
});
againButton.addEventListener("click", () => {
  resultScreen.classList.remove("show");
  startGame();
});
resultMapButton.addEventListener("click", () => {
  resultScreen.classList.remove("show");
  showScreen("map", { level: currentStage.level, stageNumber: currentStage.number });
});
nextButton.addEventListener("click", () => {
  const nextStage = getNextStage();
  if (!nextStage) return;
  resultScreen.classList.remove("show");
  startStage(nextStage);
});
startFlashButton.addEventListener("click", startFlashReview);
flashCard.addEventListener("click", () => {
  flashRevealed = !flashRevealed;
  renderFlashCard();
});
exitFlashButton.addEventListener("click", () => flashScreen.classList.remove("show"));
prevFlashButton.addEventListener("click", () => moveFlash(-1));
nextFlashButton.addEventListener("click", () => moveFlash(1));
window.addEventListener("resize", drawMapCurves);
window.addEventListener("load", () => {
  if (screens.map.classList.contains("active")) scrollMapToBottom();
});
