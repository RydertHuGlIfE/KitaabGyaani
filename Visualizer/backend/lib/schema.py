from pydantic import BaseModel
from typing import Optional, List

class ContentSchema(BaseModel):
    title: str
    text: str
    metadata: Optional[dict] = {}

class SubtopicSchema(BaseModel):
    name: str
    content_id: Optional[str] = None   # linked content

class LessonSchema(BaseModel):
    user_id: str
    title: str
    mermaidDiagram: str
    grade: str
    subtopics: Optional[List[str]] = []  # store ObjectIds of subtopics

class UserSchema(BaseModel):
    email: str
    name: str
    otp: str
    lessons: Optional[List[str]] = []  # store ObjectIds of lessons
