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

// Pregunta 1: modalidad (se guarda aparte, no se acumula)
const MODALITY_QUESTION = {
  text: "Si tuvieras que resolver algo en tu negocio, ¿qué preferirías?",
  options: [
    { label: "Aprender a hacerlo yo mismo", modality: "aprender" },
    { label: "Que alguien me acompañe mientras lo hago", modality: "acompanado" },
    { label: "Que alguien lo haga por mí", modality: "hecho" },
  ],
};

// Preguntas 2-6: tema del negocio (se acumulan)
const TOPIC_QUESTIONS = [
  {
    text: "¿Cómo describirías el estado actual del negocio?",
    options: [
      { label: "Genera ingresos de una sola forma (tiempo uno a uno) y quiere diversificar", cat: "monetizacion" },
      { label: "Hay poco tráfico o leads entrando, o los que llegan se pierden por falta de sistema", cat: "marketing_trafico" },
      { label: "Hay varios frentes abiertos a la vez y nada estructurado", cat: "sistemas_generales" },
    ],
  },
  {
    text: "¿Qué pasa cuando llega un lead o mensaje nuevo (si llega)?",
    options: [
      { label: "Se responde manualmente sin centralizar canales, o casi no llegan mensajes nuevos", cat: "marketing_trafico" },
      { label: "Hay un proceso, pero no llegan suficientes personas nuevas para vender más", cat: "monetizacion" },
      { label: "Llega desde tantos lados que ya no se puede dar abasto revisando todo", cat: "sistemas_generales" },
    ],
  },
  {
    text: "¿Qué tan organizados están los procesos de ventas y seguimiento?",
    options: [
      { label: "No hay CRM, pipeline, ni una estrategia de tráfico definida", cat: "marketing_trafico" },
      { label: "Hay documentación para lo que ya se vende, pero no para diversificar ingresos", cat: "monetizacion" },
      { label: "Hay procesos, pero se cruzan entre tantos frentes que nada calza", cat: "sistemas_generales" },
    ],
  },
  {
    text: "Sobre la publicidad paga y el contenido:",
    options: [
      { label: "No hay campañas activas ni contenido constante generando tráfico", cat: "marketing_trafico" },
      { label: "El foco no es más tráfico — es generar ingresos de otra forma", cat: "monetizacion" },
      { label: "Hay campañas o contenido para varios frentes y ninguno con gestión clara", cat: "sistemas_generales" },
    ],
  },
  {
    text: "Si hubiera un asistente o sistema disponible desde mañana, ¿qué resolvería primero?",
    options: [
      { label: "Que ayude a atraer y centralizar los leads", cat: "marketing_trafico" },
      { label: "Que ayude a crear más formas de generar ingresos con lo que ya sabe hacer", cat: "monetizacion" },
      { label: "Que ayude a mapear y ordenar todo el negocio antes de delegar nada", cat: "sistemas_generales" },
    ],
  },
];

const QUESTIONS = [MODALITY_QUESTION, ...TOPIC_QUESTIONS];

const TOPIC_META = {
  monetizacion: {
    highlight: ["atraccion", "monetizacion", "repeticion"],
    color: "var(--rojo)",
    contextLine: "sobre cómo diversificar tus ingresos",
  },
  marketing_trafico: {
    highlight: ["atraccion", "implementacion", "seguimiento"],
    color: "var(--fucsia)",
    contextLine: "sobre tráfico y tu sistema de marketing",
  },
  sistemas_generales: {
    highlight: SYSTEMS.map((s) => s.id),
    color: "var(--morado)",
    contextLine: "sobre ordenar los sistemas del negocio",
  },
};

// Rutas cuando la modalidad es "aprender" — self-serve, sin intervención manual
const LEARN_ROUTES = {
  monetizacion: {
    title: "El camino es aprender a MONETIZAR de otras formas",
    desc: "El negocio depende de una sola forma de generar ingresos — probablemente el tiempo uno a uno. Income Atlas enseña otros modelos para diversificar sin depender solo de eso.",
    ctaLabel: "Ver Income Atlas",
    ctaUrl: "https://cursos.keissyrengel.com/lanzamiento-income-atlas",
  },
  marketing_trafico: {
    title: "El camino es aprender a generar y ordenar el TRÁFICO",
    desc: "Antes de pagar por un sistema o una agencia, puedes encontrar útil alguno de mis formaciones y recursos para aprender por cuenta propia.",
    ctaLabel: "Ver recursos en la Biblioteca de recursos",
    ctaUrl: "https://cursos.keissyrengel.com/home--el-hub-de-keissy-rengel",
  },
  sistemas_generales: {
    title: "El camino es aprender a construir SISTEMAS con IA",
    desc: "El negocio tiene varios frentes sin documentar. La Fase 3 de Income Atlas enseña exactamente como crear fácil y paso a paso sistemas para ordenarlo todo con criterio.",
    ctaLabel: "Ver Income Atlas — Sistemas con IA",
    ctaUrl: "https://cursos.keissyrengel.com/lanzamiento-income-atlas",
  },
};

