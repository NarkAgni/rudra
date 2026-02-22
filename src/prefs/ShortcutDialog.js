import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';


/**
 * Opens a modal dialog allowing the user to record a custom keyboard shortcut.
 * @param {Gtk.Window} parent - The parent preferences window.
 * @param {Gio.Settings} settings - The extension settings object.
 */
export function showKeybindingDialog(parent, settings) {
    const dialog = new Gtk.Window({
        transient_for: parent, 
        modal: true, 
        title: 'Set Shortcut',
        default_width: 400, 
        default_height: 250, 
        resizable: false,
    });

    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL, 
        spacing: 24,
        halign: Gtk.Align.CENTER, 
        valign: Gtk.Align.CENTER,
        margin_top: 32, 
        margin_bottom: 32, 
        margin_start: 32, 
        margin_end: 32
    });

    let keyboardIcon = new Gtk.Image({ 
        icon_name: 'input-keyboard-symbolic', 
        pixel_size: 64, 
        css_classes: ['dim-label'] 
    });
    box.append(keyboardIcon);
    
    let instructionsLabel = new Gtk.Label({
        label: '<span size="large" weight="bold">Press keys to set shortcut</span>\n<span size="small" color="gray">Esc to cancel • Backspace to clear</span>',
        use_markup: true, 
        justify: Gtk.Justification.CENTER, 
        wrap: true, 
        max_width_chars: 30
    });
    box.append(instructionsLabel);
    
    box.append(new Gtk.ShortcutLabel({ accelerator: '', halign: Gtk.Align.CENTER }));
    dialog.set_child(box);

    const controller = new Gtk.EventControllerKey({ 
        propagation_phase: Gtk.PropagationPhase.CAPTURE 
    });
    dialog.add_controller(controller);

    controller.connect('key-pressed', (ctrl, keyval, keycode, state) => {
        const mask = state & Gtk.accelerator_get_default_mod_mask();
        
        if (keyval === Gdk.KEY_Escape) { 
            dialog.close(); 
            return Gdk.EVENT_STOP; 
        }
        
        if (keyval === Gdk.KEY_BackSpace) {
            settings.set_strv('toggle-launcher', []);
            dialog.close();
            return Gdk.EVENT_STOP;
        }
        
        if (Gtk.accelerator_valid(keyval, 0) === false) {
            return Gdk.EVENT_PROPAGATE;
        }

        const acceleratorString = Gtk.accelerator_name_with_keycode(Gdk.Display.get_default(), keyval, keycode, mask);
        
        if (acceleratorString) {
            settings.set_strv('toggle-launcher', [acceleratorString]);
            dialog.close();
        }
        
        return Gdk.EVENT_STOP;
    });

    dialog.present();
}