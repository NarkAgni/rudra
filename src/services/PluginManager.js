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

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';


function getPluginsDir() {
    let configPath = GLib.get_user_config_dir();
    let dir = Gio.File.new_for_path(configPath).get_child('rudra@narkagni').get_child('plugins');
    if (!dir.query_exists(null)) dir.make_directory_with_parents(null);
    return dir;
}

export function getAllPlugins() {
    let dir = getPluginsDir();
    let plugins = [];
    try {
        let enumerator = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let info;
        while ((info = enumerator.next_file(null)) != null) {
            let name = info.get_name();
            if (name.endsWith('.py') || name.endsWith('.sh')) {
                plugins.push(name);
            }
        }
    } catch(e) {}
    return plugins;
}

export function readPlugin(filename) {
    let file = getPluginsDir().get_child(filename);
    if (file.query_exists(null)) {
        let [, contents] = file.load_contents(null);
        return new TextDecoder('utf-8').decode(contents);
    }
    return '';
}

export function savePlugin(filename, content) {
    let file = getPluginsDir().get_child(filename);
    let encoder = new TextEncoder();
    file.replace_contents(encoder.encode(content), null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
}

export function deletePlugin(filename) {
    let file = getPluginsDir().get_child(filename);
    if (file.query_exists(null)) file.delete(null);
}

export function runPluginSearch(scriptName, arg, callback) {
    let pluginsDir = getPluginsDir();
    let bashScript = pluginsDir.get_child(`${scriptName}.sh`);
    let pyScript = pluginsDir.get_child(`${scriptName}.py`);
    
    let argv = [];
    if (bashScript.query_exists(null)) {
        argv = ['bash', bashScript.get_path(), arg];
    } else if (pyScript.query_exists(null)) {
        argv = ['python3', pyScript.get_path(), arg];
    } else {
        callback([{
            type: 'error',
            name: `Plugin '${scriptName}' not found`,
            description: 'Create a .sh or .py file in ~/.config/rudra@narkagni/plugins/',
            icon: new Gio.ThemedIcon({ name: 'dialog-error-symbolic' })
        }]);
        return;
    }

    try {
        let cancellable = new Gio.Cancellable();

        let timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
            cancellable.cancel();
            callback([{
                type: 'plugin-action',
                name: `Plugin '${scriptName}' timed out`,
                description: 'Script 5 seconds se zyada chali — cancelled. Use curl --max-time 3 in bash.',
                icon: new Gio.ThemedIcon({ name: 'dialog-warning-symbolic' }),
                action: '', clipboard: ''
            }]);
            return GLib.SOURCE_REMOVE;
        });

        let proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
        
        proc.communicate_utf8_async(null, cancellable, (obj, res) => {
            GLib.source_remove(timeoutId);
            try {
                let [ok, stdout, stderr] = obj.communicate_utf8_finish(res);
                if (ok && stdout) {
                    let results = JSON.parse(stdout);
                    let formatted = results.map(r => ({
                        type: r.type || 'plugin-action',
                        name: r.name || 'Result',
                        description: r.description || '',
                        icon: new Gio.ThemedIcon({ name: r.icon || 'application-x-executable' }),
                        action: r.action || '',
                        clipboard: r.clipboard || '',
                        refreshable: r.refreshable || false 
                    }));
                    callback(formatted);
                } else {
                    callback([]);
                }
            } catch (e) {
                console.warn("Rudra Plugin Parsing Error:", e);
                callback([]);
            }
        });
    } catch (e) {
        callback([]);
    }
}