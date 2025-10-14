// ==UserScript==
// @name         Notion-2API 配置提取器 (Beth Lees 定制版)
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  自动提取 Notion 配置信息，增强版可以监听网络请求，改进 token_v2 获取
// @author       Beth Lees
// @contact      bethlees968@gmail.com
// @match        https://www.notion.so/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    let globalConfig = {
       cookie: '',
       spaceId: '',
       userId: '',
        userName: 'Beth Lees',
        userEmail: 'bethlees968@gmail.com',
       interceptedToken: ''
   };
    
    function interceptNetworkRequests() {
        const originalFetch = window.fetch;
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        
        window.fetch = function(...args) {
            const result = originalFetch.apply(this, args);
            
            // 获取请求头信息
            if (args[1] && args[1].headers) {
                const headers = args[1].headers;
                if (headers['x-notion-active-user-header']) {
                    globalConfig.userId = headers['x-notion-active-user-header'];
                    console.log('🔍 从 fetch 请求中获取到 User ID:', globalConfig.userId);
                }
                if (headers['x-notion-space-id']) {
                    globalConfig.spaceId = headers['x-notion-space-id'];
                    console.log('🔍 从 fetch 请求中获取到 Space ID:', globalConfig.spaceId);
                }
                // 尝试从 Cookie 请求头获取 token_v2
                if (headers['Cookie'] || headers['cookie']) {
                    const cookieHeader = headers['Cookie'] || headers['cookie'];
                    const tokenMatch = cookieHeader.match(/token_v2=([^;]+)/);
                    if (tokenMatch && tokenMatch[1]) {
                        globalConfig.interceptedToken = decodeURIComponent(tokenMatch[1]);
                        console.log('🔍 从 fetch Cookie 请求头中获取到 token_v2');
                    }
                }
            }
            
            return result;
        };
        
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            this._method = method;
            this._url = url;
            return originalXHROpen.call(this, method, url, ...args);
        };
        
        XMLHttpRequest.prototype.send = function(data) {
            const xhr = this;
            
            const originalSetRequestHeader = xhr.setRequestHeader;
            xhr.setRequestHeader = function(name, value) {
                if (name === 'x-notion-active-user-header') {
                    globalConfig.userId = value;
                    console.log('🔍 从 XHR 请求头中获取到 User ID:', value);
                }
                if (name === 'x-notion-space-id') {
                    globalConfig.spaceId = value;
                    console.log('🔍 从 XHR 请求头中获取到 Space ID:', value);
                }
                // 尝试从 Cookie 请求头获取 token_v2
                if (name.toLowerCase() === 'cookie') {
                    const tokenMatch = value.match(/token_v2=([^;]+)/);
                    if (tokenMatch && tokenMatch[1]) {
                        globalConfig.interceptedToken = decodeURIComponent(tokenMatch[1]);
                        console.log('🔍 从 XHR Cookie 请求头中获取到 token_v2');
                    }
                }
                return originalSetRequestHeader.call(this, name, value);
            };
            
            return originalXHRSend.call(this, data);
        };
        
        console.log('🔍 网络请求监听器已启动');
    }

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
        const config = { ...globalConfig };

        // 方法1: 从 document.cookie 获取
        console.log('🔍 开始获取 token_v2...');
        console.log('🔍 当前 document.cookie:', document.cookie);
        
        const cookies = document.cookie.split(';');
        const availableCookies = cookies.map(c => c.trim().split('=')[0]).filter(Boolean);
        console.log('🔍 可用的 Cookie 名称:', availableCookies);
        
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'token_v2') {
                config.cookie = decodeURIComponent(value);
                console.log('🔍 从 document.cookie 获取到 token_v2');
                break;
            }
        }
        
        // 方法2: 从 localStorage 获取
        if (!config.cookie) {
            try {
                console.log('🔍 尝试从 Storage 获取 token_v2...');
                const tokenFromStorage = localStorage.getItem('token_v2') || 
                                       localStorage.getItem('notion-token') ||
                                       sessionStorage.getItem('token_v2') ||
                                       sessionStorage.getItem('notion-token');
                if (tokenFromStorage) {
                    config.cookie = tokenFromStorage;
                    console.log('🔍 从 Storage 获取到 token_v2');
                } else {
                    console.log('🔍 Storage 中未找到 token_v2');
                }
            } catch (e) {
                console.log('从 Storage 获取 token 时出错:', e);
            }
        }
        
        // 方法3: 从网络请求中获取 (通过拦截的请求头)
        if (!config.cookie && globalConfig.interceptedToken) {
            config.cookie = globalConfig.interceptedToken;
            console.log('🔍 从网络请求中获取到 token_v2');
        }
        
        // 方法4: 尝试从页面脚本中获取
        if (!config.cookie) {
            try {
                console.log('🔍 尝试从页面数据获取 token_v2...');
                // 检查是否有全局变量包含 token
                if (window.__NEXT_DATA__ && window.__NEXT_DATA__.props) {
                    const props = window.__NEXT_DATA__.props;
                    if (props.pageProps && props.pageProps.token) {
                        config.cookie = props.pageProps.token;
                        console.log('🔍 从 __NEXT_DATA__ 获取到 token_v2');
                    }
                }
                
                // 尝试其他可能的全局变量
                if (!config.cookie) {
                    const possibleTokens = [
                        window.notion?.token,
                        window.NOTION_TOKEN,
                        window.token_v2
                    ].filter(Boolean);
                    
                    if (possibleTokens.length > 0) {
                        config.cookie = possibleTokens[0];
                        console.log('🔍 从全局变量获取到 token_v2');
                    }
                }
            } catch (e) {
                console.log('从页面数据获取 token 时出错:', e);
            }
        }
        
        // 调试信息
       if (!config.cookie) {
           console.warn('⚠️ 未能获取到 token_v2，可能的原因:');
            console.warn('1. token_v2 Cookie 被设置为 HttpOnly，无法通过 JavaScript 访问（常见情况）');
           console.warn('2. 用户未登录或 Cookie 已过期');
           console.warn('3. Notion 更新了安全策略');
            console.warn('解决方案: 手动从开发者工具 Application 或 Network 标签页中复制 token_v2');
       } else {
           console.log('✅ 成功获取到 token_v2，长度:', config.cookie.length);
       }

        try {
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
                config.userName = userData.name || config.userName;
                config.userEmail = userData.email || config.userEmail;
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
        
        // 添加调试信息
        const debugInfo = `
# 🔍 调试信息:
# - 当前域名: ${window.location.hostname}
# - 当前URL: ${window.location.href}
# - document.cookie 长度: ${document.cookie.length}
# - 可用Cookie数量: ${document.cookie.split(';').filter(c => c.trim()).length}
# - localStorage项目数: ${Object.keys(localStorage).length}
# - sessionStorage项目数: ${Object.keys(sessionStorage).length}
`;
        
        return `# [自动提取] notion-2api 配置文件 (Beth Lees 定制版)
# 提取时间: ${timestamp}
${debugInfo}
# --- 安全配置 ---
API_MASTER_KEY=1

# --- 端口配置 ---
NGINX_PORT=8088

# --- Notion 凭证 (以下均为必须或强烈建议设置) ---

# 1. 您的 token_v2 (自动提取)
NOTION_COOKIE="${config.cookie || '请手动获取 token_v2'}"

# 2. 您的 Space ID ${config.spaceId ? '(已自动获取)' : '(需要手动获取)'}
NOTION_SPACE_ID="${config.spaceId || '请在网络请求中查找 x-notion-space-id'}"

# 3. 您的用户 ID ${config.userId ? '(已自动获取)' : '(需要手动获取)'}
NOTION_USER_ID="${config.userId || '请在网络请求中查找 x-notion-active-user-header'}"

# 4. 您的 Notion 用户名
NOTION_USER_NAME="${config.userName || '请手动填写您的用户名'}"

# 5. 您的 Notion 登录邮箱
NOTION_USER_EMAIL="${config.userEmail || '请手动填写您的邮箱'}"

# 6. 可选：页面 Block ID (保持留空以提高兼容性)
NOTION_BLOCK_ID=""

# 7. 可选：客户端版本 (保持默认即可)
NOTION_CLIENT_VERSION="23.13.202.2011.2037"

# 📝 获取说明:
# - token_v2: ${config.cookie ? '已自动获取' : '❌ 未能自动获取，请手动复制'}
# - Space ID: ${config.spaceId ? '已自动获取' : '请在开发者工具 Network 标签中查找包含 x-notion-space-id 的请求头'}
# - User ID: ${config.userId ? '已自动获取' : '请在开发者工具 Network 标签中查找包含 x-notion-active-user-header 的请求头'}
# - 用户名和邮箱: ${config.userName || config.userEmail ? '已尝试自动获取' : '请手动填写'}

${!config.cookie ? `# ⚠️  token_v2 获取失败的可能原因:
# 1. Cookie 被设置为 HttpOnly，JavaScript 无法访问
# 2. 用户未登录或 Cookie 已过期
# 3. Notion 更新了安全策略
# 
# 🔧 手动获取 token_v2 的方法:
# 1. 打开浏览器开发者工具 (F12)
# 2. 切换到 Application/存储 标签
# 3. 在左侧找到 Cookies -> https://www.notion.so
# 4. 找到 token_v2 并复制其值
# 5. 或者在 Network 标签中查看任意请求的 Cookie 请求头

` : ''}
# 💡 提示: 
# 1. 在 Notion 中进行任意操作(如点击页面、刷新等)可以触发网络请求
# 2. 增强版插件会自动监听网络请求并获取 Space ID 和 User ID
# 3. 请查看浏览器控制台的日志信息`;
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
            width: 650px;
            max-height: 85vh;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        const statusHtml = `
            <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 12px;">
                <strong>📊 获取状态：</strong><br>
                • token_v2: ${config.cookie ? '✅ 已获取' : '❌ 未获取'}<br>
                • Space ID: ${config.spaceId ? '✅ 已获取' : '❌ 未获取'}<br>
                • User ID: ${config.userId ? '✅ 已获取' : '❌ 未获取'}<br>
                • 用户名: ${config.userName ? '✅ 已获取' : '❌ 未获取'}<br>
                • 邮箱: ${config.userEmail ? '✅ 已获取' : '❌ 未获取'}
            </div>
        `;
        
        content.innerHTML = `
            <h3 style="margin-top: 0; color: #333;">🚀 Notion-2API 配置提取器 (Beth Lees 定制版)</h3>
            ${statusHtml}
            <textarea id="config-textarea" style="
                width: 100%;
                height: 350px;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                border: 1px solid #ddd;
                padding: 10px;
                border-radius: 4px;
                background: #f8f9fa;
            " readonly>${envConfig}</textarea>
            <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: space-between;">
                <div>
                    <button id="refresh-btn" style="
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">🔄 刷新配置</button>
                    <button id="debug-btn" style="
                        background: #ffc107;
                        color: black;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        margin-left: 5px;
                    ">🔍 调试信息</button>
                </div>
                <div>
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
            </div>
            <div style="margin-top: 15px; font-size: 12px; color: #666; line-height: 1.5;">
                💡 <strong>使用说明：</strong><br>
                1. 增强版会自动监听网络请求获取 Space ID 和 User ID<br>
                2. 如果未获取到 token_v2，请点击"调试信息"查看详细原因<br>
                3. 点击"刷新配置"可以重新获取最新信息<br>
                4. 复制配置内容到您的 .env 文件中
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
        
        content.querySelector('#refresh-btn').addEventListener('click', () => {
            modal.remove();
            setTimeout(() => extractAndShow(), 100);
        });
        
        content.querySelector('#debug-btn').addEventListener('click', () => {
            console.log('🔍 === 调试信息 ===');
            console.log('当前配置:', config);
            console.log('全局配置:', globalConfig);
            console.log('document.cookie:', document.cookie);
            console.log('localStorage keys:', Object.keys(localStorage));
            console.log('sessionStorage keys:', Object.keys(sessionStorage));
            alert('调试信息已输出到控制台，请按 F12 查看');
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
        
        interceptNetworkRequests();
        
        setTimeout(() => {
            createButton();
            console.log('🚀 Notion-2API 配置提取器(Beth Lees 定制版)已加载');
            console.log('💡 请在 Notion 中进行一些操作来触发网络请求，以便获取 Space ID 和 User ID');
            console.log('🔍 如果无法获取 token_v2，请查看控制台的调试信息');
        }, 2000);
    }

    init();
})();
