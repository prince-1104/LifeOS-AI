import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request

logger = logging.getLogger(__name__)

class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter()
        response = await call_next(request)
        process_time = time.perf_counter() - start_time
        with open("timing.log", "a") as f:
            f.write(f"Request: {request.method} {request.url.path} - Time: {process_time:.4f}s\n")
        response.headers["X-Process-Time"] = str(process_time)
        return response
