from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime, BigInteger
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.core.database import Base

class App(Base):
    __tablename__ = "apps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    icon = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    fields = relationship("Field", back_populates="app", cascade="all, delete-orphan")
    records = relationship("Record", back_populates="app", cascade="all, delete-orphan")

class Field(Base):
    __tablename__ = "fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app_id = Column(UUID(as_uuid=True), ForeignKey("apps.id"), nullable=False, index=True)
    code = Column(String, nullable=False) # e.g. "customer_name"
    type = Column(String, nullable=False) # e.g. "SINGLE_LINE_TEXT"
    label = Column(String, nullable=False)
    config = Column(JSONB, default={}) # Validation rules, default values
    
    # Relationships
    app = relationship("App", back_populates="fields")

class Record(Base):
    __tablename__ = "records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app_id = Column(UUID(as_uuid=True), ForeignKey("apps.id"), nullable=False, index=True)
    record_number = Column(BigInteger, nullable=False) # User-friendly ID
    data = Column(JSONB, default={}) # The actual dynamic data
    status = Column(String, default="Draft") # Workflow status
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    app = relationship("App", back_populates="records")
