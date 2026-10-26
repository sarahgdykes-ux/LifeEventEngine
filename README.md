# Life Decision Simulator

A multi-agent life simulation engine that coordinates autonomous domain agents to simulate real-time career, financial, and personal growth events for an avatar.

## Simulation API

`POST /api/simulate` accepts the shared `DecisionInput` contract and returns a shared `SimulationReport`.

In this single Next.js app, frontend code should import the existing definitions rather than copy them:

```ts
import type { DecisionInput } from "@/lib/schemas/decision";
import type { SimulationReport } from "@/lib/schemas/simulation";
import type { SimulationApiError } from "@/lib/schemas/api";
```

The request requires a non-empty question, exactly two options with IDs `A` and `B`, and non-empty goals and priorities. Option descriptions are optional. The canonical constraints form is an object with an `other` list; the Day 1 Part 1 `string[]` form remains accepted for compatibility.

Server validation limits the request body to 32 KiB, questions and option descriptions to 1,000 characters, option labels to 200 characters, and each goal, priority, or constraint item to 200 characters with at most 20 items in each list.

### Example Request

```json
{
	"question": "Should I go to graduate school or move to a new city?",
	"options": [
		{
			"id": "A",
			"label": "Graduate school",
			"description": "Pursue an advanced degree."
		},
		{
			"id": "B",
			"label": "Move to a new city",
			"description": "Relocate for new opportunities."
		}
	],
	"goals": ["career growth", "personal fulfillment"],
	"priorities": ["financial security", "wellbeing"],
	"constraints": { "other": ["limited time"] }
}
```

### Simulation report

A complete response contains eight validated specialist results (four agents for each option), a Narrator synthesis with attributed key findings, evidence grouped across financial, wellbeing, opportunity, and risk perspectives, user-centered trade-off questions, cautious agreement/disagreement notes, side-by-side 1-, 5-, and 10-year perspectives, and per-option breakdown scores. The synthesis retains the original question, goals, priorities, constraints, and option descriptions. The Narrator is called only when every expected agent-option result is unique, valid, and complete. If a specialist fails, returns invalid output, or produces a duplicate key, the API returns a validated `partial` or `failed` report with the available valid results, `synthesis: null`, and stable missing-result keys such as `financial:A`. A report is `failed` when it contains no complete specialist results and `partial` when it contains at least one but fewer than eight.

The individual `results` are retained unchanged in the response for inspection; assumptions, uncertainties, confidence values, scores, and projections remain attached to their source specialist. Narrator excerpts are copied from those findings and are checked against the source results. Shared findings require identical text; direct disagreements are reported only for closely matching text with opposite negation. Different emphases are not presented as contradictions. Specialist templates use the submitted question, goals, priorities, constraints, and option descriptions to frame distinct risk, financial, and wellbeing considerations. Projections are illustrative prompts, not verified facts or reliable predictions; confidence is a self-reported analysis rating, not a calibrated probability. Server audit logs contain only agent names, option IDs, schema-validation status, and failure type; user decision text and raw agent output are never written to logs.

Breakdown scores use a 0–100 scale. In this template-only implementation, Financial Health, Emotional Wellbeing, and Risk Level use a neutral score of 50 with an explanation because the app does not collect enough financial figures or wellbeing baselines to produce a meaningful estimate. Higher Risk Level means greater downside exposure. These scores are placeholders, not factual predictions or advice.

Errors use a stable envelope:

```json
{
	"error": {
		"code": "INVALID_REQUEST",
		"message": "Request body does not match DecisionInput."
	}
}
```

Invalid JSON or input returns HTTP 400 with code `INVALID_REQUEST`. Unexpected orchestration or synthesis failures return HTTP 500 with code `INTERNAL_ERROR` and message `Simulation could not be completed.` Specialist execution failures are represented as `partial` or `failed` reports; internal exception details are not returned.

## Local Development

```sh
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

No AI provider or API key is used by this slice.

The home page provides the integrated decision form and partial report. Enter a question, two option labels, at least one comma-separated goal and priority, and optional comma-separated constraints. Submit to the local `POST /api/simulate` route; the form values stay available if the request fails. The report is checked against the shared schema and clearly lists perspectives that are not yet available.

### Manual Smoke Test

With the dev server running at `http://localhost:3000`, submit a valid request:

```sh
curl -i http://localhost:3000/api/simulate \
	-H 'content-type: application/json' \
	--data '{"question":"Should I go to graduate school or move to a new city?","options":[{"id":"A","label":"Graduate school","description":"Pursue an advanced degree."},{"id":"B","label":"Move to a new city","description":"Relocate for new opportunities."}],"goals":["career growth","personal fulfillment"],"priorities":["financial security","wellbeing"],"constraints":{"other":["limited time"]}}'
```

Confirm HTTP 200, eight specialist results, `reportStatus: "complete"`, two synthesized option timelines, and no missing pairs. If any specialist is unavailable or returns invalid output, the API instead returns HTTP 200 with a `partial` or `failed` status, a null synthesis, and its missing agent-option keys. Check malformed JSON separately:

```sh
curl -i http://localhost:3000/api/simulate \
	-H 'content-type: application/json' \
	--data '{invalid'
```

This should return HTTP 400 with code `INVALID_REQUEST`.

## Current Limitations

All four deterministic specialist templates and the gated Narrator pipeline run, but there is no live AI integration, persistence, or authentication. Agreement and disagreement detection is deliberately conservative and lexical; nuanced semantic conflicts may not be recognized. Breakdown scores are neutral placeholders, not forecasts, until a grounded scoring method and appropriate personal baselines are defined. Invalid specialist output, duplicate results, or thrown specialist errors are not replaced with fabricated results; incomplete reports omit synthesis and identify missing pairs. The form resets on refresh.