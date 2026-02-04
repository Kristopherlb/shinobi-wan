# Standard 6 — Security Derivation (IAM / Network Intent)

**Name**: Security Derivation Standard (IAM Intent + Network Intent)
**Scope**: Backend-neutral security intent emitted by binders.

## Normative Requirements

### IAM_Intent_Schema
Schema for abstract IAM permissions (not AWS specifics).

### Least_Privilege_Validation
Binders must enforce least privilege.

### Action_Profile_And_Access_Level_Mapping
Mapping high-level actions to permissions.

### Resource_Scoping_And_Wildcard_Restrictions
Restrictions on wildcard usage.

### Network_Intent_Schema
Abstract network rules (ingress/egress).

### Ingress_Egress_Rule_Model
Directionality and port ranges.

### Cross_Stack_And_Cross_Service_Networking
Handling references across stack boundaries.

### Provenance_And_Audit_Metadata_For_Security_Derivations
Tracking where security rules originated.

### Forbidden_Direct_Grants_In_Components
Components cannot grant permissions directly; binders do.

## Validation
- Binder wrapper validation.
- Unit tests for derivation logic.
