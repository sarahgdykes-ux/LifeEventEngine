# Life Decision Simulator

A small prototype for people exploring a consequential personal decision with exactly two distinct choice options for the P0 MVP (with future extensibility for three). It organizes reflection around a user's question, goals, priorities, constraints, and an editable shared baseline state. It does **not** predict what will happen, verify claims, or recommend a choice.

## What the prototype does

For each option, four deterministic specialist templates produce a perspective:

- **Optimist** raises possible opportunities.
- **Pessimist** considers downside risks and fallback questions.
- **Financial** suggests budget and affordability checks.
- **Wellbeing** raises day-to-day, relationship, and routine considerations.

The **Narrator** compares the specialist findings, preserves their attribution, and calls out exact shared findings or a narrow class of direct contradictions. It does not replace the specialist perspectives. A complete report means only that all eight agent-option results were returned and validated; it does not mean the analysis is fact-checked or certain.

### Workflow

1. Enter a decision question, two options, goals, priorities, optional constraints, and an editable baseline state.
2. Enter scenario delta assumptions for both options at the 1-, 5-, and 10-year horizons. Each horizon is an independent branch from the shared baseline.
3. The server validates the request, generates structured option events, runs preflight and consistency checks, and projects candidate states with stat clamping and commitment updates.
4. Four specialists run in parallel for both options (eight results total). Mock mode uses deterministic specialist outputs; live mode uses schema-constrained provider responses. Financial, wellbeing, and risk scores derive from the supplied baseline and Year 10 projected states.
5. The Narrator runs only if all eight specialist results are present, unique, valid, and complete. The UI shows the comparative report, state projections, trajectory review flags, raw validated outputs, and handoff audit logs.

## Event generation engine contract

The `lib/events` module defines the avatar baseline, event payload schema, pre-flight validator, option-event builder, consistency checker, and pure state projection/mutation logic. User-entered deltas and commitment changes produce `BASELINE_PRESERVING_OPTION` payloads for the 1-, 5-, and 10-year horizons. Each horizon creates a hypothetical projected state from the unchanged baseline. A `BASELINE_MUTATING_EVENT` payload is reserved for an explicitly described event with a stated cause; applying it advances the active state.

State stats are integers from 0 to 100 and are clamped to that range after applying integer deltas from -20 to +20. Event payloads require an uppercase snake-case type, mutation tag, delta justification, horizon, description, proposed effects, and new/ended commitment lists. `validate_payload` returns an empty list for valid payloads or path-qualified validation errors; generated payloads are schema-validated before being returned.

The app collects an editable shared state and user-supplied scenario assumptions and passes them through the projection pipeline. A rejected event gets one bounded correction attempt, then uses a safe unchanged-state fallback with an audit flag. The provider-neutral adapter defaults to deterministic mock mode. In live mode, a selected provider generates specialist analysis and event descriptions; event effects and commitments remain exactly the user-supplied assumptions. Provider failures fall back to deterministic outputs.

## Technology

- Next.js 16 App Router and route handlers
- React 19 and TypeScript
- Zod runtime schemas for requests, results, and reports
- Vercel AI SDK with OpenAI, Google Gemini, and Anthropic providers (optional live mode)
- Vitest and Testing Library for automated tests
- CSS in `app/globals.css`

The app has no database or authentication. Live mode is opt-in and sends the decision prompt, option details, baseline state, and scenario assumptions to the configured model provider. Use mock mode for offline work or when those inputs should not leave the app server.

## Prerequisites and setup

- Node.js 20.9 or later
- npm (the lockfile is provided; use `npm ci` for a reproducible install)

From the repository root, in PowerShell:

```powershell
npm ci
npm run dev
```

Open <http://localhost:3000>. Keep the development server running in that terminal. To stop it, press `Ctrl+C`.

### Environment variables

Mock mode requires no environment variables and is the default. For live mode, copy `.env.example` into `.env.local`, set `LLM_PROVIDER` to `openai`, `gemini`, or `anthropic`, and add the matching provider API key. The Anthropic integration requires an Anthropic API key accepted by its Messages API; a Claude Code session token or key from another service may not work. Optional model overrides are also listed there. Never commit real credentials.

## Commands

Run from the repository root:

```powershell
npm test
npm run typecheck
npm run build
```

To serve the production build locally after it succeeds:

```powershell
npm run start
```

There is currently no lint script in `package.json`; linting is not available as a project command.

## Sample data (for demonstration only)

This sample is fictional and repeatable. Enter these values in the form:

