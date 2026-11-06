from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (تسجيل الجداول)
from .config import settings
from .database import Base, engine
from .routers import admin, public


@asynccontextmanager
async def lifespan(app: FastAPI):
    # للبداية فقط. لاحقاً نستخدم Alembic لتعديل الجداول بأمان.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Ph. Asma Store API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_url],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(public.router)
app.include_router(admin.router)


@app.get("/health")
def health():
    return {"status": "ok"}
