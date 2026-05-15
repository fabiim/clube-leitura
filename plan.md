# Plan: book club voting site — archive + agenda

## Goal

Restructure `index.html` from a single-page voting tool into a three-tab static site:

- **Início** — agenda (chronological log of meetings, newest first) plus a dual-state callout (active-vote CTA, or "next book to order" card).
- **Votação** — the existing live voting flow, refactored, with two new no-active-vote branches.
- **Arquivo** — list of past closed votes, expandable inline to show the full results UI from a frozen snapshot.

Vote lifecycle is operated **manually via Claude** editing the source (no admin UI). Live vote storage stays in the existing Google Apps Script / Google Sheet backend; closed votes are snapshotted into a hardcoded `ARCHIVE` array in source.

## Scope boundaries

**In scope**
- All three views and the nav router.
- Refactor of the live-vote data shape and the results renderer.
- Letras Lavadas as an optional third shop link.
- `CLAUDE.md` documenting the close-vote and open-vote workflows.

**Out of scope**
- Any server-side change (no DELETE endpoint, no Apps Script changes).
- Authentication or admin UI.
- Editing the agenda or archive through the page (you'll always edit `index.html` directly with Claude's help).
- Build tooling, framework, dependencies. Stays a single static HTML file with vanilla JS.

## Key decisions made during planning

| Decision | Outcome |
|---|---|
| Layout | Three persistent tabs: `Início · Votação · Arquivo`. URL hash routing. Default tab `inicio`. |
| Início content | Agenda list (newest-first) with a dual-state callout slot above. No separate "hero" / "next meeting" section — the chronologically nearest future agenda entry just gets visual emphasis. |
| Agenda card ordering | Strictly by `date` descending. Future and past are interleaved by date, no separator. |
| Agenda past-meeting fields | Two separate fields: `findings` (prominent free text) and `participants` (small de-emphasised chips). |
| Same-day rule | A meeting whose `date` equals today is **future** (not yet past). |
| Book metadata source | **(revised, step 5)** Central `BOOKS` registry keyed by id. `ACTIVE_VOTE.bookIds`, `ARCHIVE[].bookIds`, `ARCHIVE[].winnerId`, and `AGENDA[].bookId` reference it. Editing a book's title/author/sinopse/links propagates to live + archive + agenda views. Once an id is referenced by ARCHIVE or AGENDA, it MUST NOT be deleted or renamed — there is no per-entry snapshot fallback. Replaces the original per-entry deep-copy design. |
| Active-vote shape | One `ACTIVE_VOTE` object (or `null`). Holds `number`, `startedAt`, `maxVotes`, `bookIds`. Symmetric with archive entries. |
| Closed-vote snapshot | **(revised, step 5)** Only the *vote* is frozen: `number`, `startedAt`, `closedAt`, `maxVotes`, `bookIds` (ballot composition), `votes`, `voters`, `winnerId`, optional `winnerNote`. Book metadata resolves live from `BOOKS` at render time — a typo fix or URL update appears in every historical view. The vote tally and voter records are immutable. |
| Winner storage | Book id (canonical) plus optional free-text `winnerNote` for tie-resolution context. |
| Live results UI | Refactor the current `showResults()` into a pure `renderResultsInto(container, books, votes, voters)` reused by Arquivo. |
| Letras Lavadas | New optional `letrasLavadas` URL field. All three shop URLs (`wook`, `bertrand`, `letrasLavadas`) become optional. URLs to be web-searched during step 7. |
| Votação when no active vote | Show the most recent archive entry's winner as a single "chosen book" card. Falls back to a minimal "sem votação activa" placeholder only if `ARCHIVE` is also empty. |
| Close-vote data fetch | Claude curls the live Apps Script URL (base64-decoded from source) when closing. |
| Sheet reset | Manual — same as today's reset button copy. No backend change. |
| Archive row long-title behaviour | Truncate winner title with ellipsis (single-line collapsed row, full title visible on expand). |
| Documentation home | New `CLAUDE.md` at repo root with data model + close/open workflows. `README.md` left as-is. |

## Data model

All four constants live at the top of the `<script>` block in `index.html`, just below the API URL. Declaration order: `BOOKS` → `ACTIVE_VOTE` → `ARCHIVE` → `AGENDA`. The latter three reference `BOOKS` by id.

### `BOOKS` (canonical registry)

