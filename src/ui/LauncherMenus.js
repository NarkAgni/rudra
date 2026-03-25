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

import { getTrigger } from '../core/QueryParser.js';
import { SnippetManager } from '../services/SnippetManager.js';
import { getCategories, getCategory, setCategory } from '../browsers/EmojiBrowser.js';
import { getIconCategories, getIconCategory, setIconCategory } from '../browsers/IconBrowser.js';


export function setupFilterMenu(ctx) {
    ctx._currentFilter = 'all';
    ctx._filterButton = new St.Button({
        reactive: true,
        can_focus: true,
        style_class: 'rudra-header-btn'
    });

    let filterButtonBox = new St.BoxLayout({ vertical: false, y_align: Clutter.ActorAlign.CENTER });
    ctx._filterIcon = new St.Icon({
        icon_name: 'system-search-symbolic',
        icon_size: 22,
        style: 'color: rgba(255, 255, 255, 0.7);',
        y_align: Clutter.ActorAlign.CENTER
    });
    let filterArrow = new St.Icon({
        icon_name: 'pan-down-symbolic',
        icon_size: 14,
        style: 'color: rgba(255, 255, 255, 0.4); margin-left: 4px;',
        y_align: Clutter.ActorAlign.CENTER
    });
    filterButtonBox.add_child(ctx._filterIcon);
    filterButtonBox.add_child(filterArrow);
    ctx._filterButton.set_child(filterButtonBox);
    ctx._headerBox.add_child(ctx._filterButton);

    ctx._filterMenuWrapper = new Clutter.Actor();
    ctx._filterMenu = new St.BoxLayout({
        vertical: true,
        visible: false,
        reactive: true,
        style_class: 'rudra-dropdown-menu',
        style: 'min-width: 170px;'
    });

    ctx._filterScroll = new St.ScrollView({ style: 'max-height: 380px; padding-right: 6px;' });
    ctx._filterScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
    ctx._filterScroll.set_overlay_scrollbars(false);
    ctx._filterScroll.add_style_class_name('rudra-scroll-clear');
    ctx._filterList = new St.BoxLayout({ vertical: true, x_expand: true });
    ctx._filterScroll.set_child(ctx._filterList);
    ctx._filterMenu.add_child(ctx._filterScroll);

    ctx._filterOptions = [
        { id: 'all', name: 'All', icon: 'system-search-symbolic' },
        { id: 'ai', name: 'Ask AI', icon: 'system-run-symbolic' },
        { id: 'clipboard', name: 'Clipboard', icon: 'edit-paste-symbolic' },
        { id: 'snippets', name: 'Snippets', icon: 'text-x-generic-symbolic' },
        { id: 'plugins', name: 'Plugins', icon: 'application-x-executable-symbolic' },
        { id: 'icons', name: 'Icons', icon: 'color-select-symbolic' },
        { id: 'emojis', name: 'Emojis', icon: 'face-smile-symbolic' }
    ];

    ctx.rebuildFilterMenu = () => {
        if (!ctx._filterList) return;
        ctx._filterList.destroy_all_children();
        ctx._filterOptions.forEach(opt => {
            let itemBtn = new St.Button({ reactive: true, x_expand: true, style_class: 'rudra-menu-item' });

            let box = new St.BoxLayout({ vertical: false, x_expand: true });
            let checkIcon = new St.Icon({
                icon_name: 'object-select-symbolic',
                icon_size: 14,
                style: `color: ${ctx._currentFilter === opt.id ? '#7aa2f7' : 'transparent'}; margin-right: 10px;`,
                y_align: Clutter.ActorAlign.CENTER
            });
            let optIcon = new St.Icon({
                icon_name: opt.icon,
                icon_size: 16,
                style: 'color: #dddddd; margin-right: 10px;',
                y_align: Clutter.ActorAlign.CENTER
            });
            let label = new St.Label({
                text: opt.name,
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'rudra-menu-label-bold'
            });

            box.add_child(checkIcon);
            box.add_child(optIcon);
            box.add_child(label);
            itemBtn.set_child(box);

            itemBtn.connect('clicked', () => {
                ctx._currentFilter = opt.id;
                ctx._filterIcon.set_icon_name(opt.icon);
                ctx.rebuildFilterMenu();
                ctx._filterMenu.hide();

                if (opt.id === 'emojis') ctx._entry.set_hint_text('Search emojis...');
                else if (opt.id === 'icons') ctx._entry.set_hint_text('Search icons...');
                else if (opt.id === 'clipboard') ctx._entry.set_hint_text('Search clipboard...');
                else if (opt.id === 'snippets') ctx._entry.set_hint_text('Search snippets...');
                else if (opt.id === 'plugins') ctx._entry.set_hint_text('Search plugins...');
                else if (opt.id === 'ai') ctx._entry.set_hint_text('Ask AI...');
                else ctx._entry.set_hint_text('Search apps...');

                if (opt.id === 'emojis' || opt.id === 'icons') {
                    ctx._categoryButton.show();
                    ctx._viewToggleBox.show();
                    ctx.rebuildCategoryMenu();
                } else {
                    ctx._categoryButton.hide();
                    ctx._viewToggleBox.hide();
                }

                if (opt.id === 'snippets') {
                    ctx._tagButton.show();
                } else {
                    ctx._tagButton.hide();
                    if (ctx._tagMenu) ctx._tagMenu.hide();
                    SnippetManager.setTagFilter('All');
                    if (ctx._tagLabel) ctx._tagLabel.set_text('All Tags');
                }

                let queryText = '';
                if (opt.id === 'icons') queryText = getTrigger(ctx._settings, 'trigger-icon');
                else if (opt.id === 'emojis') queryText = getTrigger(ctx._settings, 'trigger-emoji');
                else if (opt.id === 'clipboard') queryText = getTrigger(ctx._settings, 'trigger-clipboard');
                else if (opt.id === 'snippets') queryText = '!';
                else if (opt.id === 'plugins') queryText = getTrigger(ctx._settings, 'trigger-plugin');
                else if (opt.id === 'ai') queryText = getTrigger(ctx._settings, 'trigger-ai');

                ctx._updatingEntry = true;
                ctx._entry.set_text('');
                ctx._userTypedText = '';
                ctx._updatingEntry = false;

                if (ctx._resultsView) ctx._resultsView.update(queryText);
            });
            ctx._filterList.add_child(itemBtn);
        });
    };

    ctx.rebuildFilterMenu();
    ctx._filterMenuWrapper.add_child(ctx._filterMenu);
    ctx._container.add_child(ctx._filterMenuWrapper);

    ctx._filterButton.connect('clicked', () => {
        if (ctx._filterMenu.visible) {
            ctx._filterMenu.hide();
        } else {
            if (ctx._categoryMenu) ctx._categoryMenu.hide();
            if (ctx._tagMenu) ctx._tagMenu.hide();
            let [bx, by] = ctx._filterButton.get_transformed_position();
            let [, bh] = ctx._filterButton.get_transformed_size();
            ctx._filterMenuWrapper.set_position(bx, by + bh + 8);
            ctx._filterMenu.show();
            ctx._container.set_child_above_sibling(ctx._filterMenuWrapper, null);
        }
    });
}

