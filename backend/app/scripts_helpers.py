"""Seed users (FR-AAA-001 mvp_seed_users) + startup helpers."""
from sqlalchemy import select

from app.auth.password import hash_password
from app.database import AsyncSessionLocal
from app.models import User

SEED_USERS = [
    {"username": "admin", "role": "ROLE_ADMIN", "password": "Admin@1234",
     "full_name": "System Administrator", "scope_type": None, "scope_value": None},
    {"username": "ministry_user", "role": "ROLE_MINISTRY", "password": "Ministry@1234",
     "full_name": "Ministry Official (MoSPI)", "scope_type": None, "scope_value": None},
    {"username": "state_user", "role": "ROLE_STATE_NODAL", "password": "State@1234",
     "full_name": "State Nodal Authority", "scope_type": "STATE", "scope_value": "Maharashtra"},
    {"username": "district_user", "role": "ROLE_DISTRICT", "password": "District@1234",
     "full_name": "District Authority", "scope_type": "DISTRICT", "scope_value": "Pune"},
    {"username": "mp_user", "role": "ROLE_MP", "password": "Mp@12345",
     "full_name": "Member of Parliament", "scope_type": "CONSTITUENCY", "scope_value": "Pune"},
    {"username": "public_user", "role": "ROLE_PUBLIC", "password": "Public@1234",
     "full_name": "Public Viewer", "scope_type": None, "scope_value": None},
]


async def seed_users() -> int:
    created = 0
    async with AsyncSessionLocal() as session:
        for u in SEED_USERS:
            existing = (await session.execute(
                select(User).where(User.username == u["username"]))).scalar_one_or_none()
            if existing is None:
                session.add(User(
                    username=u["username"], password_hash=hash_password(u["password"]),
                    full_name=u["full_name"], role=u["role"], scope_type=u["scope_type"],
                    scope_value=u["scope_value"], is_active=True,
                ))
                created += 1
        await session.commit()
    return created


if __name__ == "__main__":
    import asyncio
    n = asyncio.run(seed_users())
    print(f"Seed users: {n} created")
