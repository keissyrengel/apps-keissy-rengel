const { useMemo, useState } = React;

const steps = ["Inicio", "Tema", "Público", "Resultado", "Formato", "Oferta"];

const initialForm = {
  topic: "",
  audience: "",
  situation: "",
  problem: "",
  result: "",
  timeframe: "",
  objection: "",
  format: ""
};

const formatOptions = [
  {
    id: "audio",
    icon: "🎧",
    title: "Audio / masterclass",
    copy: "Muy fácil de crear, pero suele tener menor valor percibido.",
    points: 1
  },
  {
    id: "pdf",
    icon: "📄",
    title: "PDF / guía / plantilla",
    copy: "Ideal para validar rápido y crear un producto de entrada.",
    points: 3
  },
  {
    id: "video",
    icon: "🎥",
    title: "Mini-curso en video",
    copy: "Mayor autoridad, mejor percepción de valor y más conversión.",
    points: 5
  }
];

function cleanText(text) {
  return (text || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.。]+$/g, "")
    .replace(/^cómo\s+/i, "")
    .replace(/^como\s+/i, "")
    .replace(/^ayudar\s+a\s+/i, "")
    .replace(/^enseñar\s+a\s+/i, "")
    .replace(/^lograr\s+/i, "")
    .replace(/^conseguir\s+conseguir\s+/i, "conseguir ");
}

function removeDuplicatePrepositions(text) {
  return cleanText(text)
    .replace(/\bpara para\b/gi, "para")
    .replace(/\ben en\b/gi, "en")
    .replace(/\bsin sin\b/gi, "sin")
    .replace(/\bcon con\b/gi, "con")
    .replace(/\bde de\b/gi, "de");
}

function normalizeResult(text) {
  let value = removeDuplicatePrepositions(text);

  if (!value) return "conseguir un resultado concreto";

  value = value
    .replace(/^a\s+/i, "")
    .replace(/^que\s+/i, "")
    .replace(/^puedan\s+/i, "")
    .replace(/^pueda\s+/i, "");

  const startsWithVerb = /^(conseguir|crear|vender|lanzar|organizar|diseñar|aumentar|mejorar|convertir|generar|atraer|validar|estructurar|monetizar|posicionar|escalar|automatizar|planificar|definir|transformar|captar|cerrar|subir|bajar|ahorrar|dominar|aprender|construir|facturar|reducir|simplificar)\b/i.test(value);

  if (startsWithVerb) return value;

  return `lograr ${value}`;
}

function normalizeAudience(text) {
  let value = removeDuplicatePrepositions(text);

  if (!value) return "un perfil específico";

  value = value
    .replace(/^a\s+/i, "")
    .replace(/^para\s+/i, "")
    .replace(/^personas\s+que\s+son\s+/i, "personas ")
    .replace(/^gente\s+que\s+son\s+/i, "personas ")
    .replace(/^gente\b/i, "personas");

  return value;
}

function normalizeTimeframe(text) {
  let value = removeDuplicatePrepositions(text);

  if (!value) return "un periodo claro";

  value = value
    .replace(/^en\s+/i, "")
    .replace(/^durante\s+/i, "")
    .replace(/^dentro\s+de\s+/i, "");

  return value;
}

function normalizeObjection(text) {
  let value = removeDuplicatePrepositions(text);

  if (!value) return "complicarse con el proceso";

  value = value
    .replace(/^sin\s+/i, "")
    .replace(/^no\s+tener\s+que\s+/i, "")
    .replace(/^tener\s+que\s+/i, "")
    .replace(/^la\s+necesidad\s+de\s+/i, "")
    .replace(/^necesidad\s+de\s+/i, "");

  return value;
}

