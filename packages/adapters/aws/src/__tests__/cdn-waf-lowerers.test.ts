import { describe, it, expect } from "vitest";
import { CloudFrontLowerer } from "../lowerers/cloudfront-lowerer";
import { WafLowerer } from "../lowerers/waf-lowerer";
import { AcmLowerer } from "../lowerers/acm-lowerer";
import { CloudFrontFunctionLowerer } from "../lowerers/cloudfront-function-lowerer";
import {
  makeNode,
  makeEdge,
  makeDefaultContext,
  makeDefaultDeps,
} from "./test-helpers";
import { createSnapshot } from "@shinobi/ir";

const DEFAULT_CONTEXT = makeDefaultContext();
const DEFAULT_DEPS = makeDefaultDeps();

// ---------------------------------------------------------------------------
// CloudFrontLowerer
// ---------------------------------------------------------------------------
describe("CloudFrontLowerer", () => {
  const lowerer = new CloudFrontLowerer();

  const cfNode = makeNode({
    id: "platform:my-cdn",
    type: "platform",
    metadata: { properties: { platform: "aws-cloudfront" } },
  });

  it("has correct platform", () => {
    expect(lowerer.platform).toBe("aws-cloudfront");
  });

  it("produces OAC + Distribution (2 resources)", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(2);
  });

  it("OAC has correct naming: {name}-oac", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.name).toBe("my-cdn-oac");
  });

  it("OAC has correct resource type", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.resourceType).toBe(
      "aws:cloudfront:OriginAccessControl",
    );
  });

  it("OAC properties: originAccessControlOriginType, signingBehavior, signingProtocol", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[0]?.properties;
    expect(props?.["originAccessControlOriginType"]).toBe("s3");
    expect(props?.["signingBehavior"]).toBe("always");
    expect(props?.["signingProtocol"]).toBe("sigv4");
  });

  it("OAC name includes serviceName prefix", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.properties["name"]).toBe("test-svc-my-cdn-oac");
  });

  it("Distribution has correct naming: {name}-distribution", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1]?.name).toBe("my-cdn-distribution");
  });

  it("Distribution has correct resource type", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1]?.resourceType).toBe("aws:cloudfront:Distribution");
  });

  it("Distribution is enabled by default", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1]?.properties["enabled"]).toBe(true);
  });

  it("Distribution defaultRootObject defaults to index.html", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1]?.properties["defaultRootObject"]).toBe("index.html");
  });

  it("Distribution priceClass defaults to PriceClass_100", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1]?.properties["priceClass"]).toBe("PriceClass_100");
  });

  it("Distribution viewerCertificate defaults to cloudfrontDefaultCertificate=true", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const cert = resources[1]?.properties["viewerCertificate"] as Record<
      string,
      unknown
    >;
    expect(cert?.["cloudfrontDefaultCertificate"]).toBe(true);
  });

  it("Distribution has restriction type none", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const restrictions = resources[1]?.properties["restrictions"] as Record<
      string,
      unknown
    >;
    const geo = restrictions?.["geoRestriction"] as Record<string, unknown>;
    expect(geo?.["restrictionType"]).toBe("none");
  });

  it("Distribution tags include shinobi:node and shinobi:platform", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[1]?.properties["tags"] as Record<string, string>;
    expect(tags?.["shinobi:node"]).toBe("platform:my-cdn");
    expect(tags?.["shinobi:platform"]).toBe("aws-cloudfront");
  });

  it("Distribution depends on OAC", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1]?.dependsOn).toContain("my-cdn-oac");
  });

  it("OAC has no dependencies", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.dependsOn).toEqual([]);
  });

  it("custom priceClass from config", () => {
    const node = makeNode({
      id: "platform:my-cdn",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-cloudfront",
          priceClass: "PriceClass_All",
        },
      },
    });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1]?.properties["priceClass"]).toBe("PriceClass_All");
  });

  it("custom defaultRootObject from config", () => {
    const node = makeNode({
      id: "platform:my-cdn",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-cloudfront",
          defaultRootObject: "home.html",
        },
      },
    });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1]?.properties["defaultRootObject"]).toBe("home.html");
  });

  it("origin bucket resolution from bindsTo edge to S3 node", () => {
    const s3Node = makeNode({
      id: "platform:assets",
      type: "platform",
      metadata: { properties: { platform: "aws-s3" } },
    });
    const edge = makeEdge({
      id: "edge:bindsTo:platform:my-cdn:platform:assets",
      type: "bindsTo",
      source: "platform:my-cdn",
      target: "platform:assets",
    });
    const ctx: LoweringContext = {
      intents: [],
      snapshot: createSnapshot([cfNode, s3Node], [edge]),
      adapterConfig: { region: "us-east-1", serviceName: "test-svc" },
    };
    const resources = lowerer.lower(cfNode, ctx, DEFAULT_DEPS);
    const origins = resources[1]?.properties["origins"] as Array<
      Record<string, unknown>
    >;
    expect(origins?.[0]?.["domainName"]).toEqual({
      ref: "assets-bucket.bucketRegionalDomainName",
    });
  });

  it("falls back to static domain when no S3 edge", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const origins = resources[1]?.properties["origins"] as Array<
      Record<string, unknown>
    >;
    expect(origins?.[0]?.["domainName"]).toBe(
      "test-svc-my-cdn.s3.amazonaws.com",
    );
  });

  it("origin references OAC via ref", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const origins = resources[1]?.properties["origins"] as Array<
      Record<string, unknown>
    >;
    expect(origins?.[0]?.["originAccessControlId"]).toEqual({
      ref: "my-cdn-oac",
    });
  });

  it("sets sourceId to node ID on all resources", () => {
    const resources = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.sourceId).toBe("platform:my-cdn");
    expect(resources[1]?.sourceId).toBe("platform:my-cdn");
  });

  it("output is deterministic", () => {
    const r1 = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(cfNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("adds aliases when provided in config", () => {
    const node = makeNode({
      id: "platform:my-cdn",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-cloudfront",
          aliases: ["cdn.example.com", "www.example.com"],
        },
      },
    });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1]?.properties["aliases"]).toEqual([
      "cdn.example.com",
      "www.example.com",
    ]);
  });

  it("adds wafAclArn when provided in config", () => {
    const node = makeNode({
      id: "platform:my-cdn",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-cloudfront",
          wafAclArn: "arn:aws:wafv2::123:regional/webacl/test/abc",
        },
      },
    });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1]?.properties["webAclId"]).toBe(
      "arn:aws:wafv2::123:regional/webacl/test/abc",
    );
  });
});

