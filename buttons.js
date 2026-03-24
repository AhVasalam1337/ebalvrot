// buttons.js
export const mainKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: "📅 Планы" }, { text: "🤡 Мемы" }],
            [{ text: "💬 Диалоги" }, { text: "⚙️ Настройки" }]
        ],
        resize_keyboard: true
    }
};

// Меню настроек
export const settingsMarkup = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "🗑 Удалить диалог", callback_data: "manage_delete" }],
            [{ text: "⬅️ Назад", callback_data: "close_settings" }]
        ]
    }
};

// Список диалогов для выбора (выбор чата)
export function getDialogsMarkup(dialogs) {
    const buttons = dialogs.map(d => ([{ 
        text: `${d.active ? '✅ ' : ''}${d.name}`, 
        callback_data: `select_chat:${d.id}` 
    }]));
    buttons.push([{ text: "➕ Создать новый", callback_data: "new_chat" }]);
    return { reply_markup: { inline_keyboard: buttons } };
}

// Список диалогов для УДАЛЕНИЯ
export function getDeleteMarkup(dialogs) {
    const buttons = dialogs.map(d => ([{ 
        text: `❌ ${d.name}`, 
        callback_data: `delete_confirm:${d.id}` 
    }]));
    buttons.push([{ text: "⬅️ Отмена", callback_data: "close_settings" }]);
    return { reply_markup: { inline_keyboard: buttons } };
}
