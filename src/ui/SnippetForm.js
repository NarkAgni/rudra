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
import Clutter from 'gi://Clutter';

import { searchIcons } from '../browsers/IconBrowser.js';
import { searchEmojis } from '../browsers/EmojiBrowser.js';
import { SnippetManager } from '../services/SnippetManager.js';


export function showSnippetForm(ctx, snippet = null) {
    ctx.prepareFormBox();
    const _redirectToSnippetList = () => ctx.closeFormBox();

    let editingId = snippet ? snippet.id : null;
    let colors = ctx._getColors();

    const makeLabel = (text) => new St.Label({ text, style_class: 'rudra-form-label' });
    const makeEntry = (hint, value = '') => {
        let e = new St.Entry({ hint_text: hint, can_focus: true, x_expand: true, style_class: 'rudra-form-entry' });
        if (value) e.set_text(value);
        return e;
    };

    let titleRow = ctx.createFormTitleRow(snippet ? 'Edit Snippet' : 'New Snippet', _redirectToSnippetList);
    ctx._snippetFormBox.add_child(titleRow);

    let nameEntry, triggerEntry, iconBtn, tagsEntry;
    let currentSelectedIcon = snippet && snippet.icon ? snippet.icon : 'accessories-text-editor-symbolic';
    let iconDisplay;

    let topRow = new St.BoxLayout({ vertical: false, x_expand: true });
    let iconCol = new St.BoxLayout({ vertical: true, style: 'margin-right: 10px; margin-bottom: 14px;' });
    iconCol.add_child(makeLabel('ICON'));
    iconDisplay = new St.Widget({ layout_manager: new Clutter.BinLayout(), x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER, style: 'min-width: 24px;' });
    iconBtn = new St.Button({ reactive: true, child: iconDisplay, style_class: 'rudra-icon-btn' });
    iconCol.add_child(iconBtn);

    let nameCol = new St.BoxLayout({ vertical: true, x_expand: true, style: 'margin-right: 10px;' });
    nameCol.add_child(makeLabel('NAME'));
    nameEntry = makeEntry('e.g. Meeting Link', snippet ? snippet.name : '');
    nameCol.add_child(nameEntry);

    let triggerCol = new St.BoxLayout({ vertical: true, style: 'min-width: 190px;' });
    triggerCol.add_child(makeLabel('TRIGGER / KEYWORD'));
    triggerEntry = makeEntry('!meet', snippet ? snippet.trigger : '');
    triggerCol.add_child(triggerEntry);

    topRow.add_child(iconCol); topRow.add_child(nameCol); topRow.add_child(triggerCol);
    ctx._snippetFormBox.add_child(topRow);

    let tagsRow = new St.BoxLayout({ vertical: false, x_expand: true, style: 'margin-bottom: 10px;' });
    let tagsCol = new St.BoxLayout({ vertical: true, x_expand: true });
    tagsCol.add_child(makeLabel('TAGS (Comma separated)'));
    let existingTagsStr = snippet && snippet.tags ? snippet.tags.join(', ') : '';
    tagsEntry = makeEntry('e.g. work, code, personal', existingTagsStr);
    tagsCol.add_child(tagsEntry);
    tagsRow.add_child(tagsCol);
    ctx._snippetFormBox.add_child(tagsRow);

    const updateCurrentIconDisplay = (val) => {
        iconDisplay.destroy_all_children();
        if (val.includes('-symbolic') || val.match(/^[a-z\-]+$/)) iconDisplay.add_child(new St.Icon({ icon_name: val, icon_size: 20, style: 'color: #fff;' }));
        else iconDisplay.add_child(new St.Label({ text: val, style: 'font-size: 16pt;' }));
        currentSelectedIcon = val;
    };
    updateCurrentIconDisplay(currentSelectedIcon);

    let iconPickerBox = new St.BoxLayout({ vertical: true, visible: false, style_class: 'rudra-icon-picker' });
    let pickerSearch = new St.Entry({ hint_text: 'Search icons/emojis...', can_focus: true, x_expand: true, style_class: 'rudra-menu-search' });
    iconPickerBox.add_child(pickerSearch);

    let lowerSectionBox = new St.BoxLayout({ vertical: true, x_expand: true });
    let activeTab = 'emojis';
    let tabRow = new St.BoxLayout({ vertical: false, style: 'margin-bottom: 12px;' });
    let emojiTabBtn = new St.Button({ label: '  Emojis  ', reactive: true, style_class: 'rudra-tab-active' });
    let iconTabBtn = new St.Button({ label: '  Icons  ', reactive: true, style_class: 'rudra-tab-inactive' });
    tabRow.add_child(emojiTabBtn); tabRow.add_child(iconTabBtn);
    iconPickerBox.add_child(tabRow);

    let gridScroll = new St.ScrollView({ x_expand: true, y_expand: true, style: 'height: 160px; padding-right: 8px;' });
    gridScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
    gridScroll.set_overlay_scrollbars(false);
    gridScroll.add_style_class_name('rudra-scroll-clear');
    let gridBox = new St.BoxLayout({ vertical: true, x_expand: true });
    gridScroll.set_child(gridBox);
    iconPickerBox.add_child(gridScroll);

    const populateGrid = () => {
        gridBox.destroy_all_children();
        let q = pickerSearch.get_text() || '';
        let items = activeTab === 'emojis' ? searchEmojis(q) : searchIcons(q);
        if (!items || items.length === 0) return;

        let row = null; let ITEMS_PER_ROW = 8;
        let slicedItems = items.slice(0, 80);

        slicedItems.forEach((item, i) => {
            if (i % ITEMS_PER_ROW === 0) { row = new St.BoxLayout({ vertical: false, x_expand: true, style: 'margin-bottom: 6px;' }); gridBox.add_child(row); }
            let btn = new St.Button({ reactive: true, x_expand: true, style_class: 'rudra-picker-item' });
            let valToSave = item.name;
            let iconContainer = new St.Widget({ layout_manager: new Clutter.BinLayout(), x_expand: true, y_expand: true, x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER });

            if (activeTab === 'emojis') iconContainer.add_child(new St.Label({ text: valToSave, style: 'font-size: 22pt;' }));
            else iconContainer.add_child(new St.Icon({ icon_name: valToSave, icon_size: 32, style: 'color: #fff;' }));

            btn.set_child(iconContainer);
            btn.connect('clicked', () => { updateCurrentIconDisplay(valToSave); iconPickerBox.hide(); lowerSectionBox.show(); });
            row.add_child(btn);
        });
        let remainder = slicedItems.length % ITEMS_PER_ROW;
        if (remainder !== 0 && row) for (let j = 0; j < ITEMS_PER_ROW - remainder; j++) row.add_child(new St.Widget({ x_expand: true, style: 'margin-right: 6px;' }));
    };

    emojiTabBtn.connect('clicked', () => { activeTab = 'emojis'; emojiTabBtn.style_class = 'rudra-tab-active'; iconTabBtn.style_class = 'rudra-tab-inactive'; pickerSearch.set_text(''); populateGrid(); });
    iconTabBtn.connect('clicked', () => { activeTab = 'icons'; emojiTabBtn.style_class = 'rudra-tab-inactive'; iconTabBtn.style_class = 'rudra-tab-active'; pickerSearch.set_text(''); populateGrid(); });
    pickerSearch.clutter_text.connect('text-changed', populateGrid);

    iconBtn.connect('clicked', () => {
        iconPickerBox.visible = !iconPickerBox.visible;
        if (iconPickerBox.visible) { lowerSectionBox.hide(); populateGrid(); pickerSearch.grab_key_focus(); }
        else lowerSectionBox.show();
    });

    ctx._snippetFormBox.add_child(iconPickerBox);
    lowerSectionBox.add_child(makeLabel('CONTENT'));
    let contentScroll = new St.ScrollView({ x_expand: true, style: 'background: transparent; border: none; box-shadow: none; min-height: 120px; max-height: 160px;' });
    contentScroll.add_style_class_name('rudra-editor-wrapper');
    contentScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
    contentScroll.set_overlay_scrollbars(false);

    let contentText = new St.Entry({ hint_text: 'Snippet text here...', can_focus: true, x_expand: true, style_class: 'rudra-editor-entry' });
    try {
        contentText.clutter_text.single_line_mode = false; contentText.clutter_text.line_wrap = true;
        contentText.clutter_text.line_wrap_mode = 2; contentText.clutter_text.activatable = false;
        contentText.clutter_text.ellipsize = 0; contentText.clutter_text.cursor_visible = true;
        contentText.clutter_text.cursor_size = 2; contentText.clutter_text.cursor_color = new Clutter.Color({ red: 122, green: 162, blue: 247, alpha: 255 });
    } catch (e) { }

    if (snippet) contentText.set_text(snippet.text || '');

    const _updateContentHeight = (scrollToCursor = false) => {
        GLib.idle_add(GLib.PRIORITY_LOW, () => {
            try {
                let scrollW = contentScroll.get_width();
                let [, natH] = contentText.clutter_text.get_preferred_height(scrollW > 24 ? scrollW - 24 : scrollW);
                if (natH > 0) { contentText.set_height(natH + 24); contentText.natural_height = natH + 24; }
                let adj = contentScroll.get_vadjustment ? contentScroll.get_vadjustment() : contentScroll.vadjustment;
                if (adj) {
                    if (scrollToCursor) {
                        try {
                            let cursorRect = contentText.clutter_text.get_cursor_rect();
                            let cursorY = cursorRect.origin.y + cursorRect.size.height;
                            let cursorTop = cursorRect.origin.y;
                            let val = adj.get_value(); let pageSize = adj.get_page_size();
                            if (cursorY > val + pageSize - 4) adj.set_value(Math.min(adj.upper - pageSize, cursorY - pageSize + 20));
                            else if (cursorTop < val + 4) adj.set_value(Math.max(0, cursorTop - 10));
                        } catch (e) { }
                    } else adj.set_value(adj.upper - adj.page_size);
                }
            } catch (e) { }
            return GLib.SOURCE_REMOVE;
        });
    };
    contentText.clutter_text.connect('text-changed', () => _updateContentHeight(true));
    contentText.clutter_text.connect('cursor-changed', () => _updateContentHeight(true));

    let entryWrapperBox = new St.BoxLayout({ vertical: true, x_expand: true });
    entryWrapperBox.add_child(contentText);
    contentScroll.set_child(entryWrapperBox);
    contentScroll.connect('button-press-event', () => { global.stage.set_key_focus(contentText.clutter_text); return Clutter.EVENT_STOP; });
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => { _updateContentHeight(false); return GLib.SOURCE_REMOVE; });
    lowerSectionBox.add_child(contentScroll);

    if (nameEntry && triggerEntry && contentText) {
        nameEntry.clutter_text.connect('key-press-event', (actor, event) => {
            let sym = event.get_key_symbol();
            if (sym === Clutter.KEY_Down) { global.stage.set_key_focus(triggerEntry); return Clutter.EVENT_STOP; }
            if (sym === Clutter.KEY_Return || sym === Clutter.KEY_KP_Enter) return Clutter.EVENT_STOP;
            return Clutter.EVENT_PROPAGATE;
        });
        triggerEntry.clutter_text.connect('key-press-event', (actor, event) => {
            let sym = event.get_key_symbol();
            if (sym === Clutter.KEY_Down) { global.stage.set_key_focus(contentText.clutter_text); return Clutter.EVENT_STOP; }
            if (sym === Clutter.KEY_Up) { global.stage.set_key_focus(nameEntry); return Clutter.EVENT_STOP; }
            if (sym === Clutter.KEY_Return || sym === Clutter.KEY_KP_Enter) return Clutter.EVENT_STOP;
            return Clutter.EVENT_PROPAGATE;
        });
        contentText.clutter_text.connect('key-press-event', () => Clutter.EVENT_PROPAGATE);
    }

    lowerSectionBox.add_child(new St.Widget({ style: 'height: 1px; background-color: rgba(255,255,255,0.07); margin-bottom: 14px; margin-top: 14px;', x_expand: true }));

    let btnRow = new St.BoxLayout({ vertical: false, x_expand: true });
    let gap = new St.Widget({ x_expand: true });

    if (snippet) {
        let deleteBtn = new St.Button({ label: 'Delete', reactive: true, style_class: 'rudra-btn-delete' });
        deleteBtn.connect('clicked', () => { SnippetManager.delete(editingId); _redirectToSnippetList(); });
        btnRow.add_child(deleteBtn);
    }
    btnRow.add_child(gap);

    let cancelBtn = new St.Button({ label: '  Cancel  ', reactive: true, style_class: 'rudra-btn-cancel' });
    cancelBtn.connect('clicked', () => _redirectToSnippetList());
    btnRow.add_child(cancelBtn);

    let saveBtn = new St.Button({ label: snippet ? '  Update  ' : '  Save  ', reactive: true, style_class: 'rudra-btn-save-base', style: `background-color: ${colors.selColor};` });
    saveBtn.connect('clicked', () => {
        let name = nameEntry.get_text().trim(); let trigger = triggerEntry.get_text().trim(); let text = contentText.get_text().trim();
        let tagsStr = tagsEntry.get_text().trim(); let tagsArray = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
        if (!name || !trigger || !text) return;
        SnippetManager.save({ id: editingId || null, name, trigger, text, icon: currentSelectedIcon, tags: tagsArray });
        _redirectToSnippetList();
    });

    btnRow.add_child(saveBtn);
    lowerSectionBox.add_child(btnRow);
    ctx._snippetFormBox.add_child(lowerSectionBox);

    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => { if (nameEntry) global.stage.set_key_focus(nameEntry); return GLib.SOURCE_REMOVE; });
}