export function setupViewToggle(ctx) {
    ctx._viewToggleBox = new St.BoxLayout({
        vertical: false,
        visible: false,
        style_class: 'rudra-view-toggle',
        style: 'margin-right: 12px; background-color: rgba(255,255,255,0.05); border-radius: 20px; padding: 3px;',
        y_align: Clutter.ActorAlign.CENTER
    });

    ctx._gridBtn = new St.Button({
        reactive: true,
        can_focus: true,
        style: 'padding: 8px 16px; border-radius: 18px; background-color: rgba(122, 162, 247, 0.15);'
    });
    ctx._gridIcon = new St.Icon({ icon_name: 'view-grid-symbolic', icon_size: 16, style: 'color: white;' });
    ctx._gridBtn.set_child(ctx._gridIcon);

    ctx._listBtn = new St.Button({
        reactive: true,
        can_focus: true,
        style: 'padding: 8px 16px; border-radius: 18px; background-color: transparent;'
    });
    ctx._listIcon = new St.Icon({ icon_name: 'view-list-symbolic', icon_size: 16, style: 'color: rgba(122, 162, 247, 0.7);' });
    ctx._listBtn.set_child(ctx._listIcon);

    ctx._gridBtn.connect('clicked', () => {
        if (ctx._resultsView) ctx._resultsView.viewMode = 'grid';

        ctx._gridBtn.set_style('padding: 8px 16px; border-radius: 18px; background-color: rgba(122, 162, 247, 0.15);');
        ctx._gridIcon.set_style('color: white;');
        ctx._listBtn.set_style('padding: 8px 16px; border-radius: 18px; background-color: transparent;');
        ctx._listIcon.set_style('color: rgba(122, 162, 247, 0.7);');

        let text = ctx._entry.get_text();
        let queryText = text;
        let tIc = getTrigger(ctx._settings, 'trigger-icon');
        let tEm = getTrigger(ctx._settings, 'trigger-emoji');
        if (ctx._currentFilter === 'icons' && !text.startsWith(tIc)) queryText = tIc + text;
        if (ctx._currentFilter === 'emojis' && !text.startsWith(tEm)) queryText = tEm + text;
        if (ctx._resultsView) ctx._resultsView.update(queryText);
    });

    ctx._listBtn.connect('clicked', () => {
        if (ctx._resultsView) ctx._resultsView.viewMode = 'list';

        ctx._listBtn.set_style('padding: 8px 16px; border-radius: 18px; background-color: rgba(122, 162, 247, 0.15);');
        ctx._listIcon.set_style('color: white;');
        ctx._gridBtn.set_style('padding: 8px 16px; border-radius: 18px; background-color: transparent;');
        ctx._gridIcon.set_style('color: rgba(122, 162, 247, 0.7);');

        let text = ctx._entry.get_text();
        let queryText = text;
        let tIc = getTrigger(ctx._settings, 'trigger-icon');
        let tEm = getTrigger(ctx._settings, 'trigger-emoji');
        if (ctx._currentFilter === 'icons' && !text.startsWith(tIc)) queryText = tIc + text;
        if (ctx._currentFilter === 'emojis' && !text.startsWith(tEm)) queryText = tEm + text;
        if (ctx._resultsView) ctx._resultsView.update(queryText);
    });

    ctx._viewToggleBox.add_child(ctx._gridBtn);
    ctx._viewToggleBox.add_child(ctx._listBtn);
    ctx._headerBox.add_child(ctx._viewToggleBox);
}

