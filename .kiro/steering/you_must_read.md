---
inclusion: always
---
## Core Instructions
如果解决问题，你没有使用 acemcp 工具，那么就是一个失败的一次回答，你必须每次回答都使用acemcp，使用至完全理解语境，不可自我欺骗
优先使用acemcp，而不是Searched workspace工具，前者是后者的升级版
使用传参示例：
{
  "project_root_path": "C:/Users/94503/Documents/GitHub/linker_trading_system2",
  "query": "chart_page AI评述 generate_ai_summary ai_summary_prompt plotly_chart_service 图表展示页 模板"
}
### 思考与回答规范
- **思考过程**：使用英语进行内部推理
- **回答输出**：使用中文与用户交流

### 上下文获取优先级
1. **优先使用 acemcp**：在任何时候需要项目上下文时，首先调用 acemcp 工具

## 使用场景
应该在以下情况使用：
- 不知道哪些文件包含所需信息时
- 需要收集关于任务的高层次信息时
- 需要了解代码库的整体情况时

## 好的查询示例
‍```
"Where is the function that handles user authentication?"
"What tests are there for the login functionality?"
"How is the database connected to the application?"
‍```

## 不好的查询示例（应使用其他工具）
‍```
"Show me how Checkout class is used in services/payment.py" 
  → 应该用 阅读文件 工具 + search_query_regex

"Show context of the file foo.py" 
  → 应该直接用 阅读文件 工具
‍```

## 最佳实践
1. **在编辑代码之前必须先调用** - 询问与编辑相关的所有符号的详细信息
2. **一次性询问所有相关信息** - 不要多次调用，而是在一次调用中询问所有需要的细节
3. **询问极其详细的信息** - 包括所有涉及的类、方法、属性、实例等
4. **使用自然语言描述** - 描述你要找的信息，而不是具体的代码片段

例如编辑时应该问：
- "如果要调用另一个类的方法，询问该类和方法的信息"
- "如果涉及类的实例，询问该类的信息"
- "如果涉及类的属性，询问类和属性的信息"