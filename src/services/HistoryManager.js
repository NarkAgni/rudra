/*
 * Rudra GNOME Extension
 * Copyright (C) 2026 NarkAgni
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const HISTORY_KEY = 'search-history';
const AI_HISTORY_KEY = 'ai-chat-history';

let settings = null; 

export class HistoryManager {
    
    static init(s) {
        settings = s;
    }

    static record(item) {
        if (!settings) return;
        if (item.type !== 'app' && item.type !== 'web' && item.type !== 'command') return;
        
        let history = settings.get_strv(HISTORY_KEY) || [];
        let now = Date.now();
        
        let entry;
        if (item.type === 'app') {
            entry = `app:${item.id}:${item.name}`;
        } else if (item.type === 'web') {
            entry = `web:${item.url}:${item.name}`;
        } else if (item.type === 'command') {
            entry = `cmd:${item.command}`;
        }
        
        if (!entry) return;

        history = history.filter(e => !e.startsWith(entry.split(':')[0] + ':' + entry.split(':')[1]));
        history.unshift(entry + ':' + now);
        
        if (history.length > 50) history = history.slice(0, 50);
        
        settings.set_strv(HISTORY_KEY, history);
    }

    static getRecent(maxResults = 5) {
        if (!settings) return [];
        let history = settings.get_strv(HISTORY_KEY) || [];
        
        let results = history.map(entry => {
            let parts = entry.split(':');
            let type = parts[0];
            let id = parts[1];
            let name = parts[2];

            if (type === 'app') {
                return { id: id, type: 'app', name: name, description: 'Application', isRecent: true };
            } else if (type === 'web') {
                return { url: id, type: 'web', name: name, description: 'Website', isRecent: true };
            } else if (type === 'cmd') {
                return { command: id, type: 'command', name: id, description: 'Terminal Command', isRecent: true };
            }
            return null;
        }).filter(r => r !== null);
        
        return results.slice(0, maxResults);
    }

    static getAIChats(limit = 20, searchQuery = null) {
        if (!settings) return [];
        let history = settings.get_strv(AI_HISTORY_KEY) || [];
        
        let chats = history.map(entry => {
            try { return JSON.parse(entry); } catch (e) { return null; }
        }).filter(c => c !== null);
        
        if (searchQuery) {
            chats = chats.filter(chat => 
                chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                chat.messages.some(msg => msg.rawContent.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }
        
        chats.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return b.updated - a.updated;
        });
        
        return chats.slice(0, limit);
    }

    static saveAIChat(chatId, messages, title = "AI Chat", isPinned = false, providerId = null) {
        if (!settings) return;
        let history = settings.get_strv(AI_HISTORY_KEY) || [];
        let now = Date.now();
        
        let chats = history.map(entry => {
            try { return JSON.parse(entry); } catch (e) { return null; }
        }).filter(c => c !== null);
        
        let chat = chats.find(c => c.id === chatId);
        if (chat) {
            chat.messages = messages;
            chat.updated = now;
            chat.title = title;
            chat.isPinned = isPinned;
            if (providerId !== null) chat.provider = providerId;
        } else {
            chat = {
                id: chatId,
                messages: messages,
                created: now,
                updated: now,
                title: title,
                isPinned: isPinned,
                provider: providerId !== null ? providerId : settings.get_int('ai-provider')
            };
            chats.unshift(chat);
        }
        
        let updatedHistory = chats.map(c => JSON.stringify(c));
        settings.set_strv(AI_HISTORY_KEY, updatedHistory);
    }

    static saveAIChatProvider(chatId, providerId) {
        if (!settings) return;
        let history = settings.get_strv(AI_HISTORY_KEY) || [];
        
        let chats = history.map(entry => {
            try { return JSON.parse(entry); } catch (e) { return null; }
        }).filter(c => c !== null);
        
        let chat = chats.find(c => c.id === chatId);
        if (chat) {
            chat.provider = providerId;
            let updatedHistory = chats.map(c => JSON.stringify(c));
            settings.set_strv(AI_HISTORY_KEY, updatedHistory);
        }
    }

    static togglePinAIChat(chatId) {
        if (!settings) return;
        let history = settings.get_strv(AI_HISTORY_KEY) || [];
        
        let chats = history.map(entry => {
            try { return JSON.parse(entry); } catch (e) { return null; }
        }).filter(c => c !== null);
        
        let chat = chats.find(c => c.id === chatId);
        if (chat) {
            chat.isPinned = !chat.isPinned;
            chat.updated = Date.now();
            let updatedHistory = chats.map(c => JSON.stringify(c));
            settings.set_strv(AI_HISTORY_KEY, updatedHistory);
        }
    }

    static deleteAIChat(chatId) {
        if (!settings) return;
        let history = settings.get_strv(AI_HISTORY_KEY) || [];
        
        let chats = history.map(entry => {
            try { return JSON.parse(entry); } catch (e) { return null; }
        }).filter(c => c !== null);
        
        chats = chats.filter(c => c.id !== chatId);
        
        let updatedHistory = chats.map(c => JSON.stringify(c));
        settings.set_strv(AI_HISTORY_KEY, updatedHistory);
    }

    static clearHistory() {
        if (!settings) return;
        settings.set_strv(HISTORY_KEY, []);
        settings.set_strv(AI_HISTORY_KEY, []);
    }

    static getScore(id) {
        if (!settings) return 0;
        let recentApps = settings.get_strv(HISTORY_KEY) || [];
        return recentApps.filter(entry => entry.startsWith('app:' + id)).length;
    }

    static getItemScore(item) {
        let count = this.getScore(item.id);
        if (item.isSetting) return count + 10;
        return count;
    }
}