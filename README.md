# NeXTScript

A Next.js web app that replaces the Google Apps Script curriculum builder. Create and edit lessons in the browser, then generate a full **Google Drive bundle** (Slides deck + Docs poster + Forms quiz) with one click.

## What It Does

- **Courses and lessons:** plan courses in modules, with lessons and their section text.
- **Notes to Slides** (`/ingest`): paste lesson notes, and AI builds a slide deck around the course's locked section headings. Decks are previewed and edited in the browser, then exported onto the course's Google Slides template (or a built-in theme) and saved to the lesson's Drive folder.
- **Quizzes and docs:** AI quiz drafts become Google Forms; the Overview Doc summarizes chosen decks and quizzes.
- **Google Classroom:** push a lesson (its newest deck, docs and quizzes) to a linked Classroom course.

The older "Classic Slides" generator (template placeholders filled from a lesson's Slide Content) has been retired. Its decks and lesson data are kept, and a lesson's old Slide Content can be loaded into Notes to Slides with "Start from this lesson's content".

## Quick Start

### 1. Set up Google Cloud credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a project → Enable these APIs:
   - Google Drive API
   - Google Slides API
   - Google Docs API
   - Google Forms API
3. Create an **OAuth 2.0 Client ID** (Web application)
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy the Client ID and Secret

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
SLIDES_TEMPLATE_ID=1jx6peIBpntdg0vsIfOzenmOs9p9-1UeWSQxPIACZXAo
```

> `SLIDES_TEMPLATE_ID` is pre-filled with the same template from your original Apps Script.

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Preview test login (optional)

Signed-in flows can be tested on Vercel preview deployments without signing in with Google. Set these in Vercel for the **Preview** environment only:

| Variable | Purpose |
|---|---|
| `TEST_LOGIN_SECRET` | Turns the test login on. At least 24 characters (`openssl rand -base64 32`). |
| `TEST_LOGIN_EMAIL` | The test user's email. Defaults to `test@nextscript.test`; must pass `ALLOWED_EMAIL_DOMAINS`. |
| `TEST_LOGIN_GOOGLE_REFRESH_TOKEN` | Optional. The refresh token of a dedicated test Google account, so Drive, Slides and Classroom work for the test user. Without it those features answer "No Google access token". |

Then open `/api/auth/signin` on the preview, enter the secret under "Preview test login", and you're signed in as the test user. The test login is never registered when `VERCEL_ENV=production`, and also works under `npm run dev`. See `lib/testLogin.ts`.

## Workflow

1. **Sign in with Google** (top right) — grants Drive/Slides/Docs/Forms access
2. Click **+ New Lesson** and fill in the sections
3. Open **Notes to Slides**, pick the course and lesson, paste notes and click **Generate**
4. Review and edit the deck, then **Export**. It lands in the lesson's Drive folder and is listed on the lesson page
5. From the course page, push the lesson to Google Classroom

## Project Structure

```
app/
  page.tsx                  # Dashboard
  courses/                  # Courses, modules, Classroom push
  lessons/
    page.tsx                # All lessons, grouped by course
    new/page.tsx            # New lesson
    [id]/page.tsx           # Lesson hub: decks, docs, quizzes, resources
    [id]/edit/page.tsx      # Lesson section text (feeds quizzes and the Overview Doc)
  ingest/page.tsx           # Notes to Slides
  quizzes/                  # Quiz drafts and Google Forms
  api/                      # Route handlers (lessons, courses, ai, deck, classroom, ...)

components/
  LessonForm.tsx            # Lesson info + section editor
  notesToSlides/            # Notes to Slides guide

lib/
  auth.ts                   # NextAuth config (Google scopes)
  google.ts                 # Drive / Docs / Forms / Classroom helpers
  deck/                     # Deck schema, layouts, and pptx / Google Slides renderers
  store.ts                  # Firestore lesson store

types/
  lesson.ts                 # Lesson type definition
```
