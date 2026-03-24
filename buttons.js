// buttons.js
export const mainKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: "💬 Диалоги" }, { text: "📅 Планы" }],
            [{ text: "💡 Идея" }, { text: "⚙️ Настройки" }]
        ],
        resize_keyboard: true
    }
};

// Инлайн-кнопки для выбора конкретного диалога
export function getDialogsMarkup(dialogs) {
    const buttons = dialogs.map(d => ([{ 
        text: `${d.active ? '✅ ' : ''}${d.name}`, 
        callback_data: `select_chat:${d.id}` 
    }]));
    
    buttons.push([{ text: "➕ Создать новый", callback_data: "new_chat" }]);
    
    return { reply_markup: { inline_keyboard: buttons } };
}
