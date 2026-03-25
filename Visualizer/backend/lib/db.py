from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = "AICourseVisualizer"

__all__ = ["setup_db"]

def setup_db():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    lessons_collection = db["lessons"]
    subtopics_collection = db["subtopics"]
    contents_collection = db["contents"]
    users_collection = db["users"]

    print("Database collections initialized:")
    return lessons_collection, subtopics_collection, contents_collection, users_collection