- **Question:** Should I pursue graduate school locally or move to a new city for work?
- **Option A:** Graduate school - Pursue an advanced degree while staying near my current support network.
- **Option B:** Move to a new city - Explore a new job market and build a new community.
- **Goals:** Build a meaningful career; feel engaged in daily life.
- **Priorities:** Learning; community.
- **Other constraints:** Keep costs manageable; stay connected to family.

The API accepts the corresponding JSON shape:

```json
{
  "question": "Should I pursue graduate school locally or move to a new city for work?",
  "options": [
    {
      "id": "A",
      "label": "Graduate school",
      "description": "Pursue an advanced degree while staying near my current support network."
    },
    {
      "id": "B",
      "label": "Move to a new city",
      "description": "Explore a new job market and build a new community."
    }
  ],
  "goals": ["Build a meaningful career", "Feel engaged in daily life"],
  "priorities": ["Learning", "Community"],
  "constraints": {
    "other": ["Keep costs manageable", "Stay connected to family"]
  },
  "baselineState": {
    "character": { "name": "Alex", "age": 28, "background": "Early-career professional" },
    "year": 2026,
    "stats": { "finances": 65, "wellbeing": 70, "health": 80, "career": 60 },
    "commitments": ["Current_Job", "Apartment_Lease"]
  },
  "scenarioEffects": [
    {
      "optionId": "A",
      "horizons": {
        "year1": { "finances": -6, "wellbeing": -2, "health": 0, "career": 3 },
        "year5": { "finances": -10, "wellbeing": -4, "health": 0, "career": 8 },
        "year10": { "finances": -12, "wellbeing": -2, "health": 0, "career": 12 }
      },
      "commitments": { "new": ["Graduate_Program"], "ended": [] }
    },
    {
      "optionId": "B",
      "horizons": {
        "year1": { "finances": -8, "wellbeing": -6, "health": -1, "career": 10 },
        "year5": { "finances": 3, "wellbeing": -3, "health": -1, "career": 14 },
        "year10": { "finances": 8, "wellbeing": 2, "health": 0, "career": 16 }
      },
      "commitments": { "new": ["New_Role"], "ended": ["Current_Job"] }
    }
  ]
}
```

The server limits requests to 32 KiB, question and option descriptions to 1,000 characters, option labels to 200 characters, and each list item to 200 characters with at most 20 items in each list.

## Three-minute demo walkthrough

1. **0:00-0:25 - Introduce the problem.** "This prototype helps someone compare two paths by organizing questions around their goals, priorities, and constraints. It explores possibilities; it does not forecast the future or choose for the user."
2. **0:25-0:55 - Enter the sample.** Use the sample decision above and submit it. Point out the two option descriptions and the goals, priorities, and constraints.
3. **0:55-1:40 - Show the specialist perspectives.** Scroll to the option-by-option section. For each option, show the Optimist, Pessimist, Financial, and Wellbeing cards. Distinguish each card's findings from assumptions, uncertainties, and year 1/5/10 illustrative projections. Mention that the templates are deterministic and do not call a live AI service.
4. **1:40-2:25 - Explain the Narrator comparison.** Show the at-a-glance comparison, attributed excerpts, trade-off questions, and user-assumption-driven state projections. Explain that the summary is composed from source findings, and that any agreement or disagreement is conservative. Scores are derived from supplied scenario assumptions; they are not calibrated estimates.
5. **2:25-3:00 - Show uncertainty and reliability behavior.** Point to the explicit uncertainty and "not predictions" labels. Explain that if a specialist fails, the UI displays a partial or failed report, names the missing result, and withholds the Narrator comparison rather than filling the gap. The developer audit view shows validated outputs, handoff results, and safe-fallback flags.

## Limitations and future work

- Specialist outputs are static templates, not personalized expert analysis or live AI responses.
- Scores are deterministic indicators derived from the user-entered baseline and scenario deltas; they are not measured, calibrated, or validated assessments.
- Projections are prompts for reflection, not forecasts. Confidence is self-reported and is not a calibrated probability.
- Agreement and disagreement detection is deliberately narrow and lexical; nuanced or semantic conflicts may not be detected.
- There is no authentication, persistence, or request rate limiting. Do not enter highly sensitive information into a publicly exposed instance.
- Form data is held in the browser for the current page and is not saved; refreshing starts a fresh session.
- Future work, if this prototype advances, should include user research, clearer domain-specific guardrails, appropriate privacy/security review, and evaluation of any grounded scoring or AI integration before being represented as advice.
