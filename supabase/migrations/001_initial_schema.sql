-- COW PRO Initial PostgreSQL / Supabase Schema
-- Implements Section 25 Database Structure with foreign keys, constraints, indexes, and RLS

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    organization TEXT,
    preferred_units JSONB NOT NULL DEFAULT '{"flow": "L/h", "pressure": "bar", "temperature": "C", "area": "m2"}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Projects
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_code TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    description TEXT DEFAULT '',
    customer_organization TEXT,
    project_location TEXT,
    design_engineer TEXT,
    process_type TEXT NOT NULL CHECK (process_type IN ('RO', 'NF')),
    milk_type TEXT NOT NULL CHECK (milk_type IN ('Skim Milk', 'Pasteurized Whole Cow Milk', 'Buffalo Milk', 'Custom Milk')),
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (
        status IN ('Draft', 'Input Complete', 'Design Calculated', 'Validation Required', 'Validated', 'Report Generated')
    ),
    hydraulics_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Feed Composition
CREATE TABLE IF NOT EXISTS public.feed_composition (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID UNIQUE NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    milk_type TEXT NOT NULL,
    input_mode TEXT NOT NULL DEFAULT 'SNF' CHECK (input_mode IN ('SNF', 'Total Solids')),
    fat_percentage DOUBLE PRECISION NOT NULL CHECK (fat_percentage >= 0 AND fat_percentage <= 100),
    snf_percentage DOUBLE PRECISION NOT NULL CHECK (snf_percentage >= 0 AND snf_percentage <= 100),
    total_solids_percentage DOUBLE PRECISION NOT NULL CHECK (total_solids_percentage >= 0 AND total_solids_percentage <= 100),
    protein_percentage DOUBLE PRECISION CHECK (protein_percentage IS NULL OR (protein_percentage >= 0 AND protein_percentage <= 100)),
    lactose_percentage DOUBLE PRECISION CHECK (lactose_percentage IS NULL OR (lactose_percentage >= 0 AND lactose_percentage <= 100)),
    ash_percentage DOUBLE PRECISION CHECK (ash_percentage IS NULL OR (ash_percentage >= 0 AND ash_percentage <= 100)),
    other_solids_percentage DOUBLE PRECISION CHECK (other_solids_percentage IS NULL OR (other_solids_percentage >= 0 AND other_solids_percentage <= 100)),
    individual_minerals JSONB NOT NULL DEFAULT '{}'::jsonb,
    ash_design_supplied BOOLEAN NOT NULL DEFAULT FALSE,
    composition_basis TEXT NOT NULL DEFAULT '% w/w (mass basis)',
    value_sources JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT total_solids_gte_fat CHECK (total_solids_percentage >= fat_percentage)
);

