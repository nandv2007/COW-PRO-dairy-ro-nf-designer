-- COW PRO Version 1 Initial Membrane Catalog (Exact 8 Entries from Section 13.1)
-- Note: Marked as 'User Supplied' / 'Unknown' until exact model suffixes and effective areas
-- are confirmed against current manufacturer datasheets.

INSERT INTO public.membranes (
    id, manufacturer, model, full_model_number, process_type, nominal_size,
    membrane_area, verification_status, notes
) VALUES
(1, 'Preliminary Reference (Unverified Manufacturer)', '8038 AEM2-31', '8038 AEM2-31 (Suffix pending confirmation)', 'RO', '8038', 33.0, 'User Supplied', 'Preliminary transcription from supplied handwritten reference. Confirm model identifier and effective area against manufacturer datasheet before marking Manufacturer Verified.'),
(2, 'Preliminary Reference (Unverified Manufacturer)', '8038 AEM2-46', '8038 AEM2-46 (Suffix pending confirmation)', 'RO', '8038', 26.9, 'User Supplied', 'Preliminary transcription from supplied handwritten reference. Confirm model identifier and effective area against manufacturer datasheet before marking Manufacturer Verified.'),
(3, 'Preliminary Reference (Unverified Manufacturer)', '3838 AEM2-31', '3838 AEM2-31 (Suffix pending confirmation)', 'RO', '3838', 6.5, 'User Supplied', 'Preliminary transcription from supplied handwritten reference. Confirm model identifier and effective area against manufacturer datasheet before marking Manufacturer Verified.'),
(4, 'Preliminary Reference (Unverified Manufacturer)', '3838 AEM2-46', '3838 AEM2-46 (Suffix pending confirmation)', 'RO', '3838', 4.9, 'User Supplied', 'Preliminary transcription from supplied handwritten reference. Confirm model identifier and effective area against manufacturer datasheet before marking Manufacturer Verified.'),
(5, 'Preliminary Reference (Unverified Manufacturer)', '8038 TS40', '8038 TS40 (33 m² variant - suffix pending confirmation)', 'NF', '8038', 33.0, 'User Supplied', 'Preliminary transcription from supplied handwritten reference. Distinct database ID from 26.9 m² 8038 TS40 entry.'),
(6, 'Preliminary Reference (Unverified Manufacturer)', '8038 TS40', '8038 TS40 (26.9 m² variant - suffix pending confirmation)', 'NF', '8038', 26.9, 'User Supplied', 'Preliminary transcription from supplied handwritten reference. Distinct database ID from 33 m² 8038 TS40 entry.'),
(7, 'Preliminary Reference (Unverified Manufacturer)', '3838 TS40', '3838 TS40 (6.5 m² variant - suffix pending confirmation)', 'NF', '3838', 6.5, 'User Supplied', 'Preliminary transcription from supplied handwritten reference. Distinct database ID from 4.9 m² 3838 TS40 entry.'),
(8, 'TurboClean (Unverified Datasheet)', '3838 TS40', '3838-TS40-46 (Pending datasheet confirmation)', 'NF', '3838', 4.9, 'User Supplied', 'Initial demonstration membrane (TurboClean NF 3838 TS40, 4.9 m²). More specific model designation 3838-TS40-46 must be confirmed against current manufacturer datasheet.')
ON CONFLICT (id) DO NOTHING;

-- Explicit per-property audit entries (do NOT fabricate unverified limits)
INSERT INTO public.membrane_properties (membrane_id, property_name, property_value, property_unit, data_source, verification_status)
SELECT
    m.id,
    prop.name,
    CASE WHEN prop.name = 'Effective Membrane Area' THEN m.membrane_area::TEXT ELSE NULL END,
    prop.unit,
    CASE WHEN prop.name = 'Effective Membrane Area' THEN 'Supplied handwritten reference' ELSE NULL END,
    CASE WHEN prop.name = 'Effective Membrane Area' THEN 'User Supplied' ELSE 'Unknown' END
FROM public.membranes m
CROSS JOIN (
    VALUES
        ('Effective Membrane Area', 'm²'),
        ('Feed Spacer Thickness', 'mil'),
        ('Molecular Weight Cutoff', 'Da'),
        ('Maximum Operating Pressure', 'bar'),
        ('Maximum Operating Temperature', '°C'),
        ('Operating pH Range', 'pH'),
        ('Cleaning pH Range', 'pH'),
        ('Maximum Pressure Drop', 'bar'),
        ('Maximum Feed Flow', 'm³/h'),
        ('Salt Rejection', '%'),
        ('Mineral Rejection', '%')
) AS prop(name, unit)
ON CONFLICT (membrane_id, property_name) DO NOTHING;
