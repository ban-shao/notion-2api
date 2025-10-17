/**
 * Notion-2API for Deno Deploy
 * 将 Notion AI 转换为 OpenAI 兼容 API
 * 
 * 部署说明：
 * 1. 将此文件上传到 Deno Deploy
 * 2. 使用 Authorization: Bearer 1 进行身份验证
 * 3. 调用 https://your-project.deno.dev/v1/chat/completions
 * 
 * @author Beth Lees
 * @version 1.0.0
 */

// ============ 配置部分 ============
const CONFIG = {
  // 硬编码的配置信息
  API_MASTER_KEY: '1',
  NOTION_COOKIE: 'v03%3AeyJhbGciOiJkaXIiLCJraWQiOiJwcm9kdWN0aW9uOnRva2VuLXYzOjIwMjQtMTEtMDciLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIn0..ere39jRTxUslXgnGQ50ZYw.r5Zd4LWymxmbxCE3jQk911heQDHEsVIf1sbIqWpk-ixMd1EtqV4Egpezu-_zC13esTkAOgWDBbFptk3s-9CGmESEQMaKlOTZWJMovDGsYDBLEcFGTdEf8Jb8bmTaPozNPjKaq1I5iv_eS5WFsYgbZvgR9Z9YnhNZOwjsAnB5U_bNWXzySd4RGWg3essa3aclPftxSQIYyQMAH1cczlFGF2eKwb6h9XzRAQIXRpdJmH6R9p5U9MNXaWha43Miq6aweEsJ3IqYA2GOAfriv4DqiCOKLSoXgNwszVArmsunPRVogBx0Y2KFbBma9pydfgS9QVc-ERl_CoAu-pFLV5v2a_QirPMcMs-TNu48gkatFo0.NC9vVqn2b_QWZoSQKy7MQiyPoDCKNU_3v5B8kQFhywQ',
  NOTION_SPACE_ID: 'a983ab0e-899e-81fd-a95c-0003afa21bbf',
  NOTION_USER_ID: '257d872b-594c-81a6-b1a4-00024d10055c',
  NOTION_USER_NAME: 'Beth Lees',
  NOTION_USER_EMAIL: 'bethlees968@gmail.com',
  NOTION_CLIENT_VERSION: '23.13.202.2011.2037'
  
  // API 端点
  NOTION_API: {
    runInference: "https://www.notion.so/api/v3/runInferenceTranscript",
    saveTransactions: "https://www.notion.so/api/v3/saveTransactionsFanout"
  },
  
  // 模型映射
  MODEL_MAP: {
    "claude-sonnet-4.5": "anthropic-sonnet-alt",
    "gpt-5": "openai-turbo",
    "claude-opus-4.1": "anthropic-opus-4.1",
    "gemini-2.5-flash": "vertex-gemini-2.5-flash",
    "gemini-2.5-pro": "vertex-gemini-2.5-pro",
    "gpt-4.1": "openai-gpt-4.1"
  }
};

// ============ 工具函数 ============
function generateUUID(): string {
  return crypto.randomUUID();
}

function cleanContent(content: string): string {
  if (!content) return "";
  
  // 清理各种思考标记
  content = content.replace(/<lang primary="[^"]*"\s*\/>\n*/g, '');
  content = content.replace(/<thinking>[\s\S]*?<\/thinking>\s*/gi, '');
  content = content.replace(/<thought>[\s\S]*?<\/thought>\s*/gi, '');
  
  return content.trim();
}

function createSSEData(data: any): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function createChatCompletionChunk(
  requestId: string,
  model: string,
  content?: string,
  role?: string,
  finishReason?: string
): any {
  const chunk: any = {
    id: requestId,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{
      index: 0,
      delta: {},
      finish_reason: finishReason || null
    }]
  };
  
  if (role) {
    chunk.choices[0].delta.role = role;
  }
  if (content) {
    chunk.choices[0].delta.content = content;
  }
  
  return chunk;
}

