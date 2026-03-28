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
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

import { showSnippetForm } from './SnippetForm.js';
import { executeItem } from '../core/ActionExecutor.js';
import { showAIGuide, showAIView } from './AIChatView.js';
import { fetchAIResponse } from '../services/AIClient.js'; 
import { showClipboardEditForm } from './ClipboardForm.js';
import { hexToRgba, escapeMarkup } from '../core/utils.js';
import { SnippetManager } from '../services/SnippetManager.js';
import { HistoryManager } from '../services/HistoryManager.js';
import { fetchResults, getTrigger } from '../core/QueryParser.js';
import { showPluginForm, showPluginGuide } from './PluginForm.js';


const EMOJI_BOX = 46;
const EMOJI_PER_ROW = 10;
const EMOJI_SPACING = 8;
const EMOJI_VISIBLE_ROWS = 5;
const EMOJI_GRID_HEIGHT = (EMOJI_VISIBLE_ROWS * EMOJI_BOX) + ((EMOJI_VISIBLE_ROWS - 1) * EMOJI_SPACING) + 28;

const ICON_PER_ROW = 10;
const ICON_VISIBLE_ROWS = 5;

export class SearchResults {
    constructor(launcher, settings) {
        this._launcher = launcher;
        this._settings = settings;
        this._selectedIndex = -1;
        this._buttons = [];
        this._resultsData = [];
        this._currentQuery = '';
        this._searchTimestamp = 0;
        this._scrollIdleId = 0;
        this._resizeIdleId = 0;
        this.onVisibilityChange = null;
        this._fontFamily = 'Sans';
        this._fontSizePt = 14;
        this._themeColors = null;
        this.viewMode = 'grid';

        this._scrollView = new St.ScrollView({
            visible: false,
            x_expand: true,
            style: 'background: transparent; background-image: none; box-shadow: none; border: none; padding-bottom: 10px;'
        });
        this._scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.NEVER);
        this._scrollView.set_overlay_scrollbars(false);
        this._scrollView.add_style_class_name('rudra-scroll-clear');

