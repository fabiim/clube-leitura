# CLAUDE.md

Project-specific guidance for Claude. These conventions are not obvious from the source — read this before editing `BOOKS` entries.

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

## Other guidance

- Close-vote / open-vote workflows are still pending — see plan.md step 8.