// ============ Notion API 交互 ============
async function createNotionThread(threadType: string): Promise<string> {
  const threadId = generateUUID();
  const payload = {
    requestId: generateUUID(),
    transactions: [{
      id: generateUUID(),
      spaceId: CONFIG.NOTION_SPACE_ID,
      operations: [{
        pointer: {
          table: "thread",
          id: threadId,
          spaceId: CONFIG.NOTION_SPACE_ID
        },
        path: [],
        command: "set",
        args: {
          id: threadId,
          version: 1,
          parent_id: CONFIG.NOTION_SPACE_ID,
          parent_table: "space",
          space_id: CONFIG.NOTION_SPACE_ID,
          created_time: Date.now(),
          created_by_id: CONFIG.NOTION_USER_ID,
          created_by_table: "notion_user",
          messages: [],
          data: {},
          alive: true,
          type: threadType
        }
      }]
    }]
  };
  
  const response = await fetch(CONFIG.NOTION_API.saveTransactions, {
    method: "POST",
    headers: prepareHeaders(),
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create thread: ${response.status}`);
  }
  
  return threadId;
}

function prepareHeaders(): Headers {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Accept": "application/x-ndjson",
    "Cookie": CONFIG.NOTION_COOKIE.includes("=") 
      ? CONFIG.NOTION_COOKIE 
      : `token_v2=${CONFIG.NOTION_COOKIE}`,
    "x-notion-space-id": CONFIG.NOTION_SPACE_ID,
    "x-notion-active-user-header": CONFIG.NOTION_USER_ID,
    "x-notion-client-version": CONFIG.NOTION_CLIENT_VERSION,
    "notion-audit-log-platform": "web",
    "Origin": "https://www.notion.so",
    "Referer": "https://www.notion.so/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  });
  return headers;
}

function preparePayload(
  messages: any[],
  threadId: string,
  model: string,
  threadType: string
): any {
  const contextValue: any = {
    timezone: "Asia/Shanghai",
    spaceId: CONFIG.NOTION_SPACE_ID,
    userId: CONFIG.NOTION_USER_ID,
    userEmail: CONFIG.NOTION_USER_EMAIL,
    currentDatetime: new Date().toISOString(),
  };
  
  const configValue: any = {
    type: threadType,
    model: model,
    useWebSearch: true,
  };
  
  if (model.startsWith("vertex-")) {
    contextValue.userName = ` ${CONFIG.NOTION_USER_NAME}`;
    contextValue.spaceName = `${CONFIG.NOTION_USER_NAME}的 Notion`;
    contextValue.surface = "ai_module";
    
    Object.assign(configValue, {
      enableAgentAutomations: false,
      enableAgentIntegrations: false,
      enableBackgroundAgents: false,
      searchScopes: [{ type: "everything" }],
      modelFromUser: true,
      isCustomAgent: false
    });
  } else {
    contextValue.userName = CONFIG.NOTION_USER_NAME;
    contextValue.surface = "workflows";
  }
  
  const transcript = [
    { id: generateUUID(), type: "config", value: configValue },
    { id: generateUUID(), type: "context", value: contextValue }
  ];
  
  // 添加消息
  for (const msg of messages) {
    if (msg.role === "user") {
      transcript.push({
        id: generateUUID(),
        type: "user",
        value: [[msg.content]],
        userId: CONFIG.NOTION_USER_ID,
        createdAt: new Date().toISOString()
      });
    } else if (msg.role === "assistant") {
      transcript.push({
        id: generateUUID(),
        type: "agent-inference",
        value: [{ type: "text", content: msg.content }]
      });
    }
  }
  
  return {
    traceId: generateUUID(),
    spaceId: CONFIG.NOTION_SPACE_ID,
    transcript: transcript,
    threadId: threadId,
    createThread: false,
    isPartialTranscript: true,
    asPatchResponse: true,
    generateTitle: true,
    saveAllThreadOperations: true,
    threadType: threadType
  };
}

// ============ 解析 NDJSON 响应 ============
function parseNDJSONLine(line: string): { type: string; content: string; contentType: string }[] {
  const results: { type: string; content: string; contentType: string }[] = [];
  
  try {
    const data = JSON.parse(line);
    
    // 直接的 markdown-chat 事件
    if (data.type === "markdown-chat" && data.value) {
      results.push({ type: "final", content: data.value, contentType: "text" });
    }
    
    // Patch 格式
    else if (data.type === "patch" && data.v) {
      for (const op of data.v) {
        if (!op) continue;
        
        const opType = op.o;
        const path = op.p || "";
        const value = op.v;
        
        // 增量文本内容
        if (opType === "x" && path.includes("/value") && typeof value === "string") {
          results.push({ type: "incremental", content: value, contentType: "text" });
        }
        
        // 完整内容对象
        else if (opType === "a" && path.endsWith("/value/-") && typeof value === "object") {
          if (value.type === "text" && value.content) {
            results.push({ type: "final", content: value.content, contentType: "text" });
          } else if (value.type === "thinking" && value.content) {
            results.push({ type: "final", content: value.content, contentType: "thinking" });
          }
        }
      }
    }
    
    // Record-map 格式
    else if (data.type === "record-map" && data.recordMap?.thread_message) {
      for (const msgId in data.recordMap.thread_message) {
        const msgData = data.recordMap.thread_message[msgId];
        const step = msgData?.value?.value?.step;
        
        if (step?.type === "markdown-chat" && step.value) {
          results.push({ type: "final", content: step.value, contentType: "text" });
        } else if (step?.type === "agent-inference" && Array.isArray(step.value)) {
          for (const item of step.value) {
            if (item.type === "thinking" && item.content) {
              results.push({ type: "final", content: item.content, contentType: "thinking" });
            } else if (item.type === "text" && item.content) {
              results.push({ type: "final", content: item.content, contentType: "text" });
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to parse NDJSON line:", e);
  }
  
  return results;
}

// ============ 流式处理函数 ============
async function* streamNotionResponse(messages: any[], model: string): AsyncGenerator<string> {
  const requestId = `chatcmpl-${generateUUID()}`;
  const mappedModel = CONFIG.MODEL_MAP[model] || "anthropic-sonnet-alt";
  const threadType = mappedModel.startsWith("vertex-") ? "markdown-chat" : "workflow";
  
  // 创建线程
  const threadId = await createNotionThread(threadType);
  
  // 准备请求
  const payload = preparePayload(messages, threadId, mappedModel, threadType);
  const headers = prepareHeaders();
  
  // 发送初始角色标识
  yield createSSEData(createChatCompletionChunk(requestId, model, undefined, "assistant"));
  
  // 发起请求
  const response = await fetch(CONFIG.NOTION_API.runInference, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`Notion API error: ${response.status}`);
  }
  
  // 流式读取响应
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sentContent = "";
  let accumulatedText = "";
  let inThinkingBlock = false;
  
  if (!reader) {
    throw new Error("No response body");
  }
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parsedResults = parseNDJSONLine(line);
      
      for (const result of parsedResults) {
        if (result.contentType === "thinking") {
          // 处理思考内容
          if (!inThinkingBlock) {
            const delta = "\n<think>\n";
            yield createSSEData(createChatCompletionChunk(requestId, model, delta));
            sentContent += delta;
            inThinkingBlock = true;
          }
          
          if (result.content) {
            yield createSSEData(createChatCompletionChunk(requestId, model, result.content));
            sentContent += result.content;
          }
        } else if (result.contentType === "text") {
          // 关闭思考块
          if (inThinkingBlock) {
            const delta = "\n</think>\n\n";
            yield createSSEData(createChatCompletionChunk(requestId, model, delta));
            sentContent += delta;
            inThinkingBlock = false;
          }
          
          // 处理文本内容
          if (result.type === "incremental") {
            accumulatedText += result.content;
            const cleaned = cleanContent(accumulatedText);
            
            // 计算新内容
            const textStart = sentContent.lastIndexOf("</think>");
            const alreadySent = textStart !== -1 
              ? sentContent.substring(textStart + "</think>\n\n".length)
              : sentContent.replace(/<think>[\s\S]*?<\/think>/g, "");
            
            if (cleaned.length > alreadySent.length) {
              const delta = cleaned.substring(alreadySent.length);
              if (delta) {
                yield createSSEData(createChatCompletionChunk(requestId, model, delta));
                sentContent += delta;
              }
            }
          } else if (result.type === "final") {
            const cleaned = cleanContent(result.content);
            if (cleaned && !sentContent.includes(cleaned)) {
              yield createSSEData(createChatCompletionChunk(requestId, model, cleaned));
              sentContent += cleaned;
            }
          }
        }
      }
    }
  }
  
  // 关闭思考块（如果还开着）
  if (inThinkingBlock) {
    const delta = "\n</think>\n\n";
    yield createSSEData(createChatCompletionChunk(requestId, model, delta));
  }
  
  // 发送结束标记
  yield createSSEData(createChatCompletionChunk(requestId, model, undefined, undefined, "stop"));
  yield "data: [DONE]\n\n";
}

// ============ 请求处理 ============
async function handleChatCompletion(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { messages, model = "claude-sonnet-4.5", stream = true } = body;
    
    if (!stream) {
      return new Response(JSON.stringify({
        error: "Non-streaming mode is not supported yet"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // 创建流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamNotionResponse(messages, model)) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (error) {
          console.error("Stream error:", error);
          const errorChunk = createSSEData({
            error: { message: error.message, type: "internal_error" }
          });
          controller.enqueue(encoder.encode(errorChunk));
        } finally {
          controller.close();
        }
      }
    });
    
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
    
  } catch (error) {
    console.error("Request error:", error);
    return new Response(JSON.stringify({
      error: { message: error.message, type: "invalid_request" }
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}

async function handleModels(): Promise<Response> {
  const models = Object.keys(CONFIG.MODEL_MAP).map(id => ({
    id,
    object: "model",
    created: Math.floor(Date.now() / 1000),
    owned_by: "notion-2api"
  }));
  
  return new Response(JSON.stringify({
    object: "list",
    data: models
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

// ============ 主服务器 ============
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  
  // CORS 处理
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }
  
  // API 密钥验证
  const auth = req.headers.get("Authorization");
  if (!auth || !auth.includes(CONFIG.API_MASTER_KEY)) {
    return new Response(JSON.stringify({
      error: { message: "Invalid API key", type: "authentication_error" }
    }), {
      status: 401,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  
  // 添加 CORS 头到所有响应
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  // 路由处理
  try {
    // 聊天补全接口
    if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
      const response = await handleChatCompletion(req);
      // 为流式响应添加 CORS 头
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers
      });
    }
    
    // 模型列表接口
    if (url.pathname === "/v1/models" && req.method === "GET") {
      const response = await handleModels();
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers
      });
    }
    
    // 健康检查
    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response(JSON.stringify({
        status: "ok",
        service: "notion-2api",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        user: CONFIG.NOTION_USER_NAME
      }), {
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    
    // 404
    return new Response(JSON.stringify({
      error: { message: "Not found", type: "not_found" }
    }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("Server error:", error);
    return new Response(JSON.stringify({
      error: { message: "Internal server error", type: "server_error" }
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});

console.log("🚀 Notion-2API for Deno Deploy is running!");
console.log("Configuration:");
console.log("  User: Beth Lees");
console.log("  API Key: Use 'Bearer 1' for authentication");
console.log("\nEndpoints:");
console.log("  POST /v1/chat/completions - Chat completion");
console.log("  GET  /v1/models          - List models");
console.log("  GET  /health             - Health check");
console.log("\nExample usage:");
console.log("  curl -X POST https://your-project.deno.dev/v1/chat/completions \\");
console.log("    -H 'Authorization: Bearer 1' \\");
console.log("    -H 'Content-Type: application/json' \\");
console.log("    -d '{\"model\":\"claude-sonnet-4.5\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}],\"stream\":true}'");