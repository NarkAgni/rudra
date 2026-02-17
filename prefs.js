import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Pango from 'gi://Pango';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class RudraPreferences extends ExtensionPreferences {

    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const createResetBtn = this._makeResetBtn(settings);
        const createGroupReset = this._makeGroupResetBtn(settings);
        this._buildSettingsPage(window, settings, createResetBtn, createGroupReset);
        this._buildAboutPage(window);
    }

    _makeResetBtn(settings) {
        return (key) => {
            const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });

            const divider = new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL });
            divider.set_margin_top(12);
            divider.set_margin_bottom(12);
            box.append(divider);

            const btn = new Gtk.Button({
                icon_name: 'edit-undo-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['flat', 'circular'],
                tooltip_text: 'Reset to default'
            });

            const update = () => {
                const isDefault = settings.get_value(key).equal(settings.get_default_value(key));
                btn.set_sensitive(!isDefault);
                btn.set_opacity(isDefault ? 0.3 : 1.0);
            };

            btn.connect('clicked', () => settings.reset(key));
            settings.connect(`changed::${key}`, update);
            update();

            box.append(btn);
            return box;
        };
    }

    _makeGroupResetBtn(settings) {
        return (keys) => {
            const btn = new Gtk.Button({
                icon_name: 'edit-undo-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['flat', 'circular'],
                tooltip_text: 'Reset all options in this group'
            });

            const update = () => {
                let anyChanged = false;
                for (const key of keys) {
                    if (settings.settings_schema.has_key(key)) {
                        if (!settings.get_value(key).equal(settings.get_default_value(key))) {
                            anyChanged = true;
                            break;
                        }
                    }
                }
                btn.set_sensitive(anyChanged);
                btn.set_opacity(anyChanged ? 1.0 : 0.3);
            };

            btn.connect('clicked', () => {
                for (const key of keys) {
                     if (settings.settings_schema.has_key(key)) settings.reset(key);
                }
            });

            for (const key of keys) {
                 if (settings.settings_schema.has_key(key)) {
                    settings.connect(`changed::${key}`, update);
                 }
            }
            update();

            return btn;
        };
    }

    _buildSettingsPage(window, settings, createResetBtn, createGroupReset) {
        const page = new Adw.PreferencesPage({
            title: 'Settings',
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        this._buildShortcutsGroup(page, window, settings);
        this._buildAppearanceGroup(page, settings, createResetBtn); // Standard Group (No Master Reset)
        this._buildColorsExpander(page, settings, createResetBtn, createGroupReset);
        this._buildMarginsExpander(page, settings, createResetBtn, createGroupReset);
        this._buildSearchExpander(page, settings, createResetBtn, createGroupReset);
    }

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
        editBtn.connect('clicked', () => this._showKeybindingDialog(window, settings));

        row.add_suffix(shortcutLabel);
        row.add_suffix(editBtn);
        group.add(row);
    }

    _buildAppearanceGroup(page, settings, createResetBtn) {
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
            adjustment: new Gtk.Adjustment({ lower: 8, upper: 64, step_increment: 1 }),
        });

        let isInternalUpdate = false;

        const syncFontUI = () => {
            isInternalUpdate = true;
            const desc = Pango.FontDescription.from_string(settings.get_string('font-name') || 'Sans 14');
            fontBtn.set_font_desc(desc);
            let size = desc.get_size();
            if (!desc.get_size_is_absolute()) size = size / 1024;
            rowFontSize.set_value(size);
            isInternalUpdate = false;
        };

        const saveFont = () => {
            if (isInternalUpdate) return;
            let desc = fontBtn.get_font_desc();
            if (!desc) desc = Pango.FontDescription.from_string('Sans 14');
            desc.set_size(rowFontSize.get_value() * 1024);
            settings.set_string('font-name', desc.to_string());
        };

        syncFontUI();
        settings.connect('changed::font-name', syncFontUI);
        fontBtn.connect('notify::font-desc', saveFont);
        rowFontSize.connect('notify::value', saveFont);
        rowFontSize.add_suffix(createResetBtn('font-name'));
        group.add(rowFontSize);

        const rowRadius = new Adw.SpinRow({
            title: 'Corner Roundness',
            icon_name: 'object-select-symbolic',
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 50, step_increment: 1 }),
        });
        settings.bind('corner-radius', rowRadius, 'value', 0);
        rowRadius.add_suffix(createResetBtn('corner-radius'));
        group.add(rowRadius);
    }

    _buildColorsExpander(page, settings, createResetBtn, createGroupReset) {
        const group = new Adw.PreferencesGroup();
        page.add(group);

        const keys = [
            'background-color', 'background-opacity',
            'highlight-color',
            'selection-color', 'selection-opacity',
            'hover-color', 'hover-opacity'
        ];

        const expander = new Adw.ExpanderRow({
            title: 'Background &amp; Highlights',
            icon_name: 'preferences-desktop-wallpaper-symbolic',
            subtitle: 'Configure colors and opacity',
            show_enable_switch: false
        });
        expander.add_suffix(createGroupReset(keys));
        group.add(expander);

        this._addColorRow(expander, settings, 'background-color', 'Background Color', 'format-fill-color-symbolic');

        const rowBgOpacity = new Adw.SpinRow({
            title: 'Background Opacity',
            subtitle: '0 = Invisible, 255 = Opaque',
            icon_name: 'image-filter-symbolic',
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 255, step_increment: 5, page_increment: 10 })
        });
        settings.bind('background-opacity', rowBgOpacity, 'value', 0);
        rowBgOpacity.add_suffix(createResetBtn('background-opacity'));
        expander.add_row(rowBgOpacity);

        this._addColorRow(expander, settings, 'highlight-color', 'Highlight Color', 'format-text-color-symbolic');

        this._addColorWithOpacityRows(expander, settings,
            'selection-color', 'selection-opacity',
            'Selection Background', 'view-paged-symbolic', createResetBtn);

        this._addColorWithOpacityRows(expander, settings,
            'hover-color', 'hover-opacity',
            'Hover Background', 'input-mouse-symbolic', createResetBtn);
    }

    _buildMarginsExpander(page, settings, createResetBtn, createGroupReset) {
        const group = new Adw.PreferencesGroup();
        page.add(group);

        const keys = ['margin-top', 'margin-bottom', 'margin-left', 'margin-right'];

        const expander = new Adw.ExpanderRow({
            title: 'Screen Position',
            icon_name: 'view-restore-symbolic',
            subtitle: 'Adjust distance from screen edges',
            show_enable_switch: false
        });
        expander.add_suffix(createGroupReset(keys));
        group.add(expander);

        const addRow = (label, key, icon) => {
            const row = new Adw.SpinRow({
                title: label,
                icon_name: icon,
                adjustment: new Gtk.Adjustment({ lower: 0, upper: 2000, step_increment: 10 }),
            });
            settings.bind(key, row, 'value', 0);
            row.add_suffix(createResetBtn(key));
            return row;
        };

        expander.add_row(addRow('Top',    'margin-top',    'go-up-symbolic'));
        expander.add_row(addRow('Bottom', 'margin-bottom', 'go-down-symbolic'));
        expander.add_row(addRow('Left',   'margin-left',   'go-previous-symbolic'));
        expander.add_row(addRow('Right',  'margin-right',  'go-next-symbolic'));
    }

    _buildSearchExpander(page, settings, createResetBtn, createGroupReset) {
        const group = new Adw.PreferencesGroup();
        page.add(group);

        const keys = ['max-results', 'visible-results', 'result-spacing'];

        const expander = new Adw.ExpanderRow({
            title: 'Results &amp; Spacing',
            icon_name: 'system-search-symbolic',
            subtitle: 'Configure max results and spacing',
            show_enable_switch: false
        });
        expander.add_suffix(createGroupReset(keys));
        group.add(expander);

        const addRow = (label, key, max, icon) => {
            const row = new Adw.SpinRow({
                title: label,
                icon_name: icon,
                adjustment: new Gtk.Adjustment({ lower: 0, upper: max, step_increment: 1 }),
            });
            settings.bind(key, row, 'value', 0);
            row.add_suffix(createResetBtn(key));
            return row;
        };

        expander.add_row(addRow('Max Results',  'max-results',     50, 'view-list-symbolic'));
        expander.add_row(addRow('Visible Rows', 'visible-results', 20, 'format-justify-fill-symbolic'));
        expander.add_row(addRow('Item Spacing', 'result-spacing',  50, 'format-indent-more-symbolic'));
    }

    _addColorRow(parent, settings, key, title, icon) {
        const row = new Adw.ActionRow({ title, icon_name: icon });
        const rgba = new Gdk.RGBA();
        if (!rgba.parse(settings.get_string(key))) rgba.parse('#ffffff');

        const colorDialog = new Gtk.ColorDialog();
        const colorButton = new Gtk.ColorDialogButton({
            dialog: colorDialog,
            rgba: rgba,
            valign: Gtk.Align.CENTER
        });

        colorButton.connect('notify::rgba', () => {
            const c = colorButton.get_rgba();
            const toHex = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
            settings.set_string(key, `#${toHex(c.red)}${toHex(c.green)}${toHex(c.blue)}`);
        });

        settings.connect(`changed::${key}`, () => {
            const newRgba = new Gdk.RGBA();
            if (newRgba.parse(settings.get_string(key))) colorButton.set_rgba(newRgba);
        });

        row.add_suffix(colorButton);
        parent.add_row(row);
    }

    _addColorWithOpacityRows(parent, settings, colorKey, opacityKey, title, icon, createResetBtn) {
        const rowColor = new Adw.ActionRow({ title, icon_name: icon });

        const colorDialog = new Gtk.ColorDialog();
        const colorButton = new Gtk.ColorDialogButton({
            dialog: colorDialog,
            valign: Gtk.Align.CENTER
        });

        const syncColor = () => {
            let hex = settings.get_string(colorKey);
            if (!hex || !hex.startsWith('#')) hex = '#4a6fa5';
            const rgba = new Gdk.RGBA();
            rgba.parse(hex.substring(0, 7));
            colorButton.set_rgba(rgba);
        };

        colorButton.connect('notify::rgba', () => {
            const c = colorButton.get_rgba();
            const toHex = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
            settings.set_string(colorKey, `#${toHex(c.red)}${toHex(c.green)}${toHex(c.blue)}`);
        });

        syncColor();
        settings.connect(`changed::${colorKey}`, syncColor);
        rowColor.add_suffix(colorButton);
        rowColor.add_suffix(createResetBtn(colorKey));

        const rowOpacity = new Adw.SpinRow({
            title: `${title} Opacity`,
            subtitle: '0 = Invisible, 255 = Opaque',
            icon_name: 'image-filter-symbolic',
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 255, step_increment: 5, page_increment: 10 })
        });
        settings.bind(opacityKey, rowOpacity, 'value', 0);
        rowOpacity.add_suffix(createResetBtn(opacityKey));

        parent.add_row(rowColor);
        parent.add_row(rowOpacity);
    }

    _buildAboutPage(window) {
        const page = new Adw.PreferencesPage({
            title: 'About',
            icon_name: 'help-about-symbolic',
        });
        window.add(page);

        this._buildAboutHero(page);
        this._buildAboutLinks(page, window);
        this._buildAboutAuthor(page);
        this._buildAboutDonations(page, window);
    }

    _buildAboutHero(page) {
        const group = new Adw.PreferencesGroup();
        page.add(group);

        const heroBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            halign: Gtk.Align.CENTER,
            margin_top: 24,
            margin_bottom: 12,
        });

        const logoFile = `${this.path}/icons/logo.png`;
        const logo = Gtk.Image.new_from_file(logoFile);
        logo.set_pixel_size(128);
        heroBox.append(logo);

        heroBox.append(new Gtk.Label({
            label: '<span size="xx-large" weight="bold">Rudra</span>',
            use_markup: true,
            margin_top: 8,
        }));

        heroBox.append(new Gtk.Label({
            label: 'A lightning-fast launcher for GNOME Shell',
            css_classes: ['dim-label'],
            margin_bottom: 4,
        }));

        heroBox.append(new Gtk.Label({
            label: 'Version 1  •  GPL-3.0',
            css_classes: ['dim-label', 'caption'],
        }));

        const row = new Adw.ActionRow();
        row.set_child(heroBox);
        group.add(row);
    }

    _buildAboutLinks(page, window) {
        const group = new Adw.PreferencesGroup({ title: 'Links' });
        page.add(group);

        const addLink = (title, subtitle, icon, url) => {
            const row = new Adw.ActionRow({ title, subtitle, icon_name: icon, activatable: true });
            row.add_suffix(new Gtk.Image({
                icon_name: 'adw-external-link-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['dim-label'],
            }));
            row.connect('activated', () => {
                try {
                    const Gio = imports.gi.Gio;
                    Gio.AppInfo.launch_default_for_uri(url, window.get_display().get_app_launch_context());
                } catch (e) {
                    try { imports.gi.GLib.spawn_command_line_async(`xdg-open ${url}`); } catch (_) {}
                }
            });
            group.add(row);
        };

        addLink('GitHub Repository', 'github.com/narkagni/rudra',
            'system-software-install-symbolic', 'https://github.com/narkagni/rudra');
    }

    _buildAboutAuthor(page) {
        const group = new Adw.PreferencesGroup({ title: 'Credits' });
        page.add(group);

        group.add(new Adw.ActionRow({
            title: 'Narkagni',
            subtitle: 'Author &amp; Maintainer',
            icon_name: 'avatar-default-symbolic',
        }));

        group.add(new Adw.ActionRow({
            title: 'Features',
            subtitle: 'App search · File hunt (.) · Command runner (>) · Google (g ) · YouTube (yt )',
            icon_name: 'starred-symbolic',
        }));

        group.add(new Adw.ActionRow({
            title: 'Disclaimer',
            subtitle: 'Not affiliated with Google or YouTube',
            icon_name: 'dialog-information-symbolic',
        }));
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
            activatable: true,
        });
        coffeeRow.add_suffix(new Gtk.Image({
            icon_name: 'adw-external-link-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['dim-label'],
        }));
        coffeeRow.connect('activated', () => {
            try {
                imports.gi.Gio.AppInfo.launch_default_for_uri(
                    'https://buymeacoffee.com/narkagni',
                    window.get_display().get_app_launch_context());
            } catch (e) {
                try { imports.gi.GLib.spawn_command_line_async('xdg-open https://buymeacoffee.com/narkagni'); } catch (_) {}
            }
        });
        group.add(coffeeRow);

        const addCrypto = (coin, icon, address) => {
            const short = address.length > 24
                ? address.substring(0, 12) + '…' + address.slice(-8)
                : address;

            const row = new Adw.ActionRow({ title: coin, subtitle: short, icon_name: icon });

            const copyBtn = new Gtk.Button({
                icon_name: 'edit-copy-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['flat', 'circular'],
                tooltip_text: `Copy ${coin} address`,
            });

            copyBtn.connect('clicked', () => {
                const provider = Gdk.ContentProvider.new_for_value(address);
                window.get_display().get_clipboard().set_content(provider);
                try { window.add_toast(new Adw.Toast({ title: `${coin} address copied!`, timeout: 2 })); } catch (_) {}
            });

            row.add_suffix(copyBtn);
            group.add(row);
        };

        addCrypto('Bitcoin (BTC)', 'security-high-symbolic',   '1GSHkxfhYjk1Qe4AQSHg3aRN2jg2GQWAcV');
        addCrypto('Ethereum (ETH)', 'emblem-shared-symbolic',   '0xf43c3f83e53495ea06676c0d9d4fc87ce627ffa3');
        addCrypto('Tether (USDT - TRC20)', 'security-medium-symbolic', 'THnqG9nchLgaf1LzGK3CqdmNpRxw59hs82');
    }

    _showKeybindingDialog(parent, settings) {
        const dialog = new Gtk.Window({
            transient_for: parent,
            modal: true,
            title: 'Set Shortcut',
            default_width: 400,
            default_height: 250,
            resizable: false,
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 24,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            margin_top: 32, margin_bottom: 32,
            margin_start: 32, margin_end: 32
        });

        box.append(new Gtk.Image({
            icon_name: 'input-keyboard-symbolic',
            pixel_size: 64,
            css_classes: ['dim-label']
        }));

        box.append(new Gtk.Label({
            label: '<span size="large" weight="bold">Press keys to set shortcut</span>\n<span size="small" color="gray">Esc to cancel • Backspace to clear</span>',
            use_markup: true,
            justify: Gtk.Justification.CENTER,
            wrap: true,
            max_width_chars: 30
        }));

        box.append(new Gtk.ShortcutLabel({ accelerator: '', halign: Gtk.Align.CENTER }));
        dialog.set_child(box);

        const controller = new Gtk.EventControllerKey({ propagation_phase: Gtk.PropagationPhase.CAPTURE });
        dialog.add_controller(controller);

        controller.connect('key-pressed', (ctrl, keyval, keycode, state) => {
            const mask = state & Gtk.accelerator_get_default_mod_mask();

            if (keyval === Gdk.KEY_Escape) { dialog.close(); return Gdk.EVENT_STOP; }

            if (keyval === Gdk.KEY_BackSpace) {
                settings.set_strv('toggle-launcher', []);
                dialog.close();
                return Gdk.EVENT_STOP;
            }

            if (Gtk.accelerator_valid(keyval, 0) === false) return Gdk.EVENT_PROPAGATE;

            const accel = Gtk.accelerator_name_with_keycode(Gdk.Display.get_default(), keyval, keycode, mask);
            if (accel) {
                settings.set_strv('toggle-launcher', [accel]);
                dialog.close();
            }

            return Gdk.EVENT_STOP;
        });

        dialog.present();
    }
}