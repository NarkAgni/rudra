import St from 'gi://St';
import Gio from 'gi://Gio';
import Mtk from 'gi://Mtk';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import Clutter from 'gi://Clutter';
import { SearchResults } from './searchResults.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class LauncherUI {
    constructor(settings, openPrefsCallback, uuid, extPath) {
        this._settings = settings;
        this._openPrefsCallback = openPrefsCallback;
        this._uuid = uuid || 'rudra@narkagni';
        this._extPath = extPath;
        this._isOpen = false;
        this._userTypedText = '';
        this._updatingEntry = false;
        this._suggestedSuffix = '';
        this._autocompleteIdleId = 0;
        this._focusTimeoutId = 0;

        this._buildUI();
        this._applyStyles();

        this._overviewShowingId = Main.overview.connect('showing', () => {
            if (this._isOpen) this.close();
        });

        this._settingsSignal = this._settings.connect('changed', () => {
            this._applyStyles();
            if (this._resultsView) {
                this._resultsView.updateHighlightColor();
                this._resultsView.refreshSelectionColor();
            }
        });
    }

    _buildUI() {
        this._container = new St.Widget({
            visible: false,
            reactive: true,
            layout_manager: new Clutter.BinLayout(),
            style_class: 'launcher-overlay',
            y_align: Clutter.ActorAlign.START,
            x_align: Clutter.ActorAlign.FILL
        });

        this._container.add_constraint(new Clutter.BindConstraint({
            source: global.stage,
            coordinate: Clutter.BindCoordinate.ALL,
        }));

        this._box = new St.BoxLayout({
            vertical: true,
            width: 660,
            reactive: true,
            style_class: 'launcher-box',
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
        });

        this._headerBox = new St.BoxLayout({
            vertical: false,
            reactive: true,
            style_class: 'launcher-header',
            x_expand: true
        });

        this._entryContainer = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
        });

        this._hintLabel = new St.Label({
            text: '',
            style_class: 'launcher-hint',
            reactive: false,
            visible: false,
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._hintLabel.clutter_text.ellipsize = 3;

        this._entry = new St.Entry({
            hint_text: 'Search apps...',
            can_focus: true,
            style_class: 'launcher-entry',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });

        this._entryContainer.add_child(this._hintLabel);
        this._entryContainer.add_child(this._entry);

        this._settingsBtn = new St.Widget({
            style_class: 'settings-button',
            reactive: true,
            track_hover: true,
            can_focus: true,
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.END,
            width: 48,
            height: 48,
            layout_manager: new Clutter.BinLayout()
        });

        let iconFile = Gio.File.new_for_path(this._extPath + '/icons/setting.svg');
        let icon = new St.Icon({
            gicon: new Gio.FileIcon({ file: iconFile }),
            icon_size: 28,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._settingsBtn.add_child(icon);

        this._settingsBtn.connect('button-release-event', (actor, event) => {
            if (event.get_button() === 1) { 
                this._openSettingsSafe();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        icon.set_opacity(100);

        this._settingsBtn.connect('notify::hover', () => {
            if (this._settingsBtn.hover) {
                icon.set_opacity(255);
                global.display.set_cursor(Clutter.Cursor.HAND1);
            } else {
                icon.set_opacity(128);
                global.display.set_cursor(Clutter.Cursor.DEFAULT);
            }
        });

        this._headerBox.add_child(this._entryContainer);
        this._headerBox.add_child(this._settingsBtn);

        this._separator = new St.Widget({
            style_class: 'launcher-separator',
            x_expand: true,
            visible: false,
        });

        this._resultsView = new SearchResults(this, this._settings);

        this._box.add_child(this._headerBox);
        this._box.add_child(this._separator);
        this._box.add_child(this._resultsView.widget);

        this._container.add_child(this._box);
        Main.uiGroup.add_child(this._container);

        this._resultsView.onVisibilityChange = (visible) => {
            this._separator.visible = visible;
        };

        this._entry.clutter_text.connect('text-changed', () => {
            if (this._updatingEntry) return;
            let text = this._entry.get_text();
            this._userTypedText = text;
            this._hintLabel.hide();
            this._suggestedSuffix = '';

            if (text === '.') {
                this.showModeHint('   Search Files/Folders...');
            } else if (text === '>') {
                this.showModeHint('   Run Linux Command...');
            } else if (text === 'g ') {
                this.showModeHint('  Search Google...');
            } else if (text === 'yt ') {
                this.showModeHint('  Search YouTube...');
            }

            this._resultsView.update(text);
        });

        this._entry.clutter_text.connect('key-press-event', (actor, event) => {
            let sym = event.get_key_symbol();

            if (sym === Clutter.KEY_Escape) {
                this.close();
                return Clutter.EVENT_STOP;
            }

            if (sym === Clutter.KEY_Return || sym === Clutter.KEY_KP_Enter) {
                this._resultsView.activateSelected();
                return Clutter.EVENT_STOP;
            }

            if (sym === Clutter.KEY_Tab || sym === Clutter.KEY_Right) {
                if (this._hintLabel.visible && this._suggestedSuffix) {
                    this._updatingEntry = true;
                    let fullText = '';
                    if (!this._suggestedSuffix.toLowerCase().startsWith(this._userTypedText.toLowerCase()) &&
                        this._suggestedSuffix.length > this._userTypedText.length) {
                        fullText = this._suggestedSuffix;
                    } else {
                        fullText = this._userTypedText + this._suggestedSuffix;
                    }
                    this._entry.set_text(fullText);
                    this._userTypedText = fullText;
                    this._hintLabel.hide();
                    this._suggestedSuffix = '';
                    let ct = this._entry.clutter_text;
                    ct.set_cursor_position(fullText.length);
                    this._updatingEntry = false;
                    return Clutter.EVENT_STOP;
                }
            }

            if (sym === Clutter.KEY_Down) {
                this._resultsView.selectNext();
                return Clutter.EVENT_STOP;
            }

            if (sym === Clutter.KEY_Up) {
                this._resultsView.selectPrev();
                return Clutter.EVENT_STOP;
            }

            return Clutter.EVENT_PROPAGATE;
        });

        this._container.connect('captured-event', (actor, event) => {
            let type = event.type();
            if (type === Clutter.EventType.BUTTON_PRESS) {
                let [x, y] = event.get_coords();
                let [bx, by] = this._box.get_transformed_position();
                let [bw, bh] = this._box.get_transformed_size();

                if (x < bx || x > bx + bw || y < by || y > by + bh) {
                    this.close();
                    return Clutter.EVENT_STOP;
                }
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    _openSettingsSafe() {
        if (this._openPrefsCallback) {
            this._openPrefsCallback();
            this.close();
        } else {
            console.warn('KeyboardLauncher: openPrefsCallback not defined');
        }
    }

    showModeHint(text) {
        if (!this._isOpen) return;
        this._suggestedSuffix = '';
        this._hintLabel.set_text(text);
        let cursorRect = this._entry.clutter_text.get_cursor_rect();
        let x = cursorRect.origin.x;
        this._hintLabel.set_translation(x, 0, 0);
        this._hintLabel.show();
    }

    showAutocomplete(appName, extraHint = '') {
        if (!this._isOpen) return;

        if (this._autocompleteIdleId) {
            GLib.source_remove(this._autocompleteIdleId);
            this._autocompleteIdleId = 0;
        }

        let typed = this._userTypedText;

        if (typed.startsWith('.') || typed.startsWith('>') ||
            typed.startsWith('g ') || typed.startsWith('yt ')) return;

        if (!typed || !appName) {
            this._hintLabel.hide();
            this._suggestedSuffix = '';
            return;
        }

        let isPrefix = appName.toLowerCase().startsWith(typed.toLowerCase());
        let textToShow = '';
        let gapOffset = 0;

        if (isPrefix) {
            textToShow = appName.substring(typed.length) + extraHint;
            this._suggestedSuffix = appName.substring(typed.length);
            gapOffset = 0;
        } else {
            textToShow = appName + extraHint;
            this._suggestedSuffix = appName;
            gapOffset = 20;
        }

        if (!textToShow) {
            this._hintLabel.hide();
            return;
        }

        this._autocompleteIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._autocompleteIdleId = 0;
            if (!this._isOpen || this._entry.get_text() !== typed) return GLib.SOURCE_REMOVE;
            this._hintLabel.set_text(textToShow);
            let cursorRect = this._entry.clutter_text.get_cursor_rect();
            let x = cursorRect.origin.x + gapOffset;
            this._hintLabel.set_translation(x, 0, 0);
            this._hintLabel.show();
            return GLib.SOURCE_REMOVE;
        });
    }

    _applyStyles() {
        let mt = this._settings.get_int('margin-top');
        let mb = this._settings.get_int('margin-bottom');
        let ml = this._settings.get_int('margin-left');
        let mr = this._settings.get_int('margin-right');
        let radius = this._settings.get_int('corner-radius');

        let bgHex = this._settings.get_string('background-color');
        let opacity = this._settings.get_int('background-opacity');
        let bgRgba = this._hexToRgba(bgHex, opacity);

        let fontName = this._settings.get_string('font-name');
        let family = 'Sans';
        let sizePt = 14;
        let cssFont = '';

        try {
            let desc = Pango.FontDescription.from_string(fontName);
            family = desc.get_family();
            let size = desc.get_size();
            sizePt = desc.get_size_is_absolute() ? size : size / 1024;
            cssFont = `font-family: "${family}"; font-size: ${sizePt}pt;`;
        } catch (e) {
            cssFont = 'font-family: "Sans"; font-size: 14pt;';
        }

        this._box.set_style(`
            margin-top: ${mt}px;
            margin-bottom: ${mb}px;
            margin-left: ${ml}px;
            margin-right: ${mr}px;
            background-color: ${bgRgba};
            border-radius: ${radius}px;
            ${cssFont}
        `);

        this._entry.set_style(cssFont);
        if (this._hintLabel) {
            this._hintLabel.set_style(`${cssFont} color: #888888;`);
        }

        if (this._resultsView) {
            this._resultsView.updateStyles(family, sizePt);
        }
    }

    _hexToRgba(hex, alphaInt) {
        if (!hex || !hex.startsWith('#')) return 'rgba(30,30,30,1)';
        hex = hex.substring(1);
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);
        let a = (alphaInt / 255).toFixed(2);
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    _positionBox() {
        let [mouseX, mouseY] = global.get_pointer();
        let monitorIndex = global.display.get_monitor_index_for_rect(
            new Mtk.Rectangle({ x: mouseX, y: mouseY, width: 1, height: 1 })
        );
        // Fallback to primary if index not found
        if (monitorIndex < 0) monitorIndex = global.display.get_primary_monitor();
        let geo = global.display.get_monitor_geometry(monitorIndex);
        let boxWidth = this._box.width || 660;
        this._box.set_position(
            Math.floor(geo.x + (geo.width - boxWidth) / 2),
            0
        );
    }

    toggle() { this._isOpen ? this.close() : this.open(); }

    open() {
        if (this._isOpen) return;
        if (Main.overview.visible) return;
        this._isOpen = true;
        this._userTypedText = '';
        this._container.show();
        this._entry.text = '';
        this._hintLabel.hide();
        this._suggestedSuffix = '';
        this._resultsView.clear();
        this._separator.visible = false;
        this._positionBox();

        if (!Main.pushModal(this._container)) {
            this._container.hide();
            this._isOpen = false;
            return;
        }

        if (this._focusTimeoutId) {
            GLib.source_remove(this._focusTimeoutId);
            this._focusTimeoutId = 0;
        }

        this._focusTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
            this._focusTimeoutId = 0; 
            if (this._entry) this._entry.grab_key_focus();
            return GLib.SOURCE_REMOVE;
        });
    }

    close() {
        if (!this._isOpen) return;
        this._isOpen = false;

        if (this._autocompleteIdleId) {
            GLib.source_remove(this._autocompleteIdleId);
            this._autocompleteIdleId = 0;
        }

        this._userTypedText = '';
        this._entry.text = '';
        this._hintLabel.hide();
        this._suggestedSuffix = '';
        this._resultsView.clear();
        this._container.hide();
        Main.popModal(this._container);
    }

    destroy() {
        this.close();

        if (this._autocompleteIdleId) {
            GLib.source_remove(this._autocompleteIdleId);
            this._autocompleteIdleId = 0;
        }
        if (this._overviewShowingId) {
            Main.overview.disconnect(this._overviewShowingId);
            this._overviewShowingId = null;
        }
        if (this._settingsSignal) {
            this._settings.disconnect(this._settingsSignal);
            this._settingsSignal = null;
        }

        if (this._resultsView) {
            this._resultsView.destroy();
            this._resultsView = null;
        }

        if (this._container) {
            this._container.destroy();
            this._container = null;
        }
    }
}
