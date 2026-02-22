import Gio from 'gi://Gio';
import GLib from 'gi://GLib';


let _searchCancellable = null;


/**
 * Searches for files recursively in the user's home directory.
 * @param {string} text - The search query (must start with '.').
 * @param {function(Array<Object>)} callback - The function to call with the search results.
 * @param {number} [limit=50] - The maximum number of files to return.
 */
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
    

    /**
     * Completes the search and triggers the callback.
     * @private
     */
    function done() {
        if (finished) {
            return;
        }
        if (_searchCancellable === cancellable) {
            _searchCancellable = null;
        }
        finished = true;
        callback(results);
    }


    /**
     * Scans a directory asynchronously.
     * @param {Gio.File} dir - The directory file object to scan.
     * @param {number} depth - Current folder depth (stops at 3).
     * @private
     */
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


    /**
     * Reads a batch of files from the directory enumerator.
     * @param {Gio.FileEnumerator} enumerator - The enumerator object.
     * @param {Gio.File} parentDir - The parent directory.
     * @param {number} depth - The current depth.
     * @private
     */
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

    scanDir(homeDir, 0);
}


/**
 * Cleans up the file search operations to prevent memory leaks.
 */
export function cleanupFileSearch() {
    if (_searchCancellable) {
        _searchCancellable.cancel();
        _searchCancellable = null;
    }
}