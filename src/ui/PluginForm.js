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

import { PLUGIN_GUIDE_TEXT } from '../data/PluginGuide.js';
import { readPlugin, savePlugin, deletePlugin } from '../services/PluginManager.js';


export function showPluginForm(ctx, filename = null) {
    ctx.prepareFormBox();
    const _redirectToPluginList = () => ctx.closeFormBox();

    let colors = ctx._getColors();
    const makeLabel = (text) => new St.Label({ text, style_class: 'rudra-form-label' });

    let titleRow = ctx.createFormTitleRow(filename ? 'Edit Plugin' : 'New Plugin', _redirectToPluginList);
    ctx._snippetFormBox.add_child(titleRow);

    let nameCol = new St.BoxLayout({ vertical: true, x_expand: true, style: 'margin-bottom: 14px;' });
    nameCol.add_child(makeLabel('FILENAME (must end with .py or .sh)'));
    let nameEntry = new St.Entry({ hint_text: 'e.g. weather.py', can_focus: true, x_expand: true, style_class: 'rudra-form-entry' });
    if (filename) nameEntry.set_text(filename);
    nameCol.add_child(nameEntry);
    ctx._snippetFormBox.add_child(nameCol);

    ctx._snippetFormBox.add_child(makeLabel('SCRIPT CODE'));
    let contentScroll = new St.ScrollView({ x_expand: true, style: 'background: transparent; border: none; min-height: 150px; max-height: 200px;' });
    contentScroll.add_style_class_name('rudra-editor-wrapper');
    contentScroll.set_policy(St.PolicyType.AUTOMATIC, St.PolicyType.AUTOMATIC);
    contentScroll.set_overlay_scrollbars(false);

    let contentText = new St.Entry({ hint_text: '# Write your code here...\n# Make sure it returns a JSON array!', can_focus: true, x_expand: true, style_class: 'rudra-editor-entry' });
    try {
        contentText.clutter_text.single_line_mode = false; contentText.clutter_text.line_wrap = false;
        contentText.clutter_text.activatable = false; contentText.clutter_text.ellipsize = 0;
        contentText.clutter_text.cursor_visible = true; contentText.clutter_text.cursor_size = 2;
        contentText.clutter_text.cursor_color = new Clutter.Color({ red: 122, green: 162, blue: 247, alpha: 255 });
    } catch (e) { }

    if (filename) contentText.set_text(readPlugin(filename));

    const _updatePluginHeight = (scrollToCursor = false) => {
        GLib.idle_add(GLib.PRIORITY_LOW, () => {
            try {
                let scrollW = contentScroll.get_width();
                let [, natH] = contentText.clutter_text.get_preferred_height(scrollW > 24 ? scrollW - 24 : scrollW);
                if (natH > 0) { contentText.set_height(natH + 24); contentText.natural_height = natH + 24; }
                let adj = contentScroll.get_vadjustment ? contentScroll.get_vadjustment() : contentScroll.vadjustment;
                if (adj && scrollToCursor) {
                    try {
                        let cursorRect = contentText.clutter_text.get_cursor_rect();
                        let cursorY = cursorRect.origin.y + cursorRect.size.height;
                        let cursorTop = cursorRect.origin.y;
                        let val = adj.get_value(); let pageSize = adj.get_page_size();
                        if (cursorY > val + pageSize - 4) adj.set_value(Math.min(adj.upper - pageSize, cursorY - pageSize + 20));
                        else if (cursorTop < val + 4) adj.set_value(Math.max(0, cursorTop - 10));
                    } catch (e) { }
                }
            } catch (e) { }
            return GLib.SOURCE_REMOVE;
        });
    };
    contentText.clutter_text.connect('text-changed', () => _updatePluginHeight(true));
    contentText.clutter_text.connect('cursor-changed', () => _updatePluginHeight(true));

    let entryWrapperBox = new St.BoxLayout({ vertical: true, x_expand: true });
    entryWrapperBox.add_child(contentText);
    contentScroll.set_child(entryWrapperBox);
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => { _updatePluginHeight(); return GLib.SOURCE_REMOVE; });
    contentScroll.connect('button-press-event', () => { global.stage.set_key_focus(contentText.clutter_text); return Clutter.EVENT_STOP; });
    ctx._snippetFormBox.add_child(contentScroll);

    let btnRow = new St.BoxLayout({ vertical: false, x_expand: true });
    let gap = new St.Widget({ x_expand: true });

    if (filename) {
        let deleteBtn = new St.Button({ label: 'Delete', reactive: true, style_class: 'rudra-btn-delete' });
        deleteBtn.connect('clicked', () => { deletePlugin(filename); _redirectToPluginList(); });
        btnRow.add_child(deleteBtn);
    }
    btnRow.add_child(gap);

    let cancelBtn = new St.Button({ label: 'Cancel', reactive: true, style_class: 'rudra-btn-cancel' });
    cancelBtn.connect('clicked', () => _redirectToPluginList());
    btnRow.add_child(cancelBtn);

    let saveBtn = new St.Button({ label: filename ? '  Update  ' : '  Save  ', reactive: true, style_class: 'rudra-btn-save-base', style: `background-color: ${colors.selColor};` });
    saveBtn.connect('clicked', () => {
        let fname = nameEntry.get_text().trim(); let code = contentText.get_text();
        if (!fname || (!fname.endsWith('.py') && !fname.endsWith('.sh'))) { nameEntry.style = 'border: 1px solid #f7768e;'; return; }
        if (fname.includes('/') || fname.includes('..') || fname.includes('\\')) { nameEntry.style = 'border: 1px solid #f7768e;'; return; }
        if (filename && filename !== fname) deletePlugin(filename);
        savePlugin(fname, code);
        _redirectToPluginList();
    });
    btnRow.add_child(saveBtn);
    ctx._snippetFormBox.add_child(btnRow);

    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        if (!filename) global.stage.set_key_focus(nameEntry);
        else global.stage.set_key_focus(contentText.clutter_text);
        return GLib.SOURCE_REMOVE;
    });
}

