export function createProgressStorage(storageKey) {
  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function createDefaultProgress() {
    return {
      date: todayKey(),
      todayCleared: 0,
      todayStars: 0,
      totalCleared: 0,
      totalStars: 0,
      stages: {},
      favorites: {}
    };
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved) return createDefaultProgress();
      if (saved.date !== todayKey()) {
        saved.date = todayKey();
        saved.todayCleared = 0;
        saved.todayStars = 0;
      }
      return {
        ...createDefaultProgress(),
        ...saved,
        stages: saved.stages || {},
        favorites: saved.favorites || {}
      };
    } catch {
      return createDefaultProgress();
    }
  }

  function save(progress) {
    localStorage.setItem(storageKey, JSON.stringify(progress));
  }

  return { load, save };
}
