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

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Pango from 'gi://Pango';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { showKeybindingDialog } from './src/prefs/ShortcutDialog.js';


export default class RudraPreferences extends ExtensionPreferences {

    fillPreferencesWindow(window) {
        this._settingsSignals = [];
        this.settings = this.getSettings();

        window.add(this._createGeneralPage(window));
        window.add(this._createAppearancePage());
        window.add(this._createTriggersPage());
        window.add(this._createAIPage());
        window.add(this._createAboutPage(window));

        window.connect('destroy', () => {
            this._settingsSignals.forEach(id => this.settings.disconnect(id));
            this._settingsSignals = [];
        });
    }

    _createGeneralPage(window) {
        const page = new Adw.PreferencesPage({ title: 'General', icon_name: 'preferences-system-symbolic' });

        const shortcutGroup = new Adw.PreferencesGroup({ title: 'Shortcuts' });

        const shortcutRow = new Adw.ActionRow({
            title: 'Toggle Rudra',
            subtitle: 'Shortcut to open and close the launcher',
            icon_name: 'input-keyboard-symbolic'
        });
        const shortcutLabel = new Gtk.ShortcutLabel({ disabled_text: 'Disabled', valign: Gtk.Align.CENTER });
        shortcutLabel.set_accelerator(this.settings.get_strv('toggle-launcher')[0] || '');
        this._bindSignal('toggle-launcher', () =>
            shortcutLabel.set_accelerator(this.settings.get_strv('toggle-launcher')[0] || ''));
        const editBtn = new Gtk.Button({
            icon_name: 'document-edit-symbolic', valign: Gtk.Align.CENTER,
            css_classes: ['flat', 'circular'], tooltip_text: 'Edit Shortcut'
        });
        editBtn.connect('clicked', () => showKeybindingDialog(window, this.settings));
        shortcutRow.add_suffix(shortcutLabel);
        shortcutRow.add_suffix(editBtn);
        shortcutGroup.add(shortcutRow);

        page.add(shortcutGroup);

        const searchGroup = new Adw.PreferencesGroup({ title: 'Search' });
        const fuzzyRow = new Adw.SwitchRow({
            title: 'Fuzzy Search', subtitle: 'Finds apps even with typos', icon_name: 'edit-find-symbolic'
        });
        this.settings.bind('enable-fuzzy-search', fuzzyRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        searchGroup.add(fuzzyRow);
        this._addSpinRow(searchGroup, 'max-results', 'Max Results', 'Maximum results to fetch', 'view-list-symbolic', 1, 50);
        this._addSpinRow(searchGroup, 'visible-results', 'Visible Rows', 'Rows shown before scrolling', 'format-justify-fill-symbolic', 1, 20);
        this._addSpinRow(searchGroup, 'clipboard-history-size', 'Clipboard History Size', 'Number of items to keep in history', 'edit-paste-symbolic', 10, 500, 10);
        page.add(searchGroup);

        return page;
    }

    _createTriggersPage() {
        const page = new Adw.PreferencesPage({ title: 'Triggers', icon_name: 'terminal-symbolic' });
        const group = new Adw.PreferencesGroup({ title: 'Custom Commands', description: 'Change the prefix used to trigger features. (Must be unique!)' });

        const triggers = [
            { key: 'trigger-ai', title: 'Ask AI' },
            { key: 'trigger-clipboard', title: 'Clipboard History' },
            { key: 'trigger-plugin', title: 'Plugins' },
            { key: 'trigger-icon', title: 'Icon Browser' },
            { key: 'trigger-emoji', title: 'Emoji Browser' },
            { key: 'trigger-google', title: 'Google Search' },
            { key: 'trigger-youtube', title: 'YouTube Search' },
            { key: 'trigger-ddg', title: 'DuckDuckGo Search' },
            { key: 'trigger-wiki', title: 'Wikipedia Search' },
            { key: 'trigger-perplexity', title: 'Perplexity Search' },
            { key: 'trigger-cohere', title: 'Cohere Search' }
        ];

        let rows = [];

        const validateTriggers = () => {
            let values = triggers.map(t => this.settings.get_string(t.key).trim());
            rows.forEach((row, idx) => {
                let val = values[idx];
                if (!val) { row.add_css_class('error'); return; }
                let count = values.filter(v => v === val).length;
                if (count > 1) {
                    row.add_css_class('error');
                } else {
                    row.remove_css_class('error');
                }
            });
        };

        triggers.forEach(t => {
            const row = new Adw.EntryRow({ title: t.title });
            this.settings.bind(t.key, row, 'text', Gio.SettingsBindFlags.DEFAULT);
            row.connect('changed', validateTriggers);
            row.add_suffix(this._makeResetBtn(t.key));
            group.add(row);
            rows.push(row);
        });

        validateTriggers();
        page.add(group);
        return page;
    }

    _createAppearancePage() {
        const page = new Adw.PreferencesPage({ title: 'Appearance', icon_name: 'preferences-desktop-appearance-symbolic' });

        const typographyGroup = new Adw.PreferencesGroup({
            title: 'Typography',
            description: 'Font used for result titles and descriptions'
        });

        const rowFont = new Adw.ActionRow({
            title: 'Font Family', subtitle: 'Typeface for result text',
            icon_name: 'preferences-desktop-font-symbolic'
        });
        const fontDialog = new Gtk.FontDialog();
        const fontBtn = new Gtk.FontDialogButton({
            dialog: fontDialog, valign: Gtk.Align.CENTER, use_font: true, use_size: false
        });
        rowFont.add_suffix(fontBtn);
        typographyGroup.add(rowFont);

        const rowFontSize = new Adw.ActionRow({
            title: 'Font Size', 
            subtitle: 'Size of result text in points',
            icon_name: 'font-select-symbolic'
        });

        const fontSizeSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 8, upper: 32, step_increment: 1 }),
            numeric: true, 
            valign: Gtk.Align.CENTER
        });
        rowFontSize.add_suffix(fontSizeSpin);

        let isInternalUpdate = false;

        const syncFontUI = () => {
            isInternalUpdate = true;
            const raw = this.settings.get_string('font-name') || 'Cantarell 13';
            const desc = Pango.FontDescription.from_string(raw);
            fontBtn.set_font_desc(desc);
            const sizePt = desc.get_size_is_absolute() ? desc.get_size() : desc.get_size() / 1024;
            fontSizeSpin.set_value(sizePt > 0 ? sizePt : 13);
            isInternalUpdate = false;
        };

        const saveFont = () => {
            if (isInternalUpdate) return;
            let desc = fontBtn.get_font_desc();
            if (!desc) desc = Pango.FontDescription.from_string('Cantarell 13');
            desc.set_size(Math.round(fontSizeSpin.get_value()) * 1024);
            this.settings.set_string('font-name', desc.to_string());
        };

        syncFontUI();
        this._bindSignal('font-name', syncFontUI);
        fontBtn.connect('notify::font-desc', saveFont);
        
        fontSizeSpin.connect('notify::value', saveFont);
        
        rowFontSize.add_suffix(this._makeResetBtn('font-name'));
        typographyGroup.add(rowFontSize);
        page.add(typographyGroup);

        const layoutGroup = new Adw.PreferencesGroup({
            title: 'Layout', description: 'Size and spacing of the launcher window'
        });
        this._addSpinRow(layoutGroup, 'launcher-width', 'Launcher Width', 'Width of the launcher in pixels', 'view-fullscreen-symbolic', 400, 1400, 10);
        this._addSpinRow(layoutGroup, 'corner-radius', 'Corner Radius', 'Roundness of launcher corners', 'computer-apple-ipad-symbolic', 0, 60);
        this._addSpinRow(layoutGroup, 'result-spacing', 'Item Spacing', 'Vertical space between result rows', 'format-indent-more-symbolic', 0, 20);
        page.add(layoutGroup);

        return page;
    }

    _createAIPage() {
        const page = new Adw.PreferencesPage({ title: 'AI Assistant', icon_name: 'system-run-symbolic' });

        const engineGroup = new Adw.PreferencesGroup({ 
            title: 'AI Engine (BYOK)',
            description: 'Choose your preferred AI and enter your personal API key. Your key stays on your device.'
        });

        const providerRow = new Adw.ComboRow({
            title: 'Select AI Provider',
            model: Gtk.StringList.new(['Google Gemini (Free)', 'Groq (Fastest)', 'Ollama (Local AI)', 'Perplexity (Smart)', 'Cohere (Free Web AI)'])
        });
        this.settings.bind('ai-provider', providerRow, 'selected', Gio.SettingsBindFlags.DEFAULT);
        engineGroup.add(providerRow);

        const geminiKeyRow = new Adw.PasswordEntryRow({ title: 'Gemini API Key' });
        this.settings.bind('ai-api-key-gemini', geminiKeyRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        engineGroup.add(geminiKeyRow);

        const groqKeyRow = new Adw.PasswordEntryRow({ title: 'Groq API Key' });
        this.settings.bind('ai-api-key-groq', groqKeyRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        engineGroup.add(groqKeyRow);

        const perpKeyRow = new Adw.PasswordEntryRow({ title: 'Perplexity API Key' });
        this.settings.bind('ai-api-key-perplexity', perpKeyRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        engineGroup.add(perpKeyRow);

        const cohereKeyRow = new Adw.PasswordEntryRow({ title: 'Cohere API Key' });
        this.settings.bind('ai-api-key-cohere', cohereKeyRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        engineGroup.add(cohereKeyRow);

        const updateVisibility = () => {
            let provider = this.settings.get_int('ai-provider');
            geminiKeyRow.visible = (provider === 0);
            groqKeyRow.visible = (provider === 1);
            perpKeyRow.visible = (provider === 3);
            cohereKeyRow.visible = (provider === 4);
        };
        
        this._bindSignal('ai-provider', updateVisibility);
        updateVisibility();
        page.add(engineGroup);

        const helpGroup = new Adw.PreferencesGroup({ title: 'Need Help?' });
        const helpRow = new Adw.ActionRow({
            title: 'How to get a free API Key?',
            subtitle: 'Open Rudra Launcher and type "? help" to read the guide.',
            icon_name: 'dialog-information-symbolic'
        });
        helpGroup.add(helpRow);
        page.add(helpGroup);

        return page;
    }

    _createAboutPage(window) {
        const page = new Adw.PreferencesPage({ title: 'About', icon_name: 'help-about-symbolic' });
        
        this._buildAboutHero(page); 
        this._buildAboutLinks(page, window); 
        this._buildAboutAuthor(page); 
        this._buildAboutDonations(page, window);
        
        return page;
    }

    _buildAboutHero(page) {
        const group = new Adw.PreferencesGroup(); 
        page.add(group);
        
        const heroBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL, spacing: 12, 
            halign: Gtk.Align.CENTER, margin_top: 24, margin_bottom: 12 
        });

        const logo = Gtk.Image.new_from_file(`${this.path}/icons/logo.svg`);
        logo.set_pixel_size(128); 
        heroBox.append(logo);
        
        heroBox.append(new Gtk.Label({ label: '<span size="xx-large" weight="bold">Rudra</span>', use_markup: true, margin_top: 8 }));
        heroBox.append(new Gtk.Label({ label: 'A lightning-fast launcher for GNOME Shell', css_classes: ['dim-label'], margin_bottom: 4 }));
        heroBox.append(new Gtk.Label({ label: 'Version 8  •  GPL-3.0', css_classes: ['dim-label', 'caption'] }));

        const row = new Adw.ActionRow(); 
        row.set_child(heroBox); 
        group.add(row);
    }

    _buildAboutLinks(page, window) {
        const group = new Adw.PreferencesGroup({ title: 'Links' }); 
        page.add(group);
        
        const addLink = (title, subtitle, icon, url) => {
            const row = new Adw.ActionRow({ title, subtitle, icon_name: icon, activatable: true });
            row.add_suffix(new Gtk.Image({ icon_name: 'adw-external-link-symbolic', valign: Gtk.Align.CENTER, css_classes: ['dim-label'] }));
            
            row.connect('activated', () => {
                Gio.AppInfo.launch_default_for_uri(url, window.get_display().get_app_launch_context());
            });
            group.add(row);
        };
        
        addLink('Gnome Extension', 'extensions.gnome.org/extension/9342/rudra/', 'system-software-install-symbolic', 'https://extensions.gnome.org/extension/9342/rudra/');
        addLink('GitHub Repository', 'github.com/narkagni/rudra', 'system-software-install-symbolic', 'https://github.com/narkagni/rudra');
    }

    _buildAboutAuthor(page) {
        const group = new Adw.PreferencesGroup({ title: 'Credits' }); 
        page.add(group);
        group.add(new Adw.ActionRow({ title: 'Narkagni', subtitle: 'Author &amp; Maintainer', icon_name: 'avatar-default-symbolic' }));
        group.add(new Adw.ActionRow({ title: 'Features', subtitle: 'App search · File hunt (.) · Command runner (>) · Google (g ) · YouTube (yt )', icon_name: 'starred-symbolic' }));
        group.add(new Adw.ActionRow({ title: 'Disclaimer', subtitle: 'Not affiliated with Google or YouTube', icon_name: 'dialog-information-symbolic' }));
    }

    _buildAboutDonations(page, window) {
        const group = new Adw.PreferencesGroup({ 
            title: 'Support Development', 
            description: 'If you enjoy Rudra, consider buying me a coffee ☕ or sending crypto!' 
        }); 
        page.add(group);
        
        const coffeeRow = new Adw.ActionRow({ 
            title: 'Buy Me a Coffee', 
            subtitle: 'buymeacoffee.com/narkagni', 
            icon_name: 'emoji-food-symbolic', 
            activatable: true 
        });
        coffeeRow.add_suffix(new Gtk.Image({ icon_name: 'adw-external-link-symbolic', valign: Gtk.Align.CENTER, css_classes: ['dim-label'] }));
        coffeeRow.connect('activated', () => {
            Gio.AppInfo.launch_default_for_uri('https://buymeacoffee.com/narkagni', window.get_display().get_app_launch_context());
        });
        group.add(coffeeRow);

        const addCrypto = (coin, icon, address) => {
            let shortAddress = address;
            if (address.length > 24) {
                shortAddress = address.substring(0, 12) + '…' + address.slice(-8);
            }
            
            const row = new Adw.ActionRow({ title: coin, subtitle: shortAddress, icon_name: icon });
            const copyBtn = new Gtk.Button({ 
                icon_name: 'edit-copy-symbolic', 
                valign: Gtk.Align.CENTER, 
                css_classes: ['flat', 'circular'], 
                tooltip_text: `Copy ${coin} address` 
            });
            
            copyBtn.connect('clicked', () => {
                window.get_display().get_clipboard().set_content(Gdk.ContentProvider.new_for_value(address));
                try { 
                    window.add_toast(new Adw.Toast({ title: `${coin} address copied!`, timeout: 2 })); 
                } catch (error) {}
            });
            
            row.add_suffix(copyBtn); 
            group.add(row);
        };

        addCrypto('Bitcoin (BTC)', 'security-high-symbolic', '1GSHkxfhYjk1Qe4AQSHg3aRN2jg2GQWAcV');
        addCrypto('Ethereum (ETH)', 'emblem-shared-symbolic', '0xf43c3f83e53495ea06676c0d9d4fc87ce627ffa3');
        addCrypto('Tether (USDT - TRC20)', 'security-medium-symbolic', 'THnqG9nchLgaf1LzGK3CqdmNpRxw59hs82');
    }

    _bindSignal(key, callback) {
        this._settingsSignals.push(this.settings.connect(`changed::${key}`, callback));
    }

    _makeResetBtn(key) {
        const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, valign: Gtk.Align.CENTER });
        const divider = new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL });
        divider.set_margin_top(8); divider.set_margin_bottom(8);
        box.append(divider);
        const btn = new Gtk.Button({
            icon_name: 'edit-undo-symbolic', valign: Gtk.Align.CENTER,
            css_classes: ['flat', 'circular'], tooltip_text: 'Reset to default'
        });
        const updateBtnState = () => {
            const isDef = this.settings.get_value(key).equal(this.settings.get_default_value(key));
            btn.set_sensitive(!isDef);
            btn.set_opacity(isDef ? 0.3 : 1.0);
        };
        btn.connect('clicked', () => this.settings.reset(key));
        this._bindSignal(key, updateBtnState);
        updateBtnState();
        box.append(btn);
        return box;
    }

    _addSpinRow(group, key, title, subtitle, icon, min, max, step = 1) {
        const row = new Adw.ActionRow({ title, subtitle, icon_name: icon });
        const spinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: min, upper: max, step_increment: step }),
            numeric: true, valign: Gtk.Align.CENTER
        });
        this.settings.bind(key, spinButton, 'value', Gio.SettingsBindFlags.DEFAULT);
        row.add_suffix(spinButton);
        row.add_suffix(this._makeResetBtn(key));
        group.add(row);
    }
}