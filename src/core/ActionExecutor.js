import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';


/**
 * Finds the first available terminal emulator on the system.
 * Returns an argv array ready to wrap a command, or null if none found.
 * @param {string} command - The shell command to run inside the terminal.
 * @returns {string[]|null} argv for Gio.Subprocess, or null.
 * @private
 */
function _buildTerminalArgv(command) {
    const terminals = [
        ['gnome-terminal', '--', 'bash', '-c', `${command}; echo; read -p "Press Enter to close..."`],
        ['ptyxis',         '--', 'bash', '-c', `${command}; echo; read -p "Press Enter to close..."`],
        ['kgx',            '--', 'bash', '-c', `${command}; echo; read -p "Press Enter to close..."`],
        ['konsole',        '-e', 'bash', '-c', `${command}; echo; read -p "Press Enter to close..."`],
        ['xfce4-terminal', '-e', `bash -c '${command}; echo; read -p "Press Enter to close..."'`],
        ['xterm',          '-e', `bash -c '${command}; echo; read -p "Press Enter to close..."'`],
    ];

    for (let args of terminals) {
        if (GLib.find_program_in_path(args[0])) {
            return args;
        }
    }
    return null;
}


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
            let argv = _buildTerminalArgv(item.command);

            if (argv) {
                Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
            } else {
                let parsed = GLib.shell_parse_argv(item.command);
                Gio.Subprocess.new(parsed[1], Gio.SubprocessFlags.NONE);
                Main.notify('Rudra', 'No terminal emulator found. Command ran in background.');
            }
            
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
        } else if (item.type === 'calc') {
            St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, item.result);
        }
    } catch (error) {
        console.error('Rudra launch error:', error);
        Main.notify('Error running command', error.message);
    }
}