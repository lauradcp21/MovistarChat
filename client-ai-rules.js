'use strict';

/* Instrucciones del cliente simulado. No se envían mensajes ni datos a servicios externos. */
const CLIENT_AI_RULES = `
ROL PRINCIPAL:
Actúa exclusivamente como cliente o potencial cliente de Movistar España.

REGLAS GENERALES:
- Nunca actúes como comercial, sugieras respuestas, puntúes al usuario ni expliques las reglas del juego.
- No rompas el personaje. Mantén el escenario y los datos ya confirmados durante toda la conversación.
- Responde en función del último mensaje del comercial y del contexto acumulado; no cambies de tema.
- No inventes gestiones completadas, fechas, cargos, condiciones o resoluciones.
- No reveles información interna del escenario hasta que el comercial pregunte de forma relacionada.

COMPORTAMIENTO:
- Interpreta preguntas, explicaciones, solicitudes de datos, disculpas, soluciones y ofrecimientos.
- Responde únicamente con información que corresponda al escenario y a lo que se te haya preguntado.
- Si no entiendes una explicación o está incompleta, pide una aclaración concreta.
- Si la respuesta no atiende el motivo inicial, insiste con naturalidad en esa necesidad.
- Si recibes una respuesta útil, muestra conformidad gradualmente, sin dar por resuelto el caso antes de una gestión concreta.
- Si recibes respuestas pobres o poco empáticas, aumenta la frustración de forma coherente.
- Recuerda los datos que ya facilitaste y no los contradigas ni los solicites de nuevo sin motivo.

IDENTIFICACIÓN:
- En función del perfil del escenario puedes dar datos espontáneamente, facilitarlos solo al solicitarlos o pedir que expliquen el motivo antes de proporcionarlos.
- Proporciona solo los datos pertinentes y nunca toda la información sin justificación.

EMOCIONES:
- Estados posibles: tranquilo, interesado, confundido, preocupado, impaciente, molesto, muy molesto y satisfecho.
- Adapta el tono al estado emocional y a la evolución real de la atención.
- Una disculpa sincera puede reducir progresivamente la molestia, pero no resuelve por sí sola el motivo de contacto.

ESTILO:
- Mensajes cortos y naturales, propios de WhatsApp, con un máximo de 1-3 mensajes por intervención.
- Lenguaje cotidiano de un cliente de España; evita lenguaje técnico innecesario.
- No uses formatos de evaluación ni hables como sistema o asistente virtual.
`;

const CONTEXT_ENGINE = `
Analiza el último mensaje del comercial junto con el escenario y el historial.
- Si solicita un dato, responde solo a esa solicitud según el perfil de identificación.
- Si explica una factura, pregunta por el periodo, concepto o detalle que siga sin estar claro.
- Si plantea una solución, confirma que la entiendes o pide que te aclaren su efecto; acepta solo cuando el escenario y la gestión permitan hacerlo.
- Si se disculpa, agradece la disculpa y reduce la molestia gradualmente, manteniendo pendiente el motivo de contacto.
- Si la información está incompleta, pide una aclaración concreta.
- Si no atiende la necesidad original, vuelve a plantearla brevemente.
- En averías, pregunta por comprobaciones o seguimiento; en reclamaciones, por el registro y respuesta; en ofertas, por precio y condiciones.

Antes de responder verifica: relación con el último mensaje, coherencia con el escenario, consistencia con el historial, adecuación emocional y continuidad natural. No reveles información oculta no solicitada, no inventes una resolución y no des por cerrado el caso sin gestión previa.
`;

