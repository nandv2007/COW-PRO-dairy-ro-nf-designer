"""Membrane Catalog & Property Verification API Routes (Sections 13–15)."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth.security import get_current_user
from ..db.database import get_db
from ..db.models import Membrane, MembraneProperty, Profile
from ..engine.composition import ASH_RULE_EXPLANATION
from ..engine.types import VerificationStatus

router = APIRouter(prefix="/api/membranes", tags=["Membranes"])


class MembranePropertyUpdate(BaseModel):
    property_name: str
    property_value: Optional[str] = None
    property_unit: Optional[str] = None
    data_source: Optional[str] = None
    verification_status: VerificationStatus = VerificationStatus.USER_SUPPLIED


class MembraneUpdateRequest(BaseModel):
    manufacturer: Optional[str] = None
    full_model_number: Optional[str] = None
    membrane_material: Optional[str] = None
    feed_spacer_thickness: Optional[float] = Field(default=None, gt=0)
    mwco: Optional[str] = None
    design_flux: Optional[float] = Field(default=None, gt=0)
    max_pressure: Optional[float] = Field(default=None, gt=0)
    max_temperature: Optional[float] = Field(default=None, gt=0)
    operating_ph_min: Optional[float] = Field(default=None, ge=0, le=14)
    operating_ph_max: Optional[float] = Field(default=None, ge=0, le=14)
    cleaning_ph_min: Optional[float] = Field(default=None, ge=0, le=14)
    cleaning_ph_max: Optional[float] = Field(default=None, ge=0, le=14)
    max_pressure_drop: Optional[float] = Field(default=None, gt=0)
    max_feed_flow: Optional[float] = Field(default=None, gt=0)
    salt_rejection: Optional[str] = None
    mineral_rejection: Optional[str] = None
    datasheet_url: Optional[str] = None
    verification_status: Optional[VerificationStatus] = None
    notes: Optional[str] = None
    properties: Optional[List[MembranePropertyUpdate]] = None


def serialize_membrane(m: Membrane) -> dict:
    return {
        "id": m.id,
        "manufacturer": m.manufacturer,
        "model": m.model,
        "full_model_number": m.full_model_number,
        "process_type": m.process_type,
        "nominal_size": m.nominal_size,
        "membrane_area": m.membrane_area,
        "membrane_material": m.membrane_material,
        "feed_spacer_thickness": m.feed_spacer_thickness,
        "mwco": m.mwco,
        "design_flux": m.design_flux,
        "max_pressure": m.max_pressure,
        "max_temperature": m.max_temperature,
        "operating_ph_min": m.operating_ph_min,
        "operating_ph_max": m.operating_ph_max,
        "cleaning_ph_min": m.cleaning_ph_min,
        "cleaning_ph_max": m.cleaning_ph_max,
        "max_pressure_drop": m.max_pressure_drop,
        "max_feed_flow": m.max_feed_flow,
        "salt_rejection": m.salt_rejection,
        "mineral_rejection": m.mineral_rejection,
        "ash_rejection_data": m.ash_rejection_data,
        "datasheet_url": m.datasheet_url,
        "verification_status": m.verification_status,
        "notes": m.notes,
        "properties": [
            {
                "id": p.id,
                "property_name": p.property_name,
                "property_value": p.property_value,
                "property_unit": p.property_unit,
                "data_source": p.data_source,
                "verification_status": p.verification_status,
            }
            for p in m.properties
        ],
    }


@router.get("")
def list_membranes(
    process_type: Optional[str] = Query(default=None, description="Filter by RO or NF"),
    nominal_size: Optional[str] = Query(default=None, description="Filter by size e.g. 8038 or 3838"),
    min_area: Optional[float] = Query(default=None),
    max_area: Optional[float] = Query(default=None),
    model_query: Optional[str] = Query(default=None),
    ash_supplied: bool = Query(default=False, description="Apply COW PRO v1 ash-based NF restriction"),
    _: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List membranes with process, size, area filters and optional Ash->NF rule enforcement."""
    query = db.query(Membrane)

    effective_process = process_type
    restriction_note = None
    if ash_supplied:
        effective_process = "NF"
        restriction_note = ASH_RULE_EXPLANATION

    if effective_process:
        query = query.filter(Membrane.process_type == effective_process)
    if nominal_size:
        query = query.filter(Membrane.nominal_size == nominal_size)
    if min_area is not None:
        query = query.filter(Membrane.membrane_area >= min_area)
    if max_area is not None:
        query = query.filter(Membrane.membrane_area <= max_area)
    if model_query:
        query = query.filter(Membrane.model.ilike(f"%{model_query.strip()}%"))

    items = query.order_by(Membrane.id.asc()).all()
    return {
        "membranes": [serialize_membrane(m) for m in items],
        "ash_restriction_active": ash_supplied,
        "restriction_note": restriction_note,
    }


@router.get("/compare")
def compare_membranes(
    ids: str = Query(..., description="Comma-separated membrane IDs to compare"),
    _: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return side-by-side details for multiple membrane IDs."""
    try:
        id_list = [int(part.strip()) for part in ids.split(",") if part.strip()]
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Membrane IDs must be comma-separated integers.",
        ) from exc

    membranes = db.query(Membrane).filter(Membrane.id.in_(id_list)).order_by(Membrane.id.asc()).all()
    return {"membranes": [serialize_membrane(m) for m in membranes]}


@router.get("/{membrane_id}")
def get_membrane(
    membrane_id: int,
    _: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve a single membrane record and its per-property audit log."""
    m = db.query(Membrane).filter(Membrane.id == membrane_id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membrane not found.")
    return {"membrane": serialize_membrane(m)}


@router.patch("/{membrane_id}")
def update_membrane_properties(
    membrane_id: int,
    payload: MembraneUpdateRequest,
    _: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update membrane technical specifications and per-property verification status."""
    m = db.query(Membrane).filter(Membrane.id == membrane_id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membrane not found.")

    scalar_fields = [
        "manufacturer",
        "full_model_number",
        "membrane_material",
        "feed_spacer_thickness",
        "mwco",
        "design_flux",
        "max_pressure",
        "max_temperature",
        "operating_ph_min",
        "operating_ph_max",
        "cleaning_ph_min",
        "cleaning_ph_max",
        "max_pressure_drop",
        "max_feed_flow",
        "salt_rejection",
        "mineral_rejection",
        "datasheet_url",
        "notes",
    ]
    for field in scalar_fields:
        val = getattr(payload, field)
        if val is not None:
            setattr(m, field, val)
    if payload.verification_status is not None:
        m.verification_status = payload.verification_status.value

    if payload.properties:
        existing_props = {p.property_name: p for p in m.properties}
        for prop_upd in payload.properties:
            prop = existing_props.get(prop_upd.property_name)
            if prop:
                prop.property_value = prop_upd.property_value
                if prop_upd.property_unit is not None:
                    prop.property_unit = prop_upd.property_unit
                prop.data_source = prop_upd.data_source
                prop.verification_status = prop_upd.verification_status.value
            else:
                db.add(
                    MembraneProperty(
                        membrane_id=m.id,
                        property_name=prop_upd.property_name,
                        property_value=prop_upd.property_value,
                        property_unit=prop_upd.property_unit,
                        data_source=prop_upd.data_source,
                        verification_status=prop_upd.verification_status.value,
                    )
                )

    db.commit()
    db.refresh(m)
    return {"membrane": serialize_membrane(m)}
