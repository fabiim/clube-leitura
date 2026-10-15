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

  const out = document.createElement("pre");
  out.id = "test-results";
  out.textContent = `${failed === 0 ? "PASS" : "FAIL"}\n${results.join("\n")}\n`;
  document.body.appendChild(out);
})();
