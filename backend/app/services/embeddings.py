"""Text embedding service (FR-ADE-002).

Primary: sentence-transformers all-MiniLM-L6-v2 (384-dim, matches VECTOR(384)).
Fallback (per SRS 6.3 risk mitigation): TF-IDF + cosine similarity, padded
to 384 dims so the pgvector column remains compatible.
"""
import threading
from pathlib import Path

import numpy as np

from app.config import get_settings

settings = get_settings()
EMBEDDING_DIM = 384

_lock = threading.Lock()
_service: "EmbeddingService | None" = None


class EmbeddingService:
    def __init__(self) -> None:
        self.use_tfidf = False
        self._model = None
        self._tfidf = None
        self._model_name = settings.model_name
        self._model_dir = settings.model_dir

    def load(self) -> None:
        try:
            from sentence_transformers import SentenceTransformer

            model_path = Path(self._model_dir) / self._model_name.split("/")[-1]
            if not (model_path / "config.json").exists():
                model_path = Path(self._model_dir) / "hub"  # HF cache layout
            self._model = SentenceTransformer(self._model_name, cache_folder=self._model_dir)
            self._tfidf = None
        except Exception as exc:  # pragma: no cover - fallback path
            print(f"[embeddings] MiniLM unavailable ({exc}); using TF-IDF fallback")
            self.use_tfidf = True

    def encode(self, texts: list[str]) -> np.ndarray:
        """Returns (n, 384) L2-normalized embeddings."""
        if not texts:
            return np.zeros((0, EMBEDDING_DIM), dtype=np.float32)
        if self.use_tfidf or self._model is None:
            return self._encode_tfidf(texts)
        vecs = self._model.encode(texts, batch_size=64, show_progress_bar=False,
                                  convert_to_numpy=True, normalize_embeddings=True)
        return vecs.astype(np.float32)

    def _encode_tfidf(self, texts: list[str]) -> np.ndarray:
        from sklearn.feature_extraction.text import TfidfVectorizer

        if self._tfidf is None:
            self._tfidf = TfidfVectorizer(
                max_features=EMBEDDING_DIM, sublinear_tf=True,
                lowercase=True, stop_words="english",
            )
            X = self._tfidf.fit_transform(texts)
        else:
            X = self._tfidf.transform(texts)
        X = X.toarray()
        # pad to exactly 384 dims
        if X.shape[1] < EMBEDDING_DIM:
            X = np.pad(X, ((0, 0), (0, EMBEDDING_DIM - X.shape[1])))
        norms = np.linalg.norm(X, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return (X / norms).astype(np.float32)


def get_embedding_service() -> EmbeddingService:
    global _service
    with _lock:
        if _service is None:
            _service = EmbeddingService()
            _service.load()
        return _service


def embedding_to_pgvector_str(vec: np.ndarray) -> str:
    """Formats a 1-D embedding as a pgvector literal '[a,b,...]'."""
    return "[" + ",".join(f"{v:.6f}" for v in vec) + "]"