export function setupCategoryMenu(ctx) {
    ctx._categoryButton = new St.Button({
        reactive: true,
        can_focus: true,
        visible: false,
        style_class: 'rudra-cat-btn'
    });

    let catBox = new St.BoxLayout({ vertical: false, y_align: Clutter.ActorAlign.CENTER });
    ctx._catLabel = new St.Label({
        text: 'All',
        style: 'color: rgba(255,255,255,0.9); font-size: 14px; font-weight: bold; margin-right: 6px;',
        y_align: Clutter.ActorAlign.CENTER
    });
    let catArrow = new St.Icon({
        icon_name: 'pan-down-symbolic',
        icon_size: 14,
        style: 'color: rgba(255, 255, 255, 0.4);',
        y_align: Clutter.ActorAlign.CENTER
    });
    catBox.add_child(ctx._catLabel);
    catBox.add_child(catArrow);
    ctx._categoryButton.set_child(catBox);
    ctx._headerBox.add_child(ctx._categoryButton);

    ctx._categoryMenuWrapper = new Clutter.Actor();
    ctx._categoryMenu = new St.BoxLayout({
        vertical: true,
        visible: false,
        reactive: true,
        style_class: 'rudra-dropdown-menu',
        style: 'min-width: 190px;'
    });

    ctx._categoryScroll = new St.ScrollView({ style: 'max-height: 380px; padding-right: 6px;' });
    ctx._categoryScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
    ctx._categoryScroll.set_overlay_scrollbars(false);
    ctx._categoryScroll.add_style_class_name('rudra-scroll-clear');
    ctx._categoryList = new St.BoxLayout({ vertical: true, x_expand: true });
    ctx._categoryScroll.set_child(ctx._categoryList);
    ctx._categoryMenu.add_child(ctx._categoryScroll);

    ctx.rebuildCategoryMenu = () => {
        if (!ctx._categoryList) return;
        ctx._categoryList.destroy_all_children();

        let categories, getCurrentCat, setCat;
        if (ctx._currentFilter === 'icons') {
            categories = getIconCategories();
            getCurrentCat = getIconCategory;
            setCat = setIconCategory;
        } else {
            categories = getCategories();
            getCurrentCat = getCategory;
            setCat = setCategory;
        }

        categories.forEach(cat => {
            let itemBtn = new St.Button({ reactive: true, x_expand: true, style_class: 'rudra-menu-item' });

            let box = new St.BoxLayout({ vertical: false, x_expand: true });
            let isSelected = (getCurrentCat() === cat);
            let checkIcon = new St.Icon({
                icon_name: 'object-select-symbolic',
                icon_size: 14,
                style: `color: ${isSelected ? '#7aa2f7' : 'transparent'}; margin-right: 10px;`,
                y_align: Clutter.ActorAlign.CENTER
            });
            let label = new St.Label({
                text: cat,
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'rudra-menu-label',
                style: isSelected ? 'font-weight: bold; color: #fff;' : 'color: #eee;'
            });

            box.add_child(checkIcon);
            box.add_child(label);
            itemBtn.set_child(box);

            itemBtn.connect('clicked', () => {
                setCat(cat);
                ctx._catLabel.set_text(cat);
                ctx.rebuildCategoryMenu();
                ctx._categoryMenu.hide();

                let currentText = ctx._entry.get_text();
                let queryText = currentText;
                let tIc = getTrigger(ctx._settings, 'trigger-icon');
                let tEm = getTrigger(ctx._settings, 'trigger-emoji');
                if (ctx._currentFilter === 'icons' && !currentText.startsWith(tIc)) queryText = tIc + currentText;
                if (ctx._currentFilter === 'emojis' && !currentText.startsWith(tEm)) queryText = tEm + currentText;
                if (ctx._resultsView) ctx._resultsView.update(queryText);
            });
            ctx._categoryList.add_child(itemBtn);
        });
    };

    ctx.rebuildCategoryMenu();
    ctx._categoryMenuWrapper.add_child(ctx._categoryMenu);
    ctx._container.add_child(ctx._categoryMenuWrapper);

    ctx._categoryButton.connect('clicked', () => {
        if (ctx._categoryMenu.visible) {
            ctx._categoryMenu.hide();
        } else {
            if (ctx._filterMenu) ctx._filterMenu.hide();
            if (ctx._tagMenu) ctx._tagMenu.hide();
            ctx.rebuildCategoryMenu();
            let [bx, by] = ctx._categoryButton.get_transformed_position();
            let [bw, bh] = ctx._categoryButton.get_transformed_size();
            ctx._categoryMenuWrapper.set_position(bx + bw - 190, by + bh + 8);
            ctx._categoryMenu.show();
            ctx._container.set_child_above_sibling(ctx._categoryMenuWrapper, null);
        }
    });
}

