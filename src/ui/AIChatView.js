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

import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

import { escapeMarkup } from '../core/utils.js';
import { AI_GUIDE_TEXT } from '../data/AIGuide.js';
import { fetchAIResponse } from '../services/AIClient.js';
import { HistoryManager } from '../services/HistoryManager.js';


function _parseMarkdownBlocks(rawText) {
    if (!rawText) return [{ type: 'text', content: '' }];
    let blocks = []; let codeRegex = /```([a-zA-Z0-9+#-]+)?\s*\n([\s\S]*?)```/g;
    let lastIndex = 0; let match;
    while ((match = codeRegex.exec(rawText)) !== null) {
        if (match.index > lastIndex) {
            let textPart = rawText.substring(lastIndex, match.index).trim();
            if (textPart) blocks.push({ type: 'text', content: textPart });
        }
        let lang = match[1] || 'Code'; lang = lang.charAt(0).toUpperCase() + lang.slice(1);
        let codeContent = match[2];
        if (codeContent.endsWith('\n')) codeContent = codeContent.slice(0, -1);
        blocks.push({ type: 'code', language: lang, content: codeContent });
        lastIndex = codeRegex.lastIndex;
    }
    if (lastIndex < rawText.length) {
        let textPart = rawText.substring(lastIndex).trim();
        if (textPart) blocks.push({ type: 'text', content: textPart });
    }
    return blocks.length > 0 ? blocks : [{ type: 'text', content: rawText }];
}

