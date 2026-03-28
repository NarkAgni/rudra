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

import Gio from 'gi://Gio';
import Shell from 'gi://Shell';

import { searchApps } from '../search/AppSearch.js';
import { searchFiles } from '../search/FileSearch.js';
import { searchIcons } from '../browsers/IconBrowser.js';
import { HistoryManager } from '../services/HistoryManager.js';
import { SnippetManager } from '../services/SnippetManager.js';
import { ClipboardManager } from '../services/ClipboardManager.js';
import { searchEmojis, loadEmojis } from '../browsers/EmojiBrowser.js';
import { runPluginSearch, getAllPlugins } from '../services/PluginManager.js';


export function initEmojis(extPath) {
    loadEmojis(extPath);
}

export function getTrigger(settings, key) {
    try {
        let t = settings.get_string(key) || '';
        return /^[a-zA-Z0-9]+$/.test(t) ? t + ' ' : t;
    } catch (e) {
        const fallbacks = {
            'trigger-ai': '? ',
            'trigger-clipboard': 'cb ',
            'trigger-plugin': 'p ',
            'trigger-icon': 'ic ',
            'trigger-emoji': 'em ',
            'trigger-google': 'g ',
            'trigger-youtube': 'yt ',
            'trigger-ddg': 'ddg ',
            'trigger-wiki': 'w ',
            'trigger-perplexity': 'px ',
            'trigger-cohere': 'co '
        };
        return fallbacks[key] || '';
    }
}

function _safeEval(expr) {
    const tokens = [];
    const tokenRegex = /(\d+\.?\d*|\.\d+|[+\-*\/^%()])/g;
    let match;
    let lastIndex = 0;
    while ((match = tokenRegex.exec(expr)) !== null) {
        if (match.index !== lastIndex) return null;
        tokens.push(match[1]);
        lastIndex = tokenRegex.lastIndex;
    }
    if (lastIndex !== expr.length) return null;

    let pos = 0;
    function peek() { return tokens[pos]; }
    function consume() { return tokens[pos++]; }
    function parseExpr() { return parseAddSub(); }
    function parseAddSub() {
        let left = parseMulDiv();
        if (left === null) return null;
        while (peek() === '+' || peek() === '-') {
            let op = consume();
            let right = parseMulDiv();
            if (right === null) return null;
            left = op === '+' ? left + right : left - right;
        }
        return left;
    }
    function parseMulDiv() {
        let left = parsePow();
        if (left === null) return null;
        while (peek() === '*' || peek() === '/' || peek() === '%') {
            let op = consume();
            let right = parsePow();
            if (right === null) return null;
            if (op === '*') left = left * right;
            else if (op === '/') { if (right === 0) return null; left = left / right; }
            else left = left % right;
        }
        return left;
    }
    function parsePow() {
        let base = parseUnary();
        if (base === null) return null;
        if (peek() === '^') { consume(); let exp = parsePow(); if (exp === null) return null; return Math.pow(base, exp); }
        return base;
    }
    function parseUnary() {
        if (peek() === '-') { consume(); let v = parseUnary(); return v === null ? null : -v; }
        if (peek() === '+') { consume(); return parseUnary(); }
        return parsePrimary();
    }
    function parsePrimary() {
        let t = peek();
        if (t === '(') {
            consume();
            let v = parseExpr();
            if (peek() !== ')') return null;
            consume();
            return v;
        }
        if (t !== undefined && /^(\d+\.?\d*|\.\d+)$/.test(t)) {
            consume();
            return parseFloat(t);
        }
        return null;
    }
    let result = parseExpr();
    if (pos !== tokens.length) return null;
    return result;
}

function _tryCalculate(query) {
    if (!/^[\d\s+\-*\/^%().]+$/.test(query)) return null;
    if (!/[+\-*\/^%]/.test(query)) return null;
    try {
        let expr = query.replace(/\s+/g, '').replace(/\^/g, '^');
        let result = _safeEval(expr);
        if (result === null || !Number.isFinite(result)) return null;
        return Math.round(result * 1e10) / 1e10;
    } catch (e) {
        return null;
    }
}

