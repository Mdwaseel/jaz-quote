# JAZ Home Theatres — Quotation Software

Quotation software for **JAZ Home Theatres** (BRIO Jaz home theater systems): build a
home-cinema quotation item by item with your own prices, route discounts through the
approval hierarchy, and download the branded JAZ quotation PDF.

```
Quote/
├── backend/     Django API (accounts, catalog, quotes, dashboard, adminpanel)
├── frontend/    React + Vite + MUI app (sales app + admin panel)
└── deploy/      VPS / Nginx / systemd helpers
```

## Run it locally — one command

From the project root in Windows PowerShell:

```powershell
./start.ps1
```

It installs everything on the first run, migrates, seeds, and starts both servers:

- Backend → http://127.0.0.1:8080
- Frontend → http://localhost:3000

Local data lives in `backend/jaz.sqlite3` (set `SQLITE_NAME` to use another file).
Add a ready-made sample quotation (the template's 7.2.4 cinema) with:

```powershell
cd backend; .\.venv\Scripts\python manage.py seed --demo
```

### First login

`manage.py seed` creates one Admin login from `backend/.env`:

- `SEED_ADMIN_EMAIL` — the admin email (login codes are emailed here)
- `SEED_ADMIN_PASSWORD` — the first password (if unset, a random one is generated and printed once); change it after signing in

With `OTP_ENABLED=true` and SMTP configured, every sign-in also needs the 6-digit code
emailed to the user. Set `OTP_ENABLED=false` to sign in with the password only (local testing).

## How a quotation is built

1. **Customer** — name, mobile, e-mail, project address, city/state (these print on the cover).
2. **Project** — pick a package (5.1.2 sound system · 7.2.4 home cinema · 9.4.6 reference
   cinema) or start from scratch; room, size, seats, configuration, investment level and the
   recommended specification (all editable).
3. **BOQ & pricing** — add items from the catalog or custom lines. **Every line's quantity,
   unit, price and GST is set by hand.** Lines can be marked *optional* (priced separately,
   not in the total). An extra discount can be entered in % or ₹.
4. **Scope & finishes** — tick the standard JAZ scope, add project-specific lines, edit finishes.
5. **Terms** — workmanship warranty, AMC rates, payment schedule (standard 30 / 60 / 10 with the
   rupee amount per stage), timeline, validity, bank account.
6. **Review** — summary, authorised-signatory signature, live PDF preview.

### Pricing and approvals

- Catalog **list prices** are the starting point. Pricing a line **below** its list price
  counts as discount, exactly like the discount field — so the approval slabs can't be
  bypassed by editing prices. Markups on one line never hide cuts on another.
- **Total discount vs list** = (list value − offer) ÷ list value. It drives the approval
  chain (BDM ≤ 15% · RM ≤ 25% · RSD ≤ 30% · RSD → Admin ≤ 35% · Admin above).
- GST is calculated per line (0 / 5 / 12 / 18 / 28 %).
- Warranty (workmanship years), AMC rates (Comprehensive / Preventive) and custom payment
  schedules have their own approval rules (`backend/quotes/rules.py`).

## The quotation PDF

Rendered by headless Chrome/Edge/Chromium from `backend/templates/quotation.html`:

- **Cover** — `pdf_assets/jaz_cover.jpg` with name, mobile, e-mail, city, state, address,
  date, model (package) and quotation number written on its lines.
- **Content pages** on `pdf_assets/jaz_content.jpg` (gold corners), flowing across as many
  pages as needed: welcome & about JAZ, quotation details, recommended specification, scope,
  design & finishes, commercial offer (actual vs offer price, GST, grand total in words,
  optional upgrades), detailed BOQ, payment terms, delivery, warranty & AMC, customer / JAZ
  scope, exclusions, notes, order confirmation & cancellation policy, bank details.
- **Customer acceptance** — always a page of its own, never split.

Quotation numbers follow the template: `JAZHT-2026-0001`. Template text lives in
`backend/catalog/jaz.py`; fonts (Cormorant Garamond, Montserrat — OFL) in `pdf_assets/fonts`.

## Admin panel — http://localhost:3000/admin

- **Prices & Catalog** — products (list price, GST, brand / model class, unit, on/off),
  packages (items, quantities, specification), categories (default GST), payment terms.
- **Company & Bank** — company name, address, phone, e-mail, website, GSTIN, PAN and the bank
  account printed on every PDF (the bank page appears once an account number is set).
- **Quotations, Approvals, Users & Hierarchy, Audit log.**

The starting catalog prices are **indicative** — set the real ones in Prices & Catalog.

## Email

SMTP settings in `backend/.env` (`EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`)
send login codes, password resets, approval notifications and customer e-signature links.

## Tests

```powershell
cd backend; $env:OTP_ENABLED="false"; .\.venv\Scripts\python manage.py test
```

## Deploying

See `DEPLOY.md`. The GitHub Actions deploy job is **off** until the repository variable
`DEPLOY_ENABLED` is `true` and `VPS_HOST`, `VPS_HOST_KEY`, `SITE_URL` are set.