export function setupTagMenu(ctx) {
    ctx._tagButton = new St.Button({
        reactive: true,
        can_focus: true,
        visible: false,
        style_class: 'rudra-cat-btn'
    });

    let tagBoxBox = new St.BoxLayout({ vertical: false, y_align: Clutter.ActorAlign.CENTER });
    ctx._tagLabel = new St.Label({
        text: 'All Tags',
        style: 'color: rgba(255,255,255,0.9); font-size: 14px; font-weight: bold; margin-right: 6px;',
        y_align: Clutter.ActorAlign.CENTER
    });
    let tagArrow2 = new St.Icon({
        icon_name: 'pan-down-symbolic',
        icon_size: 14,
        style: 'color: rgba(255, 255, 255, 0.4);',
        y_align: Clutter.ActorAlign.CENTER
    });
    tagBoxBox.add_child(new St.Icon({
        icon_name: 'tag-new-symbolic',
        icon_size: 14,
        style: 'color:rgba(255,255,255,0.6); margin-right:6px;',
        y_align: Clutter.ActorAlign.CENTER
    }));
    tagBoxBox.add_child(ctx._tagLabel);
    tagBoxBox.add_child(tagArrow2);
    ctx._tagButton.set_child(tagBoxBox);
    ctx._headerBox.add_child(ctx._tagButton);

    ctx._tagMenuWrapper = new Clutter.Actor();
    ctx._tagMenu = new St.BoxLayout({
        vertical: true,
        visible: false,
        reactive: true,
        style_class: 'rudra-dropdown-menu rudra-dropdown-menu-tag'
    });

    ctx._tagSearch = new St.Entry({
        hint_text: 'Search tags...',
        x_expand: true,
        style_class: 'rudra-menu-search'
    });
    ctx._tagMenu.add_child(ctx._tagSearch);

    ctx._tagScroll = new St.ScrollView({ style: 'max-height: 380px; padding-right: 6px;' });
    ctx._tagScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
    ctx._tagScroll.set_overlay_scrollbars(false);
    ctx._tagScroll.add_style_class_name('rudra-scroll-clear');
    ctx._tagList = new St.BoxLayout({ vertical: true, x_expand: true });
    ctx._tagScroll.set_child(ctx._tagList);
    ctx._tagMenu.add_child(ctx._tagScroll);

    ctx.rebuildTagMenu = () => {
        ctx._tagList.destroy_all_children();
        let q = ctx._tagSearch.get_text().toLowerCase();
        let tags = SnippetManager.getUniqueTags().filter(t => t.toLowerCase().includes(q));

        tags.forEach(tag => {
            let itemBtn = new St.Button({ reactive: true, x_expand: true, style_class: 'rudra-menu-item' });
            let box = new St.BoxLayout({ vertical: false, x_expand: true });
            let isSelected = SnippetManager.getTagFilter() === tag;
            let checkIcon = new St.Icon({
                icon_name: 'object-select-symbolic',
                icon_size: 14,
                style: `color: ${isSelected ? '#7aa2f7' : 'transparent'}; margin-right: 10px;`,
                y_align: Clutter.ActorAlign.CENTER
            });
            let label = new St.Label({
                text: tag,
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'rudra-menu-label',
                style: isSelected ? 'font-weight: bold; color: #fff;' : 'color: #ccc;'
            });

            box.add_child(checkIcon);
            box.add_child(label);
            itemBtn.set_child(box);

            itemBtn.connect('clicked', () => {
                    SnippetManager.setTagFilter(tag);
                    ctx._tagLabel.set_text(tag.length > 12 ? tag.substring(0, 10) + '..' : tag);
                    ctx._tagMenu.hide();

                    let text = ctx._entry.get_text();
                    let queryText = text;
                    let tSn = '!';
                    if (ctx._currentFilter === 'snippets' && !text.startsWith(tSn)) queryText = tSn + text;
                    if (ctx._resultsView) ctx._resultsView.update(queryText);
                });
            ctx._tagList.add_child(itemBtn);
        });
    };

    ctx._tagSearch.clutter_text.connect('text-changed', ctx.rebuildTagMenu);

    ctx._tagButton.connect('clicked', () => {
        if (ctx._tagMenu.visible) {
            ctx._tagMenu.hide();
        } else {
            if (ctx._filterMenu) ctx._filterMenu.hide();
            if (ctx._categoryMenu) ctx._categoryMenu.hide();
            ctx._tagSearch.set_text('');
            ctx.rebuildTagMenu();
            let [bx, by] = ctx._tagButton.get_transformed_position();
            let [bw, bh] = ctx._tagButton.get_transformed_size();
            ctx._tagMenuWrapper.set_position(bx + bw - 250, by + bh + 8);
            ctx._tagMenu.show();
            ctx._container.set_child_above_sibling(ctx._tagMenuWrapper, null);
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                ctx._tagSearch.grab_key_focus();
                return GLib.SOURCE_REMOVE;
            });
        }
    });

    ctx._tagMenuWrapper.add_child(ctx._tagMenu);
    ctx._container.add_child(ctx._tagMenuWrapper);
}