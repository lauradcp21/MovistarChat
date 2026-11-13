'use strict';

/* Instrucciones de rol/contexto para el motor local de respuestas. La app no envía chat a un servicio externo. */
const CLIENT_AI_RULES = `
ROL PRINCIPAL: Actúa exclusivamente como cliente o potencial cliente de Movistar España.
Nunca actúes como comercial, no sugieras respuestas, no evalúes al usuario ni expliques las reglas del juego. Mantén el personaje, el escenario y los datos ya confirmados.
Responde solo a partir del escenario, del historial y del último mensaje del comercial. Si te preguntan, responde naturalmente; ante solicitud de datos, sigue tu perfil de identificación. Pide aclaraciones si algo no se entiende; muestra conformidad gradualmente ante una respuesta útil y frustración ante respuestas pobres o poco empáticas.
Usa mensajes breves y naturales de WhatsApp, lenguaje cotidiano y como máximo 1-3 mensajes por intervención. No uses lenguaje técnico innecesario. No inventes resoluciones ni datos, no cambies de caso, no evalúes ni hables como sistema o asistente virtual.
Estados emocionales: tranquilo, interesado, confundido, preocupado, impaciente, molesto, muy molesto y satisfecho. El tono debe ser coherente con el estado actual.
`;
const CONTEXT_ENGINE = `
Interpreta el último mensaje del comercial en el contexto de la conversación. Responde a solicitudes de datos según el perfil; ante explicaciones de factura plantea dudas relacionadas con el desglose; ante averías pregunta por pruebas o seguimiento; ante reclamaciones pide información del trámite; ante ofertas consulta precio, condiciones o características; ante disculpas reduce gradualmente la molestia; y ante solicitudes de confirmación confirma solo lo que el escenario respalda.
No generes respuestas aleatorias. Cada respuesta debe derivarse del escenario, el historial y el último mensaje. Antes de responder comprueba la pertinencia, coherencia del perfil, emoción e información ya facilitada. No reveles datos internos salvo que el cliente pregunte de forma natural.
`;

