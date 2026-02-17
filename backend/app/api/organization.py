from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.models.organization import Department, JobTitle
from app.schemas.organization_schema import (
    DepartmentCreate, DepartmentUpdate, DepartmentResponse,
    JobTitleCreate, JobTitleUpdate, JobTitleResponse
)
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

# --- Departments ---

@router.post("/departments", response_model=DepartmentResponse)
async def create_department(
    dept: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    new_dept = Department(**dept.model_dump())
    db.add(new_dept)
    await db.commit()
    await db.refresh(new_dept)
    return new_dept

@router.get("/departments", response_model=List[DepartmentResponse])
async def read_departments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Department).order_by(Department.created_at))
    return result.scalars().all()

@router.put("/departments/{dept_id}", response_model=DepartmentResponse)
async def update_department(
    dept_id: UUID,
    dept_update: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_superuser:
         raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalars().first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    update_data = dept_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(dept, key, value)
    
    await db.commit()
    await db.refresh(dept)
    return dept

@router.delete("/departments/{dept_id}")
async def delete_department(
    dept_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_superuser:
         raise HTTPException(status_code=403, detail="Not authorized")
         
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalars().first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
        
    await db.delete(dept)
    await db.commit()
    return {"ok": True}

# --- Job Titles ---

@router.post("/job_titles", response_model=JobTitleResponse)
async def create_job_title(
    title: JobTitleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    new_title = JobTitle(**title.model_dump())
    db.add(new_title)
    await db.commit()
    await db.refresh(new_title)
    return new_title

@router.get("/job_titles", response_model=List[JobTitleResponse])
async def read_job_titles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Order by rank descending (highest rank first) or as preferred
    result = await db.execute(select(JobTitle).order_by(JobTitle.rank.desc()))
    return result.scalars().all()

@router.put("/job_titles/{title_id}", response_model=JobTitleResponse)
async def update_job_title(
    title_id: UUID,
    title_update: JobTitleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_superuser:
         raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(select(JobTitle).where(JobTitle.id == title_id))
    title = result.scalars().first()
    if not title:
        raise HTTPException(status_code=404, detail="Job Title not found")

    update_data = title_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(title, key, value)
    
    await db.commit()
    await db.refresh(title)
    return title

@router.delete("/job_titles/{title_id}")
async def delete_job_title(
    title_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_superuser:
         raise HTTPException(status_code=403, detail="Not authorized")
         
    result = await db.execute(select(JobTitle).where(JobTitle.id == title_id))
    title = result.scalars().first()
    if not title:
        raise HTTPException(status_code=404, detail="Job Title not found")
        
    await db.delete(title)
    await db.commit()
    return {"ok": True}