// Ruta cuando la modalidad es "acompañado" o "hecho por ti" — siempre a WhatsApp,
// donde se califica manualmente entre consultoría o agencia.
const GUIDED_WHATSAPP_URL = "https://wa.me/12247472106?text=Hola%20Keissy!%20Vengo%20de%20la%20herramienta%20de%20diagn%C3%B3stico%20de%20sistemas%20y%20estoy%20interesada%20en%20saber%20c%C3%B3mo%20puedes%20ayudarme%20con%20el%20crecimiento%20de%20mi%20negocio.";

function getGuidedTitle(modality) {
  return modality === "acompanado"
    ? "El siguiente paso es que te acompañe a resolverlo"
    : "El siguiente paso es que lo resolvamos por ti";
}

// ---- Estado ----
let stage = "intro"; // intro | quiz | result
let step = 0;
let modality = null;
let tally = { monetizacion: 0, marketing_trafico: 0, sistemas_generales: 0 };

const app = document.getElementById("app");

function resetState() {
  stage = "intro";
  step = 0;
  modality = null;
  tally = { monetizacion: 0, marketing_trafico: 0, sistemas_generales: 0 };
}

// ---- Utilidades SVG ----
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
    "Todo negocio digital sostiene 8 sistemas en paralelo, aunque no se vean. Responde 6 preguntas y descubre qué está frenando el crecimiento — y cuál es el siguiente paso.";
  container.appendChild(subtitle);

  const mapHolder = document.createElement("div");
  mapHolder.className = "map-holder";
  mapHolder.appendChild(buildSystemsMap([]));
  container.appendChild(mapHolder);

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.innerHTML = "Comenzar diagnóstico →";
  btn.addEventListener("click", () => {
    resetState();
    stage = "quiz";
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
    btn.addEventListener("click", () => handleAnswer(opt));
    options.appendChild(btn);
  });

  container.appendChild(options);
  return container;
}

function handleAnswer(opt) {
  if (opt.modality) {
    modality = opt.modality;
  }
  if (opt.cat) {
    tally[opt.cat] += 1;
  }

  if (step + 1 < QUESTIONS.length) {
    step += 1;
  } else {
    stage = "result";
  }
  render();
}

function getTopicKey() {
  return Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
}

function renderResult() {
  const container = document.createElement("div");
  const topicKey = getTopicKey();
  const meta = TOPIC_META[topicKey];

  let title, desc, ctaLabel, ctaUrl, color;

  if (modality === "aprender") {
    const route = LEARN_ROUTES[topicKey];
    title = route.title;
    desc = route.desc;
    ctaLabel = route.ctaLabel;
    ctaUrl = route.ctaUrl;
    color = meta.color;
  } else {
    title = getGuidedTitle(modality);
    desc = `Escribe por WhatsApp contando un poco ${meta.contextLine} — ahí se define juntos si conviene más una consultoría o el servicio de agencia, según lo que necesite el negocio.`;
    ctaLabel = "Escríbeme por WhatsApp";
    ctaUrl = GUIDED_WHATSAPP_URL;
    color = meta.color;
  }

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow result-eyebrow";
  eyebrow.style.setProperty("--result-color", color);
  eyebrow.textContent = "Resultado del diagnóstico";
  container.appendChild(eyebrow);

  const titleEl = document.createElement("h2");
  titleEl.className = "result-title";
  titleEl.textContent = title;
  container.appendChild(titleEl);

  const mapHolder = document.createElement("div");
  mapHolder.className = "map-holder";
  mapHolder.appendChild(buildSystemsMap(meta.highlight, color));
  container.appendChild(mapHolder);

  const descEl = document.createElement("p");
  descEl.className = "result-desc";
  descEl.textContent = desc;
  container.appendChild(descEl);

  const cta = document.createElement("a");
  cta.className = "btn-primary btn-result";
  cta.style.setProperty("--result-color", color);
  cta.style.color = "var(--crema)";
  cta.href = ctaUrl;
  cta.target = "_blank";
  cta.rel = "noopener noreferrer";
  cta.innerHTML = `${ctaLabel} →`;
  container.appendChild(cta);

  const restartRow = document.createElement("div");
  restartRow.className = "restart-row";
  const restartBtn = document.createElement("button");
  restartBtn.className = "restart-btn";
  restartBtn.textContent = "Volver a hacer el diagnóstico";
  restartBtn.addEventListener("click", () => {
    resetState();
    render();
  });
  restartRow.appendChild(restartBtn);
  container.appendChild(restartRow);

  return container;
}

render();
