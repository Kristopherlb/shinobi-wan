import type { TelemetryIntent } from "@shinobi/contracts";
import type { LoweredResource, LoweringContext, IntentLowerer } from "../types";
import { shortName } from "./utils";

/**
 * Lowers TelemetryIntent → X-Ray tracing configuration resources.
 *
 * For MVP, telemetry intents of type 'traces' emit an IAM policy
 * granting X-Ray PutTraceSegments/PutTelemetryRecords permissions.
 * The Lambda lowerer handles the actual tracingConfig on the function.
 */
export class TelemetryIntentLowerer implements IntentLowerer<TelemetryIntent> {
  readonly intentType = "telemetry" as const;

  lower(
    intent: TelemetryIntent,
    _context: LoweringContext,
  ): ReadonlyArray<LoweredResource> {
    if (!intent.config.enabled) {
      return [];
    }

    const resources: LoweredResource[] = [];
    const targetName = shortName(intent.targetNodeRef);

    if (intent.telemetryType === "traces") {
      // X-Ray tracing policy — grants permissions for trace data
      const policyName = `${targetName}-xray-policy`;
      resources.push({
        name: policyName,
        resourceType: "aws:iam:Policy",
        properties: {
          policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: [
                  "xray:PutTraceSegments",
                  "xray:PutTelemetryRecords",
                  "xray:GetSamplingRules",
                  "xray:GetSamplingTargets",
                ],
                Resource: "*",
              },
            ],
          }),
          tags: {
            "shinobi:telemetry": intent.telemetryType,
            "shinobi:target": intent.targetNodeRef,
          },
        },
        sourceId: intent.sourceEdgeId,
        dependsOn: [],
      });

      // Attach X-Ray policy to the target's execution role
      const attachmentName = `${targetName}-xray-policy-attachment`;
      resources.push({
        name: attachmentName,
        resourceType: "aws:iam:RolePolicyAttachment",
        properties: {
          role: { ref: `${targetName}-exec-role` },
          policyArn: { ref: policyName },
        },
        sourceId: intent.sourceEdgeId,
        dependsOn: [`${targetName}-exec-role`, policyName],
      });
    }

    return resources;
  }
}
