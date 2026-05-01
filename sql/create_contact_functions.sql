-- Contact Data Confidence Scoring and Entity Resolution Functions
-- Part of the contact-data-strategies implementation

-- ============================================================================
-- CONFIDENCE SCORING FUNCTIONS
-- ============================================================================

-- Base confidence by source
CREATE OR REPLACE FUNCTION get_source_base_confidence(source_system TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE source_system
        WHEN 'il_sos_corporations' THEN 40
        WHEN 'il_sos_llc' THEN 40
        WHEN 'chi_business_licenses' THEN 35
        WHEN 'chi_business_owners' THEN 30
        WHEN 'chi_permits' THEN 25
        WHEN 'chi_foreclosed_rental_properties' THEN 45
        WHEN 'manual_verified' THEN 50
        WHEN 'commercial_enrichment' THEN 30
        WHEN 'recorder_documents' THEN 25
        WHEN 'assessor_records' THEN 25
        ELSE 20
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION classify_entity_type(entity_name TEXT)
RETURNS TEXT AS $$
DECLARE
    normalized TEXT;
BEGIN
    normalized := LOWER(COALESCE(entity_name, ''));
    IF normalized = '' THEN
        RETURN 'unknown';
    END IF;

    IF normalized ~ '\m(llc|inc|corp|corporation|ltd|limited|company|co|lp|llp|pllc)\M' THEN
        RETURN 'business';
    END IF;

    IF normalized LIKE '%, %' THEN
        RETURN 'individual';
    END IF;

    RETURN 'unknown';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate contact confidence score
CREATE OR REPLACE FUNCTION calculate_contact_confidence(
    p_source_system TEXT,
    p_name_match_score NUMERIC,
    p_address_match BOOLEAN,
    p_exact_name_match BOOLEAN,
    p_entity_verified BOOLEAN,
    p_record_age_months INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    base_score INTEGER;
    adjustments INTEGER := 0;
    final_score INTEGER;
BEGIN
    -- Base score from source
    base_score := get_source_base_confidence(p_source_system);
    
    -- Name match adjustments
    IF p_exact_name_match THEN
        adjustments := adjustments + 10;
    ELSIF p_name_match_score >= 0.9 THEN
        adjustments := adjustments + 5;
    ELSIF p_name_match_score >= 0.8 THEN
        adjustments := adjustments + 0;
    ELSIF p_name_match_score >= 0.6 THEN
        adjustments := adjustments - 10;
    ELSE
        adjustments := adjustments - 20;
    END IF;
    
    -- Address co-match bonus
    IF p_address_match THEN
        adjustments := adjustments + 15;
    END IF;
    
    -- Entity verification bonus
    IF p_entity_verified THEN
        adjustments := adjustments + 10;
    END IF;
    
    -- Staleness penalty
    IF p_record_age_months > 24 THEN
        adjustments := adjustments - 15;
    ELSIF p_record_age_months > 12 THEN
        adjustments := adjustments - 5;
    END IF;
    
    -- Calculate final score
    final_score := base_score + adjustments;
    
    -- Clamp to 0-100 range
    IF final_score > 100 THEN
        final_score := 100;
    ELSIF final_score < 0 THEN
        final_score := 0;
    END IF;
    
    RETURN final_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- ENTITY RESOLUTION FUNCTIONS
-- ============================================================================

-- Find or create canonical entity
CREATE OR REPLACE FUNCTION resolve_canonical_entity(
    p_entity_name TEXT,
    p_entity_type TEXT DEFAULT 'unknown',
    p_source_system TEXT DEFAULT 'unknown',
    p_create_if_missing BOOLEAN DEFAULT TRUE
)
RETURNS INTEGER AS $$
DECLARE
    v_normalized_name TEXT;
    v_entity_id INTEGER;
    v_similarity_threshold NUMERIC := 0.85;
    v_match RECORD;
BEGIN
    v_normalized_name := normalize_name(p_entity_name);
    
    -- First, try exact match on normalized name
    SELECT id INTO v_entity_id
    FROM canonical_entities
    WHERE normalized_name = v_normalized_name
      AND entity_type = p_entity_type
    LIMIT 1;
    
    IF v_entity_id IS NOT NULL THEN
        RETURN v_entity_id;
    END IF;
    
    -- Try fuzzy match on canonical name
    SELECT id, similarity(normalize_name(canonical_name), v_normalized_name) as sim
    INTO v_match
    FROM canonical_entities
    WHERE entity_type = p_entity_type
      AND similarity(normalize_name(canonical_name), v_normalized_name) > v_similarity_threshold
    ORDER BY similarity(normalize_name(canonical_name), v_normalized_name) DESC
    LIMIT 1;
    
    IF v_match.id IS NOT NULL THEN
        -- Record this as an alias
        INSERT INTO entity_aliases (entity_id, alias_name, normalized_alias, source_system, match_confidence)
        VALUES (v_match.id, p_entity_name, v_normalized_name, p_source_system, (v_match.sim * 100)::INTEGER)
        ON CONFLICT (normalized_alias, source_system) DO NOTHING;
        
        RETURN v_match.id;
    END IF;
    
    -- Create new entity if allowed
    IF p_create_if_missing THEN
        INSERT INTO canonical_entities (entity_type, canonical_name, normalized_name, source_count)
        VALUES (p_entity_type, p_entity_name, v_normalized_name, 1)
        RETURNING id INTO v_entity_id;
        
        -- Add the original name as an alias
        INSERT INTO entity_aliases (entity_id, alias_name, normalized_alias, source_system, match_confidence)
        VALUES (v_entity_id, p_entity_name, v_normalized_name, p_source_system, 100)
        ON CONFLICT DO NOTHING;
        
        RETURN v_entity_id;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Link contact to entity
CREATE OR REPLACE FUNCTION link_contact_to_entity(
    p_entity_id INTEGER,
    p_contact_type TEXT,
    p_contact_value TEXT,
    p_source_system TEXT,
    p_source_record_id TEXT DEFAULT NULL,
    p_confidence_score INTEGER DEFAULT NULL,
    p_is_primary BOOLEAN DEFAULT FALSE,
    p_match_evidence JSONB DEFAULT '{}'
)
RETURNS INTEGER AS $$
DECLARE
    v_normalized_value TEXT;
    v_contact_id INTEGER;
    v_calculated_confidence INTEGER;
BEGIN
    -- Normalize contact value
    v_normalized_value := CASE p_contact_type
        WHEN 'phone' THEN normalize_phone(p_contact_value)
        WHEN 'email' THEN normalize_email(p_contact_value)
        ELSE LOWER(TRIM(p_contact_value))
    END;
    
    -- Calculate confidence if not provided
    IF p_confidence_score IS NULL THEN
        v_calculated_confidence := get_source_base_confidence(p_source_system);
    ELSE
        v_calculated_confidence := p_confidence_score;
    END IF;
    
    -- Insert or update contact
    INSERT INTO entity_contacts (
        entity_id, contact_type, contact_value, normalized_value,
        source_system, source_record_id, confidence_score, is_primary, match_evidence
    )
    VALUES (
        p_entity_id, p_contact_type, p_contact_value, v_normalized_value,
        p_source_system, p_source_record_id, v_calculated_confidence, p_is_primary, p_match_evidence
    )
    ON CONFLICT (entity_id, contact_type, normalized_value, source_system)
    DO UPDATE SET
        last_seen_at = NOW(),
        confidence_score = GREATEST(entity_contacts.confidence_score, EXCLUDED.confidence_score),
        match_evidence = entity_contacts.match_evidence || EXCLUDED.match_evidence,
        is_primary = CASE WHEN EXCLUDED.confidence_score > entity_contacts.confidence_score 
                          THEN EXCLUDED.is_primary 
                          ELSE entity_contacts.is_primary END
    RETURNING id INTO v_contact_id;
    
    -- Update entity last_seen
    UPDATE canonical_entities 
    SET last_seen_at = NOW(),
        source_count = source_count + 1
    WHERE id = p_entity_id;
    
    RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION upsert_entity_contact(
    p_entity_id INTEGER,
    p_contact_type TEXT,
    p_contact_value TEXT,
    p_source_system TEXT,
    p_source_record_id TEXT DEFAULT NULL,
    p_confidence_score INTEGER DEFAULT NULL,
    p_is_primary BOOLEAN DEFAULT FALSE,
    p_is_verified BOOLEAN DEFAULT FALSE,
    p_verification_method TEXT DEFAULT NULL,
    p_source_table TEXT DEFAULT NULL,
    p_source_field TEXT DEFAULT NULL,
    p_match_evidence JSONB DEFAULT '{}'::jsonb,
    p_notes TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_normalized_value TEXT;
    v_contact_id INTEGER;
    v_calculated_confidence INTEGER;
BEGIN
    v_normalized_value := CASE p_contact_type
        WHEN 'phone' THEN normalize_phone(p_contact_value)
        WHEN 'email' THEN normalize_email(p_contact_value)
        ELSE LOWER(TRIM(p_contact_value))
    END;

    IF v_normalized_value IS NULL OR v_normalized_value = '' THEN
        RAISE EXCEPTION 'Normalized contact value is empty for type %', p_contact_type;
    END IF;

    IF p_confidence_score IS NULL THEN
        v_calculated_confidence := get_source_base_confidence(p_source_system);
    ELSE
        v_calculated_confidence := p_confidence_score;
    END IF;

    INSERT INTO entity_contacts (
        entity_id,
        contact_type,
        contact_value,
        normalized_value,
        source_system,
        source_record_id,
        source_table,
        source_field,
        confidence_score,
        is_primary,
        is_verified,
        verification_method,
        match_evidence,
        notes,
        last_verified_at
    )
    VALUES (
        p_entity_id,
        p_contact_type,
        p_contact_value,
        v_normalized_value,
        p_source_system,
        p_source_record_id,
        p_source_table,
        p_source_field,
        v_calculated_confidence,
        p_is_primary,
        p_is_verified,
        p_verification_method,
        COALESCE(p_match_evidence, '{}'::jsonb),
        p_notes,
        CASE WHEN p_is_verified THEN NOW() ELSE NULL END
    )
    ON CONFLICT (entity_id, contact_type, normalized_value, source_system)
    DO UPDATE SET
        contact_value = EXCLUDED.contact_value,
        source_record_id = COALESCE(EXCLUDED.source_record_id, entity_contacts.source_record_id),
        source_table = COALESCE(EXCLUDED.source_table, entity_contacts.source_table),
        source_field = COALESCE(EXCLUDED.source_field, entity_contacts.source_field),
        confidence_score = GREATEST(entity_contacts.confidence_score, EXCLUDED.confidence_score),
        is_primary = entity_contacts.is_primary OR EXCLUDED.is_primary,
        is_verified = entity_contacts.is_verified OR EXCLUDED.is_verified,
        verification_method = COALESCE(EXCLUDED.verification_method, entity_contacts.verification_method),
        match_evidence = entity_contacts.match_evidence || EXCLUDED.match_evidence,
        notes = COALESCE(EXCLUDED.notes, entity_contacts.notes),
        last_seen_at = NOW(),
        last_verified_at = CASE
            WHEN EXCLUDED.is_verified THEN NOW()
            ELSE entity_contacts.last_verified_at
        END
    RETURNING id INTO v_contact_id;

    RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql;

-- Map entity to parcel
CREATE OR REPLACE FUNCTION map_entity_to_parcel(
    p_entity_id INTEGER,
    p_pin TEXT,
    p_owner_name_at_time TEXT DEFAULT NULL,
    p_mapping_confidence INTEGER DEFAULT 80,
    p_source_system TEXT DEFAULT 'unknown'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO entity_parcel_mappings (
        entity_id, pin, owner_name_at_time, mapping_confidence, source_system
    )
    VALUES (p_entity_id, p_pin, p_owner_name_at_time, p_mapping_confidence, p_source_system)
    ON CONFLICT (entity_id, pin, source_system)
    DO UPDATE SET
        mapping_confidence = GREATEST(entity_parcel_mappings.mapping_confidence, EXCLUDED.mapping_confidence),
        updated_at = NOW();
    
    -- Update entity parcel count
    UPDATE canonical_entities
    SET parcel_count = (
        SELECT COUNT(DISTINCT pin) 
        FROM entity_parcel_mappings 
        WHERE entity_id = p_entity_id
    )
    WHERE id = p_entity_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RETRIEVAL FUNCTIONS
-- ============================================================================

-- Get primary contacts for entity
CREATE OR REPLACE FUNCTION get_entity_primary_contacts(p_entity_id INTEGER)
RETURNS TABLE (
    contact_type TEXT,
    contact_value TEXT,
    confidence_score INTEGER,
    source_system TEXT,
    is_verified BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ec.contact_type,
        ec.contact_value,
        ec.confidence_score,
        ec.source_system,
        ec.is_verified
    FROM entity_contacts ec
    WHERE ec.entity_id = p_entity_id
      AND ec.is_primary = TRUE
      AND ec.confidence_score >= 70
    ORDER BY ec.contact_type, ec.confidence_score DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get all contacts for entity with confidence filtering
CREATE OR REPLACE FUNCTION get_entity_contacts(
    p_entity_id INTEGER,
    p_min_confidence INTEGER DEFAULT 50
)
RETURNS TABLE (
    id INTEGER,
    contact_type TEXT,
    contact_value TEXT,
    confidence_score INTEGER,
    source_system TEXT,
    is_primary BOOLEAN,
    is_verified BOOLEAN,
    first_seen_at TIMESTAMP WITH TIME ZONE,
    last_seen_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ec.id,
        ec.contact_type,
        ec.contact_value,
        ec.confidence_score,
        ec.source_system,
        ec.is_primary,
        ec.is_verified,
        ec.first_seen_at,
        ec.last_seen_at
    FROM entity_contacts ec
    WHERE ec.entity_id = p_entity_id
      AND ec.confidence_score >= p_min_confidence
    ORDER BY ec.contact_type, ec.confidence_score DESC, ec.last_seen_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get entities for parcel
CREATE OR REPLACE FUNCTION get_parcel_entities(p_pin TEXT)
RETURNS TABLE (
    entity_id INTEGER,
    canonical_name TEXT,
    entity_type TEXT,
    mapping_confidence INTEGER,
    primary_contacts JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        epm.entity_id,
        ce.canonical_name,
        ce.entity_type,
        epm.mapping_confidence,
        (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'type', ec.contact_type,
                'value', ec.contact_value,
                'confidence', ec.confidence_score,
                'source', ec.source_system
            )), '[]'::jsonb)
            FROM entity_contacts ec
            WHERE ec.entity_id = epm.entity_id
              AND ec.is_primary = TRUE
              AND ec.confidence_score >= 70
        ) as primary_contacts
    FROM entity_parcel_mappings epm
    JOIN canonical_entities ce ON ce.id = epm.entity_id
    WHERE epm.pin = p_pin
    ORDER BY epm.mapping_confidence DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get contact coverage statistics
CREATE OR REPLACE FUNCTION get_contact_coverage_stats()
RETURNS TABLE (
    entity_count BIGINT,
    entities_with_phone BIGINT,
    entities_with_email BIGINT,
    entities_with_address BIGINT,
    avg_confidence NUMERIC,
    high_confidence_entities BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM canonical_entities) as entity_count,
        (SELECT COUNT(DISTINCT entity_id) FROM entity_contacts 
         WHERE contact_type = 'phone' AND confidence_score >= 70) as entities_with_phone,
        (SELECT COUNT(DISTINCT entity_id) FROM entity_contacts 
         WHERE contact_type = 'email' AND confidence_score >= 70) as entities_with_email,
        (SELECT COUNT(DISTINCT entity_id) FROM entity_contacts 
         WHERE contact_type = 'mailing_address' AND confidence_score >= 70) as entities_with_address,
        (SELECT AVG(confidence_score)::NUMERIC FROM entity_contacts) as avg_confidence,
        (SELECT COUNT(DISTINCT entity_id) FROM entity_contacts 
         WHERE confidence_score >= 80) as high_confidence_entities;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- MAINTENANCE FUNCTIONS
-- ============================================================================

-- Mark stale contacts
CREATE OR REPLACE FUNCTION mark_stale_contacts(p_stale_threshold_months INTEGER DEFAULT 24)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE entity_contacts
    SET stale_after_date = NOW()
    WHERE last_seen_at < NOW() - (p_stale_threshold_months || ' months')::INTERVAL
      AND (stale_after_date IS NULL OR stale_after_date > NOW());
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Recalculate all confidence scores
CREATE OR REPLACE FUNCTION recalculate_all_confidence_scores()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    rec RECORD;
BEGIN
    PERFORM set_config('wow.contact_audit_enabled', 'off', true);

    FOR rec IN 
        SELECT id, source_system, match_evidence 
        FROM entity_contacts
    LOOP
        -- Recalculate based on stored evidence
        UPDATE entity_contacts
        SET confidence_score = calculate_contact_confidence(
            rec.source_system,
            COALESCE((rec.match_evidence->>'name_similarity')::NUMERIC, 0.8),
            COALESCE((rec.match_evidence->>'address_match')::BOOLEAN, FALSE),
            COALESCE((rec.match_evidence->>'exact_name')::BOOLEAN, FALSE),
            COALESCE((rec.match_evidence->>'entity_verified')::BOOLEAN, FALSE),
            EXTRACT(MONTH FROM AGE(NOW(), last_seen_at))::INTEGER
        )
        WHERE id = rec.id;
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION load_business_license_contacts(p_target_pins TEXT[] DEFAULT NULL)
RETURNS TABLE (
    inserted_entities BIGINT,
    inserted_aliases BIGINT,
    inserted_contacts BIGINT,
    inserted_mappings BIGINT
) AS $$
DECLARE
    v_inserted_entities BIGINT := 0;
    v_inserted_aliases BIGINT := 0;
    v_inserted_contacts BIGINT := 0;
    v_inserted_mappings BIGINT := 0;
BEGIN
    PERFORM set_config('wow.contact_audit_enabled', 'off', true);

    CREATE TEMP TABLE tmp_business_license_base ON COMMIT DROP AS
    WITH target_addresses AS (
        SELECT DISTINCT LOWER(TRIM(address)) AS normalized_address
        FROM wow_parcels
        WHERE p_target_pins IS NULL OR pin = ANY(p_target_pins)
    )
    SELECT DISTINCT
        COALESCE(NULLIF(TRIM(cbl.legal_name), ''), NULLIF(TRIM(cbl.doing_business_as_name), '')) AS entity_name,
        classify_entity_type(COALESCE(NULLIF(TRIM(cbl.legal_name), ''), NULLIF(TRIM(cbl.doing_business_as_name), ''))) AS entity_type,
        normalize_name(COALESCE(NULLIF(TRIM(cbl.legal_name), ''), NULLIF(TRIM(cbl.doing_business_as_name), ''))) AS normalized_name,
        NULLIF(TRIM(cbl.doing_business_as_name), '') AS dba_name,
        cbl.license_id,
        cbl.account_number,
        NULLIF(TRIM(cbl.address), '') AS source_address,
        NULLIF(TRIM(cbl.city), '') AS source_city,
        NULLIF(TRIM(cbl.state), '') AS source_state,
        NULLIF(TRIM(cbl.zip_code), '') AS source_zip,
        CONCAT_WS(', ', NULLIF(TRIM(cbl.address), ''), NULLIF(TRIM(cbl.city), ''), NULLIF(TRIM(cbl.state), ''), NULLIF(TRIM(cbl.zip_code), '')) AS mailing_address,
        LOWER(TRIM(CONCAT_WS(', ', NULLIF(TRIM(cbl.address), ''), NULLIF(TRIM(cbl.city), ''), NULLIF(TRIM(cbl.state), ''), NULLIF(TRIM(cbl.zip_code), '')))) AS normalized_mailing_address,
        LOWER(TRIM(cbl.address)) AS normalized_source_address
    FROM chi_business_licenses cbl
    WHERE COALESCE(NULLIF(TRIM(cbl.legal_name), ''), NULLIF(TRIM(cbl.doing_business_as_name), '')) IS NOT NULL
      AND NULLIF(TRIM(cbl.address), '') IS NOT NULL
      AND (
          p_target_pins IS NULL
          OR EXISTS (
              SELECT 1
              FROM target_addresses ta
              WHERE ta.normalized_address = LOWER(TRIM(cbl.address))
          )
      );

    WITH inserted AS (
        INSERT INTO canonical_entities (
            entity_type,
            canonical_name,
            normalized_name,
            source_count
        )
        SELECT DISTINCT
            base.entity_type,
            base.entity_name,
            base.normalized_name,
            1
        FROM tmp_business_license_base base
        WHERE base.normalized_name <> ''
        ON CONFLICT (normalized_name, entity_type) DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted_entities FROM inserted;

    CREATE TEMP TABLE tmp_business_license_entities ON COMMIT DROP AS
    SELECT DISTINCT
        ce.id AS entity_id,
        base.entity_name,
        base.entity_type,
        base.normalized_name,
        base.dba_name,
        base.license_id,
        base.account_number,
        base.source_address,
        base.source_city,
        base.source_state,
        base.source_zip,
        base.mailing_address,
        base.normalized_mailing_address,
        base.normalized_source_address
    FROM tmp_business_license_base base
    JOIN canonical_entities ce
      ON ce.normalized_name = base.normalized_name
     AND ce.entity_type = base.entity_type;

    WITH alias_source AS (
        SELECT DISTINCT
            entity_id,
            entity_name AS alias_name,
            normalized_name AS normalized_alias,
            100 AS match_confidence
        FROM tmp_business_license_entities
        UNION
        SELECT DISTINCT
            entity_id,
            dba_name AS alias_name,
            normalize_name(dba_name) AS normalized_alias,
            90 AS match_confidence
        FROM tmp_business_license_entities
        WHERE dba_name IS NOT NULL
          AND normalize_name(dba_name) <> normalized_name
    ), inserted AS (
        INSERT INTO entity_aliases (
            entity_id,
            alias_name,
            normalized_alias,
            source_system,
            match_confidence
        )
        SELECT
            alias_source.entity_id,
            alias_source.alias_name,
            alias_source.normalized_alias,
            'chi_business_licenses',
            alias_source.match_confidence
        FROM alias_source
        WHERE alias_source.normalized_alias <> ''
        ON CONFLICT (normalized_alias, source_system) DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted_aliases FROM inserted;

    WITH inserted AS (
        INSERT INTO entity_contacts (
            entity_id,
            contact_type,
            contact_value,
            normalized_value,
            source_system,
            source_record_id,
            source_table,
            source_field,
            confidence_score,
            match_evidence
        )
        SELECT DISTINCT
            entity_id,
            'mailing_address',
            mailing_address,
            normalized_mailing_address,
            'chi_business_licenses',
            license_id,
            'chi_business_licenses',
            'address',
            35,
            jsonb_build_object(
                'license_address', source_address,
                'license_city', source_city,
                'license_state', source_state,
                'license_zip', source_zip,
                'exact_name', true,
                'account_number', account_number
            )
        FROM tmp_business_license_entities
        WHERE mailing_address <> ''
        ON CONFLICT (entity_id, contact_type, normalized_value, source_system) DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted_contacts FROM inserted;

    WITH inserted AS (
        INSERT INTO entity_parcel_mappings (
            entity_id,
            pin,
            owner_name_at_time,
            mapping_confidence,
            source_system
        )
        SELECT DISTINCT
            be.entity_id,
            wp.pin,
            be.entity_name,
            75,
            'chi_business_licenses_address_link'
        FROM tmp_business_license_entities be
        JOIN wow_parcels wp
          ON LOWER(TRIM(wp.address)) = be.normalized_source_address
        WHERE p_target_pins IS NULL OR wp.pin = ANY(p_target_pins)
        ON CONFLICT (entity_id, pin, source_system) DO NOTHING
        RETURNING entity_id
    )
    SELECT COUNT(*) INTO v_inserted_mappings FROM inserted;

    UPDATE canonical_entities ce
    SET parcel_count = mapped.parcel_count
    FROM (
        SELECT entity_id, COUNT(DISTINCT pin) AS parcel_count
        FROM entity_parcel_mappings
        GROUP BY entity_id
    ) mapped
    WHERE ce.id = mapped.entity_id
      AND EXISTS (
          SELECT 1
          FROM tmp_business_license_entities be
          WHERE be.entity_id = mapped.entity_id
      );

    RETURN QUERY
    SELECT v_inserted_entities, v_inserted_aliases, v_inserted_contacts, v_inserted_mappings;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION load_foreclosed_rental_contacts(p_target_pins TEXT[] DEFAULT NULL)
RETURNS TABLE (
    inserted_entities BIGINT,
    inserted_aliases BIGINT,
    inserted_contacts BIGINT,
    inserted_mappings BIGINT
) AS $$
DECLARE
    v_inserted_entities BIGINT := 0;
    v_inserted_aliases BIGINT := 0;
    v_inserted_contacts BIGINT := 0;
    v_inserted_mappings BIGINT := 0;
BEGIN
    PERFORM set_config('wow.contact_audit_enabled', 'off', true);

    CREATE TEMP TABLE tmp_foreclosed_rental_base ON COMMIT DROP AS
    WITH target_addresses AS (
        SELECT DISTINCT LOWER(REGEXP_REPLACE(TRIM(address), '\s+', ' ', 'g')) AS normalized_address
        FROM wow_parcels
        WHERE p_target_pins IS NULL OR pin = ANY(p_target_pins)
    )
    SELECT DISTINCT
        NULLIF(TRIM(frp.id), '') AS source_record_id,
        NULLIF(TRIM(frp.owner_name), '') AS entity_name,
        classify_entity_type(NULLIF(TRIM(frp.owner_name), '')) AS entity_type,
        normalize_name(NULLIF(TRIM(frp.owner_name), '')) AS normalized_name,
        NULLIF(TRIM(frp.property_address), '') AS property_address,
        LOWER(REGEXP_REPLACE(TRIM(COALESCE(frp.property_address, '')), '\s+', ' ', 'g')) AS normalized_property_address,
        CONCAT_WS(', ', NULLIF(TRIM(frp.owner_address), ''), NULLIF(TRIM(frp.owner_city), ''), NULLIF(TRIM(frp.owner_state), ''), NULLIF(TRIM(frp.owner_zip), '')) AS owner_mailing_address,
        LOWER(TRIM(CONCAT_WS(', ', NULLIF(TRIM(frp.owner_address), ''), NULLIF(TRIM(frp.owner_city), ''), NULLIF(TRIM(frp.owner_state), ''), NULLIF(TRIM(frp.owner_zip), '')))) AS normalized_owner_mailing_address,
        CONCAT_WS(', ', NULLIF(TRIM(frp.owner_management_agent_address), ''), NULLIF(TRIM(frp.owner_management_agent_city), ''), NULLIF(TRIM(frp.owner_management_agent_state), ''), NULLIF(TRIM(frp.owner_management_agent_zip), '')) AS management_mailing_address,
        LOWER(TRIM(CONCAT_WS(', ', NULLIF(TRIM(frp.owner_management_agent_address), ''), NULLIF(TRIM(frp.owner_management_agent_city), ''), NULLIF(TRIM(frp.owner_management_agent_state), ''), NULLIF(TRIM(frp.owner_management_agent_zip), '')))) AS normalized_management_mailing_address,
        NULLIF(TRIM(frp.owner_management_agent_name), '') AS management_agent_name,
        NULLIF(TRIM(frp.owner_notices_agent_name), '') AS notices_agent_name,
        NULLIF(TRIM(frp.owner_notices_agent_phone), '') AS notices_agent_phone,
        NULLIF(TRIM(frp.owner_notices_agent_email), '') AS notices_agent_email
    FROM chi_foreclosed_rental_properties frp
    WHERE NULLIF(TRIM(frp.owner_name), '') IS NOT NULL
      AND NULLIF(TRIM(frp.property_address), '') IS NOT NULL
      AND (
          p_target_pins IS NULL
          OR EXISTS (
              SELECT 1
              FROM target_addresses ta
              WHERE ta.normalized_address = LOWER(REGEXP_REPLACE(TRIM(COALESCE(frp.property_address, '')), '\s+', ' ', 'g'))
          )
      );

    WITH inserted AS (
        INSERT INTO canonical_entities (
            entity_type,
            canonical_name,
            normalized_name,
            source_count
        )
        SELECT DISTINCT
            base.entity_type,
            base.entity_name,
            base.normalized_name,
            1
        FROM tmp_foreclosed_rental_base base
        WHERE base.normalized_name <> ''
        ON CONFLICT (normalized_name, entity_type) DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted_entities FROM inserted;

    CREATE TEMP TABLE tmp_foreclosed_rental_entities ON COMMIT DROP AS
    SELECT DISTINCT
        ce.id AS entity_id,
        base.source_record_id,
        base.entity_name,
        base.entity_type,
        base.normalized_name,
        base.property_address,
        base.normalized_property_address,
        base.owner_mailing_address,
        base.normalized_owner_mailing_address,
        base.management_mailing_address,
        base.normalized_management_mailing_address,
        base.management_agent_name,
        base.notices_agent_name,
        base.notices_agent_phone,
        base.notices_agent_email
    FROM tmp_foreclosed_rental_base base
    JOIN canonical_entities ce
      ON ce.normalized_name = base.normalized_name
     AND ce.entity_type = base.entity_type;

    WITH inserted AS (
        INSERT INTO entity_aliases (
            entity_id,
            alias_name,
            normalized_alias,
            source_system,
            match_confidence
        )
        SELECT DISTINCT
            entity_id,
            entity_name,
            normalized_name,
            'chi_foreclosed_rental_properties',
            100
        FROM tmp_foreclosed_rental_entities
        WHERE normalized_name <> ''
        ON CONFLICT (normalized_alias, source_system) DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted_aliases FROM inserted;

    WITH contact_rows AS (
        SELECT DISTINCT
            entity_id,
            'mailing_address'::text AS contact_type,
            owner_mailing_address AS contact_value,
            normalized_owner_mailing_address AS normalized_value,
            source_record_id,
            'owner_address'::text AS source_field,
            85::integer AS confidence_score,
            jsonb_build_object(
                'role', 'direct_owner',
                'property_address', property_address,
                'exact_name', true,
                'address_match', true,
                'entity_verified', true
            ) AS match_evidence,
            'Foreclosed rental registration owner mailing address'::text AS notes
        FROM tmp_foreclosed_rental_entities
        WHERE owner_mailing_address <> ''

        UNION ALL

        SELECT DISTINCT
            entity_id,
            'mailing_address'::text AS contact_type,
            management_mailing_address AS contact_value,
            normalized_management_mailing_address AS normalized_value,
            source_record_id,
            'owner_management_agent_address'::text AS source_field,
            75::integer AS confidence_score,
            jsonb_build_object(
                'role', 'property_manager',
                'property_address', property_address,
                'management_agent_name', management_agent_name,
                'address_match', true,
                'entity_verified', true
            ) AS match_evidence,
            COALESCE('Foreclosed rental management agent address: ' || management_agent_name, 'Foreclosed rental management agent address') AS notes
        FROM tmp_foreclosed_rental_entities
        WHERE management_mailing_address <> ''

        UNION ALL

        SELECT DISTINCT
            entity_id,
            'phone'::text AS contact_type,
            notices_agent_phone AS contact_value,
            normalize_phone(notices_agent_phone) AS normalized_value,
            source_record_id,
            'owner_notices_agent_phone'::text AS source_field,
            80::integer AS confidence_score,
            jsonb_build_object(
                'role', 'property_manager',
                'property_address', property_address,
                'notices_agent_name', notices_agent_name,
                'entity_verified', true
            ) AS match_evidence,
            COALESCE('Foreclosed rental notices agent phone: ' || notices_agent_name, 'Foreclosed rental notices agent phone') AS notes
        FROM tmp_foreclosed_rental_entities
        WHERE notices_agent_phone IS NOT NULL
          AND normalize_phone(notices_agent_phone) <> ''

        UNION ALL

        SELECT DISTINCT
            entity_id,
            'email'::text AS contact_type,
            notices_agent_email AS contact_value,
            normalize_email(notices_agent_email) AS normalized_value,
            source_record_id,
            'owner_notices_agent_email'::text AS source_field,
            80::integer AS confidence_score,
            jsonb_build_object(
                'role', 'property_manager',
                'property_address', property_address,
                'notices_agent_name', notices_agent_name,
                'entity_verified', true
            ) AS match_evidence,
            COALESCE('Foreclosed rental notices agent email: ' || notices_agent_name, 'Foreclosed rental notices agent email') AS notes
        FROM tmp_foreclosed_rental_entities
        WHERE notices_agent_email IS NOT NULL
          AND normalize_email(notices_agent_email) <> ''
    ), deduped_contact_rows AS (
        SELECT DISTINCT ON (entity_id, contact_type, normalized_value)
            entity_id,
            contact_type,
            contact_value,
            normalized_value,
            source_record_id,
            source_field,
            confidence_score,
            match_evidence,
            notes
        FROM contact_rows
        WHERE normalized_value IS NOT NULL
          AND normalized_value <> ''
        ORDER BY entity_id, contact_type, normalized_value, confidence_score DESC, source_record_id
    ), inserted AS (
        INSERT INTO entity_contacts (
            entity_id,
            contact_type,
            contact_value,
            normalized_value,
            source_system,
            source_record_id,
            source_table,
            source_field,
            confidence_score,
            match_evidence,
            notes
        )
        SELECT
            entity_id,
            contact_type,
            contact_value,
            normalized_value,
            'chi_foreclosed_rental_properties',
            source_record_id,
            'chi_foreclosed_rental_properties',
            source_field,
            confidence_score,
            match_evidence,
            notes
        FROM deduped_contact_rows
        ON CONFLICT (entity_id, contact_type, normalized_value, source_system)
        DO UPDATE SET
            contact_value = EXCLUDED.contact_value,
            source_record_id = COALESCE(EXCLUDED.source_record_id, entity_contacts.source_record_id),
            source_table = EXCLUDED.source_table,
            source_field = EXCLUDED.source_field,
            confidence_score = GREATEST(entity_contacts.confidence_score, EXCLUDED.confidence_score),
            match_evidence = entity_contacts.match_evidence || EXCLUDED.match_evidence,
            notes = COALESCE(EXCLUDED.notes, entity_contacts.notes),
            last_seen_at = NOW()
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted_contacts FROM inserted;

    WITH inserted AS (
        INSERT INTO entity_parcel_mappings (
            entity_id,
            pin,
            owner_name_at_time,
            mapping_confidence,
            source_system
        )
        SELECT DISTINCT
            fre.entity_id,
            wp.pin,
            fre.entity_name,
            90,
            'chi_foreclosed_rental_properties_address_link'
        FROM tmp_foreclosed_rental_entities fre
        JOIN wow_parcels wp
          ON LOWER(REGEXP_REPLACE(TRIM(wp.address), '\s+', ' ', 'g')) = fre.normalized_property_address
        WHERE p_target_pins IS NULL OR wp.pin = ANY(p_target_pins)
        ON CONFLICT (entity_id, pin, source_system) DO NOTHING
        RETURNING entity_id
    )
    SELECT COUNT(*) INTO v_inserted_mappings FROM inserted;

    UPDATE canonical_entities ce
    SET parcel_count = mapped.parcel_count
    FROM (
        SELECT entity_id, COUNT(DISTINCT pin) AS parcel_count
        FROM entity_parcel_mappings
        GROUP BY entity_id
    ) mapped
    WHERE ce.id = mapped.entity_id
      AND EXISTS (
          SELECT 1
          FROM tmp_foreclosed_rental_entities fre
          WHERE fre.entity_id = mapped.entity_id
      );

    RETURN QUERY
    SELECT v_inserted_entities, v_inserted_aliases, v_inserted_contacts, v_inserted_mappings;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION load_building_permit_contacts(p_target_pins TEXT[] DEFAULT NULL)
RETURNS TABLE (
    inserted_entities BIGINT,
    inserted_aliases BIGINT,
    inserted_contacts BIGINT,
    inserted_mappings BIGINT
) AS $$
DECLARE
    v_inserted_entities BIGINT := 0;
    v_inserted_aliases BIGINT := 0;
    v_inserted_contacts BIGINT := 0;
    v_inserted_mappings BIGINT := 0;
BEGIN
    PERFORM set_config('wow.contact_audit_enabled', 'off', true);

    CREATE TEMP TABLE tmp_building_permit_base ON COMMIT DROP AS
    WITH permits_expanded AS (
        SELECT
            NULLIF(TRIM(COALESCE(cp.id, cp.permit_)), '') AS source_record_id,
            NULLIF(TRIM(cp.permit_), '') AS permit_number,
            trim(pin_value) AS pin10,
            NULLIF(TRIM(CONCAT_WS(' ', cp.street_number, cp.street_direction, cp.street_name)), '') AS property_address,
            UPPER(REGEXP_REPLACE(TRIM(CONCAT_WS(' ', cp.street_number, cp.street_direction, cp.street_name)), '\s+', ' ', 'g')) AS property_address_norm,
            v.contact_role,
            NULLIF(TRIM(v.contact_name), '') AS contact_name,
            NULLIF(TRIM(v.contact_city), '') AS contact_city,
            NULLIF(TRIM(v.contact_state), '') AS contact_state,
            NULLIF(TRIM(v.contact_zip), '') AS contact_zip
        FROM chi_permits cp
        CROSS JOIN LATERAL unnest(
            regexp_split_to_array(coalesce(cp.pin_list, ''), '\s*\|\s*')
        ) AS pin_value
        CROSS JOIN LATERAL (
            VALUES
                (cp.contact_1_type, cp.contact_1_name, cp.contact_1_city, cp.contact_1_state, cp.contact_1_zipcode),
                (cp.contact_2_type, cp.contact_2_name, cp.contact_2_city, cp.contact_2_state, cp.contact_2_zipcode),
                (cp.contact_3_type, cp.contact_3_name, cp.contact_3_city, cp.contact_3_state, cp.contact_3_zipcode),
                (cp.contact_4_type, cp.contact_4_name, cp.contact_4_city, cp.contact_4_state, cp.contact_4_zipcode),
                (cp.contact_5_type, cp.contact_5_name, cp.contact_5_city, cp.contact_5_state, cp.contact_5_zipcode),
                (cp.contact_6_type, cp.contact_6_name, cp.contact_6_city, cp.contact_6_state, cp.contact_6_zipcode),
                (cp.contact_7_type, cp.contact_7_name, cp.contact_7_city, cp.contact_7_state, cp.contact_7_zipcode),
                (cp.contact_8_type, cp.contact_8_name, cp.contact_8_city, cp.contact_8_state, cp.contact_8_zipcode),
                (cp.contact_9_type, cp.contact_9_name, cp.contact_9_city, cp.contact_9_state, cp.contact_9_zipcode),
                (cp.contact_10_type, cp.contact_10_name, cp.contact_10_city, cp.contact_10_state, cp.contact_10_zipcode),
                (cp.contact_11_type, cp.contact_11_name, cp.contact_11_city, cp.contact_11_state, cp.contact_11_zipcode),
                (cp.contact_12_type, cp.contact_12_name, cp.contact_12_city, cp.contact_12_state, cp.contact_12_zipcode),
                (cp.contact_13_type, cp.contact_13_name, cp.contact_13_city, cp.contact_13_state, cp.contact_13_zipcode),
                (cp.contact_14_type, cp.contact_14_name, cp.contact_14_city, cp.contact_14_state, cp.contact_14_zipcode),
                (cp.contact_15_type, cp.contact_15_name, cp.contact_15_city, cp.contact_15_state, cp.contact_15_zipcode)
        ) AS v(contact_role, contact_name, contact_city, contact_state, contact_zip)
        WHERE pin_value <> ''
          AND NULLIF(TRIM(v.contact_name), '') IS NOT NULL
    )
    SELECT DISTINCT
        pe.source_record_id,
        pe.permit_number,
        wp.pin,
        pe.pin10,
        pe.property_address,
        pe.property_address_norm,
        pe.contact_role,
        pe.contact_name,
        classify_entity_type(pe.contact_name) AS entity_type,
        normalize_name(pe.contact_name) AS normalized_name,
        pe.contact_city,
        pe.contact_state,
        pe.contact_zip
    FROM permits_expanded pe
    JOIN wow_parcels wp ON wp.pin10 = pe.pin10
    WHERE p_target_pins IS NULL OR wp.pin = ANY(p_target_pins);

    WITH inserted AS (
        INSERT INTO canonical_entities (
            entity_type,
            canonical_name,
            normalized_name,
            source_count
        )
        SELECT DISTINCT
            base.entity_type,
            base.contact_name,
            base.normalized_name,
            1
        FROM tmp_building_permit_base base
        WHERE base.normalized_name <> ''
        ON CONFLICT (normalized_name, entity_type) DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted_entities FROM inserted;

    CREATE TEMP TABLE tmp_building_permit_entities ON COMMIT DROP AS
    SELECT DISTINCT
        ce.id AS entity_id,
        base.source_record_id,
        base.permit_number,
        base.pin,
        base.pin10,
        base.property_address,
        base.property_address_norm,
        base.contact_role,
        base.contact_name,
        base.entity_type,
        base.normalized_name,
        base.contact_city,
        base.contact_state,
        base.contact_zip
    FROM tmp_building_permit_base base
    JOIN canonical_entities ce
      ON ce.normalized_name = base.normalized_name
     AND ce.entity_type = base.entity_type;

    WITH inserted AS (
        INSERT INTO entity_aliases (
            entity_id,
            alias_name,
            normalized_alias,
            source_system,
            match_confidence
        )
        SELECT DISTINCT
            entity_id,
            contact_name,
            normalized_name,
            'chi_permits',
            95
        FROM tmp_building_permit_entities
        WHERE normalized_name <> ''
        ON CONFLICT (normalized_alias, source_system) DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted_aliases FROM inserted;

    WITH owner_site_contacts AS (
        SELECT DISTINCT ON (entity_id, LOWER(TRIM(property_address)))
            entity_id,
            property_address,
            LOWER(TRIM(property_address)) AS normalized_property_address,
            source_record_id,
            permit_number,
            contact_role,
            pin,
            pin10
        FROM tmp_building_permit_entities
        WHERE property_address IS NOT NULL
          AND contact_role IS NOT NULL
          AND UPPER(contact_role) LIKE '%OWNER%'
        ORDER BY entity_id, LOWER(TRIM(property_address)), source_record_id
    ), inserted AS (
        INSERT INTO entity_contacts (
            entity_id,
            contact_type,
            contact_value,
            normalized_value,
            source_system,
            source_record_id,
            source_table,
            source_field,
            confidence_score,
            match_evidence,
            notes
        )
        SELECT
            entity_id,
            'mailing_address',
            property_address,
            normalized_property_address,
            'chi_permits',
            source_record_id,
            'chi_permits',
            'property_address',
            25,
            jsonb_build_object(
                'role', 'owner_site_address',
                'permit_number', permit_number,
                'permit_contact_role', contact_role,
                'pin', pin,
                'pin10', pin10,
                'address_match', true,
                'entity_verified', false
            ),
            'Building permit owner-labeled property site address'
        FROM owner_site_contacts
        ON CONFLICT (entity_id, contact_type, normalized_value, source_system)
        DO UPDATE SET
            contact_value = EXCLUDED.contact_value,
            source_record_id = COALESCE(EXCLUDED.source_record_id, entity_contacts.source_record_id),
            source_table = EXCLUDED.source_table,
            source_field = EXCLUDED.source_field,
            confidence_score = GREATEST(entity_contacts.confidence_score, EXCLUDED.confidence_score),
            match_evidence = entity_contacts.match_evidence || EXCLUDED.match_evidence,
            notes = COALESCE(EXCLUDED.notes, entity_contacts.notes),
            last_seen_at = NOW()
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted_contacts FROM inserted;

    WITH inserted AS (
        INSERT INTO entity_parcel_mappings (
            entity_id,
            pin,
            owner_name_at_time,
            mapping_confidence,
            source_system
        )
        SELECT DISTINCT
            entity_id,
            pin,
            contact_name,
            CASE WHEN UPPER(COALESCE(contact_role, '')) LIKE '%OWNER%' THEN 65 ELSE 50 END,
            CASE WHEN UPPER(COALESCE(contact_role, '')) LIKE '%OWNER%'
                THEN 'chi_permits_owner_contact_link'
                ELSE 'chi_permits_operator_contact_link'
            END
        FROM tmp_building_permit_entities
        ON CONFLICT (entity_id, pin, source_system) DO NOTHING
        RETURNING entity_id
    )
    SELECT COUNT(*) INTO v_inserted_mappings FROM inserted;

    UPDATE canonical_entities ce
    SET parcel_count = mapped.parcel_count
    FROM (
        SELECT entity_id, COUNT(DISTINCT pin) AS parcel_count
        FROM entity_parcel_mappings
        GROUP BY entity_id
    ) mapped
    WHERE ce.id = mapped.entity_id
      AND EXISTS (
          SELECT 1
          FROM tmp_building_permit_entities bpe
          WHERE bpe.entity_id = mapped.entity_id
      );

    RETURN QUERY
    SELECT v_inserted_entities, v_inserted_aliases, v_inserted_contacts, v_inserted_mappings;
END;
$$ LANGUAGE plpgsql;

-- Audit log function
CREATE OR REPLACE FUNCTION log_contact_change()
RETURNS TRIGGER AS $$
BEGIN
    IF COALESCE(current_setting('wow.contact_audit_enabled', true), 'on') IN ('off', 'false', '0') THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF TG_OP = 'UPDATE' THEN
        INSERT INTO contact_audit_log (
            contact_id, entity_id, action, old_values, new_values
        )
        VALUES (
            NEW.id,
            NEW.entity_id,
            'update',
            jsonb_build_object(
                'confidence_score', OLD.confidence_score,
                'is_primary', OLD.is_primary,
                'is_verified', OLD.is_verified
            ),
            jsonb_build_object(
                'confidence_score', NEW.confidence_score,
                'is_primary', NEW.is_primary,
                'is_verified', NEW.is_verified
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO contact_audit_log (
            contact_id, entity_id, action, old_values
        )
        VALUES (
            OLD.id,
            OLD.entity_id,
            'delete',
            jsonb_build_object(
                'contact_type', OLD.contact_type,
                'contact_value', OLD.contact_value,
                'source_system', OLD.source_system
            )
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger
DROP TRIGGER IF EXISTS contact_audit_trigger ON entity_contacts;
CREATE TRIGGER contact_audit_trigger
    AFTER UPDATE OR DELETE ON entity_contacts
    FOR EACH ROW EXECUTE FUNCTION log_contact_change();