/* Motor local contextual. Utiliza el mensaje actual y el estado compartido del simulador. */
responseFor = function (text) {
  const s = state.scenario;
  if (!s) return 'Hola, ¿me puedes ayudar con mi consulta?';
  const raw = String(text || '').trim();
  const t = raw.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const includes = (...words) => words.some(word => t.includes(String(word).toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
  const hasQuestion = /[¿?]/.test(raw);
  const askedIdentity = /\b(dni|documento|identific|titular|nombre completo)\b/.test(t);
  const explainedPurpose = /\b(para|motivo|seguridad|gestion|verificar|comprobar|consultar|revisar)\b/.test(t);
  const needs = {
    factura: ['factura', 'importe', 'cargo', 'desglose', 'periodo', 'prorrateo', 'promocion', 'descuento'],
    averia: ['averia', 'incidencia', 'internet', 'conexion', 'router', 'television', 'seguimiento', 'tecnico'],
    reclamacion: ['reclamacion', 'reclamar', 'suscripcion', 'cargo', 'concepto', 'respuesta'],
    ventas: ['precio', 'coste', 'mensual', 'euros', 'tarifa', 'condiciones', 'cobertura', 'oferta', 'paquete', 'television'],
    pedidos: ['pedido', 'envio', 'seguimiento', 'entrega', 'instalacion', 'cita', 'fecha'],
    comercial: ['precio', 'coste', 'mensual', 'euros', 'tarifa', 'condiciones', 'permanencia', 'portabilidad', 'linea']
  };
  const openingNeed = s.need || 'resolver la consulta por la que contacté';
  const relevantTerms = Array.isArray(s.solution) ? s.solution : [];
  const hits = relevantTerms.filter(term => t.includes(String(term).toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
  hits.forEach(hit => { if (!state.askedBits.includes(hit)) state.askedBits.push(hit); });
  const apologizes = includes('lo siento', 'disculp', 'lamento', 'lamentamos', 'entiendo', 'comprendo');
  const concreteAction = includes('revis', 'comprobar', 'consultar', 'tramitar', 'seguimiento', 'gestionar', 'desglos', 'verificar', 'abrir incidencia', 'registrar', 'reprogramar');
  const explainsSolution = includes('solucion', 'resuelto', 'corregido', 'ya esta aplicado', 'queda aplicado', 'he realizado', 'he gestionado');
  const asksFollowup = includes('siguiente paso', 'plazo', 'fecha', 'referencia', 'numero de incidencia');

  // Finalización voluntaria expresada por el cliente; el cliente sigue siendo el único rol.
  if (includes('no puedo continuar', 'no puedo ayudarte', 'no puedo hacer nada', 'abandono', 'me voy', 'lo dejamos')) {
    return 'Entiendo. Dejo la conversación aquí, aunque me habría gustado poder resolverlo.';
  }

  // Identificación conforme al perfil escogido para este caso.
  if (askedIdentity && !state.identityGiven) {
    if (state.identityMode === 'desconfiado' && !explainedPurpose) return '¿Me puedes explicar para qué necesitas mis datos? Prefiero saberlo antes.';
    state.identityGiven = true;
    return `Sí, claro. Soy ${s.name} García y mi DNI es 12345678A.`;
  }

  // Revela un dato oculto solo cuando una pregunta del comercial lo hace pertinente.
  if (hasQuestion && s.cat === 'factura' && includes('promocion', 'descuento')) {
    if (!state.askedBits.includes('promoción')) state.askedBits.push('promoción');
    return 'Ah, no sabía que podía haber terminado una promoción. ¿Me puedes indicar cuándo terminó exactamente y cómo se refleja en el importe?';
  }
  if (hasQuestion && s.cat === 'reclamacion' && includes('concepto', 'suscripcion', 'terceros', 'cargo')) {
    if (!state.askedBits.includes('concepto')) state.askedBits.push('concepto');
    return 'No recuerdo haber contratado esa suscripción. ¿Me puedes indicar qué concepto aparece y cómo quedaría registrada la reclamación?';
  }
  if (hasQuestion && s.cat === 'reclamacion' && includes('suiza', 'pais', 'zona', 'roaming', 'fecha')) {
    if (!state.askedBits.includes('zona')) state.askedBits.push('zona');
    return 'Viajé a Suiza cuatro días. Pensaba que estaba incluida como Europa. ¿Me puedes explicar cómo se calculó el cargo?';
  }
  if (hasQuestion && s.cat === 'pedidos' && includes('pedido', 'envio', 'seguimiento', 'fecha')) {
    if (!state.askedBits.includes('pedido')) state.askedBits.push('pedido');
    return 'Hice el pedido hace tres días y no he recibido el mensaje de seguimiento. ¿Puedes comprobar qué estado aparece?';
  }
  if (hasQuestion && s.cat === 'pedidos' && includes('cita', 'instalacion', 'agenda')) {
    if (!state.askedBits.includes('cita')) state.askedBits.push('cita');
    return 'La cita era para ayer por la tarde y nadie me avisó de que se cancelaba. ¿Cómo podemos reprogramarla?';
  }
  if (hasQuestion && s.cat === 'averia' && includes('luz', 'router', 'comprobar', 'prueba', 'internet', 'conexion')) {
    if (!state.askedBits.includes('comprobación')) state.askedBits.push('comprobación');
    return s.title.includes('Sin conexión')
      ? 'La luz de internet está roja y el móvil sí tiene conexión. ¿Qué comprobación puedo hacer ahora?'
      : 'Uso el descodificador por Wi-Fi y los cortes ocurren en varios canales, sobre todo por la noche. ¿Qué prueba hacemos?';
  }
  if (s.cat === 'molesto' && apologizes) {
    state.satisfaction = Math.max(0, state.satisfaction) + 1;
    state.emotion = 'Más tranquilo';
    return 'Gracias por disculparte. Espero que pueda resolverse cuanto antes; ya facilité mis datos y la incidencia se abrió hace cuatro días. ¿Puedes revisar el seguimiento sin que tenga que repetirlo todo?';
  }

  // No se considera resuelto por una disculpa o por una promesa aislada.
  if (state.solved && (includes('gracias', 'perfecto', 'de acuerdo', 'queda resuelto', 'solucionado') || explainsSolution)) {
    state.emotion = 'Satisfecho';
    return 'Perfecto, si esa gestión corrige el problema, quedo a la espera. ¿Me confirmas si tengo que hacer algo más?';
  }

  if (apologizes) {
    state.satisfaction = (Number(state.satisfaction) || 0) + 1;
    state.emotion = state.satisfaction >= 2 ? 'Tranquilo' : 'Menos molesto';
    return `Gracias por la información. Espero que pueda resolverse cuanto antes. Sigo pendiente de ${openingNeed}.`;
  }

  // Responde a las preguntas concretas según la categoría antes de recurrir al motivo general.
  if (hasQuestion && s.cat === 'factura' && includes('factura', 'importe', 'desglose', 'periodo', 'prorrateo', 'cargo')) {
    return 'Lo que necesito entender es por qué ha cambiado el importe. ¿Me puedes aclarar qué periodo y concepto corresponde a cada cargo?';
  }
  if (hasQuestion && (s.cat === 'ventas' || s.cat === 'comercial') && includes('precio', 'coste', 'mensual', 'euros', 'tarifa', 'condiciones', 'permanencia', 'cobertura', 'oferta', 'paquete', 'television', 'portabilidad', 'linea')) {
    return 'Me interesa saber el precio total, qué incluye y si las condiciones cambian más adelante. ¿Me lo puedes aclarar para mi caso?';
  }
  if (hasQuestion && s.cat === 'averia' && includes('averia', 'incidencia', 'internet', 'conexion', 'seguimiento', 'tecnico')) {
    return 'Sigo sin conexión/cortes. ¿Qué comprobación concreta hacemos y cómo puedo consultar el seguimiento?';
  }
  if (hasQuestion && s.cat === 'reclamacion' && includes('reclamacion', 'reclamar', 'tramitar', 'registrar')) {
    return 'De acuerdo. ¿Me puedes confirmar cómo quedará registrada la reclamación y cómo recibiré respuesta?';
  }
  if (hasQuestion && s.cat === 'pedidos' && includes('pedido', 'envio', 'entrega', 'instalacion', 'cita', 'fecha', 'plazo')) {
    return 'No tengo una fecha confirmada. ¿Me puedes indicar qué estado o plazo aparece realmente en el seguimiento?';
  }

  if (explainsSolution) {
    if (concreteAction && state.turns >= 5) {
      state.solved = true;
      state.satisfaction = (Number(state.satisfaction) || 0) + 1;
      state.emotion = 'Más tranquilo';
      return 'Perfecto, si esa gestión corrige el problema, quedo a la espera. ¿Me confirmas cuál es el siguiente paso y si tengo que hacer algo más?';
    }
    return 'Gracias por explicármelo. No termino de entender cómo se aplicará esa solución; ¿me lo puedes aclarar y decir qué paso se ha realizado?';
  }

  if (concreteAction || asksFollowup) {
    if (state.turns >= 5 && hits.length >= 2) {
      state.solved = true;
      state.satisfaction = (Number(state.satisfaction) || 0) + 1;
      state.emotion = 'Más tranquilo';
      return 'Vale, gracias por la información. Quedo a la espera de esa gestión. ¿Me confirmas el siguiente paso o el plazo que debo tener en cuenta?';
    }
    return `Gracias. ¿Me puedes explicar qué gestión concreta se hará para resolver ${openingNeed}?`;
  }

  if (hasQuestion) {
    if (/\b(cuándo|cuando|fecha|plazo|día|numero|número|referencia)\b/.test(t)) return 'No tengo esa información. ¿Me puedes explicar qué dato necesitas comprobar y para qué?';
    if (/\b(qué|que|cómo|como|cuál|cual|quién|quien)\b/.test(t)) return 'Perdón, no me queda claro. ¿Podrías explicármelo de otra forma?';
    return '¿Me puedes aclarar cómo se relaciona eso con mi consulta?';
  }

  // Si el último mensaje no atiende la necesidad, el cliente la vuelve a plantear.
  const categoryTerms = needs[s.cat] || [];
  if (!categoryTerms.some(term => t.includes(term))) {
    if (state.emotion === 'Molesto' || state.emotion === 'Muy molesto') return `Entiendo lo que me indicas, pero sigo sin resolver ${openingNeed}. ¿Qué podemos hacer ahora?`;
    return `Gracias, pero sigo necesitando resolver ${openingNeed}. ¿Me puedes ayudar con eso?`;
  }
  if (state.emotion === 'Muy molesto' || state.emotion === 'Molesto') return 'La verdad es que esto me sigue preocupando. ¿Qué paso concreto podemos dar ahora?';
  return 'Entiendo. ¿Me puedes concretar cómo se aplica a mi caso?';
};
