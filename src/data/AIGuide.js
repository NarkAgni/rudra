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

export const AI_GUIDE_TEXT = `
<span size="x-large" weight="bold">How to Setup AI in Rudra</span>

Rudra supports both Cloud and Local AI. To keep this extension secure, you need to provide your own API key. <b>Your key is saved locally and never shared.</b>

<span size="large" weight="bold">1. Google Gemini (Recommended &amp; Free)</span>
• Go to <span foreground="#7aa2f7">aistudio.google.com</span>
• Sign in with your Google account.
• Click <b>"Get API Key"</b> and create a new key.

<span size="large" weight="bold">2. Groq (Ultra Fast &amp; Free)</span>
• Go to <span foreground="#7aa2f7">console.groq.com/keys</span>
• Create a new API Key.

<span size="large" weight="bold">3. Ollama (Local &amp; Free)</span>
• Install Ollama from <span foreground="#7aa2f7">ollama.com</span>
• Open terminal and run: <b>ollama run llama3</b>

<span size="large" weight="bold">4. Cohere (Free Web-Search AI)</span>
• Go to <span foreground="#7aa2f7">dashboard.cohere.com/api-keys</span>
• Sign up and create a Trial API Key (100% Free).

<span size="large" weight="bold">5. Perplexity (Paid API)</span>
• Go to <span foreground="#7aa2f7">www.perplexity.ai/settings/api</span>
• Note: Perplexity API requires a credit balance (e.g., $5).
`;