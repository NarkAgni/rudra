import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import Clutter from 'gi://Clutter';
import { searchApps, searchFiles } from './search.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

function escapeMarkup(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export class SearchResults {

    constructor(launcher, settings) {
        this._launcher = launcher;
        this._settings = settings;
        this._selectedIndex = -1;
        this._buttons = [];
        this._resultsData = [];
        this._currentQuery = '';
        this._searchTimestamp = 0;
        this._scrollIdleId = 0;
        this.onVisibilityChange = null;
        this._fontFamily = 'Sans';
        this._fontSizePt = 14;

        this._scrollView = new St.ScrollView({
            style_class: 'results-scroll-view',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            visible: false,
            x_expand: true,
        });

        this._contentBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style_class: 'results-content-box',
        });

        this._scrollView.set_child(this._contentBox);
    }

    get widget() { return this._scrollView; }

    updateStyles(family, sizePt) {
        this._fontFamily = family;
        this._fontSizePt = sizePt;
        if (this._currentQuery) {
            this.update(this._currentQuery);
        }
    }

    _getHighlightMarkup(text, query) {
        let cleanQuery = query;
        if (cleanQuery.startsWith('.'))   cleanQuery = cleanQuery.substring(1);
        if (cleanQuery.startsWith('>'))   cleanQuery = cleanQuery.substring(1);
        if (cleanQuery.startsWith('g '))  cleanQuery = cleanQuery.substring(2);
        if (cleanQuery.startsWith('yt ')) cleanQuery = cleanQuery.substring(3);

        if (!cleanQuery || cleanQuery.trim() === '') return escapeMarkup(text);

        let escaped = escapeMarkup(text);
        let escapedQuery = escapeMarkup(cleanQuery.trim());

        try {
            let regex = new RegExp(
                `(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'
            );
            let color = this._settings.get_string('highlight-color') || '#7aa2f7';
            return escaped.replace(regex, `<span foreground="${color}" font_weight="bold">$1</span>`);
        } catch (e) {
            return escaped;
        }
    }

    updateHighlightColor() {
        if (this._currentQuery) this._rebuildUI();
    }

    refreshSelectionColor() {
        if (this._selectedIndex >= 0 && this._selectedIndex < this._buttons.length) {
            this._updateButtonColor(this._selectedIndex);
        }
    }

    _hexToRgb(hex, alpha) {
        if (!hex || !hex.startsWith('#')) return `rgba(74, 111, 165, ${alpha})`;
        let h = hex.substring(1, 7);
        let r = parseInt(h.substring(0, 2), 16);
        let g = parseInt(h.substring(2, 4), 16);
        let b = parseInt(h.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    _updateButtonColor(index) {
        if (index < 0 || index >= this._buttons.length) return;
        let btn = this._buttons[index];
        let spacing = this._settings.get_int('result-spacing');
        let styleBase = `border-radius: 8px; margin: ${spacing}px 8px;`;

        let selHex     = this._settings.get_string('selection-color') || '#4a6fa5';
        let selOpacity  = this._settings.get_int('selection-opacity');
        if (selOpacity === 0) selOpacity = 200;
        let selAlpha   = (selOpacity / 255).toFixed(2);
        let selColor   = this._hexToRgb(selHex, selAlpha);

        let hoverHex   = this._settings.get_string('hover-color') || '#3d59a1';
        let hoverOpacity = this._settings.get_int('hover-opacity');
        if (hoverOpacity === 0) hoverOpacity = 80;
        let hoverAlpha = (hoverOpacity / 255).toFixed(2);
        let hoverColor = this._hexToRgb(hoverHex, hoverAlpha);

        if (index === this._selectedIndex) {
            btn.set_style(`background-color: ${selColor}; ${styleBase}`);
        } else if (btn.hover) {
            btn.set_style(`background-color: ${hoverColor}; ${styleBase}`);
        } else {
            btn.set_style(`background-color: transparent; ${styleBase}`);
        }
    }

    _setSelected(index) {
        let prevIndex = this._selectedIndex;
        this._selectedIndex = index;

        if (prevIndex >= 0) this._updateButtonColor(prevIndex);
        if (index >= 0 && index < this._buttons.length) {
            this._updateButtonColor(index);
            this._scrollToItem(index);
        }

        let item = (index >= 0 && index < this._resultsData.length)
            ? this._resultsData[index] : null;

        if (item && item.type === 'app') {
            let extra = item.isSetting ? ' - System Setting' : '';
            if (this._launcher.showAutocomplete) {
                this._launcher.showAutocomplete(item.name, extra);
            }
        } else {
            if (this._launcher.showAutocomplete) {
                this._launcher.showAutocomplete(null);
            }
        }
    }

    _scrollToItem(index) {
        if (this._scrollIdleId) {
            GLib.source_remove(this._scrollIdleId);
            this._scrollIdleId = 0;
        }
        this._scrollIdleId = GLib.idle_add(GLib.PRIORITY_LOW, () => {
            this._scrollIdleId = 0;
            try {
                let btn = this._buttons[index];
                if (!btn || !this._scrollView) return GLib.SOURCE_REMOVE;
                let adj = this._scrollView.vadjustment;
                if (!adj) return GLib.SOURCE_REMOVE;
                let pageSize = adj.get_page_size();
                let current  = adj.get_value();
                let alloc    = btn.get_allocation_box();
                let top      = alloc.y1;
                let bottom   = alloc.y2;
                const PAD = 10;
                if (top < current)                       adj.set_value(top);
                else if (bottom + PAD > current + pageSize) adj.set_value(bottom + PAD - pageSize);
            } catch (e) { }
            return GLib.SOURCE_REMOVE;
        });
    }

    _resizeToFitContent() {
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (!this._buttons || this._buttons.length === 0) return GLib.SOURCE_REMOVE;
            let visibleCount = this._settings.get_int('visible-results');
            let limit = Math.min(this._buttons.length, visibleCount);
            let totalHeight = 0;

            for (let i = 0; i < limit; i++) {
                if (!this._buttons[i]) break;
                let [, nat] = this._buttons[i].get_preferred_height(-1);
                totalHeight += nat;
            }

            if (limit > 0) totalHeight += 18;
            this._scrollView.set_height(totalHeight);
            return GLib.SOURCE_REMOVE;
        });
    }

    update(text) {
        this._currentQuery = text ? text.trim() : '';
        let myTimestamp = Date.now();
        this._searchTimestamp = myTimestamp;
        this._resultsData = [];

        if (!this._currentQuery) {
            this._rebuildUI();
            return;
        }

        let maxRes = this._settings.get_int('max-results');

        if (this._currentQuery.startsWith('>')) {
            let cmd = this._currentQuery.substring(1).trim();
            if (cmd) {
                this._resultsData = [{
                    type: 'command',
                    name: 'Run Command',
                    description: cmd,
                    icon: new Gio.ThemedIcon({ name: 'utilities-terminal-symbolic' }),
                    command: cmd
                }];
                this._rebuildUI();
                return;
            }
        }

        if (this._currentQuery.startsWith('g ')) {
            let query = this._currentQuery.substring(2).trim();
            if (query) {
                let googleIcon = new Gio.ThemedIcon({
                    names: ['goa-account-google', 'google', 'web-browser-symbolic']
                });
                this._resultsData = [{
                    type: 'web',
                    name: 'Search Google',
                    description: query,
                    icon: googleIcon,
                    url: 'https://www.google.com/search?q=' + encodeURIComponent(query)
                }];
                this._rebuildUI();
                return;
            }
        }

        if (this._currentQuery.startsWith('yt ')) {
            let query = this._currentQuery.substring(3).trim();
            if (query) {
                let ytIcon = new Gio.ThemedIcon({
                    names: ['youtube', 'brand-youtube', 'im-youtube', 'video-x-generic']
                });
                this._resultsData = [{
                    type: 'web',
                    name: 'Search YouTube',
                    description: query,
                    icon: ytIcon,
                    url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query)
                }];
                this._rebuildUI();
                return;
            }
        }

        if (this._currentQuery.startsWith('.')) {
            searchFiles(this._currentQuery, (fileResults) => {
                if (this._searchTimestamp !== myTimestamp) return;
                this._resultsData = fileResults.slice(0, maxRes);
                this._rebuildUI();
            });
            return;
        }

        this._resultsData = searchApps(this._currentQuery, maxRes);
        this._rebuildUI();
    }

    _rebuildUI() {
        this._contentBox.destroy_all_children();
        this._buttons = [];
        this._selectedIndex = -1;

        if (this._resultsData.length === 0) {
            this._scrollView.hide();
            if (this.onVisibilityChange) this.onVisibilityChange(false);
            return;
        }

        this._scrollView.show();
        if (this.onVisibilityChange) this.onVisibilityChange(true);

        let spacing = this._settings.get_int('result-spacing');

        this._resultsData.forEach((item, index) => {
            this._createResultItem(item, index, spacing);
        });

        this._resizeToFitContent();
        if (this._buttons.length > 0) this._setSelected(0);
    }

    _createResultItem(item, index, spacing) {
        let btn = new St.Button({
            reactive: true,
            can_focus: false,
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            style_class: 'result-item',
            style: `margin: ${spacing}px 8px;`
        });

        btn.connect('notify::hover', () => this._updateButtonColor(index));
        btn.connect('clicked', () => this._activateItem(item));

        let row = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'result-row',
        });

        if (item.icon) {
            row.add_child(new St.Icon({
                gicon: item.icon,
                icon_size: 36,
                style: 'min-width: 36px; min-height: 36px;'
            }));
        } else {
            row.add_child(new St.Widget({ style_class: 'result-icon-placeholder' }));
        }

        let textCol = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'result-text-col'
        });

        let nameStyle = `font-family: "${this._fontFamily}"; font-size: ${this._fontSizePt}pt;`;
        let nameLabel = new St.Label({ style_class: 'result-name', style: nameStyle });
        nameLabel.clutter_text.use_markup = true;
        nameLabel.clutter_text.ellipsize = 3;

        if (item.type === 'web' || item.type === 'command') {
            nameLabel.clutter_text.set_text(item.name || '');
        } else {
            nameLabel.clutter_text.set_markup(
                this._getHighlightMarkup(item.name || '', this._currentQuery)
            );
        }

        textCol.add_child(nameLabel);

        let descStr = item.description || '';
        if (item.isSetting) {
            descStr = 'System Setting' + (descStr ? ' • ' + descStr : '');
        }

        if (descStr && descStr.trim() !== '') {
            let descSize = Math.max(8, this._fontSizePt * 0.85);
            let descStyle = `font-family: "${this._fontFamily}"; font-size: ${descSize}pt;`;
            let descLabel = new St.Label({ style_class: 'result-desc', style: descStyle });
            descLabel.clutter_text.ellipsize = 3;
            descLabel.clutter_text.set_text(descStr);
            textCol.add_child(descLabel);
        }

        row.add_child(textCol);
        btn.set_child(row);
        this._contentBox.add_child(btn);
        this._buttons.push(btn);
    }

    _activateItem(item) {
        try {
            if (item.type === 'command') {
                try {
                    let [, argv] = GLib.shell_parse_argv(item.command);
                    let proc = new Gio.Subprocess({
                        argv: argv,
                        flags: Gio.SubprocessFlags.NONE
                    });
                    proc.init(null);
                } catch (e) {
                    Main.notify('Error running command', e.message);
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
                if (sysApp) sysApp.activate();
                else item.appInfo.launch([], null);
            }

        } catch (e) {
            console.error('Rudra launch error:', e);
        }

        this._launcher.close();
    }

    selectNext() {
        if (this._buttons.length === 0) return;
        this._setSelected((this._selectedIndex + 1) % this._buttons.length);
    }

    selectPrev() {
        if (this._buttons.length === 0) return;
        let prev = this._selectedIndex <= 0
            ? this._buttons.length - 1
            : this._selectedIndex - 1;
        this._setSelected(prev);
    }

    activateSelected() {
        if (this._selectedIndex >= 0 && this._selectedIndex < this._buttons.length)
            this._buttons[this._selectedIndex].emit('clicked', 0);
    }

    clear() {
        this._searchTimestamp = Date.now();

        if (this._scrollIdleId) {
            GLib.source_remove(this._scrollIdleId);
            this._scrollIdleId = 0;
        }

        this._contentBox.destroy_all_children();
        this._buttons = [];
        this._resultsData = [];
        this._selectedIndex = -1;
        this._currentQuery = '';
        this._scrollView.hide();

        if (this.onVisibilityChange) this.onVisibilityChange(false);
    }

    destroy() {
        if (this._scrollIdleId) {
            GLib.source_remove(this._scrollIdleId);
            this._scrollIdleId = 0;
        }
    }
}