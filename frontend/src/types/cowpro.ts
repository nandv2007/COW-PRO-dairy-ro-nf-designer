export type ProcessType = "RO" | "NF";
export type MilkType =
  | "Skim Milk"
  | "Pasteurized Whole Cow Milk"
  | "Buffalo Milk"
  | "Custom Milk";

export type ProjectStatus =
  | "Draft"
  | "Input Complete"
  | "Design Calculated"
  | "Validation Required"
  | "Validated"
  | "Report Generated";

export type VerificationStatus =
  | "Manufacturer Verified"
  | "Experimentally Measured"
  | "User Supplied"
  | "Estimated"
  | "Unknown";

export type ValidationCheckStatus =
  | "Passed"
  | "Warning"
  | "Failed"
  | "Not Evaluated";

export interface PreferredUnits {
  flow: "L/h" | "m3/h";
  pressure: "bar" | "kPa" | "psi";
  temperature: "C" | "F";
  area: "m2";
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  organization: string | null;
  preferred_units: PreferredUnits;
  email_verified: boolean;
  created_at: string | null;
}

export interface MembraneProperty {
  id: string;
  property_name: string;
  property_value: string | null;
  property_unit: string | null;
  data_source: string | null;
  verification_status: VerificationStatus;
}

export interface Membrane {
  id: number;
  manufacturer: string;
  model: string;
  full_model_number: string | null;
  process_type: ProcessType;
  nominal_size: string;
  membrane_area: number;
  membrane_material: string | null;
  feed_spacer_thickness: number | null;
  mwco: string | null;
  design_flux: number | null;
  max_pressure: number | null;
  max_temperature: number | null;
  operating_ph_min: number | null;
  operating_ph_max: number | null;
  cleaning_ph_min: number | null;
  cleaning_ph_max: number | null;
  max_pressure_drop: number | null;
  max_feed_flow: number | null;
  salt_rejection: string | null;
  mineral_rejection: string | null;
  ash_rejection_data: Record<string, unknown> | null;
  datasheet_url: string | null;
  verification_status: VerificationStatus;
  notes: string | null;
  properties: MembraneProperty[];
}

export interface FeedCompositionData {
  milk_type: MilkType;
  input_mode: "SNF" | "Total Solids";
  fat_percentage: number;
  snf_percentage: number;
  total_solids_percentage: number;
  protein_percentage: number | null;
  lactose_percentage: number | null;
  ash_percentage: number | null;
  other_solids_percentage: number | null;
  individual_minerals: Record<string, number>;
  ash_design_supplied: boolean;
  composition_basis: string;
  value_sources: Record<string, string>;
}

export interface FeedConditionsData {
  flow_input_method: "direct" | "capacity";
  feed_flow: number;
  feed_flow_unit: "L/h" | "m3/h";
  processing_capacity: number | null;
  capacity_unit: "L" | "m3" | "kg" | null;
  operating_time: number | null;
  temperature: number;
  ph: number | null;
  density: number | null;
  viscosity: number | null;
  conductivity: number | null;
}

export interface ConcentrationDesignData {
  target_basis: "SNF" | "Total Solids";
  initial_percentage: number;
  target_percentage: number;
  concentration_factor: number;
  permeate_removal: number;
  total_permeate_volume: number | null;
  final_retentate_flow: number;
  selected_loops: number;
}

export interface LoopDesignData {
  loop_number: 1 | 2;
  is_active: boolean;
  feed_flow: number;
  permeate_flow: number;
  retentate_flow: number;
  membrane_id: number | null;
  membrane_flux: number | null;
  flux_source: string;
  membrane_count: number;
  installed_area: number;
  housing_count: number;
  elements_per_housing: number;
  housing_type: string | null;
  housing_pressure_rating: number | null;
  max_elements_per_housing: number | null;
  max_housing_feed_flow: number | null;
  max_housing_pressure_drop: number | null;
  recirculation_flow: number | null;
  inlet_pressure: number | null;
  retentate_pressure: number | null;
  permeate_pressure: number | null;
  pump_efficiency: number | null;
}

export interface ValidationCheck {
  id: string;
  category: string;
  title: string;
  status: ValidationCheckStatus;
  message: string;
  details?: string | null;
}

export interface ValidationSummary {
  overall_status: ValidationCheckStatus;
  can_mark_validated: boolean;
  passed_count: number;
  warning_count: number;
  failed_count: number;
  not_evaluated_count: number;
  checks: ValidationCheck[];
  unverified_properties: string[];
  engineering_limitations: string[];
}

export interface LoopSizingResult {
  loop_number: number;
  membrane_id: number;
  membrane_model: string;
  membrane_area_m2: number;
  design_flux_lmh: number;
  flux_source: string;
  exact_membranes_required: number;
  membrane_count: number;
  installed_area_m2: number;
  actual_operating_flux_lmh: number;
  elements_per_housing: number;
  housing_count: number;
  total_housing_positions: number;
  spare_positions: number;
  is_divisible: boolean;
  housing_warnings: string[];
}

