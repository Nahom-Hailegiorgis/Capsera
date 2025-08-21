# Capsera

Capsera is a **Progressive Web App (PWA)** designed to help people capture, refine, and submit innovative ideas. It works offline first, syncs with **Supabase** when connected, and provides **AI-powered feedback** on submissions.

> This is MVP Version 1. Currently in testing and development. Not intended for public use.

---

## Features

- **Offline support** — Works without Wi-Fi using service workers and local storage.  
- **Ideas screen** — Browse community ideas (detailed view depends on the EUREKA flag).  
- **My submissions** — Track your own drafts and final ideas, protected with a local 4-digit PIN.  
- **Submit ideas** — Guided form with tooltips and multi-language support.  
- **Settings** — Change UI language, view/delete users, manage device data.  
- **AI feedback** — OpenAI evaluates draft ideas and suggests improvements.  
- **Developer feedback** — Submit anonymous feedback directly to the team.

---

## Tech Stack

- **Frontend:** HTML, CSS (custom, no Tailwind), JavaScript  
- **Backend:** Supabase (Postgres, RLS, Edge Functions)  
- **APIs:**  
  - OpenAI (idea evaluation)  
  - Google Translate (UI translations + tooltips)

---

## About

Capsera is an AI-driven idea platform dedicated to connecting **brilliant but overlooked innovators** with resources, mentorship, and financial support to bring their products to life and serve others.

---

## Founders

- **Shourya** — Harvard Undergraduate Ventures-Tech Summer Program 2025  
- **Sahasra** — Harvard Undergraduate Ventures-Tech Summer Program 2025  
- **Nahom** — Harvard Undergraduate Ventures-Tech Summer Program 2025

---

## Notes

- This project is **currently in testing and development**.  
- Use of real API keys or sensitive data should be done via `.env` and **never committed to the repo**.  
- Designed as MVP; future versions may expand functionality and accessibility.
