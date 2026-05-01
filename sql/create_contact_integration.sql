-- Contact Data Integration Script
-- Run this after initial contact ingestion to build derived views and indexes
-- Part of the contact-data-strategies implementation

-- ============================================================================
-- DERIVED VIEWS FOR API CONSUMPTION
-- ============================================================================

-- View: Entity contact summary (one row per entity with aggregated contacts)
DROP VIEW IF EXISTS v_parcel_entity_summary;
DROP VIEW IF EXISTS v_entity_contact_summary;
CREATE VIEW v_entity_contact_summary AS
SELECT 
    ce.id as entity_id,
    ce.entity_type,
    ce.canonical_name,
    ce.parcel_count,
    -- Primary contacts by type
    (SELECT contact_value FROM entity_contacts 
     WHERE entity_id = ce.id AND contact_type = 'phone' AND is_primary = TRUE 
     ORDER BY confidence_score DESC LIMIT 1) as primary_phone,
    (SELECT contact_value FROM entity_contacts 
     WHERE entity_id = ce.id AND contact_type = 'email' AND is_primary = TRUE 
     ORDER BY confidence_score DESC LIMIT 1) as primary_email,
    (SELECT contact_value FROM entity_contacts 
     WHERE entity_id = ce.id AND contact_type = 'mailing_address' AND is_primary = TRUE 
     ORDER BY confidence_score DESC LIMIT 1) as primary_address,
    -- Contact counts
    COUNT(DISTINCT CASE WHEN ec.contact_type = 'phone' THEN ec.id END) as phone_count,
    COUNT(DISTINCT CASE WHEN ec.contact_type = 'email' THEN ec.id END) as email_count,
    COUNT(DISTINCT CASE WHEN ec.contact_type = 'mailing_address' THEN ec.id END) as address_count,
    -- High confidence counts
    COUNT(DISTINCT CASE WHEN ec.contact_type = 'phone' AND ec.confidence_score >= 70 THEN ec.id END) as high_conf_phone_count,
    COUNT(DISTINCT CASE WHEN ec.contact_type = 'email' AND ec.confidence_score >= 70 THEN ec.id END) as high_conf_email_count,
    -- Average confidence by type
    AVG(CASE WHEN ec.contact_type = 'phone' THEN ec.confidence_score END)::numeric(5,2) as avg_phone_confidence,
    AVG(CASE WHEN ec.contact_type = 'email' THEN ec.confidence_score END)::numeric(5,2) as avg_email_confidence,
    -- Sources
    ARRAY_AGG(DISTINCT ec.source_system) FILTER (WHERE ec.source_system IS NOT NULL) as sources,
    -- Entity metadata
    ce.il_sos_file_number,
    ce.first_seen_at,
    ce.last_seen_at
FROM canonical_entities ce
LEFT JOIN entity_contacts ec ON ce.id = ec.entity_id
GROUP BY ce.id, ce.entity_type, ce.canonical_name, ce.parcel_count, ce.il_sos_file_number, ce.first_seen_at, ce.last_seen_at;

-- View: Parcel entity summary (enriched parcel view with entity contacts)
CREATE VIEW v_parcel_entity_summary AS
SELECT 
    wp.pin,
    wp.address,
    wp.city,
    wp.state,
    wp.zip,
    -- Entity info
    ce.id as entity_id,
    ce.canonical_name as entity_name,
    ce.entity_type,
    epm.mapping_confidence,
    epm.owner_name_at_time,
    -- Contact info
    ecs.primary_phone,
    ecs.primary_email,
    ecs.primary_address,
    -- Source info
    ecs.sources as entity_sources
FROM wow_parcels wp
LEFT JOIN entity_parcel_mappings epm ON wp.pin = epm.pin
LEFT JOIN canonical_entities ce ON epm.entity_id = ce.id
LEFT JOIN v_entity_contact_summary ecs ON ce.id = ecs.entity_id
WHERE epm.mapping_confidence >= 50 OR epm.mapping_confidence IS NULL;

