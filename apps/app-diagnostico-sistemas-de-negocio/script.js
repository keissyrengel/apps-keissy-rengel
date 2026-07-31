// ---- Datos ----
const SYSTEMS = [
  { id: "atraccion", label: "Atracción", emoji: "📣" },
  { id: "produccion", label: "Producción", emoji: "⚙️" },
  { id: "monetizacion", label: "Monetización", emoji: "💲" },
  { id: "seguimiento", label: "Seguimiento", emoji: "🔁" },
  { id: "implementacion", label: "Implementación", emoji: "🔗" },
  { id: "chequeo", label: "Chequeo", emoji: "✅" },
  { id: "repeticion", label: "Repetición", emoji: "♻️" },
  { id: "personal", label: "Tareas personales", emoji: "🏠" },
];

const QUESTIONS = [
  {
    text: "¿Cómo describirías el estado actual del negocio?",
    options: [
      { label: "Genera ingresos de una sola forma y quiere diversificar", cat: "monetizacion" },
      { label: "Hay ventas, pero todo pasa manualmente por la misma persona", cat: "implementacion" },
      { label: "Hay varios frentes abiertos y nada está bien estructurado", cat: "reestructurar" },
    ],
  },
  {
    text: "Cuando alguien nuevo escribe interesado en comprar, ¿qué pasa?",
    options: [
      { label: "Cada mensaje se responde de forma manual, sin un proceso fijo", cat: "implementacion" },
      { label: "Hay un proceso, pero no llegan suficientes personas nuevas", cat: "monetizacion" },
      { label: "Llega tanto que ya no se puede dar abasto revisando todo", cat: "reestructurar" },
    ],
  },
  {
    text: "¿Qué tan documentados están los procesos hoy?",
    options: [
      { label: "Nada, todo vive en la cabeza de quien lidera el negocio", cat: "implementacion" },
      { label: "Algunos, pero solo para lo que ya se vende, no para crecer", cat: "monetizacion" },
      { label: "Hay procesos, pero se cruzan entre tantos frentes distintos", cat: "reestructurar" },
    ],
  },
  {
    text: "¿Cuál es el mayor freno para crecer ahora mismo?",
    options: [
      { label: "No está claro cómo generar más ingresos sin vender más tiempo", cat: "monetizacion" },
      { label: "No queda tiempo porque todo lo operativo se hace en persona", cat: "implementacion" },
      { label: "Hay demasiados frentes abiertos y no está claro por dónde ordenar", cat: "reestructurar" },
    ],
  },
  {
    text: "Si hubiera un asistente de IA disponible desde mañana, ¿qué le pedirías primero?",
    options: [
      { label: "Que ayude a crear más formas de generar ingresos", cat: "monetizacion" },
      { label: "Que ejecute las tareas repetitivas que quitan tiempo", cat: "implementacion" },
      { label: "Que ayude a mapear y ordenar todo antes de delegar nada", cat: "reestructurar" },
    ],
  },
];

const RESULTS = {
  monetizacion: {
    title: "El cuello de botella es de MONETIZACIÓN",
    desc: "El negocio depende de una sola forma de generar ingresos — probablemente el tiempo uno a uno. Cuando ese tiempo se acaba, el negocio se detiene también.",
    highlight: ["atraccion", "monetizacion", "repeticion"],
    color: "var(--rojo)",
    ctaLabel: "Ver Income Atlas",
    ctaUrl: "https://tusitio.com/income-atlas",
  },
  implementacion: {
    title: "El cuello de botella es OPERATIVO",
    desc: "Hay demanda, pero cada tarea repetitiva todavía pasa por las mismas manos porque nada está documentado ni delegado.",
    highlight: ["produccion", "implementacion", "chequeo"],
    color: "var(--fucsia)",
    ctaLabel: "Conocer el servicio de implementación",
    ctaUrl: "https://tusitio.com/implementacion",
  },
  reestructurar: {
    title: "El cuello de botella es ESTRUCTURAL",
    desc: "Hay varios frentes abiertos a la vez y ninguno tiene arquitectura clara todavía. El reto no es un sistema — es el negocio completo.",
    highlight: SYSTEMS.map((s) => s.id),
    color: "var(--morado)",
    ctaLabel: "Agendar consultoría de negocio",
    ctaUrl: "https://tusitio.com/consultoria",
  },
};

