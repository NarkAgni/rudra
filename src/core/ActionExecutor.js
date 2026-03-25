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
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { HistoryManager } from '../services/HistoryManager.js';
import { SnippetManager } from '../services/SnippetManager.js';


function _buildTerminalArgv(command) {
    let bashCmd = `${command}; echo; read -p "Press Enter to close..."`;

    const terminals = [
        ['gnome-console', '--', 'bash', '-c', bashCmd],
        ['ptyxis', '--', 'bash', '-c', bashCmd],
        ['kgx', '--', 'bash', '-c', bashCmd],
        ['gnome-terminal', '--', 'bash', '-c', bashCmd],
        ['kitty', '--', 'bash', '-c', bashCmd],
        ['alacritty', '-e', 'bash', '-c', bashCmd],
        ['tilix', '-e', 'bash', '-c', bashCmd],
        ['terminator', '-x', 'bash', '-c', bashCmd],
        ['konsole', '-e', 'bash', '-c', bashCmd],
        ['xfce4-terminal', '--', 'bash', '-c', bashCmd],
        ['xterm', '-e', 'bash', '-c', bashCmd],
    ];

    for (let args of terminals) {
        if (GLib.find_program_in_path(args[0])) {
            return args;
        }
    }
    return null;
}

export function executeItem(item) {
    try {
        const skipTypes = new Set([
            'emoji', 'calc', 'clipboard', 'snippet',
            'plugin-action', 'icon-browser',
            'snippet-add', 'snippet-delete', 'snippet-info'
        ]);

        if (!skipTypes.has(item.type)) {
            HistoryManager.record(item);
        }

        if (item.type === 'emoji' || item.type === 'clipboard' || item.type === 'snippet' || item.type === 'icon-browser') {
            St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, item.text);

            let notifyMsg = 'Copied to clipboard!';
            if (item.type === 'icon-browser') notifyMsg = `Icon name copied: ${item.text}`;
            if (item.type === 'emoji') notifyMsg = `Emoji copied: ${item.text}`;

            Main.notify('Rudra', notifyMsg);

        } else if (item.type === 'snippet-add') {
            if (item.trigger && item.text) {
                let trigger = item.trigger.startsWith('!') ? item.trigger : '!' + item.trigger;
                SnippetManager.save({
                    trigger: trigger,
                    text: item.text,
                    name: trigger.replace('!', '')
                });
                Main.notify('Rudra', `Snippet saved: ${item.trigger}`);
            }

        } else if (item.type === 'snippet-delete') {
            if (item.canDelete && item.snippetId) {
                let deleted = SnippetManager.delete(item.snippetId);
                if (deleted) Main.notify('Rudra', `Snippet deleted`);
            }
            
        } else if (item.type === 'snippet-info') {

        } else if (item.type === 'plugin-action') {
            if (item.clipboard) {
                St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, item.clipboard);
            }
            if (item.action) {
                let parsed = GLib.shell_parse_argv(item.action);
                Gio.Subprocess.new(parsed[1], Gio.SubprocessFlags.NONE);
            }

        } else if (item.type === 'shortcut') {

        } else if (item.type === 'command') {
            let argv = _buildTerminalArgv(item.command);

            if (argv) {
                Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
            } else {
                let parsed = GLib.shell_parse_argv(item.command);
                Gio.Subprocess.new(parsed[1], Gio.SubprocessFlags.NONE);
                Main.notify('Rudra', 'No terminal emulator found. Command ran in background.');
            }

        } else if (item.type === 'web') {
            let context = global.create_app_launch_context(0, -1);
            Gio.AppInfo.launch_default_for_uri(item.url, context);

        } else if (item.type === 'file') {
            let context = global.create_app_launch_context(0, -1);
            let uri = item.file ? item.file.get_uri() : Gio.File.new_for_path(item.description.replace('~', GLib.get_home_dir())).get_uri();
            Gio.AppInfo.launch_default_for_uri(uri, context);

        } else if (item.type === 'app') {
            let appSystem = Shell.AppSystem.get_default();
            let sysApp = appSystem.lookup_app(item.id);

            if (sysApp) {
                sysApp.activate();
            } else if (item.appInfo) {
                item.appInfo.launch([], null);
            } else {
                let desktopApp = Gio.DesktopAppInfo.new(item.id);
                if (desktopApp) {
                    desktopApp.launch([], null);
                } else {
                    console.error("Rudra: Missing AppInfo for " + item.id);
                }
            }
        } else if (item.type === 'calc') {
            St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, item.result);
        }
    } catch (error) {
        console.error('Rudra launch error:', error);
        Main.notify('Error executing action', error.message);
    }
}