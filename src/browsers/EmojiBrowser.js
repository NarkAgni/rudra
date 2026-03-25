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


let EMOJI_CATALOG = [];
let PREMAPPED_EMOJIS = [];
let CATEGORIES = ['All'];
let currentCategory = 'All';

export function loadEmojis(extPath) {
    try {
        let file = Gio.File.new_for_path(extPath + '/src/data/emojis.json');
        if (!file.query_exists(null)) {
            console.error('Rudra: emojis.json not found at ' + extPath + '/src/data/emojis.json');
            return;
        }

        let [, contents] = file.load_contents(null);
        let decoder = new TextDecoder('utf-8');
        let data = JSON.parse(decoder.decode(contents));
        EMOJI_CATALOG = data.emojis;
        let cats = new Set();
        
        PREMAPPED_EMOJIS = EMOJI_CATALOG.map(entry => {
            if (entry.category) cats.add(entry.category);
            return {
                type: 'emoji',
                name: entry.emoji,
                emojiName: entry.name,
                text: entry.emoji,
                category: entry.category 
            };
        });

        CATEGORIES = ['All', ...Array.from(cats)];
    } catch (e) {
        console.error('Rudra: Failed to load emojis.json', e);
    }
}

export function getCategories() { return CATEGORIES; }
export function getCategory() { return currentCategory; }
export function setCategory(cat) { currentCategory = cat; }

export function searchEmojis(query) {
    let matches = EMOJI_CATALOG;

    if (currentCategory !== 'All') {
        matches = matches.filter(e => e.category === currentCategory);
    }

    if (query) {
        let q = query.toLowerCase().trim();
        matches = matches.filter(entry => entry.name.toLowerCase().includes(q));
    }

    return matches.slice(0, 200).map(entry => ({
        type: 'emoji',
        name: entry.emoji,
        emojiName: entry.name,
        text: entry.emoji
    }));
}