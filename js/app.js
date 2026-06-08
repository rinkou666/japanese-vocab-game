import { N5_SOURCE_WORDS } from "../data/n5.js";
import { N4_SOURCE_WORDS } from "../data/n4.js";
import { buildStages, normalizeWords } from "./stages.js";
import { createProgressStorage } from "./storage.js";

const TOTAL_TIME = 90;
const VISIBLE_ROWS = 6;
const WORDS_PER_STAGE = 20;
const STORAGE_KEY = "japanese-vocab-match-progress-v3";
const progressStorage = createProgressStorage(STORAGE_KEY);

const n5Stages = buildStages(normalizeWords(N5_SOURCE_WORDS), WORDS_PER_STAGE);
const n4Stages = buildStages(normalizeWords(N4_SOURCE_WORDS), WORDS_PER_STAGE, n5Stages.length + 1);
const stages = [...n5Stages, ...n4Stages];
const stageIndexById = new Map(stages.map((stage, index) => [stage.id, index]));

const screens = {
  map: document.querySelector("#mapScreen"),
  game: document.querySelector("#gameScreen"),
  profile: document.querySelector("#profileScreen")
};

const stageMap = document.querySelector("#stageMap");
const homeNavButton = document.querySelector("#homeNavButton");
const profileNavButton = document.querySelector("#profileNavButton");

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

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
  document.body.classList.toggle("game-active", name === "game");
  homeNavButton.classList.toggle("active", name === "map");
  profileNavButton.classList.toggle("active", name === "profile");
  if (name === "map") renderMap();
  if (name === "profile") renderProfile();
}

function renderMap() {
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
    const position = positionCycle[displayIndex % positionCycle.length];
    const step = document.createElement("div");
    step.className = `path-step level-${stage.level.toLowerCase()} position-${position}${unlocked ? "" : " locked"}`;
    step.dataset.stageId = stage.id;
    step.dataset.level = stage.level;
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

    if (stage.level === "N4" && stage.number === n5Stages.length + 1) {
      const badge = document.createElement("div");
      badge.className = "level-badge";
      badge.textContent = "N4";
      badge.setAttribute("aria-label", "N4阶段");
      step.appendChild(badge);
    }

    stageMap.appendChild(step);
  });

  drawMapCurves();
  requestAnimationFrame(drawMapCurves);
  requestAnimationFrame(scrollMapToBottom);
  setTimeout(() => {
    drawMapCurves();
    scrollMapToBottom();
  }, 80);
  setTimeout(scrollMapToBottom, 240);
}

function scrollMapToBottom() {
  screens.map.scrollTo({
    top: screens.map.scrollHeight,
    behavior: "auto"
  });
}

function isMapStageUnlocked(stage) {
  const index = stageIndexById.get(stage.id);
  if (index === 0) return true;
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
    path.setAttribute("stroke", upper.classList.contains("locked") ? "#d1d5db" : "#a8df84");
    svg.appendChild(path);
  }
}

function renderProfile() {
  todayClearedEl.textContent = progress.todayCleared;
  todayStarsEl.textContent = progress.todayStars;
  totalClearedEl.textContent = progress.totalCleared;
  totalStarsEl.textContent = progress.totalStars;
}

function getStageStars(stageId) {
  return progress.stages[stageId]?.stars || 0;
}

function isStageUnlocked(index) {
  if (index === 0) return true;
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
  const jpIds = [...jpColumn.querySelectorAll(".tile")].map((tile) => tile.dataset.id).sort();
  const cnIds = [...cnColumn.querySelectorAll(".tile")].map((tile) => tile.dataset.id).sort();
  if (jpIds.join("|") !== cnIds.join("|")) {
    throw new Error("左右词卡配对数据不一致");
  }
}

function createJapaneseTile(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tile";
  button.dataset.id = item.id;
  button.innerHTML = `<span class="word">${item.jp}</span><span class="kana">${item.kana}</span>`;
  button.addEventListener("click", () => selectTile(button, item, "jp"));
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
  if (seconds <= 40) return 3;
  if (seconds <= 60) return 2;
  return 1;
}

function getNextStage() {
  const index = stages.findIndex((stage) => stage.id === currentStage.id);
  return stages[index + 1] || null;
}

homeNavButton.addEventListener("click", () => showScreen("map"));
profileNavButton.addEventListener("click", () => showScreen("profile"));
backToMapButton.addEventListener("click", () => {
  clearInterval(timerId);
  showScreen("map");
});
againButton.addEventListener("click", () => {
  resultScreen.classList.remove("show");
  startGame();
});
resultMapButton.addEventListener("click", () => {
  resultScreen.classList.remove("show");
  showScreen("map");
});
nextButton.addEventListener("click", () => {
  const nextStage = getNextStage();
  if (!nextStage) return;
  resultScreen.classList.remove("show");
  startStage(nextStage);
});
window.addEventListener("resize", drawMapCurves);
window.addEventListener("load", scrollMapToBottom);

renderMap();
