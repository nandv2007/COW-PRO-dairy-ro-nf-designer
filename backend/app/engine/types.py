"""Centralized typed schemas, units, and constants for the COW PRO Calculation Engine."""

from enum import Enum
from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ProcessType(str, Enum):
    RO = "RO"
    NF = "NF"


class MilkType(str, Enum):
    SKIM = "Skim Milk"
    WHOLE = "Pasteurized Whole Cow Milk"
    BUFFALO = "Buffalo Milk"
    CUSTOM = "Custom Milk"


class ProjectStatus(str, Enum):
    DRAFT = "Draft"
    INPUT_COMPLETE = "Input Complete"
    DESIGN_CALCULATED = "Design Calculated"
    VALIDATION_REQUIRED = "Validation Required"
    VALIDATED = "Validated"
    REPORT_GENERATED = "Report Generated"


class VerificationStatus(str, Enum):
    MANUFACTURER_VERIFIED = "Manufacturer Verified"
    EXPERIMENTALLY_MEASURED = "Experimentally Measured"
    USER_SUPPLIED = "User Supplied"
    ESTIMATED = "Estimated"
    UNKNOWN = "Unknown"


class ValidationCheckStatus(str, Enum):
    PASSED = "Passed"
    WARNING = "Warning"
    FAILED = "Failed"
    NOT_EVALUATED = "Not Evaluated"


class ValidationCategory(str, Enum):
    COMPOSITION = "Composition Validation"
    CONCENTRATION = "Concentration Validation"
    MEMBRANE = "Membrane Validation"
    HYDRAULIC = "Hydraulic Validation"
    MASS_BALANCE = "Mass Balance Validation"


class ValueSource(str, Enum):
    MEASURED = "measured"
    USER_SUPPLIED = "user_supplied"
    ESTIMATED = "estimated"
    CALCULATED = "calculated"


class CompositionInput(BaseModel):
    """Typed input for Milk Composition (Module 1, Stage 1)."""

    milk_type: MilkType = MilkType.CUSTOM
    fat_percentage: float = Field(..., description="Milk fat content in % w/w (mass basis)")
    input_mode: Literal["SNF", "Total Solids"] = "SNF"
    snf_percentage: Optional[float] = Field(None, description="Solids-Not-Fat in % w/w when input_mode='SNF'")
    total_solids_percentage: Optional[float] = Field(
        None, description="Total Solids in % w/w when input_mode='Total Solids'"
    )
    protein_percentage: Optional[float] = Field(None, description="Optional protein content in % w/w")
    lactose_percentage: Optional[float] = Field(None, description="Optional lactose content in % w/w")
    ash_percentage: Optional[float] = Field(None, description="Optional ash content in % w/w")
    other_solids_percentage: Optional[float] = Field(None, description="Optional other solids content in % w/w")
    individual_minerals: Dict[str, float] = Field(
        default_factory=dict,
        description="Optional individual mineral concentrations (e.g. Ca, P, K, Na, Mg, Cl in mg/L)",
    )
    ash_design_supplied: bool = Field(
        False,
        description="True when ash/mineral properties are explicitly supplied for ash/mineral separation design",
    )
    composition_basis: str = "% w/w (mass basis)"
    value_sources: Dict[str, ValueSource] = Field(default_factory=dict)


class CompositionResult(BaseModel):
    """Deterministic output of Composition Calculation."""

    milk_type: MilkType
    fat_percentage: float
    snf_percentage: float
    total_solids_percentage: float
    water_percentage: float
    protein_percentage: Optional[float] = None
    lactose_percentage: Optional[float] = None
    ash_percentage: Optional[float] = None
    other_solids_percentage: Optional[float] = None
    individual_minerals: Dict[str, float] = Field(default_factory=dict)
    ash_restriction_active: bool
    allowed_processes: List[ProcessType]
    ash_rule_explanation: str
    composition_basis: str
    value_sources: Dict[str, str]
    warnings: List[str] = Field(default_factory=list)


class FeedConditionsInput(BaseModel):
    """Typed input for Feed Conditions (Module 1, Stage 2)."""

    flow_input_method: Literal["direct", "capacity"] = "direct"
    feed_flow: Optional[float] = Field(None, description="Direct feed flow rate")
    feed_flow_unit: Literal["L/h", "m3/h"] = "L/h"
    processing_capacity: Optional[float] = Field(None, description="Batch/total milk processing capacity")
    capacity_unit: Literal["L", "m3", "kg"] = "L"
    operating_time: Optional[float] = Field(None, description="Operating time in hours (h)")
    temperature: float = Field(10.0, description="Feed temperature in °C")
    ph: Optional[float] = Field(None, description="Optional feed pH")
    density: Optional[float] = Field(None, description="Optional feed density in kg/L (required if capacity in kg)")
    viscosity: Optional[float] = Field(None, description="Optional dynamic viscosity in mPa·s (cP)")
    conductivity: Optional[float] = Field(None, description="Optional electrical conductivity in mS/cm")


class FeedFlowResult(BaseModel):
    """Deterministic output of Feed Flow Calculation."""

    feed_flow_lh: float
    feed_flow_m3h: float
    flow_input_method: str
    processing_capacity_liters: Optional[float] = None
    operating_time_hours: Optional[float] = None
    temperature_c: float
    ph: Optional[float] = None
    density_kg_per_l: Optional[float] = None
    viscosity_cp: Optional[float] = None
    conductivity_ms_cm: Optional[float] = None
    formula_used: str
    warnings: List[str] = Field(default_factory=list)


class ConcentrationInput(BaseModel):
    """Typed input for Target Concentration (Module 1, Stage 3)."""

    target_basis: Literal["SNF", "Total Solids"] = "SNF"
    initial_snf_percentage: float
    initial_total_solids_percentage: float
    target_percentage: float
    feed_flow_lh: float
    operating_time_hours: Optional[float] = None


