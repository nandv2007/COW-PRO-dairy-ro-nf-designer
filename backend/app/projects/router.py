"""Project Management, Module 1 & Module 2 Design, Simulation & JSON I/O API Routes."""

import datetime as dt
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.security import get_current_user
from ..db.database import get_db
from ..db.models import (
    ConcentrationDesign,
    FeedComposition,
    FeedConditions,
    LoopDesign,
    Membrane,
    Profile,
    Project,
    Simulation,
)
from ..db.seed import create_demo_project_for_user
from ..engine.composition import evaluate_composition
from ..engine.concentration import evaluate_concentration
from ..engine.feed import calculate_feed_flow
from ..engine.loops import select_and_balance_loops
from ..engine.orchestrator import LoopConfigInput, run_full_design_pipeline
from ..engine.simulation import evaluate_level2_readiness
from ..engine.types import (
    CompositionInput,
    FeedConditionsInput,
    MilkType,
    ProcessType,
    ValueSource,
    VerificationStatus,
)
from .schemas import (
    EquipmentDesignSaveRequest,
    FeedAnalysisSaveRequest,
    ProjectCreateRequest,
    ProjectImportRequest,
    ProjectUpdateRequest,
    SimulationRunRequest,
)

router = APIRouter(prefix="/api/projects", tags=["Projects"])


def _get_owned_project(project_id: str, user: Profile, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    if project.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this project.",
        )
    return project


def _load_membrane_catalog_dict(db: Session) -> Dict[int, Dict[str, Any]]:
    return {
        m.id: {
            "id": m.id,
            "manufacturer": m.manufacturer,
            "model": m.model,
            "full_model_number": m.full_model_number,
            "process_type": m.process_type,
            "nominal_size": m.nominal_size,
            "membrane_area": m.membrane_area,
            "verification_status": m.verification_status,
            "notes": m.notes,
            "max_temperature": m.max_temperature,
            "max_pressure": m.max_pressure,
            "operating_ph_min": m.operating_ph_min,
            "operating_ph_max": m.operating_ph_max,
            "max_pressure_drop": m.max_pressure_drop,
            "max_feed_flow": m.max_feed_flow,
            "salt_rejection": m.salt_rejection,
            "mineral_rejection": m.mineral_rejection,
            "datasheet_url": m.datasheet_url,
        }
        for m in db.query(Membrane).all()
    }