// ---- Estado ----
let stage = "intro"; // intro | quiz | result
let step = 0;
let tally = { monetizacion: 0, implementacion: 0, reestructurar: 0 };

const app = document.getElementById("app");

// ---- Utilidades ----
function radialPosition(index, total, radius, cx, cy) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

const SVG_NS = "http://www.w3.org/2000/svg";

function buildSystemsMap(highlight, activeColorVar) {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 118;
  const activeColor = activeColorVar || "var(--rojo)";

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);

  // líneas del centro a cada nodo
  SYSTEMS.forEach((sys, i) => {
    const pos = radialPosition(i, SYSTEMS.length, radius, cx, cy);
    const isActive = highlight.includes(sys.id);
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", cx);
    line.setAttribute("y1", cy);
    line.setAttribute("x2", pos.x);
    line.setAttribute("y2", pos.y);
    line.setAttribute("stroke", isActive ? activeColor : "var(--oscuro)");
    line.setAttribute("stroke-opacity", isActive ? "0.65" : "0.15");
    line.setAttribute("stroke-width", "1.5");
    svg.appendChild(line);
  });

  // hub central
  const hub = document.createElementNS(SVG_NS, "circle");
  hub.setAttribute("cx", cx);
  hub.setAttribute("cy", cy);
  hub.setAttribute("r", "38");
  hub.setAttribute("fill", "var(--rojo)");
  svg.appendChild(hub);

  const hubText = document.createElementNS(SVG_NS, "text");
  hubText.setAttribute("x", cx);
  hubText.setAttribute("y", cy + 4);
  hubText.setAttribute("text-anchor", "middle");
  hubText.setAttribute("font-size", "10.5");
  hubText.setAttribute("font-family", "Montserrat, sans-serif");
  hubText.setAttribute("font-weight", "600");
  hubText.setAttribute("fill", "var(--crema)");
  hubText.setAttribute("letter-spacing", "0.5");
  hubText.textContent = "EL NEGOCIO";
  svg.appendChild(hubText);

  // nodos
  SYSTEMS.forEach((sys, i) => {
    const pos = radialPosition(i, SYSTEMS.length, radius, cx, cy);
    const isActive = highlight.includes(sys.id);

    const g = document.createElementNS(SVG_NS, "g");
    g.style.opacity = isActive ? "1" : "0.4";
    g.style.transition = "opacity 0.5s ease";

    const node = document.createElementNS(SVG_NS, "circle");
    node.setAttribute("cx", pos.x);
    node.setAttribute("cy", pos.y);
    node.setAttribute("r", "22");
    node.setAttribute("fill", isActive ? activeColor : "var(--crema)");
    node.setAttribute("stroke", isActive ? activeColor : "var(--oscuro)");
    node.setAttribute("stroke-opacity", isActive ? "1" : "0.3");
    node.setAttribute("stroke-width", "1.5");
    g.appendChild(node);

    const emoji = document.createElementNS(SVG_NS, "text");
    emoji.setAttribute("x", pos.x);
    emoji.setAttribute("y", pos.y + 5);
    emoji.setAttribute("text-anchor", "middle");
    emoji.setAttribute("font-size", "14");
    emoji.textContent = sys.emoji;
    g.appendChild(emoji);

    svg.appendChild(g);
  });

  return svg;
}

// ---- Render ----
function render() {
  app.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "wrap";

  if (stage === "intro") {
    wrap.appendChild(renderIntro());
  } else if (stage === "quiz") {
    wrap.appendChild(renderQuiz());
  } else {
    wrap.appendChild(renderResult());
  }

  app.appendChild(wrap);
}