-- View: Contact quality metrics by source
DROP VIEW IF EXISTS v_contact_quality_by_source;
CREATE VIEW v_contact_quality_by_source AS
SELECT 
    source_system,
    contact_type,
    COUNT(*) as contact_count,
    COUNT(DISTINCT entity_id) as entity_count,
    AVG(confidence_score)::numeric(5,2) as avg_confidence,
    MIN(confidence_score) as min_confidence,
    MAX(confidence_score) as max_confidence,
    COUNT(*) FILTER (WHERE confidence_score >= 80) as high_confidence_count,
    COUNT(*) FILTER (WHERE confidence_score >= 70 AND confidence_score < 80) as medium_confidence_count,
    COUNT(*) FILTER (WHERE confidence_score < 70) as low_confidence_count,
    COUNT(*) FILTER (WHERE is_primary = TRUE) as primary_count,
    COUNT(*) FILTER (WHERE is_verified = TRUE) as verified_count,
    MAX(last_seen_at) as last_activity
FROM entity_contacts
GROUP BY source_system, contact_type
ORDER BY source_system, contact_type;

-- View: Stale contacts requiring review
DROP VIEW IF EXISTS v_stale_contacts;
CREATE VIEW v_stale_contacts AS
SELECT 
    ec.id as contact_id,
    ec.entity_id,
    ce.canonical_name as entity_name,
    ec.contact_type,
    ec.contact_value,
    ec.confidence_score,
    ec.source_system,
    ec.first_seen_at,
    ec.last_seen_at,
    ec.stale_after_date,
    EXTRACT(DAYS FROM (NOW() - ec.last_seen_at)) as days_since_seen
FROM entity_contacts ec
JOIN canonical_entities ce ON ec.entity_id = ce.id
WHERE ec.stale_after_date IS NOT NULL 
   OR ec.last_seen_at < NOW() - INTERVAL '24 months'
ORDER BY ec.last_seen_at ASC;

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Index for parcel entity lookups
CREATE INDEX IF NOT EXISTS idx_entity_parcel_pin_lookup 
ON entity_parcel_mappings(pin, mapping_confidence DESC);

-- Index for high-confidence contact retrieval
CREATE INDEX IF NOT EXISTS idx_entity_contacts_high_conf 
ON entity_contacts(entity_id, contact_type, confidence_score DESC) 
WHERE confidence_score >= 70;

-- Index for source-based queries
CREATE INDEX IF NOT EXISTS idx_entity_contacts_source_lookup 
ON entity_contacts(source_system, contact_type, last_seen_at DESC);

-- Index for stale contact detection
CREATE INDEX IF NOT EXISTS idx_entity_contacts_stale 
ON entity_contacts(last_seen_at);

-- ============================================================================
-- MAINTENANCE PROCEDURES
-- ============================================================================

-- Function: Refresh contact materialized caches (if needed)
CREATE OR REPLACE FUNCTION refresh_contact_views()
RETURNS void AS $$
BEGIN
    -- Views are auto-refreshing, but this function can be extended
    -- if materialized views are added in the future
    RAISE NOTICE 'Contact views refreshed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Function: Mark contacts as primary based on confidence
CREATE OR REPLACE FUNCTION auto_assign_primary_contacts()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- For each entity and contact type, mark the highest confidence as primary
    UPDATE entity_contacts ec
    SET is_primary = TRUE
    FROM (
        SELECT DISTINCT ON (entity_id, contact_type)
            id
        FROM entity_contacts
        WHERE confidence_score >= 70
        ORDER BY entity_id, contact_type, confidence_score DESC, last_seen_at DESC
    ) best_contacts
    WHERE ec.id = best_contacts.id
      AND (ec.is_primary = FALSE OR ec.is_primary IS NULL);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
