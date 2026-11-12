"""Report Generation & Download API Routes (Section 24)."""

import datetime as dt
import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..auth.security import get_current_user
from ..config import get_settings
from ..db.database import get_db
from ..db.models import Membrane, Profile, Project, Report
from ..projects.router import (
    _get_owned_project,
    _load_membrane_catalog_dict,
    _recompute_project_design,
    serialize_project_detail,
)
from .csv_exporter import generate_engineering_csv
from .pdf_generator import generate_engineering_pdf

router = APIRouter(prefix="/api/reports", tags=["Reports"])


def _ensure_project_design(project: Project, db: Session):
    design = _recompute_project_design(project, db)
    if design is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project design must have Feed Analysis and Equipment Design (membrane & flux) completed before generating a report.",
        )
    db.commit()
    db.refresh(project)
    return design


@router.get("/project/{project_id}")
def list_project_reports(
    project_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, current_user, db)
    return {
        "reports": [
            {
                "id": r.id,
                "report_name": r.report_name,
                "report_format": r.report_format,
                "generated_at": r.generated_at.isoformat() if r.generated_at else None,
            }
            for r in project.reports
        ]
    }


@router.post("/project/{project_id}/pdf")
def generate_and_download_pdf(
    project_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate the 12-section COW PRO engineering PDF report and stream it for download."""
    project = _get_owned_project(project_id, current_user, db)
    design = _ensure_project_design(project, db)
    project_dict = serialize_project_detail(project)

    mem_ids = {s["membrane_id"] for s in design.get("loop_sizings", [])}
    all_mem = _load_membrane_catalog_dict(db)
    used_mem = {mid: all_mem[mid] for mid in mem_ids if mid in all_mem}

    settings = get_settings()
    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"{project.project_code}_Engineering_Report_{timestamp}.pdf"
    out_path = Path(settings.reports_dir) / filename

    generate_engineering_pdf(out_path, project_dict, design, used_mem)

    latest_sim_id = project.simulations[0].id if project.simulations else None
    report_row = Report(
        project_id=project.id,
        simulation_id=latest_sim_id,
        report_name=filename,
        file_path=str(out_path),
        report_format="PDF",
    )
    db.add(report_row)
    # Only promote to Report Generated when validation passed; otherwise preserve Validation Required!
    if design.get("validation", {}).get("can_mark_validated"):
        project.status = "Report Generated"
    db.commit()

    return FileResponse(
        path=str(out_path),
        media_type="application/pdf",
        filename=filename,
    )


@router.get("/project/{project_id}/csv")
def download_csv_report(
    project_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export calculated engineering parameters as CSV."""
    project = _get_owned_project(project_id, current_user, db)
    design = _ensure_project_design(project, db)
    project_dict = serialize_project_detail(project)
    csv_text = generate_engineering_csv(project_dict, design)
    filename = f"{project.project_code}_Calculations.csv"
    return Response(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/project/{project_id}/json")
def download_json_report(
    project_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download complete project JSON bundle."""
    project = _get_owned_project(project_id, current_user, db)
    payload = {
        "schema_version": "cowpro-project-v1",
        "exported_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "project": serialize_project_detail(project),
    }
    filename = f"{project.project_code}_Project.json"
    return Response(
        content=json.dumps(payload, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
