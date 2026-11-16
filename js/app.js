const STORAGE_KEY = "my-star-diary.entries.v1";

const moodButtons = Array.from(document.querySelectorAll(".mood-button"));
const saveButton = document.querySelector(".save-button");
const noteField = document.querySelector("#day-note");
const historyList = document.querySelector(".history-list");
const statValues = document.querySelectorAll(".stats .stat dd");
const noticeDialog = document.querySelector(".notice-dialog");
const noticeMessage = document.querySelector("#notice-message");
const noticeCloseButton = document.querySelector(".notice-close-button");

let selectedMood = null;
let entries;
let storageReady = false;

function showNotice(message) {
  noticeMessage.textContent = message;

  if (!noticeDialog.open) {
    noticeDialog.showModal();
  }
}

noticeCloseButton.addEventListener("click", () => {
  noticeDialog.close();
});

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);

  if (toDateKey(date) !== dateKey) {
    throw new Error(`Некорректная дата в сохранённой записи: ${dateKey}`);
  }

  return date;
}

function loadEntries() {
  const savedEntries = localStorage.getItem(STORAGE_KEY);

  if (savedEntries === null) {
    return [];
  }

  const parsedEntries = JSON.parse(savedEntries);

  if (!Array.isArray(parsedEntries)) {
    throw new Error("Сохранённые записи дневника имеют неверный формат.");
  }

  parsedEntries.forEach((entry) => {
    if (
      entry === null
      || typeof entry !== "object"
      || typeof entry.date !== "string"
      || typeof entry.mood !== "string"
      || typeof entry.emoji !== "string"
      || typeof entry.note !== "string"
    ) {
      throw new Error("Одна из сохранённых записей дневника повреждена.");
    }

    dateFromKey(entry.date);
  });

  return parsedEntries;
}

function getStreak(savedEntries) {
  const savedDates = new Set(savedEntries.map((entry) => entry.date));
  const today = toDateKey(new Date());
  const yesterdayDate = dateFromKey(today);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = toDateKey(yesterdayDate);
  let currentDate = savedDates.has(today) ? today : yesterday;

  if (!savedDates.has(currentDate)) {
    return 0;
  }

  let streak = 0;

  while (savedDates.has(currentDate)) {
    streak += 1;
    const previousDate = dateFromKey(currentDate);
    previousDate.setDate(previousDate.getDate() - 1);
    currentDate = toDateKey(previousDate);
  }

  return streak;
}

function renderStats() {
  const count = entries.length;
  const streak = getStreak(entries);
  statValues[0].textContent = String(count);
  statValues[1].replaceChildren(document.createTextNode(String(count)), document.createTextNode(" "));

  const star = document.createElement("span");
  star.setAttribute("aria-hidden", "true");
  star.textContent = "⭐";
  statValues[1].append(star);

  statValues[2].replaceChildren(document.createTextNode(String(streak)));
  const unit = document.createElement("span");
  unit.className = "stat-unit";
  unit.textContent = ` ${getDayLabel(streak)}`;
  statValues[2].append(unit);
}

function getDayLabel(count) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return "день";
  }

  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return "дня";
  }

  return "дней";
}

function renderHistory() {
  historyList.replaceChildren();

  if (entries.length === 0) {
    const emptyState = document.createElement("li");
    emptyState.className = "empty-state";
    emptyState.textContent = "Пока пусто — сохрани первый день!";
    historyList.append(emptyState);
    return;
  }

  entries.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "history-entry";

    const heading = document.createElement("div");
    heading.className = "history-entry-heading";

    const mood = document.createElement("h3");
    mood.textContent = `${entry.emoji} ${entry.mood}`;

    const date = document.createElement("time");
    date.dateTime = entry.date;
    date.textContent = dateFromKey(entry.date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const actions = document.createElement("div");
    actions.className = "history-entry-actions";

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-entry-button";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", `Удалить запись: ${entry.mood}`);
    deleteButton.textContent = "🗑️ Удалить";
    deleteButton.addEventListener("click", () => {
      const updatedEntries = entries.filter((_, entryIndex) => entryIndex !== index);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEntries));
      } catch (error) {
        console.error("Не удалось удалить запись дневника.", error);
        showNotice("Не получилось удалить запись. Проверь настройки хранилища браузера и попробуй ещё раз.");
        return;
      }

      entries = updatedEntries;
      render();
    });

    actions.append(date, deleteButton);
    heading.append(mood, actions);
    item.append(heading);

    if (entry.note) {
      const note = document.createElement("p");
      note.className = "history-note";
      note.textContent = entry.note;
      item.append(note);
    }

    historyList.append(item);
  });
}

function render() {
  renderStats();
  renderHistory();
}

moodButtons.forEach((button) => {
  button.addEventListener("click", () => {
    moodButtons.forEach((moodButton) => {
      const isSelected = moodButton === button;
      moodButton.classList.toggle("is-active", isSelected);
      moodButton.setAttribute("aria-pressed", String(isSelected));
    });

    const emoji = button.querySelector(".mood-emoji").textContent;
    const label = Array.from(button.children)
      .find((element) => !element.classList.contains("mood-emoji"))
      .textContent.trim();
    selectedMood = { emoji, label };
  });
});

saveButton.addEventListener("click", () => {
  if (!storageReady) {
    return;
  }

  if (selectedMood === null) {
    showNotice("Сначала выбери настроение 🙂");
    return;
  }

  const entry = {
    date: toDateKey(new Date()),
    mood: selectedMood.label,
    emoji: selectedMood.emoji,
    note: noteField.value.trim(),
  };
  const updatedEntries = [entry, ...entries];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEntries));
  } catch (error) {
    console.error("Не удалось сохранить запись дневника.", error);
    showNotice("Не получилось сохранить запись. Проверь настройки хранилища браузера и попробуй ещё раз.");
    return;
  }

  entries = updatedEntries;
  render();
});

try {
  entries = loadEntries();
  render();
  storageReady = true;
} catch (error) {
  console.error("Не удалось загрузить записи дневника.", error);
  showNotice("Не удалось загрузить дневник: данные в хранилище повреждены или недоступны.");
  saveButton.disabled = true;
  moodButtons.forEach((button) => {
    button.disabled = true;
  });
}