function renderIntro() {
  const container = document.createElement("div");

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Diagnóstico gratuito";
  container.appendChild(eyebrow);

  const title = document.createElement("h1");
  title.className = "title";
  title.textContent = "¿Cuál es el cuello de botella del negocio?";
  container.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "subtitle";
  subtitle.textContent =
    "Todo negocio digital sostiene 8 sistemas en paralelo, aunque no se vean. Responde 5 preguntas y descubre cuál está frenando el crecimiento ahora mismo.";
  container.appendChild(subtitle);

  const mapHolder = document.createElement("div");
  mapHolder.className = "map-holder";
  mapHolder.appendChild(buildSystemsMap([]));
  container.appendChild(mapHolder);

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.innerHTML = "Comenzar diagnóstico →";
  btn.addEventListener("click", () => {
    stage = "quiz";
    step = 0;
    tally = { monetizacion: 0, implementacion: 0, reestructurar: 0 };
    render();
  });
  container.appendChild(btn);

  return container;
}

function renderQuiz() {
  const container = document.createElement("div");
  const q = QUESTIONS[step];

  const progressRow = document.createElement("div");
  progressRow.className = "progress-row";
  progressRow.innerHTML = `<span>PREGUNTA ${step + 1} DE ${QUESTIONS.length}</span>`;
  container.appendChild(progressRow);

  const track = document.createElement("div");
  track.className = "progress-track";
  const fill = document.createElement("div");
  fill.className = "progress-fill";
  fill.style.width = `${((step + 1) / QUESTIONS.length) * 100}%`;
  track.appendChild(fill);
  container.appendChild(track);

  const question = document.createElement("h2");
  question.className = "question";
  question.textContent = q.text;
  container.appendChild(question);

  const options = document.createElement("div");
  options.className = "options";

  q.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt.label;
    btn.addEventListener("click", () => handleAnswer(opt.cat));
    options.appendChild(btn);
  });

  container.appendChild(options);
  return container;
}

function handleAnswer(cat) {
  tally[cat] += 1;
  if (step + 1 < QUESTIONS.length) {
    step += 1;
  } else {
    stage = "result";
  }
  render();
}

function getResultKey() {
  return Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
}

function renderResult() {
  const container = document.createElement("div");
  const key = getResultKey();
  const result = RESULTS[key];

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow result-eyebrow";
  eyebrow.style.setProperty("--result-color", result.color);
  eyebrow.textContent = "Resultado del diagnóstico";
  container.appendChild(eyebrow);

  const title = document.createElement("h2");
  title.className = "result-title";
  title.textContent = result.title;
  container.appendChild(title);

  const mapHolder = document.createElement("div");
  mapHolder.className = "map-holder";
  mapHolder.appendChild(buildSystemsMap(result.highlight, result.color));
  container.appendChild(mapHolder);

  const desc = document.createElement("p");
  desc.className = "result-desc";
  desc.textContent = result.desc;
  container.appendChild(desc);

  const cta = document.createElement("a");
  cta.className = "btn-primary btn-result";
  cta.style.setProperty("--result-color", result.color);
  cta.href = result.ctaUrl;
  cta.target = "_blank";
  cta.rel = "noopener noreferrer";
  cta.innerHTML = `${result.ctaLabel} →`;
  container.appendChild(cta);

  const restartRow = document.createElement("div");
  restartRow.className = "restart-row";
  const restartBtn = document.createElement("button");
  restartBtn.className = "restart-btn";
  restartBtn.textContent = "Volver a hacer el diagnóstico";
  restartBtn.addEventListener("click", () => {
    stage = "intro";
    step = 0;
    tally = { monetizacion: 0, implementacion: 0, reestructurar: 0 };
    render();
  });
  restartRow.appendChild(restartBtn);
  container.appendChild(restartRow);

  return container;
}

render();
