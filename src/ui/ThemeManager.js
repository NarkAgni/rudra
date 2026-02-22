import Mtk from 'gi://Mtk';
import Pango from 'gi://Pango';
import { hexToRgba } from '../core/utils.js';


/**
 * Applies dynamic styles, colors, and fonts to the UI components based on user preferences.
 * @param {Object} settings - The GSettings object containing user preferences.
 * @param {Object} ui - The collection of Clutter/St actors to style.
 * @param {Object} ui.box - The main launcher container.
 * @param {Object} ui.entry - The search input field.
 * @param {Object} ui.hintLabel - The autocomplete hint label.
 * @param {Object} ui.resultsView - The SearchResults view instance.
 */
export function applyTheme(settings, ui) {
    let marginTop = settings.get_int('margin-top');
    let marginBottom = settings.get_int('margin-bottom');
    let marginLeft = settings.get_int('margin-left');
    let marginRight = settings.get_int('margin-right');
    let cornerRadius = settings.get_int('corner-radius');

    let bgHexColor = settings.get_string('background-color');
    let bgOpacity = settings.get_int('background-opacity');
    let backgroundColorString = hexToRgba(bgHexColor, bgOpacity); 

    let fontName = settings.get_string('font-name');
    let fontFamily = 'Sans';
    let fontSizePt = 14;
    let cssFontString = '';

    try {
        let fontDescription = Pango.FontDescription.from_string(fontName);
        fontFamily = fontDescription.get_family();
        
        let rawSize = fontDescription.get_size();
        if (fontDescription.get_size_is_absolute()) {
            fontSizePt = rawSize;
        } else {
            fontSizePt = rawSize / 1024;
        }
        
        cssFontString = `font-family: "${fontFamily}"; font-size: ${fontSizePt}pt;`;
    } catch (error) {
        cssFontString = 'font-family: "Sans"; font-size: 14pt;';
    }

    if (ui.box) {
        let boxStyle = `
            margin-top: ${marginTop}px;
            margin-bottom: ${marginBottom}px;
            margin-left: ${marginLeft}px;
            margin-right: ${marginRight}px;
            background-color: ${backgroundColorString};
            border-radius: ${cornerRadius}px;
            ${cssFontString}
        `;
        ui.box.set_style(boxStyle);
    }

    if (ui.entry) {
        ui.entry.set_style(cssFontString);
    }
    
    if (ui.hintLabel) {
        ui.hintLabel.set_style(`${cssFontString} color: #888888;`);
    }
    
    if (ui.resultsView) {
        ui.resultsView.updateStyles(fontFamily, fontSizePt);
    }
}


/**
 * Positions the main launcher box precisely in the center of the active monitor.
 * @param {Object} box - The main Clutter actor to be positioned.
 */
export function positionLauncherBox(box) {
    if (!box) {
        return;
    }
    
    let pointerPosition = global.get_pointer();
    let mouseX = pointerPosition[0];
    let mouseY = pointerPosition[1];
    
    let monitorRect = new Mtk.Rectangle({ x: mouseX, y: mouseY, width: 1, height: 1 });
    let monitorIndex = global.display.get_monitor_index_for_rect(monitorRect);
    
    if (monitorIndex < 0) {
        monitorIndex = global.display.get_primary_monitor();
    }
    
    let monitorGeometry = global.display.get_monitor_geometry(monitorIndex);
    
    let boxWidth = box.width;
    if (!boxWidth) {
        boxWidth = 660;
    }
    
    let xPosition = Math.floor(monitorGeometry.x + (monitorGeometry.width - boxWidth) / 2);
    let yPosition = 0;
    
    box.set_position(xPosition, yPosition);
}