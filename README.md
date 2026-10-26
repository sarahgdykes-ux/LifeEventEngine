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

A successful response contains eight validated specialist results (four agents for each option), a Narrator synthesis with side-by-side 1-, 5-, and 10-year perspectives, and per-option breakdown scores. The Narrator is not called unless every agent-option result passes schema validation. If any specialist fails or returns invalid output, the request fails with a safe internal error rather than returning a partial or synthesized report.

The individual `results` are retained in the response for inspection. Specialist templates use the submitted question, goals, priorities, constraints, and option descriptions to frame distinct risk, financial, and wellbeing considerations. Projections are illustrative prompts, not verified facts or reliable predictions; confidence is a self-reported analysis rating, not a calibrated probability. Server audit logs contain only agent names, option IDs, schema-validation status, and failure type; user decision text and raw agent output are never written to logs.

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

Invalid JSON or input returns HTTP 400 with code `INVALID_REQUEST`. Unexpected simulation failures return HTTP 500 with code `INTERNAL_ERROR` and message `Simulation could not be completed.` Internal exception details are not returned.

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

Confirm HTTP 200, eight specialist results, `reportStatus: "complete"`, two synthesized option timelines, and no missing pairs. Check malformed JSON separately:

```sh
curl -i http://localhost:3000/api/simulate \
	-H 'content-type: application/json' \
	--data '{invalid'
```

This should return HTTP 400 with code `INVALID_REQUEST`.

## Current Limitations

All four deterministic specialist templates and the gated Narrator pipeline run, but there is no live AI integration, persistence, or authentication. Breakdown scores are neutral placeholders, not forecasts, until a grounded scoring method and appropriate personal baselines are defined. Invalid specialist output or a thrown specialist error aborts simulation rather than creating a successful placeholder result. The form resets on refresh. UI interaction tests are not configured yet; use the manual browser smoke test above after starting the development server.