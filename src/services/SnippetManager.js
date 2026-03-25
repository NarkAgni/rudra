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

class TextSnippetManager {
    constructor() {
        this._snippets = [];
        this._activeTagFilter = 'All';
        this._file = this._getFile();
        this._fileMonitor = null;
        this._fileMonitorSignalId = null;
        this._load();
        this._startFileMonitor();
    }

    _getFile() {
        let configPath = GLib.get_user_config_dir();
        let dir = Gio.File.new_for_path(configPath).get_child('rudra@narkagni');
        if (!dir.query_exists(null)) dir.make_directory_with_parents(null);
        return dir.get_child('snippets.json');
    }

    _startFileMonitor() {
        try {
            this._fileMonitor = this._file.monitor_file(Gio.FileMonitorFlags.NONE, null);
            this._fileMonitorSignalId = this._fileMonitor.connect('changed', (monitor, file, otherFile, eventType) => {
                if (eventType === Gio.FileMonitorEvent.CHANGES_DONE_HINT ||
                    eventType === Gio.FileMonitorEvent.CREATED) {
                    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                        this._load();
                        return GLib.SOURCE_REMOVE;
                    });
                }
            });
        } catch (e) {
            console.warn('Rudra: Could not start file monitor for snippets.json', e);
        }
    }

    destroy() {
        if (this._fileMonitorSignalId && this._fileMonitor) {
            this._fileMonitor.disconnect(this._fileMonitorSignalId);
            this._fileMonitorSignalId = null;
        }
        if (this._fileMonitor) {
            this._fileMonitor.cancel();
            this._fileMonitor = null;
        }
    }

    _load() {
        try {
            if (this._file.query_exists(null)) {
                let [, contents] = this._file.load_contents(null);
                let decoder = new TextDecoder('utf-8');
                let data = JSON.parse(decoder.decode(contents));

                if (!Array.isArray(data)) {
                    this._snippets = Object.entries(data).map(([trigger, text], i) => ({
                        id: Date.now() + i,
                        name: trigger.replace('!', ''),
                        trigger: trigger,
                        text: text,
                        tags: [],
                        useCount: 0
                    }));
                    this._save();
                } else {
                    this._snippets = data.map(s => ({
                        ...s,
                        tags: s.tags || [],
                        useCount: s.useCount || 0
                    }));
                }
            } else {
                this._snippets = [];
                this._save();
            }
        } catch (e) {
            console.warn('Rudra: Failed to load snippets', e);
            this._snippets = [];
        }
    }

    _save() {
        try {
            let data = JSON.stringify(this._snippets, null, 2);
            let bytes = new GLib.Bytes(new TextEncoder().encode(data));
            this._file.replace_contents_bytes_async(
                bytes,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null,
                (file, res) => {
                    try {
                        file.replace_contents_finish(res);
                    } catch (e) {
                        console.error('Rudra: Failed to save snippets.json', e);
                    }
                }
            );
        } catch (e) {
            console.error('Rudra: Failed to save snippets', e);
        }
    }

    incrementUseCount(id) {
        let idx = this._snippets.findIndex(s => s.id === id);
        if (idx !== -1) {
            this._snippets[idx].useCount = (this._snippets[idx].useCount || 0) + 1;
            this._save();
        }
    }

    save(snippet) {
        let trigger = snippet.trigger.startsWith('!') ? snippet.trigger : '!' + snippet.trigger;
        
        let newObj = {
            id: snippet.id || Date.now(),
            name: snippet.name || trigger,
            trigger: trigger,
            text: snippet.text,
            icon: snippet.icon || 'accessories-text-editor-symbolic',
            tags: snippet.tags || [],
            useCount: snippet.useCount || 0
        };

        if (snippet.id) {
            let idx = this._snippets.findIndex(s => s.id === snippet.id);
            if (idx !== -1) {
                newObj.useCount = this._snippets[idx].useCount || 0;
                this._snippets[idx] = newObj;
            } else {
                this._snippets.push(newObj);
            }
        } else {
            this._snippets.push(newObj);
        }
        this._save();
    }

    delete(id) {
        let idx = this._snippets.findIndex(s => s.id === id);
        if (idx !== -1) {
            this._snippets.splice(idx, 1);
            this._save();
            return true;
        }
        return false;
    }

    getAll() {
        return [...this._snippets];
    }

    reload() {
        this._load();
    }

    getUniqueTags() {
        let tags = new Set();
        this.getAll().forEach(s => s.tags && s.tags.forEach(t => tags.add(t)));
        return ['All', ...Array.from(tags).sort()];
    }

    setTagFilter(tag) { this._activeTagFilter = tag; }
    getTagFilter() { return this._activeTagFilter || 'All'; }

    search(query) {
        let q = query.trim();
        let qLower = q.toLowerCase();

        if (qLower.startsWith('!del ')) {
            let trigger = q.substring(5).trim();
            if (!trigger) return [{ type: 'snippet-info', name: 'Usage: !del !trigger', description: 'Example: !del !email', icon: new Gio.ThemedIcon({ name: 'dialog-information-symbolic' }), text: '' }];
            let s = this._snippets.find(s => s.trigger === trigger);
            return [{
                type: 'snippet-delete',
                name: `🗑️ Delete: ${trigger}`,
                description: s ? `Will delete "${s.name}" • Enter to confirm` : `Not found: "${trigger}"`,
                icon: new Gio.ThemedIcon({ name: s ? 'edit-delete-symbolic' : 'dialog-error-symbolic' }),
                snippetId: s ? s.id : null,
                text: '',
                canDelete: !!s
            }];
        }

        let results = this._snippets;
        if (this._activeTagFilter && this._activeTagFilter !== 'All') {
            results = results.filter(s => s.tags && s.tags.includes(this._activeTagFilter));
        }

        let mappedResults = results
            .filter(s =>
                s.trigger.toLowerCase().includes(qLower) ||
                s.name.toLowerCase().includes(qLower) ||
                s.text.toLowerCase().includes(qLower) ||
                (s.tags && s.tags.some(t => t.toLowerCase().includes(qLower)))
            )
            .sort((a, b) => (b.useCount || 0) - (a.useCount || 0)) 
            .map(s => {
                let isEmoji = s.icon && !s.icon.includes('-symbolic') && s.icon.length <= 10;
                let iconObj = !isEmoji ? new Gio.ThemedIcon({ name: s.icon || 'accessories-text-editor-symbolic' }) : null;

                return {
                    type: 'snippet',
                    id: s.id,
                    name: `${s.trigger} - ${s.name}`,
                    trigger: s.trigger,
                    description: s.text,  
                    icon: iconObj,        
                    emojiText: isEmoji ? s.icon : null, 
                    text: s.text,
                    tags: s.tags || [],
                    useCount: s.useCount || 0,
                    refreshable: false
                };
            });

        if (q === '!' || qLower.startsWith('!new') || qLower.startsWith('!create') || mappedResults.length === 0) {
            mappedResults.unshift({
                type: 'snippet-new',
                name: 'Create New Snippet',
                description: 'Add a new custom text snippet',
                icon: new Gio.ThemedIcon({ name: 'document-new-symbolic' }),
                text: ''
            });
        }

        return mappedResults;
    }
}

export const SnippetManager = new TextSnippetManager();