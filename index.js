// index.js
import { sendTg, sendTyping, editTg, getGeminiResponse, getDialogs, createNewChat, setActiveChat, deleteChat, getRulesRaw, setWaitingState, getWaitingState, renameChat, getRules, addRule, deleteRule, getActiveChat, setTrait, deleteTgMessage, clearChatPhysical } from './methods.js';
import { mainKeyboard, getDialogsMarkup, settingsMarkup, getDeleteMarkup, rulesControlMarkup, getRulesDeleteMarkup, getTraitsMarkup, getTraitLevelMarkup } from './buttons.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('OK');

    if (req.body.callback_query) {
        const { data, message } = req.body.callback_query;
        const chatId = message.chat.id;
        const msgId = message.message_id;

        if (data === 'new_chat') {
            await createNewChat(chatId);
            await deleteTgMessage(chatId, msgId);
            const aiText = await getGeminiResponse(chatId, "Привет");
            await sendTg(chatId, aiText, mainKeyboard);
        } 
        else if (data.startsWith('select_chat:')) {
            const oldChat = await getActiveChat(chatId);
            // Удаляем сообщения в старом чате (физически)
            const oldIdsKey = `msg_ids:${chatId}:${oldChat.id}`;
            // (Логика чистки экрана при переходе)
            await setActiveChat(chatId, data.split(':')[1]);
            const active = await getActiveChat(chatId);
            await deleteTgMessage(chatId, msgId);
            await sendTg(chatId, `Вы вошли в ${active.name} ✨`, mainKeyboard);
        }
        else if (data === 'clear_memory') {
            const status = await clearChatPhysical(chatId);
            await deleteTgMessage(chatId, msgId);
            await sendTg(chatId, status, mainKeyboard);
        }
        else if (data === 'manage_traits') {
            const active = await getActiveChat(chatId);
            await editTg(chatId, msgId, "🎭 Характер:", getTraitsMarkup(active.traits || {}));
        }
        else if (data.startsWith('trait_edit:')) {
            await editTg(chatId, msgId, `Уровень ${data.split(':')[1]}:`, getTraitLevelMarkup(data.split(':')[1]));
        }
        else if (data.startsWith('trait_set:')) {
            const [, name, level] = data.split(':');
            await setTrait(chatId, name, level);
            const active = await getActiveChat(chatId);
            await editTg(chatId, msgId, "🎭 Обновлено:", getTraitsMarkup(active.traits));
        }
        else if (data === 'get_context') {
            const report = await getRulesRaw(chatId);
            await sendTg(chatId, report, mainKeyboard);
        }
        else if (data === 'manage_rules') {
            const rules = await getRules(chatId);
            await editTg(chatId, msgId, `📜 Правила:\n\n${rules.map((r, i) => `${i+1}. ${r}`).join('\n')}`, rulesControlMarkup);
        }
        else if (data === 'rename_start') {
            await setWaitingState(chatId, 'await_rename');
            await editTg(chatId, msgId, "📝 Новое название:");
        }
        else if (data === 'manage_delete') {
            const dialogs = await getDialogs(chatId);
            await editTg(chatId, msgId, "🗑 Удалить чат:", getDeleteMarkup(dialogs));
        }
        else if (data.startsWith('delete_confirm:')) {
            await deleteChat(chatId, data.split(':')[1]);
            await editTg(chatId, msgId, "🗑 Удалено.");
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
        else if (data === 'close_settings') {
            await deleteTgMessage(chatId, msgId);
        }
        return res.status(200).send('OK');
    }

    const { message } = req.body;
    if (!message || !message.text) return res.status(200).send('OK');

    const chatId = message.chat.id;
    const text = message.text;

    // Трекаем сообщения юзера тоже (чтобы потом удалить)
    const active = await getActiveChat(chatId);
    const key = `msg_ids:${chatId}:${active.id}`;
    let ids = await kv.get(key) || [];
    ids.push(message.message_id);
    await kv.set(key, ids.slice(-50));

    const waitState = await getWaitingState(chatId);
    if (waitState === 'await_rename') {
        await renameChat(chatId, text);
        await setWaitingState(chatId, null);
        await deleteTgMessage(chatId, message.message_id);
        await sendTg(chatId, `✅ Название изменено.`, mainKeyboard);
        return res.status(200).send('OK');
    }
    if (waitState === 'await_rule') {
        await addRule(chatId, text);
        await setWaitingState(chatId, null);
        await deleteTgMessage(chatId, message.message_id);
        await sendTg(chatId, `📜 Правило добавлено.`, mainKeyboard);
        return res.status(200).send('OK');
    }

    try {
        if (text === '/start') { await sendTg(chatId, "Катя. ✨", mainKeyboard); } 
        else if (text === '💬 Диалоги') {
            const dialogs = await getDialogs(chatId);
            await sendTg(chatId, "Диалоги: 💬", getDialogsMarkup(dialogs));
        } 
        else if (text === '⚙️ Настройки') {
            await sendTg(chatId, "Настройки ⚙️:", settingsMarkup);
        }
        else {
            await sendTyping(chatId);
            const aiResponse = await getGeminiResponse(chatId, text);
            await sendTg(chatId, aiResponse, mainKeyboard);
        }
    } catch (e) { console.error(e); }
    return res.status(200).send('OK');
}
