import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import { LauncherUI } from './launcher.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class KeyboardLauncher extends Extension {

    enable() {
        this._settings = this.getSettings();
        this._ui = new LauncherUI(this._settings, () => this.openPreferences(), this.uuid);
        this._bindKey();
        this._settingsChangedId = this._settings.connect('changed::toggle-launcher', () => {
            this._bindKey();
        });
    }

    _bindKey() {
        Main.wm.removeKeybinding('toggle-launcher');

        Main.wm.addKeybinding(
            'toggle-launcher',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.ALL,
            () => this._ui.toggle()
        );
    }

    disable() {
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        Main.wm.removeKeybinding('toggle-launcher');

        if (this._ui) {
            this._ui.close();
            this._ui.destroy();
            this._ui = null;
        }

        this._settings = null;
    }
}