export function showPluginGuide(ctx) {
    ctx._pluginGuideActive = true;
    ctx.prepareFormBox();
    const _redirectToPluginList = () => ctx.closeFormBox();

    let titleRow = ctx.createFormTitleRow('Plugin Developer Guide', _redirectToPluginList);
    ctx._snippetFormBox.add_child(titleRow);

    let guideScroll = new St.ScrollView({ x_expand: true, style: 'min-height: 300px; max-height: 400px;' });
    guideScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
    guideScroll.set_overlay_scrollbars(false);
    guideScroll.add_style_class_name('rudra-scroll-clear');

    let guideLabel = new St.Entry({ can_focus: true, reactive: true, x_expand: true, style_class: 'rudra-guide-text', style: 'background: transparent; border: none; box-shadow: none;' });
    try {
        guideLabel.clutter_text.single_line_mode = false; guideLabel.clutter_text.line_wrap = true;
        guideLabel.clutter_text.line_wrap_mode = 2; guideLabel.clutter_text.editable = false;
        guideLabel.clutter_text.selectable = true; guideLabel.clutter_text.use_markup = true;
    } catch (e) { }
    guideLabel.clutter_text.set_markup(PLUGIN_GUIDE_TEXT);

    let guideBox = new St.BoxLayout({ vertical: true, x_expand: true });
    guideBox.add_child(guideLabel);
    guideScroll.set_child(guideBox);
    ctx._snippetFormBox.add_child(guideScroll);

    let lastH = 0;
    const _updateGuideHeight = () => {
        GLib.idle_add(GLib.PRIORITY_LOW, () => {
            try {
                let w = guideLabel.get_width();
                if (w > 20) {
                    let [, natH] = guideLabel.clutter_text.get_preferred_height(w);
                    let newH = natH + 40;
                    if (Math.abs(lastH - newH) > 5) { lastH = newH; guideLabel.set_height(newH); }
                }
            } catch (e) { }
            return GLib.SOURCE_REMOVE;
        });
    };
    guideLabel.connect('notify::allocation', _updateGuideHeight);
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => { _updateGuideHeight(); return GLib.SOURCE_REMOVE; });

    guideLabel.clutter_text.connect('cursor-changed', () => {
        GLib.idle_add(GLib.PRIORITY_LOW, () => {
            try {
                let adj = guideScroll.get_vadjustment ? guideScroll.get_vadjustment() : guideScroll.vadjustment;
                if (!adj) return GLib.SOURCE_REMOVE;
                let cursorRect = guideLabel.clutter_text.get_cursor_rect();
                let [, elY] = guideLabel.get_transformed_position();
                let [, scY] = guideScroll.get_transformed_position();
                let relativeY = (elY - scY) + adj.get_value();
                let cursorTop = relativeY + cursorRect.origin.y;
                let cursorBottom = cursorTop + cursorRect.size.height;
                let val = adj.get_value(); let pageSize = adj.get_page_size();
                if (cursorBottom > val + pageSize - 10) adj.set_value(Math.min(adj.upper - pageSize, cursorBottom - pageSize + 40));
                else if (cursorTop < val + 10) adj.set_value(Math.max(0, cursorTop - 40));
            } catch (e) { }
            return GLib.SOURCE_REMOVE;
        });
    });
}