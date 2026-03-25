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

export function hexToRgba(hex, alphaInt, fallbackRgb = '30, 30, 30') {
    let alpha = (alphaInt / 255).toFixed(2);
    
    if (!hex || !hex.startsWith('#')) {
        return `rgba(${fallbackRgb}, ${alpha})`;
    }
    
    let hexString = hex.substring(1);
    
    if (hexString.length === 3) {
        hexString = hexString.split('').map(char => char + char).join('');
    }
    
    if (hexString.length > 6) {
        hexString = hexString.substring(0, 6);
    }
    
    let red = parseInt(hexString.substring(0, 2), 16);
    let green = parseInt(hexString.substring(2, 4), 16);
    let blue = parseInt(hexString.substring(4, 6), 16);
    
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function escapeMarkup(str) {
    if (!str) {
        return '';
    }
    
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}