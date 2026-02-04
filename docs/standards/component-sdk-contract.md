# Standard 2 — Component SDK Contract

**Name**: Component SDK Contract Standard
**Scope**: Component authoring API, lifecycle, and constraints on isolation.

## Normative Requirements

### Component_Identity_And_Type_System
Standardized component naming and typing.

### Component_Context_Contract
The context object passed to components during synthesis.

### Component_Spec_Input_Contract
Input schemas for component configuration.

### Lifecycle_And_Synthesis_Phases
Defined phases: construction, synthesis, validation.

### Capability_Publication_And_Data_Contracts
How components declare `provides` and `requires` capabilities.

### Validation_Hooks_And_Error_Model
Standard methods for components to report validation errors.

### Isolation_And_Internal_Dependency_Graph_Rules
Components must not have side effects outside their scope.

### Discovery_And_Registration_Contract
Mechanism for registering components with the kernel.

### Observability_And_Governance_Integration_Points
Hooks for logging and governance data.

### Versioning_And_Compatibility
SemVer rules for components.

## Validation
- Compile-time TypeScript interfaces.
- Runtime method checks.
- Pattern validation via MCP tools.
