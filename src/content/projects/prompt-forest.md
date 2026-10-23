---
{
  "id": "prompt-forest",
  "order": 4,
  "featured": false,
  "title": "Prompt Forest",
  "status": "本地可运行 MVP · 演示版",
  "number": "04",
  "tagline": "让好提示词，长成一片林。",
  "summary": "为了把散落在对话和网页里的好用提示词找回来，我做了一个本地优先的收藏工具：保存、分类、搜索，再一键复制复用。",
  "cover": {
    "src": "assets/prompt-forest-library-desktop.png",
    "alt": "Prompt Forest 本地演示版的桌面收藏列表，内容为内置演示提示词",
    "caption": "本地演示版 · 内置示例内容"
  },
  "links": [
    {
      "label": "查看项目详情 ↓",
      "href": "#prompt-forest-detail"
    }
  ],
  "note": "Chrome 划词收藏已走通；目前没有公开体验地址。",
  "detail": {
    "summary": "Prompt Forest · 本地 MVP 与验证范围",
    "lead": "好用的 Prompt 常散落在不同对话和网页里。我提出保存、分类、快速找回并复制复用的需求，和 AI 一起把它做成了可在本地运行的网页与 Chrome 插件演示版。",
    "note": "",
    "limitation": "",
    "validation": "本轮验收：自动测试 9/9、Lint 与生产构建通过。下面的截图来自隔离的本地环境，不是公开网站；其中搜索结果与手机分类视图使用临时验收数据。",
    "links": [],
    "images": [
      {
        "src": "assets/prompt-forest-search-desktop.png",
        "alt": "Prompt Forest 桌面搜索结果，展示临时验收 Prompt 与复制成功提示",
        "caption": "搜索与复制 · 桌面 · 临时验收数据"
      },
      {
        "src": "assets/prompt-forest-category-mobile.png",
        "alt": "Prompt Forest 手机分类筛选视图，展示一条临时验收 Prompt",
        "caption": "分类筛选 · 手机 · 临时验收数据"
      }
    ],
    "galleryLabel": "Prompt Forest 本地运行截图",
    "sections": [
      {
        "title": "网页端已验证",
        "body": "可以新增 Prompt、选择或新建分类、按分类筛选、搜索和复制。记录与分类保存在当前浏览器，刷新后仍在；桌面与手机尺寸下的核心浏览操作可用。"
      },
      {
        "title": "划词收藏",
        "body": "在 Chrome 普通网页划词或使用右键菜单，可进入确认页保存，再到本机插件弹窗搜索、复制。这个闭环此前由我在 Chrome 实机确认；本轮验收核对了源码与自动测试，未重新加载插件实测。"
      },
      {
        "title": "演示边界",
        "body": "初始 8 条 Prompt 是内置演示数据；“最近整理”是简化标记，不是完整使用历史。网页和插件各自保存在本机浏览器中，没有账号或跨设备同步。"
      },
      {
        "title": "尚未完成",
        "body": "新版暂不支持编辑、删除 Prompt 或改名、删除分类；Edge、长期大量数据和不同网站的插入兼容性仍待验证。当前没有公开部署和可供访客使用的安装包。"
      }
    ]
  }
}
---