class ConcentrationResult(BaseModel):
    """Deterministic output of Concentration Factor and Permeate Removal."""

    target_basis: Literal["SNF", "Total Solids"]
    initial_percentage: float
    target_percentage: float
    concentration_factor: float
    total_permeate_removal_lh: float
    total_permeate_volume_l: Optional[float] = None
    final_retentate_flow_lh: float
    is_no_concentration: bool
    out_of_automatic_range: bool
    warnings: List[str] = Field(default_factory=list)


class LoopAllocationResult(BaseModel):
    """Deterministic output of Loop Selection and Flow Balance."""

    configuration_label: str  # "No Concentration Required", "Single Loop", "Two Loops", "Out of Range"
    active_loops: int  # 1 or 2
    loop_selection_rule: str
    loop1_active: bool
    loop2_active: bool
    loop1_feed_flow_lh: float
    loop1_permeate_flow_lh: float
    loop1_retentate_flow_lh: float
    loop2_feed_flow_lh: float
    loop2_permeate_flow_lh: float
    loop2_retentate_flow_lh: float
    final_retentate_flow_lh: float
    overall_mass_balance_error_lh: float
    loop_permeate_sum_error_lh: float
    warnings: List[str] = Field(default_factory=list)


class LoopSizingInput(BaseModel):
    """Typed input for sizing a single active loop."""

    loop_number: int
    permeate_flow_lh: float
    membrane_id: int
    membrane_model: str
    membrane_area_m2: float
    nominal_size: str
    design_flux_lmh: float
    flux_source: VerificationStatus = VerificationStatus.USER_SUPPLIED
    elements_per_housing: int = 1
    housing_type: Optional[str] = None
    housing_pressure_rating_bar: Optional[float] = None
    max_elements_per_housing: Optional[int] = None
    max_housing_feed_flow_lh: Optional[float] = None
    max_housing_pressure_drop_bar: Optional[float] = None


class LoopSizingResult(BaseModel):
    """Deterministic output of Membrane Sizing and Housing Count for a loop."""

    loop_number: int
    membrane_id: int
    membrane_model: str
    membrane_area_m2: float
    design_flux_lmh: float
    flux_source: str
    exact_membranes_required: float
    membrane_count: int
    installed_area_m2: float
    actual_operating_flux_lmh: float
    elements_per_housing: int
    housing_count: int
    total_housing_positions: int
    spare_positions: int
    is_divisible: bool
    housing_warnings: List[str] = Field(default_factory=list)


class HydraulicLoopInput(BaseModel):
    """Typed input for loop hydraulic and pump power calculations."""

    loop_number: int
    net_feed_flow_lh: float
    recirculation_flow_lh: Optional[float] = None
    inlet_pressure_bar: Optional[float] = None
    retentate_pressure_bar: Optional[float] = None
    permeate_pressure_bar: Optional[float] = None
    pump_efficiency: Optional[float] = Field(None, description="Fraction between 0 and 1, e.g. 0.72")
    housing_count: int = 0
    max_membrane_feed_flow_lh: Optional[float] = None
    max_housing_feed_flow_lh: Optional[float] = None
    max_pressure_drop_bar: Optional[float] = None
    max_operating_pressure_bar: Optional[float] = None


class HydraulicLoopResult(BaseModel):
    """Deterministic output of Hydraulic Design for a loop."""

    loop_number: int
    net_feed_flow_lh: float
    recirculation_flow_lh: Optional[float] = None
    membrane_feed_flow_lh: Optional[float] = None
    flow_per_housing_lh: Optional[float] = None
    inlet_pressure_bar: Optional[float] = None
    retentate_pressure_bar: Optional[float] = None
    permeate_pressure_bar: Optional[float] = None
    pressure_drop_bar: Optional[float] = None
    average_feed_pressure_bar: Optional[float] = None
    transmembrane_pressure_bar: Optional[float] = None
    recirculation_hydraulic_power_kw: Optional[float] = None
    recirculation_shaft_power_kw: Optional[float] = None
    pump_sizing_evaluated: bool = False
    hydraulic_status_notes: List[str] = Field(default_factory=list)


class FeedPumpInput(BaseModel):
    """Typed input for Feed Pump sizing."""

    feed_flow_lh: float
    required_differential_pressure_bar: Optional[float] = None
    pump_efficiency: Optional[float] = None


class FeedPumpResult(BaseModel):
    """Deterministic output of Feed Pump sizing."""

    feed_flow_lh: float
    feed_flow_m3_s: float
    required_differential_pressure_bar: Optional[float] = None
    required_differential_pressure_pa: Optional[float] = None
    pump_efficiency: Optional[float] = None
    hydraulic_power_w: Optional[float] = None
    hydraulic_power_kw: Optional[float] = None
    shaft_power_w: Optional[float] = None
    shaft_power_kw: Optional[float] = None
    evaluated: bool = False
    notes: List[str] = Field(default_factory=list)


class ValidationCheck(BaseModel):
    """Single engineering validation check item."""

    id: str
    category: ValidationCategory
    title: str
    status: ValidationCheckStatus
    message: str
    details: Optional[str] = None


class ValidationSummary(BaseModel):
    """Complete engineering validation output across all 5 categories."""

    overall_status: ValidationCheckStatus
    can_mark_validated: bool
    passed_count: int
    warning_count: int
    failed_count: int
    not_evaluated_count: int
    checks: List[ValidationCheck]
    unverified_properties: List[str] = Field(default_factory=list)
    engineering_limitations: List[str] = Field(default_factory=list)