function capitalizeSentence(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function removeRepeatedTitleParts(text) {
  return cleanText(text)
    .replace(/\s+sin\s+.+$/i, "")
    .replace(/\s+en\s+\d+\s*(días|dias|semanas|meses|horas).+$/i, "")
    .replace(/\s+en\s+(una semana|un mes|un día|un dia|30 días|30 dias).+$/i, "");
}

function normalizeTitlePart(text) {
  return cleanText(text)
    .replace(/^para\s+/i, "")
    .replace(/^en\s+/i, "")
    .replace(/^sin\s+/i, "")
    .replace(/\.$/, "");
}

function buildOfferTitle(form) {
  const result = removeRepeatedTitleParts(normalizeResult(form.result));
  const audience = normalizeTitlePart(normalizeAudience(form.audience));
  const timeframe = normalizeTitlePart(normalizeTimeframe(form.timeframe));
  const objection = normalizeTitlePart(normalizeObjection(form.objection));

  let title = `Cómo ${result}`;

  if (audience) {
    title += ` para ${audience}`;
  }

  if (timeframe) {
    title += ` en ${timeframe}`;
  }

  if (objection) {
    title += ` sin ${objection}`;
  }

  return capitalizeSentence(removeDuplicatePrepositions(title));
}

function startsWithActionVerb(text) {
  return /^(conseguir|crear|definir|construir|facturar|vender|lanzar|organizar|mejorar|ahorrar|automatizar|diseñar|generar|atraer|validar|estructurar|monetizar|posicionar|escalar|captar|cerrar|aprender|dominar|transformar|aumentar|reducir|simplificar|convertir)\b/i.test(cleanText(text));
}

function App() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [toast, setToast] = useState("");

  const progress = Math.round((step / (steps.length - 1)) * 100);
  const selectedFormat = formatOptions.find((item) => item.id === form.format);

  const offerData = useMemo(() => {
    const formatScore = selectedFormat?.points || 0;
    const specificityItems = [
      Boolean(form.result.trim()),
      Boolean(form.audience.trim()),
      Boolean(form.situation.trim() || form.problem.trim()),
      Boolean(form.timeframe.trim()),
      Boolean(form.objection.trim())
    ];

    const specificityScore = specificityItems.filter(Boolean).length;
    const totalScore = Math.min(10, formatScore + specificityScore);
    const viralPotential = Math.min(96, Math.round(totalScore * 8.7 + (form.problem.length > 20 ? 6 : 0)));

    return { formatScore, specificityScore, totalScore, viralPotential };
  }, [form, selectedFormat]);

  const mainOfferTitle = useMemo(() => buildOfferTitle(form), [form]);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2200);
  };

  const next = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const back = () => {
    if (step > 0) {
      setStep(step - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const resetAll = () => {
    const confirmReset = window.confirm("¿Quieres empezar desde cero? Se borrarán las respuestas actuales para crear una nueva oferta.");
    if (confirmReset) {
      setForm(initialForm);
      setStep(1);
      showToast("Lista para crear una nueva oferta ✨");
    }
  };

  const tryAnotherAngle = () => {
    setForm((prev) => ({ ...initialForm, topic: prev.topic }));
    setStep(2);
    showToast("Perfecto. Probemos otro ángulo con el mismo tema.");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-text-group">
            <div className="brand-kicker">Marca personal y Negocios Digitales</div>
            <img className="brand-logo" src="https://assets.cdn.filesafe.space/1tnv6pXlSb2uk7llIeB0/media/699258e9a9efde7b16867e58.png" alt="Logo Keissy Rengel" />
          </div>
        </div>
        <div className="topbar-pill">Offer Score Lab · Productos digitales ganadores</div>
      </header>

      {step === 0 ? (
        <Hero onStart={() => setStep(1)} />
      ) : (
        <div className="workspace">
          <Sidebar step={step} progress={progress} />
          <main className="main-panel">
            {step === 1 && <TopicStep form={form} updateForm={updateForm} next={next} />}
            {step === 2 && <AudienceStep form={form} updateForm={updateForm} next={next} back={back} />}
            {step === 3 && <ResultStep form={form} updateForm={updateForm} next={next} back={back} />}
            {step === 4 && <FormatStep form={form} updateForm={updateForm} next={next} back={back} />}
            {step === 5 && <ResultsStep form={form} offerData={offerData} mainOfferTitle={mainOfferTitle} selectedFormat={selectedFormat} back={back} resetAll={resetAll} tryAnotherAngle={tryAnotherAngle} showToast={showToast} />}
          </main>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Hero({ onStart }) {
  return (
    <section className="hero-card">
      <div>
        <div className="hero-eyebrow">✦ Laboratorio de ofertas ganadoras</div>
        <h1>Crea una oferta digital de 10 puntos</h1>
        <p className="hero-copy">Responde unas preguntas simples y convierte una idea general en una oferta específica, vendible y visualmente fácil de evaluar.</p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={onStart}>Empezar diagnóstico ✨</button>
          <button className="btn btn-secondary">Ver cómo se calcula el score</button>
        </div>
      </div>

      <div className="score-preview">
        <div className="preview-title"><span>Oferta ejemplo</span><span>Zona fuerte</span></div>
        <div className="score-circle">
          <div className="score-number"><strong>8.4</strong><span>de 10 puntos</span></div>
        </div>
        <div className="preview-list">
          <div className="preview-item"><span>Formato recomendado</span><span>Mini-curso</span></div>
          <div className="preview-item"><span>Potencial viral</span><span>84%</span></div>
          <div className="preview-item"><span>Nivel</span><span>Muy vendible</span></div>
        </div>
      </div>
    </section>
  );
}

function Sidebar({ step, progress }) {
  return (
    <aside className="sidebar">
      <div className="progress-label"><span>Progreso</span><span>{progress}%</span></div>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
      <div className="step-list">
        {steps.slice(1).map((item, index) => {
          const realStep = index + 1;
          const status = step === realStep ? "active" : step > realStep ? "done" : "";
          return <div className={`step-item ${status}`} key={item}><div className="step-dot">{step > realStep ? "✓" : realStep}</div><span>{item}</span></div>;
        })}
      </div>
    </aside>
  );
}

function TopicStep({ form, updateForm, next }) {
  return (
    <>
      <div className="panel-kicker">Paso 1</div>
      <h2 className="panel-title">¿Sobre qué tema te gustaría crear tu producto digital?</h2>
      <p className="panel-copy">No necesitas tener una oferta perfecta todavía. Solo escribe el tema sobre el que te gustaría crear algo.</p>
      <div className="form-group">
        <label className="label">Tema general</label>
        <input className="input" value={form.topic} onChange={(e) => updateForm("topic", e.target.value)} placeholder="Ej: marketing para coaches, organización del hogar, skincare, finanzas personales..." />
        <div className="help">Piensa en un área donde tengas experiencia, curiosidad o resultados que podrías convertir en producto.</div>
      </div>
      <div className="nav-actions"><span></span><button className="btn btn-primary" onClick={next} disabled={!form.topic.trim()}>Continuar →</button></div>
    </>
  );
}

function AudienceStep({ form, updateForm, next, back }) {
  return (
    <>
      <div className="panel-kicker">Paso 2</div>
      <h2 className="panel-title">Ahora hagamos la idea más específica</h2>
      <p className="panel-copy">La especificidad es lo que hace que una persona sienta: “esto fue hecho para mí”.</p>
      <div className="form-group"><label className="label">¿A quién quieres ayudar exactamente?</label><input className="input" value={form.audience} onChange={(e) => updateForm("audience", e.target.value)} placeholder="Ej: coaches que están empezando, mamás emprendedoras, fotógrafas freelance..." /></div>
      <div className="form-group"><label className="label">¿En qué situación específica está esa persona?</label><textarea className="textarea" value={form.situation} onChange={(e) => updateForm("situation", e.target.value)} placeholder="Ej: ya publica contenido, pero no logra convertir seguidores en clientes..." /></div>
      <div className="form-group"><label className="label">¿Qué problema le duele más?</label><textarea className="textarea" value={form.problem} onChange={(e) => updateForm("problem", e.target.value)} placeholder="Ej: siente que vende, pero nadie responde; tiene ideas, pero no sabe convertirlas en una oferta clara..." /></div>
      <div className="nav-actions"><button className="btn btn-ghost" onClick={back}>← Atrás</button><button className="btn btn-primary" onClick={next}>Continuar →</button></div>
    </>
  );
}

function ResultStep({ form, updateForm, next, back }) {
  return (
    <>
      <div className="panel-kicker">Paso 3</div>
      <h2 className="panel-title">Define la promesa de transformación</h2>
      <p className="panel-copy">Una oferta fuerte no vende información. Vende una transformación clara. Para que el título final suene natural, escribe el resultado como una acción: conseguir, crear, definir, lanzar, vender, facturar, organizar o construir.</p>
      <div className="mini-note"><span>💡</span><div><strong>Fórmula:</strong> Cómo + [verbo en infinitivo + resultado concreto] para [perfil exacto] en [tiempo] sin [objeción principal].</div></div>
      <div className="form-group">
      <label className="label"> ¿Qué resultado concreto quiere lograr?</label>
        <input
          className="input"
          value={form.result}
          onChange={(e) => updateForm("result", e.target.value)}
          placeholder="Ej: conseguir 10 clientes desde Instagram"
        />
        <div className="help">
          Escribe solo el resultado, empezando con un verbo de acción.
          No incluyas aquí el público, el tiempo ni la objeción. Eso lo vamos a sumar
          en los siguientes campos para que el título final se lea limpio.
        </div>
           <div className="example-grid">
      <div className="example-box example-good">
        <strong>✅ Bien escrito</strong>
        <span>conseguir 10 clientes desde Instagram</span>
        <span>crear una oferta digital validada</span>
        <span>definir una rutina de contenido semanal</span>
      </div>
    
      <div className="example-box example-bad">
        <strong>⚠️ Evita escribirlo así</strong>
        <span>que tenga más clientes</span>
        <span>quiero ayudar a vender más</span>
        <span>mejorar su negocio</span>
      </div>
    </div>
        {form.result && !startsWithActionVerb(form.result) && <div className="soft-warning">Tip: intenta empezar con un verbo de acción para que el título final suene mejor. Ejemplo: “conseguir…”, “crear…”, “definir…”, “vender…”.</div>}
      </div>
      <div className="form-group"><label className="label">¿En cuánto tiempo o con qué alcance?</label><input className="input" value={form.timeframe} onChange={(e) => updateForm("timeframe", e.target.value)} placeholder="Ej: en 30 días, en una semana, con una rutina de 20 minutos..." /></div>
      <div className="form-group"><label className="label">¿Qué objeción principal quiere evitar?</label><input className="input" value={form.objection} onChange={(e) => updateForm("objection", e.target.value)} placeholder="Ej: pagar anuncios, grabar todos los días, sentirte intensa vendiendo..." /></div>
      <div className="nav-actions"><button className="btn btn-ghost" onClick={back}>← Atrás</button><button className="btn btn-primary" onClick={next}>Continuar →</button></div>
    </>
  );
}

function FormatStep({ form, updateForm, next, back }) {
  return (
    <>
      <div className="panel-kicker">Paso 4</div>
      <h2 className="panel-title">Elige el formato de tu producto</h2>
      <p className="panel-copy">El formato suma puntos porque afecta el valor percibido, la confianza y la facilidad de venta.</p>
      <div className="option-grid">
        {formatOptions.map((option) => <div key={option.id} className={`option-card ${form.format === option.id ? "selected" : ""}`} onClick={() => updateForm("format", option.id)}><div className="option-icon">{option.icon}</div><div className="option-title">{option.title}</div><div className="option-copy">{option.copy}</div><div className="points-badge">+{option.points} puntos</div></div>)}
      </div>
      <div className="mini-note"><span>✨</span><div><strong>Recomendación estratégica:</strong> si buscas más autoridad, confianza y conversión, el mini-curso en video suele ser la opción más fuerte.</div></div>
      <div className="nav-actions"><button className="btn btn-ghost" onClick={back}>← Atrás</button><button className="btn btn-primary" onClick={next} disabled={!form.format}>Generar mi oferta →</button></div>
    </>
  );
}

function ResultsStep({ form, offerData, mainOfferTitle, selectedFormat, back, resetAll, tryAnotherAngle, showToast }) {
  const scoreLabel = offerData.totalScore >= 8 ? "Zona fuerte" : offerData.totalScore >= 6 ? "Necesita ajustes" : "Oferta débil";
  const offerIdeas = [
    { title: mainOfferTitle, score: offerData.totalScore, viral: offerData.viralPotential, featured: true },
    { title: `Cómo convertir ${form.topic || "tu conocimiento"} en una oferta clara para ${form.audience || "tu audiencia"} sin complicarte con mil ideas`, score: Math.max(5.8, offerData.totalScore - 1.1).toFixed(1), viral: Math.max(52, offerData.viralPotential - 12), featured: false }
  ];

  return (
    <>
      <div className="panel-kicker">Resultado</div>
      <h2 className="panel-title">Tu oferta ya tiene forma</h2>
      <p className="panel-copy">Aquí tienes una primera versión evaluada con el sistema de puntos. Puedes mejorarla, probar otro ángulo o empezar desde cero con un tema nuevo.</p>
      <div className="results-grid">
        {offerIdeas.map((offer, index) => (
          <div className={`result-card ${offer.featured ? "featured" : ""}`} key={index}>
            <div className="result-top">
              <div>
                <h3 className="result-title">{offer.title}</h3>
                <div className="badges"><span className="badge badge-pink">{selectedFormat?.title || "Formato pendiente"}</span><span className="badge badge-gold">Potencial viral {offer.viral}%</span><span className="badge badge-green">{scoreLabel}</span></div>
              </div>
              <div className="result-score"><strong>{offer.score}</strong><span>de 10</span></div>
            </div>
            <div className="score-bars">
              <div className="score-row"><span>Formato</span><div className="bar"><div className="bar-fill" style={{ width: `${(offerData.formatScore / 5) * 100}%` }} /></div><span>{offerData.formatScore}/5</span></div>
              <div className="score-row"><span>Especificidad</span><div className="bar"><div className="bar-fill" style={{ width: `${(offerData.specificityScore / 5) * 100}%` }} /></div><span>{offerData.specificityScore}/5</span></div>
              <div className="score-row"><span>Viralidad</span><div className="bar"><div className="bar-fill" style={{ width: `${offer.viral}%` }} /></div><span>{offer.viral}%</span></div>
            </div>
            <div className="feedback-grid">
              <div className="feedback-box feedback-good"><h4>✅ Por qué funciona</h4><ul><li>Parte de un tema que la alumna sí quiere convertir en producto.</li><li>Incluye una promesa más específica que una idea genérica.</li><li>El formato elegido suma valor percibido a la oferta.</li><li>Se puede convertir en una estructura de producto real.</li></ul></div>
              <div className="feedback-box feedback-bad"><h4>⚠️ Mejora sugerida</h4><ul><li>Haz el resultado todavía más medible si es posible.</li><li>Agrega un mecanismo único para diferenciar la promesa.</li><li>Revisa si la objeción principal es la más fuerte para esa audiencia.</li></ul></div>
            </div>
<div className="nav-actions">
  <button
    className="btn btn-primary"
    onClick={() =>
      window.open(
        "https://cursos.keissyrengel.com/lanzamiento-income-atlas",
        "_blank"
      )
    }
  >
    Mejorar esta oferta
  </button>

  <button
    className="btn btn-secondary"
    onClick={() =>
      window.open(
        "https://cursos.keissyrengel.com/checkout-curso-express-24h",
        "_blank"
      )
    }
  >
    Crear estructura del producto
  </button>
</div>
          </div>
        ))}
      </div>
      <div className="reset-zone"><div><h3>¿Quieres seguir explorando?</h3><p>Puedes probar otro ángulo con este mismo tema o borrar todo para crear una oferta completamente nueva.</p></div><div className="hero-actions"><button className="btn btn-secondary" onClick={tryAnotherAngle}>Probar otro ángulo</button><button className="btn btn-ghost" onClick={resetAll}>Crear una nueva oferta</button></div></div>
      <div className="nav-actions"><button className="btn btn-ghost" onClick={back}>← Volver al formato</button></div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
