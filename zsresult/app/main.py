
from pathlib import Path

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.database import Base, engine, get_db
from app.models import Teacher, SchoolClass, Student
from app.schemas import (
    TeacherCreate,
    TeacherLogin,
    TeacherResponse,
    SchoolClassCreate,
    SchoolClassResponse,
    StudentCreate,
    StudentResponse,
    TokenResponse,
)
from app.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)
from app.connectors.registry import board_registry


# Create database tables for local development
Base.metadata.create_all(bind=engine)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="Teacher platform for managing examination results.",
    version="1.0.0",
)


# Serve frontend files
app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR),
    name="static"
)


# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


security = HTTPBearer()


# Homepage
@app.get("/")
def home():
    return FileResponse(STATIC_DIR / "index.html")


# Health check
@app.get("/api/health")
def health():
    return {"status": "healthy"}


# Authentication dependency
def get_current_teacher(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    token_data = decode_access_token(credentials.credentials)

    if not token_data or not token_data.get("sub"):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired login token.",
        )

    try:
        teacher_id = int(token_data["sub"])
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Invalid login token.",
        )

    teacher = db.get(Teacher, teacher_id)

    if not teacher or not teacher.is_active:
        raise HTTPException(
            status_code=401,
            detail="Teacher account is unavailable.",
        )

    return teacher


# Teacher registration
@app.post(
    "/api/auth/register",
    response_model=TeacherResponse,
    status_code=201,
)
def register_teacher(
    data: TeacherCreate,
    db: Session = Depends(get_db),
):
    existing_teacher = (
        db.query(Teacher)
        .filter(Teacher.email == data.email)
        .first()
    )

    if existing_teacher:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    teacher = Teacher(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
    )

    db.add(teacher)
    db.commit()
    db.refresh(teacher)

    return teacher


