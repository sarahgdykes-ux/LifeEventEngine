# LifeEventEngine

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

### Illustrative Partial Response

This is an illustrative response; `decisionId` is generated for each request.

```json
{
	"decisionId": "e4b5d8e1-32a6-4f6c-b334-4be9e91ea741",
	"results": [
		{
			"agent": "optimist",
			"optionId": "A",
			"findings": [
				"Illustrative possibility: Graduate school could create useful opportunities to pursue the decision's goals. This is a reflection prompt, not a factual prediction."
			],
			"assumptions": [
				"This scenario assumes the person can make a sustained effort toward graduate school while adapting as circumstances change."
			],
			"confidence": 50,
			"uncertainties": [
				"Personal circumstances and external events could change how well graduate school fits the question: Should I go to graduate school or move to a new city?"
			],
			"projections": {
				"year1": "Illustrative: early exploration of graduate school may clarify what feels energizing and what needs adjustment.",
				"year5": "Illustrative: continued commitment to graduate school could open new paths, while leaving room to revise the plan.",
				"year10": "Illustrative: the experience of graduate school may become one part of a changing life story rather than a fixed outcome."
			},
			"status": "complete"
		},
		{
			"agent": "optimist",
			"optionId": "B",
			"findings": [
				"Illustrative possibility: Move to a new city could create useful opportunities to pursue the decision's goals. This is a reflection prompt, not a factual prediction."
			],
			"assumptions": [
				"This scenario assumes the person can make a sustained effort toward move to a new city while adapting as circumstances change."
			],
			"confidence": 50,
			"uncertainties": [
				"Personal circumstances and external events could change how well move to a new city fits the question: Should I go to graduate school or move to a new city?"
			],
			"projections": {
				"year1": "Illustrative: early exploration of move to a new city may clarify what feels energizing and what needs adjustment.",
				"year5": "Illustrative: continued commitment to move to a new city could open new paths, while leaving room to revise the plan.",
				"year10": "Illustrative: the experience of move to a new city may become one part of a changing life story rather than a fixed outcome."
			},
			"status": "complete"
		}
	],
	"reportStatus": "partial",
	"missingResults": [
		"pessimist:A",
		"pessimist:B",
		"financial:A",
		"financial:B",
		"wellbeing:A",
		"wellbeing:B"
	]
}
```

The report is `partial` because only Optimist is implemented. Missing agent-option pairs are listed explicitly; the API does not fabricate placeholders. A mock failure or invalid mock output is safely omitted and its key remains missing. If no usable result can be created, the API returns an internal error. The Narrator is not part of this endpoint.

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

### Manual Smoke Test

With the dev server running at `http://localhost:3000`, submit a valid request:

```sh
curl -i http://localhost:3000/api/simulate \
	-H 'content-type: application/json' \
	--data '{"question":"Should I go to graduate school or move to a new city?","options":[{"id":"A","label":"Graduate school","description":"Pursue an advanced degree."},{"id":"B","label":"Move to a new city","description":"Relocate for new opportunities."}],"goals":["career growth","personal fulfillment"],"priorities":["financial security","wellbeing"],"constraints":{"other":["limited time"]}}'
```

Confirm HTTP 200, two `optimist` results for `A` and `B`, `reportStatus: "partial"`, and the six missing pairs shown above. Check malformed JSON separately:

```sh
curl -i http://localhost:3000/api/simulate \
	-H 'content-type: application/json' \
	--data '{invalid'
```

This should return HTTP 400 with code `INVALID_REQUEST`.

## Current Limitations

Only the deterministic Optimist mock runs. Pessimist, Financial, and Wellbeing results are missing; there is no Narrator, persistence, authentication, or live AI integration. The home page remains a Day 1 foundation placeholder; frontend form and partial-report rendering are the next integration task.