import Gtk from 'gi://Gtk';


/**
 * Creates a circular reset button for a specific setting key.
 * @param {Gio.Settings} settings - The settings object.
 * @param {string} key - The specific settings key to track and reset.
 * @returns {Gtk.Box} A box widget containing a separator and the button.
 */
export function makeResetBtn(settings, key) {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });
    
    const divider = new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL });
    divider.set_margin_top(12); 
    divider.set_margin_bottom(12);
    box.append(divider);

    const btn = new Gtk.Button({
        icon_name: 'edit-undo-symbolic', 
        valign: Gtk.Align.CENTER,
        css_classes: ['flat', 'circular'], 
        tooltip_text: 'Reset to default'
    });

    const updateUI = () => {
        let currentValue = settings.get_value(key);
        let defaultValue = settings.get_default_value(key);
        let isDefault = currentValue.equal(defaultValue);
        
        btn.set_sensitive(!isDefault);
        
        if (isDefault) {
            btn.set_opacity(0.3);
        } else {
            btn.set_opacity(1.0);
        }
    };

    btn.connect('clicked', () => {
        settings.reset(key);
    });
    
    settings.connect(`changed::${key}`, updateUI);
    updateUI();
    
    box.append(btn);
    return box;
}


/**
 * Creates a circular reset button that resets multiple settings at once.
 * @param {Gio.Settings} settings - The settings object.
 * @param {Array<string>} keys - An array of settings keys to reset.
 * @returns {Gtk.Button} The reset button widget.
 */
export function makeGroupResetBtn(settings, keys) {
    const btn = new Gtk.Button({
        icon_name: 'edit-undo-symbolic', 
        valign: Gtk.Align.CENTER,
        css_classes: ['flat', 'circular'], 
        tooltip_text: 'Reset all options in this group'
    });

    const updateUI = () => {
        let anyChanged = false;
        
        for (const key of keys) {
            if (settings.settings_schema.has_key(key)) {
                let currentValue = settings.get_value(key);
                let defaultValue = settings.get_default_value(key);
                
                if (!currentValue.equal(defaultValue)) {
                    anyChanged = true; 
                    break;
                }
            }
        }
        
        btn.set_sensitive(anyChanged);
        
        if (anyChanged) {
            btn.set_opacity(1.0);
        } else {
            btn.set_opacity(0.3);
        }
    };

    btn.connect('clicked', () => {
        for (const key of keys) {
            if (settings.settings_schema.has_key(key)) {
                settings.reset(key);
            }
        }
    });

    for (const key of keys) {
        if (settings.settings_schema.has_key(key)) {
            settings.connect(`changed::${key}`, updateUI);
        }
    }
    
    updateUI();
    return btn;
}