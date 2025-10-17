# 📊 Notion AI 响应内容类型详解

## 概览

Notion AI 的响应采用 NDJSON（换行分隔的 JSON）格式，主要包含以下几种类型的消息。

## 🔍 主要响应类型 (Top-Level Types)

### 1. **`markdown-chat`** (Gemini 模型)
直接返回完整的内容，通常是 Gemini 模型使用。

```json
{
  "type": "markdown-chat",
  "value": "这是 AI 的完整响应内容..."
}
```

**特点：**
- 一次性返回完整内容
- 主要用于 Gemini 模型
- 不支持增量流式输出

---

### 2. **`patch`** (最常见的流式类型)
增量更新格式，支持实时流式传输，Claude 和 GPT 模型主要使用此格式。

```json
{
  "type": "patch",
  "v": [
    {
      "o": "操作类型",
      "p": "路径",
      "v": "值"
    }
  ]
}
```

**Patch 操作类型 (`o` 字段)：**
- `"x"`: 扩展/追加操作（用于增量内容）
- `"a"`: 添加操作（用于添加新元素）

---

### 3. **`record-map`** (最终完整响应)
包含完整对话记录的响应，通常在流式传输结束时出现。

```json
{
  "type": "record-map",
  "recordMap": {
    "thread_message": {
      "message-id": {
        "value": {
          "value": {
            "step": {
              "type": "agent-inference",
              "value": [...]
            }
          }
        }
      }
    }
  }
}
```

---

## 📝 Patch 类型详解

### Claude/GPT 模型的 Patch 格式

#### 1. **增量文本内容** (最常见)
```json
{
  "type": "patch",
  "v": [{
    "o": "x",                    // 扩展操作
    "p": "/s/0/value/0/content", // 路径包含 /value/
    "v": "这是增量的文本片段"      // 字符串类型的内容
  }]
}
```

**识别特征：**
- 操作类型：`"o": "x"`
- 路径特征：包含 `/value/`
- 值类型：字符串

#### 2. **完整文本对象**
```json
{
  "type": "patch",
  "v": [{
    "o": "a",                     // 添加操作
    "p": "/s/0/value/-",          // 路径以 /value/- 结尾
    "v": {                        // 对象类型
      "type": "text",             // 或 "thinking"
      "content": "内容"
    }
  }]
}
```

**识别特征：**
- 操作类型：`"o": "a"`
- 路径特征：以 `/value/-` 结尾
- 值类型：对象，可能包含：
  - `type: "text"` - 实际回复内容（应该显示）
  - `type: "thinking"` - AI 思考过程（应该过滤）

---

### Gemini 模型的 Patch 格式

#### 1. **完整内容**
```json
{
  "type": "patch",
  "v": [{
    "o": "a",                    // 添加操作
    "p": "/s/-",                 // 路径以 /s/- 结尾
    "v": {                       // markdown-chat 对象
      "type": "markdown-chat",
      "value": "Gemini 的完整响应"
    }
  }]
}
```

**识别特征：**
- 操作类型：`"o": "a"`
- 路径特征：以 `/s/-` 结尾
- 值类型：对象，包含 `type: "markdown-chat"`

#### 2. **增量内容**
```json
{
  "type": "patch",
  "v": [{
    "o": "x",                    // 扩展操作
    "p": "/s/0/value",           // 路径以 /value 结尾
    "v": "Gemini 的增量文本"      // 字符串类型
  }]
}
```

**识别特征：**
- 操作类型：`"o": "x"`
- 路径特征：包含 `/s/` 且以 `/value` 结尾
- 值类型：字符串

---

## 🔄 Record-Map 中的 Step 类型

在 `record-map` 响应中，`step.type` 可能的值：

### 1. **`markdown-chat`**
```json
{
  "step": {
    "type": "markdown-chat",
    "value": "Markdown 格式的内容"
  }
}
```

### 2. **`agent-inference`**
```json
{
  "step": {
    "type": "agent-inference",
    "value": [
      {
        "type": "thinking",  // AI 的思考过程
        "content": "让我思考一下这个问题..."
      },
      {
        "type": "text",      // 实际的回复内容
        "content": "AI 生成的文本内容"
      }
    ]
  }
}
```

**重要区别：**
- `type: "thinking"` - AI 的内部思考过程，应该被过滤掉，不显示给用户
- `type: "text"` - 实际的回复内容，这才是应该显示给用户的内容

---

## 🎯 代码中的处理逻辑

