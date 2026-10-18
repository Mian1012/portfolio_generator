# FolioVerse — Portfolio Template Generator

A responsive portfolio generator built with HTML, CSS, JavaScript, and Supabase. It includes exactly three portfolio styles: **Simple**, **Modern**, and **Creative**.

## Features

- Responsive landing page inspired by the supplied PortfoGen design reference
- Portfolio information form: personal details, profile picture URL, education, skills, projects, experience, and social links
- Three distinct generated portfolio designs
- Save and retrieve portfolio information using Supabase
- Edit and delete saved portfolios
- Preview and print / save a portfolio as PDF
- No build step required

## Project files

- `index.html` — pages and forms
- `style.css` — responsive interface and three template designs
- `app.js` — Supabase connection, CRUD, and template rendering
- `supabase-schema.sql` — database table and demo Row Level Security policies

## Run locally

1. Download or clone this project.
2. Open the folder in VS Code.
3. Use the Live Server extension to open `index.html`.
4. Create a Supabase project at https://supabase.com.
5. Open **SQL Editor** in Supabase and run `supabase-schema.sql`.
6. In Supabase project settings, copy the **Project URL** and the **publishable/anon key**.
7. In PortfoGen, click **Database Setup**, paste those two values, and connect.
8. Create a sample portfolio, then test preview, edit, delete, and refresh.

The Supabase URL and public/publishable key are saved in this browser's local storage for convenience. They are not database passwords. Do not use a service-role or secret key in browser code.

## Deploy to Vercel

1. Push these files to a GitHub repository.
2. Import the repository into Vercel.
3. Use the default static deployment settings; no build command is needed.
4. Deploy and open the public URL.
5. Open **Database Setup** on the deployed site and connect it to the same Supabase project.
6. Test create, read, update, delete, and refresh using non-sensitive sample data.

You can also deploy as a static site on Netlify or GitHub Pages.

## Database warning

The supplied SQL enables public anonymous CRUD so an instructor can test the assignment without signing in. **Anyone who discovers the public site can view, edit, or delete every portfolio.** Use only sample/non-sensitive data. For a real service, add Supabase Auth, an `owner_id` column, and per-user Row Level Security policies before collecting personal data.

## Design principles applied

- **Contrast:** dark navy typography against warm white, with purple actions and a yellow accent in Creative.
- **Hierarchy:** large headlines, numbered form sections, and consistent heading styles.
- **Alignment:** repeated grids and consistent content edges.
- **Proximity:** related fields are grouped into clear sections.
- **Repetition:** consistent button styles, rounded corners, and spacing.
- **Balance:** the hero balances copy with a visual portfolio mockup.
- **Responsive design:** layouts adapt for desktop, tablet, and mobile.

## Database platform

Supabase (PostgreSQL)

## Frontend technologies

HTML5, CSS3, JavaScript, Supabase JavaScript client v2


## Portfolio template redesign
The Simple, Modern, and Creative generated portfolio layouts have been redesigned to follow the supplied reference: Simple uses a light profile sidebar, Modern uses a midnight-blue sidebar with lavender panels, and Creative uses a dark editorial hero with yellow accents. Existing form fields, Supabase connection, and save/manage flows are preserved.


## Profile photo uploads (Supabase Storage)

1. In Supabase, open **Storage** and create a bucket named `profile-photos`.
2. Set the bucket to **Public** so generated portfolios can display uploaded images.
3. In the bucket's Policies section, add an INSERT policy for role `anon` (and `authenticated` if needed) for this bucket. For this classroom demo, the condition can use `bucket_id = 'profile-photos'`. Do not use unrestricted public upload policies for a production site.
4. The website accepts PNG, JPG, and WEBP images up to 2 MB. Photos upload when the user clicks **Save & preview**.

The existing SQL table already includes the `profile_picture` column; the app stores the public image URL there.


## Structured education history

The education editor lets you add multiple entries, each with an education level, school name, optional degree/strand, start year, and end year (or Present). The entries are stored as JSON in the existing `portfolios.education` text column, so **no database migration is required**. Older portfolios with education entered as plain text remain displayable.

Example entries you can add:
- College — Cebu Eastern College — Bachelor of Science in Information Technology — 2025 to Present
- Senior High School — University of Cebu — 2023 to 2025
- Junior High School — Pardo National High School — 2019 to 2023
- Elementary School — Pardo Elementary School — add the years if you know them