// ---------------------------------------------------------------------------
// WafLowerer
// ---------------------------------------------------------------------------
describe("WafLowerer", () => {
  const lowerer = new WafLowerer();

  const wafNode = makeNode({
    id: "platform:site-waf",
    type: "platform",
    metadata: { properties: { platform: "aws-wafv2" } },
  });

  it("has correct platform", () => {
    expect(lowerer.platform).toBe("aws-wafv2");
  });

  it("produces 1 resource: WebAcl", () => {
    const resources = lowerer.lower(wafNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(1);
    expect(resources[0]?.resourceType).toBe("aws:wafv2:WebAcl");
  });

  it("resource name: {name}-waf", () => {
    const resources = lowerer.lower(wafNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.name).toBe("site-waf-waf");
  });

  it("WebAcl name includes serviceName prefix", () => {
    const resources = lowerer.lower(wafNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.properties["name"]).toBe("test-svc-site-waf");
  });

  it("default scope is CLOUDFRONT", () => {
    const resources = lowerer.lower(wafNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.properties["scope"]).toBe("CLOUDFRONT");
  });

  it("default action is allow", () => {
    const resources = lowerer.lower(wafNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.properties["defaultAction"]).toEqual({ allow: {} });
  });

  it("includes 3 default managed rule groups", () => {
    const resources = lowerer.lower(wafNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const rules = resources[0]?.properties["rules"] as Array<
      Record<string, unknown>
    >;
    expect(rules).toHaveLength(3);

    const ruleNames = rules?.map((r) => r["name"]);
    expect(ruleNames).toContain("AWSManagedRulesCommonRuleSet");
    expect(ruleNames).toContain("AWSManagedRulesKnownBadInputsRuleSet");
    expect(ruleNames).toContain("AWSManagedRulesAmazonIpReputationList");
  });

  it("rules have correct priority ordering (10, 20, 30)", () => {
    const resources = lowerer.lower(wafNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const rules = resources[0]?.properties["rules"] as Array<
      Record<string, unknown>
    >;
    expect(rules?.[0]?.["priority"]).toBe(10);
    expect(rules?.[1]?.["priority"]).toBe(20);
    expect(rules?.[2]?.["priority"]).toBe(30);
  });

  it("each rule has visibilityConfig with cloudwatch metrics enabled", () => {
    const resources = lowerer.lower(wafNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const rules = resources[0]?.properties["rules"] as Array<
      Record<string, unknown>
    >;
    for (const rule of rules ?? []) {
      const vis = rule["visibilityConfig"] as Record<string, unknown>;
      expect(vis?.["cloudwatchMetricsEnabled"]).toBe(true);
      expect(vis?.["sampledRequestsEnabled"]).toBe(true);
    }
  });

  it("top-level visibilityConfig has cloudwatch metrics enabled", () => {
    const resources = lowerer.lower(wafNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const vis = resources[0]?.properties["visibilityConfig"] as Record<
      string,
      unknown
    >;
    expect(vis?.["cloudwatchMetricsEnabled"]).toBe(true);
    expect(vis?.["sampledRequestsEnabled"]).toBe(true);
    expect(vis?.["metricName"]).toBe("test-svc-site-waf");
  });

  it("tags include shinobi:node and shinobi:platform", () => {
    const resources = lowerer.lower(wafNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0]?.properties["tags"] as Record<string, string>;
    expect(tags?.["shinobi:node"]).toBe("platform:site-waf");
    expect(tags?.["shinobi:platform"]).toBe("aws-wafv2");
  });

  it("custom scope from config", () => {
    const node = makeNode({
      id: "platform:regional-waf",
      type: "platform",
      metadata: { properties: { platform: "aws-wafv2", scope: "REGIONAL" } },
    });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.properties["scope"]).toBe("REGIONAL");
  });

  it("custom defaultAction (block) from config", () => {
    const node = makeNode({
      id: "platform:strict-waf",
      type: "platform",
      metadata: {
        properties: { platform: "aws-wafv2", defaultAction: "block" },
      },
    });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.properties["defaultAction"]).toEqual({ block: {} });
  });

  it("sets sourceId to node ID", () => {
    const resources = lowerer.lower(wafNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.sourceId).toBe("platform:site-waf");
  });

  it("has no dependencies", () => {
    const resources = lowerer.lower(wafNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.dependsOn).toEqual([]);
  });

  it("output is deterministic", () => {
    const r1 = lowerer.lower(wafNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(wafNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

// ---------------------------------------------------------------------------
// AcmLowerer
// ---------------------------------------------------------------------------
describe("AcmLowerer", () => {
  const lowerer = new AcmLowerer();

  const acmNode = makeNode({
    id: "platform:site-cert",
    type: "platform",
    metadata: { properties: { platform: "aws-acm" } },
  });

  it("has correct platform", () => {
    expect(lowerer.platform).toBe("aws-acm");
  });

  it("produces 1 resource: Certificate", () => {
    const resources = lowerer.lower(acmNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(1);
    expect(resources[0]?.resourceType).toBe("aws:acm:Certificate");
  });

  it("resource name: {name}-cert", () => {
    const resources = lowerer.lower(acmNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.name).toBe("site-cert-cert");
  });

  it("default validationMethod is DNS", () => {
    const resources = lowerer.lower(acmNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.properties["validationMethod"]).toBe("DNS");
  });

  it("default domainName uses serviceName.example.com pattern", () => {
    const resources = lowerer.lower(acmNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.properties["domainName"]).toBe("test-svc.example.com");
  });

  it("custom domainName from config", () => {
    const node = makeNode({
      id: "platform:site-cert",
      type: "platform",
      metadata: {
        properties: { platform: "aws-acm", domainName: "mysite.dev" },
      },
    });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.properties["domainName"]).toBe("mysite.dev");
  });

  it("subjectAlternativeNames from config", () => {
    const node = makeNode({
      id: "platform:site-cert",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-acm",
          domainName: "mysite.dev",
          subjectAlternativeNames: ["*.mysite.dev", "api.mysite.dev"],
        },
      },
    });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.properties["subjectAlternativeNames"]).toEqual([
      "*.mysite.dev",
      "api.mysite.dev",
    ]);
  });

  it("omits subjectAlternativeNames when not provided", () => {
    const resources = lowerer.lower(acmNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.properties["subjectAlternativeNames"]).toBeUndefined();
  });

  it("tags include shinobi:node and shinobi:platform", () => {
    const resources = lowerer.lower(acmNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0]?.properties["tags"] as Record<string, string>;
    expect(tags?.["shinobi:node"]).toBe("platform:site-cert");
    expect(tags?.["shinobi:platform"]).toBe("aws-acm");
  });

  it("sets sourceId to node ID", () => {
    const resources = lowerer.lower(acmNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.sourceId).toBe("platform:site-cert");
  });

  it("has no dependencies", () => {
    const resources = lowerer.lower(acmNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.dependsOn).toEqual([]);
  });

  it("output is deterministic", () => {
    const r1 = lowerer.lower(acmNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(acmNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

// ---------------------------------------------------------------------------
// CloudFrontFunctionLowerer
// ---------------------------------------------------------------------------
describe("CloudFrontFunctionLowerer", () => {
  const lowerer = new CloudFrontFunctionLowerer();

  const funcNode = makeNode({
    id: "platform:redirect-fn",
    type: "platform",
    metadata: { properties: { platform: "aws-cloudfront-function" } },
  });

  it("has correct platform", () => {
    expect(lowerer.platform).toBe("aws-cloudfront-function");
  });

  it("produces 1 resource: Function", () => {
    const resources = lowerer.lower(funcNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(1);
    expect(resources[0]?.resourceType).toBe("aws:cloudfront:Function");
  });

  it("resource name: {name}-cf-function", () => {
    const resources = lowerer.lower(funcNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.name).toBe("redirect-fn-cf-function");
  });

  it("function name includes serviceName prefix", () => {
    const resources = lowerer.lower(funcNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.properties["name"]).toBe("test-svc-redirect-fn");
  });

  it("default runtime is cloudfront-js-2.0", () => {
    const resources = lowerer.lower(funcNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.properties["runtime"]).toBe("cloudfront-js-2.0");
  });

  it("publishes by default (publish: true)", () => {
    const resources = lowerer.lower(funcNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.properties["publish"]).toBe(true);
  });

  it("default code is placeholder", () => {
    const resources = lowerer.lower(funcNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.properties["code"]).toBe("// placeholder");
  });

  it("custom code from config", () => {
    const customCode = "function handler(event) { return event.request; }";
    const node = makeNode({
      id: "platform:redirect-fn",
      type: "platform",
      metadata: {
        properties: { platform: "aws-cloudfront-function", code: customCode },
      },
    });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.properties["code"]).toBe(customCode);
  });

  it("custom comment from config", () => {
    const node = makeNode({
      id: "platform:redirect-fn",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-cloudfront-function",
          comment: "My redirect function",
        },
      },
    });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.properties["comment"]).toBe("My redirect function");
  });

  it("tags include shinobi:node and shinobi:platform", () => {
    const resources = lowerer.lower(funcNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0]?.properties["tags"] as Record<string, string>;
    expect(tags?.["shinobi:node"]).toBe("platform:redirect-fn");
    expect(tags?.["shinobi:platform"]).toBe("aws-cloudfront-function");
  });

  it("sets sourceId to node ID", () => {
    const resources = lowerer.lower(funcNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.sourceId).toBe("platform:redirect-fn");
  });

  it("has no dependencies", () => {
    const resources = lowerer.lower(funcNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.dependsOn).toEqual([]);
  });

  it("output is deterministic", () => {
    const r1 = lowerer.lower(funcNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(funcNode, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
