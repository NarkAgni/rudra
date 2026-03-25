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


let _searchCancellable = null;

export function searchFiles(text, callback, limit = 50) {
    if (!text || !text.startsWith('.')) {
        callback([]);
        return;
    }
    
    let query = text.substring(1).trim().toLowerCase();
    
    if (query.length < 2) {
        callback([]);
        return;
    }

    if (_searchCancellable) {
        _searchCancellable.cancel();
        _searchCancellable = null;
    }

    const cancellable = new Gio.Cancellable();
    _searchCancellable = cancellable;

    const homePath = GLib.get_home_dir();
    const homeDir = Gio.File.new_for_path(homePath);
    const results = [];
    let pending = 0;
    let finished = false;

    const safetyTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 8000, () => {
        if (!finished) {
            console.warn('Rudra FileSearch: safety timeout triggered, forcing done()');
            done();
        }
        return GLib.SOURCE_REMOVE;
    });

    function done() {
        if (finished) {
            return;
        }
        GLib.source_remove(safetyTimeoutId);
        if (_searchCancellable === cancellable) {
            _searchCancellable = null;
        }
        finished = true;
        callback(results);
    }

    function scanDir(dir, depth) {
        if (depth > 3 || cancellable.is_cancelled() || results.length >= limit) {
            return;
        }
        
        pending++;
        
        dir.enumerate_children_async(
            'standard::name,standard::icon,standard::type',
            Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
            GLib.PRIORITY_DEFAULT_IDLE,
            cancellable,
            (d, res) => {
                let enumerator;
                try { 
                    enumerator = d.enumerate_children_finish(res); 
                } catch (error) { 
                    pending--;
                    if (pending === 0) {
                        done(); 
                    }
                    return; 
                }
                readBatch(enumerator, dir, depth);
            }
        );
    }

    function readBatch(enumerator, parentDir, depth) {
        if (cancellable.is_cancelled() || results.length >= limit) {
            enumerator.close_async(GLib.PRIORITY_DEFAULT, null, null);
            pending--;
            if (pending === 0) {
                done();
            }
            return;
        }

        enumerator.next_files_async(20, GLib.PRIORITY_DEFAULT_IDLE, cancellable, (e, res) => {
            let infos;
            try { 
                infos = e.next_files_finish(res); 
            } catch (error) { 
                pending--;
                if (pending === 0) {
                    done(); 
                }
                return; 
            }

            if (infos.length === 0 || results.length >= limit) {
                enumerator.close_async(GLib.PRIORITY_DEFAULT, null, null);
                pending--;
                if (pending === 0) {
                    done();
                }
                return;
            }

            for (let info of infos) {
                if (results.length >= limit) {
                    break;
                }
                
                let name = info.get_name();
                if (name.startsWith('.')) {
                    continue;
                }

                let child = parentDir.get_child(name);
                
                if (name.toLowerCase().includes(query)) {
                    let icon = info.get_icon();
                    if (!icon) {
                        icon = new Gio.ThemedIcon({ name: 'text-x-generic' });
                    }
                    
                    results.push({
                        type: 'file',
                        name: name,
                        description: child.get_path().replace(homePath, '~'),
                        icon: icon,
                        file: child,
                    });
                }
                
                if (info.get_file_type() === Gio.FileType.DIRECTORY && depth < 3) {
                    scanDir(child, depth + 1);
                }
            }
            
            readBatch(enumerator, parentDir, depth);
        });
    }

    if (!homeDir.query_exists(null)) {
        GLib.source_remove(safetyTimeoutId);
        callback([]);
        return;
    }

    scanDir(homeDir, 0);
}

export function cleanupFileSearch() {
    if (_searchCancellable) {
        _searchCancellable.cancel();
        _searchCancellable = null;
    }
}