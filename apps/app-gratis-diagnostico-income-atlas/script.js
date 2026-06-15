/* ============================================================
   Income Atlas – Diagnóstico de Monetización
   script.js
   ============================================================ */

/* ----- CONSTANTS ----- */
const INCOME_ATLAS_URL = "#income-atlas"; // Reemplaza con la URL real
const SUBMIT_ENDPOINT  = "/submit-diagnosis";
const DEMO_MODE        = true; // false en producción

/* ----- PATHS (caminos de resultado) ----- */
const PATHS = {
  recomendaciones: {
    name:    "Marketing de afiliados",
    tagline: "Recomienda productos o servicios de terceros y gana una comisión por cada venta.",
    icon:    "🔗",
    diagnosis_title: "Tu punto de partida podría estar en convertir tu criterio en recomendaciones útiles.",
    summary: "Según tus respuestas, podrías empezar sin crear un producto propio desde cero. Tu oportunidad inicial puede estar en recomendar herramientas, recursos, productos o servicios que ya entiendes.",
    suggested_options: [
      "Afiliados de herramientas o productos alineados con tu tema.",
      "Alianzas con profesionales o marcas complementarias.",
      "Curaduría de recursos útiles para una audiencia específica."
    ],
    what_to_avoid: "Evita recomendar productos solo por comisión o saltar entre demasiadas opciones sin una línea clara.",
    next_step: "Haz una lista de 5 herramientas que realmente usarías o recomendarías, y define para qué tipo de persona serían útiles.",
    pitch_angle: "Necesita convertir criterio y recomendaciones en una ruta de monetización alineada con su marca."
  },
  microactivos: {
    name:    "Crea productos digitales propios",
    tagline: "Empaqueta lo que sabes en una guía, plantilla, curso corto o recurso descargable.",
    icon:    "📦",
    diagnosis_title: "Tu punto de partida podría estar en transformar una parte de lo que sabes en un recurso simple.",
    summary: "Según tus respuestas, tienes conocimiento o ideas que podrían convertirse en un primer activo digital pequeño: una guía, checklist, plantilla, mini training o recurso práctico.",
    suggested_options: [
      "Checklist o guía descargable para resolver un problema específico.",
      "Plantilla práctica que ahorre tiempo o reduzca errores.",
      "Mini training enfocado en un resultado concreto."
    ],
    what_to_avoid: "Evita crear un producto demasiado amplio o genérico. Mientras más específico sea el problema, más fácil será comunicar su valor.",
    next_step: "Define un problema pequeño y concreto que puedas ayudar a resolver con un recurso simple en menos de una hora de uso.",
    pitch_angle: "Necesita convertir conocimiento disperso en un activo claro, específico y validable."
  },
  servicios: {
    name:    "Ofrece servicios a terceros",
    tagline: "Haz algo para alguien más y cobra por ello — diseño, asesoría, implementación, lo que sabes hacer.",
    icon:    "🎯",
    diagnosis_title: "Tu punto de partida podría estar en vender una solución concreta antes de crear un producto grande.",
    summary: "Según tus respuestas, tienes una habilidad aplicable que podría resolver un problema específico. Ofrecer un servicio simple puede ayudarte a validar demanda y generar evidencia real.",
    suggested_options: [
      "Auditoría o diagnóstico personalizado.",
      "Servicio puntual de implementación.",
      "Paquete pequeño con resultado claro y alcance limitado."
    ],
    what_to_avoid: "Evita empezar por un curso grande, una membresía o una oferta compleja antes de validar qué resultado está dispuesto a pagar tu mercado.",
    next_step: "Identifica una situación específica donde puedas ayudar a una persona concreta a conseguir un resultado claro, y conviértelo en una oferta simple.",
    pitch_angle: "Necesita ordenar su habilidad en una oferta clara y usar la experiencia real como base de monetización."
  },
  experiencia: {
    name:    "Vende formaciones o asesorías",
    tagline: "Monetiza tu experiencia directamente: cursos, mentorías, certificaciones, acompañamiento.",
    icon:    "🧭",
    diagnosis_title: "Tu punto de partida podría estar en estructurar una oferta alrededor de lo que ya has probado.",
    summary: "Según tus respuestas, ya podrías tener experiencia, resultados o señales de demanda. El reto no es empezar desde cero, sino ordenar lo que sabes en una oferta clara y específica.",
    suggested_options: [
      "Asesoría o consultoría enfocada en un problema específico.",
      "Programa pequeño de acompañamiento.",
      "Entrenamiento práctico basado en un proceso que ya aplicaste."
    ],
    what_to_avoid: "Evita convertir todo lo que sabes en una oferta demasiado grande. La claridad suele vender mejor que la cantidad.",
    next_step: "Documenta el proceso que ya has aplicado y resume qué resultado produce, para quién y bajo qué condiciones.",
    pitch_angle: "Necesita convertir experiencia en metodología, mensaje y oferta estructurada."
  },
  claridad: {
    name:    "Primero trabaja en las bases",
    tagline: "Todavía no es momento de elegir un modelo — necesitas claridad sobre qué puedes ofrecer y a quién.",
    icon:    "🔍",
    diagnosis_title: "Tu punto de partida no es elegir un modelo todavía, sino aclarar qué puedes monetizar.",
    summary: "Según tus respuestas, puede que tengas ideas o habilidades, pero todavía falta claridad sobre qué sabes, para quién sería útil y qué problema específico podrías resolver.",
    suggested_options: [
      "Inventario de habilidades, experiencia y conocimiento.",
      "Validación simple con conversaciones o contenido exploratorio.",
      "Recomendaciones o recursos pequeños para probar interés sin construir algo complejo."
    ],
    what_to_avoid: "Evita construir una marca, curso o producto completo antes de saber qué problema específico quieres resolver y para quién.",
    next_step: "Haz una lista de 10 cosas que sabes hacer, 10 problemas que puedes resolver y 10 tipos de personas a las que podrías ayudar. Busca cruces entre esas tres listas.",
    pitch_angle: "Necesita claridad de conocimiento monetizable, cliente ideal y punto de partida."
  }
};

