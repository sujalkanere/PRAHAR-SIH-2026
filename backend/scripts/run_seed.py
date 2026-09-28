import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SyncSessionLocal
from app.services.official_dataset_seeder import seed_official_datasets_sync

print("Starting official dataset ingestion...")
with SyncSessionLocal() as session:
    res = seed_official_datasets_sync(session)
    print("Seed completed successfully!")
    print(res)
