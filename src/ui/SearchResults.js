import St from 'gi://St';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import { fetchResults } from '../core/QueryParser.js';
import { executeItem } from '../core/ActionExecutor.js';
import { hexToRgba, escapeMarkup } from '../core/utils.js';


/**
 * Handles the display and selection of search results within the launcher.
 */
export class SearchResults {
    
    /**
     * Initializes the SearchResults view.
     * @param {Object} launcher - The parent LauncherUI instance.
     * @param {Gio.Settings} settings - The extension settings object.
     */
    constructor(launcher, settings) {
        this._launcher = launcher;
        this._settings = settings;
        this._selectedIndex = -1;
        this._buttons = [];
        this._resultsData = [];
        this._currentQuery = '';
        this._searchTimestamp = 0;
        this._scrollIdleId = 0;
        this._resizeIdleId = 0;
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
            style_class: 'results-content-box' 
        });
        
        this._scrollView.set_child(this._contentBox);
    }


    /**
     * Gets the main scroll view widget.
     * @returns {St.ScrollView} The root widget of this view.
     */
    get widget() { 
        return this._scrollView; 
    }


    /**
     * Updates the text font styles from settings.
     * @param {string} family - The font family name.
     * @param {number} sizePt - The font size in points.
     */
    updateStyles(family, sizePt) {
        this._fontFamily = family;
        this._fontSizePt = sizePt;
        
        if (this._currentQuery) {
            this.update(this._currentQuery);
        }
    }


    /**
     * Applies bold highlighting markup to matched text in search results.
     * @param {string} text - The full result string.
     * @param {string} query - The search query to highlight.
     * @returns {string} Pango markup string with colored highlights.
     * @private
     */
    _getHighlightMarkup(text, query) {
        let cleanQuery = query.replace(/^[.>]/, '').replace(/^(g |yt )/, '').trim();
        
        if (!cleanQuery) {
            return escapeMarkup(text);
        }
        
        let escapedText = escapeMarkup(text);
        let escapedQuery = escapeMarkup(cleanQuery);
        
        try {
            let regexSafeQuery = escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let regex = new RegExp(`(${regexSafeQuery})`, 'gi');
            let highlightColor = this._settings.get_string('highlight-color') || '#7aa2f7';
            
            return escapedText.replace(regex, `<span foreground="${highlightColor}" font_weight="bold">$1</span>`);
        } catch (error) { 
            return escapedText; 
        }
    }


    /**
     * Rebuilds UI if the highlight color preference is changed.
     */
    updateHighlightColor() { 
        if (this._currentQuery) {
            this._rebuildUI();
        }
    }

    
    /**
     * Refreshes the color of the currently selected button.
     */
    refreshSelectionColor() { 
        if (this._selectedIndex >= 0 && this._selectedIndex < this._buttons.length) {
            this._updateButtonColor(this._selectedIndex);
        }
    }


    /**
     * Updates the background color of a specific result button based on its state.
     * @param {number} index - The index of the button to update.
     * @private
     */
    _updateButtonColor(index) {
        if (index < 0 || index >= this._buttons.length) {
            return;
        }
        
        let button = this._buttons[index];
        let spacing = this._settings.get_int('result-spacing');
        let styleBase = `border-radius: 8px; margin: ${spacing}px 8px;`;

        let selHex = this._settings.get_string('selection-color') || '#4a6fa5';
        let selOpacity = this._settings.get_int('selection-opacity') || 200;
        let selColor = hexToRgba(selHex, selOpacity, '74, 111, 165');

        let hoverHex = this._settings.get_string('hover-color') || '#3d59a1';
        let hoverOpacity = this._settings.get_int('hover-opacity') || 80;
        let hoverColor = hexToRgba(hoverHex, hoverOpacity, '74, 111, 165');

        if (index === this._selectedIndex) {
            button.set_style(`background-color: ${selColor}; ${styleBase}`);
        } else if (button.hover === true) {
            button.set_style(`background-color: ${hoverColor}; ${styleBase}`);
        } else {
            button.set_style(`background-color: transparent; ${styleBase}`);
        }
    }


    /**
     * Marks an item as visually selected and scrolls to it.
     * @param {number} index - The index of the item to select.
     * @private
     */
    _setSelected(index) {
        let prevIndex = this._selectedIndex;
        this._selectedIndex = index;
        
        if (prevIndex >= 0) {
            this._updateButtonColor(prevIndex);
        }
        
        if (index >= 0 && index < this._buttons.length) {
            this._updateButtonColor(index);
            this._scrollToItem(index);
        }
        
        let item = null;
        if (index >= 0 && index < this._resultsData.length) {
            item = this._resultsData[index];
        }
        
        if (item && item.type === 'app') {
            if (this._launcher.showAutocomplete) {
                let hint = item.isSetting ? ' - System Setting' : '';
                this._launcher.showAutocomplete(item.name, hint);
            }
        } else {
            if (this._launcher.showAutocomplete) {
                this._launcher.showAutocomplete(null);
            }
        }
    }


    /**
     * Smoothly scrolls the list view so the selected item is visible.
     * @param {number} index - The index of the button to scroll to.
     * @private
     */
    _scrollToItem(index) {
        if (this._scrollIdleId) { 
            GLib.source_remove(this._scrollIdleId); 
            this._scrollIdleId = 0; 
        }
        
        this._scrollIdleId = GLib.idle_add(GLib.PRIORITY_LOW, () => {
            this._scrollIdleId = 0;
            
            try {
                let button = this._buttons[index];
                let adjustment = this._scrollView.vadjustment;
                
                if (!button || !adjustment) {
                    return GLib.SOURCE_REMOVE;
                }
                
                let pageSize = adjustment.get_page_size();
                let currentValue = adjustment.get_value();
                let allocation = button.get_allocation_box();
                
                let topEdge = allocation.y1;
                let bottomEdge = allocation.y2;
                let padding = 10;
                
                if (topEdge < currentValue) {
                    adjustment.set_value(topEdge);
                } else if (bottomEdge + padding > currentValue + pageSize) {
                    adjustment.set_value(bottomEdge + padding - pageSize);
                }
            } catch (error) { 
            }
            
            return GLib.SOURCE_REMOVE;
        });
    }


    /**
     * Dynamically resizes the scroll view container based on content height.
     * @private
     */
    _resizeToFitContent() {
        if (this._resizeIdleId) { 
            GLib.source_remove(this._resizeIdleId); 
            this._resizeIdleId = 0; 
        }
        
        this._resizeIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._resizeIdleId = 0;
            
            if (!this._buttons || this._buttons.length === 0) {
                return GLib.SOURCE_REMOVE;
            }
            
            let visibleSetting = this._settings.get_int('visible-results');
            let limit = Math.min(this._buttons.length, visibleSetting);
            let totalHeight = 0;
            
            for (let i = 0; i < limit; i++) {
                if (!this._buttons[i]) {
                    break;
                }
                let heights = this._buttons[i].get_preferred_height(-1);
                let naturalHeight = heights[1];
                totalHeight += naturalHeight;
            }
            
            if (limit > 0) {
                totalHeight += 18;
            }
            
            this._scrollView.set_height(totalHeight);
            return GLib.SOURCE_REMOVE;
        });
    }


    /**
     * Starts fetching search results based on the provided text.
     * @param {string} text - The query text.
     */
    update(text) {
        if (text) {
            this._currentQuery = text.trim();
        } else {
            this._currentQuery = '';
        }
        
        let myTimestamp = Date.now();
        this._searchTimestamp = myTimestamp;
        this._resultsData = [];

        if (!this._currentQuery) {
            this._rebuildUI();
            return;
        }

        let maxRes = this._settings.get_int('max-results');
        
        fetchResults(this._currentQuery, maxRes, (results) => {
            if (this._searchTimestamp !== myTimestamp) {
                return;
            }
            this._resultsData = results;
            this._rebuildUI();
        });
    }


    /**
     * Builds the visual buttons for the fetched search results.
     * @private
     */
    _rebuildUI() {
        this._contentBox.destroy_all_children();
        this._buttons = [];
        this._selectedIndex = -1;

        if (this._resultsData.length === 0) {
            this._scrollView.hide();
            if (this.onVisibilityChange) {
                this.onVisibilityChange(false);
            }
            return;
        }

        this._scrollView.show();
        if (this.onVisibilityChange) {
            this.onVisibilityChange(true);
        }
        
        let spacing = this._settings.get_int('result-spacing');

        this._resultsData.forEach((item, index) => { 
            this._createResultItem(item, index, spacing); 
        });
        
        this._resizeToFitContent();
        
        if (this._buttons.length > 0) {
            this._setSelected(0);
        }
    }


    /**
     * Constructs a single search result button widget.
     * @param {Object} item - The result data object.
     * @param {number} index - The index of the item.
     * @param {number} spacing - The margin spacing.
     * @private
     */
    _createResultItem(item, index, spacing) {
        let button = new St.Button({ 
            reactive: true, 
            can_focus: false, 
            x_expand: true, 
            x_align: Clutter.ActorAlign.FILL, 
            style_class: 'result-item', 
            style: `margin: ${spacing}px 8px;` 
        });
        
        button.connect('notify::hover', () => {
            this._updateButtonColor(index);
        });
        
        button.connect('clicked', () => {
            executeItem(item); 
            this._launcher.close();
        });

        let rowBox = new St.BoxLayout({ 
            vertical: false, 
            x_expand: true, 
            y_align: Clutter.ActorAlign.CENTER, 
            style_class: 'result-row' 
        });
        
        if (item.icon) {
            let iconWidget = new St.Icon({ 
                gicon: item.icon, 
                icon_size: 36, 
                style: 'min-width: 36px; min-height: 36px;' 
            });
            rowBox.add_child(iconWidget);
        } else {
            rowBox.add_child(new St.Widget({ style_class: 'result-icon-placeholder' }));
        }

        let textColumn = new St.BoxLayout({ 
            vertical: true, 
            x_expand: true, 
            y_align: Clutter.ActorAlign.CENTER, 
            style_class: 'result-text-col' 
        });
        
        let nameLabel = new St.Label({ 
            style_class: 'result-name', 
            style: `font-family: "${this._fontFamily}"; font-size: ${this._fontSizePt}pt;` 
        });
        nameLabel.clutter_text.use_markup = true; 
        nameLabel.clutter_text.ellipsize = 3;

        if (item.type === 'web' || item.type === 'command') {
            nameLabel.clutter_text.set_text(item.name || '');
        } else {
            let markup = this._getHighlightMarkup(item.name || '', this._currentQuery);
            nameLabel.clutter_text.set_markup(markup);
        }
        textColumn.add_child(nameLabel);

        let descText = item.description || '';
        if (item.isSetting) {
            if (descText) {
                descText = 'System Setting • ' + descText;
            } else {
                descText = 'System Setting';
            }
        }
        
        if (descText && descText.trim() !== '') {
            let descSize = Math.max(8, this._fontSizePt * 0.85);
            let descLabel = new St.Label({ 
                style_class: 'result-desc', 
                style: `font-family: "${this._fontFamily}"; font-size: ${descSize}pt;` 
            });
            descLabel.clutter_text.ellipsize = 3; 
            descLabel.clutter_text.set_text(descText);
            textColumn.add_child(descLabel);
        }
        
        rowBox.add_child(textColumn); 
        button.set_child(rowBox); 
        this._contentBox.add_child(button); 
        this._buttons.push(button);
    }


    /**
     * Selects the next item in the list.
     */
    selectNext() { 
        if (this._buttons.length > 0) {
            let nextIndex = (this._selectedIndex + 1) % this._buttons.length;
            this._setSelected(nextIndex);
        }
    }

    
    /**
     * Selects the previous item in the list.
     */
    selectPrev() { 
        if (this._buttons.length > 0) {
            let prevIndex = (this._selectedIndex - 1 + this._buttons.length) % this._buttons.length;
            this._setSelected(prevIndex);
        }
    }
    

    /**
     * Emits the click event for the currently selected item.
     */
    activateSelected() { 
        if (this._selectedIndex >= 0 && this._selectedIndex < this._buttons.length) {
            this._buttons[this._selectedIndex].emit('clicked', 0);
        }
    }


    /**
     * Clears all search results and resets the view.
     */
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
        
        if (this.onVisibilityChange) {
            this.onVisibilityChange(false);
        }
    }


    /**
     * Disconnects signals and clears idle operations before destroying.
     */
    destroy() {
        if (this._scrollIdleId) { 
            GLib.source_remove(this._scrollIdleId); 
            this._scrollIdleId = 0; 
        }
        if (this._resizeIdleId) { 
            GLib.source_remove(this._resizeIdleId); 
            this._resizeIdleId = 0; 
        }
    }
}