-- Contact Data Schema: Entity Resolution and Contact Enrichment
-- Part of the contact-data-strategies implementation

-- Enable trigram extension for fuzzy matching if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Canonical entities table: normalized owner/company identities
CREATE TABLE IF NOT EXISTS canonical_entities (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('individual', 'business', 'unknown')),
    canonical_name VARCHAR(500) NOT NULL,
    normalized_name VARCHAR(500) NOT NULL,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source_count INTEGER DEFAULT 0,
    parcel_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- For business entities
    il_sos_file_number VARCHAR(50),
    fein VARCHAR(50),
    
    -- For individuals
    first_name VARCHAR(200),
    last_name VARCHAR(200),
    
    CONSTRAINT unique_normalized_name UNIQUE (normalized_name, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_canonical_entities_normalized_name ON canonical_entities USING gin(normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_canonical_entities_canonical_name ON canonical_entities USING gin(canonical_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_canonical_entities_type ON canonical_entities(entity_type);

-- Entity aliases: variations of names that map to canonical entity
CREATE TABLE IF NOT EXISTS entity_aliases (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,
    alias_name VARCHAR(500) NOT NULL,
    normalized_alias VARCHAR(500) NOT NULL,
    source_system VARCHAR(100) NOT NULL,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    match_confidence INTEGER CHECK (match_confidence >= 0 AND match_confidence <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_alias UNIQUE (normalized_alias, source_system)
);

ALTER TABLE entity_aliases
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_entity_aliases_entity_id ON entity_aliases(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_normalized ON entity_aliases USING gin(normalized_alias gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_source ON entity_aliases(source_system);

-- Entity contacts: phone/email with provenance and confidence
CREATE TABLE IF NOT EXISTS entity_contacts (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,
    contact_type VARCHAR(20) NOT NULL CHECK (contact_type IN ('phone', 'email', 'mailing_address', 'website')),
    contact_value VARCHAR(500) NOT NULL,
    normalized_value VARCHAR(500) NOT NULL,
    
    -- Source provenance
    source_system VARCHAR(100) NOT NULL,
    source_record_id VARCHAR(200),
    source_table VARCHAR(100),
    source_field VARCHAR(100),
    
    -- Confidence and quality
    confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
    is_primary BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_method VARCHAR(50),
    
    -- Match evidence
    match_evidence JSONB DEFAULT '{}',
    
    -- Timestamps
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_verified_at TIMESTAMP WITH TIME ZONE,
    stale_after_date TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_contact UNIQUE (entity_id, contact_type, normalized_value, source_system)
);

CREATE INDEX IF NOT EXISTS idx_entity_contacts_entity_id ON entity_contacts(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_contacts_type ON entity_contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_entity_contacts_confidence ON entity_contacts(confidence_score);
CREATE INDEX IF NOT EXISTS idx_entity_contacts_primary ON entity_contacts(entity_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_entity_contacts_source ON entity_contacts(source_system);

-- Entity to parcel mapping (many-to-many)
CREATE TABLE IF NOT EXISTS entity_parcel_mappings (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,
    pin VARCHAR(20) NOT NULL,
    owner_name_at_time VARCHAR(500),
    mapping_confidence INTEGER CHECK (mapping_confidence >= 0 AND mapping_confidence <= 100),
    first_seen_year INTEGER,
    last_seen_year INTEGER,
    source_system VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_entity_parcel UNIQUE (entity_id, pin, source_system)
);

CREATE INDEX IF NOT EXISTS idx_entity_parcel_entity_id ON entity_parcel_mappings(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_parcel_pin ON entity_parcel_mappings(pin);
CREATE INDEX IF NOT EXISTS idx_entity_parcel_confidence ON entity_parcel_mappings(mapping_confidence);

-- Contact audit log for tracking changes and manual overrides
CREATE TABLE IF NOT EXISTS contact_audit_log (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES entity_contacts(id) ON DELETE SET NULL,
    entity_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    performed_by VARCHAR(200),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_contact_audit_entity ON contact_audit_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_contact_audit_action ON contact_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_contact_audit_performed_at ON contact_audit_log(performed_at);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Normalize name for matching
CREATE OR REPLACE FUNCTION normalize_name(input_name TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(REGEXP_REPLACE(
        REGEXP_REPLACE(
            REGEXP_REPLACE(input_name, '\s+', ' ', 'g'),
            '[^a-zA-Z0-9\s]', '', 'g'
        ),
        '\s+', ' ', 'g'
    ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Normalize phone number
CREATE OR REPLACE FUNCTION normalize_phone(phone TEXT)
RETURNS TEXT AS $$
DECLARE
    digits TEXT;
BEGIN
    digits := REGEXP_REPLACE(phone, '[^0-9]', '', 'g');
    -- Return last 10 digits (handle country codes)
    IF LENGTH(digits) > 10 THEN
        RETURN RIGHT(digits, 10);
    END IF;
    RETURN digits;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Normalize email
CREATE OR REPLACE FUNCTION normalize_email(email TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(TRIM(email));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate name similarity using trigram
CREATE OR REPLACE FUNCTION name_similarity(name1 TEXT, name2 TEXT)
RETURNS NUMERIC AS $$
BEGIN
    RETURN similarity(normalize_name(name1), normalize_name(name2));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
DROP TRIGGER IF EXISTS update_canonical_entities_updated_at ON canonical_entities;
CREATE TRIGGER update_canonical_entities_updated_at
    BEFORE UPDATE ON canonical_entities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_entity_aliases_updated_at ON entity_aliases;
CREATE TRIGGER update_entity_aliases_updated_at
    BEFORE UPDATE ON entity_aliases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_entity_contacts_updated_at ON entity_contacts;
CREATE TRIGGER update_entity_contacts_updated_at
    BEFORE UPDATE ON entity_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_entity_parcel_mappings_updated_at ON entity_parcel_mappings;
CREATE TRIGGER update_entity_parcel_mappings_updated_at
    BEFORE UPDATE ON entity_parcel_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
