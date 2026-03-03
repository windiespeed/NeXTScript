# NeXTScript

A Next.js web app that replaces the Google Apps Script curriculum builder. Create and edit lessons in the browser, then generate a full **Google Drive bundle** (Slides deck + Docs poster + Forms quiz) with one click.

## What It Does

| Apps Script | This App |
|---|---|
| Read rows from Google Sheets | Lesson editor UI in the browser |
| Parse sections from a master Doc | Enter sections directly in the form |
| Build Slides deck from template | Same — uses your Slides template |
| Create a Docs poster | Same |
| Create a Forms quiz from TA Keywords | Same |
| Organize everything in a Drive folder | Same |

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

## Workflow

1. **Sign in with Google** (top right) — grants Drive/Slides/Docs/Forms access
2. Click **+ New Lesson** and fill in the sections
3. Back on the dashboard, click **Generate** on any lesson card
4. A Drive folder is created with:
   - `Deck: <title>` — Slides presentation
   - `POSTER & ASSIGNMENT: <title>` — Docs poster
   - `QUIZ: <title>` — Forms quiz

## Project Structure

```
app/
  page.tsx                  # Dashboard (lesson grid)
  lessons/
    new/page.tsx            # New lesson form
    [id]/page.tsx           # Edit lesson + Generate button
  api/
    auth/[...nextauth]/     # NextAuth Google OAuth
    lessons/                # CRUD API
    generate/[id]/          # Triggers Google bundle generation

components/
  Nav.tsx                   # Top navigation + sign in/out
  LessonCard.tsx            # Dashboard card
  LessonForm.tsx            # Full lesson editor

lib/
  auth.ts                   # NextAuth config (Google scopes)
  google.ts                 # Slides / Docs / Forms / Drive helpers
  store.ts                  # JSON file store (swap for DB later)

types/
  lesson.ts                 # Lesson type definition

data/
  lessons.json              # Auto-created on first save (gitignored in prod)
```

## Lesson Sections

These map 1:1 to the sections in your original master Doc:

| Section | Used In |
|---|---|
| Lesson Overview | Title slide goal, Poster, Overview slide |
| Learning Targets | Slides |
| Guided Lab | Slides |
| Self-Paced | Slides |
| Submission Checklist | Title slide reminder, Poster, Slides |
| Slide Content | Content slides (blank line = new slide, first line = title) |
| Dev Journal Prompt | Slides |
| TA Keywords | Quiz questions (up to 10 keywords → 10 MC questions) |
