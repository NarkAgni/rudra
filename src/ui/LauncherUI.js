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

import St from 'gi://St';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { SearchResults } from './SearchResults.js';
import { bindEntryEvents } from './LauncherInput.js';
import { setCategory } from '../browsers/EmojiBrowser.js';
import { setIconCategory } from '../browsers/IconBrowser.js';
import { SnippetManager } from '../services/SnippetManager.js';
import { HistoryManager } from '../services/HistoryManager.js';
import { initEmojis, getTrigger } from '../core/QueryParser.js';
import { applyTheme, positionLauncherBox } from './ThemeManager.js';
import { setupFilterMenu, setupCategoryMenu, setupTagMenu, setupViewToggle } from './LauncherMenus.js';


export class LauncherUI {

    constructor(settings, openPrefsCallback, uuid, extPath) {
        this._settings = settings;
        this._openPrefsCallback = openPrefsCallback;
        this._uuid = uuid;
        this._extPath = extPath;

        initEmojis(this._extPath);
        HistoryManager.init(this._settings);

        this._isOpen = false;
        this._isPreviewMode = false;

        this._userTypedText = '';
        this._updatingEntry = false;
        this._suggestedSuffix = '';

        this._autocompleteIdleId = 0;
        this._focusTimeoutId = 0;
        this._searchTimeoutId = 0;
        this._previewTimeoutId = 0;

        this._buildUI();

        const safeSettings = {
            get_string: (k) => { try { return this._settings.get_string(k); } catch(e) { return ''; } },
            get_int: (k) => { try { return this._settings.get_int(k); } catch(e) { return 0; } },
            get_double: (k) => { try { return this._settings.get_double(k); } catch(e) { return 0.0; } },
            get_boolean: (k) => { try { return this._settings.get_boolean(k); } catch(e) { return false; } }
        };

        applyTheme(safeSettings, {
            mainBox: this._mainBox,
            tintBg: this._tintBg,
            contentBox: this._contentBox,
            entry: this._entry,
            hintLabel: this._hintLabel,
            resultsView: this._resultsView
        });
        this._syncHintFont();

        this._overviewShowingId = Main.overview.connect('showing', () => {
            if (this._isOpen === true) this.close();
        });

        this._settingsSignal = this._settings.connect('changed', (settings, key) => {
            const visualKeys = [
                'font-name', 'launcher-width', 'corner-radius'
            ];

            if (!visualKeys.includes(key) && key) return;

            let newWidth = 660;
            try { newWidth = this._settings.get_int('launcher-width'); } catch(e) {}
            
            if (this._contentBox) this._contentBox.set_width(newWidth);
            if (this._mainBox) this._mainBox.set_width(newWidth);

            applyTheme(safeSettings, {
                mainBox: this._mainBox,
                tintBg: this._tintBg,
                contentBox: this._contentBox,
                entry: this._entry,
                hintLabel: this._hintLabel,
                resultsView: this._resultsView
            });

            if (this._resultsView) {
                this._resultsView.updateHighlightColor();
                this._resultsView.refreshSelectionColor();

                if (!this._isOpen) {
                    this.open(true);
                } else {
                    this._isPreviewMode = true;
                    this._container.reactive = false;
                    global.stage.set_key_focus(null);
                    positionLauncherBox(this._mainBox, this._settings);
                    if (this._previewTimeoutId) {
                        GLib.source_remove(this._previewTimeoutId);
                    }
                    this._previewTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 4000, () => {
                        this._previewTimeoutId = 0;
                        if (this._isOpen && this._isPreviewMode) this.close();
                        return GLib.SOURCE_REMOVE;
                    });
                }
            }
        });

