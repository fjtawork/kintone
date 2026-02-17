from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional, Dict, Any
from uuid import UUID
from app.models.models import App, Field
from app.models.user import User
from app.schemas.app_schema import AppCreate, AppUpdate, ProcessManagementUpdate, ViewSettingsUpdate, AppUserPermissions
from sqlalchemy.orm.attributes import flag_modified

class AppService:
    @staticmethod
    async def _validate_process_management(
        db: AsyncSession, app_id: UUID, pm_update: ProcessManagementUpdate
    ) -> None:
        result = await db.execute(select(Field.code, Field.type).where(Field.app_id == app_id))
        field_type_by_code = {code: field_type for code, field_type in result.all()}

        for status in pm_update.statuses:
            status_name = str(status.get("name") or "").strip() or "(unnamed)"
            assignee = status.get("assignee") or {}
            if assignee.get("type") != "field":
                continue

            field_code = str(assignee.get("field_code") or "").strip()
            if not field_code:
                raise ValueError(f"status '{status_name}': assignee.type=field requires field_code")

            field_type = field_type_by_code.get(field_code)
            if field_type is None:
                raise ValueError(f"status '{status_name}': field_code '{field_code}' does not exist")
            if field_type != "USER_SELECTION":
                raise ValueError(
                    f"status '{status_name}': field_code '{field_code}' must be USER_SELECTION, got '{field_type}'"
                )

    @staticmethod
    def evaluate_app_permissions(app: App, user: User) -> AppUserPermissions:
        if user.is_superuser:
            return AppUserPermissions(view=True, edit=True, delete=True, manage=True)
        
        acl = app.app_acl or []
        
        # Default behavior if no ACL: Public View, Creator Manage
        if not acl:
            is_creator = (app.created_by == user.id)
            return AppUserPermissions(
                view=True,
                edit=is_creator,
                delete=is_creator,
                manage=is_creator
            )

        perms = {"view": False, "edit": False, "delete": False, "manage": False}
        
        for rule in acl:
            matched = False
            entity_type = rule.get("entity_type")
            entity_id = rule.get("entity_id")
            
            if entity_type == "user" and str(entity_id) == str(user.id):
                matched = True
            elif entity_type == "department" and user.department_id and str(entity_id) == str(user.department_id):
                matched = True
            elif entity_type == "job_title" and user.job_title_id and str(entity_id) == str(user.job_title_id):
                matched = True
            elif entity_type == "creator" and app.created_by == user.id:
                matched = True
            elif entity_type == "everyone":
                matched = True
                
            if matched:
                if rule.get("allow_view"): perms["view"] = True
                if rule.get("allow_edit"): perms["edit"] = True
                if rule.get("allow_delete"): perms["delete"] = True
                if rule.get("allow_manage"): perms["manage"] = True
        
        return AppUserPermissions(**perms)

    @staticmethod
    async def create_app(db: AsyncSession, app_in: AppCreate, user_id: UUID) -> App:
        db_app = App(
            name=app_in.name,
            description=app_in.description,

            icon=app_in.icon,
            theme=app_in.theme,
            created_by=user_id,
            app_acl=app_in.app_acl or [],
            record_acl=app_in.record_acl or [],
            permissions={
                "app": {
                    "view": ["everyone"],
                    "edit": ["creator"],
                    "delete": ["creator"]
                },
                "record": {
                    "view": ["everyone"],
                    "edit": ["creator"], # Default to creator or permissions module will handle "everyone" if we want open
                    "delete": ["creator"]
                },
                "fields": {}
            }
        )
        db.add(db_app)
        await db.commit()
        await db.refresh(db_app)
        return db_app

    @staticmethod
    async def update_app(db: AsyncSession, app_id: UUID, app_update: AppUpdate) -> Optional[App]:
        app = await AppService.get_app(db, app_id)
        if not app:
            return None
        
        update_data = app_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(app, key, value)
            
        await db.commit()
        await db.refresh(app)
        return app

    @staticmethod
    async def get_apps(db: AsyncSession, skip: int = 0, limit: int = 100, created_by: Optional[UUID] = None) -> List[App]:
        query = select(App).offset(skip).limit(limit)
        if created_by:
            query = query.where(App.created_by == created_by)
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_app(db: AsyncSession, app_id: UUID) -> Optional[App]:
        result = await db.execute(select(App).where(App.id == app_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def update_process_management(db: AsyncSession, app_id: UUID, pm_update: ProcessManagementUpdate) -> Optional[App]:
        app = await AppService.get_app(db, app_id)
        if not app:
            return None

        await AppService._validate_process_management(db, app_id, pm_update)
        app.process_management = pm_update.model_dump()
        
        await db.commit()
        await db.refresh(app)
        return app

    @staticmethod
    async def update_permissions(db: AsyncSession, app_id: UUID, permissions_in: Dict[str, Any]) -> Optional[App]:
        app = await AppService.get_app(db, app_id)
        if not app:
            return None
        
        app.permissions = permissions_in
        
        # Sync app_acl from permissions for backward compatibility / simplified UI
        # Generate ACL rules based on the 'app' permissions (view, edit, delete)
        new_acl = []
        app_perms = permissions_in.get("app", {})
        
        # We need to inverse the mapping: Users -> Rights
        # But here we have Rights -> Users (e.g. view: ["everyone", "creator"])
        # Simplified ACL generation:
        
        # 1. Handle "everyone"
        if "everyone" in app_perms.get("view", []):
            new_acl.append({"entity_type": "everyone", "allow_view": True})
        if "everyone" in app_perms.get("edit", []):
            # Check if existing everyone rule
            rule = next((r for r in new_acl if r["entity_type"] == "everyone"), None)
            if rule: rule["allow_edit"] = True
            else: new_acl.append({"entity_type": "everyone", "allow_edit": True})
            
        # 2. Handle "creator"
        if "creator" in app_perms.get("view", []) or "creator" in app_perms.get("edit", []) or "creator" in app_perms.get("delete", []):
             rule = {"entity_type": "creator"}
             if "creator" in app_perms.get("view", []): rule["allow_view"] = True
             if "creator" in app_perms.get("edit", []): rule["allow_edit"] = True
             if "creator" in app_perms.get("delete", []): rule["allow_delete"] = True
             # Creator always has manage in simple model? Or logic handles it?
             # AppService.evaluate_app_permissions handles is_creator check for manage if no ACL? 
             # No, if ACL exists, it uses ACL. So we must explicitly grant manage to creator if we want them to manage.
             # In simplified permissions, creator usually has manage.
             rule["allow_manage"] = True 
             new_acl.append(rule)

        # TODO: Handle specific users/groups if they were supported in this simplified format (usually they are not in the 'everyone'/'creator' strings)
        
        app.app_acl = new_acl
        
        await db.commit()
        await db.refresh(app)
        return app

    @staticmethod
    async def update_view_settings(db: AsyncSession, app_id: UUID, view_update: ViewSettingsUpdate) -> Optional[App]:
        app = await AppService.get_app(db, app_id)
        if not app:
            return None
        
        current_settings = app.view_settings or {}
        if view_update.list_fields is not None:
            current_settings["list_fields"] = view_update.list_fields
        if view_update.form_columns is not None:
            current_settings["form_columns"] = view_update.form_columns
        
        app.view_settings = current_settings
        flag_modified(app, "view_settings")
        
        await db.commit()
        await db.refresh(app)
        return app
