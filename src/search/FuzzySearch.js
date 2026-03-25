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

export function fuzzyMatchScore(query, text) {
    if (!query) return 0;
    if (!text) return -1;

    const q = query.toLowerCase();
    const t = text.toLowerCase();
    const origT = text;

    let qIdx = 0;
    let tIdx = 0;
    let score = 0;
    let consecutive = 0;

    while (qIdx < q.length && tIdx < t.length) {
        let bestIdx = -1;
        let bestScore = -1;

        let scanLimit = Math.min(tIdx + 15, t.length);
        
        for (let lookAhead = tIdx; lookAhead < scanLimit; lookAhead++) {
            if (q[qIdx] === t[lookAhead]) {
                let charScore = 10;
                
                if (lookAhead === 0) {
                    charScore += 50;
                }
                else if ([' ', '-', '_', '.'].includes(t[lookAhead - 1])) {
                    charScore += 40;
                }
                else if (origT[lookAhead] >= 'A' && origT[lookAhead] <= 'Z' && 
                         origT[lookAhead - 1] >= 'a' && origT[lookAhead - 1] <= 'z') {
                    charScore += 30;
                }
                         
                if (lookAhead === tIdx && consecutive > 0) {
                    charScore += 15 + (consecutive * 5);
                }
                
                charScore -= (lookAhead - tIdx);

                if (charScore > bestScore) {
                    bestScore = charScore;
                    bestIdx = lookAhead;
                }
            }
        }

        if (bestIdx !== -1) {
            score += bestScore;
            
            if (bestIdx === tIdx) {
                consecutive++;
            } else {
                consecutive = 1;
                score -= Math.floor((bestIdx - tIdx) / 3);
            }
            
            tIdx = bestIdx + 1;
            qIdx++;
        } else {
            let found = false;
            for (let j = scanLimit; j < t.length; j++) {
                if (q[qIdx] === t[j]) {
                    score += 10; 
                    consecutive = 1;
                    score -= Math.floor((j - tIdx) / 3); 
                    tIdx = j + 1;
                    qIdx++;
                    found = true;
                    break;
                }
            }
            if (!found) return -1; 
        }
    }

    if (qIdx < q.length) return -1; 

    let extraChars = t.length - query.length;
    score -= (extraChars * 0.5);

    return Math.max(0, score);
}