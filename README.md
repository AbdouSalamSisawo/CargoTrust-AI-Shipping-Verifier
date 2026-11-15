# CargoTrust AI: shipping document verification

**From email inbox to discrepancy report.** CargoTrust checks every **Shipping Instruction (SI)**
against its draft **Bill of Lading (BL)** before the BL is issued. It reads customer emails and
documents in whatever format they arrive (text, PDF, Word, Excel, scanned PDFs and phone photos),
compares the seven fields that cause costly BL amendments, and drafts the reply to the customer.
When it cannot decide reliably, it sends the case to a person with the reason and the evidence
instead of guessing.

![Decision trace for a PDF pair with a weight discrepancy](public/screens/email-trace.png)

## Why it matters

A wrong consignee, port or weight on a Bill of Lading means amendment fees, delayed release and
cargo held at the port. Documentation desks check these by eye, document by document, across
hundreds of emails a day. CargoTrust does the reading and comparison in seconds and leaves people
the decisions that need judgement.

## What it does

| Stage | How |
| --- | --- |
| **Intake** | Upload an SI and draft BL (any format, including a photo taken on a phone), or import customer emails saved as `.eml` from Outlook or Gmail. SI and BL attachments are found by file name or, when the name says nothing ("scan0042.pdf"), by their content. |
| **Classify** | Each email is sorted into document check, SI request, invoice query, general or spam. The body outranks the subject, so a misleading subject cannot reroute an email; phishing is screened first. |
| **Read** | The format is detected from the bytes. PDFs are rebuilt from page geometry, Word tables keep their line breaks, Excel keeps label/value rows. **Scans and photos are read by OCR and, when enabled, by Claude's vision model** (see below). |
| **Extract** | "Port of Loading", "Load Port", "POL" and "PORT OF LOADING (装货港)" land in one field. Placeholders ("TBA", "____MT") are never treated as values. Totals fall back to the container table. |
| **Compare** | SI is the reference. Company names must match exactly apart from formatting (an extra word is a different company). Ports must agree on city and UN/LOCODE. Numbers must match exactly after unit conversion (21.577 MT = 21,577 kg). |
| **Decide** | **Match** (`OK`) · **Discrepancy** (`MISMATCH`) with the exact fields (*SI: 6 / BL: 5*) · **Needs review** (`NEEDS_REVIEW`) with a reason: missing attachment, unreadable or scanned document, wrong document type, or missing value. |
| **Act** | Every item gets a step-by-step **decision trace**, the source line behind every value, and a **drafted reply** (amendment request, confirmation, or request for the missing document) that opens in the operator's mail app. |
| **Review** | Escalations go to a review queue where an operator approves, rejects or corrects values; corrections re-run the comparison. |

## AI reading for scans and photos

Image-only PDFs and phone photos have no text layer. OCR reads them poorly: on a clean photo,
Tesseract still turns `APRIL FAR EAST (M) SDN BHD` into `(M) SDN BHD` and misses the weight.

With an Anthropic API key, CargoTrust sends the page images to **Claude (`claude-haiku-5-5` by
default; `claude-opus-5-5` for the most accurate reads of badly degraded scans)**, which transcribes the document into the same `Label: value` layout the other readers produce. The model is
told to copy exactly what is printed and never correct, normalise or complete a value, and to mark
anything it cannot read. The transcription then goes through the **same deterministic extractor and
comparator**; the AI never decides whether documents match. OCR still runs as an independent
cross-check, and the console shows where the two agree.

An administrator chooses what happens next:

* **A human confirms** (default): every scan goes to the review queue with the AI pre-check filled in.
* **Decide automatically when clear**: if the AI read every field clearly, the scan is decided like a
  text PDF; anything marked unclear still goes to a person.

Only page images of scans are sent to the API. Text PDFs, Word and Excel files are read locally.
Each organisation uses its own API key (Settings → AI reading, or `ANTHROPIC_API_KEY`), so usage is
billed to its own Anthropic account and its documents go through its own data agreement.
Without a key, everything works; scans are read by OCR and always go to a person.
`npm run check:ai` tests this decision path offline, without a key.

## Accounts, roles and audit trail

* Email and password sign-in. Passwords are hashed with scrypt; sessions are HMAC-signed cookies.
* Roles: **admin** (users, settings, workspace data), **operator** (submit documents, import email,
  resolve reviews), **viewer** (read-only).
* New users get a temporary password and must change it on first sign-in. Repeated failed sign-ins
  are throttled.
