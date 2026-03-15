# AI Document Review

法律文档审核系统，支持按审阅立场（甲方/乙方/双方平衡）进行风险识别与修改建议输出。

## 功能
- PDF 上传与解析（MinerU）
- Word（.docx）预览
- LLM 审阅（DeepSeek）
- 风险分级（高/中/低）
- 规则管理与审阅结果流式展示

## 项目结构
- `app/api`：后端（FastAPI）
- `app/ui`：前端（Vite + React）
- `app/data`：本地运行数据（已忽略，不提交）

## 环境要求
- Python 3.10 - 3.12（推荐）
- Node.js 18+
- npm 9+

## 本地启动
### 一键安装（推荐）
- Windows：`.\install.bat`
- Linux / macOS：`chmod +x install.sh && ./install.sh`

安装脚本会自动完成：
- 创建后端虚拟环境并安装 Python 依赖
- 安装前端 npm 依赖
- 若缺失则创建 `app/api/.env`
- 当 `LLM_PROVIDER=ollama` 时，自动尝试拉取 `OLLAMA_MODEL`

### 离线安装包（含 Ollama/模型）
可选目录：`offline_bundle/`（见 [offline_bundle/README.md](./offline_bundle/README.md)）

安装脚本逻辑：
- 优先使用 `offline_bundle` 中的 Ollama 安装包/脚本
- 优先使用 `offline_bundle/models/Modelfile` 导入本地模型
- 都不可用时，回退到联网 `ollama pull`

### 1) 后端
```bash
cd app/api
# 建议先创建并激活 venv
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2) 前端
```bash
cd app/ui
npm install
npm run dev
```

说明：Word 预览依赖 `docx-preview` 已写入 `app/ui/package.json`。  
如果你是从旧版本更新代码，请在 `app/ui` 目录重新执行一次 `npm install`。

## 环境变量
请使用模板文件创建本地环境变量：
- `app/api/.env.tpl`
- `app/ui/.env.example`（若存在）

不要提交真实 `.env` 或 API Key。

OCR 引擎切换：
- `OCR_PROVIDER=mineru`：云端 MinerU（默认）
- `OCR_PROVIDER=paddle`：本地 PaddleOCR（免费，本机算力）

## 使用说明
1. 在前端选择文档
2. 选择审阅立场（甲方/乙方/双方平衡）
3. 点击“开始审阅”
4. 如需换立场，可点击“重新审阅”

## 注意事项
- 项目会调用第三方 API（MinerU / DeepSeek），可能产生费用
- `app/data/`、日志、缓存文件不建议提交到 Git
- 建议定期轮换 API Key

## License
MIT