function _formatPangoText(text) {
    let formatted = escapeMarkup(text);
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<i>$1</i>');
    formatted = formatted.replace(/`([^`\n]+)`/g, '<span face="monospace" foreground="#ff9e64">$1</span>');
    return formatted;
}

export function showAIGuide(ctx) {
    ctx._pluginGuideActive = true;
    ctx.prepareFormBox();
    const _redirectToMain = () => { ctx._pluginGuideActive = false; ctx.closeFormBox(); };

    let titleRow = ctx.createFormTitleRow('AI Setup Guide', _redirectToMain);
    ctx._snippetFormBox.add_child(titleRow);

    let guideScroll = new St.ScrollView({ x_expand: true, style: 'min-height: 300px; max-height: 400px;' });
    guideScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
    guideScroll.set_overlay_scrollbars(false); guideScroll.add_style_class_name('rudra-scroll-clear');

    let guideLabel = new St.Entry({ can_focus: true, reactive: true, x_expand: true, style_class: 'rudra-guide-text', style: 'background: transparent; border: none; box-shadow: none;' });
    try {
        guideLabel.clutter_text.single_line_mode = false; guideLabel.clutter_text.line_wrap = true;
        guideLabel.clutter_text.line_wrap_mode = 2; guideLabel.clutter_text.editable = false;
        guideLabel.clutter_text.selectable = true; guideLabel.clutter_text.use_markup = true;
    } catch (e) { }
    guideLabel.clutter_text.set_markup(AI_GUIDE_TEXT);

    let linkRow = new St.BoxLayout({ vertical: false, style: 'margin-top: 20px;' });
    let geminiBtn = new St.Button({ reactive: true, style: 'background-color: rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 16px; margin-right: 12px;' });
    geminiBtn.set_child(new St.Label({ text: '🌐 Open Gemini Console', style: 'color: #7dcfff; font-weight: bold;' }));
    geminiBtn.connect('clicked', () => { Gio.AppInfo.launch_default_for_uri('https://aistudio.google.com', null); if (ctx._launcher) ctx._launcher.close(); });

    let groqBtn = new St.Button({ reactive: true, style: 'background-color: rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 16px;' });
    groqBtn.set_child(new St.Label({ text: '🌐 Open Groq Console', style: 'color: #7dcfff; font-weight: bold;' }));
    groqBtn.connect('clicked', () => { Gio.AppInfo.launch_default_for_uri('https://console.groq.com/keys', null); if (ctx._launcher) ctx._launcher.close(); });

    linkRow.add_child(geminiBtn); linkRow.add_child(groqBtn);

    let linkRow2 = new St.BoxLayout({ vertical: false, style: 'margin-top: 12px;' });
    
    let perpBtn = new St.Button({ reactive: true, style: 'background-color: rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 16px; margin-right: 12px;' });
    perpBtn.set_child(new St.Label({ text: '🌐 Open Perplexity Console', style: 'color: #7dcfff; font-weight: bold;' }));
    perpBtn.connect('clicked', () => { Gio.AppInfo.launch_default_for_uri('https://www.perplexity.ai/settings/api', null); if (ctx._launcher) ctx._launcher.close(); });
    
    let cohereBtn = new St.Button({ reactive: true, style: 'background-color: rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 16px;' });
    cohereBtn.set_child(new St.Label({ text: '🌐 Open Cohere Console', style: 'color: #7dcfff; font-weight: bold;' }));
    cohereBtn.connect('clicked', () => { Gio.AppInfo.launch_default_for_uri('https://dashboard.cohere.com/api-keys', null); if (ctx._launcher) ctx._launcher.close(); });
    
    linkRow2.add_child(perpBtn);
    linkRow2.add_child(cohereBtn);

    let guideBox = new St.BoxLayout({ vertical: true, x_expand: true });
    guideBox.add_child(guideLabel); 
    guideBox.add_child(linkRow);
    guideBox.add_child(linkRow2);
    
    guideScroll.set_child(guideBox); ctx._snippetFormBox.add_child(guideScroll);

    let lastH = 0;
    const _updateGuideHeight = () => {
        GLib.idle_add(GLib.PRIORITY_LOW, () => {
            try {
                let w = guideLabel.get_width();
                if (w > 20) {
                    let [, natH] = guideLabel.clutter_text.get_preferred_height(w);
                    let newH = natH + 40;
                    if (Math.abs(lastH - newH) > 5) { lastH = newH; guideLabel.set_height(newH); }
                }
            } catch (e) { }
            return GLib.SOURCE_REMOVE;
        });
    };
    guideLabel.connect('notify::allocation', _updateGuideHeight);
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => { _updateGuideHeight(); return GLib.SOURCE_REMOVE; });
    guideLabel.clutter_text.connect('cursor-changed', () => {
        GLib.idle_add(GLib.PRIORITY_LOW, () => {
            try {
                let adj = guideScroll.get_vadjustment ? guideScroll.get_vadjustment() : guideScroll.vadjustment;
                if (!adj) return GLib.SOURCE_REMOVE;
                let cursorRect = guideLabel.clutter_text.get_cursor_rect();
                let [, elY] = guideLabel.get_transformed_position(); let [, scY] = guideScroll.get_transformed_position();
                let relativeY = (elY - scY) + adj.get_value(); let cursorTop = relativeY + cursorRect.origin.y;
                let cursorBottom = cursorTop + cursorRect.size.height; let val = adj.get_value(); let pageSize = adj.get_page_size();
                if (cursorBottom > val + pageSize - 10) adj.set_value(Math.min(adj.upper - pageSize, cursorBottom - pageSize + 40));
                else if (cursorTop < val + 10) adj.set_value(Math.max(0, cursorTop - 40));
            } catch (e) { }
            return GLib.SOURCE_REMOVE;
        });
    });
}

function _triggerAIRequest(ctx) {
    let provider = ctx._aiProviderId !== undefined ? ctx._aiProviderId : ctx._settings.get_int('ai-provider');
    let apiKey = '';
    if (provider === 0) apiKey = ctx._settings.get_string('ai-api-key-gemini');
    else if (provider === 1) apiKey = ctx._settings.get_string('ai-api-key-groq');
    else if (provider === 3) apiKey = ctx._settings.get_string('ai-api-key-perplexity');
    else if (provider === 4) apiKey = ctx._settings.get_string('ai-api-key-cohere');

    fetchAIResponse(provider, apiKey, ctx._aiChatHistory, (response) => {
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            let urlRegex = /(https?:\/\/[^\s<)"]+)/g;
            let urls = [...new Set(response.match(urlRegex) || [])];
            ctx._aiIsThinking = false;
            ctx._aiChatHistory.push({ role: 'assistant', content: escapeMarkup(response), rawContent: response, links: urls });
            
            let title = ctx._aiChatHistory.length > 0 ? ctx._aiChatHistory[0].rawContent : 'New Chat';
            if (title.length > 40) title = title.substring(0, 37) + '...';
            
            HistoryManager.saveAIChat(ctx._currentChatId, ctx._aiChatHistory, title, false, ctx._aiProviderId);
            
            showAIView(ctx, null);
            return GLib.SOURCE_REMOVE;
        });
    });
}

export function showAIView(ctx, question, existingChatData = null, isNewEmpty = false) {
    
    let defaultProvider = ctx._settings.get_int('ai-provider');

    if (isNewEmpty) {
        ctx._currentChatId = Date.now();
        ctx._aiChatHistory = [];
        ctx._aiIsThinking = false;
        ctx._aiProviderId = defaultProvider;
    } else if (question !== null) {
        ctx._currentChatId = Date.now();
        ctx._aiChatHistory = [{ role: 'user', content: escapeMarkup(question), rawContent: question }];
        ctx._aiIsThinking = true;
        ctx._aiProviderId = defaultProvider;
        _triggerAIRequest(ctx);
    } else if (existingChatData !== null) {
        ctx._currentChatId = existingChatData.id;
        ctx._aiChatHistory = JSON.parse(JSON.stringify(existingChatData.messages));
        ctx._aiIsThinking = false;
        ctx._aiProviderId = existingChatData.provider !== undefined ? existingChatData.provider : defaultProvider;
    }

    ctx.prepareFormBox();
    ctx._scrollView.set_height(480);
    const _redirectToMain = () => ctx.closeFormBox();

    let headerRow = new St.BoxLayout({ vertical: false, x_expand: true, style_class: 'rudra-form-title-row' });
    
    let backBtn = new St.Button({ reactive: true, style_class: 'rudra-back-btn' });
    let backBox = new St.BoxLayout({ vertical: false, y_align: Clutter.ActorAlign.CENTER });
    backBox.add_child(new St.Icon({ icon_name: 'go-previous-symbolic', icon_size: 14, style: 'color: rgba(255,255,255,0.65);' }));
    backBtn.set_child(backBox);
    backBtn.connect('clicked', _redirectToMain);
    headerRow.add_child(backBtn);

    let titleLabel = new St.Label({ text: 'AI Assistant', style_class: 'rudra-form-title', x_expand: true, x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER });
    headerRow.add_child(titleLabel);

    const PROVIDERS = [
        { id: 0, name: 'Gemini', icon: 'goa-account-google' },
        { id: 1, name: 'Groq', icon: 'system-run-symbolic' },
        { id: 2, name: 'Ollama', icon: 'computer-symbolic' },
        { id: 3, name: 'Perplexity', icon: 'system-search-symbolic' },
        { id: 4, name: 'Cohere', icon: 'edit-find-symbolic' }
    ];

    let currentProv = PROVIDERS.find(p => p.id === ctx._aiProviderId) || PROVIDERS[0];

    let providerBtn = new St.Button({ 
        reactive: true, 
        can_focus: true,
        style_class: 'rudra-cat-btn'
    });
    
    let provBox = new St.BoxLayout({ vertical: false, y_align: Clutter.ActorAlign.CENTER });
    let provLabel = new St.Label({ 
        text: currentProv.name, 
        style: 'color: rgba(255,255,255,0.9); font-size: 14px; font-weight: bold; margin-right: 6px;',
        y_align: Clutter.ActorAlign.CENTER 
    });
    provBox.add_child(provLabel);
    provBox.add_child(new St.Icon({ icon_name: 'pan-down-symbolic', icon_size: 14, style: 'color: rgba(255,255,255,0.4);', y_align: Clutter.ActorAlign.CENTER }));
    providerBtn.set_child(provBox);
    headerRow.add_child(providerBtn);

    ctx._snippetFormBox.add_child(headerRow);

    if (ctx._aiProviderMenuWrapper) {
        ctx._aiProviderMenuWrapper.destroy();
        ctx._aiProviderMenuWrapper = null;
    }

    ctx._aiProviderMenuWrapper = new Clutter.Actor();
    let providerMenu = new St.BoxLayout({ 
        vertical: true, 
        visible: false, 
        reactive: true,
        style_class: 'rudra-dropdown-menu',
        style: 'min-width: 170px;'
    });

    PROVIDERS.forEach(p => {
        let isSelected = p.id === ctx._aiProviderId;
        let itemBtn = new St.Button({ reactive: true, x_expand: true, style_class: 'rudra-menu-item' });
        
        let box = new St.BoxLayout({ vertical: false, x_expand: true });
        let checkIcon = new St.Icon({
            icon_name: 'object-select-symbolic',
            icon_size: 14,
            style: `color: ${isSelected ? '#7aa2f7' : 'transparent'}; margin-right: 10px;`,
            y_align: Clutter.ActorAlign.CENTER
        });
        
        let optIcon = new St.Icon({
            icon_name: p.icon,
            icon_size: 16,
            style: 'color: #dddddd; margin-right: 10px;',
            y_align: Clutter.ActorAlign.CENTER
        });

        let label = new St.Label({
            text: p.name,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'rudra-menu-label',
            style: isSelected ? 'font-weight: bold; color: #fff;' : 'color: #eee;'
        });

        box.add_child(checkIcon);
        box.add_child(optIcon);
        box.add_child(label);
        itemBtn.set_child(box);
        
        itemBtn.connect('clicked', () => {
            ctx._aiProviderId = p.id;
            providerMenu.hide();
            if (ctx._currentChatId) {
                let title = ctx._aiChatHistory.length > 0 ? ctx._aiChatHistory[0].rawContent : 'New Chat';
                if (title.length > 40) title = title.substring(0, 37) + '...';
                HistoryManager.saveAIChat(ctx._currentChatId, ctx._aiChatHistory, title, false, ctx._aiProviderId);
            }
            showAIView(ctx, null); 
        });
        providerMenu.add_child(itemBtn);
    });

    ctx._aiProviderMenuWrapper.add_child(providerMenu);
    
    if (ctx._launcher && ctx._launcher._container) {
        ctx._launcher._container.add_child(ctx._aiProviderMenuWrapper);
    } else {
        ctx._snippetFormBox.add_child(ctx._aiProviderMenuWrapper);
    }

    providerBtn.connect('clicked', () => {
        if (providerMenu.visible) {
            providerMenu.hide();
        } else {
            let [bx, by] = providerBtn.get_transformed_position();
            let [bw, bh] = providerBtn.get_transformed_size();
            ctx._aiProviderMenuWrapper.set_position(bx + bw - 170, by + bh + 8);
            providerMenu.show();
            if (ctx._launcher && ctx._launcher._container) {
                ctx._launcher._container.set_child_above_sibling(ctx._aiProviderMenuWrapper, null);
            }
        }
    });

    if (ctx._launcher && ctx._launcher._container) {
        if (ctx._aiOutsideClickId) {
            ctx._launcher._container.disconnect(ctx._aiOutsideClickId);
        }
        ctx._aiOutsideClickId = ctx._launcher._container.connect('button-press-event', (actor, event) => {
            if (providerMenu.visible) {
                let [x, y] = event.get_coords();
                let [mx, my] = providerMenu.get_transformed_position();
                let [mw, mh] = providerMenu.get_transformed_size();
                
                let outside = (x < mx || x > mx + mw || y < my || y > my + mh);
                
                let [bx, by] = providerBtn.get_transformed_position();
                let [bw, bh] = providerBtn.get_transformed_size();
                let onButton = (x >= bx && x <= bx + bw && y >= by && y <= by + bh);

                if (outside && !onButton) providerMenu.hide();
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    if (!ctx._aiMenuPatched) {
        let origClose = ctx.closeFormBox;
        ctx.closeFormBox = function() {
            if (this._aiProviderMenuWrapper) {
                this._aiProviderMenuWrapper.destroy();
                this._aiProviderMenuWrapper = null;
            }
            if (this._launcher && this._launcher._container && this._aiOutsideClickId) {
                this._launcher._container.disconnect(this._aiOutsideClickId);
                this._aiOutsideClickId = null;
            }
            origClose.call(this);
        };
        ctx._aiMenuPatched = true;
    }

    let chatScroll = new St.ScrollView({ x_expand: true, y_expand: true, style: 'padding-right: 8px;' });
    chatScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
    chatScroll.set_overlay_scrollbars(false); chatScroll.add_style_class_name('rudra-scroll-clear');
    let chatBox = new St.BoxLayout({ vertical: true, x_expand: true, style: 'padding-bottom: 12px;' });

    let lastUserBubble = null;
    
    const _attachEntryScroll = (entryWidget, isCode = false) => {
        let lastH = 0;
        const _adjustHeight = () => {
            GLib.idle_add(GLib.PRIORITY_LOW, () => {
                try {
                    let w = entryWidget.get_width();
                    if (w > 20) {
                        let [, natH] = entryWidget.clutter_text.get_preferred_height(w);
                        let newH = natH + (isCode ? 24 : 20);
                        if (Math.abs(lastH - newH) > 5) { lastH = newH; entryWidget.set_height(newH); }
                    }
                } catch (e) { }
                return GLib.SOURCE_REMOVE;
            });
        };
        entryWidget.connect('notify::allocation', _adjustHeight);
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => { _adjustHeight(); return GLib.SOURCE_REMOVE; });
        entryWidget.clutter_text.connect('cursor-changed', () => {
            GLib.idle_add(GLib.PRIORITY_LOW, () => {
                try {
                    let adj = chatScroll.get_vadjustment ? chatScroll.get_vadjustment() : chatScroll.vadjustment;
                    if (!adj) return GLib.SOURCE_REMOVE;
                    let cursorRect = entryWidget.clutter_text.get_cursor_rect();
                    let [, elY] = entryWidget.get_transformed_position(); let [, scY] = chatScroll.get_transformed_position();
                    let relativeY = (elY - scY) + adj.get_value(); let cursorTop = relativeY + cursorRect.origin.y;
                    let cursorBottom = cursorTop + cursorRect.size.height; let val = adj.get_value(); let pageSize = adj.get_page_size();
                    if (cursorBottom > val + pageSize - 10) adj.set_value(Math.min(adj.upper - pageSize, cursorBottom - pageSize + 40));
                    else if (cursorTop < val + 10) adj.set_value(Math.max(0, cursorTop - 40));
                } catch (e) { }
                return GLib.SOURCE_REMOVE;
            });
        });
    };

    if (ctx._aiChatHistory && ctx._aiChatHistory.length > 0) {
        ctx._aiChatHistory.forEach(msg => {
            let bubble = new St.BoxLayout({ vertical: true, x_expand: true, style: 'margin-bottom: 16px;' });
            if (msg.role === 'user') lastUserBubble = bubble;

            let headerRow = new St.BoxLayout({ vertical: false, x_expand: true, style: 'margin-bottom: 8px;' });
            let senderIcon = new St.Icon({ icon_name: msg.role === 'user' ? 'avatar-default-symbolic' : 'system-run-symbolic', icon_size: 16, style: 'color: #7aa2f7; margin-right: 8px;' });
            let senderName = new St.Label({ text: msg.role === 'user' ? 'You' : 'AI Assistant', style: 'font-weight: bold; color: #7aa2f7; font-size: 11pt;' });
            headerRow.add_child(senderIcon); headerRow.add_child(senderName); bubble.add_child(headerRow);

            let blocksContainer = new St.BoxLayout({ vertical: true, x_expand: true });
            let blocks = _parseMarkdownBlocks(msg.rawContent || msg.content);

            blocks.forEach(block => {
                if (block.type === 'text') {
                    let textEntry = new St.Entry({ can_focus: true, reactive: true, x_expand: true, style: 'background: transparent; border: none; box-shadow: none; font-size: 12pt; color: rgba(255,255,255,0.9); line-height: 1.5; margin-bottom: 8px;' });
                    try {
                        textEntry.clutter_text.single_line_mode = false; textEntry.clutter_text.line_wrap = true;
                        textEntry.clutter_text.line_wrap_mode = 2; textEntry.clutter_text.editable = false;
                        textEntry.clutter_text.selectable = true; textEntry.clutter_text.use_markup = true;
                    } catch (e) { }
                    textEntry.clutter_text.set_markup(_formatPangoText(block.content));
                    _attachEntryScroll(textEntry, false); blocksContainer.add_child(textEntry);
                }
                else if (block.type === 'code') {
                    let codeContainer = new St.BoxLayout({ vertical: true, x_expand: true, style: 'margin-top: 4px; margin-bottom: 12px; border-radius: 8px; background-color: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08);' });
                    let codeHeader = new St.BoxLayout({ vertical: false, x_expand: true, style: 'padding: 6px 12px; background-color: rgba(255,255,255,0.05); border-radius: 8px 8px 0 0;' });
                    let langLabel = new St.Label({ text: block.language, style: 'color: rgba(255,255,255,0.6); font-size: 10.5pt; font-weight: bold;', y_align: Clutter.ActorAlign.CENTER });
                    let spacer = new St.Widget({ x_expand: true });
                    let copyBtn = new St.Button({ reactive: true, style: 'padding: 4px 6px; border-radius: 4px; background-color: transparent;' });
                    let copyBox = new St.BoxLayout({ vertical: false });
                    let copyIcon = new St.Icon({ icon_name: 'edit-copy-symbolic', icon_size: 14, style: 'color: rgba(255,255,255,0.6);' });
                    let copyText = new St.Label({ text: 'Copy Code', style: 'color: rgba(255,255,255,0.6); font-size: 9.5pt; margin-left: 6px;', y_align: Clutter.ActorAlign.CENTER });
                    copyBox.add_child(copyIcon); copyBox.add_child(copyText); copyBtn.set_child(copyBox);

                    copyBtn.connect('enter-event', () => { copyBtn.set_style('padding: 4px 6px; border-radius: 4px; background-color: rgba(255,255,255,0.1); transition-duration: 150ms;'); copyIcon.set_style('color: rgba(255,255,255,0.9);'); copyText.set_style('color: rgba(255,255,255,0.9); font-size: 9.5pt; margin-left: 6px;'); return Clutter.EVENT_PROPAGATE; });
                    copyBtn.connect('leave-event', () => { copyBtn.set_style('padding: 4px 6px; border-radius: 4px; background-color: transparent;'); copyIcon.set_style('color: rgba(255,255,255,0.6);'); copyText.set_style('color: rgba(255,255,255,0.6); font-size: 9.5pt; margin-left: 6px;'); return Clutter.EVENT_PROPAGATE; });
                    copyBtn.connect('clicked', () => {
                        St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, block.content);
                        copyIcon.set_icon_name('object-select-symbolic'); copyIcon.set_style('color: #9ece6a;'); copyText.set_text('Copied!'); copyText.set_style('color: #9ece6a; font-size: 9.5pt; margin-left: 6px;');
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
                            if (copyIcon && copyIcon.get_stage()) { copyIcon.set_icon_name('edit-copy-symbolic'); copyIcon.set_style('color: rgba(255,255,255,0.6);'); copyText.set_text('Copy Code'); copyText.set_style('color: rgba(255,255,255,0.6); font-size: 9.5pt; margin-left: 6px;'); }
                            return GLib.SOURCE_REMOVE;
                        });
                    });

                    codeHeader.add_child(langLabel); codeHeader.add_child(spacer); codeHeader.add_child(copyBtn);
                    let codeBody = new St.Entry({ can_focus: true, reactive: true, x_expand: true, style: 'background: transparent; border: none; box-shadow: none; font-family: monospace; font-size: 11pt; color: #9ece6a; padding: 12px;' });
                    try {
                        codeBody.clutter_text.single_line_mode = false; codeBody.clutter_text.line_wrap = true;
                        codeBody.clutter_text.line_wrap_mode = 2; codeBody.clutter_text.editable = false;
                        codeBody.clutter_text.selectable = true; codeBody.clutter_text.use_markup = true;
                    } catch (e) { }
                    codeBody.clutter_text.set_markup(escapeMarkup(block.content));
                    _attachEntryScroll(codeBody, true);
                    codeContainer.add_child(codeHeader); codeContainer.add_child(codeBody); blocksContainer.add_child(codeContainer);
                }
            });
            bubble.add_child(blocksContainer);

            if (msg.links && msg.links.length > 0) {
                let linkBox = new St.BoxLayout({ vertical: true, style: 'margin-top: 4px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);' });
                msg.links.forEach(url => {
                    let btn = new St.Button({ reactive: true, style_class: 'rudra-menu-item', style: 'padding: 8px 12px; border-radius: 6px; background-color: rgba(255,255,255,0.05); margin-bottom: 6px;' });
                    let row = new St.BoxLayout({ vertical: false });
                    row.add_child(new St.Icon({ icon_name: 'web-browser-symbolic', icon_size: 14, style: 'color: #7dcfff; margin-right: 8px;', y_align: Clutter.ActorAlign.CENTER }));
                    row.add_child(new St.Label({ text: url, style: 'color: #7dcfff; font-size: 11pt;', y_align: Clutter.ActorAlign.CENTER }));
                    btn.set_child(row);
                    btn.connect('clicked', () => { Gio.AppInfo.launch_default_for_uri(url, null); if (ctx._launcher) ctx._launcher.close(); });
                    linkBox.add_child(btn);
                });
                bubble.add_child(linkBox);
            }
            chatBox.add_child(bubble);
        });
    } else if (ctx._aiChatHistory && ctx._aiChatHistory.length === 0) {
        let welcomeBox = new St.BoxLayout({ vertical: true, x_align: Clutter.ActorAlign.CENTER, style: 'margin-top: 20px;' });
        welcomeBox.add_child(new St.Icon({ icon_name: 'system-run-symbolic', icon_size: 48, style: 'color: rgba(255,255,255,0.2); margin-bottom: 12px;', x_align: Clutter.ActorAlign.CENTER }));
        welcomeBox.add_child(new St.Label({ text: 'What can I help you with?', style: 'font-size: 14pt; color: rgba(255,255,255,0.4);', x_align: Clutter.ActorAlign.CENTER }));
        chatBox.add_child(welcomeBox);
    }

    if (ctx._aiIsThinking) chatBox.add_child(new St.Label({ text: 'Thinking... 🧠', style: 'font-size: 12pt; color: rgba(255,255,255,0.5);' }));
    chatScroll.set_child(chatBox); ctx._snippetFormBox.add_child(chatScroll);

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
        chatScroll.notify('allocation');
        try {
            let adj = chatScroll.get_vadjustment ? chatScroll.get_vadjustment() : chatScroll.vadjustment;
            if (adj) {
                if (lastUserBubble && lastUserBubble.get_stage()) {
                    let [, elY] = lastUserBubble.get_transformed_position(); let [, scY] = chatScroll.get_transformed_position();
                    let relativeY = (elY - scY) + adj.get_value(); adj.set_value(Math.max(0, relativeY - 10));
                } else adj.set_value(adj.upper + 500);
            }
        } catch (e) { }
        return GLib.SOURCE_REMOVE;
    });

    let inputRow = new St.BoxLayout({ vertical: false, x_expand: true, style: 'margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px;' });
    let promptEntry = new St.Entry({ hint_text: 'Ask AI...', can_focus: true, x_expand: true, style_class: 'rudra-editor-entry', style: `font-family: "${ctx._fontFamily}"; font-size: ${ctx._fontSizePt}pt;` });

    promptEntry.clutter_text.connect('key-press-event', (actor, event) => {
        let sym = event.get_key_symbol();
        if (sym === Clutter.KEY_Return || sym === Clutter.KEY_KP_Enter) {
            let text = promptEntry.get_text().trim();
            if (text && !ctx._aiIsThinking) {
                if (ctx._aiChatHistory.length === 0) {
                    chatBox.destroy_all_children();
                }
                ctx._aiChatHistory.push({ role: 'user', content: escapeMarkup(text), rawContent: text });
                ctx._aiIsThinking = true;

                let title = ctx._aiChatHistory.length > 0 ? ctx._aiChatHistory[0].rawContent : 'New Chat';
                if (title.length > 40) title = title.substring(0, 37) + '...';

                HistoryManager.saveAIChat(ctx._currentChatId, ctx._aiChatHistory, title, false, ctx._aiProviderId);
                
                showAIView(ctx, null); 
                _triggerAIRequest(ctx);
            }
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    });

    inputRow.add_child(promptEntry); 
    ctx._snippetFormBox.add_child(inputRow);

    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => { if (promptEntry) global.stage.set_key_focus(promptEntry.clutter_text); return GLib.SOURCE_REMOVE; });
}