```js
/**
 * Single source of truth for all book metadata.
 *
 * Everything else references entries here by their object key
 * (the id): ACTIVE_VOTE.bookIds, ARCHIVE[].bookIds,
 * ARCHIVE[].winnerId, AGENDA[].bookId.
 *
 * Invariants:
 *  - Every id referenced anywhere must have a matching key.
 *  - Once a key is referenced by ARCHIVE or AGENDA, it MUST NOT
 *    be deleted or renamed — there is no per-entry snapshot
 *    fallback for metadata.
 *  - Edits to title/author/sinopse/links propagate everywhere
 *    (live ballot + historical archive + agenda). Only vote
 *    tallies and voter records are frozen inside ARCHIVE.
 *
 * @typedef {{
 *   emoji:          string,
 *   title:          string,
 *   author:         string,
 *   pages:          number,
 *   sinopse:        string,
 *   porque:         string,
 *   wook?:          string,
 *   bertrand?:      string,
 *   letrasLavadas?: string,
 * }} Book
 */

/** @type {Record<string, Book>} */
const BOOKS = { /* ... */ };
```

Note: `Book` has no `id` field — the registry key is the id. The helper `getBook(id)` returns `{ id, ...BOOKS[id] }` (or `null`) so renderers can rely on `book.id` being present.

### `ACTIVE_VOTE`

```js
/**
 * The currently-open vote, or null if no vote is open.
 *
 * Invariants:
 *  - If non-null, `number` is exactly ARCHIVE[0].number + 1
 *    (or 1 when ARCHIVE is empty).
 *  - `bookIds` is non-empty; every id resolves in BOOKS; ids
 *    are unique within the array.
 *  - `maxVotes` is between 1 and bookIds.length.
 *  - `startedAt` is an ISO date (YYYY-MM-DD).
 *
 * @typedef {{
 *   number:    number,
 *   startedAt: string,
 *   maxVotes:  number,
 *   bookIds:   string[],
 * } | null} ActiveVote
 */
```

### `ARCHIVE`

```js
/**
 * Closed-vote snapshots, ordered newest-first.
 *
 * Only the *vote* is snapshotted (votes, voters, ballot
 * composition via bookIds). Book metadata is resolved live
 * from BOOKS at render time.
 *
 * Invariants (per entry):
 *  - `closedAt >= startedAt`.
 *  - `winnerId` is in `bookIds` and resolves in BOOKS.
 *  - `winnerNote` is omitted unless explicitly set.
 *  - `votes` keys are a subset of `bookIds`.
 *  - `voters[nameKey].books` are a subset of `bookIds`.
 *  - Every id in `bookIds` resolves in BOOKS.
 *
 * Invariants (across array):
 *  - ARCHIVE[0].number > ARCHIVE[1].number > … > ARCHIVE[N-1].number.
 *  - Numbers are dense (no gaps).
 *
 * @typedef {{
 *   number:      number,
 *   startedAt:   string,
 *   closedAt:    string,
 *   winnerId:    string,
 *   winnerNote?: string,
 *   maxVotes:    number,
 *   bookIds:     string[],
 *   votes:       Record<string, number>,
 *   voters:      Record<string, { name: string, books: string[] }>,
 * }} ArchiveEntry
 */
```

### `AGENDA`

```js
/**
 * Meeting log, ordered any way — renderAgenda sorts newest-first by date.
 *
 * Per-entry rules:
 *  - `date` is ISO (YYYY-MM-DD).
 *  - `time` and `location` are free-text strings.
 *  - `bookId` references a key in BOOKS.
 *  - `upToPage` is the planned reading target page for this session.
 *  - `findings` and `participants` are valid only for entries
 *    whose `date` is strictly before today.
 *
 * @typedef {{
 *   date:          string,
 *   time:          string,
 *   location:      string,
 *   bookId:        string,
 *   upToPage?:     number,
 *   findings?:     string,
 *   participants?: string[],
 * }} AgendaEntry
 */
```

## DOM contract

