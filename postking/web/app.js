/* Post-King Chess UI. Offline. No telemetry. Click to move. */
(function () {
  const FILES = "abcdefgh";
  const startScreen = document.getElementById("start-screen");
  const boardScreen = document.getElementById("board-screen");
  const boardEl = document.getElementById("board");
  const turnLine = document.getElementById("turn-line");
  const resultLine = document.getElementById("result-line");
  const facts = document.getElementById("facts");

  let game = null;
  let selected = null;

  document.getElementById("new-game").addEventListener("click", newGame);
  document.getElementById("back-start").addEventListener("click", () => show("start"));
  const resignBtn = document.getElementById("resign");
  if (resignBtn) resignBtn.addEventListener("click", resign);

  function show(which) {
    startScreen.classList.toggle("hidden", which !== "start");
    boardScreen.classList.toggle("hidden", which !== "board");
  }

  function difficulty() {
    const el = document.querySelector('input[name="difficulty"]:checked');
    return el ? el.value : "steward";
  }

  function seed() {
    const el = document.getElementById("seed");
    const n = el ? Number(el.value) : 1;
    return Number.isFinite(n) ? n : 1;
  }

  async function newGame() {
    const res = await fetch("/api/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ difficulty: difficulty(), seed: seed() }),
    });
    const payload = await res.json();
    game = payload.game;
    selected = null;
    show("board");
    render();
  }

  async function resign() {
    const res = await fetch("/api/resign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const payload = await res.json();
    game = payload.game || payload;
    selected = null;
    render();
  }

  async function sendMove(uci) {
    const res = await fetch("/api/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uci: uci }),
    });
    const payload = await res.json();
    if (!res.ok) {
      resultLine.textContent = payload.error || "illegal";
      return;
    }
    game = payload.game;
    selected = null;
    render();
  }

  function fenMap(fen) {
    const placement = fen.split(" ")[0];
    const map = {};
    let r = 7;
    let f = 0;
    for (const ch of placement) {
      if (ch === "/") { r -= 1; f = 0; continue; }
      if (ch >= "1" && ch <= "8") { f += Number(ch); continue; }
      map[FILES[f] + (r + 1)] = ch;
      f += 1;
    }
    return map;
  }

  function lastSquares() {
    const hist = (game && game.history) || [];
    const mv = hist.length ? hist[hist.length - 1] : "";
    if (!mv || mv.length < 4) return new Set();
    return new Set([mv.slice(0, 2), mv.slice(2, 4)]);
  }

  function destsFrom(from) {
    const legal = (game && game.legal) || [];
    return new Set(legal.filter((u) => u.slice(0, 2) === from).map((u) => u.slice(2, 4)));
  }

  function pieceSvg(ch) {
    const human = ch === ch.toUpperCase();
    const kind = ch.toLowerCase();
    const fill = human ? "#111111" : "#c9a562";
    const stroke = "#c9a562";
    const sw = human ? 1.7 : 1.15;
    let inner = "";
    if (kind === "p") inner = `<circle cx="16" cy="18" r="5.2"/>`;
    else if (kind === "n") inner = `<path d="M9 26 L11 12 L18 8 L24 14 L20 18 L24 26 Z"/>`;
    else if (kind === "b") inner = `<path d="M16 7 L22 26 L10 26 Z"/>`;
    else if (kind === "r") inner = `<path d="M9 10 L9 8 L12 8 L12 10 L14 10 L14 8 L18 8 L18 10 L20 10 L20 8 L23 8 L23 10 L23 26 L9 26 Z"/>`;
    else if (kind === "q") inner = `<circle cx="16" cy="16" r="7"/><circle cx="16" cy="7" r="1.6"/><circle cx="8" cy="12" r="1.6"/><circle cx="24" cy="12" r="1.6"/>`;
    else if (kind === "k") inner = `<circle cx="16" cy="18" r="7"/><path d="M16 5 L16 12 M12 8 L20 8" stroke-width="1.8"/>`;
    else if (kind === "o") inner = `<circle cx="16" cy="16" r="8" fill="none" stroke-width="2.2"/>`;
    return `<div class="piece"><svg viewBox="0 0 32 32" aria-hidden="true"><g fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round">${inner}</g></svg></div>`;
  }

  function setBar(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.max(0, Math.min(100, pct)) + "%";
  }

  function render() {
    if (!game || !game.fen) return;
    const playing = !game.result;
    const turn = game.side === "white" ? "Human (white) to move." : "Post-King (black) to move.";
    let line = turn;
    if (game.result === "human_win") line = "Continuity collapse. The system did not remain.";
    if (game.result === "human_loss") line = "The king fell.";
    if (game.result === "draw") line = "Draw (" + (game.result_reason || "") + ").";
    turnLine.textContent = line;
    document.getElementById("m-clusters").textContent = String(game.clusters);
    document.getElementById("m-influence").textContent = Number(game.influence).toFixed(3) + " / " + Number(game.threshold).toFixed(2);
    document.getElementById("m-collapse").textContent = (game.streak || 0) + " / " + game.n + "   M=" + game.m;
    setBar("bar-clusters", (2 - Math.min(2, game.clusters)) * 50);
    setBar("bar-influence", game.threshold ? Math.min(100, (game.influence / game.threshold) * 100) : 0);
    setBar("bar-collapse", game.n ? (game.streak / game.n) * 100 : 0);
    facts.innerHTML =
      "<div>Difficulty <b>" + (game.difficulty_label || game.difficulty) + "</b></div>" +
      "<div>Seed <b>" + game.seed + "</b></div>" +
      "<div>Restore within M <b>" + (game.can_restore ? "yes" : "no") + "</b></div>";
    resultLine.textContent = playing ? "" : (game.result_reason || game.result);

    const pieces = fenMap(game.fen);
    const last = lastSquares();
    const dests = selected ? destsFrom(selected) : new Set();
    boardEl.innerHTML = "";
    for (let r = 7; r >= 0; r--) {
      for (let f = 0; f < 8; f++) {
        const name = FILES[f] + (r + 1);
        const sq = document.createElement("div");
        sq.className = "sq" + ((f + r) % 2 === 0 ? " dark" : "");
        sq.dataset.sq = name;
        if (last.has(name)) sq.classList.add("last");
        if (selected === name) sq.classList.add("sel");
        if (dests.has(name)) {
          sq.classList.add("legal");
          if (pieces[name]) sq.classList.add("occ");
        }
        if (f === 0) {
          const c = document.createElement("span");
          c.className = "coord";
          c.textContent = String(r + 1);
          sq.appendChild(c);
        }
        const ch = pieces[name];
        if (ch) sq.insertAdjacentHTML("beforeend", pieceSvg(ch));
        sq.addEventListener("click", () => onSquare(name, ch));
        boardEl.appendChild(sq);
      }
    }
  }

  function onSquare(name, ch) {
    if (!game || game.result || game.side !== "white") return;
    if (selected) {
      const ds = destsFrom(selected);
      if (ds.has(name)) {
        const isPawn = fenMap(game.fen)[selected] === "P";
        const promo = isPawn && name[1] === "8" ? "q" : "";
        sendMove(selected + name + promo);
        return;
      }
    }
    const isHuman = ch && ch === ch.toUpperCase();
    if (isHuman) {
      selected = name;
      render();
      return;
    }
    selected = null;
    render();
  }
})();
