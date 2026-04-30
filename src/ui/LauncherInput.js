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

import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

import { getTrigger } from '../core/QueryParser.js';
import { SnippetManager } from '../services/SnippetManager.js';


const DEFAULT_MOD_MASK = [
    'SHIFT_MASK', 'CONTROL_MASK', 'MOD1_MASK',
    'SUPER_MASK', 'HYPER_MASK', 'META_MASK'
].reduce((mask, mod) => mask | Clutter.ModifierType[mod], 0);

export function bindEntryEvents(ctx) {
    ctx._entry.clutter_text.connect('text-changed', () => {
        if (ctx._updatingEntry === true) return;
        if (ctx._searchTimeoutId) {
            GLib.source_remove(ctx._searchTimeoutId);
            ctx._searchTimeoutId = 0;
        }
        try {
            let [preedit] = ctx._entry.clutter_text.get_preedit_string();
            ctx._preeditActive = preedit && preedit.length > 0;

            if (ctx._preeditActive) {
                ctx._hintLabel.hide();
                return;
            }
        } catch (e) {
            ctx._preeditActive = false;
        }

        ctx._gridFocusMode = false;
        ctx._entry.remove_style_class_name('rudra-grid-focus');

        let text = ctx._entry.get_text();
        let lowerText = text.toLowerCase();

        let triggersExact = [
            getTrigger(ctx._settings, 'trigger-clipboard'),
            getTrigger(ctx._settings, 'trigger-icon'),
            getTrigger(ctx._settings, 'trigger-emoji'),
            getTrigger(ctx._settings, 'trigger-plugin'),
            getTrigger(ctx._settings, 'trigger-google'),
            getTrigger(ctx._settings, 'trigger-youtube'),
            getTrigger(ctx._settings, 'trigger-ddg'),
            getTrigger(ctx._settings, 'trigger-wiki'),
            getTrigger(ctx._settings, 'trigger-perplexity'),
            getTrigger(ctx._settings, 'trigger-cohere'),
            getTrigger(ctx._settings, 'trigger-ai')
        ];

        let matchedTrigger = triggersExact.find(t => t.toLowerCase() === lowerText);

        if (matchedTrigger && text !== matchedTrigger) {
            ctx._updatingEntry = true;
            ctx._entry.set_text(matchedTrigger);
            ctx._entry.clutter_text.set_cursor_position(-1);
            ctx._updatingEntry = false;
            text = matchedTrigger;
            lowerText = text.toLowerCase();
        }

        ctx._userTypedText = text;
        ctx._hintLabel.hide();
        ctx._suggestedSuffix = '';

        let isOtherPrefix = triggersExact.some(p => lowerText.startsWith(p.toLowerCase()));

        let tSn = '!';
        let tFile = '.';
        let tCmd = '>';

        if (lowerText.startsWith(tSn) || (ctx._currentFilter === 'snippets' && !isOtherPrefix)) {
            ctx._tagButton.show();
        } else {
            ctx._tagButton.hide();
            if (ctx._tagMenu) ctx._tagMenu.hide();
            SnippetManager.setTagFilter('All');
            if (ctx._tagLabel) ctx._tagLabel.set_text('All Tags');
        }

        let trimG = getTrigger(ctx._settings, 'trigger-google').trim().toLowerCase();
        let trimYt = getTrigger(ctx._settings, 'trigger-youtube').trim().toLowerCase();
        let trimDdg = getTrigger(ctx._settings, 'trigger-ddg').trim().toLowerCase();
        let trimW = getTrigger(ctx._settings, 'trigger-wiki').trim().toLowerCase();
        let trimPx = getTrigger(ctx._settings, 'trigger-perplexity').trim().toLowerCase();
        let trimCo = getTrigger(ctx._settings, 'trigger-cohere').trim().toLowerCase();
        let trimCb = getTrigger(ctx._settings, 'trigger-clipboard').trim().toLowerCase();
        let trimIc = getTrigger(ctx._settings, 'trigger-icon').trim().toLowerCase();
        let trimEm = getTrigger(ctx._settings, 'trigger-emoji').trim().toLowerCase();
        let trimPl = getTrigger(ctx._settings, 'trigger-plugin').trim().toLowerCase();

        let tG = getTrigger(ctx._settings, 'trigger-google');
        let tYt = getTrigger(ctx._settings, 'trigger-youtube');
        let tDdg = getTrigger(ctx._settings, 'trigger-ddg');
        let tW = getTrigger(ctx._settings, 'trigger-wiki');
        let tPx = getTrigger(ctx._settings, 'trigger-perplexity');
        let tCo = getTrigger(ctx._settings, 'trigger-cohere');
        let tCb = getTrigger(ctx._settings, 'trigger-clipboard');
        let tIc = getTrigger(ctx._settings, 'trigger-icon');
        let tEm = getTrigger(ctx._settings, 'trigger-emoji');
        let tPl = getTrigger(ctx._settings, 'trigger-plugin');

        if (text === tFile || text === '. ') ctx.showModeHint('Search Files/Folders...');
        else if (text === tCmd || text === '> ') ctx.showModeHint('Run Linux Command...');
        else if (lowerText === trimG || lowerText === tG.toLowerCase()) ctx.showModeHint('Search Google...');
        else if (lowerText === trimYt || lowerText === tYt.toLowerCase()) ctx.showModeHint('Search YouTube...');
        else if (lowerText === trimDdg || lowerText === tDdg.toLowerCase()) ctx.showModeHint('Search DuckDuckGo...');
        else if (lowerText === trimW || lowerText === tW.toLowerCase()) ctx.showModeHint('Search Wikipedia...');
        else if (lowerText === trimPx || lowerText === tPx.toLowerCase()) ctx.showModeHint('Search Perplexity...');
        else if (lowerText === trimCo || lowerText === tCo.toLowerCase()) ctx.showModeHint('Search Cohere...');
        else if (lowerText === trimCb || lowerText === tCb.toLowerCase()) ctx.showModeHint('Clipboard History...');
        else if (lowerText === trimIc || lowerText === tIc.toLowerCase()) ctx.showModeHint('Browse Icons...');
        else if (lowerText === trimEm || lowerText === tEm.toLowerCase()) ctx.showModeHint('Browse Emojis...');
        else if (lowerText.startsWith(tSn + 'add ')) ctx.showModeHint(tSn + 'add ' + tSn + 'trigger your text here');
        else if (lowerText.startsWith(tSn + 'del ')) ctx.showModeHint(tSn + 'del ' + tSn + 'trigger — delete snippet');
        else if (lowerText === trimPl || lowerText === tPl.toLowerCase()) ctx.showModeHint('Run Plugin...');
        else if (lowerText === tSn + 'new' || lowerText === tSn + 'new ') {
            if (ctx._resultsView) ctx._resultsView.showSnippetForm(null);
            return;
        }

        ctx._searchTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
            ctx._searchTimeoutId = 0;

            if (ctx._preeditActive) return GLib.SOURCE_REMOVE;

            let queryText = text;
            let tAi = getTrigger(ctx._settings, 'trigger-ai');

            if (ctx._currentFilter === 'icons' && !lowerText.startsWith(tIc.toLowerCase())) queryText = tIc + text;
            if (ctx._currentFilter === 'emojis' && !lowerText.startsWith(tEm.toLowerCase())) queryText = tEm + text;
            if (ctx._currentFilter === 'clipboard' && !lowerText.startsWith(tCb.toLowerCase())) queryText = tCb + text;
            if (ctx._currentFilter === 'snippets' && !lowerText.startsWith(tSn)) queryText = tSn + text;
            if (ctx._currentFilter === 'plugins' && !lowerText.startsWith(tPl.toLowerCase())) queryText = tPl + text;
            if (ctx._currentFilter === 'ai' && !lowerText.startsWith(tAi.toLowerCase())) queryText = tAi + (text ? text : '');

            if (ctx._resultsView) ctx._resultsView.update(queryText);
            return GLib.SOURCE_REMOVE;
        });
    });

    ctx._entry.clutter_text.connect('key-press-event', (actor, event) => {
        let keySymbol = event.get_key_symbol();

        let hasPreedit = false;
        try {
            let [preedit] = ctx._entry.clutter_text.get_preedit_string();
            hasPreedit = preedit && preedit.length > 0;
        } catch (e) { }

        if (ctx._resultsView && ctx._resultsView.isSnippetFormVisible) {
            if (keySymbol === Clutter.KEY_Escape) {
                if (ctx._headerBox) ctx._headerBox.show();
                ctx._resultsView._hideSnippetForm();
                ctx._restoreAfterSnippetForm();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        }

        let firstItem = ctx._resultsView && ctx._resultsView._resultsData && ctx._resultsView._resultsData[0];
        let isGrid = firstItem && (firstItem.type === 'emoji' || firstItem.type === 'icon-browser') && ctx._resultsView.viewMode !== 'list';

        if (keySymbol === Clutter.KEY_Return || keySymbol === Clutter.KEY_KP_Enter) {
            if (hasPreedit) {
                return Clutter.EVENT_PROPAGATE;
            }

            ctx._resultsView.activateSelected();
            return Clutter.EVENT_STOP;
        }

        if (isGrid) {
            let searchText = ctx._entry.get_text() || '';
            let trimEm = getTrigger(ctx._settings, 'trigger-emoji').trim().toLowerCase();
            let tEmLower = /^[a-zA-Z0-9]+$/.test(trimEm) ? trimEm.toLowerCase() + ' ' : trimEm.toLowerCase();
            let trimIc = getTrigger(ctx._settings, 'trigger-icon').trim().toLowerCase();
            let tIcLower = /^[a-zA-Z0-9]+$/.test(trimIc) ? trimIc.toLowerCase() + ' ' : trimIc.toLowerCase();

            let isEmpty = searchText.trim() === '' || searchText.toLowerCase() === tEmLower || searchText.toLowerCase() === tIcLower;

            if (keySymbol === Clutter.KEY_Tab || keySymbol === Clutter.KEY_ISO_Left_Tab) {
                ctx._gridFocusMode = !ctx._gridFocusMode;
                if (ctx._gridFocusMode) {
                    ctx._entry.add_style_class_name('rudra-grid-focus');
                } else {
                    ctx._entry.remove_style_class_name('rudra-grid-focus');
                }
                if (ctx._gridFocusMode && ctx._resultsView) {
                    ctx._resultsView._setSelected(0);
                } else if (!ctx._gridFocusMode && ctx._resultsView) {
                    let prev = ctx._resultsView._selectedIndex;
                    ctx._resultsView._selectedIndex = -1;
                    if (prev >= 0) {
                        try { ctx._resultsView._updateButtonColor(prev); } catch (e) { }
                    }
                }
                return Clutter.EVENT_STOP;
            }

            if (isEmpty || ctx._gridFocusMode) {
                if (keySymbol === Clutter.KEY_Down) { ctx._resultsView.selectNext(); return Clutter.EVENT_STOP; }
                if (keySymbol === Clutter.KEY_Up) { ctx._resultsView.selectPrev(); return Clutter.EVENT_STOP; }
                if (keySymbol === Clutter.KEY_Right) { ctx._resultsView.selectNextInRow(); return Clutter.EVENT_STOP; }
                if (keySymbol === Clutter.KEY_Left) { ctx._resultsView.selectPrevInRow(); return Clutter.EVENT_STOP; }
            }

            if (keySymbol === Clutter.KEY_Down) { ctx._resultsView.selectNext(); return Clutter.EVENT_STOP; }
            if (keySymbol === Clutter.KEY_Up) { ctx._resultsView.selectPrev(); return Clutter.EVENT_STOP; }

            return Clutter.EVENT_PROPAGATE;
        }

        if (keySymbol === Clutter.KEY_Down) { ctx._resultsView.selectNext(); return Clutter.EVENT_STOP; }
        if (keySymbol === Clutter.KEY_Up) { ctx._resultsView.selectPrev(); return Clutter.EVENT_STOP; }

        if (keySymbol === Clutter.KEY_Tab || keySymbol === Clutter.KEY_Right) {
            if (keySymbol === Clutter.KEY_Right) {
                let cursorPos = ctx._entry.clutter_text.get_cursor_position();
                let textLen = ctx._entry.get_text().length;
                if (cursorPos !== -1 && cursorPos < textLen) return Clutter.EVENT_PROPAGATE;
            }

            if (ctx._hintLabel.visible === true && ctx._suggestedSuffix !== '') {
                ctx._updatingEntry = true;
                let fullText = ctx._suggestedSuffix;
                ctx._entry.clutter_text.set_text('');
                ctx._entry.clutter_text.set_text(fullText);
                ctx._userTypedText = fullText;
                ctx._hintLabel.hide();
                ctx._suggestedSuffix = '';
                ctx._entry.clutter_text.set_cursor_position(fullText.length);
                ctx._updatingEntry = false;
                return Clutter.EVENT_STOP;
            }

            return Clutter.EVENT_PROPAGATE;
        }

        return Clutter.EVENT_PROPAGATE;
    });

    ctx._stageKeyId = ctx._container.connect('captured-event', (actor, event) => {
        if (ctx._isOpen === false) return Clutter.EVENT_PROPAGATE;
        if (event.type() !== Clutter.EventType.KEY_PRESS) return Clutter.EVENT_PROPAGATE;

        let keySymbol = event.get_key_symbol();

        let hasPreedit = false;
        try {
            let [preedit] = ctx._entry.clutter_text.get_preedit_string();
            hasPreedit = preedit && preedit.length > 0;
        } catch (e) { }

        if (hasPreedit) {
            return Clutter.EVENT_PROPAGATE;
        }
        
        console.log("hasPreedit",hasPreedit)

        let state = event.get_state() & DEFAULT_MOD_MASK;

        if (keySymbol === Clutter.KEY_Escape) {
            ctx.close();
            return Clutter.EVENT_STOP;
        }

        let isToggleShortcut = (ctx._toggleKeyval !== null) &&
            (keySymbol === ctx._toggleKeyval) && (state === ctx._toggleMods);
        if (isToggleShortcut) {
            ctx.close();
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    });
}