export function fetchResults(query, maxRes, settings, callback) {

    let tCb = getTrigger(settings, 'trigger-clipboard');
    let tIc = getTrigger(settings, 'trigger-icon');
    let tEm = getTrigger(settings, 'trigger-emoji');
    let tPl = getTrigger(settings, 'trigger-plugin');
    let tG = getTrigger(settings, 'trigger-google');
    let tYt = getTrigger(settings, 'trigger-youtube');
    let tDdg = getTrigger(settings, 'trigger-ddg');
    let tW = getTrigger(settings, 'trigger-wiki');
    let tPx = getTrigger(settings, 'trigger-perplexity'); 
    let tCo = getTrigger(settings, 'trigger-cohere');
    let tAi = getTrigger(settings, 'trigger-ai');

    let tSn = '!';
    let tFile = '.';
    let tCmd = '>';

    if (!query || query.trim() === '') {
        let recents = HistoryManager.getRecent(maxRes);
        let appSystem = Shell.AppSystem.get_default();

        let results = recents.map(r => {
            let icon;
            let finalName = r.name;
            let finalDesc = r.description;
            let appInfo = null;

            if (r.type === 'app') {
                    r.isSetting = r.id.includes('gnome-control-center') || 
                                  r.id.includes('panel') || 
                                  r.id.includes('org.gnome.settings');

                    let sysApp = appSystem.lookup_app(r.id);
                    if (sysApp) {
                        appInfo = sysApp.get_app_info();
                        icon = appInfo.get_icon();
                        if (!finalName) finalName = sysApp.get_name();
                        if (r.isSetting) finalDesc = appInfo.get_description() || ''; 
                    } else {
                        appInfo = Gio.DesktopAppInfo.new(r.id);
                        if (appInfo) {
                            icon = appInfo.get_icon();
                            if (!finalName) finalName = appInfo.get_name();
                            if (r.isSetting) finalDesc = appInfo.get_description() || '';
                        } else {
                            icon = new Gio.ThemedIcon({ name: 'application-x-executable' });
                            if (r.isSetting) finalDesc = '';
                        }
                    }
                } else if (r.type === 'web') {
                icon = new Gio.ThemedIcon({ name: 'web-browser-symbolic' });
            } else if (r.type === 'command') {
                icon = new Gio.ThemedIcon({ name: 'utilities-terminal-symbolic' });
            } else if (r.type === 'shortcut') {
                const shortcutIcons = {
                    'Ask AI': 'system-run-symbolic',
                    'Clipboard History': 'edit-paste-symbolic',
                    'Snippets': 'text-x-generic-symbolic',
                    'Plugins': 'application-x-executable-symbolic'
                };
                icon = new Gio.ThemedIcon({ name: shortcutIcons[r.name] || 'starred-symbolic' });
            } else {
                icon = new Gio.ThemedIcon({ name: 'text-x-generic' });
            }

            return {
                    ...r,
                    name: finalName || 'Recent Item',
                    description: (r.isSetting && finalDesc === '') ? '' : (finalDesc || 'Recently used'),
                    icon: icon,
                    appInfo: appInfo
                };
        });

        callback(results);
        return;
    }

    if (query.startsWith(tCb)) {
        let text = query.substring(tCb.length).trim();
        let clipMax = settings.get_int('clipboard-history-size');
        let results = ClipboardManager.search(text).slice(0, clipMax);
        callback(results);
        return;
    }

    let trimIc = getTrigger(settings, 'trigger-icon').trim();
    if (query === trimIc || query.startsWith(tIc)) {
        let text = query.startsWith(tIc) ? query.substring(tIc.length).trim() : '';
        let results = searchIcons(text);
        callback(results);
        return;
    }

    let trimEm = getTrigger(settings, 'trigger-emoji').trim();
    if (query === trimEm || query.startsWith(tEm)) {
        let text = query.startsWith(tEm) ? query.substring(tEm.length).trim() : '';
        let results = searchEmojis(text);
        callback(results);
        return;
    }

    if (query.startsWith(tSn)) {
        let results = SnippetManager.search(query, tSn).slice(0, maxRes);
        callback(results);
        return;
    }

    let trimPl = getTrigger(settings, 'trigger-plugin').trim();
    if (query === trimPl || query === tPl) {
        let plugins = getAllPlugins();
        let results = [
            {
                type: 'plugin-new',
                name: 'Create New Plugin',
                description: 'Write a new Python or Bash script',
                icon: new Gio.ThemedIcon({ name: 'document-new-symbolic' })
            },
            {
                type: 'plugin-help',
                name: 'Plugin Developer Guide',
                description: 'Learn how to write and format plugins',
                icon: new Gio.ThemedIcon({ name: 'system-help-symbolic' })
            }
        ];
        plugins.forEach(p => {
            results.push({
                type: 'plugin-edit',
                name: p,
                description: 'Edit this script • Click to open editor',
                icon: new Gio.ThemedIcon({ name: 'text-x-script' }),
                filename: p
            });
        });
        callback(results);
        return;
    }

    if (query.startsWith(tPl)) {
        let parts = query.substring(tPl.length).trim().split(' ');
        let scriptName = parts[0];
        let args = parts.slice(1).join(' ');

        if (scriptName) {
            runPluginSearch(scriptName, args, (pluginResults) => {
                callback(pluginResults.slice(0, maxRes));
            });
            return;
        }
    }

    let calcResult = _tryCalculate(query);
    if (calcResult !== null) {
        callback([{
            type: 'calc',
            name: String(calcResult),
            description: query.trim() + ' = ' + calcResult,
            icon: new Gio.ThemedIcon({ name: 'accessories-calculator-symbolic' }),
            result: String(calcResult)
        }]);
        return;
    }

    if (query.startsWith(tCmd)) {
        let commandText = query.substring(tCmd.length).trim();
        if (commandText) {
            callback([{
                type: 'command',
                name: 'Run Command',
                description: commandText,
                icon: new Gio.ThemedIcon({ name: 'utilities-terminal-symbolic' }),
                command: commandText
            }]);
        } else {
            callback([{
                type: 'info',
                name: 'Run Command...',
                description: 'Type a terminal command to execute',
                icon: new Gio.ThemedIcon({ name: 'utilities-terminal-symbolic' })
            }]);
        }
        return;
    }

    const domainRegex = /^(https?:\/\/)?(localhost|(\d{1,3}\.){3}\d{1,3}|([\da-z\-]+\.)+[a-z]{2,})(:\d{1,5})?(\/[^\s]*)?$/i;
    if (domainRegex.test(query) && !query.includes(' ')) {
        let url = query;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        callback([{
            type: 'web',
            name: 'Open Website',
            description: url,
            icon: new Gio.ThemedIcon({ name: 'web-browser-symbolic' }),
            url: url
        }]);
        return;
    }

    if (query.startsWith(tG)) {
        let searchText = query.substring(tG.length).trim();
        if (searchText) {
            callback([{
                type: 'web',
                name: 'Search Google',
                description: searchText,
                icon: new Gio.ThemedIcon({ names: ['goa-account-google', 'google', 'web-browser-symbolic'] }),
                url: 'https://www.google.com/search?q=' + encodeURIComponent(searchText)
            }]);
        } else {
            callback([{
                type: 'web',
                name: 'Search Google...',
                description: 'Type your query to search',
                icon: new Gio.ThemedIcon({ names: ['goa-account-google', 'google', 'web-browser-symbolic'] }),
                url: 'https://www.google.com/'
            }]);
        }
        return; 
    }

    if (query.startsWith(tDdg)) {
        let searchText = query.substring(tDdg.length).trim();
        if (searchText) {
            callback([{
                type: 'web',
                name: 'Search DuckDuckGo',
                description: searchText,
                icon: new Gio.ThemedIcon({ names: ['duckduckgo', 'web-browser-symbolic'] }),
                url: 'https://duckduckgo.com/?q=' + encodeURIComponent(searchText)
            }]);
        } else {
            callback([{
                type: 'web',
                name: 'Search DuckDuckGo...',
                description: 'Type your query to search',
                icon: new Gio.ThemedIcon({ names: ['duckduckgo', 'web-browser-symbolic'] }),
                url: 'https://duckduckgo.com/'
            }]);
        }
        return;
    }

    if (query.startsWith(tYt)) {
        let searchText = query.substring(tYt.length).trim();
        if (searchText) {
            callback([{
                type: 'web',
                name: 'Search YouTube',
                description: searchText,
                icon: new Gio.ThemedIcon({ names: ['youtube', 'brand-youtube', 'im-youtube', 'video-x-generic'] }),
                url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(searchText)
            }]);
        } else {
            callback([{
                type: 'web',
                name: 'Search YouTube...',
                description: 'Type your query to search',
                icon: new Gio.ThemedIcon({ names: ['youtube', 'brand-youtube', 'im-youtube', 'video-x-generic'] }),
                url: 'https://www.youtube.com/'
            }]);
        }
        return;
    }

    if (query.startsWith(tW)) {
        let searchText = query.substring(tW.length).trim();
        if (searchText) {
            callback([{
                type: 'web',
                name: 'Search Wikipedia',
                description: searchText,
                icon: new Gio.ThemedIcon({ names: ['wikipedia', 'web-browser-symbolic'] }),
                url: 'https://en.wikipedia.org/wiki/Special:Search?search=' + encodeURIComponent(searchText)
            }]);
        } else {
            callback([{
                type: 'web',
                name: 'Search Wikipedia...',
                description: 'Type your query to search',
                icon: new Gio.ThemedIcon({ names: ['wikipedia', 'web-browser-symbolic'] }),
                url: 'https://en.wikipedia.org/'
            }]);
        }
        return;
    }

    if (query.startsWith(tPx)) {
        let searchText = query.substring(tPx.length).trim();
        if (searchText) {
            callback([
                {
                    type: 'px-trigger',
                    name: 'Get Quick Answer',
                    description: 'Press Enter to ask Perplexity: "' + searchText + '"',
                    icon: new Gio.ThemedIcon({ name: 'system-run-symbolic' }),
                    searchText: searchText
                },
                {
                    type: 'web',
                    name: 'Search on Web',
                    description: 'Open Perplexity for: ' + searchText,
                    icon: new Gio.ThemedIcon({ name: 'web-browser-symbolic' }),
                    url: 'https://www.perplexity.ai/search?q=' + encodeURIComponent(searchText)
                }
            ]);
        } else {
            callback([{
                type: 'web',
                name: 'Ask Perplexity (Quick Answer)...',
                description: 'Type a query and press Enter (e.g. px 1 usd to inr)',
                icon: new Gio.ThemedIcon({ name: 'system-run-symbolic' }),
                url: 'https://www.perplexity.ai/'
            }]);
        }
        return;
    }

    if (query.startsWith(tCo)) {
        let searchText = query.substring(tCo.length).trim();
        if (searchText) {
            callback([
                {
                    type: 'co-trigger',
                    name: 'Get Quick Answer',
                    description: 'Press Enter to ask Cohere: "' + searchText + '"',
                    icon: new Gio.ThemedIcon({ name: 'system-run-symbolic' }),
                    searchText: searchText
                },
                {
                    type: 'web',
                    name: 'Search on Web',
                    description: 'Open DuckDuckGo for: ' + searchText,
                    icon: new Gio.ThemedIcon({ name: 'web-browser-symbolic' }),
                    url: 'https://duckduckgo.com/?q=' + encodeURIComponent(searchText)
                }
            ]);
        } else {
            callback([{
                type: 'web',
                name: 'Ask Cohere (Quick Web AI)...',
                description: 'Type a query and press Enter (e.g. co 1 usd to inr)',
                icon: new Gio.ThemedIcon({ name: 'system-run-symbolic' }),
                url: 'https://dashboard.cohere.com/'
            }]);
        }
        return;
    }

    if (query.startsWith(tFile)) {
        searchFiles(query, (fileResults) => {
            callback(fileResults.slice(0, maxRes));
        }, maxRes);
        return;
    }

    if (query.startsWith(tAi)) {
        let question = query.substring(tAi.length).trim();
        let results = [];

        if (question === '') {
            results.push({
                type: 'ai-new', name: 'New AI Chat',
                description: 'Start a fresh conversation with AI',
                icon: new Gio.ThemedIcon({ name: 'document-new-symbolic' })
            });
            results.push({
                type: 'ai-help', name: 'How to setup AI',
                description: 'Learn how to get a free API key for Gemini or Groq',
                icon: new Gio.ThemedIcon({ name: 'system-help-symbolic' })
            });
        } else {
            results.push({
                type: 'ai-ask', name: 'Ask AI',
                description: `Press Enter to ask: "${question}"`,
                icon: new Gio.ThemedIcon({ name: 'system-run-symbolic' }),
                question: question
            });
        }

        let pastChats = HistoryManager.getAIChats(15, question);
        pastChats.forEach(chat => {
            let lastMsg = chat.messages[chat.messages.length - 1];
            let desc = lastMsg.role === 'assistant' ? 'AI: ' + (lastMsg.rawContent || '') : 'You: ' + (lastMsg.rawContent || '');
            if (desc.length > 60) desc = desc.substring(0, 57) + '...';
            
            results.push({
                type: 'ai-chat-history',
                name: chat.title,
                description: desc.replace(/\n/g, ' '),
                icon: new Gio.ThemedIcon({ name: 'system-run-symbolic' }),
                chatData: chat,
                isPinned: chat.isPinned || false
            });
        });

        callback(results);
        return;
    }

    let appResults = searchApps(query, maxRes, settings);

    let queryLower = query.toLowerCase();
    if (queryLower.length > 1 && ('rudra settings'.includes(queryLower) || 'preferences'.includes(queryLower) || 'extension settings'.includes(queryLower))) {
        appResults.unshift({
            type: 'rudra-settings',
            name: 'Rudra Settings',
            description: 'Open Launcher Preferences / Extension Settings',
            icon: new Gio.ThemedIcon({ name: 'preferences-system-symbolic' }),
            isSetting: true
        });
    }
    
    callback(appResults);
}