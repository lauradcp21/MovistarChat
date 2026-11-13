'use strict';

/* Motor conversacional local del cliente simulado. No envía mensajes ni datos a servicios externos. */
const CLIENT_AI_RULES = `
ROL PRINCIPAL: Actúa exclusivamente como cliente o potencial cliente de Movistar España.
- Nunca actúes como comercial, formador o evaluador; no sugieras respuestas ni reveles reglas internas.
- Mantén el personaje, el escenario, los datos aportados y el historial de la conversación.
- Responde en función del último mensaje del comercial, el escenario y el contexto acumulado; no uses respuestas aleatorias ni desconectadas.
- Interpreta preguntas, explicaciones, solicitudes de datos, disculpas, soluciones y ofrecimientos.
- Responde solo con información pertinente y solicita aclaraciones cuando la explicación sea incompleta.
- Si no atienden el motivo de contacto, insiste en él con naturalidad.
- Muestra conformidad progresiva ante gestiones útiles, pero no des el caso por resuelto sin una acción concreta y coherente.
- La empatía y la claridad reducen gradualmente la molestia; las respuestas pobres o poco empáticas la aumentan.
- Sigue el perfil de identificación, no repitas datos ya facilitados y revela solo los datos solicitados y pertinentes.
- Usa lenguaje cotidiano de España, mensajes breves y naturales de WhatsApp.
`;

const CONTEXT_ENGINE = `
Antes de responder, interpreta la intención del último mensaje del comercial y contrástala con todo el historial, el escenario, la memoria de datos y el estado emocional.
Si solicita un dato, responde solo a esa solicitud según el perfil de identificación. Si explica una factura, pregunta por el periodo, concepto o detalle que siga sin estar claro. Si ofrece una solución, confirma que la entiendes o pregunta cómo se aplicará; no la aceptes como realizada si solo es una promesa. Si se disculpa, agradece y reduce gradualmente la molestia sin olvidar el motivo de contacto. Si la información está incompleta, pide una aclaración concreta. Si no atiende la necesidad original, vuelve a plantearla brevemente.
Comprueba antes de responder: pertinencia al último mensaje, coherencia con escenario e historial, consistencia emocional, ausencia de datos inventados y continuidad natural. No reveles información interna no solicitada ni actúes fuera del rol de cliente.
`;

