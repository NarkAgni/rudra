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

import Soup from 'gi://Soup';
import GLib from 'gi://GLib';


const session = new Soup.Session();
session.timeout = 30; 

export function fetchAIResponse(provider, apiKey, messages, callback, isQuickAnswer = false) {
    // 0 = Gemini, 1 = Groq, 2 = Ollama, 3 = Perplexity, 4 = Cohere
    
    // 1. GOOGLE GEMINI
    if (provider === 0) {
        if (!apiKey) { callback("Error: Google Gemini API Key is missing. Please add it in settings."); return; }
        
        let url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        let message = Soup.Message.new('POST', url);
        
        let contents = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.rawContent }]
        }));

        let body = { contents: contents };
        let bytes = new GLib.Bytes(JSON.stringify(body));
        message.set_request_body_from_bytes('application/json', bytes);
        
        session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (sess, res) => {
            try {
                let responseBytes = sess.send_and_read_finish(res);
                let decoder = new TextDecoder('utf-8');
                let data = JSON.parse(decoder.decode(responseBytes.toArray()));
                
                if (data.error) callback(`API Error: ${data.error.message}`);
                else if (data.candidates && data.candidates[0]) callback(data.candidates[0].content.parts[0].text);
                else callback("Error: Something went wrong with the AI response.");
            } catch (e) { callback(`Failed to fetch response: ${e.message}`); }
        });
    } 

    // 2. GROQ
    else if (provider === 1) {
        if (!apiKey) { callback("Error: Groq API Key is missing. Get it for free at console.groq.com"); return; }
        
        let url = `https://api.groq.com/openai/v1/chat/completions`;
        let message = Soup.Message.new('POST', url);
        message.get_request_headers().append('Authorization', `Bearer ${apiKey}`);
        
        let groqMessages = messages.map(m => ({ role: m.role, content: m.rawContent }));
        let body = { model: 'llama-3.1-8b-instant', messages: groqMessages };
        let bytes = new GLib.Bytes(JSON.stringify(body));
        message.set_request_body_from_bytes('application/json', bytes);
        
        session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (sess, res) => {
            try {
                let responseBytes = sess.send_and_read_finish(res);
                let decoder = new TextDecoder('utf-8');
                let data = JSON.parse(decoder.decode(responseBytes.toArray()));
                
                if (data.error) callback(`Groq API Error: ${data.error.message}`);
                else if (data.choices && data.choices[0]) callback(data.choices[0].message.content);
                else callback("Error: Something went wrong with the AI response.");
            } catch (e) { callback(`Failed to fetch response: ${e.message}`); }
        });
    } 

    // 3. OLLAMA
    else if (provider === 2) {
        let url = `http://127.0.0.1:11434/api/chat`;
        let message = Soup.Message.new('POST', url);
        
        let ollamaMessages = messages.map(m => ({ role: m.role, content: m.rawContent }));
        
        let body = { 
            model: 'phi3',
            messages: ollamaMessages,
            stream: false
        };
        
        let bytes = new GLib.Bytes(JSON.stringify(body));
        message.set_request_body_from_bytes('application/json', bytes);
        
        session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (sess, res) => {
            try {
                let responseBytes = sess.send_and_read_finish(res);
                let decoder = new TextDecoder('utf-8');
                let data = JSON.parse(decoder.decode(responseBytes.toArray()));
                
                if (data.error) callback(`Ollama Error: ${data.error}`);
                else if (data.message && data.message.content) callback(data.message.content);
                else callback("Error: Unexpected response from Ollama.");
            } catch (e) {
                callback("**Connection Failed!**\nIs Ollama running? Open terminal and run `ollama serve`");
            }
        });
    }

    // 4. PERPLEXITY AI
    else if (provider === 3) {
        if (!apiKey) { callback("Error: Perplexity API Key is missing. Add it in settings."); return; }
        
        let url = `https://api.perplexity.ai/chat/completions`;
        let message = Soup.Message.new('POST', url);
        message.get_request_headers().append('Authorization', `Bearer ${apiKey}`);
        message.get_request_headers().append('accept', 'application/json');
        message.get_request_headers().append('content-type', 'application/json');
        
        let perpMessages = messages.map(m => ({ role: m.role, content: m.rawContent }));
        let body = { model: 'sonar', messages: perpMessages };

        if (isQuickAnswer) body.max_tokens = 75;

        let bytes = new GLib.Bytes(JSON.stringify(body));
        message.set_request_body_from_bytes('application/json', bytes);
        
        session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (sess, res) => {
            try {
                let responseBytes = sess.send_and_read_finish(res);
                let decoder = new TextDecoder('utf-8');
                let data = JSON.parse(decoder.decode(responseBytes.toArray()));
                
                if (data.error) callback(`Perplexity API Error: ${data.error.message || data.error}`);
                else if (data.choices && data.choices[0]) {
                    let content = data.choices[0].message.content;
                    content = content.replace(/\[\s*\d+(?:\s*,\s*\d+)*\s*\]/g, '');
                    callback(content);
                }
                else callback("Error: Something went wrong with the AI response.");
            } catch (e) { callback(`Failed to fetch response: ${e.message}`); }
        });
    }

    // 5. COHERE AI
    else if (provider === 4) {
        if (!apiKey) { callback("Error: Cohere API Key is missing. Add it in settings."); return; }
        
        let url = `https://api.cohere.com/v1/chat`;
        let message = Soup.Message.new('POST', url);
        message.get_request_headers().append('Authorization', `Bearer ${apiKey}`);
        message.get_request_headers().append('accept', 'application/json');
        message.get_request_headers().append('content-type', 'application/json');
        
        let cohereMessages = messages.slice(0, -1).map(m => ({ 
            role: m.role === 'assistant' ? 'CHATBOT' : 'USER', 
            message: m.rawContent 
        }));
        let currentMessage = messages[messages.length - 1].rawContent;

        let body = { 
            model: 'command-a-03-2025', 
            message: currentMessage, 
            chat_history: cohereMessages
        };

        if (isQuickAnswer) body.preamble = "Provide a direct, concise answer (max 5 lines) without any markdown or formatting. Do not include citation numbers.";

        let bytes = new GLib.Bytes(JSON.stringify(body));
        message.set_request_body_from_bytes('application/json', bytes);
        
        session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (sess, res) => {
            try {
                let responseBytes = sess.send_and_read_finish(res);
                let decoder = new TextDecoder('utf-8');
                let data = JSON.parse(decoder.decode(responseBytes.toArray()));
                
                if (data.message && !data.text) callback(`Cohere API Error: ${data.message}`);
                else if (data.text) {
                    let content = data.text;
                    content = content.replace(/\[\s*\d+(?:\s*,\s*\d+)*\s*\]/g, ''); 
                    callback(content);
                }
                else callback("Error: Something went wrong with the AI response.");
            } catch (e) { callback(`Failed to fetch response: ${e.message}`); }
        });
    }
}