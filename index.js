// index.js
import { sendTg, sendTyping, editTg, getGeminiResponse, getDialogs, createNewChat, setActiveChat, deleteChat, getHistoryRaw, setWaitingState, getWaitingState, renameChat, getRules, addRule, deleteRule } from './methods.js';
import { mainKeyboard, getDialogsMarkup, settingsMarkup, getDeleteMarkup, rulesControlMarkup, getRulesDeleteMarkup } from './buttons.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('OK');

    if (req.body.callback_query) {
        const { data, message } = req.body.callback_query;
        const chatId = message.chat.id;
        const msgId = message.message_id;

        if (data === 'new_chat') {
            await createNewChat(chatId);
            await editTg(chatId, msgId, "💎");
            const aiText = await getGeminiResponse(chatId, "Привет");
            await sendTg(chatId, aiText, mainKeyboard);
        } 
        else if (data.startsWith('select_chat:')) {
            await setActiveChat(chatId, data.split(':')[1]);
            await editTg(chatId, msgId, "✅"); 
        }
        else if (data === 'rename_start') {
            await setWaitingState(chatId, 'await_rename');
            await editTg(chatId, msgId, "📝 Новое название чата:");
        }
        else if (data === 'manage_delete') {
            const dialogs = await getDialogs(chatId);
            await editTg(chatId, msgId, "🗑 Удалить:", getDeleteMarkup(dialogs));
        }
        else if (data.startsWith('delete_confirm:')) {
            await deleteChat(chatId, data.split(':')[1]);
            await editTg(chatId, msgId, "🗑 Готово.");
        }
        else if (data === 'manage_rules') {
            const rules = await getRules(chatId);
            await editTg(chatId, msgId, `📜 Правила ЭТОГО чата:\n\n${rules.map((r, i) => `${i+1}. ${r}`).join('\n')}`, rulesControlMarkup);
        }
        else if (data === 'rule_add_start') {
            await setWaitingState(chatId, 'await_rule');
            await editTg(chatId, msgId, "➕ Введи правило:");
        }
        else if (data === 'rule_manage_delete') {
            const rules = await getRules(chatId);
            await editTg(chatId, msgId, "🗑 Удалить правило:", getRulesDeleteMarkup(rules));
        }
        else if (data.startsWith('rule_delete_confirm:')) {
            await deleteRule(chatId, parseInt(data.split(':')[1]));
            const rules = await getRules(chatId);
            await editTg(chatId, msgId, `📜 Обновлено:\n\n${rules.map((r, i) => `${i+1}. ${r}`).join('\n')}`, rulesControlMarkup);
        }
        else if (data === 'get_context') {
            const report = await getHistoryRaw(chatId);
            await sendTg(chatId, report, mainKeyboard);
        }
        else if (data === 'close_settings') {
            await editTg(chatId, msgId, "☁️");
        }
        return res.status(200).send('OK');
    }

    const { message } = req.body;
    if (!message || !message.text) return res.status(200).send('OK');

    const chatId = message.chat.id;
    const text = message.text;

    const waitState = await getWaitingState(chatId);
    if (waitState === 'await_rename') {
        await renameChat(chatId, text);
        await setWaitingState(chatId, null);
        await sendTg(chatId, `✅ Название сохранено.`, mainKeyboard);
        return res.status(200).send('OK');
    }
    if (waitState === 'await_rule') {
        await addRule(chatId, text);
        await setWaitingState(chatId, null);
        await sendTg(chatId, `📜 Правило добавлено в этот чат.`, mainKeyboard);
        return res.status(200).send('OK');
    }

    try {
        if (text === '/start') {
            await sendTg(chatId, "Катя. ✨", mainKeyboard);
        } 
        else if (text === '💬 Диалоги') {
            const dialogs = await getDialogs(chatId);
            await sendTg(chatId, "Чат: 💬", getDialogsMarkup(dialogs));
        } 
        else if (text === '⚙️ Настройки') {
            await sendTg(chatId, "Настройки: ⚙️", settingsMarkup);
        }
        else {
            await sendTyping(chatId);
            const aiResponse = await getGeminiResponse(chatId, text);
            await sendTg(chatId, aiResponse, mainKeyboard);
        }
    } catch (e) {
        console.error(e);
    }
    return res.status(200).send('OK');
}