* The **activity log** records every sign-in, check, review decision, export and setting change, and
  each item shows its own history.
* Results export to CSV for reporting.

## Run it

### Docker (recommended for a server)

```bash
docker compose up -d --build
docker compose logs cargotrust | grep -A3 "first-run administrator"
```

Open <http://localhost:3000> (or the server's address on your network) and sign in with the
administrator shown in the log. The database, uploaded documents and OCR cache live in the
`cargotrust-data` volume. Settings come from environment variables (see
[`.env.example`](.env.example)), all optional: `ANTHROPIC_API_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
`AUTH_SECRET`, `SAMPLE_DATA`.

### Node.js (laptop)

```bash
npm install
npm run build && npm start      # → http://localhost:3000   (or: npm run dev)
```

On first boot CargoTrust creates the administrator account and writes its credentials to
`data/admin-credentials.txt` (git-ignored); delete the file after you change the password. Requires
Node 18.18+.

The first boot also loads a **sample inbox of 520 realistic shipping emails** so there is something
to explore. Remove it under **Settings → Workspace** before going live; your own uploads and imported
email are kept.

### Vercel (public link with HTTPS)

Serverless hosting has no lasting local disk, so on Vercel CargoTrust keeps its data in **Postgres**
and its documents in a **private Vercel Blob store**. Both are switched on by environment variables;
without them it uses `data/` as above.

1. Import the repository in Vercel (framework: Next.js; no build settings to change).
2. **Storage → Connect Database → Neon** (Postgres). This sets `DATABASE_URL`.
3. **Storage → Create → Blob**, access **Private**, connected to the project. This sets the Blob credentials.
4. **Settings → Environment Variables**: set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (first administrator),
   `AUTH_SECRET` (32+ random characters) and, for AI reading, `ANTHROPIC_API_KEY`.
5. Deploy. The first request creates the workspace, including the sample inbox unless `SAMPLE_DATA=0`.

To start the hosted copy with an existing local workspace instead, put `DATABASE_URL` and
`BLOB_READ_WRITE_TOKEN` in `.env.local` (from `vercel env pull`) and run `npm run data:push` once before
the first visit. It refuses to overwrite a database that already holds a workspace.

`/api/health` reports which storage is in use (`"storage": "postgres", "files": "blob"`). The same two
variables work on a company server too: point `DATABASE_URL` at any Postgres 13+ to run several
CargoTrust instances behind a load balancer.

## Proven, not claimed

| Check | Result |
| --- | --- |
| **Averis × Monash 2026 benchmark**, graded by the organizers' own scorer on 520 emails against a private answer key | **1.0000** · classification macro-F1 1.000 · defect F1 1.000 · **46/46** defects caught on the exact fields · **20/20** escalations, 0 false alarms |
| **Mutation robustness**: every clean SI/BL pair rewritten 15 ways the engine never saw | **448/448** harmless rewrites stay clean · **435/435** planted defects caught on exactly the planted field |
| AI decision path (`npm run check:ai`) | 6/6 |

The benchmark grader was used only as an aggregate scoreboard; the per-email answers were never read.
Every rule targets a general pattern (body intent, label synonyms, units, legal forms,
placeholders), and the mutation benchmark shows those rules hold on documents outside the dataset.

```bash
npm run robustness   # mutation benchmark → out/robustness.json
npm run check:ai     # AI-reading decision path, offline
npm run engine       # process the sample inbox offline → out/
npm run score        # benchmark grader (needs the organizers' kit in .local/, git-ignored)
```

## Console

| Page | What it is for |
| --- | --- |
| **Dashboard** | Live totals, pipeline flow, defect histogram, items needing attention. |
| **New check** | Upload an SI + draft BL (file, photo or pasted text), or import `.eml` files. |
| **Inbox** | Every email and upload with its result; filters, search, CSV export. |
| **Item detail** | Decision trace, SI ↔ BL comparison with source lines, the original file, what was read (AI transcription and OCR side by side), drafted reply, history. |
| **Review queue** | Cases the engine could not decide: evidence, per-field corrections, then correct, mark as reviewed or reject. |
| **Activity log** | Who did what, and when. |
| **Quality** | Self-test suite, mutation benchmark, benchmark record. |
| **Settings** | Your password; team and roles; AI reading; organisation name and sample data. |

## Interface design

* **Palette:** deep maritime navy for dark surfaces, Atlantic blue for actions, maritime teal as the
  accent, amber for anything waiting on a person, and green and red reserved for check results.
* **Type:** IBM Plex Sans for the interface, IBM Plex Sans Condensed for marketing headlines, IBM Plex
  Mono for document data. Fonts are self-hosted, so the console works without internet access.
* **Tokens:** colours, radii, shadows and motion live in `tailwind.config.ts`; shared component
  classes (buttons, cards, tables, page headings) in `src/app/globals.css`.
* **Motion:** short and functional (menus, tabs, the landing-page check demo). Everything respects
  the reduced-motion setting.
* **Illustration:** the container-terminal scene is an original SVG; no stock imagery and no real
  port or company is depicted. Demonstrations on the landing page are labelled as illustrations.

## Architecture

```text
src/
├── middleware.ts                 # no session → no console page, no API
├── app/
│   ├── page.tsx · login/
│   ├── (console)/                # dashboard  new  emails  emails/[id]  reviews  activity  evaluation  settings
│   └── api/                      # route handlers; every one calls requireUser(role)
│       ├── auth/{login,logout,me,password}   users  users/[id]
│       ├── ingest/{upload,eml,sample}        emails  emails/[id]  emails/[id]/source
│       ├── reviews  reviews/[id]  metrics  export  audit
│       └── settings  settings/ai-test  workspace  evaluation  health
├── components/                   # shell (session + roles), UI kit, decision trace, reply draft
└── lib/
    ├── auth.ts · passwords.ts    # signed sessions, scrypt, role guard, sign-in throttling (from the audit log)
    ├── store.ts                  # getDB() / mutate(), audit log, first-run admin, migrations
    ├── pgstore.ts                # Postgres backend: one row per record, revision check, row-locked writes
    ├── files.ts                  # documents and read cache: data/ on disk, or a private Vercel Blob store
    ├── ingest.ts                 # uploads and .eml import (mailparser)
    ├── dataset.ts                # sample inbox, attachment reads, cached OCR and AI reads
    └── engine/
        ├── classify.ts           # body cleaning, spam screen, intent scoring
        ├── readers.ts            # byte sniffing; PDF geometry, OCR, photos, DOCX, XLSX → canonical layout
        ├── vision.ts             # Claude vision transcription (structured output, refusal fallback)
        ├── extract.ts            # label dictionary, blocks, table fallback, placeholders, document type
        ├── normalize.ts          # legal names, ports + UN/LOCODE, units, number formats
        ├── compare.ts · pipeline.ts · trace.ts · reply.ts · review.ts
        └── robustness.ts · selftest.ts
