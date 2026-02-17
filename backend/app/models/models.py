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
    theme = Column(String, nullable=True)
    process_management = Column(JSONB, default={
        "enabled": False,
        "statuses": [
            {"name": "開始前"},
            {"name": "進行中"},
            {"name": "完了"}
        ],
        "actions": [
            {"name": "開始する", "from": "開始前", "to": "進行中"},
            {"name": "完了する", "from": "進行中", "to": "完了"}
        ]
    })
    permissions = Column(JSONB, default={
        "app": {"view": ["everyone"], "edit": ["creator"], "delete": ["creator"]},
        "record": {"view": ["everyone"], "edit": ["everyone"], "delete": ["creator"]},
        "fields": {} 
    })
    app_acl = Column(JSONB, default=[]) # List of {entity_type, entity_id, allow_view, allow_manage...}
    record_acl = Column(JSONB, default=[]) # List of rules for conditional access
    view_settings = Column(JSONB, default={"list_fields": [], "form_columns": 1})
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True) # Nullable for existing records
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

    @property
    def options(self):
        return self.config.get("options") if self.config else None

    @property
    def related_app_id(self):
        return self.config.get("related_app_id") if self.config else None

class Record(Base):
    __tablename__ = "records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app_id = Column(UUID(as_uuid=True), ForeignKey("apps.id"), nullable=False, index=True)
    record_number = Column(BigInteger, nullable=False) # User-friendly ID
    data = Column(JSONB, default={}) # The actual dynamic data
    status = Column(String, default="Draft") # Workflow status
    
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    workflow_requester_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    workflow_approver_ids = Column(JSONB, default=[])  # ordered list of user ids
    workflow_current_step = Column(Integer, default=0, nullable=False)
    workflow_submitted_at = Column(DateTime(timezone=True), nullable=True)
    workflow_decided_at = Column(DateTime(timezone=True), nullable=True)
    workflow_history = Column(JSONB, default=[])  # [{actor_id, action, comment, at}]
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    app = relationship("App", back_populates="records")