-- 4. Feed Conditions
CREATE TABLE IF NOT EXISTS public.feed_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID UNIQUE NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    flow_input_method TEXT NOT NULL DEFAULT 'direct' CHECK (flow_input_method IN ('direct', 'capacity')),
    feed_flow DOUBLE PRECISION NOT NULL CHECK (feed_flow > 0),
    feed_flow_unit TEXT NOT NULL DEFAULT 'L/h' CHECK (feed_flow_unit IN ('L/h', 'm3/h')),
    processing_capacity DOUBLE PRECISION CHECK (processing_capacity IS NULL OR processing_capacity > 0),
    capacity_unit TEXT DEFAULT 'L' CHECK (capacity_unit IS NULL OR capacity_unit IN ('L', 'm3', 'kg')),
    operating_time DOUBLE PRECISION CHECK (operating_time IS NULL OR operating_time > 0),
    temperature DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    ph DOUBLE PRECISION CHECK (ph IS NULL OR (ph >= 0 AND ph <= 14)),
    density DOUBLE PRECISION CHECK (density IS NULL OR density > 0),
    viscosity DOUBLE PRECISION CHECK (viscosity IS NULL OR viscosity > 0),
    conductivity DOUBLE PRECISION CHECK (conductivity IS NULL OR conductivity >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Concentration Design
CREATE TABLE IF NOT EXISTS public.concentration_design (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID UNIQUE NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    target_basis TEXT NOT NULL DEFAULT 'SNF' CHECK (target_basis IN ('SNF', 'Total Solids')),
    initial_percentage DOUBLE PRECISION NOT NULL CHECK (initial_percentage > 0),
    target_percentage DOUBLE PRECISION NOT NULL CHECK (target_percentage >= initial_percentage),
    concentration_factor DOUBLE PRECISION NOT NULL CHECK (concentration_factor >= 1),
    permeate_removal DOUBLE PRECISION NOT NULL CHECK (permeate_removal >= 0),
    total_permeate_volume DOUBLE PRECISION,
    final_retentate_flow DOUBLE PRECISION NOT NULL CHECK (final_retentate_flow >= 0),
    selected_loops INTEGER NOT NULL DEFAULT 1 CHECK (selected_loops IN (1, 2)),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Membranes (Shared reference catalog)
CREATE TABLE IF NOT EXISTS public.membranes (
    id INTEGER PRIMARY KEY,
    manufacturer TEXT NOT NULL,
    model TEXT NOT NULL,
    full_model_number TEXT,
    process_type TEXT NOT NULL CHECK (process_type IN ('RO', 'NF')),
    nominal_size TEXT NOT NULL,
    membrane_area DOUBLE PRECISION NOT NULL CHECK (membrane_area > 0),
    membrane_material TEXT,
    feed_spacer_thickness DOUBLE PRECISION,
    mwco TEXT,
    design_flux DOUBLE PRECISION CHECK (design_flux IS NULL OR design_flux > 0),
    max_pressure DOUBLE PRECISION,
    max_temperature DOUBLE PRECISION,
    operating_ph_min DOUBLE PRECISION,
    operating_ph_max DOUBLE PRECISION,
    cleaning_ph_min DOUBLE PRECISION,
    cleaning_ph_max DOUBLE PRECISION,
    max_pressure_drop DOUBLE PRECISION,
    max_feed_flow DOUBLE PRECISION,
    salt_rejection TEXT,
    mineral_rejection TEXT,
    ash_rejection_data JSONB,
    datasheet_url TEXT,
    verification_status TEXT NOT NULL DEFAULT 'Unknown' CHECK (
        verification_status IN ('Manufacturer Verified', 'Experimentally Measured', 'User Supplied', 'Estimated', 'Unknown')
    ),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Membrane Properties (Per-property source & verification audit)
CREATE TABLE IF NOT EXISTS public.membrane_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membrane_id INTEGER NOT NULL REFERENCES public.membranes(id) ON DELETE CASCADE,
    property_name TEXT NOT NULL,
    property_value TEXT,
    property_unit TEXT,
    data_source TEXT,
    verification_status TEXT NOT NULL DEFAULT 'Unknown' CHECK (
        verification_status IN ('Manufacturer Verified', 'Experimentally Measured', 'User Supplied', 'Estimated', 'Unknown')
    ),
    UNIQUE (membrane_id, property_name)
);

-- 8. Loop Designs
CREATE TABLE IF NOT EXISTS public.loop_designs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    loop_number INTEGER NOT NULL CHECK (loop_number IN (1, 2)),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    feed_flow DOUBLE PRECISION NOT NULL DEFAULT 0,
    permeate_flow DOUBLE PRECISION NOT NULL DEFAULT 0,
    retentate_flow DOUBLE PRECISION NOT NULL DEFAULT 0,
    membrane_id INTEGER REFERENCES public.membranes(id),
    membrane_flux DOUBLE PRECISION CHECK (membrane_flux IS NULL OR membrane_flux > 0),
    flux_source TEXT NOT NULL DEFAULT 'User Supplied',
    membrane_count INTEGER NOT NULL DEFAULT 0 CHECK (membrane_count >= 0),
    installed_area DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (installed_area >= 0),
    housing_count INTEGER NOT NULL DEFAULT 0 CHECK (housing_count >= 0),
    elements_per_housing INTEGER NOT NULL DEFAULT 1 CHECK (elements_per_housing >= 1),
    housing_type TEXT,
    housing_pressure_rating DOUBLE PRECISION,
    max_elements_per_housing INTEGER,
    max_housing_feed_flow DOUBLE PRECISION,
    max_housing_pressure_drop DOUBLE PRECISION,
    recirculation_flow DOUBLE PRECISION,
    inlet_pressure DOUBLE PRECISION,
    retentate_pressure DOUBLE PRECISION,
    permeate_pressure DOUBLE PRECISION,
    pump_efficiency DOUBLE PRECISION,
    UNIQUE (project_id, loop_number)
);

-- 9. Simulations
CREATE TABLE IF NOT EXISTS public.simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    simulation_type TEXT NOT NULL CHECK (simulation_type IN ('Level 1', 'Level 2')),
    input_snapshot JSONB NOT NULL,
    result_snapshot JSONB NOT NULL,
    validation_status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Reports
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    simulation_id UUID REFERENCES public.simulations(id) ON DELETE SET NULL,
    report_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    report_format TEXT NOT NULL DEFAULT 'PDF' CHECK (report_format IN ('PDF', 'CSV', 'JSON')),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_loop_designs_project_id ON public.loop_designs(project_id);
CREATE INDEX IF NOT EXISTS idx_simulations_project_id ON public.simulations(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_project_id ON public.reports(project_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_membrane_properties_membrane_id ON public.membrane_properties(membrane_id);

-- Row-Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_composition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concentration_design ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membranes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membrane_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loop_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users manage own projects" ON public.projects
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own feed composition" ON public.feed_composition
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
    );

CREATE POLICY "Users manage own feed conditions" ON public.feed_conditions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
    );

CREATE POLICY "Users manage own concentration design" ON public.concentration_design
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
    );

CREATE POLICY "Authenticated users can read membranes" ON public.membranes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read membrane properties" ON public.membrane_properties
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users manage own loop designs" ON public.loop_designs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
    );

CREATE POLICY "Users manage own simulations" ON public.simulations
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
    );

CREATE POLICY "Users manage own reports" ON public.reports
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
    );

-- Auto-create profile on Supabase user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, organization)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        NEW.raw_user_meta_data->>'organization'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
