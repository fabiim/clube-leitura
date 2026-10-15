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

- **Single static page.** All data (`BOOKS`, `AGENDA`, `ARCHIVE`, `ACTIVE_VOTE`) lives as constants in `index.html`. The only network call is the live vote tally (Google Apps Script).
- **Three tabs**, hash-routed: Início, Votação, Arquivo.
- **Início** lists sessions: upcoming soonest-first (the next one pinned), past most-recent-first. A pill links to Votação while a vote is open.
- **Each session** shows a date, a book, a location, and a book card (sinopse, Claude pitch, and shop links). Nothing is collapsed.
- **Past sessions** split into titled sections: "Discussão" (the written account and the participants), "Citações" (passages from the book the group liked, always visible, each optionally tagged with who picked it), and "Sinopse" (the book card, without shop links). A participant can bring a gift (a poem, lyric, quote, or excerpt), which opens in a drawer.
- **Votação** is active only when `ACTIVE_VOTE` is set: name, pick N books, see live results. Otherwise it points to the Arquivo.
- **Arquivo** lists closed votes with the winner and expandable per-book tallies and voters.

## Book content rules (`BOOKS` entries in `index.html`)

Every book has two prose fields. Each has a strict author and length contract.

### `sinopse` — publisher copy preferred, Claude-authored allowed as fallback

Two valid sources, in preference order:

1. **Verbatim publisher copy** from a reputable Portuguese-language page (Almedina, Wook, Bertrand, Quetzal, Porto Editora, Livros do Brasil, Continente, Note, FNAC). Copy as-is, one source per book, no blending. Strip only obvious noise (a leading "Sinopse:" label, trailing "Críticas de imprensa" blocks, marketing fluff like "portes grátis") and leave the prose untouched. If the publisher copy is long, prefer copying it whole over rewriting to fit.

2. **Claude-authored** when no good publisher copy exists — page missing, bibliography-only, critic-only, paywalled, or markedly weaker than what Claude can write from research. Must be grounded in at least two independent online sources: blog reviews, social media, Goodreads, critical pieces. Register: **neutral and descriptive**, in the voice a publisher would use — not the editorial-pitch register of the `claude` field.

If a publisher source becomes available for a Claude-authored book and is markedly better, swap it in.

### Source-fetch reality (as of 2026-05-15)

Wook, Bertrand, FNAC, and most large publisher pages (Quetzal, Porto Editora, Livros do Brasil) return HTTP 403 to automated fetch — both Claude's WebFetch tool and `curl` with a browser user-agent. Almedina works for many titles. OLX listings sometimes quote the publisher back-cover.

When the rule wants a specific publisher's copy and automation can't reach it, ask the user to open the page in a browser and paste the text. Don't accept search-snippet paraphrases as substitutes for verbatim copy.

### `claude` — the pitch

A short editorial recommendation. One good reason to read this book. It must earn its place by being **sharp, incisive, active, engaging**:

- **Sharp** — declarative, no hedging ("talvez", "considerado por alguns", "tem-se considerado").
- **Incisive** — cut every word that isn't pulling weight. Two-word punchlines work.
- **Active** — verbs over nouns, concrete over abstract.
- **Engaging** — open with the hook (a critical quote, a paradox, an image), never with setup.

Length: 1–2 sentences, typically **12–30 words**. Strictly shorter than the sinopse. Shorter is better when it lands.

Research before writing: blogs, Goodreads, social media, critical pieces. The sinopse already describes the book; this section pitches the *why*. Use real critic quotes with attribution ("Bryan Appleyard", "New York Times") when you have them. Awards and critical reception are fair game ("Pulitzer 2007", "Nobel 2022") — they sharpen the pitch.

Patterns that already work in this registry:

- **Quote + punchline** — `stoner`: *«O melhor romance que ninguém leu» — Bryan Appleyard. Vida apagada, prosa devastadora.*
- **Adjective cluster + recommendation** — `saramago`: *Curto, divertido, filosófico, português. A escolha mais segura para começar.*
- **Award + characterisation** — `kang`: *Acessível mas provocador. Vencedor do Nobel. Vai dividir a sala — e isso é bom.*

Don't restate the plot. Don't write from publisher copy alone.

The two fields render side-by-side on the ballot card, the "Estamos a ler" expansion, and the archive details. The split is intentional: `sinopse` is the publisher's neutral description; `claude` is the editorial recommendation marked with the Claude logo (`assets/claude.png`).

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

## Session quotes (`AGENDA[].quotes`)

A past session may list passages from its book that the group liked. They render in a "Citações" section, in array order.

```js
quotes: [
  { text: "Uma frase do livro…", by: "Filipa Costa" },
  { text: "Outra, sem autor." },
],
```

- **`text` is verbatim.** Keep line breaks as `\n`. Don't add quotation marks, because the renderer adds them.
- **`by` is optional.** When set, it must match a name in that session's `participants` exactly. The page shows the shortest name that still identifies the person in that session.

## Tests

Render sanity tests live in `tests/render.test.js` and run in headless Chrome via `tests/run.sh`. There's no Node and no framework: the runner injects the test file into a copy of `index.html` and reads the PASS/FAIL block back from the dumped DOM. A run takes about 3 s.

- **Run `tests/run.sh` after every change to `index.html`**, code or data, before reporting the change as done.
- The pre-commit hook in `.githooks/` runs the same script when a commit touches `index.html` or `tests/`. It needs `git config core.hooksPath .githooks` once per clone.
- **When changing an area of the page, check its test coverage.** Say which tests are missing there and add the cheap ones: what renders, what expands or collapses, and data-shape checks on `BOOKS` / `AGENDA` / `ARCHIVE`. Keep them small. This is sanity checking, not full coverage.
- Prefer fixtures passed straight to the render functions over assertions on live data, so the tests don't break when a session is added.
- Never write the literal results tag (`pre` with `id="test-results"`) in the test source, because the runner matches the first occurrence in the DOM.

## Other guidance

- Close-vote / open-vote workflows are still pending — see plan.md step 8.

## Deploy

Hosting: GitHub Pages, environment `github-pages`, source `main` branch. The GitHub-managed `pages-build-deployment` workflow runs automatically on push. Public URL: https://fabiim.github.io/clube-leitura/. No local build step.

To deploy: `git push origin main`.

**Jekyll is disabled** via an empty `.nojekyll` at repo root. By default, GitHub Pages runs Jekyll on the source branch as a legacy default (Pages started as a Jekyll-only service); Jekyll's Liquid parser doesn't respect fenced code blocks and chokes on `{{ ... }}` patterns — e.g. the JSDoc typedefs in `plan.md` — failing the build. `.nojekyll` skips Jekyll entirely so Pages serves raw files, which is all this single-`index.html` site needs.

The Node.js 20 deprecation warning on the build log is harmless: GitHub owns the `pages-build-deployment` workflow and will update its `actions/checkout` ahead of the June 2026 cutoff.
