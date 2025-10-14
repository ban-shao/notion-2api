// ==UserScript==
// @name         Notion-2API 配置提取器
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动提取 Notion 配置信息用于 notion-2api 项目
// @author       You
// @match        https://www.notion.so/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function createButton() {
        const button = document.createElement('div');
        button.innerHTML = '🚀';
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            background: #0066cc;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 9999;
            font-size: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        `;
        
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.1)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
        });
        
        button.addEventListener('click', extractAndShow);
        document.body.appendChild(button);
    }

    function extractConfig() {
        const config = {
            cookie: '',
            spaceId: '',
            userId: '',
            userName: '',
            userEmail: ''
        };

        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'token_v2') {
                config.cookie = decodeURIComponent(value);
                break;
            }
        }

        // 监听网络请求来获取 Space ID 和 User ID
        const originalFetch = window.fetch;
        
        // 重写 fetch 方法
        window.fetch = function(...args) {
            const result = originalFetch.apply(this, args);
            
            if (args[1] && args[1].headers) {
                const headers = args[1].headers;
                if (headers['x-notion-active-user-header']) {
                    config.userId = headers['x-notion-active-user-header'];
                }
                if (headers['x-notion-space-id']) {
                    config.spaceId = headers['x-notion-space-id'];
                }
            }
            
            return result;
        };

        try {
            // 尝试从 window 对象中获取信息
            if (window.__NEXT_DATA__ && window.__NEXT_DATA__.props) {
                const props = window.__NEXT_DATA__.props;
                if (props.pageProps && props.pageProps.user) {
                    const user = props.pageProps.user;
                    config.userName = user.name || config.userName;
                    config.userEmail = user.email || config.userEmail;
                    config.userId = user.id || config.userId;
                }
            }
            
            const notionUser = localStorage.getItem('notion-user');
            if (notionUser) {
                const userData = JSON.parse(notionUser);
                config.userName = userData.name || '';
                config.userEmail = userData.email || '';
                config.userId = userData.id || config.userId;
            }
            
            const userMenuButton = document.querySelector('[data-testid="user-menu-button"]');
            if (userMenuButton) {
                const img = userMenuButton.querySelector('img');
                if (img && img.alt) {
                    config.userName = img.alt;
                }
            }
        } catch (e) {
            console.log('获取用户信息时出错:', e);
        }

        return config;
    }

    function generateEnvConfig(config) {
        const timestamp = new Date().toLocaleString('zh-CN');
        
        return `# [自动提取] notion-2api 配置文件
# 提取时间: ${timestamp}

# --- 安全配置 ---
API_MASTER_KEY=1

# --- 端口配置 ---
NGINX_PORT=8088

# --- Notion 凭证 (以下均为必须或强烈建议设置) ---

# 1. 您的 token_v2 (自动提取)
NOTION_COOKIE="${config.cookie || '请手动获取 token_v2'}"

# 2. 您的 Space ID (需要手动获取)
NOTION_SPACE_ID="${config.spaceId || '请在网络请求中查找 x-notion-space-id'}"

# 3. 您的用户 ID (需要手动获取)
NOTION_USER_ID="${config.userId || '请在网络请求中查找 x-notion-active-user-header'}"

# 4. 您的 Notion 用户名
NOTION_USER_NAME="${config.userName || '请手动填写您的用户名'}"

# 5. 您的 Notion 登录邮箱
NOTION_USER_EMAIL="${config.userEmail || '请手动填写您的邮箱'}"

# 6. 可选：页面 Block ID (保持留空以提高兼容性)
NOTION_BLOCK_ID=""

# 7. 可选：客户端版本 (保持默认即可)
NOTION_CLIENT_VERSION="23.13.20251011.2037"

# 📝 获取说明:
# - token_v2: 已自动提取
# - Space ID: 请在开发者工具 Network 标签中查找包含 'x-notion-space-id' 的请求头
# - User ID: 请在开发者工具 Network 标签中查找包含 'x-notion-active-user-header' 的请求头
# - 用户名和邮箱: 已尝试自动获取，如未成功请手动填写

# 💡 提示: 在 Notion 中进行任意操作(如点击页面、刷新等)可以触发网络请求，便于获取 Space ID 和 User ID`;
    }

    function extractAndShow() {
        const config = extractConfig();
        const envConfig = generateEnvConfig(config);
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        content.innerHTML = `
            <h3 style="margin-top: 0; color: #333;">🚀 Notion-2API 配置提取器</h3>
            <textarea id="config-textarea" style="
                width: 100%;
                height: 400px;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                border: 1px solid #ddd;
                padding: 10px;
                border-radius: 4px;
                background: #f8f9fa;
            " readonly>${envConfig}</textarea>
            <div style="margin-top: 15px; text-align: right;">
                <button id="copy-btn" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-right: 10px;
                    font-size: 12px;
                ">📋 复制配置</button>
                <button id="close-btn" style="
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                ">关闭</button>
            </div>
            <div style="margin-top: 15px; font-size: 12px; color: #666; line-height: 1.5;">
                💡 <strong>使用说明：</strong><br>
                1. token_v2 已自动提取<br>
                2. Space ID 和 User ID 需要在开发者工具的 Network 标签中手动查找<br>
                3. 复制配置内容到您的 .env 文件中
            </div>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        content.querySelector('#copy-btn').addEventListener('click', () => {
            const textarea = content.querySelector('#config-textarea');
            navigator.clipboard.writeText(textarea.value).then(() => {
                alert('✅ 配置已复制到剪贴板！');
            }).catch(() => {
                textarea.select();
                document.execCommand('copy');
                alert('✅ 配置已复制到剪贴板！');
            });
        });
        
        content.querySelector('#close-btn').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }
        
        setTimeout(() => {
            createButton();
            console.log('🚀 Notion-2API 配置提取器已加载');
        }, 2000);
    }

    init();
})();