/* ----- QUESTIONS ----- */
const QUESTIONS = [
  {
    id: "q1", label: "Situación actual",
    title: "¿Dónde estás hoy?",
    sub: "Elige la tarjeta que mejor describe tu punto de partida.",
    multi: false,
    options: [
      { icon:"💼", title:"Tengo experiencia, pero no sé cómo monetizarla online",    desc:"Sabes hacer algo valioso, pero todavía no lo has convertido en una oferta clara.",        scores:{ servicios:2, microactivos:1, claridad:1 } },
      { icon:"🔧", title:"Tengo habilidades, pero no sé qué ofrecer",                desc:"Puedes hacer cosas útiles, pero te cuesta empaquetarlas como modelo de negocio.",        scores:{ servicios:2, claridad:2 } },
      { icon:"📢", title:"Tengo audiencia, pero no vendo con claridad",              desc:"Hay personas que te siguen o escuchan, pero falta una ruta de monetización.",            scores:{ recomendaciones:2, microactivos:2, experiencia:1 } },
      { icon:"📊", title:"Ya vendo algo, pero quiero ordenar mi modelo",             desc:"Tienes movimiento, pero necesitas más estructura y dirección.",                           scores:{ experiencia:2, servicios:1, microactivos:1 } },
      { icon:"🌱", title:"Estoy empezando desde cero",                              desc:"Quieres crear algo online, pero todavía no sabes qué camino elegir.",                    scores:{ claridad:3, recomendaciones:1 } }
    ]
  },
  {
    id: "q2", label: "Tu activo principal",
    title: "¿Qué activo tienes más fuerte ahora mismo?",
    sub: "No pienses en lo perfecto. Elige lo que ya tienes más disponible.",
    multi: false,
    options: [
      { icon:"🎓", title:"Conocimiento profesional",           desc:"Tienes experiencia, formación o criterio en un área específica.",                                                    scores:{ servicios:1, experiencia:2, microactivos:1 } },
      { icon:"⚙️", title:"Habilidad práctica",                desc:"Puedes hacer algo por otros: diseñar, escribir, organizar, vender, crear, asesorar o implementar.",                 scores:{ servicios:3, microactivos:1 } },
      { icon:"👥", title:"Audiencia o comunidad",              desc:"Ya tienes personas que te leen, te escuchan o confían en tu criterio.",                                              scores:{ recomendaciones:3, microactivos:1, experiencia:1 } },
      { icon:"🌀", title:"Experiencia personal transformada",  desc:"Viviste un proceso y podrías ayudar a otros a evitar errores o avanzar con más claridad.",                          scores:{ claridad:1, microactivos:2, experiencia:1 } },
      { icon:"🤷", title:"No tengo claro mi activo todavía",   desc:"Sientes que sabes cosas, pero todavía no logras ver qué podría monetizarse.",                                       scores:{ claridad:3 } }
    ]
  },
  {
    id: "q3", label: "Validación",
    title: "¿Ya has generado ingresos con eso?",
    sub: "Esto ayuda a detectar si conviene validar, vender servicio o crear algo más estructurado.",
    multi: false,
    options: [
      { icon:"✅", title:"Sí, de forma constante",          desc:"Ya existe validación real, aunque el modelo pueda estar desordenado.",                               scores:{ experiencia:3, servicios:1 } },
      { icon:"🔄", title:"Sí, pero de forma ocasional",     desc:"Hay señales de demanda, pero todavía falta estructura.",                                             scores:{ servicios:2, microactivos:1, experiencia:1 } },
      { icon:"💬", title:"Todavía no, pero me piden consejo",desc:"Puede haber valor, pero conviene empezar con validación simple.",                                   scores:{ recomendaciones:1, microactivos:1, claridad:2 } },
      { icon:"❌", title:"No he generado ingresos con eso", desc:"Antes de construir algo grande, conviene identificar una oportunidad pequeña.",                      scores:{ claridad:2, recomendaciones:1 } },
      { icon:"❓", title:"No tengo claridad todavía",        desc:"Puede que ya haya valor, pero falta traducirlo en una oferta concreta.",                            scores:{ claridad:3 } }
    ]
  },
  {
    id: "q4", label: "Forma natural",
    title: "¿Qué te resulta más natural?",
    sub: "Elige la forma en la que normalmente ayudas, resuelves o aportas valor.",
    multi: false,
    options: [
      { icon:"🔗", title:"Recomendar herramientas, productos o recursos", desc:"Sueles detectar qué puede servirle a alguien según su situación.",              scores:{ recomendaciones:3 } },
      { icon:"📋", title:"Crear recursos simples",                        desc:"Te gusta convertir ideas en guías, plantillas, checklists o materiales prácticos.", scores:{ microactivos:3 } },
      { icon:"🛠",  title:"Hacer o implementar por otros",                desc:"Prefieres resolver directamente en vez de solo explicar.",                        scores:{ servicios:3 } },
      { icon:"🧭", title:"Acompañar, asesorar o guiar",                   desc:"Te gusta ayudar a pensar, decidir, ordenar o avanzar con estructura.",           scores:{ experiencia:3 } },
      { icon:"🔍", title:"Todavía no lo sé",                              desc:"Necesitas explorar antes de elegir un modelo.",                                  scores:{ claridad:3 } }
    ]
  },
  {
    id: "q5", label: "Tu audiencia",
    title: "¿Tienes audiencia o comunidad?",
    sub: "Puede ser una audiencia grande, pequeña o simplemente una red que confía en tu criterio.",
    multi: false,
    options: [
      { icon:"🚫", title:"No todavía",                      desc:"Se puede empezar, pero conviene elegir un camino con baja fricción.",                           scores:{ claridad:1, servicios:1, recomendaciones:1 } },
      { icon:"🌱", title:"Tengo una audiencia pequeña",     desc:"Puede ser suficiente para validar si el mensaje es específico.",                               scores:{ recomendaciones:1, microactivos:2, servicios:1 } },
      { icon:"🔥", title:"Tengo una audiencia activa",      desc:"Ya hay atención. El reto es convertirla en una ruta clara.",                                   scores:{ recomendaciones:2, microactivos:2, experiencia:1 } },
      { icon:"📇", title:"Tengo contactos, pero no comunidad",desc:"Tu primera monetización podría venir de conversaciones directas.",                           scores:{ servicios:2, claridad:1 } },
      { icon:"💡", title:"Tengo comunidad, pero no vendo",  desc:"El problema no parece ser visibilidad, sino arquitectura de monetización.",                    scores:{ microactivos:2, experiencia:2, recomendaciones:1 } }
    ]
  },
  {
    id: "q6", label: "Prioridad ahora",
    title: "¿Qué necesitas primero?",
    sub: "Esto ayuda a priorizar entre validar rápido, construir activos o estructurar una oferta.",
    multi: false,
    options: [
      { icon:"⚡", title:"Generar ingresos lo antes posible", desc:"Conviene empezar con algo simple, directo y validable.",                                     scores:{ servicios:2, recomendaciones:2 } },
      { icon:"🧪", title:"Validar una idea",                  desc:"Antes de construir grande, necesitas señales reales del mercado.",                           scores:{ microactivos:2, claridad:1, recomendaciones:1 } },
      { icon:"🏗",  title:"Construir algo propio",            desc:"Podrías crear un primer activo simple, sin saltar a algo complejo.",                         scores:{ microactivos:3 } },
      { icon:"🗺",  title:"Ordenar muchas ideas",             desc:"El reto principal es claridad antes que ejecución.",                                         scores:{ claridad:3 } },
      { icon:"📐", title:"Crear una oferta más seria",        desc:"Puede que ya tengas base para estructurar algo con más intención.",                          scores:{ experiencia:2, servicios:1 } }
    ]
  },
  {
    id: "q7", label: "Lo que prefieres evitar",
    title: "¿Qué preferirías evitar por ahora?",
    sub: "Esto nos ayuda a no recomendarte un camino que no encaje con tu momento.",
    multi: true,
    options: [
      { icon:"📚", title:"Crear un curso grande",                       desc:"", avoidKey:"curso_grande" },
      { icon:"🤝", title:"Vender servicios 1:1",                       desc:"", avoidKey:"servicios_1a1" },
      { icon:"🛒", title:"Crear una tienda con muchos productos",       desc:"", avoidKey:"tienda" },
      { icon:"📱", title:"Depender de redes sociales todos los días",   desc:"", avoidKey:"redes" },
      { icon:"🤷", title:"Todavía no lo sé",                           desc:"", avoidKey:"no_se" }
    ]
  }
];

