// buttons.js

// Главное меню
export const mainKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: "💬 Диалоги" }, { text: "⚙️ Настройки" }],
            [{ text: "📅 Планы" }, { text: "🤡 Мемы" }]
        ],
        resize_keyboard: true
    }
};

// Меню настроек (внизу)
export const settingsKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: "📑 Положняк" }, { text: "🎭 Характер" }],
            [{ text: "📜 Правила" }, { text: "✏️ Название" }],
            [{ text: "🧹 Снести всё" }, { text: "🗑 Удалить чат" }],
            [{ text: "⬅️ Назад" }]
        ],
        resize_keyboard: true
    }
};

// Меню выбора черты характера
export const traitsKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: "📏 Изменить Лаконичность" }],
            [{ text: "❤️ Изменить Эмпатию" }],
            [{ text: "👤 Изменить Человечность" }],
            [{ text: "⚙️ В настройки" }]
        ],
        resize_keyboard: true
    }
};

// Меню управления правилами
export const rulesKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: "➕ Добавить правило" }, { text: "➖ Удалить правило" }],
            [{ text: "⚙️ В настройки" }]
        ],
        resize_keyboard: true
    }
};

// Кнопки 1-10 для уровней
export function getLevelKeyboard() {
    return {
        reply_markup: {
            keyboard: [
                [{ text: "1" }, { text: "2" }, { text: "3" }, { text: "4" }, { text: "5" }],
                [{ text: "6" }, { text: "7" }, { text: "8" }, { text: "9" }, { text: "10" }],
                [{ text: "🎭 Назад к характеру" }]
            ],
            resize_keyboard: true
        }
    };
}
