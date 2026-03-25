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

import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { LauncherUI } from './src/ui/LauncherUI.js';
import { cleanupAppSearch } from './src/search/AppSearch.js';
import { cleanupFileSearch } from './src/search/FileSearch.js';
import { SnippetManager } from './src/services/SnippetManager.js';
import { ClipboardManager } from './src/services/ClipboardManager.js';


export default class KeyboardLauncher extends Extension {
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

    _bindKey() {
        if (this._keybindingBound) {
            Main.wm.removeKeybinding('toggle-launcher');
            this._keybindingBound = false;
        }
        
        Main.wm.addKeybinding(
            'toggle-launcher',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.ALL,
            () => { 
                this._ui.toggle(); 
            }
        );

        this._keybindingBound = true; 
    }

    disable() {
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        
        if (this._keybindingBound) {
            Main.wm.removeKeybinding('toggle-launcher');
            this._keybindingBound = false;
        }

        if (this._ui) {
            this._ui.destroy();
            this._ui = null;
        }

        this._settings = null;
        
        cleanupAppSearch();
        cleanupFileSearch();
        ClipboardManager.destroy();
        SnippetManager.destroy();
    }
} 