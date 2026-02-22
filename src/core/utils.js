/**
 * Utility functions for formatting and parsing data.
 * @module core/utils
 */

/**
 * Converts a HEX color code to an RGBA string format for Clutter styling.
 * @param {string} hex - The hex color string (e.g., '#ffffff' or '#fff').
 * @param {number} alphaInt - The alpha transparency value (0 to 255).
 * @param {string} [fallbackRgb='30, 30, 30'] - Fallback RGB values if hex is invalid.
 * @returns {string} The formatted 'rgba(r, g, b, a)' string.
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


/**
 * Escapes special characters in a string for safe Pango markup rendering.
 * @param {string} str - The raw string to escape.
 * @returns {string} The safely escaped markup string.
 */
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