# Shinobi Blueprints

Production-ready YAML manifests for common infrastructure patterns.

## Compute Blueprints

| Blueprint | Description                       | File                              |
| --------- | --------------------------------- | --------------------------------- |
| BP-004    | Serverless API → Queue → ETL → S3 | `compute/serverless-api-etl.yaml` |

## Usage

```bash
# Validate a blueprint
shinobi validate blueprints/compute/serverless-api-etl.yaml

# Generate a plan
shinobi plan blueprints/compute/serverless-api-etl.yaml

# Deploy (requires Pulumi + AWS credentials)
shinobi up blueprints/compute/serverless-api-etl.yaml
```

## Template

Use `_template.yaml` as a starting point for custom manifests.