        this._contentBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style: 'background: transparent; background-image: none; box-shadow: none; border: none;'
        });

        this._listBox = new St.BoxLayout({ vertical: true, x_expand: true });
        this._gridBox = new St.BoxLayout({ vertical: true, x_expand: true, style: 'padding: 14px;' });
        this._snippetFormBox = new St.BoxLayout({ vertical: true, x_expand: true, visible: false, style_class: 'rudra-form-box' });

        this._contentBox.add_child(this._listBox);
        this._contentBox.add_child(this._gridBox);
        this._contentBox.add_child(this._snippetFormBox);
        this._gridBox.hide();

        this._scrollView.set_child(this._contentBox);
    }

    get widget() { return this._scrollView; }

    prepareFormBox() {
        this._listBox.hide(); this._gridBox.hide();
        this._snippetFormBox.destroy_all_children();
        this._snippetFormBox.show();
        this._scrollView.show();
        this._scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.NEVER);
        this._scrollView.set_height(-1);
        this._scrollView.y_expand = true;

        if (this.onVisibilityChange) this.onVisibilityChange(true);
        if (this._launcher && this._launcher._headerBox) this._launcher._headerBox.hide();
        if (this._launcher && this._launcher._separator) this._launcher._separator.hide();
    }

    closeFormBox() {
        this._pluginGuideActive = false;
        if (this._launcher && this._launcher._headerBox) this._launcher._headerBox.show();
        this._snippetFormBox.hide();
        this._snippetFormBox.destroy_all_children();
        this._scrollView.hide();
        if (this.onVisibilityChange) this.onVisibilityChange(false);

        if (this._launcher) {
            this._launcher._restoreAfterSnippetForm();
        }
        
        this.update(this._currentQuery);
    }

    createFormTitleRow(title, backCallback) {
        let titleRow = new St.BoxLayout({ vertical: false, x_expand: true, style_class: 'rudra-form-title-row' });
        let backBtn = new St.Button({ reactive: true, style_class: 'rudra-back-btn' });
        let backBox = new St.BoxLayout({ vertical: false, y_align: Clutter.ActorAlign.CENTER });
        backBox.add_child(new St.Icon({ icon_name: 'go-previous-symbolic', icon_size: 14, style: 'color: rgba(255,255,255,0.65);' }));
        backBtn.set_child(backBox);
        backBtn.connect('clicked', backCallback);

        let titleLabel = new St.Label({ text: title, style_class: 'rudra-form-title', x_expand: true, x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER });
        titleRow.add_child(backBtn); titleRow.add_child(titleLabel); titleRow.add_child(new St.Widget({ style: 'min-width: 44px;' }));
        return titleRow;
    }

    updateStyles(family, sizePt) {
        this._fontFamily = family;
        this._fontSizePt = sizePt;
        if (this._currentQuery) this.update(this._currentQuery);
    }

    updateThemeColors(colors) {
        this._themeColors = colors;
        if (this._currentQuery) this._rebuildUI();
    }

    _getHighlightMarkup(text, query) {
        let tG = getTrigger(this._settings, 'trigger-google');
        let tYt = getTrigger(this._settings, 'trigger-youtube');
        let tIc = getTrigger(this._settings, 'trigger-icon');
        let tEm = getTrigger(this._settings, 'trigger-emoji');
        let tW = getTrigger(this._settings, 'trigger-wiki');
        let tDdg = getTrigger(this._settings, 'trigger-ddg');
        let tPx = getTrigger(this._settings, 'trigger-perplexity');
        let tCo = getTrigger(this._settings, 'trigger-cohere');

        let prefixes = [tG, tYt, tIc, tEm, tW, tDdg, tPx, tCo];
        let regStr = `^(${prefixes.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;
        
        let cleanQuery = query.replace(new RegExp(regStr), '').replace(/^[.>]/, '').trim();
        if (!cleanQuery) return escapeMarkup(text);
        let escapedText = escapeMarkup(text);
        let escapedQuery = escapeMarkup(cleanQuery);
        try {
            let regexSafeQuery = escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let regex = new RegExp(`(${regexSafeQuery})`, 'gi');
            let highlightColor = (this._themeColors && this._themeColors.highlightColor) || this._settings.get_string('highlight-color') || '#7aa2f7';
            return escapedText.replace(regex, `<span color="${highlightColor}">$1</span>`);
        } catch (error) { return escapedText; }
    }

    updateHighlightColor() { if (this._currentQuery) this._rebuildUI(); }
    refreshSelectionColor() { if (this._currentQuery) this._rebuildUI(); }

    _getColors() {
        let selHex, selOpacity, hoverHex, hoverOpacity;
        if (this._themeColors) {
            selHex = this._themeColors.selectionColor || '#4a6fa5';
            selOpacity = this._themeColors.selectionOpacity ?? 200;
            hoverHex = this._themeColors.hoverColor || '#3d59a1';
            hoverOpacity = this._themeColors.hoverOpacity ?? 80;
        } else {
            selHex = this._settings.get_string('selection-color') || '#4a6fa5';
            selOpacity = this._settings.get_int('selection-opacity') || 200;
            hoverHex = this._settings.get_string('hover-color') || '#3d59a1';
            hoverOpacity = this._settings.get_int('hover-opacity') || 80;
        }
        return { selColor: hexToRgba(selHex, selOpacity, '74, 111, 165'), hoverColor: hexToRgba(hoverHex, hoverOpacity, '74, 111, 165') };
    }

    _highlightSnippetCode(text) {
        if (!text) return '';
        let escaped = escapeMarkup(text.substring(0, 150));
        escaped = escaped.replace(/(\/\/.*$)/gm, '<span color="#7aa2f7" alpha="60%">$1</span>');
        escaped = escaped.replace(/(&quot;.*?&quot;|&#39;.*?&#39;|&lt;.*?&gt;)/g, '<span color="#9ece6a">$1</span>');
        escaped = escaped.replace(/\b(\d+)\b/g, '<span color="#ff9e64">$1</span>');
        escaped = escaped.replace(/\b(function|const|let|var|if|else|return|import|export|class|from|def)\b/g, '<span color="#bb9af7">$1</span>');
        escaped = escaped.replace(/\n/g, ' <span color="#666666">↵</span> ');
        return escaped;
    }

    _updateButtonColor(index) {
        if (index < 0 || index >= this._buttons.length) return;
        let button = this._buttons[index];
        if (!button || !button._selectBg || !button._hoverBg) return;
        try {
            if (!button._selectBg.get_stage || !button._selectBg.get_stage()) return;
            if (!button._hoverBg.get_stage || !button._hoverBg.get_stage()) return;
            if (index === this._selectedIndex) {
                button._selectBg.opacity = 255;
                button._hoverBg.opacity = 0;
            } else if (button.hover === true) {
                button._selectBg.opacity = 0;
                button._hoverBg.opacity = 255;
            } else {
                button._selectBg.opacity = 0;
                button._hoverBg.opacity = 0;
            }
        } catch (e) { }
    }

    _setSelected(index) {
        let prevIndex = this._selectedIndex;
        this._selectedIndex = index;
        if (prevIndex >= 0) this._updateButtonColor(prevIndex);
        if (index >= 0 && index < this._buttons.length) {
            this._updateButtonColor(index);
            this._scrollToItem(index);
        }
        let item = (index >= 0 && index < this._resultsData.length) ? this._resultsData[index] : null;
        if (item && item.type === 'app' && this._launcher.showAutocomplete)
            this._launcher.showAutocomplete(item.name, item.isSetting ? ' - System Setting' : '');
        else if (this._launcher.showAutocomplete)
            this._launcher.showAutocomplete(null);
    }

    _scrollToItem(index) {
        if (this._scrollIdleId) { GLib.source_remove(this._scrollIdleId); this._scrollIdleId = 0; }
        this._scrollIdleId = GLib.idle_add(GLib.PRIORITY_LOW, () => {
            this._scrollIdleId = 0;
            try {
                let button = this._buttons[index];
                let adjustment = this._scrollView.get_vadjustment ? this._scrollView.get_vadjustment() : this._scrollView.vadjustment;
                if (!button || !adjustment) return GLib.SOURCE_REMOVE;
                if (!button.get_stage || !button.get_stage()) return GLib.SOURCE_REMOVE;
                let pageSize = adjustment.get_page_size();
                let currentValue = adjustment.get_value();
                let [, itemY] = button.get_transformed_position();
                let [, scrollY] = this._scrollView.get_transformed_position();
                let topEdge = itemY - scrollY + currentValue;
                let bottomEdge = topEdge + button.get_height();
                let padding = 10;

                if (topEdge < currentValue) adjustment.set_value(Math.max(0, topEdge - padding));
                else if (bottomEdge + padding > currentValue + pageSize) adjustment.set_value(Math.min(adjustment.upper - pageSize, bottomEdge + padding - pageSize));
            } catch (error) { }
            return GLib.SOURCE_REMOVE;
        });
    }

    _getEmojiBoxSize(scrollbarVisible = false) {
        let w = this._scrollView.get_allocation_box().x2 - this._scrollView.get_allocation_box().x1;
        if (!w || w < 100) w = this._scrollView.get_width();
        if (!w || w < 100) w = 660;
        const N = EMOJI_PER_ROW; const PAD = 28; const GAP = 8; const SCROLLBAR = scrollbarVisible ? 14 : 0;
        return Math.max(40, Math.floor((w - PAD - SCROLLBAR - (N - 1) * GAP) / N));
    }

    _getIconBoxSize(scrollbarVisible = false) {
        let w = this._scrollView.get_allocation_box().x2 - this._scrollView.get_allocation_box().x1;
        if (!w || w < 100) w = this._scrollView.get_width();
        if (!w || w < 100) w = 660;
        const N = ICON_PER_ROW; const PAD = 28; const GAP = 8; const SCROLLBAR = scrollbarVisible ? 14 : 0;
        return Math.max(40, Math.floor((w - PAD - SCROLLBAR - (N - 1) * GAP) / N));
    }

    _createIconItem(item, index, colors, rowBox, iconBox) {
        let hitBox = new Clutter.Actor({ layout_manager: new Clutter.BinLayout(), reactive: true });
        hitBox.set_size(iconBox, iconBox);

        let defaultBg = new St.Widget({ style: `background-color: rgba(255,255,255,0.05); border-radius: 10px;`, opacity: 255, x_expand: true, y_expand: true });
        let selectBg = new St.Widget({ style: `background-color: ${colors.selColor}; border-radius: 10px;`, opacity: 0, x_expand: true, y_expand: true });
        let hoverBg = new St.Widget({ style: `background-color: ${colors.hoverColor}; border-radius: 10px;`, opacity: 0, x_expand: true, y_expand: true });

        hitBox._selectBg = selectBg; hitBox._hoverBg = hoverBg; hitBox.hover = false;
        hitBox.add_child(defaultBg); hitBox.add_child(selectBg); hitBox.add_child(hoverBg);

        let iconWidget = new St.Icon({ gicon: item.icon, icon_size: Math.floor(iconBox * 0.45), x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER, x_expand: true, y_expand: true, style: 'color: rgba(255,255,255,0.9);' });
        hitBox.add_child(iconWidget);

        hitBox.connect('enter-event', () => { hitBox.hover = true; this._updateButtonColor(index); return Clutter.EVENT_PROPAGATE; });
        hitBox.connect('leave-event', () => { hitBox.hover = false; this._updateButtonColor(index); return Clutter.EVENT_PROPAGATE; });
        hitBox.connect('button-release-event', (actor, event) => {
            if (event.get_button() === 1) { executeItem(item); this._launcher.close(); return Clutter.EVENT_STOP; }
            return Clutter.EVENT_PROPAGATE;
        });

        if (index % ICON_PER_ROW !== 0) hitBox.margin_left = 8;
        rowBox.add_child(hitBox); this._buttons.push(hitBox);
    }

    _resizeToFitContent(isEmoji, isIcon = false) {
        if (this._resizeIdleId) { GLib.source_remove(this._resizeIdleId); this._resizeIdleId = 0; }
        this._resizeIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._resizeIdleId = 0;
            if (!this._buttons || this._buttons.length === 0) return GLib.SOURCE_REMOVE;

            if (isEmoji) {
                this._scrollView.set_height(this._emojiGridHeight || EMOJI_GRID_HEIGHT);
            } else if (isIcon) {
                let iconBox = this._iconBoxSize || 72;
                let visibleRows = Math.min(Math.ceil(this._buttons.length / ICON_PER_ROW), ICON_VISIBLE_ROWS);
                let h = (visibleRows * iconBox) + ((visibleRows - 1) * 10) + 28;
                this._scrollView.set_height(h);
            } else {
                let visibleResultsLimit = this._settings.get_int('visible-results');
                let limit = Math.min(this._buttons.length, visibleResultsLimit);
                let totalHeight = 0;
                
                if (!this._currentQuery || this._currentQuery.trim() === '') totalHeight += (this._fontSizePt * 2) + 20;
                
                let w = this._scrollView.get_width();
                if (w <= 0) w = this._settings.get_int('launcher-width') || 660;
                let itemWidth = w > 30 ? w - 16 : w; 
                
                for (let i = 0; i < limit; i++) {
                    if (!this._buttons[i]) break;
                    totalHeight += this._buttons[i].get_preferred_height(itemWidth)[1];
                }
                
                if (limit > 0) totalHeight += 18; 
                
                let finalHeight = Math.min(totalHeight, 600); 
                
                this._scrollView.set_height(finalHeight);
                this._scrollView.set_policy(St.PolicyType.NEVER, this._buttons.length > visibleResultsLimit ? St.PolicyType.AUTOMATIC : St.PolicyType.NEVER);
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    update(text) {
        this._currentQuery = text ? text.trimStart() : '';
        let myTimestamp = Date.now();
        this._searchTimestamp = myTimestamp;

        fetchResults(this._currentQuery, this._settings.get_int('max-results'), this._settings, (results) => {
            if (this._searchTimestamp !== myTimestamp) return;
            const capturedResults = results;
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                if (this._searchTimestamp !== myTimestamp) return GLib.SOURCE_REMOVE;
                
                if (!this._currentQuery || this._currentQuery === '') {
                    let recents = (capturedResults || []).slice(0, 5);
                    let recentNames = recents.map(r => r.name);

                    let tAi = getTrigger(this._settings, 'trigger-ai');
                    let tCb = getTrigger(this._settings, 'trigger-clipboard');
                    let tSn = '!'; 
                    let tPl = getTrigger(this._settings, 'trigger-plugin');

                    let shortcutSuggestions = [
                        { type: 'shortcut', prefix: tAi, name: 'Ask AI', description: 'Chat with local or cloud AI', icon: new Gio.ThemedIcon({ name: 'system-run-symbolic' }) },
                        { type: 'shortcut', prefix: tCb, name: 'Clipboard History', description: 'View and paste recent clipboard items', icon: new Gio.ThemedIcon({ name: 'edit-paste-symbolic' }) },
                        { type: 'shortcut', prefix: tSn, name: 'Snippets', description: 'Insert text snippets', icon: new Gio.ThemedIcon({ name: 'text-x-generic-symbolic' }) },
                        { type: 'shortcut', prefix: tPl, name: 'Plugins', description: 'Manage and run custom plugins', icon: new Gio.ThemedIcon({ name: 'application-x-executable-symbolic' }) }
                    ];

                    shortcutSuggestions = shortcutSuggestions.filter(s => !recentNames.includes(s.name));
                    shortcutSuggestions.sort((a, b) => HistoryManager.getItemScore(b) - HistoryManager.getItemScore(a));
                    
                    this._resultsData = [...recents, ...shortcutSuggestions];
                    this._emptyStateDividerIndex = recents.length;
                } else {
                    this._resultsData = capturedResults || [];
                    this._emptyStateDividerIndex = -1;
                }
                this._rebuildUI();
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    _rebuildUI() {
        if (this._scrollIdleId) { GLib.source_remove(this._scrollIdleId); this._scrollIdleId = 0; }
        this._listBox.destroy_all_children(); this._gridBox.destroy_all_children(); this._snippetFormBox.hide();
        this._buttons = []; this._selectedIndex = -1;

        if (this._resultsData.length === 0) {
            this._scrollView.hide();
            if (this.onVisibilityChange) this.onVisibilityChange(false);
            return;
        }

        this._scrollView.show();
        if (this.onVisibilityChange) this.onVisibilityChange(true);

        let spacing = this._settings.get_int('result-spacing');
        let colors = this._getColors();
        let isEmoji = this._resultsData[0] && this._resultsData[0].type === 'emoji';
        let isIcon = this._resultsData[0] && this._resultsData[0].type === 'icon-browser';

        if (isEmoji && this.viewMode !== 'list') {
            this._listBox.hide(); this._gridBox.show();
            let _vadj = this._scrollView.get_vadjustment ? this._scrollView.get_vadjustment() : this._scrollView.vadjustment;
            if (_vadj) _vadj.set_value(0);

            let totalRows = Math.ceil(this._resultsData.length / EMOJI_PER_ROW);
            let needsScroll = totalRows > EMOJI_VISIBLE_ROWS;
            this._scrollView.set_policy(St.PolicyType.NEVER, needsScroll ? St.PolicyType.ALWAYS : St.PolicyType.NEVER);

            let emojiBox = this._getEmojiBoxSize(needsScroll);
            let emojiFont = Math.max(14, Math.floor(emojiBox * 0.4));
            let visRows = Math.min(totalRows, EMOJI_VISIBLE_ROWS);
            this._emojiGridHeight = (visRows * emojiBox) + ((visRows - 1) * 10) + 28;
            this._emojiBoxSize = emojiBox;

            let rowBox = null;
            this._resultsData.forEach((item, index) => {
                if (index % EMOJI_PER_ROW === 0) {
                    rowBox = new St.BoxLayout({ vertical: false, style: index > 0 ? 'margin-top: 10px;' : '' });
                    this._gridBox.add_child(rowBox);
                }
                this._createEmojiItem(item, index, colors, rowBox, emojiBox, emojiFont);
            });

        } else if (isIcon && this.viewMode !== 'list') {
            this._listBox.hide(); this._gridBox.show();
            let _vadj = this._scrollView.get_vadjustment ? this._scrollView.get_vadjustment() : this._scrollView.vadjustment;
            if (_vadj) _vadj.set_value(0);

            let totalRows = Math.ceil(this._resultsData.length / ICON_PER_ROW);
            let needsScroll = totalRows > ICON_VISIBLE_ROWS;
            this._scrollView.set_policy(St.PolicyType.NEVER, needsScroll ? St.PolicyType.ALWAYS : St.PolicyType.NEVER);

            let iconBox = this._getIconBoxSize(needsScroll);
            let visRows = Math.min(totalRows, ICON_VISIBLE_ROWS);
            this._iconGridHeight = (visRows * iconBox) + ((visRows - 1) * 10) + 28;
            this._iconBoxSize = iconBox;

            let rowBox = null;
            this._resultsData.forEach((item, index) => {
                if (index % ICON_PER_ROW === 0) {
                    rowBox = new St.BoxLayout({ vertical: false, style: index > 0 ? 'margin-top: 10px;' : '' });
                    this._gridBox.add_child(rowBox);
                }
                this._createIconItem(item, index, colors, rowBox, iconBox);
            });

        } else {
            this._gridBox.hide(); this._listBox.show();
            if ((!this._currentQuery || this._currentQuery.trim() === '') && this._emptyStateDividerIndex > 0) {
                let headerSize = Math.max(10, this._fontSizePt * 0.85);
                
                let headerRow = new St.BoxLayout({ 
                    vertical: false, 
                    x_expand: true, 
                    style: 'padding: 4px 12px; margin-bottom: 4px;' 
                });
                
                let headerLabel = new St.Label({ 
                    text: 'Recent Searches', 
                    x_expand: true, 
                    y_align: Clutter.ActorAlign.CENTER,
                    style: `font-family: "${this._fontFamily}"; font-size: ${headerSize}pt; font-weight: bold; color: #888888; background: transparent;` 
                });
                
                let clearBtn = new St.Button({ 
                    reactive: true, 
                    can_focus: true,
                    y_align: Clutter.ActorAlign.CENTER,
                    style: `font-family: "${this._fontFamily}"; font-size: ${Math.max(9, this._fontSizePt * 0.75)}pt; color: #888888; background: transparent; padding: 2px 8px; border-radius: 6px;`
                });
                clearBtn.set_child(new St.Label({ text: 'Clear Recent', style: 'color: inherit;' }));
                
                clearBtn.connect('enter-event', () => {
                    clearBtn.set_style(`font-family: "${this._fontFamily}"; font-size: ${Math.max(9, this._fontSizePt * 0.75)}pt; color: #f87171; background-color: rgba(239, 68, 68, 0.15); padding: 2px 8px; border-radius: 6px;`);
                    return Clutter.EVENT_PROPAGATE;
                });
                clearBtn.connect('leave-event', () => {
                    clearBtn.set_style(`font-family: "${this._fontFamily}"; font-size: ${Math.max(9, this._fontSizePt * 0.75)}pt; color: #888888; background: transparent; padding: 2px 8px; border-radius: 6px;`);
                    return Clutter.EVENT_PROPAGATE;
                });
                
                clearBtn.connect('clicked', () => {
                    HistoryManager.clearHistory();
                    this.update(this._currentQuery);
                });
                
                headerRow.add_child(headerLabel);
                headerRow.add_child(clearBtn);
                
                this._listBox.add_child(headerRow);
            }

            this._resultsData.forEach((item, index) => {
                if ((!this._currentQuery || this._currentQuery.trim() === '') && index === this._emptyStateDividerIndex) {
                    let headerSize = Math.max(10, this._fontSizePt * 0.85);
                    let topPad = index > 0 ? '16px' : '4px'; 
                    let suggLabel = new St.Label({ text: 'Suggestions', style: `font-family: "${this._fontFamily}"; font-size: ${headerSize}pt; font-weight: bold; color: #888888; padding: ${topPad} 12px 4px 12px; margin-bottom: 4px; background: transparent;` });
                    this._listBox.add_child(suggLabel);
                }
                this._createListItem(item, index, spacing, colors);
            });
        }

        this._resizeToFitContent(isEmoji && this.viewMode !== 'list', isIcon && this.viewMode !== 'list');

        if (this._buttons.length > 0) {
            if ((isEmoji || isIcon) && this.viewMode !== 'list') {
                let launcherGridFocus = this._launcher && this._launcher._gridFocusMode;
                let query = this._currentQuery || '';
                
                let tIc = getTrigger(this._settings, 'trigger-icon');
                let tEm = getTrigger(this._settings, 'trigger-emoji');
                
                let isEmpty = query.trim() === '' || query === tEm || query === tIc;
                if (isEmpty || launcherGridFocus) this._setSelected(0);
                else this._selectedIndex = -1;
            } else {
                this._setSelected(0);
            }
        }
    }

    _createEmojiItem(item, index, colors, rowBox, emojiBox, emojiFont) {
        let hitBox = new Clutter.Actor({ layout_manager: new Clutter.BinLayout(), reactive: true });
        hitBox.set_size(emojiBox, emojiBox);

        let defaultBg = new St.Widget({ style: `background-color: rgba(0,0,0,0.08); border-radius: 10px;`, opacity: 255, x_expand: true, y_expand: true });
        let selectBg = new St.Widget({ style: `background-color: ${colors.selColor}; border-radius: 10px;`, opacity: 0, x_expand: true, y_expand: true });
        let hoverBg = new St.Widget({ style: `background-color: ${colors.hoverColor}; border-radius: 10px;`, opacity: 0, x_expand: true, y_expand: true });

        hitBox._selectBg = selectBg; hitBox._hoverBg = hoverBg; hitBox.hover = false;
        hitBox.add_child(defaultBg); hitBox.add_child(selectBg); hitBox.add_child(hoverBg);

        let emojiLabel = new St.Label({ text: item.name, y_align: Clutter.ActorAlign.CENTER, x_align: Clutter.ActorAlign.CENTER, x_expand: true, y_expand: true, style: `font-size: ${emojiFont}pt; font-family: "sans-serif"; padding-bottom: 2px;` });
        hitBox.add_child(emojiLabel);

        hitBox.connect('enter-event', () => { hitBox.hover = true; this._updateButtonColor(index); return Clutter.EVENT_PROPAGATE; });
        hitBox.connect('leave-event', () => { hitBox.hover = false; this._updateButtonColor(index); return Clutter.EVENT_PROPAGATE; });
        hitBox.connect('button-release-event', (actor, event) => {
            if (event.get_button() === 1) { executeItem(item); this._launcher.close(); return Clutter.EVENT_STOP; }
            return Clutter.EVENT_PROPAGATE;
        });

        if (index % EMOJI_PER_ROW !== 0) hitBox.margin_left = 8;
        rowBox.add_child(hitBox); this._buttons.push(hitBox);
    }

    _createListItem(item, index, spacing, colors) {
        let hitBox = new Clutter.Actor({ layout_manager: new Clutter.BinLayout(), reactive: true });
        hitBox.x_expand = true; hitBox.x_align = Clutter.ActorAlign.FILL;
        hitBox.margin_left = 8; hitBox.margin_right = 8; hitBox.margin_top = spacing; hitBox.margin_bottom = spacing;

        let selectBg = new St.Widget({ style: `background-color: ${colors.selColor}; border-radius: 8px;`, opacity: 0, x_expand: true, y_expand: true });
        let hoverBg = new St.Widget({ style: `background-color: ${colors.hoverColor}; border-radius: 8px;`, opacity: 0, x_expand: true, y_expand: true });

        hitBox._selectBg = selectBg; hitBox._hoverBg = hoverBg; hitBox.hover = false;
        hitBox.add_child(selectBg); hitBox.add_child(hoverBg);

        hitBox.connect('enter-event', () => { hitBox.hover = true; this._updateButtonColor(index); return Clutter.EVENT_PROPAGATE; });
        hitBox.connect('leave-event', () => { hitBox.hover = false; this._updateButtonColor(index); return Clutter.EVENT_PROPAGATE; });

        hitBox.connect('button-release-event', (actor, event) => {
            if (event.get_button() === 1) {
                if (item.type === 'info') return Clutter.EVENT_STOP;

                if (item.type === 'rudra-settings') {
                    if (this._launcher && this._launcher._openPrefsCallback) {
                        this._launcher._openPrefsCallback();
                    }
                    if (this._launcher) this._launcher.close();
                    return Clutter.EVENT_STOP;
                }

                if (item.type === 'px-trigger' || item.type === 'co-trigger') {
                    let isPx = item.type === 'px-trigger';
                    item.type = 'info';
                    item.name = isPx ? 'Asking Perplexity...' : 'Asking Cohere...';
                    item.description = 'Fetching quick answer for: ' + item.searchText;
                    this._rebuildUI();

                    let apiKey = '';
                    try { apiKey = this._settings.get_string(isPx ? 'ai-api-key-perplexity' : 'ai-api-key-cohere'); } catch (e) {}

                    if (!apiKey) {
                        item.name = 'API Key Missing';
                        item.description = `Please add ${isPx ? 'Perplexity' : 'Cohere'} API key in settings`;
                        item.icon = new Gio.ThemedIcon({ name: 'dialog-error-symbolic' });
                        this._rebuildUI();
                        return Clutter.EVENT_STOP;
                    }

                    if (this._launcher && this._launcher._entry) {
                        let triggerStr = getTrigger(this._settings, isPx ? 'trigger-perplexity' : 'trigger-cohere');
                        this._launcher._updatingEntry = true;
                        this._launcher._entry.set_text(triggerStr);
                        this._launcher._entry.clutter_text.set_cursor_position(-1);
                        this._launcher._updatingEntry = false;
                        this._launcher._userTypedText = triggerStr;
                    }

                    let instruction = "Provide a direct, concise answer (max 2 lines) without any markdown. Question: ";
                    let msgs = [{ role: 'user', rawContent: instruction + item.searchText }];

                    fetchAIResponse(isPx ? 3 : 4, apiKey, msgs, (response) => {
                        item.type = 'clipboard';
                        item.name = 'Quick Answer (Click/Enter to Copy)';
                        item.description = response.trim(); 
                        item.text = response.trim();
                        item.isMultiline = true; 
                        this._rebuildUI();
                    }, true); 

                    return Clutter.EVENT_STOP;
                }

                if (item.type === 'snippet') SnippetManager.incrementUseCount(item.id);
                if (item.type === 'snippet-new') { showSnippetForm(this); return Clutter.EVENT_STOP; }
                if (item.type === 'plugin-new') { showPluginForm(this); return Clutter.EVENT_STOP; }
                if (item.type === 'plugin-help') { showPluginGuide(this); return Clutter.EVENT_STOP; }
                if (item.type === 'plugin-edit') { showPluginForm(this, item.filename); return Clutter.EVENT_STOP; }
                if (item.type === 'ai-help') { showAIGuide(this); return Clutter.EVENT_STOP; }
                if (item.type === 'ai-ask') { showAIView(this, item.question); return Clutter.EVENT_STOP; }
                if (item.type === 'ai-new') { showAIView(this, null, null, true); return Clutter.EVENT_STOP; }
                
                if (item.type === 'ai-chat-history') { showAIView(this, null, item.chatData); return Clutter.EVENT_STOP; }
                if (item.type === 'shortcut') {
                    HistoryManager.record(item);
                    if (this._launcher && this._launcher._entry) {
                        this._launcher._entry.set_text(item.prefix);
                        this._launcher._entry.clutter_text.set_cursor_position(-1);
                    }
                    return Clutter.EVENT_STOP;
                }
                executeItem(item);
                this._launcher.close();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        let rowYAlign = item.isMultiline ? Clutter.ActorAlign.START : Clutter.ActorAlign.CENTER;
        let rowBox = new St.BoxLayout({ vertical: false, x_expand: true, y_align: rowYAlign, style_class: 'rudra-list-clear', style: 'padding: 8px;' });

        if (item.colorHex) {
            rowBox.add_child(new St.Widget({ style: `background-color: ${item.colorHex}; border-radius: 8px; min-width: 36px; min-height: 36px; border: 1px solid rgba(255,255,255,0.2);` }));
        } else if (item.emojiText || item.type === 'emoji') {
            let bin = new St.Widget({ layout_manager: new Clutter.BinLayout(), style: 'min-width: 36px; min-height: 36px;' });
            let t = item.emojiText || item.text;
            bin.add_child(new St.Label({ text: t, style: 'font-size: 24pt;', y_align: Clutter.ActorAlign.CENTER, x_align: Clutter.ActorAlign.CENTER }));
            rowBox.add_child(bin);
        } else if (item.icon) {
            rowBox.add_child(new St.Icon({ gicon: item.icon, icon_size: 36, style: 'min-width: 36px; min-height: 36px;' }));
        } else {
            rowBox.add_child(new St.Widget({ style: 'min-width: 36px; min-height: 36px;' }));
        }

        let textColumnYAlign = item.isMultiline ? Clutter.ActorAlign.START : Clutter.ActorAlign.CENTER;
        let textColumn = new St.BoxLayout({ vertical: true, x_expand: true, y_align: textColumnYAlign, style: 'margin-left: 12px;' });
        
        let nameLabel = new St.Label({ style: `font-family: "${this._fontFamily}"; font-size: ${this._fontSizePt}pt;` });
        nameLabel.clutter_text.use_markup = true; nameLabel.clutter_text.ellipsize = 3;

        let nameToShow = item.name || '';
        if (item.type === 'emoji') nameToShow = item.emojiName || item.name;

        if (item.type === 'web' || item.type === 'command' || item.type === 'calc' || item.type === 'clipboard' || item.type === 'snippet' || item.type === 'plugin-action' || item.type === 'shortcut' || item.type === 'snippet-new' || item.type === 'plugin-new' || item.type === 'ai-new' || item.type === 'info' || item.type === 'px-trigger' || item.type === 'co-trigger' || item.type === 'rudra-settings') {
            nameLabel.clutter_text.set_markup(escapeMarkup(nameToShow));
        } else {
            nameLabel.clutter_text.set_markup(this._getHighlightMarkup(nameToShow, this._currentQuery));
        }
        textColumn.add_child(nameLabel);

        let descText = item.description || '';
        if (item.isSetting) descText = descText ? 'System Setting • ' + descText : 'System Setting';

        if (descText) {
            let descLabel = new St.Label({ style: `font-family: "Monospace", "${this._fontFamily}"; font-size: ${Math.max(8, this._fontSizePt * 0.85)}pt; color: rgba(255,255,255,0.7); margin-top: 4px;` });
            
            if (item.isMultiline) {
                descLabel.clutter_text.single_line_mode = false;
                descLabel.clutter_text.line_wrap = true;
                descLabel.clutter_text.line_wrap_mode = 2; 
                descLabel.clutter_text.ellipsize = 0; 
                descLabel.x_expand = true; 
                descLabel.y_expand = true;
            } else {
                descLabel.clutter_text.single_line_mode = true;
                descLabel.clutter_text.ellipsize = 3;
            }

            if (item.type === 'snippet') {
                descLabel.clutter_text.use_markup = true; descLabel.clutter_text.set_markup(this._highlightSnippetCode(descText));
            } else {
                descLabel.clutter_text.set_text(item.isMultiline ? descText : descText.replace(/\n/g, ' '));
            }
            textColumn.add_child(descLabel);
        }

        if (item.type === 'snippet') {
            let metaRow = new St.BoxLayout({ vertical: false, style: 'margin-top: 6px;' });
            if (item.useCount > 0) metaRow.add_child(new St.Label({ text: `${item.useCount}`, style: 'font-size: 8pt; color: #ff9e64; margin-right: 8px; font-weight: bold; padding-top: 1px;' }));
            if (item.tags && item.tags.length > 0) {
                const subtleColors = [
                    { bg: 'rgba(122, 162, 247, 0.15)', text: '#7aa2f7' }, { bg: 'rgba(158, 206, 106, 0.15)', text: '#9ece6a' },
                    { bg: 'rgba(247, 118, 118, 0.15)', text: '#f7768e' }, { bg: 'rgba(187, 154, 247, 0.15)', text: '#bb9af7' },
                    { bg: 'rgba(255, 158, 100, 0.15)', text: '#ff9e64' }, { bg: 'rgba(125, 207, 219, 0.15)', text: '#7dcfff' }
                ];
                item.tags.forEach(tag => {
                    let hash = 0; for (let i = 0; i < tag.length; i++) hash = (hash << 5) - hash + tag.charCodeAt(i) | 0;
                    const palette = subtleColors[Math.abs(hash) % subtleColors.length];
                    metaRow.add_child(new St.Label({ text: tag, style: `background-color: ${palette.bg}; color: ${palette.text}; border-radius: 4px; padding: 1px 6px; font-size: 7.5pt; margin-right: 6px; font-weight: bold;` }));
                });
            }
            if (item.useCount > 0 || (item.tags && item.tags.length > 0)) textColumn.add_child(metaRow);
        }
        rowBox.add_child(textColumn);

        if (item.type === 'snippet' && item.id) {
            let editBtn = new Clutter.Actor({ reactive: true, y_align: Clutter.ActorAlign.CENTER, margin_left: 6, layout_manager: new Clutter.BinLayout() });
            let editHoverBg = new St.Widget({ style: 'background-color: rgba(255,255,255,0.12); border-radius: 8px;', opacity: 0, x_expand: true, y_expand: true });
            let editIcon = new St.Icon({ icon_name: 'document-edit-symbolic', icon_size: 16, style: 'padding: 6px; color: rgba(255,255,255,0.5);' });
            editBtn.add_child(editHoverBg); editBtn.add_child(editIcon);
            editBtn.connect('enter-event', () => { editHoverBg.opacity = 255; return Clutter.EVENT_PROPAGATE; });
            editBtn.connect('leave-event', () => { editHoverBg.opacity = 0; return Clutter.EVENT_PROPAGATE; });
            editBtn.connect('button-release-event', (actor, event) => {
                if (event.get_button() === 1) {
                    let fullSnippet = SnippetManager.getAll().find(s => s.id === item.id);
                    if (fullSnippet) showSnippetForm(this, fullSnippet);
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
            rowBox.add_child(editBtn);
        }

        if (item.type === 'clipboard') {
            let editBtn = new Clutter.Actor({ reactive: true, y_align: Clutter.ActorAlign.START, margin_left: 6, margin_top: 2, layout_manager: new Clutter.BinLayout() });
            let editHoverBg = new St.Widget({ style: 'background-color: rgba(255,255,255,0.12); border-radius: 8px;', opacity: 0, x_expand: true, y_expand: true });
            let editIcon = new St.Icon({ icon_name: 'document-edit-symbolic', icon_size: 16, style: 'padding: 6px; color: rgba(255,255,255,0.5);' });
            editBtn.add_child(editHoverBg); editBtn.add_child(editIcon);
            editBtn.connect('enter-event', () => { editHoverBg.opacity = 255; return Clutter.EVENT_PROPAGATE; });
            editBtn.connect('leave-event', () => { editHoverBg.opacity = 0; return Clutter.EVENT_PROPAGATE; });
            editBtn.connect('button-release-event', (actor, event) => {
                if (event.get_button() === 1) { showClipboardEditForm(this, item); return Clutter.EVENT_STOP; }
                return Clutter.EVENT_PROPAGATE;
            });
            rowBox.add_child(editBtn);
        }

        if (item.type === 'ai-chat-history') {
            let actionBox = new St.BoxLayout({ vertical: false, y_align: Clutter.ActorAlign.CENTER });
            let pinBtn = new Clutter.Actor({ reactive: true, y_align: Clutter.ActorAlign.CENTER, margin_left: 6, layout_manager: new Clutter.BinLayout() });
            let pinHoverBg = new St.Widget({ style: 'background-color: rgba(255,255,255,0.12); border-radius: 8px;', opacity: 0, x_expand: true, y_expand: true });
            let pinIcon = new St.Icon({ icon_name: item.isPinned ? 'starred-symbolic' : 'non-starred-symbolic', icon_size: 16, style: `padding: 6px; color: ${item.isPinned ? '#ff9e64' : 'rgba(255,255,255,0.5)'};` });
            pinBtn.add_child(pinHoverBg); pinBtn.add_child(pinIcon);
            pinBtn.connect('enter-event', () => { pinHoverBg.opacity = 255; return Clutter.EVENT_PROPAGATE; });
            pinBtn.connect('leave-event', () => { pinHoverBg.opacity = 0; return Clutter.EVENT_PROPAGATE; });
            pinBtn.connect('button-release-event', (actor, event) => {
                if (event.get_button() === 1) { HistoryManager.togglePinAIChat(item.chatData.id); this.update(this._currentQuery); return Clutter.EVENT_STOP; }
                return Clutter.EVENT_PROPAGATE;
            });
            actionBox.add_child(pinBtn);

            let delBtn = new Clutter.Actor({ reactive: true, y_align: Clutter.ActorAlign.CENTER, margin_left: 2, layout_manager: new Clutter.BinLayout() });
            let delHoverBg = new St.Widget({ style: 'background-color: rgba(239,68,68,0.15); border-radius: 8px;', opacity: 0, x_expand: true, y_expand: true });
            let delIcon = new St.Icon({ icon_name: 'user-trash-symbolic', icon_size: 16, style: 'padding: 6px; color: rgba(255,255,255,0.5);' });
            delBtn.add_child(delHoverBg); delBtn.add_child(delIcon);
            delBtn.connect('enter-event', () => { delHoverBg.opacity = 255; delIcon.set_style('padding: 6px; color: #f87171;'); return Clutter.EVENT_PROPAGATE; });
            delBtn.connect('leave-event', () => { delHoverBg.opacity = 0; delIcon.set_style('padding: 6px; color: rgba(255,255,255,0.5);'); return Clutter.EVENT_PROPAGATE; });
            delBtn.connect('button-release-event', (actor, event) => {
                if (event.get_button() === 1) { HistoryManager.deleteAIChat(item.chatData.id); this.update(this._currentQuery); return Clutter.EVENT_STOP; }
                return Clutter.EVENT_PROPAGATE;
            });
            actionBox.add_child(delBtn);
            rowBox.add_child(actionBox);
        }

        if (item.refreshable) {
            let refreshBtn = new Clutter.Actor({ reactive: true, y_align: Clutter.ActorAlign.CENTER, margin_left: 8, layout_manager: new Clutter.BinLayout() });
            let refreshHoverBg = new St.Widget({ style: 'background-color: rgba(255,255,255,0.15); border-radius: 20px;', opacity: 0, x_expand: true, y_expand: true });
            let refreshIcon = new St.Icon({ icon_name: 'view-refresh-symbolic', icon_size: 20, style: 'padding: 6px;', opacity: 150 });
            refreshBtn.add_child(refreshHoverBg); refreshBtn.add_child(refreshIcon);
            refreshBtn.connect('enter-event', () => { refreshHoverBg.opacity = 255; refreshIcon.opacity = 255; return Clutter.EVENT_PROPAGATE; });
            refreshBtn.connect('leave-event', () => { refreshHoverBg.opacity = 0; refreshIcon.opacity = 150; return Clutter.EVENT_PROPAGATE; });
            refreshBtn.connect('button-release-event', (actor, event) => {
                if (event.get_button() === 1) { this.update(this._currentQuery); return Clutter.EVENT_STOP; }
                return Clutter.EVENT_PROPAGATE;
            });
            rowBox.add_child(refreshBtn);
        }

        hitBox.add_child(rowBox); this._listBox.add_child(hitBox); this._buttons.push(hitBox);
    }

    selectNext() {
        if (this._buttons.length === 0) return;
        let isGrid = this._resultsData[0] && (this._resultsData[0].type === 'emoji' || this._resultsData[0].type === 'icon-browser') && this.viewMode !== 'list';
        let step = isGrid ? EMOJI_PER_ROW : 1;
        let next = this._selectedIndex + step;
        if (next >= this._buttons.length) next = this._buttons.length - 1;
        this._setSelected(next);
    }

    selectPrev() {
        if (this._buttons.length === 0) return;
        let isGrid = this._resultsData[0] && (this._resultsData[0].type === 'emoji' || this._resultsData[0].type === 'icon-browser') && this.viewMode !== 'list';
        let step = isGrid ? EMOJI_PER_ROW : 1;
        let prev = this._selectedIndex - step;
        if (prev < 0) prev = 0;
        this._setSelected(prev);
    }

    selectNextInRow() { if (this._buttons.length > 0) this._setSelected(Math.min(this._selectedIndex + 1, this._buttons.length - 1)); }
    selectPrevInRow() { if (this._buttons.length > 0) this._setSelected(Math.max(this._selectedIndex - 1, 0)); }

    activateSelected() {
        if (this._selectedIndex >= 0 && this._selectedIndex < this._buttons.length) {
            let item = this._resultsData[this._selectedIndex];
            
            if (item.type === 'info') return;

            if (item.type === 'rudra-settings') {
                if (this._launcher && this._launcher._openPrefsCallback) {
                    this._launcher._openPrefsCallback();
                }
                if (this._launcher) this._launcher.close();
                return;
            }

            if (item.type === 'px-trigger' || item.type === 'co-trigger') {
                let isPx = item.type === 'px-trigger';
                item.type = 'info';
                item.name = isPx ? 'Asking Perplexity...' : 'Asking Cohere...';
                item.description = 'Fetching quick answer for: ' + item.searchText;
                this._rebuildUI();

                let apiKey = '';
                try { apiKey = this._settings.get_string(isPx ? 'ai-api-key-perplexity' : 'ai-api-key-cohere'); } catch(e) {}
                
                if (!apiKey) {
                    item.name = 'API Key Missing';
                    item.description = `Please add ${isPx ? 'Perplexity' : 'Cohere'} API key in settings`;
                    item.icon = new Gio.ThemedIcon({ name: 'dialog-error-symbolic' });
                    this._rebuildUI();
                    return;
                }

                if (this._launcher && this._launcher._entry) {
                    let triggerStr = getTrigger(this._settings, isPx ? 'trigger-perplexity' : 'trigger-cohere');
                    this._launcher._updatingEntry = true;
                    this._launcher._entry.set_text(triggerStr);
                    this._launcher._entry.clutter_text.set_cursor_position(-1);
                    this._launcher._updatingEntry = false;
                    this._launcher._userTypedText = triggerStr;
                }

                let instruction = "Provide a direct, concise answer (max 2 lines) without any markdown. Question: ";
                let msgs = [{ role: 'user', rawContent: instruction + item.searchText }];

                fetchAIResponse(isPx ? 3 : 4, apiKey, msgs, (response) => {
                    item.type = 'clipboard';
                    item.name = 'Quick Answer (Enter to Copy)';
                    item.description = response.trim(); 
                    item.text = response.trim();
                    item.isMultiline = true; 
                    this._rebuildUI();
                }, true);

                return;
            }

            if (item.type === 'snippet') SnippetManager.incrementUseCount(item.id);
            if (item.type === 'snippet-new') { showSnippetForm(this); return; }
            if (item.type === 'plugin-new') { showPluginForm(this); return; }
            if (item.type === 'plugin-help') { showPluginGuide(this); return; }
            if (item.type === 'plugin-edit') { showPluginForm(this, item.filename); return; }
            if (item.type === 'ai-help') { showAIGuide(this); return Clutter.EVENT_STOP; }
            if (item.type === 'ai-ask') { showAIView(this, item.question); return Clutter.EVENT_STOP; }
            if (item.type === 'ai-new') { showAIView(this, null, null, true); return Clutter.EVENT_STOP; }
            if (item.type === 'ai-chat-history') { showAIView(this, null, item.chatData); return Clutter.EVENT_STOP; }
            if (item.type === 'shortcut') {
                HistoryManager.record(item);
                if (this._launcher && this._launcher._entry) {
                    this._launcher._entry.set_text(item.prefix);
                    this._launcher._entry.clutter_text.set_cursor_position(-1);
                }
                return Clutter.EVENT_STOP;
            }
            executeItem(item);
            if (this._launcher) this._launcher.close();
        }
    }

    clear() {
        this._searchTimestamp = Date.now();
        if (this._scrollIdleId) { GLib.source_remove(this._scrollIdleId); this._scrollIdleId = 0; }
        this._listBox.destroy_all_children(); this._gridBox.destroy_all_children();
        this._snippetFormBox.destroy_all_children(); this._snippetFormBox.hide();
        this._buttons = []; this._resultsData = []; this._selectedIndex = -1; this._currentQuery = '';
        this._scrollView.hide();
        if (this.onVisibilityChange) this.onVisibilityChange(false);
    }

    destroy() {
        if (this._scrollIdleId) { GLib.source_remove(this._scrollIdleId); this._scrollIdleId = 0; }
        if (this._resizeIdleId) { GLib.source_remove(this._resizeIdleId); this._resizeIdleId = 0; }
    }
}