from sqlalchemy import Boolean, Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.core.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .organization import Department, JobTitle

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    job_title_id = Column(UUID(as_uuid=True), ForeignKey("job_titles.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    department = relationship("Department", back_populates="users")
    job_title = relationship("JobTitle", back_populates="users")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
