from datetime import datetime

from sqlalchemy import (
    String,
    Integer,
    DateTime,
    ForeignKey,
    Boolean,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    classes: Mapped[list["SchoolClass"]] = relationship(
        back_populates="teacher",
        cascade="all, delete-orphan"
    )


class SchoolClass(Base):
    __tablename__ = "school_classes"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    class_name: Mapped[str] = mapped_column(
        String(50), nullable=False
    )

    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("teachers.id"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    teacher: Mapped["Teacher"] = relationship(
        back_populates="classes"
    )

    students: Mapped[list["Student"]] = relationship(
        back_populates="school_class",
        cascade="all, delete-orphan"
    )


class Student(Base):
    __tablename__ = "students"

    __table_args__ = (
        UniqueConstraint(
            "class_id",
            "roll_number",
            name="unique_roll_per_class"
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    name: Mapped[str] = mapped_column(
        String(120), nullable=False
    )

    roll_number: Mapped[str] = mapped_column(
        String(50), nullable=False
    )

    class_id: Mapped[int] = mapped_column(
        ForeignKey("school_classes.id"),
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    school_class: Mapped["SchoolClass"] = relationship(
        back_populates="students"
    )


class StudentResult(Base):
    __tablename__ = "student_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    exam_type: Mapped[str] = mapped_column(String(50), nullable=False)
    total_marks: Mapped[int] = mapped_column(Integer, default=500)
    obtained_marks: Mapped[int] = mapped_column(Integer, nullable=False)
    grade: Mapped[str] = mapped_column(String(10), nullable=False)
    remarks: Mapped[str] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)