```

**Design decisions**

* **No AI in the decision path.** The vision model only reads; deterministic rules decide. The same
  input always gives the same answer, and every value traces back to a source line.
* **One canonical layout.** Every reader produces the same `Label: value` text, so extraction,
  evidence highlighting and the "what was read" viewer work identically for every format.
* **Escalate, never guess.** A crash, a placeholder, an unclear scan or a missing document can never
  produce `OK`.
* **Runs on-premise.** One container, one data volume, OCR model bundled; the only outbound call is
  the optional AI reading.
* **Two storage modes, one code path.** With no configuration everything lives in `data/` (one JSON
  document with atomic writes, plus files), which suits a laptop or a single container. With
  `DATABASE_URL` and a Blob store it runs on Postgres and object storage, for serverless hosting or
  several instances. Every consumer goes through `getDB()` / `mutate()`; each instance keeps the
  workspace in memory, checks one revision number per read, and writes only changed records inside a
  row-locked transaction.

## Limitations and next steps

* Each server instance holds the whole workspace in memory. That is fast and simple up to tens of
  thousands of items; beyond that, queries should move into SQL.
* Email arrives by `.eml` import; a live mailbox connection (IMAP / Microsoft 365) is the natural next
  step, as is single sign-on.
* Drafted replies open in the operator's mail client; CargoTrust does not send email itself.
* Accuracy is measured on the benchmark data and mutations of it. Real inboxes bring new label
  spellings; adding one to the dictionary in `extract.ts` is a one-line change.

## Credits

* Benchmark problem statement and sample data: Averis × Monash Hackathon 2026 / SDOC organizers
  ([docs/problem-statement.pdf](docs/problem-statement.pdf)).
* OCR: [Tesseract.js](https://github.com/naptha/tesseract.js). PDF: [pdf.js](https://mozilla.github.io/pdf.js/).
  AI reading: [Anthropic Claude](https://www.anthropic.com/).

## License

MIT. See [LICENSE](LICENSE).
