import Gio from 'gi://Gio';


let _appCache = [];
let _appMonitor = null;
let _appMonitorSignalId = null;


/**
 * Scans the system for installed applications and builds an internal cache.
 * Filters out hidden apps but retains system settings.
 * @private
 */
function _buildAppCache() {
    _appCache = [];
    let allApps = Gio.AppInfo.get_all();
    
    allApps.forEach(app => {
        let name = app.get_name();
        let id = app.get_id() || '';
        
        if (!name) {
            return;
        }

        let isSetting = id.includes('gnome-control-center') || 
                        id.includes('panel') || 
                        id.includes('org.gnome.settings');

        if (!app.should_show() && !isSetting) {
            return;
        }

        _appCache.push({
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


/**
 * Ensures the app cache is built and attaches a monitor to listen for newly installed apps.
 * @private
 */
function _ensureAppCache() {
    if (!_appMonitor) {
        _appMonitor = Gio.AppInfoMonitor.get();
        _appMonitorSignalId = _appMonitor.connect('changed', _buildAppCache);
        _buildAppCache();
    }
}


/**
 * Searches the local application cache for the given query.
 * @param {string} text - The search query provided by the user.
 * @param {number} [limit=50] - The maximum number of results to return.
 * @returns {Array<Object>} An array of formatted application result objects.
 */
export function searchApps(text, limit = 50) {
    _ensureAppCache();
    
    if (!text || text.trim() === '') {
        return [];
    }
    
    let query = text.trim().toLowerCase();
    
    let matches = _appCache.filter(app => {
        return app.searchName.includes(query) || app.searchId.includes(query);
    });

    matches.sort((a, b) => {
        let startA = a.searchName.startsWith(query);
        let startB = b.searchName.startsWith(query);
        
        if (startA && !startB) {
            return -1;
        }
        if (startB && !startA) {
            return 1;
        }
        return a.searchName.localeCompare(b.searchName);
    });
    
    return matches.slice(0, limit);
}


/**
 * Cleans up the application monitor to prevent memory leaks when the extension is disabled.
 */
export function cleanupAppSearch() {
    if (_appMonitor && _appMonitorSignalId) {
        _appMonitor.disconnect(_appMonitorSignalId);
        _appMonitor = null;
        _appMonitorSignalId = null;
    }
    _appCache = [];
}