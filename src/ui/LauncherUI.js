import St from 'gi://St';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import { SearchResults } from './SearchResults.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { applyTheme, positionLauncherBox } from './ThemeManager.js';


/**
 * The main user interface class for the Rudra Launcher.
 * Handles the overlay, search entry, keyboard input, and modal states.
 */
export class LauncherUI {
    
    /**
     * Initializes the launcher UI and sets up necessary variables.
     * @param {Gio.Settings} settings - Extension preferences.
     * @param {function} openPrefsCallback - Callback to open the settings window.
     * @param {string} uuid - Extension UUID.
     * @param {string} extPath - Absolute path of the extension directory.
     */
    constructor(settings, openPrefsCallback, uuid, extPath) {
        this._settings = settings;
        this._openPrefsCallback = openPrefsCallback;
        this._extPath = extPath;
        this._isOpen = false;
        
        this._userTypedText = '';
        this._updatingEntry = false;
        this._suggestedSuffix = '';
        
        this._autocompleteIdleId = 0;
        this._focusTimeoutId = 0;
        this._searchTimeoutId = 0;

        this._buildUI();
        
        applyTheme(this._settings, { 
            box: this._box, 
            entry: this._entry, 
            hintLabel: this._hintLabel, 
            resultsView: this._resultsView 
        });

        this._overviewShowingId = Main.overview.connect('showing', () => {
            if (this._isOpen === true) {
                this.close();
            }
        });

        this._settingsSignal = this._settings.connect('changed', () => {
            applyTheme(this._settings, { 
                box: this._box, 
                entry: this._entry, 
                hintLabel: this._hintLabel, 
                resultsView: this._resultsView 
            });
            
            if (this._resultsView) {
                this._resultsView.updateHighlightColor();
                this._resultsView.refreshSelectionColor();
            }
        });

        this._updateToggleShortcut();
        this._shortcutSignal = this._settings.connect('changed::toggle-launcher', () => {
            this._updateToggleShortcut();
        });
    }


    /**
     * Parses the toggle shortcut from settings for manual capture during modal state.
     * Because Main.pushModal blocks global shortcuts, we have to catch it manually.
     * @private
     */
    _updateToggleShortcut() {
        let accelerator = this._settings.get_strv('toggle-launcher')[0] || '';
        
        if (!accelerator) {
            this._toggleKeyval = null;
            this._toggleMods = null;
            return;
        }
        
        let parsedShortcut = Gtk.accelerator_parse(accelerator);
        this._toggleKeyval = parsedShortcut[1];
        this._toggleMods = parsedShortcut[2];
    }


    /**
     * Constructs the Clutter UI tree containing the input box and result view.
     * @private
     */
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
            x_expand: true 
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
        let settingsIcon = new St.Icon({ 
            gicon: new Gio.FileIcon({ file: iconFile }), 
            icon_size: 28, 
            x_align: Clutter.ActorAlign.CENTER, 
            y_align: Clutter.ActorAlign.CENTER 
        });
        
        this._settingsBtn.add_child(settingsIcon);
        settingsIcon.set_opacity(100);

