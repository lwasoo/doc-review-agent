Offline Bundle Layout

Put offline installers and model files under this folder so `install.bat` / `install.sh` can use them.

Suggested structure:

offline_bundle/
  ollama/
    windows/
      OllamaSetup.exe
    linux/
      install.sh
  models/
    Modelfile
    model.gguf   (referenced by Modelfile)

Example `offline_bundle/models/Modelfile`:

FROM ./model.gguf
PARAMETER temperature 0.2
SYSTEM You are a contract review assistant.

Notes:
- If `LLM_PROVIDER=ollama`, installer tries local offline model first.
- If local model is unavailable, installer falls back to `ollama pull OLLAMA_MODEL`.
- Keep large binary model files out of Git if repository size matters.
