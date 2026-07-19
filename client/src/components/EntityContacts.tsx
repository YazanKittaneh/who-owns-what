import React, { useEffect, useState } from "react";
import Client, {
  EntityContact,
  EntityContactsResult,
  ParcelEntity,
  ParcelEntitiesResult,
} from "./APIClient";
import Loader from "./Loader";
import "./EntityContacts.scss";

interface EntityContactsProps {
  pin?: string;
  entityId?: number;
  minConfidence?: number;
}

interface ContactDisplayProps {
  contact: EntityContact;
}

const ContactDisplay: React.FC<ContactDisplayProps> = ({ contact }) => {
  const getIcon = () => {
    switch (contact.type) {
      case "phone":
        return "📞";
      case "email":
        return "✉️";
      case "mailing_address":
        return "📍";
      default:
        return "📋";
    }
  };

  const getConfidenceClass = (score: number) => {
    if (score >= 80) return "high";
    if (score >= 70) return "medium";
    return "low";
  };

  return (
    <div className={`contact-item ${contact.is_primary ? "primary" : ""}`}>
      <span className="contact-icon">{getIcon()}</span>
      <div className="contact-details">
        <div className="contact-value">{contact.value}</div>
        <div className="contact-meta">
          <span className={`confidence-badge ${getConfidenceClass(contact.confidence)}`}>
            {contact.confidence}% confidence
          </span>
          {contact.is_verified && <span className="verified-badge">✓ Verified</span>}
          <span className="source-badge">{contact.source}</span>
        </div>
      </div>
    </div>
  );
};

export const EntityContacts: React.FC<EntityContactsProps> = ({
  pin,
  entityId,
  minConfidence = 70,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entityData, setEntityData] = useState<EntityContactsResult | null>(null);
  const [parcelData, setParcelData] = useState<ParcelEntitiesResult | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!pin && !entityId) return;

      setLoading(true);
      setError(null);

      try {
        if (entityId) {
          const data = await Client.getEntityContacts(entityId, minConfidence);
          setEntityData(data);
        } else if (pin) {
          const data = await Client.getParcelEntities(pin);
          setParcelData(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load contacts");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [pin, entityId, minConfidence]);

  if (loading) {
    return (
      <div className="entity-contacts loading">
        <Loader loading={true}>Loading contact information...</Loader>
        <p>Loading contact information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="entity-contacts error">
        <p>Unable to load contacts: {error}</p>
      </div>
    );
  }

  // Single entity view
  if (entityData) {
    const { entity, contacts } = entityData;
    const phones = contacts.filter((c) => c.type === "phone");
    const emails = contacts.filter((c) => c.type === "email");
    const addresses = contacts.filter((c) => c.type === "mailing_address");

    return (
      <div className="entity-contacts">
        <div className="entity-header">
          <h3>{entity.name}</h3>
          <span className="entity-type">{entity.type}</span>
          {entity.parcel_count > 0 && (
            <span className="parcel-count">{entity.parcel_count} parcels</span>
          )}
        </div>

        {contacts.length === 0 ? (
          <p className="no-contacts">
            No contact information available at {minConfidence}% confidence threshold.
          </p>
        ) : (
          <div className="contacts-sections">
            {phones.length > 0 && (
              <div className="contact-section">
                <h4>Phone Numbers</h4>
                {phones.map((contact, idx) => (
                  <ContactDisplay key={`phone-${idx}`} contact={contact} />
                ))}
              </div>
            )}

            {emails.length > 0 && (
              <div className="contact-section">
                <h4>Email Addresses</h4>
                {emails.map((contact, idx) => (
                  <ContactDisplay key={`email-${idx}`} contact={contact} />
                ))}
              </div>
            )}

            {addresses.length > 0 && (
              <div className="contact-section">
                <h4>Mailing Addresses</h4>
                {addresses.map((contact, idx) => (
                  <ContactDisplay key={`address-${idx}`} contact={contact} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="contacts-footer">
          <small>
            Data sourced from public records with confidence scoring.
            <br />
            Last updated: {new Date().toLocaleDateString()}
          </small>
        </div>
      </div>
    );
  }

  // Parcel entities view
  if (parcelData) {
    const { entities } = parcelData;

    return (
      <div className="entity-contacts parcel-view">
        <h3>Property Owner Contacts</h3>

        {entities.length === 0 ? (
          <p className="no-contacts">No owner contact information available for this property.</p>
        ) : (
          <div className="entities-list">
            {entities.map((entity) => (
              <EntityContactCard key={entity.entity_id} entity={entity} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
};

interface EntityContactCardProps {
  entity: ParcelEntity;
}

const EntityContactCard: React.FC<EntityContactCardProps> = ({ entity }) => {
  const highConfidenceContacts = entity.contacts.filter((c) => c.confidence >= 70);

  return (
    <div className="entity-card">
      <div className="entity-card-header">
        <h4>{entity.name}</h4>
        <span className="entity-type">{entity.entity_type}</span>
        <span className={`confidence-badge ${entity.mapping_confidence >= 70 ? "high" : "medium"}`}>
          {entity.mapping_confidence}% match
        </span>
      </div>

      {entity.owner_name_at_time && (
        <div className="owner-alias">Listed as: {entity.owner_name_at_time}</div>
      )}

      {highConfidenceContacts.length > 0 ? (
        <div className="contacts-preview">
          {highConfidenceContacts.slice(0, 3).map((contact, idx) => (
            <div key={idx} className="contact-preview-item">
              <span className="contact-icon">
                {contact.type === "phone" ? "📞" : contact.type === "email" ? "✉️" : "📍"}
              </span>
              <span className="contact-value">{contact.value}</span>
            </div>
          ))}
          {highConfidenceContacts.length > 3 && (
            <div className="more-contacts">+{highConfidenceContacts.length - 3} more contacts</div>
          )}
        </div>
      ) : (
        <p className="no-contacts">No high-confidence contacts available</p>
      )}
    </div>
  );
};

export default EntityContacts;
