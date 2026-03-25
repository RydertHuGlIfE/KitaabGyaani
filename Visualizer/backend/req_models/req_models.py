from pydantic import BaseModel, EmailStr
# Export the request models for use in other modules
__all__ = ['LessonRequest', 'SubtopicRequest', 'SignInRequest', 'UpdateProfileRequest', 'VerifyOTPRequest']
class LessonRequest(BaseModel):
    user_id: str
    lesson_name: str
    model: str
    grade: str
    mermaid_code: str | None = None

class SubtopicRequest(BaseModel):
    lesson_name: str
    subtopic_name: str
    model: str
    grade: str

class SignInRequest(BaseModel):
    email: EmailStr
    name: str

class UpdateProfileRequest(BaseModel):
    name: str

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    name: str
    otp: str