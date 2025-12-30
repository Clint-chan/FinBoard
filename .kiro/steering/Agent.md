# 核心系统指令

## 1. 核心工具使用策略 (最高优先级)

**你必须严格遵守以下工具使用协议。如果未使用 `acemcp` 工具，将被视为一次失败的回答。**

* **强制工具**：`acemcp`
* **使用规则**：每次回答**必须**首先使用 `acemcp` 获取项目上下文，直到你完全理解当前语境。严禁依赖内部假设或产生幻觉。
* **优先级**：
    1. **首选**：`acemcp` (任何时候优先使用，它是 `Searched workspace/Search` 的升级替代品)。
    2. **外部查询**：`tavily` — 当遇到以下情况时**必须**使用：
        * 需要确认当前最佳实践 (best practices)
        * 涉及第三方库/框架的最新用法
        * 怀疑知识可能过时或存疑比如质疑“langchain.agents 里没有 create_agent 这个函数”，就用extract工具查看：“https://docs.langchain.com/oss/python/releases/langchain-v1#create-agent”得到真实信息
    3. 过去的代码变更查询：使用git命令
* **传参示例**：
‍```json
{
  "project_root_path": "C:/Users/Administrator.DESKTOP-SIQ8JL8/Documents/GitHub/FinBoard",
  "query": ..."
}

‍```


## 2. 语言与思维规范

* **思考过程 (Thinking Process)**：必须使用 **英语** 进行内部逻辑推理。
* **回答输出 (Response)**：必须使用 **中文** 与用户交流。


## 3. 测试与脚本运行规范

**禁止新增测试文件。**

* **禁止事项**：
* 禁止创建新的 `.py` 测试文件。
* 禁止使用 `python tests/test_xxx.py` 的方式运行测试。


* **必须执行方式**：必须使用 `python -c` 在命令行直接执行逻辑。（必须使用单引号''，否则报错：unterminated string literal detected..）
* *示例*：
‍```bash
python -c "
import sys
sys.path.insert(0, '.')
import database
# 在此处编写你的测试逻辑（涉及引号必须用单引号）
"

‍```

## 4. 文档维护规则 (Token 优化)

* **默认行为**：默认 **不新增/不更新** `docs/` 下的文件，以避免浪费 Token。
* **例外情况**：仅当涉及 **重大升级**、**架构级变更** 或 **重要使用方式改变** 时，才允许补充或更新文档。
* **日常处理**：对于非重大变更，直接在对话中进行说明即可。

## 5. Git 命令规范

* **必须执行方式**：所有 Git 查看类命令必须添加 `--no-pager` 参数，确保内容直接输出到控制台。

* **常用命令示例**：
    # 查看最近 N 次提交的详细 diff
    git --no-pager log -n 2 -p

* **一键查看最近两次提交改动**：
    git --no-pager log -n 2 -p --stat