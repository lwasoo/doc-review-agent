from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # General
    debug: bool = False
    serve_static: bool = True
    log_level: str = "INFO"
    log_to_file: bool = False

    # Placeholder auth (kept for compatibility with swagger config)
    aad_client_id: str = ""
    aad_tenant_id: str = ""
    aad_user_impersonation_scope_id: str = ""

    # Local storage / DB
    local_docs_dir: str = "./app/data/documents"
    sqlite_path: str = "./app/data/app.db"
    export_docs_dir: str = "./app/data/exports"

    # MinerU
    ocr_provider: str = "mineru"  # mineru | paddle
    mineru_base_url: str = "https://mineru.net"
    mineru_api_key: str = ""
    mineru_model_version: str = "vlm"
    mineru_poll_interval_sec: float = 1.0
    mineru_max_wait_sec: float = 300.0
    mineru_cache_artifacts: bool = True
    mineru_cache_dir: str = "./app/data/mineru"
    mineru_cache_cleanup_enabled: bool = True
    mineru_cache_retention_days: int = 7
    mineru_cache_max_files: int = 200
    # MinerU bbox coordinate assumptions
    # Most MinerU JSON outputs use image-like coordinates with origin at top-left.
    mineru_bbox_origin: str = "top-left"  # "top-left" or "bottom-left"
    mineru_bbox_units: str = "auto"  # "auto", "px", "pt"
    mineru_bbox_content_coverage: float = 0.92  # used to infer full-page bbox canvas size from content extents
    # PaddleOCR (local)
    paddleocr_lang: str = "ch"
    paddleocr_use_angle_cls: bool = True
    paddleocr_pdf_dpi: int = 180

    # LLM (DeepSeek via LangChain)
    llm_provider: str = "deepseek"  # deepseek | ollama
    llm_temperature: float = 0.2
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_model: str = "chatdeepseek"
    ollama_base_url: str = "http://127.0.0.1:11434/v1"
    ollama_model: str = "qwen2.5:7b-instruct-q4_K_M"
    ollama_api_key: str = "ollama"
    legal_review_party: str = "both"  # party_a, party_b, both

    # Streaming / batching
    pagination: int = 32

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


settings = Settings()