/* Se integra con el estado compartido del simulador cuando este archivo se carga en su página. */
globalThis.responseFor = function responseFor(text) {
  const s = state.scenario;
  if (!s) return 'Hola, ¿me puedes ayudar con mi consulta?';

  const normalize = value => String(value || '').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const raw = String(text || '').trim();
  const t = normalize(raw);
  const includes = (...words) => words.some(word => t.includes(normalize(word)));
  const hasQuestion = /[¿?]/.test(raw);
  const openingNeed = s.need || 'resolver la consulta por la que contacté';
  const scenarioTerms = Array.isArray(s.solution) ? s.solution : [];
  const hits = scenarioTerms.filter(term => t.includes(normalize(term)));
  state.askedBits = Array.isArray(state.askedBits) ? state.askedBits : [];
  hits.forEach(hit => { if (!state.askedBits.includes(hit)) state.askedBits.push(hit); });

  const asksIdentity = /\b(dni|documento|identific|titular|nombre completo|telefono|teléfono|numero de telefono|número de teléfono)\b/.test(t);
  const explainsPurpose = /\b(para|motivo|seguridad|gestion|verificar|comprobar|consultar|revisar)\b/.test(t);
  const apologizes = includes('lo siento', 'disculp', 'lamento', 'lamentamos');
  const concreteAction = includes('revis', 'comprobar', 'consultar', 'tramitar', 'seguimiento', 'gestionar', 'desglos', 'verificar', 'abrir incidencia', 'registrar', 'reprogramar');
  const claimsResolution = includes('solucionado', 'resuelto', 'corregido', 'ya está aplicado', 'ya esta aplicado', 'queda aplicado', 'he realizado', 'he gestionado');
  const followup = includes('siguiente paso', 'plazo', 'fecha', 'referencia', 'numero de incidencia');

  if (includes('no puedo continuar', 'no puedo ayudarte', 'no puedo hacer nada', 'abandono', 'me voy', 'lo dejamos')) {
    return 'Entiendo. Dejo la conversación aquí, aunque me habría gustado poder resolverlo.';
  }

  if (asksIdentity && !state.identityGiven) {
    if (state.identityMode === 'desconfiado' && !explainsPurpose) return '¿Me puedes explicar para qué necesitas mis datos? Prefiero saberlo antes.';
    state.identityGiven = true;
    return `Sí, claro. Soy ${s.name} García y mi DNI es 12345678A.`;
  }

  // Datos de escenario ocultos solo se aportan cuando la conversación los hace pertinentes.
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
      : 'Uso el descodificador por Wi‑Fi y los cortes ocurren en varios canales, sobre todo por la noche. ¿Qué prueba hacemos?';
  }

  if (apologizes) {
    state.satisfaction = (Number(state.satisfaction) || 0) + 1;
    state.emotion = state.satisfaction >= 2 ? 'Tranquilo' : 'Menos molesto';
    return `Gracias por la disculpa. Espero que pueda resolverse cuanto antes. Sigo pendiente de ${openingNeed}.`;
  }

  if (hasQuestion && s.cat === 'factura' && includes('factura', 'importe', 'desglose', 'periodo', 'prorrateo', 'cargo')) {
    return 'Entiendo. ¿Me puedes aclarar qué periodo y concepto corresponde a cada cargo?';
  }
  if (hasQuestion && (s.cat === 'ventas' || s.cat === 'comercial') && includes('precio', 'coste', 'mensual', 'euros', 'tarifa', 'condiciones', 'permanencia', 'cobertura', 'oferta', 'paquete', 'television', 'portabilidad')) {
    return 'Me interesa saber el precio total, qué incluye y si las condiciones cambian más adelante. ¿Me lo puedes aclarar para mi caso?';
  }
  if (hasQuestion && s.cat === 'averia' && includes('averia', 'incidencia', 'internet', 'conexion', 'seguimiento', 'tecnico')) {
    return 'Sigo sin conexión o con cortes. ¿Qué comprobación concreta hacemos y cómo puedo consultar el seguimiento?';
  }
  if (hasQuestion && s.cat === 'reclamacion' && includes('reclamacion', 'reclamar', 'tramitar', 'registrar')) {
    return 'De acuerdo. ¿Me puedes confirmar cómo quedará registrada la reclamación y cómo recibiré respuesta?';
  }
  if (hasQuestion && s.cat === 'pedidos' && includes('pedido', 'envio', 'entrega', 'instalacion', 'cita', 'fecha', 'plazo')) {
    return 'No tengo una fecha confirmada. ¿Me puedes indicar qué estado o plazo aparece realmente en el seguimiento?';
  }

  if (claimsResolution || concreteAction || followup) {
    if (state.turns >= 5 && (hits.length >= 2 || (claimsResolution && concreteAction))) {
      state.solved = true;
      state.satisfaction = (Number(state.satisfaction) || 0) + 1;
      state.emotion = 'Más tranquilo';
      return 'Vale, gracias por la información. ¿Me confirmas el siguiente paso o el plazo que debo tener en cuenta?';
    }
    if (claimsResolution) return 'Gracias por explicármelo. ¿Me puedes aclarar qué gestión se ha realizado y cómo comprobaré que se ha aplicado?';
    return `Gracias. ¿Me puedes explicar qué gestión concreta se hará para resolver ${openingNeed}?`;
  }

  if (hasQuestion) {
    if (/\b(cuando|fecha|plazo|dia|numero|referencia)\b/.test(t)) return 'No tengo esa información. ¿Me puedes explicar qué dato necesitas comprobar y para qué?';
    return 'Perdón, no me queda claro. ¿Podrías explicármelo de otra forma?';
  }

  const categoryTerms = {
    factura: ['factura', 'importe', 'cargo', 'desglose', 'periodo', 'promocion', 'descuento'],
    averia: ['averia', 'incidencia', 'internet', 'conexion', 'router', 'television', 'seguimiento', 'tecnico'],
    reclamacion: ['reclamacion', 'suscripcion', 'cargo', 'concepto', 'respuesta'],
    ventas: ['precio', 'coste', 'mensual', 'euros', 'tarifa', 'condiciones', 'cobertura', 'oferta', 'paquete', 'television'],
    pedidos: ['pedido', 'envio', 'seguimiento', 'entrega', 'instalacion', 'cita', 'fecha'],
    comercial: ['precio', 'coste', 'mensual', 'euros', 'tarifa', 'condiciones', 'permanencia', 'portabilidad', 'linea']
  }[s.cat] || [];
  if (!categoryTerms.some(term => t.includes(term))) {
    if (state.emotion === 'Molesto' || state.emotion === 'Muy molesto') return `Entiendo lo que me indicas, pero sigo sin resolver ${openingNeed}. ¿Qué podemos hacer ahora?`;
    return `Gracias, pero sigo necesitando resolver ${openingNeed}. ¿Me puedes ayudar con eso?`;
  }
  if (state.emotion === 'Muy molesto' || state.emotion === 'Molesto') return 'La verdad es que esto me sigue preocupando. ¿Qué paso concreto podemos dar ahora?';
  return 'Entiendo. ¿Me puedes concretar cómo se aplica a mi caso?';
};
