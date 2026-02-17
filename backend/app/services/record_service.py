from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import Any, Dict, List, Optional, Set
from uuid import UUID
from datetime import datetime, timezone
from app.models.models import App, Record
from app.models.user import User
from app.schemas.record_schema import RecordCreate
from app.services.notification_service import NotificationService

class RecordService:
    @staticmethod
    async def get_next_record_number(db: AsyncSession, app_id: UUID) -> int:
        # Simple auto-increment logic (Replace with sequence or robust locking in prod)
        result = await db.execute(select(func.max(Record.record_number)).where(Record.app_id == app_id))
        max_num = result.scalar()
        return (max_num or 0) + 1

    @staticmethod
    async def create_record(db: AsyncSession, record_in: RecordCreate, user_id: UUID) -> Record:
        # TODO: Validate record_in.data against App Fields
        app = (await db.execute(select(App).where(App.id == record_in.app_id))).scalar_one_or_none()

        requested_status = (record_in.status or "").strip()
        initial_status = requested_status or "Draft"

        # If process management is enabled, initialize records from the first configured status.
        # This prevents a hidden "Draft" status from blocking first workflow actions.
        if app:
            process = app.process_management or {}
            statuses = process.get("statuses") or []
            first_status_name = next(
                (str(status.get("name") or "").strip() for status in statuses if str(status.get("name") or "").strip()),
                "",
            )
            if process.get("enabled") and first_status_name and (not requested_status or requested_status == "Draft"):
                initial_status = first_status_name

        next_num = await RecordService.get_next_record_number(db, record_in.app_id)
        
        db_record = Record(
            app_id=record_in.app_id,
            record_number=next_num,
            status=initial_status,
            data=record_in.data,
            created_by=user_id
        )
        db.add(db_record)
        await db.commit()
        await db.refresh(db_record)
        return db_record

    @staticmethod
    async def execute_workflow_action(
        db: AsyncSession,
        app: App,
        record_id: UUID,
        actor: User,
        action_name: str,
        next_assignee_id: Optional[UUID] = None,
        comment: Optional[str] = None,
    ) -> Optional[Record]:
        record = await RecordService.get_record(db, record_id)
        if not record:
            return None

        pm = app.process_management or {}
        if not pm.get("enabled"):
            raise ValueError("process management is disabled")

        actions = pm.get("actions") or []
        action = RecordService._find_transition_action(actions, action_name, record.status)
        if not action:
            raise ValueError("action is not allowed from current status")

        if not actor.is_superuser:
            RecordService._ensure_actor_can_execute(record, actor)

        to_status = action.get("to") or action.get("to_status")
        if not to_status:
            raise ValueError("action must define target status")

        status_cfg = RecordService._find_status(pm.get("statuses") or [], to_status)
        if not status_cfg:
            raise ValueError("target status is not defined in process settings")

        next_assignees, selection = await RecordService._resolve_status_assignees(
            db=db,
            record=record,
            status_cfg=status_cfg,
        )

        if next_assignees:
            if next_assignee_id:
                selected = str(next_assignee_id)
                if selected not in next_assignees:
                    raise ValueError("next_assignee_id is not in candidate assignees")
                next_assignees = [selected]
            elif selection == "single" and len(next_assignees) > 1:
                raise ValueError("next_assignee_id is required for single-select step")

        now = datetime.now(timezone.utc)
        history = list(record.workflow_history or [])
        history.append(
            {
                "actor_id": str(actor.id),
                "action": action_name,
                "from_status": record.status,
                "to_status": to_status,
                "comment": comment,
                "at": now.isoformat(),
            }
        )

        if not record.workflow_submitted_at:
            record.workflow_submitted_at = now
            record.workflow_requester_id = record.created_by

        record.status = to_status
        record.workflow_approver_ids = next_assignees
        record.workflow_current_step = 0
        record.workflow_history = history
        record.workflow_decided_at = None if next_assignees else now

        if RecordService._is_terminal_status(pm, to_status):
            creator_id = record.created_by
            if creator_id and str(creator_id) != str(actor.id):
                await NotificationService.create_notification(
                    db,
                    user_id=creator_id,
                    app_id=record.app_id,
                    record_id=record.id,
                    kind="workflow_terminal",
                    title=f"レコード #{record.record_number} が {to_status} になりました",
                    message=f"アクション「{action_name}」が実行され、最終ステータス「{to_status}」に遷移しました。",
                )

        await db.commit()
        await db.refresh(record)
        return record

    @staticmethod
    async def get_pending_approvals_for_user(
        db: AsyncSession, user_id: UUID, app_id: Optional[UUID] = None
    ) -> List[Record]:
        query = select(Record)
        if app_id:
            query = query.where(Record.app_id == app_id)

        result = await db.execute(query.order_by(Record.created_at.desc()))
        records = result.scalars().all()

        uid = str(user_id)
        matched: List[Record] = []
        for record in records:
            current_assignees = {str(aid) for aid in (record.workflow_approver_ids or [])}
            if uid in current_assignees:
                matched.append(record)
        return matched

    @staticmethod
    def _find_transition_action(actions: List[Dict[str, Any]], action_name: str, from_status: str) -> Optional[Dict[str, Any]]:
        for action in actions:
            name = action.get("name")
            source = action.get("from") or action.get("from_status")
            if name == action_name and source == from_status:
                return action
        return None

    @staticmethod
    def _find_status(statuses: List[Dict[str, Any]], status_name: str) -> Optional[Dict[str, Any]]:
        for status_cfg in statuses:
            if status_cfg.get("name") == status_name:
                return status_cfg
        return None

    @staticmethod
    def _is_terminal_status(process_management: Dict[str, Any], status_name: str) -> bool:
        actions = process_management.get("actions") or []
        for action in actions:
            source = action.get("from") or action.get("from_status")
            if source == status_name:
                return False
        return True

    @staticmethod
    def _ensure_actor_can_execute(record: Record, actor: User) -> None:
        # If explicit assignees are set, only those users can execute actions.
        current_assignees = {str(uid) for uid in (record.workflow_approver_ids or [])}
        if current_assignees:
            if str(actor.id) not in current_assignees:
                raise PermissionError("only current assignee can execute this action")
            return

        # Initial step fallback: record creator can move from draft-like state.
        if not record.created_by or str(record.created_by) != str(actor.id):
            raise PermissionError("only record creator can execute this action")

    @staticmethod
    async def _resolve_status_assignees(
        db: AsyncSession,
        record: Record,
        status_cfg: Dict[str, Any],
    ) -> tuple[List[str], str]:
        assignee_cfg = status_cfg.get("assignee") or {}
        assignee_type = assignee_cfg.get("type")
        selection = assignee_cfg.get("selection", "all")

        resolved: Set[str] = set()
        if not assignee_type:
            return [], selection

        if assignee_type == "creator":
            if record.created_by:
                resolved.add(str(record.created_by))
        elif assignee_type == "users":
            for uid in assignee_cfg.get("user_ids", []):
                resolved.add(str(uid))
        elif assignee_type == "field":
            field_code = assignee_cfg.get("field_code")
            if not field_code:
                raise ValueError("assignee.type=field requires field_code")
            raw = (record.data or {}).get(field_code)
            if isinstance(raw, list):
                for uid in raw:
                    resolved.add(str(uid))
            elif raw:
                resolved.add(str(raw))
        elif assignee_type == "entities":
            entities = assignee_cfg.get("entities") or []
            resolved |= await RecordService._expand_entities_to_user_ids(db, entities)
        else:
            raise ValueError(f"unsupported assignee type: {assignee_type}")

        return sorted(resolved), selection

    @staticmethod
    async def _expand_entities_to_user_ids(
        db: AsyncSession, entities: List[Dict[str, Any]]
    ) -> Set[str]:
        user_ids: Set[str] = set()

        for entity in entities:
            etype = entity.get("entity_type")
            eid = entity.get("entity_id")
            if etype == "user" and eid:
                user_ids.add(str(eid))
                continue
            if etype == "department" and eid:
                result = await db.execute(select(User.id).where(User.department_id == eid))
                user_ids |= {str(uid) for uid in result.scalars().all()}
                continue
            if etype == "job_title" and eid:
                result = await db.execute(select(User.id).where(User.job_title_id == eid))
                user_ids |= {str(uid) for uid in result.scalars().all()}
                continue

        return user_ids

    @staticmethod
    async def get_records(
        db: AsyncSession, 
        app_id: UUID, 
        skip: int = 0, 
        limit: int = 100, 
        filters: Optional[dict] = None,
        user: Optional['User'] = None, # Make optional for backward compat, but logic requires it for ACL
        app_record_acl: Optional[List[dict]] = None
    ) -> List[Record]:
        query = select(Record).where(Record.app_id == app_id)
        
        # --- ACL Filtering ---
        if user and app_record_acl:
            from sqlalchemy import and_, or_, not_, literal, cast, String
            
            acl_expressions = []
            accumulated_not = []
            
            for rule in app_record_acl:
                # 1. Condition
                cond = rule.get("condition")
                if not cond: continue
                
                field_code = cond.get("field")
                op = cond.get("operator")
                val = cond.get("value")
                
                # SQL Condition
                # Simple implementation: Supports "=" only for now
                if op == "=":
                    # JSONB lookup
                    sql_cond = Record.data[field_code].astext == str(val)
                else:
                    # Default to always valid if operator unknown (or ignore rule?)
                    # Let's ignore rule to be safe (fallback to default)
                    continue

                # 2. Permission Check (View)
                perms = rule.get("permissions", {}).get("view", [])
                
                # Check if user is in static list
                is_in_static = False
                includes_creator = False
                
                for entity in perms:
                    # Format: "user:UUID", "dept:UUID", "everyone", "creator"
                    # Or just IDs? Let's assume schema matches what we store.
                    # Plan said: {entity_type, entity_id} list? 
                    # Implementation plan: "permissions: {users/groups...}"
                    # Let's assume standard kintone list format: "user:ID", "group:ID", "creator" or just simple parsing
                    # Based on AppService logic implemented earlier, I used a structured dict.
                    # Let's assume `perms` is a LIST of entity objects like in App ACL?
                    # Or simple strings? Simplest is list of entity strings.
                    # Let's assume struct: [{"type": "user", "id": "..."}]
                    
                    etype = entity.get("entity_type") if isinstance(entity, dict) else None
                    eid = entity.get("entity_id") if isinstance(entity, dict) else None
                    
                    if etype == "everyone":
                        is_in_static = True
                        break
                    if etype == "creator":
                        includes_creator = True
                    if etype == "user" and str(eid) == str(user.id):
                        is_in_static = True
                    if etype == "department" and str(eid) == str(user.department_id):
                        is_in_static = True
                    if etype == "job_title" and str(eid) == str(user.job_title_id):
                        is_in_static = True

                # Validation Logic
                # If static (True) -> User matches
                # If dynamic (Creator) -> Record.created_by == user.id
                
                perm_expr = None
                if is_in_static:
                    perm_expr = literal(True)
                elif includes_creator:
                    perm_expr = (Record.created_by == user.id)
                else:
                    perm_expr = literal(False)
                
                # 3. Combine
                # (Condition AND Perm)
                current_rule_logic = and_(*accumulated_not, sql_cond, perm_expr)
                acl_expressions.append(current_rule_logic)
                
                accumulated_not.append(not_(sql_cond))
            
            # Default Fallback (if no rules matched)
            # If NO rules matched (accumulated_not is true), what happens?
            # Default: Everyone View? 
            # Safe default: Allow.
            default_expr = and_(*accumulated_not)
            acl_expressions.append(default_expr)
            
            # Apply Filter
            if acl_expressions:
                query = query.where(or_(*acl_expressions))

        # --- End ACL Filtering ---

        if filters:
            for key, value in filters.items():
                if value is None or value == "":
                    continue
                if isinstance(value, str):
                    query = query.where(Record.data[key].astext.ilike(f"%{value}%"))
                else:
                    query = query.where(Record.data[key].astext == str(value))
        
        query = query.order_by(Record.record_number.desc()).offset(skip).limit(limit)
        
        result = await db.execute(query)
        return result.scalars().all()
    
    @staticmethod
    def check_record_permission(record: Record, user: 'User', app_record_acl: List[dict] = None) -> bool:
        if user.is_superuser:
            return True
            
        if not app_record_acl:
            return True # Default allow if no rules
            
        # Logic matches SQL generation in get_records
        for rule in app_record_acl:
            # 1. Condition
            cond = rule.get("condition")
            if not cond: continue
            
            field = cond.get("field")
            op = cond.get("operator")
            val = cond.get("value")
            
            record_val = record.data.get(field)
            if isinstance(record_val, dict): # Check structure?
                pass
            
            matched_cond = False
            # Equality only for now
            if op == "=":
                 if str(record_val) == str(val):
                     matched_cond = True
                     
            if not matched_cond:
                continue
                
            # 2. Permission Check (View)
            perms = rule.get("permissions", {}).get("view", [])
            allowed = False
            for entity in perms:
                etype = entity.get("entity_type") if isinstance(entity, dict) else None
                eid = entity.get("entity_id") if isinstance(entity, dict) else None
                
                if etype == "everyone": allowed = True
                if etype == "creator" and record.created_by == user.id: allowed = True
                if etype == "user" and str(eid) == str(user.id): allowed = True
                if etype == "department" and str(eid) == str(user.department_id): allowed = True
                if etype == "job_title" and str(eid) == str(user.job_title_id): allowed = True
                
            return allowed # If condition matched, we return permission result (True/False)
            
        return True # Default allow if no condition matched expression

    @staticmethod
    async def get_record(db: AsyncSession, record_id: UUID) -> Optional[Record]:
        result = await db.execute(select(Record).where(Record.id == record_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def update_status(db: AsyncSession, record_id: UUID, action_name: str) -> Optional[Record]:
        record = await RecordService.get_record(db, record_id)
        if not record:
            return None
        
        # Simple update for now
        record.status = action_name
        # In real world, we would validate against app.process_management['actions']
        
        await db.commit()
        await db.refresh(record)
        return record

    @staticmethod
    async def update_record(db: AsyncSession, record_id: UUID, record_update: 'RecordUpdate') -> Optional[Record]:
        record = await RecordService.get_record(db, record_id)
        if not record:
            return None
        
        if record_update.status:
            record.status = record_update.status
            
        if record_update.data:
            # Deep merge or replace? For simplicity, we merge keys.
            # If replacing entirely is desired, we should do so.
            # Usually patches merge.
            current_data = record.data or {}
            current_data.update(record_update.data)
            record.data = current_data
            # Note: For JSONB mutations in SQLAlchemy, we might need flag_modified if we modify in place.
            # But reapplying the dict usually works. Just to be safe:
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(record, "data")
            
        await db.commit()
        await db.refresh(record)
        return record
