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
import Meta from 'gi://Meta';


class ClipboardHistoryManager {
    constructor() {
        this._history = [];
        this._maxItems = 30;
        this._clipboard = St.Clipboard.get_default();

        this._clipboardFile = this._getClipboardFile();
        this._load();

        this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (cb, text) => {
            if (text) {
                this._addText(text);
            }
        });

        this._selection = global.display.get_selection();

        this._selectionId = this._selection.connect('owner-changed', (selection, type) => {
            if (type === Meta.SelectionType.SELECTION_CLIPBOARD) {
                this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (cb, text) => {
                    if (text) {
                        this._addText(text);
                    }
                });
            }
        });
    }

    _getClipboardFile() {
        let configPath = GLib.get_user_config_dir();
        let rudraDir = Gio.File.new_for_path(configPath).get_child('rudra@narkagni');

        if (!rudraDir.query_exists(null)) {
            rudraDir.make_directory_with_parents(null);
        }

        return rudraDir.get_child('clipboard.json');
    }

    _load() {
        try {
            if (this._clipboardFile.query_exists(null)) {
                let [, contents] = this._clipboardFile.load_contents(null);
                let decoder = new TextDecoder('utf-8');
                let parsed = JSON.parse(decoder.decode(contents));
                if (Array.isArray(parsed)) {
                    this._history = parsed;
                }
            }
        } catch (e) {
            console.warn('Rudra Clipboard: Could not load clipboard.json, starting fresh.');
            this._history = [];
        }
    }

    _save() {
        try {
            let data = JSON.stringify(this._history);
            let bytes = new GLib.Bytes(new TextEncoder().encode(data));
            this._clipboardFile.replace_contents_bytes_async(
                bytes,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null,
                (file, res) => {
                    try {
                        file.replace_contents_finish(res);
                    } catch (e) {
                        console.error('Rudra Clipboard: Failed to save clipboard.json', e);
                    }
                }
            );
        } catch (e) {
            console.error('Rudra Clipboard: Failed to save clipboard.json', e);
        }
    }

    _addText(text) {
        let cleanText = text.trim();
        if (!cleanText) return;

        this._history = this._history.filter(item => item !== cleanText);
        this._history.unshift(cleanText);

        if (this._history.length > this._maxItems) {
            this._history.pop();
        }

        this._save();
    }

    search(query) {
        let q = query.toLowerCase().trim();
        let matches = this._history;

        if (q) {
            matches = this._history.filter(item => item.toLowerCase().includes(q));
        }

        return matches.map((text) => {
            let desc = text.replace(/\n/g, ' ').substring(0, 80);
            if (text.length > 80) desc += '...';

            let icon = new Gio.ThemedIcon({ name: 'edit-copy-symbolic' });
            let colorHex = null;
            let emojiText = null;

            let cleanText = text.trim();

            const hexRegex = /^#([A-Fa-f0-9]{8}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{3,4})$/;
            const rgbRegex = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*[\d.]+\s*)?\)$/i;
            const hslRegex = /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(?:,\s*[\d.]+\s*)?\)$/i;

            if (hexRegex.test(cleanText) || rgbRegex.test(cleanText) || hslRegex.test(cleanText)) {
                colorHex = cleanText;
            }
            else if (/^[a-z0-9]+(-[a-z0-9]+)*-symbolic$/.test(cleanText)) {
                try {
                    icon = new Gio.ThemedIcon({ name: cleanText });
                } catch (e) {}
            }
            else {
                try {
                    const emojiRegex = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]+$/u;
                    if (cleanText.length <= 4 && emojiRegex.test(cleanText)) {
                        emojiText = cleanText;
                    }
                } catch (e) {}
            }

            if (!colorHex && !emojiText) {
                let firstLine = cleanText.split('\n')[0].trim();

                if (firstLine.startsWith('file://')) {
                    firstLine = decodeURIComponent(firstLine.replace('file://', ''));
                }

                if (firstLine.startsWith('/')) {
                    try {
                        let file = Gio.File.new_for_path(firstLine);
                        if (file.query_exists(null)) {
                            let info = file.query_info('standard::content-type,standard::icon', Gio.FileQueryInfoFlags.NONE, null);
                            let contentType = info.get_content_type();
                            let gicon = info.get_icon();

                            if (contentType && contentType.startsWith('image/')) {
                                icon = new Gio.FileIcon({ file: file });
                            } else if (gicon) {
                                icon = gicon;
                            }
                        }
                    } catch (e) {
                        console.warn('Rudra Clipboard File Parse Error:', e);
                    }
                }
            }

            return {
                type: 'clipboard',
                name: desc,
                description: 'Copy to clipboard',
                icon: icon,
                text: text,
                colorHex: colorHex,
                emojiText: emojiText,
                isEditable: !colorHex && !emojiText && !text.trim().startsWith('/')  && !text.trim().startsWith('file://')
            };
        });
    }

    updateItem(oldText, newText) {
        let cleanNew = newText.trim();
        if (!cleanNew) return;
        this._history = this._history.filter(t => t !== oldText);
        this._history.unshift(cleanNew);
        if (this._history.length > this._maxItems) this._history.pop();
        this._save();
    }

    destroy() {
        if (this._selectionId && this._selection) {
            this._selection.disconnect(this._selectionId);
            this._selectionId = 0;
        }
        this._selection = null;
        this._clipboard = null;
    }
}

export const ClipboardManager = new ClipboardHistoryManager();