import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Pango from 'gi://Pango';
import { showKeybindingDialog } from './src/prefs/ShortcutDialog.js';
import { makeResetBtn, makeGroupResetBtn } from './src/prefs/PrefsUtils.js';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


/**
 * The main preferences window controller for the Rudra extension.
 */
export default class RudraPreferences extends ExtensionPreferences {

    /**
     * Automatically called by GNOME Shell to build the preferences window.
     * @param {Adw.PreferencesWindow} window - The root preferences window.
     */
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        this._buildSettingsPage(window, settings);
        this._buildAboutPage(window);
    }


    /**
     * Builds the main settings page.
     * @param {Adw.PreferencesWindow} window - The parent window.
     * @param {Gio.Settings} settings - The settings object.
     * @private
     */
    _buildSettingsPage(window, settings) {
        const page = new Adw.PreferencesPage({ 
            title: 'Settings', 
            icon_name: 'preferences-system-symbolic' 
        });
        window.add(page);

        this._buildShortcutsGroup(page, window, settings);
        this._buildAppearanceGroup(page, settings);
        this._buildColorsExpander(page, settings);
        this._buildMarginsExpander(page, settings);
        this._buildSearchExpander(page, settings);
    }


    /**
     * Builds the keyboard shortcut configuration section.
     * @param {Adw.PreferencesPage} page - The settings page.
     * @param {Adw.PreferencesWindow} window - The parent window for dialogs.
     * @param {Gio.Settings} settings - The settings object.
     * @private
     */
    _buildShortcutsGroup(page, window, settings) {
        const group = new Adw.PreferencesGroup({ title: 'Shortcuts' });
        page.add(group);

        const row = new Adw.ActionRow({ 
            title: 'Toggle Rudra', 
            subtitle: 'Shortcut to open/close the launcher', 
            icon_name: 'input-keyboard-symbolic' 
        });
        
        const shortcutLabel = new Gtk.ShortcutLabel({ 
            disabled_text: 'Disabled', 
            valign: Gtk.Align.CENTER 
        });
        shortcutLabel.set_accelerator(settings.get_strv('toggle-launcher')[0] || '');
        
        settings.connect('changed::toggle-launcher', () => {
            shortcutLabel.set_accelerator(settings.get_strv('toggle-launcher')[0] || '');
        });

        const editBtn = new Gtk.Button({ 
            icon_name: 'document-edit-symbolic', 
            valign: Gtk.Align.CENTER, 
            css_classes: ['flat', 'circular'], 
            tooltip_text: 'Edit Shortcut' 
        });
        editBtn.connect('clicked', () => {
            showKeybindingDialog(window, settings);
        });

        row.add_suffix(shortcutLabel); 
        row.add_suffix(editBtn); 
        group.add(row);
    }


    /**
     * Builds the font and corner radius settings section.
     * @param {Adw.PreferencesPage} page - The settings page.
     * @param {Gio.Settings} settings - The settings object.
     * @private
     */
    _buildAppearanceGroup(page, settings) {
        const group = new Adw.PreferencesGroup({ title: 'Appearance' });
        page.add(group);

        const rowFont = new Adw.ActionRow({ 
            title: 'Font Family', 
            subtitle: 'Choose the typeface', 
            icon_name: 'preferences-desktop-font-symbolic' 
        });
        const fontDialog = new Gtk.FontDialog();
        const fontBtn = new Gtk.FontDialogButton({ 
            dialog: fontDialog, 
            valign: Gtk.Align.CENTER, 
            use_font: true, 
            use_size: false 
        });
        rowFont.add_suffix(fontBtn); 
        group.add(rowFont);

        const rowFontSize = new Adw.SpinRow({ 
            title: 'Font Size', 
            subtitle: 'Adjust text size', 
            icon_name: 'format-text-bold-symbolic', 
            adjustment: new Gtk.Adjustment({ lower: 8, upper: 64, step_increment: 1 }) 
        });

        let isInternalUpdate = false;
        
        const syncFontUI = () => {
            isInternalUpdate = true;
            const desc = Pango.FontDescription.from_string(settings.get_string('font-name') || 'Sans 14');
            fontBtn.set_font_desc(desc);
            
            if (desc.get_size_is_absolute()) {
                rowFontSize.set_value(desc.get_size());
            } else {
                rowFontSize.set_value(desc.get_size() / 1024);
            }
            isInternalUpdate = false;
        };

        const saveFont = () => {
            if (isInternalUpdate === true) {
                return;
            }
            let desc = fontBtn.get_font_desc() || Pango.FontDescription.from_string('Sans 14');
            desc.set_size(rowFontSize.get_value() * 1024);
            settings.set_string('font-name', desc.to_string());
        };

        syncFontUI();
        settings.connect('changed::font-name', syncFontUI);
        fontBtn.connect('notify::font-desc', saveFont);
        rowFontSize.connect('notify::value', saveFont);
        rowFontSize.add_suffix(makeResetBtn(settings, 'font-name'));
        group.add(rowFontSize);

        const rowRadius = new Adw.SpinRow({ 
            title: 'Corner Roundness', 
            icon_name: 'object-select-symbolic', 
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 50, step_increment: 1 }) 
        });
        settings.bind('corner-radius', rowRadius, 'value', 0);
        rowRadius.add_suffix(makeResetBtn(settings, 'corner-radius'));
        group.add(rowRadius);
    }


    /**
     * Builds the colors and opacity settings inside an expander row.
     * @param {Adw.PreferencesPage} page - The settings page.
     * @param {Gio.Settings} settings - The settings object.
     * @private
     */
    _buildColorsExpander(page, settings) {
        const group = new Adw.PreferencesGroup();
        page.add(group);
        const keys = [
            'background-color', 'background-opacity', 'highlight-color', 
            'selection-color', 'selection-opacity', 'hover-color', 'hover-opacity'
        ];

        const expander = new Adw.ExpanderRow({ 
            title: 'Background &amp; Highlights', 
            icon_name: 'preferences-desktop-wallpaper-symbolic', 
            subtitle: 'Configure colors and opacity', 
            show_enable_switch: false 
        });
        expander.add_suffix(makeGroupResetBtn(settings, keys));
        group.add(expander);

        this._addColorRow(expander, settings, 'background-color', 'Background Color', 'format-fill-color-symbolic');

        const rowBgOpacity = new Adw.SpinRow({ 
            title: 'Background Opacity', 
            subtitle: '0 = Invisible, 255 = Opaque', 
            icon_name: 'image-filter-symbolic', 
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 255, step_increment: 5, page_increment: 10 }) 
        });
        settings.bind('background-opacity', rowBgOpacity, 'value', 0);
        rowBgOpacity.add_suffix(makeResetBtn(settings, 'background-opacity'));
        expander.add_row(rowBgOpacity);

        this._addColorRow(expander, settings, 'highlight-color', 'Highlight Color', 'format-text-color-symbolic');
        this._addColorWithOpacityRows(expander, settings, 'selection-color', 'selection-opacity', 'Selection Background', 'view-paged-symbolic');
        this._addColorWithOpacityRows(expander, settings, 'hover-color', 'hover-opacity', 'Hover Background', 'input-mouse-symbolic');
    }


    /**
     * Builds the screen margins settings inside an expander row.
     * @param {Adw.PreferencesPage} page - The settings page.
     * @param {Gio.Settings} settings - The settings object.
     * @private
     */
    _buildMarginsExpander(page, settings) {
        const group = new Adw.PreferencesGroup();
        page.add(group);
        const keys = ['margin-top', 'margin-bottom', 'margin-left', 'margin-right'];

        const expander = new Adw.ExpanderRow({ 
            title: 'Screen Position', 
            icon_name: 'view-restore-symbolic', 
            subtitle: 'Adjust distance from screen edges', 
            show_enable_switch: false 
        });
        expander.add_suffix(makeGroupResetBtn(settings, keys));
        group.add(expander);

        const addRow = (label, key, icon) => {
            const row = new Adw.SpinRow({ 
                title: label, 
                icon_name: icon, 
                adjustment: new Gtk.Adjustment({ lower: 0, upper: 2000, step_increment: 10 }) 
            });
            settings.bind(key, row, 'value', 0);
            row.add_suffix(makeResetBtn(settings, key));
            return row;
        };

        expander.add_row(addRow('Top', 'margin-top', 'go-up-symbolic'));
        expander.add_row(addRow('Bottom', 'margin-bottom', 'go-down-symbolic'));
        expander.add_row(addRow('Left', 'margin-left', 'go-previous-symbolic'));
        expander.add_row(addRow('Right', 'margin-right', 'go-next-symbolic'));
    }


    /**
     * Builds the search behavior settings inside an expander row.
     * @param {Adw.PreferencesPage} page - The settings page.
     * @param {Gio.Settings} settings - The settings object.
     * @private
     */
    _buildSearchExpander(page, settings) {
        const group = new Adw.PreferencesGroup();
        page.add(group);
        const keys = ['max-results', 'visible-results', 'result-spacing'];

        const expander = new Adw.ExpanderRow({ 
            title: 'Results &amp; Spacing', 
            icon_name: 'system-search-symbolic', 
            subtitle: 'Configure max results and spacing', 
            show_enable_switch: false 
        });
        expander.add_suffix(makeGroupResetBtn(settings, keys));
        group.add(expander);

        const addRow = (label, key, max, icon) => {
            const row = new Adw.SpinRow({ 
                title: label, 
                icon_name: icon, 
                adjustment: new Gtk.Adjustment({ lower: 0, upper: max, step_increment: 1 }) 
            });
            settings.bind(key, row, 'value', 0);
            row.add_suffix(makeResetBtn(settings, key));
            return row;
        };

        expander.add_row(addRow('Max Results', 'max-results', 50, 'view-list-symbolic'));
        expander.add_row(addRow('Visible Rows', 'visible-results', 20, 'format-justify-fill-symbolic'));
        expander.add_row(addRow('Item Spacing', 'result-spacing', 50, 'format-indent-more-symbolic'));
    }


    /**
     * Helper to create a solid color picker row.
     * @param {Adw.ExpanderRow} parent - The parent container.
     * @param {Gio.Settings} settings - The settings object.
     * @param {string} key - The settings key.
     * @param {string} title - The row title.
     * @param {string} icon - The icon name.
     * @private
     */
    _addColorRow(parent, settings, key, title, icon) {
        const row = new Adw.ActionRow({ title, icon_name: icon });
        const rgba = new Gdk.RGBA();
        
        if (!rgba.parse(settings.get_string(key))) {
            rgba.parse('#ffffff');
        }

        const colorButton = new Gtk.ColorDialogButton({ 
            dialog: new Gtk.ColorDialog(), 
            rgba: rgba, 
            valign: Gtk.Align.CENTER 
        });
        
        colorButton.connect('notify::rgba', () => {
            const color = colorButton.get_rgba();
            const toHex = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
            settings.set_string(key, `#${toHex(color.red)}${toHex(color.green)}${toHex(color.blue)}`);
        });

        settings.connect(`changed::${key}`, () => {
            const newRgba = new Gdk.RGBA();
            if (newRgba.parse(settings.get_string(key))) {
                colorButton.set_rgba(newRgba);
            }
        });

        row.add_suffix(colorButton); 
        parent.add_row(row);
    }


    /**
     * Helper to create a color picker row with an attached opacity slider.
     * @param {Adw.ExpanderRow} parent - The parent container.
     * @param {Gio.Settings} settings - The settings object.
     * @param {string} colorKey - The color settings key.
     * @param {string} opacityKey - The opacity settings key.
     * @param {string} title - The row title.
     * @param {string} icon - The icon name.
     * @private
     */
    _addColorWithOpacityRows(parent, settings, colorKey, opacityKey, title, icon) {
        const rowColor = new Adw.ActionRow({ title, icon_name: icon });
        const colorButton = new Gtk.ColorDialogButton({ dialog: new Gtk.ColorDialog(), valign: Gtk.Align.CENTER });

        const syncColor = () => {
            let hex = settings.get_string(colorKey) || '#4a6fa5';
            const rgba = new Gdk.RGBA(); 
            rgba.parse(hex.substring(0, 7)); 
            colorButton.set_rgba(rgba);
        };

        colorButton.connect('notify::rgba', () => {
            const color = colorButton.get_rgba();
            const toHex = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
            settings.set_string(colorKey, `#${toHex(color.red)}${toHex(color.green)}${toHex(color.blue)}`);
        });

        syncColor();
        settings.connect(`changed::${colorKey}`, syncColor);
        rowColor.add_suffix(colorButton); 
        rowColor.add_suffix(makeResetBtn(settings, colorKey));

        const rowOpacity = new Adw.SpinRow({ 
            title: `${title} Opacity`, 
            subtitle: '0 = Invisible, 255 = Opaque', 
            icon_name: 'image-filter-symbolic', 
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 255, step_increment: 5, page_increment: 10 }) 
        });
        settings.bind(opacityKey, rowOpacity, 'value', 0);
        rowOpacity.add_suffix(makeResetBtn(settings, opacityKey));

        parent.add_row(rowColor); 
        parent.add_row(rowOpacity);
    }


    /**
     * Builds the About page showing extension details and links.
     * @param {Adw.PreferencesWindow} window - The parent window.
     * @private
     */
    _buildAboutPage(window) {
        const page = new Adw.PreferencesPage({ title: 'About', icon_name: 'help-about-symbolic' });
        window.add(page);
        
        this._buildAboutHero(page); 
        this._buildAboutLinks(page, window); 
        this._buildAboutAuthor(page); 
        this._buildAboutDonations(page, window);
    }


    /**
     * Builds the hero section of the about page (Logo, Name, Subtitle).
     * @param {Adw.PreferencesPage} page - The about page.
     * @private
     */
    _buildAboutHero(page) {
        const group = new Adw.PreferencesGroup(); 
        page.add(group);
        
        const heroBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL, 
            spacing: 12, 
            halign: Gtk.Align.CENTER, 
            margin_top: 24, 
            margin_bottom: 12 
        });

        const logo = Gtk.Image.new_from_file(`${this.path}/icons/logo.svg`);
        logo.set_pixel_size(128); 
        heroBox.append(logo);
        
        heroBox.append(new Gtk.Label({ label: '<span size="xx-large" weight="bold">Rudra</span>', use_markup: true, margin_top: 8 }));
        heroBox.append(new Gtk.Label({ label: 'A lightning-fast launcher for GNOME Shell', css_classes: ['dim-label'], margin_bottom: 4 }));
        heroBox.append(new Gtk.Label({ label: 'Version 1  •  GPL-3.0', css_classes: ['dim-label', 'caption'] }));

        const row = new Adw.ActionRow(); 
        row.set_child(heroBox); 
        group.add(row);
    }


    /**
     * Builds the links section for GitHub.
     * @param {Adw.PreferencesPage} page - The about page.
     * @param {Adw.PreferencesWindow} window - The parent window.
     * @private
     */
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


    /**
     * Builds the credits section.
     * @param {Adw.PreferencesPage} page - The about page.
     * @private
     */
    _buildAboutAuthor(page) {
        const group = new Adw.PreferencesGroup({ title: 'Credits' }); 
        page.add(group);
        group.add(new Adw.ActionRow({ title: 'Narkagni', subtitle: 'Author &amp; Maintainer', icon_name: 'avatar-default-symbolic' }));
        group.add(new Adw.ActionRow({ title: 'Features', subtitle: 'App search · File hunt (.) · Command runner (>) · Google (g ) · YouTube (yt )', icon_name: 'starred-symbolic' }));
        group.add(new Adw.ActionRow({ title: 'Disclaimer', subtitle: 'Not affiliated with Google or YouTube', icon_name: 'dialog-information-symbolic' }));
    }


    /**
     * Builds the donations section.
     * @param {Adw.PreferencesPage} page - The about page.
     * @param {Adw.PreferencesWindow} window - The parent window.
     * @private
     */
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
                } catch (error) {
                }
            });
            
            row.add_suffix(copyBtn); 
            group.add(row);
        };

        addCrypto('Bitcoin (BTC)', 'security-high-symbolic', '1GSHkxfhYjk1Qe4AQSHg3aRN2jg2GQWAcV');
        addCrypto('Ethereum (ETH)', 'emblem-shared-symbolic', '0xf43c3f83e53495ea06676c0d9d4fc87ce627ffa3');
        addCrypto('Tether (USDT - TRC20)', 'security-medium-symbolic', 'THnqG9nchLgaf1LzGK3CqdmNpRxw59hs82');
    }
}