        this._updateToggleShortcut();
        this._shortcutSignal = this._settings.connect('changed::toggle-launcher', () => this._updateToggleShortcut());
    }

    _parseAccelerator(accelerator) {
        let mods = 0;
        let keyName = accelerator;
        const modifierMap = {
            '<Super>': Clutter.ModifierType.SUPER_MASK,
            '<Ctrl>': Clutter.ModifierType.CONTROL_MASK,
            '<Control>': Clutter.ModifierType.CONTROL_MASK,
            '<Primary>': Clutter.ModifierType.CONTROL_MASK,
            '<Alt>': Clutter.ModifierType.MOD1_MASK,
            '<Shift>': Clutter.ModifierType.SHIFT_MASK
        };
        for (const [modStr, modValue] of Object.entries(modifierMap)) {
            if (keyName.includes(modStr)) {
                mods |= modValue;
                keyName = keyName.replace(modStr, '');
            }
        }

        let keyval = Clutter[`KEY_${keyName}`];
        if (keyval === undefined || keyval === Clutter.KEY_VoidSymbol) {
            const lowerName = keyName.toLowerCase();
            if (lowerName === 'space') keyval = Clutter.KEY_space;
            else if (lowerName === 'return' || lowerName === 'enter') keyval = Clutter.KEY_Return;
            else if (keyName.length === 1) keyval = keyName.charCodeAt(0);
            else keyval = 0;
        }

        return [keyval, mods];
    }

    _updateToggleShortcut() {
        let accelerator = '';
        try { accelerator = this._settings.get_strv('toggle-launcher')[0] || ''; } catch(e){}
        if (!accelerator) {
            this._toggleKeyval = null;
            this._toggleMods = null;
            return;
        }
        let [keyval, mods] = this._parseAccelerator(accelerator);
        this._toggleKeyval = keyval;
        this._toggleMods = mods;
    }

    _restoreAfterSnippetForm() {
        if (this._headerBox) this._headerBox.show();
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (this._isOpen) global.stage.set_key_focus(this._entry);
            return GLib.SOURCE_REMOVE;
        });
    }

    _syncHintFont() {
        if (!this._hintLabel || !this._entry) return;
        try {
            let fontStr = this._settings.get_string('font-name') || 'Cantarell 14';
            let match = fontStr.match(/ (\d+(?:\.\d+)?)$/);
            let fontSize = match ? parseFloat(match[1]) : 14;
            let fontFamily = fontStr.replace(/ \d+(?:\.\d+)?$/, '');
            let fontStyle = `font-family: "${fontFamily}"; font-size: ${fontSize}pt;`;
            this._hintLabel.set_style(`${fontStyle} padding-left: 12px; background: transparent; color: rgba(255, 255, 255, 0.4); box-shadow: none;`);
            this._entry.set_style(`${fontStyle} background: transparent; box-shadow: none; border: none;`);
        } catch (e) { }
    }

    _buildUI() {
        this._container = new St.Widget({
            visible: false,
            reactive: true,
            layout_manager: new Clutter.BinLayout(),
            style_class: 'launcher-overlay',
            y_align: Clutter.ActorAlign.FILL,
            x_align: Clutter.ActorAlign.FILL
        });
        this._container.add_constraint(new Clutter.BindConstraint({
            source: global.stage,
            coordinate: Clutter.BindCoordinate.ALL
        }));

        const _isInsideBox = (x, y) => {
            if (!this._mainBox) return false;
            let [boxX, boxY] = this._mainBox.get_transformed_position();
            let [bw, bh] = this._mainBox.get_size();
            return (x >= boxX && x <= boxX + bw && y >= boxY && y <= boxY + bh);
        };

        this._container.connect('scroll-event', (actor, event) => {
            if (!this._isOpen || this._isPreviewMode) return Clutter.EVENT_PROPAGATE;
            if (this._resultsView && this._resultsView.isSnippetFormVisible) return Clutter.EVENT_PROPAGATE;
            if (this._resultsView && this._resultsView.isPluginGuideVisible) return Clutter.EVENT_PROPAGATE;

            let [x, y] = event.get_coords();
            if (!_isInsideBox(x, y)) return Clutter.EVENT_PROPAGATE;

            let scrollView = this._resultsView && this._resultsView.widget;
            if (scrollView && scrollView.visible) {
                let direction = event.get_scroll_direction();
                let adj = scrollView.get_vadjustment ? scrollView.get_vadjustment() : scrollView.vadjustment;
                if (adj) {
                    let step = 60;
                    if (direction === Clutter.ScrollDirection.UP)
                        adj.set_value(Math.max(adj.lower, adj.value - step));
                    else if (direction === Clutter.ScrollDirection.DOWN)
                        adj.set_value(Math.min(adj.upper - adj.page_size, adj.value + step));
                }
                return Clutter.EVENT_STOP;
            }
        });

        this._container.connect('button-press-event', (actor, event) => {
            if (!this._isOpen || this._isPreviewMode) return Clutter.EVENT_PROPAGATE;
            let [x, y] = event.get_coords();

            const hideMenuIfOutside = (menu, btn) => {
                if (!menu || !menu.visible) return false;
                let [mx, my] = menu.get_transformed_position();
                let [mw, mh] = menu.get_transformed_size();
                if (x >= mx && x <= mx + mw && y >= my && y <= my + mh) return false;

                if (btn) {
                    let [bx, by] = btn.get_transformed_position();
                    let [bw, bh] = btn.get_transformed_size();
                    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return false;
                }

                menu.hide();
                return true;
            };

            hideMenuIfOutside(this._filterMenu, this._filterButton);
            hideMenuIfOutside(this._categoryMenu, this._categoryButton);
            hideMenuIfOutside(this._tagMenu, this._tagButton);

            return Clutter.EVENT_PROPAGATE;
        });

        this._mainBox = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            reactive: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
            style: 'background-image: none; box-shadow: none;'
        });

        this._tintBg = new St.Widget({
            name: 'RudraTintBg',
            x_expand: true,
            y_expand: true,
            style: 'background-image: none;'
        });

        let initialWidth = 660;
        try { initialWidth = this._settings.get_int('launcher-width'); } catch (e) { }

        this._contentBox = new St.BoxLayout({
            vertical: true,
            width: initialWidth,
            style: 'background: transparent; background-image: none; box-shadow: none;'
        });

        this._headerBox = new St.BoxLayout({
            vertical: false,
            reactive: true,
            x_expand: true,
            style: 'padding: 16px 20px; background: transparent; background-image: none; box-shadow: none;'
        });

        setupFilterMenu(this);

        this._entryContainer = new Clutter.Actor({
            layout_manager: new Clutter.BinLayout(),
            x_expand: true
        });
        this._hintLabel = new St.Label({
            text: '',
            reactive: false,
            visible: false,
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'rudra-hint-label',
            style: 'background: transparent; background-image: none; box-shadow: none;'
        });
        this._hintLabel.clutter_text.ellipsize = 3;
        this._syncHintFont();

        this._entry = new St.Entry({
            hint_text: 'Search apps...',
            can_focus: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this._entry.set_style_class_name('rudra-entry-clear');

        this._entry.clutter_text.connect('button-press-event', () => {
            if (this._gridFocusMode) {
                this._gridFocusMode = false;
                this._entry.remove_style_class_name('rudra-grid-focus');
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this._entryContainer.add_child(this._hintLabel);
        this._entryContainer.add_child(this._entry);
        this._headerBox.add_child(this._entryContainer);

        setupViewToggle(this);
        setupCategoryMenu(this);
        setupTagMenu(this);

        this._separator = new St.Widget({ x_expand: true, visible: false });
        this._resultsView = new SearchResults(this, this._settings);

        this._contentBox.add_child(this._headerBox);
        this._contentBox.add_child(this._separator);
        this._contentBox.add_child(this._resultsView.widget);

        this._mainBox.add_child(this._tintBg);
        this._mainBox.add_child(this._contentBox);
        this._container.add_child(this._mainBox);
        Main.uiGroup.add_child(this._container);
        Main.uiGroup.set_child_above_sibling(this._container, null);

        this._resultsView.onVisibilityChange = (isVisible) => { this._separator.visible = isVisible; };
        
        bindEntryEvents(this);
    }

    showModeHint(text) {
        if (this._isOpen === false) return;
        this._syncHintFont();
        this._suggestedSuffix = '';
        this._hintLabel.set_text(text);
        if (this._autocompleteIdleId) {
            GLib.source_remove(this._autocompleteIdleId);
            this._autocompleteIdleId = 0;
        }
        this._autocompleteIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._autocompleteIdleId = 0;
            if (this._isOpen === false) return GLib.SOURCE_REMOVE;
            let cursorRect = this._entry.clutter_text.get_cursor_rect();
            this._hintLabel.set_translation(cursorRect.origin.x + 12, 0, 0);
            this._hintLabel.show();
            return GLib.SOURCE_REMOVE;
        });
    }

    showAutocomplete(appName, extraHint = '') {
        if (this._isOpen === false) return;
        if (this._autocompleteIdleId) {
            GLib.source_remove(this._autocompleteIdleId);
            this._autocompleteIdleId = 0;
        }

        let typedText = this._userTypedText;
        
        let triggersExact = [
            getTrigger(this._settings, 'trigger-clipboard'),
            getTrigger(this._settings, 'trigger-icon'),
            getTrigger(this._settings, 'trigger-emoji'),
            getTrigger(this._settings, 'trigger-plugin'),
            getTrigger(this._settings, 'trigger-google'),
            getTrigger(this._settings, 'trigger-youtube'),
            getTrigger(this._settings, 'trigger-ddg'),
            getTrigger(this._settings, 'trigger-wiki'),
            getTrigger(this._settings, 'trigger-perplexity'),
            getTrigger(this._settings, 'trigger-cohere'),
            getTrigger(this._settings, 'trigger-ai'),
            '!', '.', '>'
        ];

        let isSpecialMode = triggersExact.some(t => typedText.toLowerCase().startsWith(t.toLowerCase()));

        if (isSpecialMode === true || !typedText || !appName) {
            this._hintLabel.hide();
            this._suggestedSuffix = '';
            return;
        }

        let isPrefixExact = appName.toLowerCase().startsWith(typedText.toLowerCase());

        if (isPrefixExact && typedText.length > 0) {
            let correctCasePrefix = appName.substring(0, typedText.length);
            if (typedText !== correctCasePrefix) {
                this._updatingEntry = true;
                this._entry.set_text(correctCasePrefix);
                this._userTypedText = correctCasePrefix;
                this._entry.clutter_text.set_cursor_position(-1);
                this._updatingEntry = false;
                typedText = correctCasePrefix;
            }
        }

        let textToShow = appName + extraHint;
        this._suggestedSuffix = appName;

        if (!textToShow) { this._hintLabel.hide(); return; }

        this._autocompleteIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._autocompleteIdleId = 0;
            if (this._isOpen === false || this._entry.get_text() !== typedText) return GLib.SOURCE_REMOVE;

            this._hintLabel.set_text(textToShow);

            if (isPrefixExact) {
                this._hintLabel.set_translation(0, 0, 0);
            } else {
                let cursorRect = this._entry.clutter_text.get_cursor_rect();
                this._hintLabel.set_translation(cursorRect.origin.x + 10, 0, 0);
            }

            this._hintLabel.show();
            return GLib.SOURCE_REMOVE;
        });
    }

    toggle() { if (this._isOpen === true) this.close(); else this.open(false); }

    open(isPreview = false) {
        if (this._isOpen === true && this._isPreviewMode === isPreview) return;
        this._syncHintFont();
        if (Main.overview.visible === true) return;

        this._isOpen = true;
        this._isPreviewMode = isPreview;
        this._userTypedText = '';
        this._container.show();
        this._container.get_parent().set_child_above_sibling(this._container, null);

        this._entry.clutter_text.set_text('');
        this._hintLabel.hide();
        this._suggestedSuffix = '';

        if (this._resultsView) {
            this._resultsView._searchTimestamp = 0;
            this._resultsView.update('');
        }

        this._separator.visible = false;
        positionLauncherBox(this._mainBox, this._settings);

        if (this._focusTimeoutId) {
            GLib.source_remove(this._focusTimeoutId);
            this._focusTimeoutId = 0;
        }

        if (isPreview) {
            this._container.reactive = false;
            global.stage.set_key_focus(null);
        } else {
            this._container.reactive = true;

            if (!this._modalActive) {
                this._modalGrab = Main.pushModal(this._container, { actionMode: Shell.ActionMode.ALL });
                this._modalActive = true;
            }

            this._focusTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
                this._focusTimeoutId = 0;
                if (this._entry && this._isOpen === true) global.stage.set_key_focus(this._entry);
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    close() {
        if (this._isOpen === false) return;

        let currentFocus = global.stage.get_key_focus();
        if (currentFocus && this._container.contains(currentFocus)) {
            global.stage.set_key_focus(null);
        }

        if (this._modalActive) {
            this._modalActive = false;
            try {
                if (this._modalGrab) {
                    Main.popModal(this._modalGrab);
                    this._modalGrab = null;
                } else {
                    Main.popModal(this._container);
                }
            } catch (e) {
                console.error('Rudra popModal Error:', e);
            }
        }

        this._container.hide();

        this._isOpen = false;
        this._isPreviewMode = false;
        this._gridFocusMode = false;

        this._entry.remove_style_class_name('rudra-grid-focus');
        this._userTypedText = '';
        this._entry.clutter_text.set_text('');
        this._entry.set_hint_text('Search apps...');

        this._hintLabel.hide();
        this._suggestedSuffix = '';
        if (this._headerBox) this._headerBox.show();
        if (this._resultsView) this._resultsView.clear();

        if (this._previewTimeoutId) { GLib.source_remove(this._previewTimeoutId); this._previewTimeoutId = 0; }
        if (this._autocompleteIdleId) { GLib.source_remove(this._autocompleteIdleId); this._autocompleteIdleId = 0; }
        if (this._searchTimeoutId) { GLib.source_remove(this._searchTimeoutId); this._searchTimeoutId = 0; }
        if (this._focusTimeoutId) { GLib.source_remove(this._focusTimeoutId); this._focusTimeoutId = 0; }

        if (this._filterMenu) this._filterMenu.hide();
        if (this._categoryMenu) this._categoryMenu.hide();
        if (this._viewToggleBox) this._viewToggleBox.hide();

        this._currentFilter = 'all';
        if (this._filterIcon) this._filterIcon.set_icon_name('system-search-symbolic');
        if (this._categoryButton) this._categoryButton.hide();
        if (this.rebuildFilterMenu) this.rebuildFilterMenu();

        if (typeof setCategory === 'function') setCategory('All');
        if (typeof setIconCategory === 'function') setIconCategory('All');
        if (this._catLabel) this._catLabel.set_text('All');
        SnippetManager.setTagFilter('All');
        if (this._tagLabel) this._tagLabel.set_text('All Tags');
        if (this._tagMenu) this._tagMenu.hide();
        if (this._tagButton) this._tagButton.hide();
    }

    destroy() {
        this.close();
        if (this._stageKeyId && this._container) { this._container.disconnect(this._stageKeyId); this._stageKeyId = 0; }
        if (this._focusTimeoutId) { GLib.source_remove(this._focusTimeoutId); this._focusTimeoutId = 0; }
        if (this._previewTimeoutId) { GLib.source_remove(this._previewTimeoutId); this._previewTimeoutId = 0; }
        if (this._autocompleteIdleId) { GLib.source_remove(this._autocompleteIdleId); this._autocompleteIdleId = 0; }
        if (this._searchTimeoutId) { GLib.source_remove(this._searchTimeoutId); this._searchTimeoutId = 0; }
        if (this._overviewShowingId) { Main.overview.disconnect(this._overviewShowingId); this._overviewShowingId = 0; }
        if (this._settingsSignal) { this._settings.disconnect(this._settingsSignal); this._settingsSignal = 0; }
        if (this._shortcutSignal) { this._settings.disconnect(this._shortcutSignal); this._shortcutSignal = 0; }
        if (this._resultsView) this._resultsView.destroy();
        if (this._container) this._container.destroy();
    }
}