### 内部分类
代码将所有这些类型归纳为两种内部类型：

1. **`incremental`** - 增量内容
   - 用于流式传输中的片段
   - 需要累积和拼接

2. **`final`** - 最终完整内容
   - 包含完整的响应
   - 可以直接使用

### 处理优先级

```python
# 1. 直接的 markdown-chat 事件 (Gemini)
if data.get("type") == "markdown-chat":
    → 'final'

# 2. Patch 格式
elif data.get("type") == "patch":
    # 2.1 Gemini 完整内容
    if value.get("type") == "markdown-chat":
        → 'final'
    # 2.2 增量内容
    elif op_type == "x" and isinstance(value, str):
        → 'incremental'
    # 2.3 Claude/GPT 完整内容
    elif value.get("type") == "text":
        → 'final'

# 3. Record-map 格式
elif data.get("type") == "record-map":
    # 根据 step.type 处理
    if step_type == "markdown-chat":
        → 'final'
    elif step_type == "agent-inference":
        → 'final'
```

---

## 🛠️ 实际例子

### Claude 模型的典型流式响应序列

```json
// 第 1 个数据包：开始响应
{"type":"patch","v":[{"o":"x","p":"/s/0/value/0/content","v":"你好"}]}

// 第 2 个数据包：继续输出
{"type":"patch","v":[{"o":"x","p":"/s/0/value/0/content","v":"，我是"}]}

// 第 3 个数据包：继续输出
{"type":"patch","v":[{"o":"x","p":"/s/0/value/0/content","v":" Claude"}]}

// 最后：完整记录
{"type":"record-map","recordMap":{"thread_message":{...}}}
```

### GPT 模型的典型响应

与 Claude 类似，但可能包含更多的元数据。

### Gemini 模型的典型响应

```json
// 直接返回完整内容
{"type":"markdown-chat","value":"这是 Gemini 的完整响应..."}

// 或通过 patch
{"type":"patch","v":[{"o":"a","p":"/s/-","v":{"type":"markdown-chat","value":"..."}}]}
```

---

## 📊 总结

| 模型类型 | 主要使用的格式 | 支持流式 | 特点 |
|---------|---------------|---------|------|
| Claude | patch (incremental) | ✅ | 细粒度的增量输出 |
| GPT | patch (incremental) | ✅ | 与 Claude 类似 |
| Gemini | markdown-chat | ❌ | 通常一次性返回完整内容 |

## 🔧 扩展说明

### Value 对象的 Type 字段详解

在 `agent-inference` 和 patch 响应中，value 对象可能包含以下 `type` 字段：

| Type | 说明 | 处理方式 | 示例 |
|------|------|---------|------|
| `text` | 实际的回复内容 | ✅ 显示给用户 | "这是 AI 的回答" |
| `thinking` | AI 的思考过程 | ❌ 过滤掉，不显示 | "让我分析一下这个问题..." |
| `thought` | 另一种思考标记 | ❌ 过滤掉，不显示 | "用户在问什么..." |

### 典型的包含思考过程的响应

```json
// 流式响应中可能先出现 thinking
{
  "type": "patch",
  "v": [{
    "o": "a",
    "p": "/s/0/value/-",
    "v": {
      "type": "thinking",
      "content": "用户询问了关于 Python 的问题，我需要..."
    }
  }]
}

// 然后才是实际的 text 内容
{
  "type": "patch",
  "v": [{
    "o": "a",
    "p": "/s/0/value/-",
    "v": {
      "type": "text",
      "content": "Python 是一种高级编程语言..."
    }
  }]
}
```

### 其他可能的类型（未在代码中处理）

根据 Notion AI 的更新，可能还会出现以下类型：
- `error` - 错误消息
- `status` - 状态更新
- `title` - 对话标题生成

### 内容清洗

代码中的 `_clean_content` 方法会清理以下内容：
- `<thinking>...</thinking>` - 思考过程
- `<thought>...</thought>` - 思考标签
- `<lang primary="..."/>` - 语言标记
- 各种 AI 自言自语的内容

---

## 🚀 优化建议

1. **添加更多类型支持**
   - 处理 `error` 类型
   - 支持 `status` 更新
   - 处理 `title` 生成

2. **改进 Gemini 支持**
   - 尝试启用 Gemini 的流式输出
   - 优化 Gemini 特定的解析逻辑

3. **错误处理**
   - 添加对未知类型的日志记录
   - 实现更健壮的降级策略