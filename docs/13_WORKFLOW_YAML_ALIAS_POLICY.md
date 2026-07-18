# Workflow YAML Alias Policy

Tony Football workflow validation uses an explicit fail-closed rule for YAML anchors, aliases, and merge-key inheritance.

The required `scripts/enforce-workflow-policy.mjs` preflight recursively reads every workflow file before the normal workflow policy validator runs. When structural anchor or alias syntax is present, validation stops and emits `yaml-anchor-alias-unsupported` with the workflow path, workflow scope, source line, and the detected token.

Workflow authors must expand permissions, steps, and jobs explicitly. The exception registry cannot suppress this rule.

Quoted scalar text, comments, and block-scalar script contents are ignored so ordinary literal ampersand or asterisk text does not create false positives.

Focused regression coverage includes:

- an aliased permission map;
- an aliased complete job containing executable steps;
- merge-key inheritance;
- quoted, commented, and block-scalar literal text.

The preflight is the entry point used by `npm run test:workflow-policy`, so the existing structural validator is never invoked for a workflow containing unsupported YAML indirection.
