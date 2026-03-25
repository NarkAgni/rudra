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

import { ClipboardManager } from '../services/ClipboardManager.js';


export function showClipboardEditForm(ctx, item) {
    ctx.prepareFormBox();
    const _redirectToClipboard = () => ctx.closeFormBox();

    let colors = ctx._getColors();
    let titleRow = ctx.createFormTitleRow('Edit Clipboard Item', _redirectToClipboard);
    ctx._snippetFormBox.add_child(titleRow);

    let contentLabel = new St.Label({ text: 'CONTENT', style_class: 'rudra-form-label' });
    ctx._snippetFormBox.add_child(contentLabel);

    let contentScroll = new St.ScrollView({ x_expand: true, style: 'background: transparent; border: none; box-shadow: none; min-height: 200px; max-height: 400px;' });
    contentScroll.add_style_class_name('rudra-editor-wrapper');
    contentScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
    contentScroll.set_overlay_scrollbars(false);

    let contentText = new St.Entry({ hint_text: 'Edit clipboard text...', can_focus: true, x_expand: true, style_class: 'rudra-editor-entry' });
    try {
        contentText.clutter_text.single_line_mode = false; contentText.clutter_text.line_wrap = true;
        contentText.clutter_text.line_wrap_mode = 2; contentText.clutter_text.activatable = false;
        contentText.clutter_text.ellipsize = 0; contentText.clutter_text.cursor_visible = true;
        contentText.clutter_text.cursor_size = 2; contentText.clutter_text.cursor_color = new Clutter.Color({ red: 122, green: 162, blue: 247, alpha: 255 });
    } catch (e) { }

    contentText.set_text(item.text || '');

    const _updateCbHeight = (scrollToCursor = false) => {
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
                            let cursorY = cursorRect.origin.y + cursorRect.size.height; let cursorTop = cursorRect.origin.y;
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
    contentText.clutter_text.connect('text-changed', () => _updateCbHeight(true));
    contentText.clutter_text.connect('cursor-changed', () => _updateCbHeight(true));

    let entryWrapperBox = new St.BoxLayout({ vertical: true, x_expand: true });
    entryWrapperBox.add_child(contentText); contentScroll.set_child(entryWrapperBox);
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => { _updateCbHeight(); return GLib.SOURCE_REMOVE; });
    contentScroll.connect('button-press-event', () => { global.stage.set_key_focus(contentText.clutter_text); return Clutter.EVENT_STOP; });
    ctx._snippetFormBox.add_child(contentScroll);

    ctx._snippetFormBox.add_child(new St.Widget({ style: 'height: 1px; background-color: rgba(255,255,255,0.07); margin-bottom: 14px;', x_expand: true }));

    let btnRow = new St.BoxLayout({ vertical: false, x_expand: true });
    btnRow.add_child(new St.Widget({ x_expand: true }));

    let cancelBtn = new St.Button({ label: '  Cancel  ', reactive: true, style_class: 'rudra-btn-cancel' });
    cancelBtn.connect('clicked', () => _redirectToClipboard());
    btnRow.add_child(cancelBtn);

    let saveBtn = new St.Button({ label: '  Save & Copy  ', reactive: true, style_class: 'rudra-btn-save-base', style: `background-color: ${colors.selColor};` });
    saveBtn.connect('clicked', () => {
        let newText = contentText.get_text();
        if (!newText.trim()) return;
        ClipboardManager.updateItem(item.text, newText);
        St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, newText);
        _redirectToClipboard();
    });
    btnRow.add_child(saveBtn); ctx._snippetFormBox.add_child(btnRow);

    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => { if (contentText) global.stage.set_key_focus(contentText.clutter_text); return GLib.SOURCE_REMOVE; });
}