export function normalizeWords(sourceWords) {
  return sourceWords.map(([level, jp, kana, cn], index) => ({
    id: `${level}-${String(index + 1).padStart(3, "0")}`,
    level: level.toUpperCase(),
    jp,
    kana,
    cn
  }));
}

export function buildStages(words, wordsPerStage, startNumber = 1) {
  const stages = [];
  const level = words[0]?.level || "";
  const levelKey = level.toLowerCase();

  for (let index = 0; index < words.length; index += wordsPerStage) {
    const number = Math.floor(index / wordsPerStage) + startNumber;
    stages.push({
      id: `${levelKey}-stage-${number}`,
      level,
      number,
      title: `${level} 第${number}关`,
      words: words.slice(index, index + wordsPerStage)
    });
  }

  return stages;
}
