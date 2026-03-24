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

export const settingsMarkup = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "📑 Положняк", callback_data: "get_context" }],
            [{ text: "🗑 Удалить диалог", callback_data: "manage_delete" }],
            [{ text: "⬅️ Назад", callback_data: "close_settings" }]
        ]
    }
};

export function getDialogsMarkup(dialogs) {
    const buttons = dialogs.map(d => ([{ 
        text: `${d.active ? '· ' : ''}${d.name}`, 
        callback_data: `select_chat:${d.id}` 
    }]));
    buttons.push([{ text: "+", callback_data: "new_chat" }]);
    return { reply_markup: { inline_keyboard: buttons } };
}

export function getDeleteMarkup(dialogs) {
    const buttons = dialogs.map(d => ([{ 
        text: `❌ ${d.name}`, 
        callback_data: `delete_confirm:${d.id}` 
    }]));
    buttons.push([{ text: "⬅️", callback_data: "close_settings" }]);
    return { reply_markup: { inline_keyboard: buttons } };
}
