"""Simple in-memory rate limiter (NFR-SEC-006, FR-AAA-001 lockout support)."""
import time
from collections import defaultdict, deque
from threading import Lock


from app.config import get_settings


class SlidingWindowRateLimiter:
    def __init__(self, max_requests: int | None, window_seconds: int, settings_attr: str | None = None):
        self._max_requests = max_requests
        self.window_seconds = window_seconds
        self.settings_attr = settings_attr
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = Lock()

    @property
    def max_requests(self) -> int:
        if self.settings_attr:
            settings = get_settings()
            return getattr(settings, self.settings_attr, self._max_requests or 100)
        return self._max_requests or 100

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        limit = self.max_requests
        with self._lock:
            dq = self._hits[key]
            while dq and now - dq[0] > self.window_seconds:
                dq.popleft()
            if len(dq) >= limit:
                return False
            dq.append(now)
            return True

    def reset(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._hits.clear()
            else:
                self._hits.pop(key, None)


# 100 requests / minute per user (NFR-SEC-006)
api_limiter = SlidingWindowRateLimiter(max_requests=100, window_seconds=60, settings_attr="api_rate_limit")
# 5 login attempts / 15 minutes per IP+username (FR-AAA-001)
login_limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=15 * 60, settings_attr="login_rate_limit")
