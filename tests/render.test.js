// Render sanity tests, injected into a copy of index.html by tests/run.sh and
// run in headless Chrome. The page's top-level functions and `const` data
// (AGENDA, renderParticipants, …) are visible here because classic scripts
// share one global scope. Results go into the pre#test-results element, whose first
// line is "PASS" or "FAIL", for run.sh to read back from the dumped DOM.

(() => {
  const results = [];
  let failed = 0;

  // Minimal harness: one entry per test, the first failing assertion wins.
  function test(name, fn) {
    try {
      fn();
      results.push(`ok   ${name}`);
    } catch (e) {
      failed++;
      results.push(`FAIL ${name}\n     ${e.message}`);
    }
  }
  function assert(cond, msg) {
    if (!cond) throw new Error(msg);
  }
  function eq(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  // Fixture-based participants block, detached from the page.
  function fixture() {
    return renderParticipants([
      "Só Nome",
      { name: "Ana", piece: { title: "Título", author: "Autora", text: "linha 1\n  linha 2\n\nestrofe 2" } },
      { name: "Rui", piece: { text: "<b>não é html</b>" } },
    ]);
  }

  // ---- Content ----

  test("colours outside :root come from the palette, not raw hex", () => {
    // CLAUDE.md "Colour palette": the :root block is the only place a hex
    // value may appear, so the palette stays the single source of colour.
    const css = [...document.querySelectorAll("style")].map((el) => el.textContent).join("\n");
    const outside = css.replace(/:root\s*\{[^}]*\}/g, "");
    const stray = outside.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g);
    eq(stray, null, "raw colours outside :root");
  });

  test("page loads without script errors", () => {
    eq(window.__testErrors.length, 0, `errors: ${window.__testErrors.join(" | ")}`);
  });

  test("every AGENDA participant is a name or { name, piece } with text", () => {
    AGENDA.forEach((entry) => {
      (entry.participants || []).forEach((p) => {
        const where = `${entry.date} ${JSON.stringify(p).slice(0, 40)}`;
        if (typeof p === "string") {
          assert(p.trim() !== "", `empty name at ${where}`);
          return;
        }
        assert(typeof p.name === "string" && p.name.trim() !== "", `missing name at ${where}`);
        assert(p.piece && typeof p.piece.text === "string" && p.piece.text.trim() !== "",
          `object participant without piece text at ${where}`);
        ["title", "author"].forEach((k) => {
          assert(p.piece[k] === undefined || typeof p.piece[k] === "string", `${k} not a string at ${where}`);
        });
      });
    });
  });

  test("participants without a piece render as plain chips", () => {
    const el = fixture();
    const plain = [...el.querySelectorAll(".chip-small:not(.chip-piece)")];
    eq(plain.length, 1, "plain chip count");
    eq(plain[0].tagName, "SPAN", "plain chip tag");
    eq(plain[0].textContent, "Só Nome", "plain chip text");
  });

  test("a meeting where nobody brought a piece has no buttons or drawers", () => {
    const el = renderParticipants(["Ana", "Rui"]);
    eq(el.querySelectorAll(".chip-small").length, 2, "chip count");
    eq(el.querySelectorAll("button, .chip-piece").length, 0, "no interactive chips");
    eq(el.querySelectorAll(".agenda-piece").length, 0, "no drawers");
    eq(el.textContent, "AnaRui", "only the names, no + or emoji");
  });

  test("participants with a piece render a closed button chip and drawer", () => {
    const el = fixture();
    const chips = el.querySelectorAll(".chip-piece");
    eq(chips.length, 2, "piece chip count");
    eq(chips[0].tagName, "BUTTON", "piece chip tag");
    eq(chips[0].textContent, "Ana + 🎁", "piece chip text");
    eq(chips[0].getAttribute("aria-expanded"), "false", "starts closed");
    eq(el.querySelectorAll(".agenda-piece").length, 2, "drawer count");
    eq(el.querySelectorAll(".agenda-piece.open").length, 0, "no drawer open");
  });

  test("drawer shows who, title, verbatim text, and author", () => {
    const d = fixture().querySelectorAll(".agenda-piece")[0];
    eq(d.querySelector(".agenda-piece-who").textContent, "🪶 Ana trouxe", "who");
    eq(d.querySelector(".agenda-piece-title").textContent, "Título", "title");
    eq(d.querySelector(".agenda-piece-text").textContent, "linha 1\n  linha 2\n\nestrofe 2", "text keeps breaks and spaces");
    eq(d.querySelector(".agenda-piece-author").textContent, "— Autora", "author");
  });

  test("drawer omits title and author when absent, and never parses HTML", () => {
    const d = fixture().querySelectorAll(".agenda-piece")[1];
    eq(d.querySelector(".agenda-piece-title"), null, "no title element");
    eq(d.querySelector(".agenda-piece-author"), null, "no author element");
    eq(d.querySelector("b"), null, "no parsed <b>");
    eq(d.querySelector(".agenda-piece-text").textContent, "<b>não é html</b>", "literal text");
  });

  test("participant names are unique within each session", () => {
    // shortestName falls back to the full name, which only identifies a
    // person if no one else in the session has the same name.
    AGENDA.forEach((entry) => {
      const keys = (entry.participants || []).map((p) => nameKey(typeof p === "string" ? p : p.name).trim());
      const dup = keys.find((k, i) => keys.indexOf(k) !== i);
      assert(dup === undefined, `duplicate participant "${dup}" on ${entry.date}`);
    });
  });

  test("PEOPLE names are non-empty and unique once case and accents are folded", () => {
    // A name must identify one person, or a reference by name is ambiguous.
    const keys = Object.values(PEOPLE).map((p) => {
      assert(typeof p.name === "string" && p.name.trim() !== "", `empty name in ${JSON.stringify(p)}`);
      return nameKey(p.name.trim());
    });
    const dup = keys.find((k, i) => keys.indexOf(k) !== i);
    assert(dup === undefined, `two people share the name "${dup}"`);
  });

  test("every AGENDA participant and quote picker is in PEOPLE", () => {
    // PEOPLE is the global reference for who came to a session.
    const names = new Set(Object.values(PEOPLE).map((p) => p.name));
    AGENDA.forEach((entry) => {
      (entry.participants || []).forEach((p) => {
        const name = typeof p === "string" ? p : p.name;
        assert(names.has(name), `participant "${name}" on ${entry.date} is not in PEOPLE`);
      });
      (entry.quotes || []).forEach((q, i) => {
        assert(q.by === undefined || names.has(q.by), `quote ${i} on ${entry.date}: "${q.by}" is not in PEOPLE`);
      });
    });
  });

  test("every ARCHIVE voter's person is in PEOPLE, at most once per vote", () => {
    // `person` links a typed ballot name to PEOPLE; one person, one ballot.
    ARCHIVE.forEach((entry) => {
      const ids = Object.values(entry.voters).map((v) => v.person).filter((p) => p !== undefined);
      ids.forEach((id) => assert(id in PEOPLE, `vote #${entry.number}: "${id}" is not in PEOPLE`));
      const dup = ids.find((id, i) => ids.indexOf(id) !== i);
      assert(dup === undefined, `vote #${entry.number}: "${dup}" voted twice`);
    });
  });

  test("every book log is well formed, sorted, and has a suggester in PEOPLE", () => {
    // The log's shape rules from the BOOKS doc comment.
    const fields = { suggested: ["by"], voting: ["vote"], won: ["vote"], lost: ["vote"], session: [] };
    Object.entries(BOOKS).forEach(([id, book]) => {
      assert(Array.isArray(book.log), `${id}: log is not an array`);
      book.log.forEach((e, i) => {
        const where = `${id} log[${i}]`;
        assert(e.type in fields, `${where}: unknown type "${e.type}"`);
        assert(/^\d{4}-\d{2}-\d{2}$/.test(e.date), `${where}: date "${e.date}" is not ISO`);
        // Exactly the fields its type allows, so a typo can't hide.
        eq(Object.keys(e).sort().join(), ["date", "type", ...fields[e.type]].sort().join(), `${where} fields`);
        if (e.type === "suggested") assert(e.by in PEOPLE, `${where}: "${e.by}" is not in PEOPLE`);
        if (i > 0) assert(book.log[i - 1].date <= e.date, `${where}: out of date order`);
      });
      assert(book.log.some((e) => e.type === "suggested"), `${id}: nobody suggested it`);
    });
  });

  test("book logs agree with ACTIVE_VOTE, ARCHIVE, and AGENDA, both ways", () => {
    // The log is canonical and the other constants are render copies, so
    // every fact must appear on both sides: nothing missing, nothing extra.
    const expected = Object.fromEntries(Object.keys(BOOKS).map((id) => [id, []]));
    const add = (id, key) => {
      assert(id in expected, `unknown book "${id}" in ${key}`);
      expected[id].push(key);
    };
    if (ACTIVE_VOTE) {
      ACTIVE_VOTE.bookIds.forEach((id) => add(id, `voting ${ACTIVE_VOTE.startedAt} #${ACTIVE_VOTE.number}`));
    }
    ARCHIVE.forEach((v) => v.bookIds.forEach((id) => {
      add(id, `voting ${v.startedAt} #${v.number}`);
      add(id, `${v.winnerIds.includes(id) ? "won" : "lost"} ${v.closedAt} #${v.number}`);
    }));
    AGENDA.forEach((s) => add(s.bookId, `session ${s.date}`));

    Object.entries(BOOKS).forEach(([id, book]) => {
      const actual = book.log
        .filter((e) => e.type !== "suggested")
        .map((e) => `${e.type} ${e.date}` + (e.vote === undefined ? "" : ` #${e.vote}`));
      eq(actual.sort().join(" | "), expected[id].sort().join(" | "), `${id} log`);
    });
  });

  test("bookStatus follows sessions, then won, open, and lost votes, then idea", () => {
    // Fixture logs for each precedence rule, judged on a fixed "today".
    const today = "2026-06-01";
    const s = { type: "suggested", date: "2026-01-01", by: "fabio" };
    const cases = [
      ["only suggested", [s], "ideia"],
      ["on an open vote", [s, { type: "voting", date: "2026-05-01", vote: 7 }], "a-votos"],
      ["lost one vote, on another open one", [s,
        { type: "voting", date: "2026-02-01", vote: 6 }, { type: "lost", date: "2026-02-03", vote: 6 },
        { type: "voting", date: "2026-05-01", vote: 7 }], "a-votos"],
      ["lost its only vote", [s,
        { type: "voting", date: "2026-02-01", vote: 6 }, { type: "lost", date: "2026-02-03", vote: 6 }], "perdeu"],
      ["won, no session yet", [s,
        { type: "voting", date: "2026-02-01", vote: 6 }, { type: "won", date: "2026-02-03", vote: 6 }], "a-ler"],
      ["session today", [s, { type: "session", date: today }], "a-ler"],
      ["lost, then read anyway", [s,
        { type: "voting", date: "2026-02-01", vote: 6 }, { type: "lost", date: "2026-02-03", vote: 6 },
        { type: "session", date: "2026-03-01" }], "lido"],
      ["one session past, one ahead", [s,
        { type: "session", date: "2026-05-01" }, { type: "session", date: "2026-07-01" }], "lido"],
    ];
    cases.forEach(([name, log, want]) => eq(bookStatus(log, today), want, name));
  });

  test("BOOK_STATUSES covers every status bookStatus returns", () => {
    // The Estante labels and filters come from this list.
    const ids = BOOK_STATUSES.map((st) => st.id);
    eq(ids.join(), "lido,a-ler,a-votos,perdeu,ideia", "status order");
    Object.values(BOOKS).forEach((b) => assert(ids.includes(bookStatus(b.log, todayISO())), "unknown status"));
  });

  test("a book card shows the book, its corner slot, and shop links", () => {
    // The shared card used by the ballot and the Estante.
    const id = Object.keys(BOOKS)[0];
    const book = getBook(id);
    const card = renderBookCard(book, '<span class="corner-x">x</span>');
    eq(card.dataset.id, id, "data-id");
    eq(card.querySelector(".book-title").textContent, book.title, "title");
    assert(card.querySelector(".sinopse") && card.querySelector(".punchline"), "sinopse and punchline");
    assert(card.querySelector(".card-top .corner-x"), "corner slot in the top row");
    eq(card.querySelectorAll(".shop-link").length, 2, "shop links");
    eq(renderBookCard(book).querySelector(".check"), null, "no check mark by default");
  });

  test("ballot cards never show who suggested a book or its history", () => {
    // Suggesters stay off the ballot so they can't sway the vote.
    if (!ACTIVE_VOTE) return;
    const cards = [...document.querySelectorAll("#book-grid .card")];
    eq(cards.length, ACTIVE_VOTE.bookIds.length, "one card per candidate");
    const names = Object.values(PEOPLE).map((p) => p.name);
    cards.forEach((c) => {
      const named = names.find((n) => c.textContent.includes(n));
      assert(named === undefined, `${c.dataset.id} card names ${named}`);
      eq(c.querySelector(".shelf-log, .shelf-status"), null, `${c.dataset.id} has no log or status`);
    });
  });

  test("parseHash splits tab, sub-path, and query, falling back to Início", () => {
    // The router's hash grammar: #tab[/sub][?query].
    const show = (h) => {
      const r = parseHash(h);
      return `${r.tab}|${r.sub}|${r.query.toString()}`;
    };
    eq(show(""), "inicio||", "empty");
    eq(show("#arquivo"), "arquivo||", "tab only");
    eq(show("#arquivo/4"), "arquivo|4|", "sub-path");
    eq(show("#votacao?x=1&y=2"), "votacao||x=1&y=2", "query");
    eq(show("#nada/4?x=1"), "inicio||", "unknown tab drops the rest");
  });

  test("openArchiveEntry expands that vote's row and ignores unknown numbers", () => {
    // Deep links like #arquivo/4 land on the vote, opened.
    const n = ARCHIVE[ARCHIVE.length - 1].number;
    openArchiveEntry(n);
    const row = $("archive-list").querySelector(`[data-number="${n}"]`);
    assert(row.classList.contains("expanded"), "row expanded");
    assert(row.querySelector(".archive-details").children.length > 0, "details painted");
    openArchiveEntry(9999);
    expandedEntries.delete(n);
    renderArquivo();
  });

  // Fixture results: one linked and one unlinked voter, and a book nobody
  // picked. Book ids come from BOOKS so the cards have real metadata.
  function resultsFixture(options) {
    const [a, b, c] = Object.keys(BOOKS);
    const el = document.createElement("div");
    renderResultsInto(el, [a, b, c].map(getBook), { [a]: 2, [b]: 1 }, {
      "fbotelho": { name: "fbotelho", person: "fabio", books: [a, b] },
      "zé":       { name: "Zé", books: [a] },
    }, options);
    const line = (id) => {
      const card = [...el.querySelectorAll(".result-card")].find((x) => x.textContent.includes(getBook(id).title));
      const v = card.querySelector(".result-voters");
      return v && v.textContent;
    };
    return { el, line, a, b, c };
  }

  test("archive results name each book's voters, full names for linked voters", () => {
    // The Arquivo shows who voted for what; a linked voter shows as PEOPLE says.
    const { el, line, a, b, c } = resultsFixture({ perBookVoters: true });
    eq(line(a), `Votaram: ${PEOPLE.fabio.name}, Zé`, "linked and unlinked voters");
    eq(line(b), `Votaram: ${PEOPLE.fabio.name}`, "one voter");
    eq(line(c), null, "no line for a book nobody picked");
    eq(el.querySelector(".voter-list"), null, "no voter chips");
  });

  test("live results keep the voter chips and no per-book voters", () => {
    // The open ballot only says who has voted, not for what.
    const { el } = resultsFixture();
    eq(el.querySelectorAll(".result-voters").length, 0, "no per-book line");
    eq([...el.querySelectorAll(".voter-list .chip")].map((x) => x.textContent).join(), "fbotelho,Zé", "chips as typed");
  });

  test("voter chips and the greeting show a typed name as text, never HTML", () => {
    // Names come from the ballot form, so markup in one must not render.
    const el = document.createElement("div");
    renderResultsInto(el, [], {}, { x: { name: "<b>x</b>", books: [] } });
    eq(el.querySelector(".voter-chips b"), null, "no parsed <b> in chips");
    eq(el.querySelector(".voter-chips .chip").textContent, "<b>x</b>", "literal chip text");
    const g = document.createElement("p");
    g.append(renderGreeting("<b>x</b>", 2, 2));
    eq(g.querySelectorAll("strong").length, 2, "only our own <strong>s");
    eq(g.querySelector("b"), null, "no parsed <b> in greeting");
    eq(g.textContent, "Olá <b>x</b>! Selecciona 2 livros.", "same picks");
    const r = document.createElement("p");
    r.append(renderGreeting("Ana", 1, 3));
    eq(r.textContent, "Olá Ana! Selecciona entre 1 e 3 livros.", "a range of picks");
  });

  test("the Estante is empty until its first visit, then lists every book once", () => {
    // Built lazily, so a page load that never opens it pays nothing.
    eq($("shelf-list").children.length, 0, "no cards before the first visit");
    ensureEstante();
    const ids = [...$("shelf-list").querySelectorAll(".shelf-card")].map((c) => c.dataset.id);
    eq(ids.slice().sort().join(), Object.keys(BOOKS).sort().join(), "one card per book");
    ensureEstante();
    eq($("shelf-list").children.length, ids.length, "a second visit doesn't rebuild");
  });

  test("a shelf card shows its status badge and its log in order", () => {
    // Fixture book, judged on a fixed day: lost #1, read later.
    const book = { ...getBook(Object.keys(BOOKS)[0]), log: [
      { type: "suggested", date: "2020-01-01", by: "fabio" },
      { type: "voting", date: "2020-01-02", vote: 1 },
      { type: "lost", date: "2020-01-03", vote: 1 },
      { type: "session", date: "2020-02-01" },
      { type: "session", date: "2020-03-01" },
    ]};
    const card = renderShelfCard(book, "2020-02-15");
    eq(card.querySelector(".card-top .shelf-status").textContent, "📗 Lido", "badge");
    eq(card.dataset.status, "lido", "data-status");
    eq(card.dataset.by, "fabio", "data-by");
    const lines = [...card.querySelectorAll(".shelf-log li")].map((li) => li.textContent);
    eq(lines.join(" | "), [
      "💡 Sugerido por Fábio · 1 Jan 2020",
      `🗳️ Na votação #1 → · 2 Jan 2020`,
      `🥀 Perdeu a votação #1 → · 3 Jan 2020`,
      "📖 Sessão → · 1 Fev 2020",
      "📅 Sessão marcada → · 1 Mar 2020",
    ].join(" | "), "log lines");
  });

  test("ARCHIVE winnerIds are non-empty, unique, and on the ballot", () => {
    // Several winners mean a tie the group read in full.
    ARCHIVE.forEach((v) => {
      assert(Array.isArray(v.winnerIds) && v.winnerIds.length > 0, `vote #${v.number}: no winner`);
      eq(new Set(v.winnerIds).size, v.winnerIds.length, `vote #${v.number}: unique winners`);
      v.winnerIds.forEach((id) => assert(v.bookIds.includes(id), `vote #${v.number}: winner "${id}" not on the ballot`));
    });
  });

  test("an archive header lists every winner, tagging a tie", () => {
    // One line per winner in reading order; the tag only on a shared win.
    const [a, b, c] = Object.keys(BOOKS);
    const base = { number: 99, startedAt: "2020-01-01", closedAt: "2020-01-02", maxVotes: 2, bookIds: [a, b, c], votes: {}, voters: {} };
    const header = (winnerIds) => renderArchiveRow({ ...base, winnerIds }).querySelector(".archive-header");
    const titles = (h) => [...h.querySelectorAll(".archive-winner-line .archive-title-author")].map((x) => x.textContent);
    const tied = header([b, a]);
    eq(titles(tied).join(" | "), [b, a].map((id) => `${getBook(id).title} — ${getBook(id).author}`).join(" | "), "both, in order");
    eq(tied.querySelector(".archive-tie-tag").textContent, "Empate", "tie tag");
    const solo = header([c]);
    eq(titles(solo).length, 1, "one winner");
    eq(solo.querySelector(".archive-tie-tag"), null, "no tag");
  });

  test("a won log line says (empate) only when the vote was a tie", () => {
    // Reads ARCHIVE, so it picks a tied and a single-winner vote from it.
    const line = (vote) => renderLogEvent({ type: "won", date: "2020-01-01", vote: vote.number }, "2020-01-01").querySelector("a").textContent;
    const tie = ARCHIVE.find((v) => v.winnerIds.length > 1);
    const solo = ARCHIVE.find((v) => v.winnerIds.length === 1);
    if (tie) eq(line(tie), `Venceu a votação #${tie.number} (empate) →`, "tie");
    if (solo) eq(line(solo), `Venceu a votação #${solo.number} →`, "single winner");
  });

  test("vote links point at the open ballot or the vote's Arquivo entry", () => {
    // Closed votes deep-link into the Arquivo; the open vote goes to Votação.
    const href = (vote) => renderLogEvent({ type: "voting", date: "2020-01-01", vote }, "2020-01-01").querySelector("a").getAttribute("href");
    eq(href(1), "#arquivo/1", "closed vote");
    if (ACTIVE_VOTE) eq(href(ACTIVE_VOTE.number), "#votacao", "open vote");
  });

  test("session links point at that day's session in Início, past or upcoming", () => {
    const href = (date) => renderLogEvent({ type: "session", date }, "2020-02-15").querySelector("a").getAttribute("href");
    eq(href("2020-02-01"), "#inicio/2020-02-01", "past session");
    eq(href("2020-03-01"), "#inicio/2020-03-01", "upcoming session");
  });

  test("AGENDA dates are unique, so a date names one session", () => {
    // Session deep links (#inicio/<date>) rely on this.
    const dates = AGENDA.map((e) => e.date);
    eq(new Set(dates).size, dates.length, "unique dates");
  });

  test("openAgendaEntry finds every session by its date and ignores unknown dates", () => {
    // Every session line in the Estante must land on a rendered row.
    AGENDA.forEach((e) => assert(openAgendaEntry(e.date), `session ${e.date} found`));
    assert(!openAgendaEntry("1999-01-01"), "unknown date");
  });

  test("person chips carry no count; status chips do", () => {
    // Per-person totals were dropped on request: they read as a score.
    ensureEstante();
    const chips = (group) => [...$("shelf-filters").querySelectorAll(`.shelf-chip[data-group="${group}"]`)];
    eq(chips("por").map((c) => c.dataset.id).join(), suggesterIds().join(), "one chip per suggester");
    assert(chips("por").every((c) => !c.querySelector(".shelf-chip-count")), "no person counts");
    assert(chips("estado").every((c) => c.querySelector(".shelf-chip-count")), "status counts");
  });

  test("suggesterIds lists only people with a suggested event", () => {
    // People who only voted get no Estante chip.
    const ids = suggesterIds();
    assert(ids.length > 0, "someone suggested a book");
    ids.forEach((id) => assert(Object.values(BOOKS).some((b) => b.log.some((e) => e.type === "suggested" && e.by === id)), `${id} suggested something`));
    assert(!ids.includes("melissa"), "a voter-only person is left out");
    eq(readShelfFilters(new URLSearchParams("por=melissa,fabio")).por.has("melissa"), false, "URL drops a voter-only id");
  });

  test("a book suggested by two people lists both, and data-by holds each once", () => {
    // One suggested event per person; data-by feeds the person filter.
    const book = { ...getBook(Object.keys(BOOKS)[0]), log: [
      { type: "suggested", date: "2020-01-01", by: "fabio" },
      { type: "suggested", date: "2020-01-05", by: "filipa" },
    ]};
    const card = renderShelfCard(book, "2020-02-01");
    eq(card.dataset.by, "fabio filipa", "data-by");
    eq(card.dataset.status, "ideia", "status");
    eq(card.querySelectorAll(".shelf-log li").length, 2, "two lines");
  });

  test("sortShelf orders by status, then most recent event, then title", () => {
    const mk = (title, log) => ({ title, log });
    const sorted = sortShelf([
      mk("Ideia", [{ type: "suggested", date: "2020-09-01", by: "fabio" }]),
      mk("Lido velho", [{ type: "session", date: "2020-01-01" }]),
      mk("Lido novo", [{ type: "session", date: "2020-03-01" }]),
    ], "2020-12-01").map((b) => b.title);
    eq(sorted.join(" | "), "Lido novo | Lido velho | Ideia", "order");
  });

  test("shelf filters round-trip through the URL and drop unknown ids", () => {
    // The query grammar: por=<person ids>&estado=<status ids>, comma-separated.
    const f = readShelfFilters(new URLSearchParams("por=fabio,ninguem,filipa&estado=ideia,nada"));
    eq([...f.por].join(), "fabio,filipa", "known people only");
    eq([...f.estado].join(), "ideia", "known statuses only");
    eq(shelfHash(f), "#estante?por=fabio,filipa&estado=ideia", "hash");
    eq(shelfHash(readShelfFilters(new URLSearchParams(""))), "#estante", "no filters");
    const back = readShelfFilters(parseHash(shelfHash(f)).query);
    eq(shelfHash(back), shelfHash(f), "round trip");
  });

  test("shelf filters OR within a group and AND across groups", () => {
    // Fixture cards stand in for shelf cards: only their data attributes matter.
    const card = (by, status) => {
      const d = document.createElement("div");
      d.dataset.by = by;
      d.dataset.status = status;
      return d;
    };
    const f = (por, estado) => ({ por: new Set(por), estado: new Set(estado) });
    const both = card("fabio filipa", "ideia");
    assert(shelfCardMatches(both, f([], [])), "no filters let everything through");
    assert(shelfCardMatches(both, f(["filipa"], [])), "second suggester matches");
    assert(shelfCardMatches(both, f(["mariana", "fabio"], [])), "any listed person matches");
    assert(!shelfCardMatches(both, f(["mariana"], [])), "other person doesn't");
    assert(shelfCardMatches(both, f(["fabio"], ["ideia", "lido"])), "person and status");
    assert(!shelfCardMatches(both, f(["fabio"], ["lido"])), "status narrows");
  });

  test("tapping chips filters the shelf, marks chips, updates the URL, and empties cleanly", () => {
    // Drives the live Estante through its chips, then restores the page.
    ensureEstante();
    const chip = (group, id) => $("shelf-filters").querySelector(`.shelf-chip[data-group="${group}"][data-id="${id}"]`);
    const visible = () => [...$("shelf-list").querySelectorAll(".shelf-card:not(.hidden)")];
    const start = window.location.href;

    chip("por", "fabio").click();
    assert(window.location.hash === "#estante?por=fabio", `hash is ${window.location.hash}`);
    assert(chip("por", "fabio").classList.contains("active"), "chip marked");
    eq(chip("por", "fabio").getAttribute("aria-pressed"), "true", "aria-pressed");
    assert(visible().length > 0 && visible().every((c) => c.dataset.by.split(" ").includes("fabio")), "only Fábio's books");
    eq(lastShelfHash, "#estante?por=fabio", "remembered for the tab");

    // A status nobody's book has, combined with a person, empties the list.
    const empty = BOOK_STATUSES.find((st) => !visible().some((c) => c.dataset.status === st.id));
    if (empty) {
      chip("estado", empty.id).click();
      eq(visible().length, 0, "no cards");
      assert(!$("shelf-empty").classList.contains("hidden"), "empty message shown");
      chip("estado", empty.id).click();
    }
    chip("por", "fabio").click();
    eq(window.location.hash, "#estante", "cleared");
    eq(visible().length, Object.keys(BOOKS).length, "all books back");
    assert($("shelf-empty").classList.contains("hidden"), "empty message hidden");
    history.replaceState(null, "", start);
  });

  test("every book has a sinopse and a punchline, and ballot sinopses fit 150 words", () => {
    // CLAUDE.md "Book content rules": both prose fields are required, and
    // sinopses written under the current rule have a hard 150-word ceiling.
    // Only books on the open ballot are checked, because older books still
    // carry longer publisher copy.
    Object.entries(BOOKS).forEach(([id, book]) => {
      assert(book.sinopse && book.punchline, `${id}: missing sinopse or punchline`);
    });
    (ACTIVE_VOTE?.bookIds ?? []).forEach((id) => {
      const words = BOOKS[id].sinopse.trim().split(/\s+/).length;
      assert(words <= 150, `${id}: sinopse has ${words} words, over the 150 ceiling`);
    });
  });

  test("AGENDA quotes are on past sessions, have text, and name a participant", () => {
    AGENDA.forEach((entry) => {
      if (!entry.quotes) return;
      assert(Array.isArray(entry.quotes), `quotes not an array on ${entry.date}`);
      assert(entry.date < todayISO(), `quotes on a future session ${entry.date}`);
      const names = (entry.participants || []).map((p) => typeof p === "string" ? p : p.name);
      entry.quotes.forEach((q, i) => {
        assert(typeof q.text === "string" && q.text.trim() !== "", `empty quote ${i} on ${entry.date}`);
        assert(q.by === undefined || names.includes(q.by), `quote ${i} on ${entry.date}: "${q.by}" is not a participant`);
      });
    });
  });

  test("quotes render in order, verbatim, without the picker's name", () => {
    // The `by` field is data only; HTML in the text stays literal.
    const el = renderQuotes([
      { text: "linha 1\n  linha 2", by: "Filipa Costa" },
      { text: "<b>não é html</b>" },
    ]);
    const quotes = [...el.querySelectorAll("blockquote.agenda-quote")];
    eq(quotes.length, 2, "two quotes");
    eq(quotes[0].textContent, "linha 1\n  linha 2", "first quote, no name");
    eq(quotes[1].querySelector("b"), null, "no parsed <b>");
    eq(quotes[1].textContent, "<b>não é html</b>", "literal text");
  });

  // ---- Names ----

  test("shortestName picks first, then last, then first + last, then full", () => {
    // Each case: [name, other names in the session, expected label].
    const cases = [
      ["Filipa Costa", ["Mariana Teixeira"], "Filipa"],
      ["Filipa Costa", ["Filipa Ramos"], "Costa"],
      ["Filipa Costa", ["Filipa Ramos", "Ana Costa"], "Filipa Costa"],
      ["Filipa Costa", ["Filipa de Medeiros Costa"], "Filipa Costa"],
      ["Filipa Maria Costa", ["Filipa Costa"], "Filipa Maria Costa"],
      ["Fábio Botelho", ["fabio Mota"], "Botelho"],
      ["Ana", ["Ana Costa"], "Ana"],
      ["Ana Costa", ["Ana"], "Costa"],
      ["Rui", [], "Rui"],
    ];
    cases.forEach(([name, others, expected]) => {
      eq(shortestName(name, [name, ...others]), expected, `${name} among ${others.join(", ") || "nobody"}`);
    });
  });

  // ---- Ordering ----

  // Renders the agenda from fixture sessions on a fixed "today", then restores
  // the real AGENDA and clock. Unknown book ids render as "[id]", which labels
  // each row. Returns the labels of the future and past lists, top to bottom.
  function renderAgendaFixture(today, entries) {
    const real = AGENDA.splice(0, AGENDA.length, ...entries);
    const realToday = todayISO;
    todayISO = () => today;
    try {
      renderAgenda();
      const labels = (id) => [...document.querySelectorAll(`#${id} .agenda-book-title`)].map((t) => t.textContent);
      return { future: labels("agenda-future-list"), past: labels("agenda-past-list") };
    } finally {
      AGENDA.splice(0, AGENDA.length, ...real);
      todayISO = realToday;
      renderAgenda();
    }
  }

  test("past sessions list most recent first, future sessions soonest first", () => {
    // Fixture order is shuffled, and the past spans a year boundary.
    const { future, past } = renderAgendaFixture("2026-06-15", [
      { date: "2026-01-10", location: "x", bookId: "jan" },
      { date: "2026-09-01", location: "x", bookId: "set" },
      { date: "2025-12-01", location: "x", bookId: "dez" },
      { date: "2026-05-20", location: "x", bookId: "mai" },
      { date: "2026-07-01", location: "x", bookId: "jul" },
    ]);
    eq(past.join(" "), "[mai] [jan] [dez]", "past order");
    eq(future.join(" "), "[jul] [set]", "future order");
  });

  test("a session dated today is listed as upcoming, not past", () => {
    const { future, past } = renderAgendaFixture("2026-06-15", [
      { date: "2026-06-14", location: "x", bookId: "ontem" },
      { date: "2026-06-15", location: "x", bookId: "hoje" },
    ]);
    eq(future.join(" "), "[hoje]", "future");
    eq(past.join(" "), "[ontem]", "past");
  });

  // ---- Expansion ----

  test("only one drawer is open at a time, and a second click closes it", () => {
    const el = fixture();
    const [a, b] = el.querySelectorAll(".chip-piece");
    const [da, db] = el.querySelectorAll(".agenda-piece");
    // Each step: click, then check open state, aria, and the +/− sign.
    a.click();
    assert(da.classList.contains("open") && !db.classList.contains("open"), "A open, B closed");
    eq(a.getAttribute("aria-expanded"), "true", "A aria");
    assert(a.classList.contains("open") && !b.classList.contains("open"), "only A chip highlighted");
    eq(a.querySelector(".chip-piece-sign").textContent, "−", "A sign");
    b.click();
    assert(!da.classList.contains("open") && db.classList.contains("open"), "B open, A closed");
    eq(a.querySelector(".chip-piece-sign").textContent, "+", "A sign reset");
    assert(!a.classList.contains("open") && b.classList.contains("open"), "highlight moved to B");
    b.click();
    eq(el.querySelectorAll(".agenda-piece.open").length, 0, "all closed");
    eq(b.getAttribute("aria-expanded"), "false", "B aria");
  });

  // Fixture meeting rows built straight from renderAgendaRow. Any real book id
  // works; the tests only need one that resolves so the book card exists.
  const anyBookId = Object.keys(BOOKS)[0];
  function pastRow() {
    return renderAgendaRow({
      date: "2020-01-01", location: "x", bookId: anyBookId, findings: "relato",
      participants: ["Só Nome", { name: "Ana", piece: { text: "texto" } }],
    }, true, false);
  }

  test("a past row shows Discussão then Sinopse, with no toggle or shop links", () => {
    // Order of the row's sections: Discussão divider, findings, chips, then
    // the Sinopse divider and the book card.
    const row = pastRow();
    const dividers = [...row.querySelectorAll(".agenda-divider")].map((d) => d.textContent);
    eq(dividers.join(" | "), "Discussão | Sinopse", "divider titles");
    const order = [...row.children].map((c) => c.className).filter((c) => /divider|findings|participants|book-card/.test(c));
    eq(order.join(" "), "agenda-divider agenda-findings agenda-participants agenda-divider agenda-book-card", "section order");
    eq(row.querySelector(".agenda-more"), null, "no toggle");
    eq(row.querySelector(".shop-link"), null, "no shop links");
    assert(row.querySelector(".agenda-book-card .sinopse"), "sinopse shown");
  });

  test("a past row with no findings or participants has no Discussão title", () => {
    const row = renderAgendaRow({ date: "2020-01-01", location: "x", bookId: anyBookId }, true, false);
    const dividers = [...row.querySelectorAll(".agenda-divider")].map((d) => d.textContent);
    eq(dividers.join(" | "), "Sinopse", "only Sinopse");
  });

  test("upcoming rows show the book card and no section titles", () => {
    // Both the pinned next row and a later one.
    [true, false].forEach((isNext) => {
      const row = renderAgendaRow({ date: "2999-01-01", location: "x", bookId: anyBookId }, false, isNext);
      assert(row.querySelector(".agenda-book-card .sinopse"), `sinopse shown (next=${isNext})`);
      eq(row.querySelector(".agenda-divider"), null, `no dividers (next=${isNext})`);
      eq(row.querySelector(".agenda-more"), null, `no toggle (next=${isNext})`);
    });
  });

  test("a past row's header is one line: book, author, date and target, then place and time", () => {
    // Skips the optional parts it isn't given, and keeps the place last.
    const book = getBook(anyBookId);
    const date = formatAgendaDate("2020-03-04");
    const full = renderAgendaRow({ date: "2020-03-04", time: "20:30", location: "Royal", upToPage: 95, bookId: anyBookId }, true, false);
    const chunks = (row) => [...row.querySelectorAll(".agenda-head > span")].map((c) => c.textContent.trim().replace(/\s+/g, " "));
    eq(chunks(full).join(" | "), `${book.emoji} ${book.title} | — ${book.author} · ${book.pages} pág. · ${date} · até pág. 95 | 📍 Royal · 20:30`, "full header");
    const bare = renderAgendaRow({ date: "2020-03-04", location: "Royal", bookId: anyBookId }, true, false);
    eq(chunks(bare).join(" | "), `${book.emoji} ${book.title} | — ${book.author} · ${book.pages} pág. · ${date} | 📍 Royal`, "header without target or time");
    eq(bare.querySelector(".agenda-pin"), null, "past rows have no pin");
  });

  test("an upcoming row's header is the book, with date, target, place, and time below", () => {
    // The pinned next row carries the 📌 on the details line.
    const date = formatAgendaDate("2999-01-01");
    const next = renderAgendaRow({ date: "2999-01-01", location: "Royal", upToPage: 95, bookId: anyBookId }, false, true);
    eq(next.querySelector(".title-row .book-title").textContent, getBook(anyBookId).title, "title in the card header");
    const meta = next.querySelector(".agenda-meta").textContent;
    assert(meta.startsWith(`📌 ${date}`) && meta.endsWith("· até pág. 95 · Royal"), `meta line: ${meta}`);
  });

  test("quotes get their own Citações section between Discussão and Sinopse", () => {
    const row = renderAgendaRow({
      date: "2020-01-01", location: "x", bookId: anyBookId, findings: "relato",
      quotes: [{ text: "q", by: "Ana" }], participants: ["Ana"],
    }, true, false);
    const order = [...row.children]
      .filter((c) => /divider|findings|quotes|participants/.test(c.className))
      .map((c) => c.className === "agenda-divider" ? c.textContent : c.className);
    eq(order.join(" "), "Discussão agenda-findings agenda-participants Citações agenda-quotes Sinopse", "section order");
  });

  test("a past row with only quotes has Citações but no Discussão", () => {
    const row = renderAgendaRow({ date: "2020-01-01", location: "x", bookId: anyBookId, quotes: [{ text: "q" }] }, true, false);
    const titles = [...row.querySelectorAll(".agenda-divider")].map((d) => d.textContent);
    eq(titles.join(" | "), "Citações | Sinopse", "titles");
  });

  const out = document.createElement("pre");
  out.id = "test-results";
  out.textContent = `${failed === 0 ? "PASS" : "FAIL"}\n${results.join("\n")}\n`;
  document.body.appendChild(out);
})();