def serialize_project_summary(p: Project) -> Dict[str, Any]:
    conc = p.concentration_design
    active_loops = conc.selected_loops if conc else None
    config_label = (
        "Two Loops"
        if active_loops == 2
        else ("Single Loop" if active_loops == 1 else "Not Configured")
    )
    return {
        "id": p.id,
        "project_code": p.project_code,
        "project_name": p.project_name,
        "description": p.description,
        "customer_organization": p.customer_organization,
        "project_location": p.project_location,
        "design_engineer": p.design_engineer,
        "process_type": p.process_type,
        "milk_type": p.milk_type,
        "status": p.status,
        "concentration_factor": conc.concentration_factor if conc else None,
        "configuration": config_label,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def serialize_project_detail(p: Project) -> Dict[str, Any]:
    latest_sim = p.simulations[0] if p.simulations else None
    return {
        **serialize_project_summary(p),
        "hydraulics_config": p.hydraulics_config or {},
        "feed_composition": (
            {
                "milk_type": p.feed_composition.milk_type,
                "input_mode": p.feed_composition.input_mode,
                "fat_percentage": p.feed_composition.fat_percentage,
                "snf_percentage": p.feed_composition.snf_percentage,
                "total_solids_percentage": p.feed_composition.total_solids_percentage,
                "protein_percentage": p.feed_composition.protein_percentage,
                "lactose_percentage": p.feed_composition.lactose_percentage,
                "ash_percentage": p.feed_composition.ash_percentage,
                "other_solids_percentage": p.feed_composition.other_solids_percentage,
                "individual_minerals": p.feed_composition.individual_minerals,
                "ash_design_supplied": p.feed_composition.ash_design_supplied,
                "composition_basis": p.feed_composition.composition_basis,
                "value_sources": p.feed_composition.value_sources,
            }
            if p.feed_composition
            else None
        ),
        "feed_conditions": (
            {
                "flow_input_method": p.feed_conditions.flow_input_method,
                "feed_flow": p.feed_conditions.feed_flow,
                "feed_flow_unit": p.feed_conditions.feed_flow_unit,
                "processing_capacity": p.feed_conditions.processing_capacity,
                "capacity_unit": p.feed_conditions.capacity_unit,
                "operating_time": p.feed_conditions.operating_time,
                "temperature": p.feed_conditions.temperature,
                "ph": p.feed_conditions.ph,
                "density": p.feed_conditions.density,
                "viscosity": p.feed_conditions.viscosity,
                "conductivity": p.feed_conditions.conductivity,
            }
            if p.feed_conditions
            else None
        ),
        "concentration_design": (
            {
                "target_basis": p.concentration_design.target_basis,
                "initial_percentage": p.concentration_design.initial_percentage,
                "target_percentage": p.concentration_design.target_percentage,
                "concentration_factor": p.concentration_design.concentration_factor,
                "permeate_removal": p.concentration_design.permeate_removal,
                "total_permeate_volume": p.concentration_design.total_permeate_volume,
                "final_retentate_flow": p.concentration_design.final_retentate_flow,
                "selected_loops": p.concentration_design.selected_loops,
            }
            if p.concentration_design
            else None
        ),
        "loop_designs": [
            {
                "loop_number": ld.loop_number,
                "is_active": ld.is_active,
                "feed_flow": ld.feed_flow,
                "permeate_flow": ld.permeate_flow,
                "retentate_flow": ld.retentate_flow,
                "membrane_id": ld.membrane_id,
                "membrane_flux": ld.membrane_flux,
                "flux_source": ld.flux_source,
                "membrane_count": ld.membrane_count,
                "installed_area": ld.installed_area,
                "housing_count": ld.housing_count,
                "elements_per_housing": ld.elements_per_housing,
                "housing_type": ld.housing_type,
                "housing_pressure_rating": ld.housing_pressure_rating,
                "max_elements_per_housing": ld.max_elements_per_housing,
                "max_housing_feed_flow": ld.max_housing_feed_flow,
                "max_housing_pressure_drop": ld.max_housing_pressure_drop,
                "recirculation_flow": ld.recirculation_flow,
                "inlet_pressure": ld.inlet_pressure,
                "retentate_pressure": ld.retentate_pressure,
                "permeate_pressure": ld.permeate_pressure,
                "pump_efficiency": ld.pump_efficiency,
            }
            for ld in sorted(p.loop_designs, key=lambda x: x.loop_number)
        ],
        "latest_simulation": (
            {
                "id": latest_sim.id,
                "simulation_type": latest_sim.simulation_type,
                "validation_status": latest_sim.validation_status,
                "result_snapshot": latest_sim.result_snapshot,
                "created_at": latest_sim.created_at.isoformat() if latest_sim.created_at else None,
            }
            if latest_sim
            else None
        ),
        "reports": [
            {
                "id": r.id,
                "report_name": r.report_name,
                "report_format": r.report_format,
                "generated_at": r.generated_at.isoformat() if r.generated_at else None,
            }
            for r in p.reports
        ],
    }


def _recompute_project_design(project: Project, db: Session) -> Optional[Dict[str, Any]]:
    """Run full centralized design pipeline if Feed Analysis + Loop Designs are populated."""
    if not (project.feed_composition and project.feed_conditions and project.concentration_design):
        return None
    if not project.loop_designs:
        return None

    membranes = _load_membrane_catalog_dict(db)
    comp = project.feed_composition
    cond = project.feed_conditions
    conc = project.concentration_design

    comp_input = CompositionInput(
        milk_type=MilkType(comp.milk_type),
        fat_percentage=comp.fat_percentage,
        input_mode=comp.input_mode,  # type: ignore[arg-type]
        snf_percentage=comp.snf_percentage if comp.input_mode == "SNF" else None,
        total_solids_percentage=comp.total_solids_percentage if comp.input_mode == "Total Solids" else None,
        protein_percentage=comp.protein_percentage,
        lactose_percentage=comp.lactose_percentage,
        ash_percentage=comp.ash_percentage,
        other_solids_percentage=comp.other_solids_percentage,
        individual_minerals=comp.individual_minerals or {},
        ash_design_supplied=comp.ash_design_supplied,
        composition_basis=comp.composition_basis,
        value_sources={k: ValueSource(v) for k, v in (comp.value_sources or {}).items() if v in ValueSource._value2member_map_},
    )
    feed_input = FeedConditionsInput(
        flow_input_method=cond.flow_input_method,  # type: ignore[arg-type]
        feed_flow=cond.feed_flow if cond.flow_input_method == "direct" else None,
        feed_flow_unit=cond.feed_flow_unit,  # type: ignore[arg-type]
        processing_capacity=cond.processing_capacity,
        capacity_unit=(cond.capacity_unit or "L"),  # type: ignore[arg-type]
        operating_time=cond.operating_time,
        temperature=cond.temperature,
        ph=cond.ph,
        density=cond.density,
        viscosity=cond.viscosity,
        conductivity=cond.conductivity,
    )

    loop_configs: Dict[int, LoopConfigInput] = {}
    for ld in project.loop_designs:
        if ld.is_active and ld.membrane_id and ld.membrane_flux:
            loop_configs[ld.loop_number] = LoopConfigInput(
                loop_number=ld.loop_number,
                membrane_id=ld.membrane_id,
                design_flux_lmh=ld.membrane_flux,
                flux_source=VerificationStatus(ld.flux_source)
                if ld.flux_source in VerificationStatus._value2member_map_
                else VerificationStatus.USER_SUPPLIED,
                elements_per_housing=ld.elements_per_housing or 1,
                housing_type=ld.housing_type,
                housing_pressure_rating_bar=ld.housing_pressure_rating,
                max_elements_per_housing=ld.max_elements_per_housing,
                max_housing_feed_flow_lh=ld.max_housing_feed_flow,
                max_housing_pressure_drop_bar=ld.max_housing_pressure_drop,
                recirculation_flow_lh=ld.recirculation_flow,
                inlet_pressure_bar=ld.inlet_pressure,
                retentate_pressure_bar=ld.retentate_pressure,
                permeate_pressure_bar=ld.permeate_pressure,
                pump_efficiency=ld.pump_efficiency,
            )

    if 1 not in loop_configs:
        return None

    hyd_cfg = project.hydraulics_config or {}
    design = run_full_design_pipeline(
        process_type=ProcessType(project.process_type),
        composition_input=comp_input,
        feed_input=feed_input,
        target_basis=conc.target_basis,
        target_percentage=conc.target_percentage,
        loop_configs=loop_configs,
        membrane_records=membranes,
        feed_pump_diff_pressure_bar=hyd_cfg.get("feed_pump_diff_pressure_bar"),
        feed_pump_efficiency=hyd_cfg.get("feed_pump_efficiency"),
    )

    # Sync computed loop design values
    sizing_by_loop = {s.loop_number: s for s in design.loop_sizings}
    flow_map = {
        1: (design.loops.loop1_feed_flow_lh, design.loops.loop1_permeate_flow_lh, design.loops.loop1_retentate_flow_lh, design.loops.loop1_active),
        2: (design.loops.loop2_feed_flow_lh, design.loops.loop2_permeate_flow_lh, design.loops.loop2_retentate_flow_lh, design.loops.loop2_active),
    }
    for ld in project.loop_designs:
        f_val, p_val, r_val, act_val = flow_map[ld.loop_number]
        ld.is_active = act_val
        ld.feed_flow = f_val
        ld.permeate_flow = p_val
        ld.retentate_flow = r_val
        s = sizing_by_loop.get(ld.loop_number)
        if s and act_val:
            ld.membrane_count = s.membrane_count
            ld.installed_area = s.installed_area_m2
            ld.housing_count = s.housing_count
        elif not act_val:
            ld.membrane_count = 0
            ld.installed_area = 0.0
            ld.housing_count = 0

    if design.validation.can_mark_validated:
        project.status = "Validated"
    else:
        project.status = "Validation Required"

    sim = Simulation(
        project_id=project.id,
        simulation_type="Level 1",
        input_snapshot={
            "process_type": project.process_type,
            "feed_flow_lh": design.feed.feed_flow_lh,
            "concentration_factor": design.concentration.concentration_factor,
            "loops": [cfg.model_dump() for cfg in loop_configs.values()],
        },
        result_snapshot=design.model_dump(mode="json"),
        validation_status=design.validation.overall_status.value,
    )
    db.add(sim)
    return design.model_dump(mode="json")


@router.get("/dashboard/summary")
def dashboard_summary(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return dashboard counts and recent projects for the authenticated user."""
    projects = (
        db.query(Project)
        .filter(Project.user_id == current_user.id)
        .order_by(Project.updated_at.desc())
        .all()
    )
    total_projects = len(projects)
    completed_designs = sum(
        1 for p in projects if p.status in ("Design Calculated", "Validation Required", "Validated", "Report Generated")
    )
    draft_designs = sum(1 for p in projects if p.status in ("Draft", "Input Complete"))
    recent_simulations = sum(len(p.simulations) for p in projects)

    return {
        "summary": {
            "total_projects": total_projects,
            "completed_designs": completed_designs,
            "draft_designs": draft_designs,
            "recent_simulations": recent_simulations,
        },
        "recent_projects": [serialize_project_summary(p) for p in projects],
    }


@router.get("")
def list_projects(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    projects = (
        db.query(Project)
        .filter(Project.user_id == current_user.id)
        .order_by(Project.updated_at.desc())
        .all()
    )
    return {"projects": [serialize_project_summary(p) for p in projects]}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreateRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new engineering project and save immediately as Draft (Section 6)."""
    year = dt.datetime.now(dt.timezone.utc).year
    code = f"COW-{year}-{uuid.uuid4().hex[:6].upper()}"
    project = Project(
        project_code=code,
        user_id=current_user.id,
        project_name=payload.project_name.strip(),
        description=payload.description.strip(),
        customer_organization=payload.customer_organization.strip() if payload.customer_organization else None,
        project_location=payload.project_location.strip() if payload.project_location else None,
        design_engineer=(payload.design_engineer.strip() if payload.design_engineer else current_user.full_name),
        process_type=payload.process_type.value,
        milk_type=payload.milk_type.value,
        status="Draft",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return {"project": serialize_project_detail(project)}


@router.post("/demo", status_code=status.HTTP_201_CREATED)
def load_demo_project(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a fresh copy of the Section 27 Demonstration Project for the current user."""
    project = create_demo_project_for_user(db, current_user.id, current_user.full_name)
    return {"project": serialize_project_detail(project)}


@router.get("/{project_id}")
def get_project(
    project_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, current_user, db)
    return {"project": serialize_project_detail(project)}


@router.patch("/{project_id}")
def update_project(
    project_id: str,
    payload: ProjectUpdateRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, current_user, db)
    if payload.project_name is not None:
        project.project_name = payload.project_name.strip()
    if payload.description is not None:
        project.description = payload.description.strip()
    if payload.customer_organization is not None:
        project.customer_organization = payload.customer_organization.strip() or None
    if payload.project_location is not None:
        project.project_location = payload.project_location.strip() or None
    if payload.design_engineer is not None:
        project.design_engineer = payload.design_engineer.strip() or None
    if payload.process_type is not None:
        project.process_type = payload.process_type.value
    if payload.milk_type is not None:
        project.milk_type = payload.milk_type.value

    project.updated_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    db.refresh(project)
    return {"project": serialize_project_detail(project)}


@router.post("/{project_id}/duplicate", status_code=status.HTTP_201_CREATED)
def duplicate_project(
    project_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    src = _get_owned_project(project_id, current_user, db)
    year = dt.datetime.now(dt.timezone.utc).year
    copy_proj = Project(
        project_code=f"COW-{year}-{uuid.uuid4().hex[:6].upper()}",
        user_id=current_user.id,
        project_name=f"{src.project_name} (Copy)",
        description=src.description,
        customer_organization=src.customer_organization,
        project_location=src.project_location,
        design_engineer=src.design_engineer,
        process_type=src.process_type,
        milk_type=src.milk_type,
        status=src.status if src.status != "Report Generated" else "Validation Required",
        hydraulics_config=dict(src.hydraulics_config or {}),
    )
    db.add(copy_proj)
    db.flush()

    if src.feed_composition:
        fc = src.feed_composition
        db.add(
            FeedComposition(
                project_id=copy_proj.id,
                milk_type=fc.milk_type,
                input_mode=fc.input_mode,
                fat_percentage=fc.fat_percentage,
                snf_percentage=fc.snf_percentage,
                total_solids_percentage=fc.total_solids_percentage,
                protein_percentage=fc.protein_percentage,
                lactose_percentage=fc.lactose_percentage,
                ash_percentage=fc.ash_percentage,
                other_solids_percentage=fc.other_solids_percentage,
                individual_minerals=dict(fc.individual_minerals or {}),
                ash_design_supplied=fc.ash_design_supplied,
                composition_basis=fc.composition_basis,
                value_sources=dict(fc.value_sources or {}),
            )
        )
    if src.feed_conditions:
        cond = src.feed_conditions
        db.add(
            FeedConditions(
                project_id=copy_proj.id,
                flow_input_method=cond.flow_input_method,
                feed_flow=cond.feed_flow,
                feed_flow_unit=cond.feed_flow_unit,
                processing_capacity=cond.processing_capacity,
                capacity_unit=cond.capacity_unit,
                operating_time=cond.operating_time,
                temperature=cond.temperature,
                ph=cond.ph,
                density=cond.density,
                viscosity=cond.viscosity,
                conductivity=cond.conductivity,
            )
        )
    if src.concentration_design:
        cd = src.concentration_design
        db.add(
            ConcentrationDesign(
                project_id=copy_proj.id,
                target_basis=cd.target_basis,
                initial_percentage=cd.initial_percentage,
                target_percentage=cd.target_percentage,
                concentration_factor=cd.concentration_factor,
                permeate_removal=cd.permeate_removal,
                total_permeate_volume=cd.total_permeate_volume,
                final_retentate_flow=cd.final_retentate_flow,
                selected_loops=cd.selected_loops,
            )
        )
    for ld in src.loop_designs:
        db.add(
            LoopDesign(
                project_id=copy_proj.id,
                loop_number=ld.loop_number,
                is_active=ld.is_active,
                feed_flow=ld.feed_flow,
                permeate_flow=ld.permeate_flow,
                retentate_flow=ld.retentate_flow,
                membrane_id=ld.membrane_id,
                membrane_flux=ld.membrane_flux,
                flux_source=ld.flux_source,
                membrane_count=ld.membrane_count,
                installed_area=ld.installed_area,
                housing_count=ld.housing_count,
                elements_per_housing=ld.elements_per_housing,
                housing_type=ld.housing_type,
                housing_pressure_rating=ld.housing_pressure_rating,
                max_elements_per_housing=ld.max_elements_per_housing,
                max_housing_feed_flow=ld.max_housing_feed_flow,
                max_housing_pressure_drop=ld.max_housing_pressure_drop,
                recirculation_flow=ld.recirculation_flow,
                inlet_pressure=ld.inlet_pressure,
                retentate_pressure=ld.retentate_pressure,
                permeate_pressure=ld.permeate_pressure,
                pump_efficiency=ld.pump_efficiency,
            )
        )
    if src.simulations:
        latest = src.simulations[0]
        db.add(
            Simulation(
                project_id=copy_proj.id,
                simulation_type=latest.simulation_type,
                input_snapshot=latest.input_snapshot,
                result_snapshot=latest.result_snapshot,
                validation_status=latest.validation_status,
            )
        )

    db.commit()
    db.refresh(copy_proj)
    return {"project": serialize_project_detail(copy_proj)}


@router.delete("/{project_id}")
def delete_project(
    project_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, current_user, db)
    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully.", "id": project_id}


@router.put("/{project_id}/feed-analysis")
def save_feed_analysis(
    project_id: str,
    payload: FeedAnalysisSaveRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Validate and save Module 1 (Composition -> Feed -> Final Concentration) and compute loops."""
    project = _get_owned_project(project_id, current_user, db)

    try:
        comp_res = evaluate_composition(
            CompositionInput(
                milk_type=payload.milk_type,
                fat_percentage=payload.fat_percentage,
                input_mode=payload.input_mode,
                snf_percentage=payload.snf_percentage,
                total_solids_percentage=payload.total_solids_percentage,
                protein_percentage=payload.protein_percentage,
                lactose_percentage=payload.lactose_percentage,
                ash_percentage=payload.ash_percentage,
                other_solids_percentage=payload.other_solids_percentage,
                individual_minerals=payload.individual_minerals,
                ash_design_supplied=payload.ash_design_supplied,
                composition_basis=payload.composition_basis,
                value_sources=payload.value_sources,
            )
        )
        feed_res = calculate_feed_flow(
            FeedConditionsInput(
                flow_input_method=payload.flow_input_method,
                feed_flow=payload.feed_flow,
                feed_flow_unit=payload.feed_flow_unit,
                processing_capacity=payload.processing_capacity,
                capacity_unit=payload.capacity_unit,
                operating_time=payload.operating_time,
                temperature=payload.temperature,
                ph=payload.ph,
                density=payload.density,
                viscosity=payload.viscosity,
                conductivity=payload.conductivity,
            )
        )
        from ..engine.types import ConcentrationInput

        conc_res = evaluate_concentration(
            ConcentrationInput(
                target_basis=payload.target_basis,
                initial_snf_percentage=comp_res.snf_percentage,
                initial_total_solids_percentage=comp_res.total_solids_percentage,
                target_percentage=payload.target_percentage,
                feed_flow_lh=feed_res.feed_flow_lh,
                operating_time_hours=feed_res.operating_time_hours,
            )
        )
        loop_res = select_and_balance_loops(
            feed_flow_lh=feed_res.feed_flow_lh,
            concentration_factor=conc_res.concentration_factor,
            total_permeate_removal_lh=conc_res.total_permeate_removal_lh,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    # Upsert feed_composition
    fc = project.feed_composition or FeedComposition(project_id=project.id)
    fc.milk_type = payload.milk_type.value
    fc.input_mode = payload.input_mode
    fc.fat_percentage = comp_res.fat_percentage
    fc.snf_percentage = comp_res.snf_percentage
    fc.total_solids_percentage = comp_res.total_solids_percentage
    fc.protein_percentage = comp_res.protein_percentage
    fc.lactose_percentage = comp_res.lactose_percentage
    fc.ash_percentage = comp_res.ash_percentage
    fc.other_solids_percentage = comp_res.other_solids_percentage
    fc.individual_minerals = comp_res.individual_minerals
    fc.ash_design_supplied = comp_res.ash_restriction_active
    fc.composition_basis = comp_res.composition_basis
    fc.value_sources = comp_res.value_sources
    db.add(fc)

    # Upsert feed_conditions (always persist normalized L/h or entered values + unit)
    cond = project.feed_conditions or FeedConditions(project_id=project.id)
    cond.flow_input_method = payload.flow_input_method
    cond.feed_flow = feed_res.feed_flow_lh
    cond.feed_flow_unit = "L/h"
    cond.processing_capacity = payload.processing_capacity
    cond.capacity_unit = payload.capacity_unit
    cond.operating_time = payload.operating_time
    cond.temperature = payload.temperature
    cond.ph = payload.ph
    cond.density = payload.density
    cond.viscosity = payload.viscosity
    cond.conductivity = payload.conductivity
    db.add(cond)

    # Upsert concentration_design
    cd = project.concentration_design or ConcentrationDesign(project_id=project.id)
    cd.target_basis = conc_res.target_basis
    cd.initial_percentage = conc_res.initial_percentage
    cd.target_percentage = conc_res.target_percentage
    cd.concentration_factor = conc_res.concentration_factor
    cd.permeate_removal = conc_res.total_permeate_removal_lh
    cd.total_permeate_volume = conc_res.total_permeate_volume_l
    cd.final_retentate_flow = conc_res.final_retentate_flow_lh
    cd.selected_loops = loop_res.active_loops
    db.add(cd)

    # Sync preliminary loop flows while keeping existing membrane/flux selections if present
    existing_loops = {ld.loop_number: ld for ld in project.loop_designs}
    loop_flow_tuples = {
        1: (loop_res.loop1_feed_flow_lh, loop_res.loop1_permeate_flow_lh, loop_res.loop1_retentate_flow_lh, loop_res.loop1_active),
        2: (loop_res.loop2_feed_flow_lh, loop_res.loop2_permeate_flow_lh, loop_res.loop2_retentate_flow_lh, loop_res.loop2_active),
    }
    for loop_num, (ff, pf, rf, act) in loop_flow_tuples.items():
        ld = existing_loops.get(loop_num) or LoopDesign(project_id=project.id, loop_number=loop_num)
        ld.is_active = act
        ld.feed_flow = ff
        ld.permeate_flow = pf
        ld.retentate_flow = rf
        if not act:
            ld.membrane_count = 0
            ld.installed_area = 0.0
            ld.housing_count = 0
        db.add(ld)

    project.milk_type = payload.milk_type.value
    project.status = "Input Complete"
    project.updated_at = dt.datetime.now(dt.timezone.utc)
    db.flush()
    db.refresh(project)

    # If user already had membrane+flux configured, automatically cascade upstream changes!
    recomputed = None
    if any(ld.membrane_id and ld.membrane_flux for ld in project.loop_designs):
        recomputed = _recompute_project_design(project, db)

    db.commit()
    db.refresh(project)
    return {
        "project": serialize_project_detail(project),
        "composition": comp_res.model_dump(mode="json"),
        "feed": feed_res.model_dump(mode="json"),
        "concentration": conc_res.model_dump(mode="json"),
        "loops": loop_res.model_dump(mode="json"),
        "design": recomputed,
    }


@router.put("/{project_id}/equipment-design")
def save_equipment_design(
    project_id: str,
    payload: EquipmentDesignSaveRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save membrane selection, design flux, housings & hydraulics and run Module 2 design."""
    project = _get_owned_project(project_id, current_user, db)
    if not (project.feed_composition and project.feed_conditions and project.concentration_design):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please complete Module 1 (Feed Analysis) before configuring Equipment Design.",
        )

    membranes = _load_membrane_catalog_dict(db)
    ash_restricted = bool(project.feed_composition.ash_design_supplied)

    for loop_in in payload.loops:
        mem = membranes.get(loop_in.membrane_id)
        if not mem:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Membrane ID {loop_in.membrane_id} does not exist.",
            )
        if ash_restricted and mem["process_type"] != "NF":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Cannot select RO membrane '{mem['model']}' when ash/mineral properties are supplied. "
                    "COW PRO Version 1 restricts ash/mineral separation design to NF membranes."
                ),
            )
        if mem["process_type"] != project.process_type:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Membrane '{mem['model']}' ({mem['process_type']}) does not match project process "
                    f"({project.process_type})."
                ),
            )

    existing_loops = {ld.loop_number: ld for ld in project.loop_designs}
    for loop_in in payload.loops:
        ld = existing_loops.get(loop_in.loop_number) or LoopDesign(
            project_id=project.id, loop_number=loop_in.loop_number
        )
        ld.membrane_id = loop_in.membrane_id
        ld.membrane_flux = loop_in.design_flux_lmh
        ld.flux_source = loop_in.flux_source.value
        ld.elements_per_housing = loop_in.elements_per_housing
        ld.housing_type = loop_in.housing_type
        ld.housing_pressure_rating = loop_in.housing_pressure_rating_bar
        ld.max_elements_per_housing = loop_in.max_elements_per_housing
        ld.max_housing_feed_flow = loop_in.max_housing_feed_flow_lh
        ld.max_housing_pressure_drop = loop_in.max_housing_pressure_drop_bar
        ld.recirculation_flow = loop_in.recirculation_flow_lh
        ld.inlet_pressure = loop_in.inlet_pressure_bar
        ld.retentate_pressure = loop_in.retentate_pressure_bar
        ld.permeate_pressure = loop_in.permeate_pressure_bar
        ld.pump_efficiency = loop_in.pump_efficiency
        db.add(ld)

    project.hydraulics_config = {
        "feed_pump_diff_pressure_bar": payload.feed_pump_diff_pressure_bar,
        "feed_pump_efficiency": payload.feed_pump_efficiency,
    }
    project.updated_at = dt.datetime.now(dt.timezone.utc)
    db.flush()
    db.refresh(project)

    try:
        design = _recompute_project_design(project, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    db.commit()
    db.refresh(project)
    return {"project": serialize_project_detail(project), "design": design}


@router.post("/{project_id}/simulate")
def run_simulation(
    project_id: str,
    payload: SimulationRunRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run Level 1 Preliminary Design Simulation or return Level 2 readiness guard."""
    project = _get_owned_project(project_id, current_user, db)

    if payload.simulation_level == "Level 2":
        membranes = _load_membrane_catalog_dict(db)
        used = {
            ld.membrane_id: membranes[ld.membrane_id]
            for ld in project.loop_designs
            if ld.is_active and ld.membrane_id in membranes
        }
        comp_res = None
        if project.feed_composition:
            fc = project.feed_composition
            comp_res = evaluate_composition(
                CompositionInput(
                    milk_type=MilkType(fc.milk_type),
                    fat_percentage=fc.fat_percentage,
                    input_mode=fc.input_mode,  # type: ignore[arg-type]
                    snf_percentage=fc.snf_percentage if fc.input_mode == "SNF" else None,
                    total_solids_percentage=fc.total_solids_percentage if fc.input_mode == "Total Solids" else None,
                    protein_percentage=fc.protein_percentage,
                    lactose_percentage=fc.lactose_percentage,
                    ash_percentage=fc.ash_percentage,
                    other_solids_percentage=fc.other_solids_percentage,
                    individual_minerals=fc.individual_minerals or {},
                    ash_design_supplied=fc.ash_design_supplied,
                )
            )
        readiness = evaluate_level2_readiness(comp_res, used, [])
        return {"simulation_level": "Level 2", "level2_readiness": readiness.model_dump(mode="json")}

    design = _recompute_project_design(project, db)
    if design is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete Feed Analysis and Equipment Design (membrane & flux) before running simulation.",
        )
    db.commit()
    db.refresh(project)
    return {"simulation_level": "Level 1", "project": serialize_project_detail(project), "design": design}


@router.get("/{project_id}/export/json")
def export_project_json(
    project_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export complete project specification and simulation snapshot as structured JSON."""
    project = _get_owned_project(project_id, current_user, db)
    return {
        "schema_version": "cowpro-project-v1",
        "exported_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "project": serialize_project_detail(project),
    }


@router.post("/import/json", status_code=status.HTTP_201_CREATED)
def import_project_json(
    payload: ProjectImportRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Import a COW PRO JSON project file into the authenticated user's workspace."""
    raw = payload.data.get("project") if "project" in payload.data else payload.data
    if not isinstance(raw, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid COW PRO project JSON.")

    year = dt.datetime.now(dt.timezone.utc).year
    proj = Project(
        project_code=f"COW-{year}-{uuid.uuid4().hex[:6].upper()}",
        user_id=current_user.id,
        project_name=(payload.project_name or f"{raw.get('project_name', 'Imported Project')} (Imported)").strip(),
        description=raw.get("description", ""),
        customer_organization=raw.get("customer_organization"),
        project_location=raw.get("project_location"),
        design_engineer=raw.get("design_engineer") or current_user.full_name,
        process_type=raw.get("process_type", "NF"),
        milk_type=raw.get("milk_type", "Custom Milk"),
        status="Draft",
        hydraulics_config=raw.get("hydraulics_config") or {},
    )
    db.add(proj)
    db.flush()

    fc = raw.get("feed_composition")
    if isinstance(fc, dict):
        db.add(
            FeedComposition(
                project_id=proj.id,
                milk_type=fc.get("milk_type", proj.milk_type),
                input_mode=fc.get("input_mode", "SNF"),
                fat_percentage=fc["fat_percentage"],
                snf_percentage=fc["snf_percentage"],
                total_solids_percentage=fc["total_solids_percentage"],
                protein_percentage=fc.get("protein_percentage"),
                lactose_percentage=fc.get("lactose_percentage"),
                ash_percentage=fc.get("ash_percentage"),
                other_solids_percentage=fc.get("other_solids_percentage"),
                individual_minerals=fc.get("individual_minerals") or {},
                ash_design_supplied=bool(fc.get("ash_design_supplied", False)),
                composition_basis=fc.get("composition_basis", "% w/w (mass basis)"),
                value_sources=fc.get("value_sources") or {},
            )
        )

    cond = raw.get("feed_conditions")
    if isinstance(cond, dict):
        db.add(
            FeedConditions(
                project_id=proj.id,
                flow_input_method=cond.get("flow_input_method", "direct"),
                feed_flow=cond["feed_flow"],
                feed_flow_unit=cond.get("feed_flow_unit", "L/h"),
                processing_capacity=cond.get("processing_capacity"),
                capacity_unit=cond.get("capacity_unit"),
                operating_time=cond.get("operating_time"),
                temperature=cond.get("temperature", 10.0),
                ph=cond.get("ph"),
                density=cond.get("density"),
                viscosity=cond.get("viscosity"),
                conductivity=cond.get("conductivity"),
            )
        )

    cd = raw.get("concentration_design")
    if isinstance(cd, dict):
        db.add(
            ConcentrationDesign(
                project_id=proj.id,
                target_basis=cd.get("target_basis", "SNF"),
                initial_percentage=cd["initial_percentage"],
                target_percentage=cd["target_percentage"],
                concentration_factor=cd["concentration_factor"],
                permeate_removal=cd["permeate_removal"],
                total_permeate_volume=cd.get("total_permeate_volume"),
                final_retentate_flow=cd["final_retentate_flow"],
                selected_loops=cd.get("selected_loops", 1),
            )
        )

    for ld in raw.get("loop_designs") or []:
        if isinstance(ld, dict):
            db.add(
                LoopDesign(
                    project_id=proj.id,
                    loop_number=ld["loop_number"],
                    is_active=bool(ld.get("is_active", True)),
                    feed_flow=ld.get("feed_flow", 0.0),
                    permeate_flow=ld.get("permeate_flow", 0.0),
                    retentate_flow=ld.get("retentate_flow", 0.0),
                    membrane_id=ld.get("membrane_id"),
                    membrane_flux=ld.get("membrane_flux"),
                    flux_source=ld.get("flux_source", "User Supplied"),
                    membrane_count=ld.get("membrane_count", 0),
                    installed_area=ld.get("installed_area", 0.0),
                    housing_count=ld.get("housing_count", 0),
                    elements_per_housing=ld.get("elements_per_housing", 1),
                    housing_type=ld.get("housing_type"),
                    housing_pressure_rating=ld.get("housing_pressure_rating"),
                    max_elements_per_housing=ld.get("max_elements_per_housing"),
                    max_housing_feed_flow=ld.get("max_housing_feed_flow"),
                    max_housing_pressure_drop=ld.get("max_housing_pressure_drop"),
                    recirculation_flow=ld.get("recirculation_flow"),
                    inlet_pressure=ld.get("inlet_pressure"),
                    retentate_pressure=ld.get("retentate_pressure"),
                    permeate_pressure=ld.get("permeate_pressure"),
                    pump_efficiency=ld.get("pump_efficiency"),
                )
            )

    db.flush()
    db.refresh(proj)
    _recompute_project_design(proj, db)
    db.commit()
    db.refresh(proj)
    return {"project": serialize_project_detail(proj)}