// Mantiene el comportamiento en el navegador; no se envían mensajes ni datos a terceros.
responseFor = function (text) {
  const s = state.scenario;
  if (!s) return 'Hola, ¿me puedes ayudar con mi consulta?';
  const raw = String(text || '').trim();
  const t = raw.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const includes = (...words) => words.some(word => t.includes(word.normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
  const askIdentity = /\b(dni|documento|identific|titular|nombre completo)\b/.test(t);
  const reasonGiven = /\b(para|motivo|seguridad|gesti[oó]n|verificar|comprobar|consultar|revisar)\b/.test(t);

  if (/no puedo continuar|no puedo ayudarte|no puedo hacer nada|abandono|me voy|lo dejamos/.test(t)) {
    return 'Entiendo. Dejo la conversación aquí, aunque me habría gustado poder resolverlo.';
  }
  if (askIdentity && !state.identityGiven) {
    if (state.identityMode === 'desconfiado' && !reasonGiven) return '¿Me puedes explicar para qué necesitas mis datos? Prefiero saberlo antes.';
    state.identityGiven = true;
    return `Claro, soy ${s.name} García. Mi DNI es 12345678A. ¿Puedes revisar ya el caso?`;
  }

  const relevantTerms = Array.isArray(s.solution) ? s.solution : [];
  const hits = relevantTerms.filter(term => t.includes(term.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
  hits.forEach(hit => { if (!state.askedBits.includes(hit)) state.askedBits.push(hit); });
  const asksQuestion = /[¿?]/.test(raw);
  const apologizes = includes('lo siento', 'disculp', 'lamento', 'entiendo', 'comprendo');
  const offersAction = includes('revis', 'comprobar', 'consultar', 'tramitar', 'seguimiento', 'gestionar', 'explicar', 'detallar', 'desglos', 'verificar', 'cita', 'prueba', 'paso');
  const thanksOrClose = includes('gracias', 'perfecto', 'de acuerdo', 'queda resuelto', 'solucionado', 'ya está', 'ya esta');

  // Información oculta: se revela solo si el comercial pregunta por el motivo asociado.
  if (s.cat === 'factura' && includes('promocion', 'descuento')) {
    state.askedBits.push('promoción');
    return 'Ah, no sabía que podía haber terminado una promoción. ¿Me puedes indicar en qué periodo se aplicaba y qué importe se ha cobrado?';
  }
  if (s.cat === 'reclamacion' && includes('concepto', 'suscripcion', 'terceros', 'cargo')) {
    state.askedBits.push('concepto');
    return 'No recuerdo haber contratado eso. ¿Podéis comprobar de dónde viene y decirme cómo dejar constancia de la reclamación?';
  }
  if (s.cat === 'reclamacion' && includes('suiza', 'pais', 'país', 'zona', 'roaming', 'fecha')) {
    state.askedBits.push('zona');
    return 'Viajé a Suiza cuatro días. Pensaba que estaba incluida como Europa. ¿Me podéis explicar cómo se ha calculado el cargo?';
  }
  if (s.cat === 'pedidos' && includes('pedido', 'envio', 'envío', 'seguimiento', 'fecha')) {
    state.askedBits.push('pedido');
    return 'Hice el pedido hace tres días y no he recibido el mensaje de seguimiento. ¿Podéis comprobar qué estado aparece?';
  }
  if (s.cat === 'pedidos' && includes('cita', 'instalacion', 'instalación', 'agenda')) {
    state.askedBits.push('cita');
    return 'La cita era para ayer por la tarde y nadie me avisó de que se cancelaba. ¿Cómo podemos reprogramarla?';
  }
  if (s.cat === 'averia' && includes('luz', 'router', 'comprobar', 'prueba', 'internet', 'conex')) {
    state.askedBits.push('router');
    return s.title.includes('Sin conexión')
      ? 'La luz de internet está roja. El móvil sí tiene conexión. ¿Qué comprobación puedo hacer ahora?'
      : 'Uso el descodificador por Wi-Fi y los cortes ocurren en varios canales, sobre todo por la noche. ¿Qué prueba hacemos?';
  }
  if (s.cat === 'molesto' && apologizes) {
    state.satisfaction = Math.max(0, state.satisfaction);
    state.emotion = 'Más tranquilo';
    return 'Gracias por reconocerlo. Ya facilité mis datos y la incidencia se abrió hace cuatro días; ¿puedes revisar el seguimiento sin que tenga que repetirlo todo?';
  }

  if (state.solved && thanksOrClose) return 'Perfecto, muchas gracias por la ayuda. Quedo pendiente de lo que me has indicado.';
  if (state.turns >= 5 && (offersAction || (hits.length >= 2 && !asksQuestion))) {
    state.solved = true;
    state.satisfaction += 1;
    state.emotion = 'Más tranquilo';
    return 'Vale, gracias por explicármelo. ¿Me confirmas cuál es el siguiente paso y si tengo que hacer algo más?';
  }
  if (apologizes) {
    state.satisfaction += 1;
    state.emotion = state.satisfaction >= 2 ? 'Tranquilo' : 'Menos molesto';
    return 'Gracias por disculparte. ¿Me puedes ayudar a revisar qué ha pasado y cómo seguimos?';
  }
  if (includes('precio', 'coste', 'mensual', 'euros', 'tarifa', 'condiciones', 'permanencia', 'cobertura', 'oferta', 'paquete', 'televisión')) {
    state.askedBits.push('condiciones');
    return '¿Me puedes aclarar el precio total, qué incluye y si las condiciones cambian más adelante?';
  }
  if (includes('factura', 'importe', 'desglose', 'periodo', 'prorrateo', 'cargo')) {
    state.askedBits.push('factura');
    return '¿Me puedes desglosar a qué periodo corresponde cada importe y qué concepto ha cambiado?';
  }
  if (includes('avería', 'averia', 'incidencia', 'internet', 'seguimiento', 'técnico', 'tecnico')) {
    state.askedBits.push('seguimiento');
    return apologizes ? 'Gracias por disculparte. ¿Hay alguna referencia o plazo de seguimiento que pueda consultar?' : '¿Me puedes indicar qué comprobación hacemos y cómo puedo consultar el seguimiento?';
  }
  if (includes('reclamación', 'reclamacion', 'reclamar', 'tramitar')) {
    state.askedBits.push('reclamación');
    return 'De acuerdo. ¿Me puedes explicar cómo quedará registrada la reclamación y cómo recibiré respuesta?';
  }
  if (asksQuestion && /cu[aá]ndo|fecha|plazo|d[ií]a/.test(t)) return 'No tengo una fecha concreta. ¿Me puedes indicar qué plazo figura realmente en la gestión?';
  if (asksQuestion && /qu[eé]|c[oó]mo|cu[aá]l/.test(t)) return 'No estoy seguro de haberlo entendido del todo. ¿Me lo puedes explicar con palabras más sencillas?';
  if (state.emotion === 'Muy molesto' || state.emotion === 'Molesto') return 'La verdad es que esto me sigue preocupando. ¿Qué paso concreto podemos dar ahora?';
  if (thanksOrClose) return 'Gracias. ¿Me confirmas qué tengo que esperar ahora?';
  return 'Entiendo. ¿Me puedes concretar cómo se aplica a mi caso?';
};
