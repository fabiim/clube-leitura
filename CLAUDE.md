# CLAUDE.md

Project-specific guidance for Claude. These conventions are not obvious from the source — read this before editing `BOOKS` entries.

## Commands

This section replaces a separate `CHEAT.md`. Keep it current when tooling changes.

| Task | Command |
|---|---|
| Run locally | Open `index.html` in a browser. No server or build step. |
| Test | `tests/run.sh` (headless Chrome, about 3 s; see [Tests](#tests)). |
| Enable the pre-commit hook (once per clone) | `git config core.hooksPath .githooks` |
| Commit without running the hook | `git commit --no-verify` |
| Deploy | `git push origin main` (GitHub Pages publishes automatically; see [Deploy](#deploy)). |

## Spec

A high-level map of behaviour, not a detailed spec. Read the code for details. Update this list when a feature is added or changes shape.

- **Single static page.** All data (`PEOPLE`, `BOOKS`, `AGENDA`, `ARCHIVE`, `ACTIVE_VOTE`) lives as constants in `index.html`. The only network call is the live vote tally (Google Apps Script).
- **Four tabs**, hash-routed: Início, Votação, Estante, Arquivo. `#arquivo/N` opens vote N expanded and centred; `#inicio/YYYY-MM-DD` scrolls to that day's session.
- **Início** lists sessions: upcoming soonest-first (the next one pinned), past most-recent-first. A pill links to Votação while a vote is open.
- **Each session** shows a date, a book, a location, and a book card (sinopse, punchline, and shop links). Nothing is collapsed.
- **Past sessions** split into titled sections: "Discussão" (the written account and the participants), "Citações" (passages from the book the group liked, always visible; who picked each one is recorded but not shown), and "Sinopse" (the book card, without shop links). A participant can bring a gift (a poem, lyric, quote, or excerpt), which opens in a drawer.
- **Votação** is active only when `ACTIVE_VOTE` is set: name, pick N books, see live results. Otherwise it points to the Arquivo.
- **Estante** lists every book in `BOOKS` on the ballot's card, with a status (Lido, A ler, A votos, Perdeu, Ideia) and its history from the book log, with each vote and session linked. Chips filter by suggester (only people who suggested a book get one) and status; the filters live in the URL (`#estante?por=fabio&estado=ideia`). Built on first visit. The only view that shows who suggested a book: the ballot never does.
- **Arquivo** lists closed votes with the winner and expandable per-book tallies, each naming who voted for it (by `PEOPLE` name when the voter is linked).

## Colour palette

Every colour is a custom property in the `:root` block at the top of `index.html`'s `<style>`. There are no raw hex, `rgb()`, or `hsl()` values anywhere else; a test enforces this. To add a colour, add it to `:root` and to the table below.

The scale steps are Tailwind's (50 lightest, 900 darkest), so a missing step can be taken from Tailwind's palette without inventing a value.

| Family | Role | Where |
|---|---|---|
| `stone` (+ `white`) | Neutral. The page, cards, text, and rules. Most of the page. | Everything not listed below, including the Estante's status badges and history text. |
| `amber` | Accent. Something tappable, selected, or current. | Tabs, links, the selected ballot card, the next session, the vote pill, gift chips and drawer, the punchline on upcoming sessions, the Estante's selected filter chips and vote links. |
| `rose` | The group's own words, kept apart from amber. | Session quotes (`rose-100` band, `rose-200` rules). |
| `teal` | A tie. | A tied vote in the results. |
| `green`, `red` | Status only. | Vote confirmation, error box. |

Rules:

- **Amber means "interactive or now".** Don't use it for decoration, or it stops signalling anything. Content that should stand out but isn't tappable gets a different hue, like the quotes' rose.
- **Text contrast is at least 4.5:1 (WCAG AA).** On the light backgrounds (`white`, `stone-50`, `amber-50`), `stone-500` and darker pass; `stone-400` (about 2.4:1) does not, so use it only for decoration and rules, never for text. `amber-700` passes for links (about 4.8:1).
- **Tints carry areas, darks carry text.** Backgrounds use the 50 and 100 steps; borders use 100 to 300; text uses 500 and darker.
- **Check new pairs.** Before adding a text/background pair, compute its contrast ratio.

Known gaps, not yet fixed: `stone-400` is still used for some readable text (result authors, the piece's "who" line, numeric ranks, empty-state messages), and the white-on-`amber-600` vote button is about 3.2:1, below AA for its 16px text.

## Book content rules (`BOOKS` entries in `index.html`)

Every book has two prose fields, `sinopse` and `punchline`, both written by Claude from the same research. Each has a focused job:

| | `sinopse` | `punchline` |
|---|---|---|
| Job | **Informative.** What the book is, led by what readers remember and talk about. | **Appealing.** Why you'd want to read it: one hook. |
| Length | Aim for 120 words or fewer; **150 is a hard ceiling**. | 1–2 sentences, about 12–30 words. Strictly shorter than the sinopse. |

Both must not be boring, and both share these rules:

- **Ground them in research.** Read the publisher's copy (see [Source-fetch reality](#source-fetch-reality-as-of-2026-10-15)) and at least one other source: reader reviews (Wook, Goodreads), blogs, press. Don't invent facts the sources don't support.
- **Order by what people remember.** The research has a second job: find what readers and critics remember and discuss most about the book. That ranking, not a checklist, decides what both fields talk about (see [the dimensions](#sinopse--informative-and-not-boring)).
- **No spoilers.** Never reveal major scenes, twists, or the ending.
- **No awards** (Nobel, Pulitzer, and the like): they tell the reader nothing about why the book is worth their evening.
- **Plain words** everyone in the group understands: no insider terms only readers of the book would know, no clever wordplay about the book rather than the experience of reading it. Use the words people say out loud, not literary or learned ones: "todas as outras famílias", not "o êxodo"; "mulherengo", not "devasso". The text should make a book feel approachable, never intimidating.
- **Say early what kind of book it is**: a family saga, a diary, a short fable, a slow and funny book. Readers decide on that before the plot.
- **Answer the likely hesitation.** Guess what would stop someone in the group from picking it (it's long, it's old, it sounds sad, it's science fiction) and give the reason to read it anyway. *Middlemarch*'s "É longo, mas…" does this. When the research shows a hesitation many readers share (a slow start, confusing first chapters, a bleak middle), name it honestly and say why it pays off. Check that it's common before you write it: count how often it comes up in the top community reviews on the book's Goodreads page, and include it only when it's among the most frequent complaints there, not a complaint from one or two reviews. Describe it as the reviews do (a slow start is not the same as a slow middle).
- **Say what readers love, too.** When many of the top reviews share a reaction (it made them cry, they read it in two days, it made them furious), say so, with the same frequency check as hesitations. Name the reaction concretely and for this book: "muitos leitores choram no fim" is a finding; "impossível de pousar" is a stock phrase that fits any book.
- **A question can be the hook**, if it's the real question the book asks and the reader can't answer it straight away ("Estamos condenados a ser o que herdamos?"). Don't use rhetorical questions that only pad the text.
- **No stock phrases**: "uma viagem inesquecível", "obra-prima", "impossível de pousar", "uma leitura obrigatória". They fit any book, so they say nothing about this one.
- **Different angles.** The punchline may use story details and may sum up the sinopse, but in other words or from another angle. They render one under the other, so the same sentence twice reads as filler.

Until 2026-10-15 the sinopse was verbatim publisher copy and the punchline was the "claude" pitch. The user found the publisher copy dull (often a list of characters) and too long on a phone. Older books still carry that copy until someone asks for a rewrite.

### `sinopse` — informative, and not boring

Describe the book so a reader understands what it is and wants to open it. Active verbs, concrete details. A test enforces the 150-word ceiling for books on the open ballot.

**Dimensions to draw from.** These are options, not slots to fill. No book needs all of them:

- the people: characters, or the author in non-fiction;
- the central conflict or premise;
- the literary themes: the main ideas the book is about;
- setting and period;
- form and voice: diary, letters, alternating chapters, the kind of prose;
- context: when and why it was written, and how it was received.

**Write in order of importance.** From the research, rank the dimensions by how much readers and critics remember and discuss them. Give most of the words to the top ones, and drop a dimension nobody talks about, even if it's easy to state. For *A Leste do Paraíso*, readers talk about the two pairs of brothers, Cathy, Lee and Samuel, good and evil, and the freedom to choose; the three generations and the span from the Civil War to the First World War are scaffolding. For *As Vinhas da Ira*, the Dust Bowl and Route 66 are the story, so setting ranks first.

**Specific names must earn their place.** A place, date, or minor name stays only if the reader gains something from it. Most readers don't know where the Salinas Valley is, so "muda-se para a Califórnia" says enough, and "para construir o seu paraíso" already carries the meaning of the land. If a place matters for what it is (barren, fertile, frozen, a favela), describe it instead of naming it. A character's name tells the reader nothing on its own: say what the character is or stands for (o cozinheiro chinês que é o verdadeiro filósofo da casa), and keep the name only when readers remember the character, with the description next to it. A family or group name never earns its place: "uma família de três gerações", not "os Joad". Keep a place when it is the story (Route 66, the Chelsea Hotel).

**Anchor the setting in what everyone knows.** Give the period through an event the group already knows (a Grande Depressão, a ditadura) and say plainly what it did to people ("arruínam os pequenos agricultores"), instead of naming regions the reader can't place.

**If it really happened, say so.** A true story, or fiction built on events the author saw, is one of the strongest reasons to read. Back it with a fact rather than just asserting it: "Tudo isto aconteceu: Steinbeck visitou os acampamentos de migrantes como repórter."

**Keep the image readers carry away.** One concrete picture beats a list of facts: three generations and everything they own in an old truck.

**Themes.** A theme is a dimension like any other: weigh it by what people say about the book. When readers and critics treat a theme as central, name it plainly instead of gesturing at it ("vai muito mais longe"), and name the strongest one, not a safe generic one. Skip it when the story already carries it or nobody discusses the book in those terms. Name three at most; five only in the rare book that justifies it. Don't hold the central idea back for the punchline to avoid repetition: the sinopse names it, the punchline sells it from another angle.

**Then reread for coherence.** Read the draft as one piece. Does it flow, is the chronology clear, does each sentence earn its place, and would someone who has never heard of the book want to open it? Reorder, cut, or rewrite until it does.

### Source-fetch reality (as of 2026-10-15)

Wook, Bertrand, FNAC, Almedina's search, and most large publisher pages (Quetzal, Porto Editora, Livros do Brasil) sit behind Cloudflare. They return 403 to WebFetch, to `curl` with a browser user-agent, and to headless Chrome.

Use the cheapest route that works, in this order. Reading a whole Wook page through Chrome costs about 2–3k tokens of noise per book (recommendations, reviews); a `curl` with only the needed fields extracted costs a few hundred.

1. **Product URL: one Chrome `navigate`, no page read.** With the Claude-in-Chrome extension (`mcp__claude-in-chrome__*`), `navigate` to `https://www.wook.pt/pesquisa?keyword=<ISBN>`. An ISBN search redirects to the product page, and the tab context in the result shows the final URL. If it still shows the search URL, the redirect hasn't finished; call `tabs_context_mcp` once to read it. Wook and Bertrand share product ids, so the Bertrand URL is the same path on `bertrand.pt`.
2. **Sinopse and page count: `curl`, extract only those fields.** Try Almedina (`almedina.net/catalogsearch/result/?q=<ISBN>` redirects to the product page) or the publisher's own site (Relógio d'Água works). Almedina's `robots.txt` disallows `/catalogsearch/`, so keep it to a few spaced-out lookups. Copy can differ between shops; pick one source per book.
3. **Fallback: read the page in Chrome.** Only when step 2 fails or the Wook copy is needed. `get_page_text` sometimes runs before the page finishes loading and returns an error or the previous page; check the URL in the result and retry once. Take the SINOPSE verbatim (minus noise like "Críticas" or "Wook diz"), `Páginas`, price, and availability.

Close the Chrome tabs you opened. If the extension isn't connected (`tabs_context_mcp` says so), ask the user to open Chrome with it and sign in to claude.ai. Don't ask them to paste text when one of these routes can reach the page, and don't accept search-snippet paraphrases as substitutes for verbatim copy.

### `punchline` — appealing, marked with 👊

One reason to read this book, said so it lands. Pick from the same ranked dimensions as the sinopse, using whatever readers find most gripping: an image, a paradox, the premise, a character, a story detail, or a theme told through the story. Then reread it next to the sinopse: it should add something and not repeat it.

**Short and punchy wins.** When a longer line and a shorter one say the same thing, use the shorter one. This beats completeness, attribution, and nuance. Prefer one hook to two stacked ones: the *As Vinhas da Ira* punchline got stronger when it lost its opener "Queimado em público no ano em que saiu". Sell the story, not only the tone.
**Quotes when they're good.** A critic's or the author's line is welcome if it's sharp and says something about the book itself (Appleyard on *Stoner*). Skip it when it only borrows authority ("um clássico incontornável"). If the quote is long, sum it up in a few words and drop the attribution: Steinbeck's "everything else I have written has been, in a sense, practice for this" becomes "O livro da vida de Steinbeck". Keep it verbatim only when the exact wording is what makes it good. The summary must stay true: *A Leste do Paraíso* wasn't his last book, so "o derradeiro livro" would mislead.

It must be:

- **Sharp** — declarative, no hedging ("talvez", "considerado por alguns", "tem-se considerado").
- **Incisive** — cut every word that isn't pulling weight. Two-word punchlines work.
- **Active** — verbs over nouns, concrete over abstract.
- **Engaging** — open with the hook, never with setup. Sell the story, the stakes, and what it feels like to read it.

Patterns that already work in this registry:

- **Adjective cluster + recommendation** — `saramago`: *Curto, divertido, filosófico, português. A escolha mais segura para começar.*
- **Quote + story + the book's question** — `steinbeck-eden`: *O livro da vida de Steinbeck. Caim e Abel na Califórnia. Estamos condenados a ser o que herdamos?*
- **Quote + punchline** — `stoner`: *«O melhor romance que ninguém leu» — Bryan Appleyard. Vida apagada, prosa devastadora.*

The two fields render one under the other on the ballot card, the session cards, and the archive details. Both are set in Literata, upright. The punchline sits in an amber box on upcoming sessions and the ballot, and loses the box on past sessions.

## Participant pieces (`AGENDA[].participants[].piece`)

Each participant may bring a poem, a song lyric, a quote, or a book excerpt to a session. Record it on that session's past `AGENDA` entry by turning the participant's bare name into an object:

```js
participants: [
  { name: "Fábio Botelho", piece: { title: "Autopsicografia", author: "Fernando Pessoa", text: "O poeta é um fingidor.\nFinge tão completamente\n…" } },
  "Filipa Costa",
],
```

- **`text` is verbatim**, exactly as the person brought it. Keep line breaks as `\n` and leading spaces as they are, because the renderer preserves both. Don't fix spelling, modernise orthography, or trim stanzas.
- **`title` and `author` are optional.** Fill them only when known. Don't guess, and don't look a quote up to "complete" an attribution unless the user asks.
- **Participants without a piece stay bare strings.** Don't convert them to `{ name }`.
- The name must match the spelling used in other entries' `participants`.

On the page, a participant with a piece gets a "+ 🎁" chip under the findings. Tapping it opens a small drawer with the text.

## People (`PEOPLE`)

One entry per person who suggested a book, came to a session, or voted: `id → { name }`. Book logs refer to people by id; session participants and quote pickers use the full `name`, which must match exactly. Names must stay unique once case and accents are ignored. `ARCHIVE` voters keep `name` as typed on the form and link to a person with `person: "<id>"`. Add a person here before using them anywhere else, and never rename an id once used (a `name` can change).

## Book log (`BOOKS[].log`)

Every book carries `log`, the canonical history of what happened to it. The Estante derives each book's status and history from it.

```js
log: [
  { type: "suggested", date: "2026-10-03", by: "fabio" },
  { type: "voting",    date: "2026-10-15", vote: 5 },
  { type: "lost",      date: "2026-10-25", vote: 5 },
  { type: "session",   date: "2026-12-09" },
],
```

- **Types:** `suggested` (with `by`, a `PEOPLE` id), `voting`, `won`, `lost` (with `vote`, the vote number), and `session`. Sorted by date; on the same day, suggested, then voting, then won/lost, then session.
- **Every book has at least one `suggested` event**, one per person who suggested it. If the date is unknown, use the date of the book's first other event.
- **To add an idea**, add a `BOOKS` entry whose log holds only its `suggested` event(s). It shows as 💡 Ideia.
- **The log and the other constants must agree, both ways.** `ACTIVE_VOTE`, `ARCHIVE`, and `AGENDA` keep their own copies as render data, and a test fails on any mismatch. So:
  - **Opening a vote:** add `voting` (dated `startedAt`) to each candidate.
  - **Closing a vote:** add `won` to the winner and `lost` to the others (dated `closedAt`).
  - **Adding a session:** add `session` (dated the session's date) to its book.
- **Status precedence:** a past session means Lido; an upcoming session or a won vote, A ler; a vote with no won/lost yet, A votos; a lost vote, Perdeu; otherwise Ideia. A book can lose a vote and still be read (vote #2's tie).

## Session quotes (`AGENDA[].quotes`)

A past session may list passages from its book that the group liked. They render in a "Citações" section, in array order.

```js
quotes: [
  { text: "Uma frase do livro…", by: "Filipa Costa" },
  { text: "Outra, sem autor." },
],
```

- **`text` is verbatim.** Keep line breaks as `\n`. Don't add quotation marks: the page shows none, because the Citações title already marks them as quotes.
- **`by` is optional.** When set, it must match a name in that session's `participants` exactly. The page doesn't show it for now; commit 13c629c has the last version that showed it.

## Tests

Render sanity tests live in `tests/render.test.js` and run in headless Chrome via `tests/run.sh`. There's no Node and no framework: the runner injects the test file into a copy of `index.html` and reads the PASS/FAIL block back from the dumped DOM. A run takes about 3 s.

- **Run `tests/run.sh` after every change to `index.html`**, code or data, before reporting the change as done.
- The pre-commit hook in `.githooks/` runs the same script when a commit touches `index.html` or `tests/`. It needs `git config core.hooksPath .githooks` once per clone.
- **When changing an area of the page, check its test coverage.** Say which tests are missing there and add the cheap ones: what renders, what expands or collapses, and data-shape checks on `BOOKS` / `AGENDA` / `ARCHIVE`. Keep them small. This is sanity checking, not full coverage.
- Prefer fixtures passed straight to the render functions over assertions on live data, so the tests don't break when a session is added.
- Never write the literal results tag (`pre` with `id="test-results"`) in the test source, because the runner matches the first occurrence in the DOM.

## Closing a vote

Triggered by "fecha a votação" (or "close the vote"), optionally with "o vencedor é X" or a note.

1. **Fetch the live tally.** Decode `_E` in `index.html` (base64) to get the Apps Script URL, `curl` it, and parse `{ votes, voters }`. On any failure, stop and edit nothing. The auto-mode classifier may block this request; if it does, ask the user to allow it or to paste the JSON.
2. **Pick the winner.** If the user named one, check that it is in `ACTIVE_VOTE.bookIds`. Otherwise take the top count; on a tie at the top, stop and ask.
3. **Snapshot the vote.** Prepend to `ARCHIVE`, in this field order: `number`, `startedAt`, `closedAt` (today), `winnerId`, `winnerNote` (only if given), `maxVotes`, `bookIds` (copied from `ACTIVE_VOTE`), `votes` (only keys in `bookIds`), and `voters` (drop the sheet's `time`; give each voter a `person` id, ask the user when a typed name is ambiguous, and add new people to `PEOPLE`). Don't touch the `BOOKS` entries.
4. **Update the logs.** Add `won` to the winner and `lost` to every other candidate, dated `closedAt`. If the session is fixed (often `ACTIVE_VOTE.readingDate`), add the `AGENDA` entry and a `session` event to the winner.
5. **Close it.** Set `ACTIVE_VOTE = null`, run `tests/run.sh`, and report: "Closed vote #N. Winner: <emoji> <title>." Remind the user to clear the Google Sheet by hand.

While `ACTIVE_VOTE` is null, the Votação tab is half broken (`plan.md` step 6): the name form still shows, and submitting crashes. Open the next vote soon, or build step 6 first.

## Opening a vote

Triggered by "abre a votação com X, Y, Z" (or similar).

1. **Check the state.** `ACTIVE_VOTE` must be null; close the open vote first. The Google Sheet must already be empty.
2. **Add new books.** Any candidate missing from `BOOKS` gets a full entry at the bottom (sinopse and punchline per [Book content rules](#book-content-rules-books-entries-in-indexhtml)), with its `suggested` event.
3. **Set `ACTIVE_VOTE`.** `number` is `ARCHIVE[0].number + 1`, `startedAt` is today, `minVotes` and `maxVotes` are 2 unless the user says otherwise, `bookIds` is the candidates in a random order shuffled once (every voter sees the same list), and `readingDate` is the planned session date if known.
4. **Update the logs.** Add `voting` (dated `startedAt`) to each candidate, then run `tests/run.sh`.

To drop a candidate from an open vote, remove its id from `bookIds` and its `voting` event from its log, but keep its `BOOKS` entry. First check that nobody has voted for it, because the page ignores votes for books off the ballot.

## Deploy

Hosting: GitHub Pages, environment `github-pages`, source `main` branch. The GitHub-managed `pages-build-deployment` workflow runs automatically on push. Public URL: https://fabiim.github.io/clube-leitura/. No local build step.

To deploy: `git push origin main`.

**Jekyll is disabled** via an empty `.nojekyll` at repo root. By default, GitHub Pages runs Jekyll on the source branch as a legacy default (Pages started as a Jekyll-only service); Jekyll's Liquid parser doesn't respect fenced code blocks and chokes on `{{ ... }}` patterns — e.g. the JSDoc typedefs in `plan.md` — failing the build. `.nojekyll` skips Jekyll entirely so Pages serves raw files, which is all this single-`index.html` site needs.

The Node.js 20 deprecation warning on the build log is harmless: GitHub owns the `pages-build-deployment` workflow and will update its `actions/checkout` ahead of the June 2026 cutoff.