        this._settingsBtn.connect('button-release-event', (actor, event) => {
            let mouseButton = event.get_button();
            if (mouseButton === 1) {
                this._openSettingsSafe();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this._settingsBtn.connect('notify::hover', () => {
            if (this._settingsBtn.hover === true) {
                settingsIcon.set_opacity(255);
                global.display.set_cursor(Clutter.Cursor.HAND1);
            } else {
                settingsIcon.set_opacity(128);
                global.display.set_cursor(Clutter.Cursor.DEFAULT);
            }
        });

        this._headerBox.add_child(this._entryContainer);
        this._headerBox.add_child(this._settingsBtn);

        this._separator = new St.Widget({ 
            style_class: 'launcher-separator', 
            x_expand: true, 
            visible: false 
        });
        
        this._resultsView = new SearchResults(this, this._settings);

        this._box.add_child(this._headerBox);
        this._box.add_child(this._separator);
        this._box.add_child(this._resultsView.widget);
        this._container.add_child(this._box);
        
        Main.uiGroup.add_child(this._container);

        this._resultsView.onVisibilityChange = (isVisible) => {
            this._separator.visible = isVisible;
        };
        
        this._bindEntryEvents();
    }


    /**
     * Binds keyboard typing and input events to the search entry field.
     * @private
     */
    _bindEntryEvents() {
        this._entry.clutter_text.connect('text-changed', () => {
            if (this._updatingEntry === true) {
                return;
            }
            
            if (this._searchTimeoutId) { 
                GLib.source_remove(this._searchTimeoutId); 
                this._searchTimeoutId = 0; 
            }

            let text = this._entry.get_text();
            this._userTypedText = text;
            this._hintLabel.hide();
            this._suggestedSuffix = '';

            // Clean Mode Hints - No leading space characters used!
            if (text === '.' || text === '. ') {
                this.showModeHint('Search Files/Folders...');
            } else if (text === '>' || text === '> ') {
                this.showModeHint('Run Linux Command...');
            } else if (text === 'g ' || text === 'g  ') {
                this.showModeHint('Search Google...');
            } else if (text === 'yt ' || text === 'yt  ') {
                this.showModeHint('Search YouTube...');
            }

            this._searchTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
                this._searchTimeoutId = 0;
                if (this._resultsView) {
                    this._resultsView.update(text);
                }
                return GLib.SOURCE_REMOVE;
            });
        });

        this._entry.clutter_text.connect('key-press-event', (actor, event) => {
            let keySymbol = event.get_key_symbol();
            let state = event.get_state() & Gtk.accelerator_get_default_mod_mask();

            let isToggleShortcut = (this._toggleKeyval !== null) && 
                                   (keySymbol === this._toggleKeyval) && 
                                   (state === this._toggleMods);

            if (isToggleShortcut) {
                this.close(); 
                return Clutter.EVENT_STOP;
            }
            
            if (keySymbol === Clutter.KEY_Escape) {
                this.close(); 
                return Clutter.EVENT_STOP;
            }
            
            if (keySymbol === Clutter.KEY_Return || keySymbol === Clutter.KEY_KP_Enter) { 
                this._resultsView.activateSelected(); 
                return Clutter.EVENT_STOP; 
            }
            
            if (keySymbol === Clutter.KEY_Down) { 
                this._resultsView.selectNext(); 
                return Clutter.EVENT_STOP; 
            }
            
            if (keySymbol === Clutter.KEY_Up) { 
                this._resultsView.selectPrev(); 
                return Clutter.EVENT_STOP; 
            }
            
            if (keySymbol === Clutter.KEY_Tab || keySymbol === Clutter.KEY_Right) {
                if (keySymbol === Clutter.KEY_Right) {
                    let cursorPos = this._entry.clutter_text.get_cursor_position();
                    let textLen = this._entry.get_text().length;
                    if (cursorPos !== -1 && cursorPos < textLen) {
                        return Clutter.EVENT_PROPAGATE;
                    }
                }

                if (this._hintLabel.visible === true && this._suggestedSuffix !== '') {
                    this._updatingEntry = true;
                    let fullText = this._suggestedSuffix;
                    this._entry.clutter_text.set_text('');
                    this._entry.clutter_text.set_text(fullText);
                    this._userTypedText = fullText;
                    this._hintLabel.hide();
                    this._suggestedSuffix = '';
                    this._entry.clutter_text.set_cursor_position(fullText.length);
                    this._updatingEntry = false;
                    
                    return Clutter.EVENT_STOP;
                }
            }
            
            return Clutter.EVENT_PROPAGATE;
        });

        this._container.connect('captured-event', (actor, event) => {
            if (event.type() === Clutter.EventType.BUTTON_PRESS) {
                let coords = event.get_coords();
                let mouseX = coords[0];
                let mouseY = coords[1];
                
                let boxPos = this._box.get_transformed_position();
                let boxX = boxPos[0];
                let boxY = boxPos[1];
                
                let boxSize = this._box.get_transformed_size();
                let boxWidth = boxSize[0];
                let boxHeight = boxSize[1];
                
                let isOutsideX = (mouseX < boxX) || (mouseX > boxX + boxWidth);
                let isOutsideY = (mouseY < boxY) || (mouseY > boxY + boxHeight);

                if (isOutsideX || isOutsideY) {
                    this.close(); 
                    return Clutter.EVENT_STOP;
                }
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }


    /**
     * Safely closes the launcher and triggers the preferences dialog.
     * @private
     */
    _openSettingsSafe() {
        this._openPrefsCallback();
        this.close();
    }


    /**
     * Displays a hint indicating the current search mode (e.g., File, Command).
     * @param {string} text - The mode hint to display without any leading spaces.
     */
    showModeHint(text) {
        if (this._isOpen === false) {
            return;
        }
        
        this._suggestedSuffix = '';
        this._hintLabel.set_text(text);
        
        if (this._autocompleteIdleId) {
            GLib.source_remove(this._autocompleteIdleId);
            this._autocompleteIdleId = 0;
        }

        this._autocompleteIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._autocompleteIdleId = 0;
            
            if (this._isOpen === false) {
                return GLib.SOURCE_REMOVE;
            }

            let cursorRect = this._entry.clutter_text.get_cursor_rect();
            
            let pixelGap = 12; 
            let cursorX = cursorRect.origin.x + pixelGap;
            
            this._hintLabel.set_translation(cursorX, 0, 0);
            this._hintLabel.show();
            
            return GLib.SOURCE_REMOVE;
        });
    }


    /**
     * Displays an inline autocomplete suggestion.
     * @param {string} appName - The application name to suggest.
     * @param {string} [extraHint=''] - Additional text (like 'System Setting').
     */
    showAutocomplete(appName, extraHint = '') {
        if (this._isOpen === false) {
            return;
        }

        if (this._autocompleteIdleId) {
            GLib.source_remove(this._autocompleteIdleId);
            this._autocompleteIdleId = 0;
        }

        let typedText = this._userTypedText;

        let isSpecialMode = typedText.startsWith('.') || 
                            typedText.startsWith('>') ||
                            typedText.startsWith('g ') || 
                            typedText.startsWith('yt ');

        if (isSpecialMode === true) {
            return;
        }

        if (!typedText || !appName) {
            this._hintLabel.hide();
            this._suggestedSuffix = '';
            return;
        }

        let isPrefix = appName.toLowerCase().startsWith(typedText.toLowerCase());
        let textToShow = '';
        let gapOffset = 0;

        if (isPrefix === true) {
            textToShow = appName.substring(typedText.length) + extraHint;
            this._suggestedSuffix = appName;
            gapOffset = 0;
        } else {
            textToShow = appName + extraHint;
            this._suggestedSuffix = appName;
            gapOffset = 10;
        }

        if (!textToShow) {
            this._hintLabel.hide();
            return;
        }

        this._autocompleteIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._autocompleteIdleId = 0;
            
            if (this._isOpen === false || this._entry.get_text() !== typedText) {
                return GLib.SOURCE_REMOVE;
            }
            
            this._hintLabel.set_text(textToShow);
            
            let cursorRect = this._entry.clutter_text.get_cursor_rect();
            let cursorX = cursorRect.origin.x + gapOffset;
            
            this._hintLabel.set_translation(cursorX, 0, 0);
            this._hintLabel.show();
            
            return GLib.SOURCE_REMOVE;
        });
    }


    /**
     * Toggles the UI state between open and closed.
     */
    toggle() { 
        if (this._isOpen === true) {
            this.close();
        } else {
            this.open();
        }
    }


    /**
     * Opens the launcher, grabs focus, and positions it on the screen.
     */
    open() {
        if (this._isOpen === true || Main.overview.visible === true) {
            return;
        }
        
        this._isOpen = true;
        this._userTypedText = '';
        this._container.show();
        this._entry.text = '';
        this._hintLabel.hide();
        this._suggestedSuffix = '';
        this._resultsView.clear();
        this._separator.visible = false;
        
        positionLauncherBox(this._box);

        let pushModalSuccess = Main.pushModal(this._container);
        if (pushModalSuccess === false) {
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
            if (this._entry && this._isOpen === true) {
                this._entry.grab_key_focus();
            }
            return GLib.SOURCE_REMOVE;
        });
    }


    /**
     * Closes the launcher and cleans up modal states.
     */
    close() {
        if (this._isOpen === false) {
            return;
        }
        
        this._isOpen = false;

        if (this._autocompleteIdleId) { 
            GLib.source_remove(this._autocompleteIdleId); 
            this._autocompleteIdleId = 0; 
        }
        if (this._searchTimeoutId) { 
            GLib.source_remove(this._searchTimeoutId); 
            this._searchTimeoutId = 0; 
        }

        this._userTypedText = '';
        this._entry.text = '';
        this._hintLabel.hide();
        this._suggestedSuffix = '';
        this._resultsView.clear();
        this._container.hide();
        Main.popModal(this._container);
    }


    /**
     * Completely destroys the UI and disconnects all signals to prevent memory leaks.
     */
    destroy() {
        this.close();

        if (this._focusTimeoutId) { 
            GLib.source_remove(this._focusTimeoutId); 
            this._focusTimeoutId = 0; 
        }
        if (this._autocompleteIdleId) { 
            GLib.source_remove(this._autocompleteIdleId); 
            this._autocompleteIdleId = 0; 
        }
        if (this._searchTimeoutId) { 
            GLib.source_remove(this._searchTimeoutId); 
            this._searchTimeoutId = 0; 
        }
        if (this._overviewShowingId) { 
            Main.overview.disconnect(this._overviewShowingId); 
            this._overviewShowingId = null; 
        }
        if (this._settingsSignal) { 
            this._settings.disconnect(this._settingsSignal); 
            this._settingsSignal = null; 
        }
        if (this._shortcutSignal) { 
            this._settings.disconnect(this._shortcutSignal); 
            this._shortcutSignal = null; 
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