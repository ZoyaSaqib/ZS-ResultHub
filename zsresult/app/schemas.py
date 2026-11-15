from pydantic import BaseModel, EmailStr, Field, ConfigDict


class TeacherCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class TeacherLogin(BaseModel):
    email: EmailStr
    password: str


class TeacherResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class SchoolClassCreate(BaseModel):
    class_name: str = Field(min_length=1, max_length=50)


class SchoolClassResponse(BaseModel):
    id: int
    class_name: str

    model_config = ConfigDict(from_attributes=True)


class StudentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    roll_number: str = Field(min_length=1, max_length=50)


class StudentResponse(BaseModel):
    id: int
    name: str
    roll_number: str
    class_id: int

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class BulkResultRequest(BaseModel):
    board: str
    exam_type: str
    class_name: str
    year: int = Field(ge=2000, le=2100)
    roll_numbers: list[str] = Field(min_length=1, max_length=200)


class StudentResultCreate(BaseModel):
    exam_type: str = Field(min_length=2, max_length=50)
    total_marks: int = Field(ge=1, le=5000)
    obtained_marks: int = Field(ge=0, le=5000)
    grade: str = Field(min_length=1, max_length=10)
    remarks: str | None = Field(default=None, max_length=255)


class StudentResultResponse(BaseModel):
    id: int
    student_id: int
    exam_type: str
    total_marks: int
    obtained_marks: int
    grade: str
    remarks: str | None

    model_config = ConfigDict(from_attributes=True)