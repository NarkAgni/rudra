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

import { fuzzyMatchScore } from '../search/FuzzySearch.js';
import { HistoryManager } from '../services/HistoryManager.js';


const _state = {
    appCache: [],
    appMonitor: null,
    appMonitorSignalId: null,
};

function _buildAppCache() {
    _state.appCache = [];
    let allApps = Gio.AppInfo.get_all();
    
    allApps.forEach(app => {
        let name = app.get_name();
        let id = app.get_id() || '';
        
        if (!name) return;

        let isSetting = id.includes('gnome-control-center') || 
                        id.includes('panel') || 
                        id.includes('org.gnome.settings');

        if (!app.should_show() && !isSetting) return;

        _state.appCache.push({
            type: 'app',
            name: name,
            searchName: name.toLowerCase(),
            searchId: id.toLowerCase(),
            description: app.get_description(),
            id: id,
            icon: app.get_icon(),
            appInfo: app,
            isSetting: isSetting
        });
    });
}

function _ensureAppCache() {
    if (!_state.appMonitor) {
        _state.appMonitor = Gio.AppInfoMonitor.get();
        _state.appMonitorSignalId = _state.appMonitor.connect('changed', _buildAppCache);
        _buildAppCache();
    }
}

export function searchApps(text, limit = 50, settings) {
    _ensureAppCache();
    
    if (!text || text.trim() === '') return [];
    
    let query = text.trim().toLowerCase();
    
    let useFuzzy = false;
    if (settings) {
        try {
            useFuzzy = settings.get_boolean('enable-fuzzy-search');
        } catch (e) {
            useFuzzy = false;
        }
    }
    
    let matches = _state.appCache.map(app => {
        let score = 0;
        let exactNameMatch = app.searchName.includes(query);
        let exactIdMatch = app.searchId.includes(query);
        let startsWithMatch = app.searchName.startsWith(query);
        
        if (startsWithMatch) {
            score = 3000;
        } else if (exactNameMatch) {
            score = 2000;
        } else if (exactIdMatch) {
            score = 1000;
        } else if (useFuzzy) {
            let fuzzyScore = fuzzyMatchScore(query, app.searchName);
            if (fuzzyScore > -1) {
                score = fuzzyScore;
            } else {
                return null;
            }
        } else {
            return null;
        }

        let usageCount = HistoryManager.getScore(app.id);
        let usageBoost = usageCount * 100;
        score += usageBoost;

        return { app, score, usageCount };
    }).filter(item => item !== null);

    matches.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
        return a.app.searchName.localeCompare(b.app.searchName);
    });
    
    return matches.slice(0, limit).map(m => m.app);
}

export function cleanupAppSearch() {
    if (_state.appMonitor && _state.appMonitorSignalId) {
        _state.appMonitor.disconnect(_state.appMonitorSignalId);
        _state.appMonitor = null;
        _state.appMonitorSignalId = null;
    }
    _state.appCache = [];
}