# Life Decision Simulator

A small prototype for people exploring a consequential personal decision with two possible paths. It organizes reflection around a user's question, goals, priorities, and constraints. It does **not** predict what will happen, verify claims, or recommend a choice.

## What the prototype does

For each option, four deterministic specialist templates produce a perspective:

- **Optimist** raises possible opportunities.
- **Pessimist** considers downside risks and fallback questions.
- **Financial** suggests budget and affordability checks.
- **Wellbeing** raises day-to-day, relationship, and routine considerations.

The **Narrator** compares the specialist findings, preserves their attribution, and calls out exact shared findings or a narrow class of direct contradictions. It does not replace the specialist perspectives. A complete report means only that all eight agent-option results were returned and validated; it does not mean the analysis is fact-checked or certain.

### Workflow

1. Enter a decision question, two options, goals, priorities, and optional constraints.
2. The server validates the request and runs each of the four specialists for both options (eight results total).
3. The Narrator runs only if all eight results are present, unique, valid, and complete.
4. The UI shows the summary and source perspectives, including findings, assumptions, uncertainties, and illustrative projections. If results are missing or invalid, the UI identifies the gaps and does not show a synthesized comparison.

## Technology

- Next.js 16 App Router and route handlers
- React 19 and TypeScript
- Zod runtime schemas for requests, results, and reports
- Vitest and Testing Library for automated tests
- CSS in `app/globals.css`

There is no live AI provider integration, database, or authentication in this MVP. The specialist outputs are deterministic templates.

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

No environment variables are required for the current implementation. No API key is used. `.env.example` records that no variables are required; do not add real credentials to the repository.

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
  }
}
```

The server limits requests to 32 KiB, question and option descriptions to 1,000 characters, option labels to 200 characters, and each list item to 200 characters with at most 20 items in each list.

## Three-minute demo walkthrough

1. **0:00-0:25 - Introduce the problem.** "This prototype helps someone compare two paths by organizing questions around their goals, priorities, and constraints. It explores possibilities; it does not forecast the future or choose for the user."
2. **0:25-0:55 - Enter the sample.** Use the sample decision above and submit it. Point out the two option descriptions and the goals, priorities, and constraints.
3. **0:55-1:40 - Show the specialist perspectives.** Scroll to the option-by-option section. For each option, show the Optimist, Pessimist, Financial, and Wellbeing cards. Distinguish each card's findings from assumptions, uncertainties, and year 1/5/10 illustrative projections. Mention that the templates are deterministic and do not call a live AI service.
4. **1:40-2:25 - Explain the Narrator comparison.** Show the at-a-glance comparison, attributed excerpts, and trade-off questions. Explain that the summary is composed from source findings, and that any agreement or disagreement is conservative. The scores are neutral placeholders, not estimates.
5. **2:25-3:00 - Show uncertainty and reliability behavior.** Point to the explicit uncertainty and "not predictions" labels. Explain that if a specialist fails, the UI displays a partial or failed report, names the missing result, and withholds the Narrator comparison rather than filling the gap. In the current deterministic demo, failures are not user-triggerable from the form; the failure behavior is verified by automated tests rather than a demo control.

## Limitations and future work

- Specialist outputs are static templates, not personalized expert analysis or live AI responses.
- Neutral scores of 50 are placeholders. No financial figures, wellbeing baseline, or validated scoring model is available.
- Projections are prompts for reflection, not forecasts. Confidence is self-reported and is not a calibrated probability.
- Agreement and disagreement detection is deliberately narrow and lexical; nuanced or semantic conflicts may not be detected.
- There is no authentication, persistence, or request rate limiting. Do not enter highly sensitive information into a publicly exposed instance.
- Form data is held in the browser for the current page and is not saved; refreshing starts a fresh session.
- Future work, if this prototype advances, should include user research, clearer domain-specific guardrails, appropriate privacy/security review, and evaluation of any grounded scoring or AI integration before being represented as advice.
