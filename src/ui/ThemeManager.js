/*
 * Rudra GNOME Extension
 * Copyright (C) 2026 NarkAgni
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import Mtk from 'gi://Mtk';
import Pango from 'gi://Pango';


export const RUDRA = {
    bg: 'rgba(20, 20, 25, 0.95)',
    shadow: 'none',
    radius: 12,
    textPrimary: '#e8e9f0',
    textSecondary: 'rgba(255, 255, 255, 0.42)',
    separator: 'rgba(255, 255, 255, 0.06)',
    hoverColor: 'rgba(255, 255, 255, 0.055)',
    selectionColor: 'rgba(99, 110, 143, 0.45)',
    highlightColor: '#8b9fd4',
    caretColor: '#8b9fd4',
    refreshHover: 'rgba(255, 255, 255, 0.10)',
    settingsIcon: 'rgba(255, 255, 255, 0.35)',
};

export function applyTheme(settings, ui) {
    let fontFamily = 'Cantarell';
    let fontSizePt = 12;

    try {
        const fontName = settings.get_string('font-name');
        if (fontName) {
            const fd = Pango.FontDescription.from_string(fontName);
            const family = fd.get_family();
            const size = fd.get_size_is_absolute() ? fd.get_size() : fd.get_size() / 1024;
            if (family) fontFamily = family;
            if (size > 0) fontSizePt = size;
        }
    } catch (e) { }

    const entryFontSizePt = fontSizePt + 5;
    const cssFont = `font-family: "${fontFamily}"; font-size: ${fontSizePt}pt; color: ${RUDRA.textPrimary};`;

    let borderWidth = 1;
    let borderRgba = 'rgba(255,255,255,0.07)';
    
    let cornerRadius = 20;
    try {
        cornerRadius = settings.get_int('corner-radius');
    } catch (e) { }

    if (ui.tintBg) {
        ui.tintBg.set_style(`
            background-color: ${RUDRA.bg};
            border: ${borderWidth}px solid ${borderRgba};
            border-radius: ${cornerRadius}px;
            box-shadow: ${RUDRA.shadow};
            background-image: none;
        `);
    }

    if (ui.contentBox) {
        ui.contentBox.set_style(`background-color: transparent; background-image: none; box-shadow: none; ${cssFont}`);
    }

    if (ui.entry) {
        ui.entry.set_style(`
            font-family: "${fontFamily}";
            font-size: ${entryFontSizePt}pt;
            color: ${RUDRA.textPrimary};
            caret-color: ${RUDRA.caretColor};
            background-color: transparent;
            border: none;
            box-shadow: none;
            background-image: none;
        `);
    }

    if (ui.hintLabel) {
        ui.hintLabel.set_style(`font-family: "${fontFamily}"; font-size: ${entryFontSizePt}pt; color: ${RUDRA.textSecondary}; background-color: transparent; background-image: none; box-shadow: none;`);
    }

    if (ui.separator) {
        ui.separator.set_style(`background-color: ${RUDRA.separator}; background-image: none; box-shadow: none; height: 1px;`);
    }

    if (ui.resultsView) {
        ui.resultsView.updateStyles(fontFamily, fontSizePt);
        ui.resultsView.updateThemeColors({
            selectionColor:   '#636e8f',
            selectionOpacity: 115,
            hoverColor:       '#ffffff',
            hoverOpacity:     14,
            highlightColor:   RUDRA.highlightColor,
        });
    }
}

export function positionLauncherBox(mainBox, settings) {
    if (!mainBox || !settings) return;

    let boxWidth = 900;
    try {
        boxWidth = settings.get_int('launcher-width');
    } catch (e) {}

    mainBox.set_width(boxWidth);

    const [mouseX, mouseY] = global.get_pointer();
    const monitorRect = new Mtk.Rectangle({ x: mouseX, y: mouseY, width: 1, height: 1 });
    let monitorIndex = global.display.get_monitor_index_for_rect(monitorRect);
    if (monitorIndex < 0) monitorIndex = global.display.get_primary_monitor();

    const geo = global.display.get_monitor_geometry(monitorIndex);
    mainBox.set_position(
        Math.floor(geo.x + (geo.width - boxWidth) / 2),
        Math.floor(geo.y + geo.height * 0.25)
    );
}