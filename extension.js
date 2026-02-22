import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import { LauncherUI } from './src/ui/LauncherUI.js';
import { cleanupAppSearch } from './src/core/AppSearch.js';
import { cleanupFileSearch } from './src/core/FileSearch.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';


/**
 * The main extension class for Rudra Keyboard Launcher.
 * Controls the initialization and destruction of the extension instance.
 */
export default class KeyboardLauncher extends Extension {

    /**
     * Called when the extension is enabled.
     * Initializes settings, the UI, and binds the global shortcut.
     */
    enable() {
        this._settings = this.getSettings();
        
        this._ui = new LauncherUI(
            this._settings, 
            () => { this.openPreferences(); }, 
            this.uuid, 
            this.path
        );
        
        this._bindKey();
        
        this._settingsChangedId = this._settings.connect('changed::toggle-launcher', () => {
            this._bindKey();
        });
    }


    /**
     * Binds the global toggle shortcut using the GNOME Window Manager.
     * Removes the previous binding before applying the new one.
     * @private
     */
    _bindKey() {
        Main.wm.removeKeybinding('toggle-launcher');
        
        Main.wm.addKeybinding(
            'toggle-launcher',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.ALL,
            () => { 
                this._ui.toggle(); 
            }
        );
    }


    /**
     * Called when the extension is disabled.
     * Cleans up all UI elements, settings connections, keybindings, and search caches.
     */
    disable() {
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        
        Main.wm.removeKeybinding('toggle-launcher');

        if (this._ui) {
            this._ui.destroy();
            this._ui = null;
        }

        this._settings = null;
        
        cleanupAppSearch();
        cleanupFileSearch();
    }
}