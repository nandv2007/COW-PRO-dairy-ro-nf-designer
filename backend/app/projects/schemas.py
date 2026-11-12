"""Pydantic schemas for Project CRUD, Feed Analysis, Equipment Design, Simulation & JSON I/O."""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

from ..engine.types import MilkType, ProcessType, ValueSource, VerificationStatus


class ProjectCreateRequest(BaseModel):
    project_name: str = Field(..., min_length=2, max_length=255)
    description: str = Field(default="")
    customer_organization: Optional[str] = Field(default=None, max_length=255)
    project_location: Optional[str] = Field(default=None, max_length=255)
    design_engineer: Optional[str] = Field(default=None, max_length=255)
    process_type: ProcessType
    milk_type: MilkType


class ProjectUpdateRequest(BaseModel):
    project_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    description: Optional[str] = None
    customer_organization: Optional[str] = None
    project_location: Optional[str] = None
    design_engineer: Optional[str] = None
    process_type: Optional[ProcessType] = None
    milk_type: Optional[MilkType] = None


class FeedAnalysisSaveRequest(BaseModel):
    # Stage 1: Milk Composition
    milk_type: MilkType
    fat_percentage: float = Field(..., ge=0, le=100)
    input_mode: Literal["SNF", "Total Solids"] = "SNF"
    snf_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    total_solids_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    protein_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    lactose_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    ash_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    other_solids_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    individual_minerals: Dict[str, float] = Field(default_factory=dict)
    ash_design_supplied: bool = False
    composition_basis: str = "% w/w (mass basis)"
    value_sources: Dict[str, ValueSource] = Field(default_factory=dict)

    # Stage 2: Feed Conditions
    flow_input_method: Literal["direct", "capacity"] = "direct"
    feed_flow: Optional[float] = Field(default=None, gt=0)
    feed_flow_unit: Literal["L/h", "m3/h"] = "L/h"
    processing_capacity: Optional[float] = Field(default=None, gt=0)
    capacity_unit: Literal["L", "m3", "kg"] = "L"
    operating_time: Optional[float] = Field(default=None, gt=0)
    temperature: float = 10.0
    ph: Optional[float] = Field(default=None, ge=0, le=14)
    density: Optional[float] = Field(default=None, gt=0)
    viscosity: Optional[float] = Field(default=None, gt=0)
    conductivity: Optional[float] = Field(default=None, ge=0)

    # Stage 3: Final Concentration
    target_basis: Literal["SNF", "Total Solids"] = "SNF"
    target_percentage: float = Field(..., gt=0, le=100)


class LoopEquipmentSaveInput(BaseModel):
    loop_number: int = Field(..., ge=1, le=2)
    membrane_id: int
    design_flux_lmh: float = Field(..., gt=0)
    flux_source: VerificationStatus = VerificationStatus.USER_SUPPLIED
    elements_per_housing: int = Field(default=1, ge=1)
    housing_type: Optional[str] = None
    housing_pressure_rating_bar: Optional[float] = Field(default=None, gt=0)
    max_elements_per_housing: Optional[int] = Field(default=None, ge=1)
    max_housing_feed_flow_lh: Optional[float] = Field(default=None, gt=0)
    max_housing_pressure_drop_bar: Optional[float] = Field(default=None, gt=0)
    recirculation_flow_lh: Optional[float] = Field(default=None, ge=0)
    inlet_pressure_bar: Optional[float] = Field(default=None, ge=0)
    retentate_pressure_bar: Optional[float] = Field(default=None, ge=0)
    permeate_pressure_bar: Optional[float] = Field(default=None, ge=0)
    pump_efficiency: Optional[float] = Field(default=None, gt=0, le=1.0)


class EquipmentDesignSaveRequest(BaseModel):
    loops: List[LoopEquipmentSaveInput]
    feed_pump_diff_pressure_bar: Optional[float] = Field(default=None, ge=0)
    feed_pump_efficiency: Optional[float] = Field(default=None, gt=0, le=1.0)


class SimulationRunRequest(BaseModel):
    simulation_level: Literal["Level 1", "Level 2"] = "Level 1"


class ProjectImportRequest(BaseModel):
    project_name: Optional[str] = None
    data: Dict[str, Any]
