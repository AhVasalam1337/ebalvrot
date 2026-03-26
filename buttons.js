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
            [{ text: "📜 Правила", callback_data: "manage_rules" }, { text: "🎭 Характер", callback_data: "manage_traits" }],
            [{ text: "✏️ Название", callback_data: "rename_start" }, { text: "🗑 Удалить", callback_data: "manage_delete" }],
            [{ text: "⬅️ Назад", callback_data: "close_settings" }]
        ]
    }
};

export function getTraitsMarkup(traits) {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: `📏 Лаконичность: ${traits.brevity || 5}`, callback_data: "trait_edit:brevity" }],
                [{ text: `❤️ Эмпатия: ${traits.empathy || 5}`, callback_data: "trait_edit:empathy" }],
                [{ text: `👤 Человечность: ${traits.humanity || 5}`, callback_data: "trait_edit:humanity" }],
                [{ text: "⬅️ Назад", callback_data: "close_settings" }]
            ]
        }
    };
}

export function getTraitLevelMarkup(traitName) {
    const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const buttons = [];
    for (let i = 0; i < levels.length; i += 5) {
        buttons.push(levels.slice(i, i + 5).map(l => ({ 
            text: `${l}`, 
            callback_data: `trait_set:${traitName}:${l}` 
        })));
    }
    buttons.push([{ text: "⬅️ Отмена", callback_data: "manage_traits" }]);
    return { reply_markup: { inline_keyboard: buttons } };
}

export const rulesControlMarkup = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "➕ Добавить", callback_data: "rule_add_start" }, { text: "➖ Удалить", callback_data: "rule_manage_delete" }],
            [{ text: "⬅️ Назад", callback_data: "close_settings" }]
        ]
    }
};

export function getRulesDeleteMarkup(rules) {
    const buttons = rules.map((r, index) => ([{ 
        text: `🗑 ${r.substring(0, 20)}...`, 
        callback_data: `rule_delete_confirm:${index}` 
    }]));
    buttons.push([{ text: "⬅️", callback_data: "manage_rules" }]);
    return { reply_markup: { inline_keyboard: buttons } };
}

export function getDialogsMarkup(dialogs) {
    const buttons = dialogs.map(d => ([{ 
        text: `${d.active ? '✨ ' : ''}${d.name}`, 
        callback_data: `select_chat:${d.id}` 
    }]));
    buttons.push([{ text: "➕ Новый", callback_data: "new_chat" }]);
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