/* ----- STATE ----- */
let state = {
  currentQ:        0,
  scores:          { recomendaciones:0, microactivos:0, servicios:0, experiencia:0, claridad:0 },
  selectedAnswers: [],
  avoidedOptions:  [],
  result:          null
};

/* ----- SCREEN NAVIGATION ----- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ----- START ----- */
function startQuiz() {
  state.currentQ = 0;
  renderQ();
  showScreen('screen-question');
}

/* ----- RENDER QUESTION ----- */
function renderQ() {
  const q     = QUESTIONS[state.currentQ];
  const total = QUESTIONS.length;
  const pct   = Math.round((state.currentQ / total) * 100);

  document.getElementById('prog-fill').style.width  = pct + '%';
  document.getElementById('prog-step').textContent  = q.label || ('Pregunta ' + (state.currentQ + 1));
  document.getElementById('prog-count').textContent = (state.currentQ + 1) + ' / ' + total;
  document.getElementById('q-label').textContent    = 'Pregunta ' + (state.currentQ + 1);
  document.getElementById('q-title').textContent    = q.title;
  document.getElementById('q-sub').textContent      = q.sub;
  document.getElementById('multi-tag').style.display = q.multi ? 'inline-flex' : 'none';

  const list = document.getElementById('cards-list');
  list.innerHTML = '';

  const cta  = document.getElementById('cta-continue');
  const cbtn = document.getElementById('btn-continue');
  cta.style.display = q.multi ? 'block' : 'none';
  cbtn.disabled = true;

  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'opt-card';
    btn.setAttribute('role', 'listitem');
    btn.setAttribute('aria-pressed', 'false');
    btn.style.animationDelay = (i * 0.05) + 's';
    btn.style.animation = 'slideUp .35s var(--ease) both';
    btn.innerHTML = `
      <div class="card-icon-wrap">${opt.icon}</div>
      <div class="card-body">
        <div class="card-title">${opt.title}</div>
        ${opt.desc ? `<div class="card-desc">${opt.desc}</div>` : ''}
      </div>
      <div class="card-check">
        <svg viewBox="0 0 12 9"><polyline points="1 4.5 4.5 8 11 1"/></svg>
      </div>`;
    btn.addEventListener('click', () => selectOpt(i, btn, q));
    list.appendChild(btn);
  });
}