```html
<nav class="tabs">
  <a href="#inicio"  data-tab="inicio">Início</a>
  <a href="#votacao" data-tab="votacao">Votação</a>
  <a href="#arquivo" data-tab="arquivo">Arquivo</a>
</nav>

<section id="view-inicio" data-view="inicio">
  <div id="inicio-callout"><!-- renderCalloutSlot --></div>
  <h2 id="agenda-heading" class="section-heading">Sessões</h2>
  <div id="agenda-list"><!-- renderAgenda --></div>
</section>

<section id="view-votacao" data-view="votacao">
  <div id="chosen-book-section" class="hidden"><!-- renderChosenBook --></div>
  <div id="no-vote-section"     class="hidden">Sem votação activa. <a href="#arquivo">Ver arquivo →</a></div>
  <!-- existing #name-section, #vote-section, #results-section, #thank-you, #voter-list, #peek-btn, #back-btn -->
</section>

<section id="view-arquivo" data-view="arquivo">
  <h2 class="section-heading">Arquivo de votações</h2>
  <div id="archive-list"><!-- renderArquivo --></div>
  <p id="archive-empty" class="muted hidden">Ainda não há votações fechadas.</p>
</section>
```

## API surface

### Router

- `currentTab() → TabId` — read URL hash; fallback `'inicio'`.
- `navigateTo(tab)` — switch view, update hash, no-op if same tab; push history on direct call only.
- `initRouter()` — wire nav clicks + `hashchange`; run initial route.

### Início

- `renderInicio()` — paints callout slot + agenda list.
- `renderCalloutSlot()` — three states: active-vote CTA, "próximo livro" card, or hidden.
- `renderAgenda()` — sort `AGENDA` newest-first, emit future/past cards, emphasis on chronologically next future entry.
- `isFutureDate(dateStr)` — same-day counts as future. ISO string comparison.

### Votação

- `renderVotacao()` — dispatch on `ACTIVE_VOTE` and `ARCHIVE`: live flow, chosen-book card, or "sem votação" placeholder.
- `renderChosenBook(entry)` — single-card view for `ARCHIVE[0]`'s winner.
- `renderCandidateBooks()` (was `renderBooks`) — paint vote grid from `ACTIVE_VOTE.books`.
- `toggleBook(id)` — same toggle behaviour, cap from `ACTIVE_VOTE.maxVotes`.
- `updateSelectionUI()` (was `updateCards`) — sync card classes + footer counter.
- `submitVote()` — unchanged behaviour (optimistic, rollback on failure).
- `showLiveResults(justVoted)` — handles live chrome (thank-you, saving indicator, badge, peek/back), then delegates to `renderResultsInto`.
- `resetPoll()` — unchanged.
- `updateVoterCount()` — hidden when `ACTIVE_VOTE == null`.

### Arquivo

- `renderArquivo()` — paint archive list + empty state.
- `renderArchiveRow(entry)` — collapsed header + lazy details. Click toggles via `expandedEntries: Set<number>`.
- `formatDateRange(startedAt, closedAt)` — `DD/MM – DD/MM` (same year) or `DD/MM/YY – DD/MM/YY` (cross-year).

### Shared

