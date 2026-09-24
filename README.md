# PrepLens

AI-enabled competency assessment and learning platform for the Ministry of Statistics and Programme Implementation (MoSPI).

PrepLens connects official training material, FRAC competency diagnostics, personalized skill-gap roadmaps, and human-reviewed MCQ generation in one portal. It supports both administrators creating and reviewing training content and learners assessing themselves, studying mapped courses, and closing competency gaps.

## What It Provides

- Role-based learner and administrator experiences
- MoSPI competency assessments with scored competency breakdowns
- Skill-gap analysis against current and required competency levels
- Personal learning roadmap with completion, save, notes, discussion, and AI Coach actions
- In-app iGOT/NSSTA course study classroom with module progress and knowledge checks
- Upload of searchable PDF, DOCX, TXT, and JSON training manuals
- Browser-side PDF extraction using PDF.js and DOCX extraction using Mammoth
- Automatic MCQ generation from uploaded content or fixed manuals
- Strict four-option MCQ validation before questions enter the review queue
- Administrator review and approval workflow for generated questions
- Gemini-powered MCQ generation and AI mentoring with deterministic fallback content
- Department-level analytics, notifications, and technical architecture information
- Working Question Studio flow for admin-side manual ingestion and question generation

## User Workflow

### Administrator

1. Sign in to the administrator portal.
2. Choose a fixed MoSPI manual or upload a searchable PDF, DOCX, TXT, or JSON manual.
3. Configure competency, cadre, question count, and difficulty.
4. Uploading a manual extracts its text and starts MCQ generation automatically.
5. Review, edit, approve, or reject generated questions in the Review Queue.

> Question Studio is visible only after logging in as an admin.

### Learner

1. Complete an assigned competency assessment.
2. Open the Skill Gap Analysis to see scores, required levels, and priorities.
3. Use the roadmap to mark gaps complete, save gaps, write notes, discuss a topic, or ask the AI Coach.
4. Enter the mapped course classroom and complete lessons and knowledge checks.
5. Retake the assessment to measure improvement.

## Technology

- React 19 and TypeScript
- Vite 6
- Tailwind CSS 4
- Express API with TypeScript
- Google Gemini through `@google/genai`
- PDF.js for browser PDF text extraction
- Lucide React icons
- Vercel serverless API deployment

## Project Structure

```text
src/
  App.tsx                         Application state and routing
  components/                    Portal views and workflows
  data/                          Demo data, curricula, resources, and users
  types.ts                       Shared domain types
  utils/                         Shared browser utilities
api/
  index.ts                       Vercel serverless Express entry point
server.ts                       Local Express server and AI API routes
vercel.json                     Vercel build and API routing configuration
vite.config.ts                 Vite configuration
```

## Requirements

- Node.js 20 or newer recommended
- npm
- A Gemini API key is optional. Without it, MCQ generation and mentoring use built-in fallback content.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For Gemini-powered generation and mentoring, create `.env.local` or `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Never commit `.env`, `.env.local`, or any file containing an API key. Use `.env.example` as the configuration reference.

## Validation and Production Build

```bash
npm run lint     # TypeScript validation
npm run build    # Vite frontend and Express server build
npm run preview  # Preview the Vite build locally
```

The production build creates the frontend in `dist/` and the bundled local server at `dist/server.cjs`. Vite emits the PDF.js worker as a separate browser asset.

## API Routes

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Reports API status and whether Gemini is configured |
| `POST /api/auth/login` | Demo username/password login |
| `POST /api/auth/google` | Demo Google-style sign-in flow |
| `GET /api/auth/credentials` | Returns demo account information |
| `POST /api/generate-mcqs` | Generates validated competency-aligned MCQs |
| `POST /api/ai-mentor` | Returns contextual Discussion or AI Coach guidance |

When Gemini is unavailable or not configured, the generation endpoints return fallback responses so the demo remains usable. Generated questions are still marked `pending_review` and must be approved by an administrator.

## Demo Accounts

| Role | Username | Password |
| --- | --- | --- |
| Administrator | `admin` | `Admin@MoSPI2026` |
| Learner | `officer` | `Learner@2026` |

These are demonstration accounts only and must not be used as production credentials.

## GitHub

Repository: [github.com/chandu7756/PreLens](https://github.com/chandu7756/PrepLens)

Push changes to the `main` branch after validation:

```bash
git add .
git commit -m "Describe the change"
git push origin main
```

## Vercel Deployment

The repository includes `vercel.json` and `api/index.ts`. The Express app is exported as a serverless function on Vercel, while local development continues to use `npm run dev`.

Deploy from an authenticated machine:

```bash
npx vercel login
npx vercel --prod
```

Set `GEMINI_API_KEY` in the Vercel project environment variables if live Gemini generation is required. The app can be deployed without the key because the fallback engines remain available.

## Current Production Deployment

[https://prep-lens-rr16.vercel.app/](https://prep-lens-rr16.vercel.app/)

## Admin Login

Use the admin login to access Question Studio:

- Username: `admin`
- Password: `Admin@MoSPI2026`

The learner login is also available:

- Username: `officer`
- Password: `Learner@2026`