/* ----- SELECT OPTION ----- */
function selectOpt(idx, el, q) {
  el.classList.add('pop');
  el.addEventListener('animationend', () => el.classList.remove('pop'), { once: true });

  if (q.multi) {
    el.classList.toggle('selected');
    el.setAttribute('aria-pressed', el.classList.contains('selected') ? 'true' : 'false');
    document.getElementById('btn-continue').disabled = !document.querySelector('#cards-list .opt-card.selected');
  } else {
    document.querySelectorAll('#cards-list .opt-card').forEach(c => {
      c.classList.remove('selected');
      c.setAttribute('aria-pressed', 'false');
    });
    el.classList.add('selected');
    el.setAttribute('aria-pressed', 'true');
    setTimeout(() => nextQuestion(), 300);
  }
}

/* ----- NEXT QUESTION ----- */
function nextQuestion() {
  const q    = QUESTIONS[state.currentQ];
  const sel  = [...document.querySelectorAll('#cards-list .opt-card.selected')];
  const idxs = sel.map(el => [...el.parentNode.children].indexOf(el));

  if (q.multi) {
    const avoided = [];
    idxs.forEach(i => { const o = q.options[i]; if (o.avoidKey) avoided.push(o.avoidKey); });
    state.avoidedOptions = avoided;
    if (avoided.includes('servicios_1a1')) state.scores.servicios   = Math.max(0, state.scores.servicios   - 1);
    if (avoided.includes('curso_grande'))  state.scores.experiencia = Math.max(0, state.scores.experiencia - 1);
    if (avoided.includes('no_se'))         state.scores.claridad   += 1;
    state.selectedAnswers.push({ q: q.id, selected: idxs });
  } else {
    const o = q.options[idxs[0]];
    if (o && o.scores) Object.entries(o.scores).forEach(([k, v]) => { state.scores[k] = (state.scores[k] || 0) + v; });
    state.selectedAnswers.push({ q: q.id, selected: idxs[0] });
  }

  state.currentQ++;
  if (state.currentQ < QUESTIONS.length) {
    renderQ();
    showScreen('screen-question');
  } else {
    computeResult();
    showLoading();
  }
}