# Teacher login
@app.post("/api/auth/login", response_model=TokenResponse)
def login_teacher(
    data: TeacherLogin,
    db: Session = Depends(get_db),
):
    teacher = (
        db.query(Teacher)
        .filter(Teacher.email == data.email)
        .first()
    )

    if (
        not teacher
        or not teacher.is_active
        or not verify_password(
            data.password,
            teacher.hashed_password,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password.",
        )

    token = create_access_token(str(teacher.id))

    return {
        "access_token": token,
        "token_type": "bearer",
    }


# Get logged-in teacher profile
@app.get("/api/auth/me", response_model=TeacherResponse)
def get_my_profile(
    teacher: Teacher = Depends(get_current_teacher),
):
    return teacher


# Create a class
@app.post(
    "/api/classes",
    response_model=SchoolClassResponse,
    status_code=201,
)
def create_class(
    data: SchoolClassCreate,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    school_class = SchoolClass(
        class_name=data.class_name,
        teacher_id=teacher.id,
    )

    db.add(school_class)
    db.commit()
    db.refresh(school_class)

    return school_class


# List logged-in teacher's classes
@app.get(
    "/api/classes",
    response_model=list[SchoolClassResponse],
)
def get_my_classes(
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    return (
        db.query(SchoolClass)
        .filter(SchoolClass.teacher_id == teacher.id)
        .order_by(SchoolClass.id.desc())
        .all()
    )


# Edit a class
@app.put(
    "/api/classes/{class_id}",
    response_model=SchoolClassResponse,
)
def update_class(
    class_id: int,
    data: SchoolClassCreate,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    school_class = (
        db.query(SchoolClass)
        .filter(
            SchoolClass.id == class_id,
            SchoolClass.teacher_id == teacher.id,
        )
        .first()
    )

    if not school_class:
        raise HTTPException(
            status_code=404,
            detail="Class not found.",
        )

    school_class.class_name = data.class_name

    db.commit()
    db.refresh(school_class)

    return school_class


# Delete a class
@app.delete("/api/classes/{class_id}")
def delete_class(
    class_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    school_class = (
        db.query(SchoolClass)
        .filter(
            SchoolClass.id == class_id,
            SchoolClass.teacher_id == teacher.id,
        )
        .first()
    )

    if not school_class:
        raise HTTPException(
            status_code=404,
            detail="Class not found.",
        )

    db.delete(school_class)
    db.commit()

    return {
        "message": "Class deleted successfully."
    }


# Helper: verify class belongs to logged-in teacher
def get_teacher_class(
    class_id: int,
    teacher: Teacher,
    db: Session,
):
    school_class = (
        db.query(SchoolClass)
        .filter(
            SchoolClass.id == class_id,
            SchoolClass.teacher_id == teacher.id,
        )
        .first()
    )

    if not school_class:
        raise HTTPException(
            status_code=404,
            detail="Class not found.",
        )

    return school_class


# Add a student to a class
@app.post(
    "/api/classes/{class_id}/students",
    response_model=StudentResponse,
    status_code=201,
)
def create_student(
    class_id: int,
    data: StudentCreate,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    get_teacher_class(class_id, teacher, db)

    student = Student(
        name=data.name,
        roll_number=data.roll_number,
        class_id=class_id,
    )

    db.add(student)

    try:
        db.commit()
        db.refresh(student)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This roll number already exists in this class.",
        )

    return student


# View students in a class
@app.get(
    "/api/classes/{class_id}/students",
    response_model=list[StudentResponse],
)
def get_class_students(
    class_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    get_teacher_class(class_id, teacher, db)

    return (
        db.query(Student)
        .filter(Student.class_id == class_id)
        .order_by(Student.id.desc())
        .all()
    )


# Edit a student
@app.put(
    "/api/classes/{class_id}/students/{student_id}",
    response_model=StudentResponse,
)
def update_student(
    class_id: int,
    student_id: int,
    data: StudentCreate,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    get_teacher_class(class_id, teacher, db)

    student = (
        db.query(Student)
        .filter(
            Student.id == student_id,
            Student.class_id == class_id,
        )
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found.",
        )

    student.name = data.name
    student.roll_number = data.roll_number

    try:
        db.commit()
        db.refresh(student)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This roll number already exists in this class.",
        )

    return student


# Delete a student from a class
@app.delete("/api/classes/{class_id}/students/{student_id}")
def delete_student(
    class_id: int,
    student_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    get_teacher_class(class_id, teacher, db)

    student = (
        db.query(Student)
        .filter(
            Student.id == student_id,
            Student.class_id == class_id,
        )
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found.",
        )

    db.delete(student)
    db.commit()

    return {
        "message": "Student deleted successfully."
    }


# List registered board connectors
@app.get("/api/boards")
def get_boards():
    return {
        "configured_boards": board_registry.list_boards(),
        "message": (
            "Only authorized and verified board integrations "
            "can provide real results."
        ),
    }


# Bulk result checking placeholder
@app.post("/api/results/bulk")
def bulk_results_not_configured():
    raise HTTPException(
        status_code=503,
        detail=(
            "Official result retrieval is not configured yet. "
            "No student results have been retrieved. "
            "An authorized board data integration is required."
        ),
    )
    from app.models import StudentResult
from app.schemas import StudentResultCreate, StudentResultResponse

# Add or update student result (Teacher only)
@app.post(
    "/api/classes/{class_id}/students/{student_id}/results",
    response_model=StudentResultResponse,
    status_code=201,
)
def create_student_result(
    class_id: int,
    student_id: int,
    data: StudentResultCreate,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    get_teacher_class(class_id, teacher, db)

    student = db.query(Student).filter(Student.id == student_id, Student.class_id == class_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    result = StudentResult(
        student_id=student_id,
        exam_type=data.exam_type,
        total_marks=data.total_marks,
        obtained_marks=data.obtained_marks,
        grade=data.grade,
        remarks=data.remarks,
    )

    db.add(result)
    db.commit()
    db.refresh(result)

    return result

# Public Result Search by Roll Number
@app.get("/api/results/search")
def search_student_result(
    roll_number: str,
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(Student.roll_number == roll_number).first()
    if not student:
        raise HTTPException(status_code=404, detail="No student found with this roll number.")

    results = db.query(StudentResult).filter(StudentResult.student_id == student.id).all()
    
    return {
        "student_name": student.name,
        "roll_number": student.roll_number,
        "class_id": student.class_id,
        "results": [
            {
                "id": r.id,
                "exam_type": r.exam_type,
                "total_marks": r.total_marks,
                "obtained_marks": r.obtained_marks,
                "grade": r.grade,
                "remarks": r.remarks,
            } for r in results
        ]
    }
