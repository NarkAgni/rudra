import Gio from 'gi://Gio';
import { searchApps } from './AppSearch.js';
import { searchFiles } from './FileSearch.js';


/**
 * Attempts to evaluate a mathematical expression safely.
 * Only allows digits, spaces, and arithmetic operators/parentheses.
 * @param {string} query - The raw input text.
 * @returns {number|null} The result, or null if not a valid math expression.
 */
function _tryCalculate(query) {
    if (!/^[\d\s+\-*\/^%().]+$/.test(query)) {
        return null;
    }
    if (!/[+\-*\/^%]/.test(query)) {
        return null;
    }
    try {
        let expr = query.replace(/\^/g, '**');
        // eslint-disable-next-line no-new-func
        let result = Function('"use strict"; return (' + expr + ')')();
        if (!Number.isFinite(result)) {
            return null;
        }
        return Math.round(result * 1e10) / 1e10;
    } catch (e) {
        return null;
    }
}


/**
 * Parses the user's input query to determine the mode (App, File, Web, Command)
 * and fetches the corresponding results asynchronously.
 * @param {string} query - The raw input text from the search entry.
 * @param {number} maxRes - The maximum allowed results from user settings.
 * @param {function(Array<Object>)} callback - Function to execute when results are ready.
 */
export function fetchResults(query, maxRes, callback) {
    if (!query) {
        callback([]);
        return;
    }

    // Calculator Mode
    let calcResult = _tryCalculate(query);
    if (calcResult !== null) {
        callback([{
            type: 'calc',
            name: String(calcResult),
            description: query.trim() + ' = ' + calcResult,
            icon: new Gio.ThemedIcon({ name: 'accessories-calculator-symbolic' }),
            result: String(calcResult)
        }]);
        return;
    }

    // Command Line Mode
    if (query.startsWith('>')) {
        let commandText = query.substring(1).trim();
        if (commandText) {
            let resultList = [{
                type: 'command', 
                name: 'Run Command', 
                description: commandText,
                icon: new Gio.ThemedIcon({ name: 'utilities-terminal-symbolic' }), 
                command: commandText
            }];
            callback(resultList);
            return;
        }
    }

    // Google Search Mode
    if (query.startsWith('g ')) {
        let searchText = query.substring(2).trim();
        if (searchText) {
            let resultList = [{
                type: 'web', 
                name: 'Search Google', 
                description: searchText,
                icon: new Gio.ThemedIcon({ names: ['goa-account-google', 'google', 'web-browser-symbolic'] }),
                url: 'https://www.google.com/search?q=' + encodeURIComponent(searchText)
            }];
            callback(resultList);
            return;
        }
    }

    // YouTube Search Mode
    if (query.startsWith('yt ')) {
        let searchText = query.substring(3).trim();
        if (searchText) {
            let resultList = [{
                type: 'web', 
                name: 'Search YouTube', 
                description: searchText,
                icon: new Gio.ThemedIcon({ names: ['youtube', 'brand-youtube', 'im-youtube', 'video-x-generic'] }),
                url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(searchText)
            }];
            callback(resultList);
            return;
        }
    }

    // File Search Mode
    if (query.startsWith('.')) {
        searchFiles(query, (fileResults) => { 
            callback(fileResults.slice(0, maxRes)); 
        }, maxRes);
        return;
    }

    // Default: Application Search Mode
    let appResults = searchApps(query, maxRes);
    callback(appResults);
}