/* ----- COMPUTE RESULT ----- */
function computeResult() {
  const priority = ['servicios', 'microactivos', 'recomendaciones', 'experiencia', 'claridad'];
  const sorted   = Object.entries(state.scores)
    .sort(([a, sa], [b, sb]) => sb - sa || priority.indexOf(a) - priority.indexOf(b))
    .map(([k]) => k);
  state.result = { main: sorted[0], secondary: sorted[1], support: sorted[2] };
}

/* ----- LOADING ----- */
function showLoading() {
  showScreen('screen-loading');
  const msgs = ["Analizando tus respuestas…", "Detectando tu punto de partida…", "Tu diagnóstico está listo."];
  let i = 0;
  const el = document.getElementById('loader-msg');
  el.textContent = msgs[0];
  const iv = setInterval(() => {
    i++;
    if (i < msgs.length) {
      el.style.animation = 'none';
      void el.offsetWidth; // fuerza reflow para reiniciar animación
      el.style.animation = 'fadeIn .4s ease both';
      el.textContent = msgs[i];
    } else {
      clearInterval(iv);
      setTimeout(showTeaser, 700);
    }
  }, 950);
}

/* ----- TEASER ----- */
function showTeaser() {
  const mp = PATHS[state.result.main];
  document.getElementById('main-icon').textContent    = mp.icon;
  document.getElementById('main-name').textContent    = mp.name;
  document.getElementById('main-tagline').textContent = mp.tagline;
  showScreen('screen-teaser');
}

/* ----- FORM SUBMIT ----- */
function submitForm() {
  const name  = document.getElementById('inp-name').value.trim();
  const email = document.getElementById('inp-email').value.trim();

  document.getElementById('err-name').textContent  = '';
  document.getElementById('err-email').textContent = '';

  let ok = true;
  if (!name)  { document.getElementById('err-name').textContent  = 'Por favor ingresa tu nombre.'; ok = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('err-email').textContent = 'Ingresa un correo válido.'; ok = false;
  }
  if (!ok) return;

  const mp = PATHS[state.result.main];
  const payload = {
    first_name:        name,
    email:             email,
    main_path:         state.result.main,
    secondary_path:    state.result.secondary,
    support_path:      state.result.support,
    scores:            state.scores,
    selected_answers:  state.selectedAnswers,
    avoided_options:   state.avoidedOptions,
    diagnosis_title:   mp.diagnosis_title,
    diagnosis_summary: mp.summary,
    suggested_options: mp.suggested_options,
    what_to_avoid:     mp.what_to_avoid,
    next_step:         mp.next_step,
    pitch_angle:       mp.pitch_angle,
    tags:              ['income-atlas', 'diagnostico', state.result.main]
  };

  submitLead(payload);
}

async function submitLead(payload) {
  const btn = document.getElementById('btn-submit');
  btn.disabled    = true;
  btn.textContent = 'Enviando…';

  if (DEMO_MODE) {
    console.log('[DEMO] Payload:', payload);
    await new Promise(r => setTimeout(r, 1300));
    showScreen('screen-success');
    return;
  }

  try {
    const res = await fetch(SUBMIT_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Error en el servidor');
    showScreen('screen-success');
  } catch (err) {
    console.error(err);
    btn.disabled    = false;
    btn.textContent = 'Enviarme mi diagnóstico';
    document.getElementById('err-email').textContent = 'Hubo un error. Intenta nuevamente.';
  }
}

/* ----- INIT SUCCESS BUTTON ----- */
document.addEventListener('DOMContentLoaded', () => {
  const atlasBtn = document.getElementById('btn-atlas');
  if (atlasBtn) atlasBtn.addEventListener('click', () => window.open(INCOME_ATLAS_URL, '_blank'));
});
