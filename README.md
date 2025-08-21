Capsera is a progressive web app (PWA) built to help people capture, refine, and submit innovative ideas. It works offline first, syncs with Supabase when connected, and provides AI-powered feedback on submissions.

Features

Offline support — works without Wi-Fi using service workers and local storage.

Ideas screen — browse community ideas (details view depends on the EUREKA flag).

My submissions — track your own drafts and final ideas, protected with a local 4-digit PIN.

Submit ideas — guided form with tooltips and multi-language support.

Settings — change UI language, view/delete users, manage device data.

AI feedback — OpenAI evaluates draft ideas and suggests improvements.

Developer feedback — submit anonymous feedback directly to the team.

Tech Stack

Frontend: HTML, CSS (custom, no Tailwind), JavaScript

Backend: Supabase (Postgres, RLS, Edge Functions)

APIs:

OpenAI (idea evaluation)

Google Translate (UI translations + tooltips)

File Structure
capsera/
├── index.html
├── app.js
├── styles.css
├── manifest.json
├── sw.js
│
├── helpers/
│ ├── db.js
│ ├── supabase.js
│ ├── validation.js
│ └── translate.js
│
├── edge-functions/
│ └── get-idea-details.js
│
├── config/
│ ├── package.json
│ └── .env.example

Getting Started

Clone the repo

git clone https://github.com/your-username/capsera.git
cd capsera

Install dependencies

npm install

Environment variables
Copy .env.example to .env and fill in your keys:

SUPABASE_URL

SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY

OPENAI_API_KEY

GOOGLE_TRANSLATE_KEY

EUREKA (true/false)

Run locally

npm run dev

Deploy

Push client to a static host (e.g., Vercel, Netlify).

Deploy Edge Functions to Supabase.

Database Setup

Run the SQL provided in /config/schema.sql (or see project docs) to create:

ideas table

feedback table

users table

ideas_public view

Row-level security (RLS) policies are included for safe anonymous inserts and controlled reads.

Notes

All PIN codes stay on the device, never sent to Supabase.

Only ideas_public view is queryable by anonymous clients.

Full idea details require EUREKA=true and a server-side function.