export interface HydraulicLoopResult {
  loop_number: number;
  net_feed_flow_lh: number;
  recirculation_flow_lh: number | null;
  membrane_feed_flow_lh: number | null;
  flow_per_housing_lh: number | null;
  inlet_pressure_bar: number | null;
  retentate_pressure_bar: number | null;
  permeate_pressure_bar: number | null;
  pressure_drop_bar: number | null;
  average_feed_pressure_bar: number | null;
  transmembrane_pressure_bar: number | null;
  recirculation_hydraulic_power_kw: number | null;
  recirculation_shaft_power_kw: number | null;
  pump_sizing_evaluated: boolean;
  hydraulic_status_notes: string[];
}

export interface FeedPumpResult {
  feed_flow_lh: number;
  feed_flow_m3_s: number;
  required_differential_pressure_bar: number | null;
  required_differential_pressure_pa: number | null;
  pump_efficiency: number | null;
  hydraulic_power_w: number | null;
  hydraulic_power_kw: number | null;
  shaft_power_w: number | null;
  shaft_power_kw: number | null;
  evaluated: boolean;
  notes: string[];
}

export interface FullDesignOutput {
  composition: {
    milk_type: MilkType;
    fat_percentage: number;
    snf_percentage: number;
    total_solids_percentage: number;
    water_percentage: number;
    protein_percentage: number | null;
    lactose_percentage: number | null;
    ash_percentage: number | null;
    other_solids_percentage: number | null;
    individual_minerals: Record<string, number>;
    ash_restriction_active: boolean;
    allowed_processes: ProcessType[];
    ash_rule_explanation: string;
    composition_basis: string;
    value_sources: Record<string, string>;
    warnings: string[];
  };
  feed: {
    feed_flow_lh: number;
    feed_flow_m3h: number;
    flow_input_method: string;
    processing_capacity_liters: number | null;
    operating_time_hours: number | null;
    temperature_c: number;
    ph: number | null;
    density_kg_per_l: number | null;
    viscosity_cp: number | null;
    conductivity_ms_cm: number | null;
    formula_used: string;
    warnings: string[];
  };
  concentration: {
    target_basis: "SNF" | "Total Solids";
    initial_percentage: number;
    target_percentage: number;
    concentration_factor: number;
    total_permeate_removal_lh: number;
    total_permeate_volume_l: number | null;
    final_retentate_flow_lh: number;
    is_no_concentration: boolean;
    out_of_automatic_range: boolean;
    warnings: string[];
  };
  loops: {
    configuration_label: string;
    active_loops: number;
    loop_selection_rule: string;
    loop1_active: boolean;
    loop2_active: boolean;
    loop1_feed_flow_lh: number;
    loop1_permeate_flow_lh: number;
    loop1_retentate_flow_lh: number;
    loop2_feed_flow_lh: number;
    loop2_permeate_flow_lh: number;
    loop2_retentate_flow_lh: number;
    final_retentate_flow_lh: number;
    overall_mass_balance_error_lh: number;
    loop_permeate_sum_error_lh: number;
    warnings: string[];
  };
  loop_sizings: LoopSizingResult[];
  total_membranes: number;
  total_installed_area_m2: number;
  total_housings: number;
  feed_pump: FeedPumpResult | null;
  hydraulic_loops: HydraulicLoopResult[];
  validation: ValidationSummary;
  level1_simulation: {
    simulation_level: string;
    process_type: ProcessType;
    feed_flow_lh: number;
    concentration_factor: number;
    total_permeate_removal_lh: number;
    final_retentate_flow_lh: number;
    overall_recovery_pct: number;
    active_loops: number;
    configuration_label: string;
    total_membranes: number;
    total_installed_area_m2: number;
    estimated_retentate_snf_pct: number | null;
    estimated_retentate_total_solids_pct: number | null;
    assumptions: string[];
    loop_metrics: Array<{
      loop_number: number;
      is_active: boolean;
      feed_flow_lh: number;
      permeate_flow_lh: number;
      retentate_flow_lh: number;
      permeate_recovery_pct: number;
      cumulative_concentration_factor: number;
      membrane_model: string | null;
      membrane_area_m2: number | null;
      design_flux_lmh: number | null;
      actual_flux_lmh: number | null;
      membrane_count: number;
      installed_area_m2: number;
      housing_count: number;
      spare_positions: number;
    }>;
  } | null;
  level2_readiness: {
    simulation_level: string;
    is_available: boolean;
    status_label: string;
    message: string;
    missing_requirements: string[];
  } | null;
}

export interface ProjectSummary {
  id: string;
  project_code: string;
  project_name: string;
  description: string;
  customer_organization: string | null;
  project_location: string | null;
  design_engineer: string | null;
  process_type: ProcessType;
  milk_type: MilkType;
  status: ProjectStatus;
  concentration_factor: number | null;
  configuration: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  hydraulics_config: {
    feed_pump_diff_pressure_bar?: number | null;
    feed_pump_efficiency?: number | null;
  };
  feed_composition: FeedCompositionData | null;
  feed_conditions: FeedConditionsData | null;
  concentration_design: ConcentrationDesignData | null;
  loop_designs: LoopDesignData[];
  latest_simulation: {
    id: string;
    simulation_type: string;
    validation_status: string;
    result_snapshot: FullDesignOutput;
    created_at: string | null;
  } | null;
  reports: Array<{
    id: string;
    report_name: string;
    report_format: string;
    generated_at: string | null;
  }>;
}
