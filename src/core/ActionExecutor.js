import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';


/**
 * Executes an action based on the selected search result item.
 * Handles applications, files, shell commands, and web URLs.
 * @param {Object} item - The result item object to execute.
 * @param {string} item.type - The type of the item ('app', 'file', 'command', 'web').
 * @param {string} [item.command] - The shell command to execute.
 * @param {string} [item.url] - The web URL to open.
 * @param {Object} [item.file] - The Gio.File object to open.
 * @param {string} [item.id] - The application ID to launch.
 * @param {Object} [item.appInfo] - The Gio.AppInfo fallback object.
 */
export function executeItem(item) {
    try {
        if (item.type === 'command') {
            let parsedArgs = GLib.shell_parse_argv(item.command);
            let argv = parsedArgs[1];
            Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
            
        } else if (item.type === 'web') {
            let context = global.create_app_launch_context(0, -1);
            Gio.AppInfo.launch_default_for_uri(item.url, context);
            
        } else if (item.type === 'file') {
            let context = global.create_app_launch_context(0, -1);
            Gio.AppInfo.launch_default_for_uri(item.file.get_uri(), context);
            
        } else if (item.type === 'app') {
            let appSystem = Shell.AppSystem.get_default();
            let sysApp = appSystem.lookup_app(item.id);
            
            if (sysApp) {
                sysApp.activate();
            } else {
                item.appInfo.launch([], null);
            }
        }
    } catch (error) {
        console.error('Rudra launch error:', error);
        Main.notify('Error running command', error.message);
    }
}