- `getBook(id)` — resolves an id to `{ id, ...BOOKS[id] }` or `null`. All renderers consume the returned object; callers do `bookIds.map(getBook).filter(Boolean)` to build the books array for `renderResultsInto`.
- `renderResultsInto(container, books, votes, voters)` — pure renderer. Clears container, paints ranked list with medals, leader/tie highlight, voter chips, per-book expand. Lenient on data mismatches (votes/voters keys that don't appear in `books` are tolerated; unresolved ids are silently dropped at the caller).
- `renderShopLinks(book)` — returns 0–3 anchors with `·` separators, or `null` when none.

### Init

- `init()` — config check → `loadData()` → render all three views → wire handlers → `initRouter()` → hide spinner.
- `loadData()` — fetch live API; skip when `ACTIVE_VOTE == null`; errors caught, init continues.
- `initEventHandlers()` — wire name input, submit, refresh, reset, peek, back.

## Implementation sequence

Each step leaves the site usable. Smoke-test in a browser after every step.

- [x] **Step 1 — Refactor `BOOKS` + `MAX_VOTES` → `ACTIVE_VOTE`.**
  - Add `ACTIVE_VOTE` with `number: 1`, `startedAt` = today, `maxVotes: 2`, current 6 books in `books`.
  - Replace references: `BOOKS` → `ACTIVE_VOTE.books`, `MAX_VOTES` → `ACTIVE_VOTE.maxVotes`.
  - Rename: `renderBooks` → `renderCandidateBooks`, `updateCards` → `updateSelectionUI`.
  - Smoke: full vote / peek / refresh / reset paths work identically.

- [x] **Step 2 — Extract `renderResultsInto()` + `renderShopLinks()`.**
  - Lift ranking + chips paint into `renderResultsInto(container, books, votes, voters)`.
  - Lift shop-links HTML into `renderShopLinks(book)` (still Wook + Bertrand only here).
  - `showResults` → `showLiveResults`, delegates to `renderResultsInto`.
  - Smoke: results render identically.

- [x] **Step 3 — Add 3-tab nav + router + view section wrappers.**
  - Insert nav markup + CSS.
  - Wrap existing chrome in `<section id="view-votacao">`.
  - Add stub `view-inicio` / `view-arquivo` ("Em breve").
  - Implement `currentTab`, `navigateTo`, `initRouter`.
  - **Deviation**: restructured the header into a top-level banner (title left, tabs right, shared stone-200 rule). Subtitle and badge moved into the Votação view since they're voting-specific. Mobile stacks at ≤480px. Subtitle copy fixed: "Escolhe o próximo livro" (was "os próximos 2 livros" — only one book wins).
  - Smoke: nav switches views, hash updates, Back/Forward work, reload preserves view, mid-vote state survives a tab round-trip.

- [x] **Step 4 — Add `ARCHIVE` constant + Arquivo view.**
  - Add `const ARCHIVE = []` + typedef comment.
  - Implement `renderArquivo`, `renderArchiveRow`, `paintArchiveDetails`, `formatDateRange`, `expandedEntries` Set.
  - Styles: ellipsis truncation on `.archive-title-author`, expand affordance (➕/➖), `.archive-details` block.
  - Collapsed row shows winner emoji + title — author (no #N, no dates per user direction). Dates live in the expanded meta line.
  - Smoke: empty state visible. Temporarily craft a fake entry, verify row + expansion render, then revert.

- [x] **Step 5 — Add `AGENDA` constant + Início view.**
  - Added `const AGENDA = []` + typedef comment.
  - Implemented `renderInicio`, `renderCalloutSlot`, `renderAgenda`, `renderAgendaRow`, `isFutureDate`, `formatAgendaDate`, `todayISO`.
  - Styles: subtle amber pill for active-vote CTA (`.inicio-pill`), prominent expandable card with `➕`/`➖` for no-vote callout (`.inicio-card`), agenda rows with two-line layout, `📌` prefix on the chronologically next future entry, strikethrough title + greyed emoji on past entries, italic muted author line, participants chips.
  - Wired callout pill click → `navigateTo('votacao')`. No-vote card has a toggle expand showing winner emoji+title+author+sinopse+shop links.
  - **Deviation 1**: per-entry `AgendaBook` typedef dropped. AGENDA entries reference `BOOKS` via `bookId` (see deviation 2).
  - **Deviation 2 (mid-step refactor)**: introduced central `BOOKS` registry as a single source of truth. `ACTIVE_VOTE.books` → `bookIds`, `ARCHIVE[].books` → `bookIds`, `AGENDA[].book` → `bookId`. `Book` typedef no longer carries `id` (key *is* the id). New helper `getBook(id)` returns `{ id, ...BOOKS[id] }` or `null`. All renderers updated. Trade-off accepted: archive entries are no longer self-contained metadata snapshots — book metadata edits now propagate to historical views; only the vote tally and voter records are frozen. Decisions table, data model section, API surface, and close/open workflow steps below all updated.
  - **Deviation 3**: agenda card layout includes author (muted italic, indented under the title row) — answers to "missing author in the title". Visual: date · emoji title (range) / author / location · time.
  - **Deviation 4**: added `upToPage?: number` field on `AgendaEntry` for per-session reading targets (rendered as `(até pág. N)`).
  - Smoke-tested with three fixture entries (past with findings+participants, future-not-next, future-next). Fixtures reverted to `[]`.

- [ ] **Step 6 — Chosen-book + no-vote branches in Votação.**
  - Implement `renderChosenBook(entry)` and the `#no-vote-section` placeholder.
  - Update `renderVotacao` to dispatch on state. Update `updateVoterCount` to hide when null.
  - Smoke: with current `ACTIVE_VOTE`, behaviour unchanged. Set `ACTIVE_VOTE = null` with a fake archive entry → chosen-book card on Votação, Início callout switches to "próximo livro". Set `ARCHIVE = []` too → placeholder on Votação, callout hides. Revert.
  - **Note**: this step may briefly disrupt a live vote during validation. Do on a branch and merge during a quiet window, or accept short outage.

- [ ] **Step 7 — Letras Lavadas.**
  - Make `wook`, `bertrand`, `letrasLavadas` all optional in `Book` type.
  - Update `renderShopLinks` to emit only present links separated by `·`, return `null` when none.
  - WebSearch `letraslavadas.pt` for the 6 current books. Propose URLs (or "not stocked") for review.
  - Wire confirmed URLs into the 6 entries.
  - Smoke: cards show 2 or 3 links cleanly, no orphan separators.

- [ ] **Step 8 — `CLAUDE.md` at repo root.**
  - `## Data model` — pointers to `ACTIVE_VOTE`, `ARCHIVE`, `AGENDA` in `index.html`, with the invariants from this plan.
  - `## Close-vote workflow` — full procedure from behaviour group 6: curl the base64-decoded API URL, validate winner (auto-detect or user-specified, abort on tie without override), build snapshot in the documented field order, prepend to `ARCHIVE`, set `ACTIVE_VOTE = null`, remind user to clear the sheet.
  - `## Open-vote workflow` — increment `number` from `ARCHIVE[0].number + 1`, set `startedAt` to today, choose `books` + `maxVotes`, require sheet to already be empty.
  - Leave `README.md` untouched.

## Close-vote workflow details (for `CLAUDE.md`)

Trigger phrases: `close the current vote`, `close the vote, winner is X`, `close the vote, winner is X, note "…"`.

1. **Fetch live**: read `index.html`, extract `_E` (base64), decode → API URL. `curl` it, parse JSON `{votes, voters}`. Abort with error message on failure; do not edit the file.
2. **Determine winner**:
   - Explicit `winnerId` supplied → validate against `ACTIVE_VOTE.bookIds` (and confirm `getBook` resolves). Abort if unknown.
   - Else auto-derive from max count. Abort if there's a tie at the top; ask user to pick.
3. **Build snapshot** (field order matters for diff readability):
   - `number`, `startedAt`, `closedAt: <today ISO>`, `winnerId`, optional `winnerNote`, `maxVotes`, `bookIds: [...ACTIVE_VOTE.bookIds]` (verbatim copy of the array, not the metadata — `BOOKS` is the source of truth), filtered `votes` (keys ⊆ `bookIds`), copied `voters`.
4. **Single-edit diff**: prepend snapshot to `ARCHIVE`, set `ACTIVE_VOTE = null`. Leave `BOOKS` untouched — do NOT remove or rename any entry whose id appears in the new archive entry.
5. **Report back**: `Closed vote #N. Winner: <emoji> <title>. Archive now has K entries.` Remind user to clear the Google Sheet manually.

**Invariants enforced**: `closedAt >= startedAt`; `winnerId ∈ bookIds` and `getBook(winnerId) != null`; `ARCHIVE[0].number == ACTIVE_VOTE.number` before edit.

## Open-vote workflow details (for `CLAUDE.md`)

Trigger phrase: `open vote with books X, Y, Z, maxVotes N` (or similar).

1. Compute next number: `(ARCHIVE[0]?.number ?? 0) + 1`. Abort if `ACTIVE_VOTE != null` (must close first).
2. For every book in the new ballot: if its id is missing from `BOOKS`, add the full `Book` entry there first. New book entries go at the bottom of `BOOKS` to keep diff churn local.
3. Set `ACTIVE_VOTE = { number, startedAt: <today>, maxVotes, bookIds: [...] }`. Validate every id resolves via `getBook` before saving.
4. Remind user: sheet must already be empty before votes are collected.

## Pending items at start of implementation

- **Letras Lavadas URLs** — to be web-searched and proposed at step 7. Books to look up: Saramago (As Intermitências da Morte), Han Kang (A Vegetariana), Camus (O Estrangeiro), Valter Hugo Mãe (A Máquina de Fazer Espanhóis), Nuno Costa Santos (Como Um Marinheiro Eu Partirei), Jorge Amado (Capitães da Areia).
- **First archive entry** — `ARCHIVE` starts empty; no migration of prior votes.
- **First agenda entries** — `AGENDA` starts empty; user will add entries as they happen.

## Status

**Steps 1–5 complete.** Step 6 (chosen-book + no-vote branches in Votação) is next. Note: with the BOOKS refactor done in Step 5, Step 6's `renderChosenBook(entry)` simply does `getBook(entry.winnerId)` and paints the result — no per-entry metadata copy needed.
