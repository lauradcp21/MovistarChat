'use strict';

/* Contratos y validadores de dominio para el simulador estático.
 * Este módulo valida payloads localmente; no crea un servidor HTTP ni endpoints reales.
 */
(function attachMovistarConversationContracts(root) {
  const INTENTS = Object.freeze([
    'identificacion', 'consulta', 'explicacion', 'resolucion', 'reclamacion',
    'venta', 'oferta', 'averia', 'seguimiento', 'cierre', 'despedida'
  ]);
  const CONVERSATION_STATES = Object.freeze([
    'GREETING', 'IDENTIFICATION', 'INVESTIGATION', 'EXPLANATION',
    'RESOLUTION', 'FOLLOW_UP', 'CLOSING', 'FINISHED', 'NEW_INQUIRY'
  ]);
  const EMOTIONAL_STATES = Object.freeze([
    'CALM', 'INTERESTED', 'CONFUSED', 'IMPATIENT', 'ANNOYED', 'VERY_ANNOYED', 'SATISFIED'
  ]);
  const PROFILE_TYPES = Object.freeze(['COLLABORATIVE', 'NEUTRAL', 'DISTRUSTFUL']);
  const SCENARIO_CATEGORIES = Object.freeze([
    'SALES', 'BILLING', 'COMPLAINT', 'ORDER', 'OUTAGE', 'PORTABILITY', 'RETENTION', 'UPSET', 'GENERAL'
  ]);
  const DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard', 'expert']);
  const ALLOWED_STATES = Object.freeze({
    GREETING: ['IDENTIFICATION'],
    IDENTIFICATION: ['INVESTIGATION'],
    INVESTIGATION: ['EXPLANATION'],
    EXPLANATION: ['RESOLUTION'],
    RESOLUTION: ['FOLLOW_UP', 'NEW_INQUIRY'],
    FOLLOW_UP: ['CLOSING'],
    CLOSING: ['FINISHED'],
    NEW_INQUIRY: ['INVESTIGATION'],
    FINISHED: []
  });
  const ALLOWED_EMOTIONS = Object.freeze({
    CALM: ['INTERESTED', 'CONFUSED'],
    INTERESTED: ['SATISFIED', 'CONFUSED'],
    CONFUSED: ['INTERESTED', 'IMPATIENT'],
    IMPATIENT: ['ANNOYED'],
    ANNOYED: ['VERY_ANNOYED'],
    VERY_ANNOYED: ['ANNOYED', 'SATISFIED'],
    SATISFIED: ['CLOSING']
  });
  const ERROR = Object.freeze({
    EMPTY_MESSAGE: 'EMPTY_MESSAGE',
    MESSAGE_TOO_SHORT: 'MESSAGE_TOO_SHORT',
    MESSAGE_TOO_LONG: 'MESSAGE_TOO_LONG',
    UNSAFE_CONTENT: 'UNSAFE_CONTENT',
    DUPLICATED_MESSAGE: 'DUPLICATED_MESSAGE',
    INVALID_PAYLOAD: 'INVALID_PAYLOAD',
    INVALID_STATE: 'INVALID_STATE',
    INVALID_EMOTION: 'INVALID_EMOTION',
    INVALID_INTENT: 'INVALID_INTENT',
    OUT_OF_CONTEXT: 'OUT_OF_CONTEXT',
    INVALID_CLOSURE: 'INVALID_CLOSURE'
  });

  class ContractError extends Error {
    constructor(code, message) {
      super(message || code);
      this.name = 'ContractError';
      this.code = code;
    }
  }

  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const nonEmptyString = value => typeof value === 'string' && value.trim().length > 0;
  const normalize = value => String(value || '').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const words = value => new Set(normalize(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean));

  function assert(condition, code, message) {
    if (!condition) throw new ContractError(code, message);
  }

  function validateStartRequest(payload) {
    assert(isRecord(payload), ERROR.INVALID_PAYLOAD, 'El cuerpo de inicio debe ser un objeto JSON.');
    assert(nonEmptyString(payload.userId), ERROR.INVALID_PAYLOAD, 'userId es obligatorio y no puede estar vacío.');
    assert(['random', 'specific'].includes(payload.scenarioType), ERROR.INVALID_PAYLOAD, 'scenarioType debe ser random o specific.');
    assert(DIFFICULTIES.includes(payload.difficulty), ERROR.INVALID_PAYLOAD, 'difficulty no es válido.');
    assert(payload.channel === 'whatsapp', ERROR.INVALID_PAYLOAD, 'channel debe ser whatsapp.');
    if (payload.scenarioType === 'specific') assert(nonEmptyString(payload.scenarioId), ERROR.INVALID_PAYLOAD, 'scenarioId es obligatorio para un escenario específico.');
    return { userId: payload.userId.trim(), scenarioType: payload.scenarioType, difficulty: payload.difficulty, channel: payload.channel, ...(payload.scenarioId ? { scenarioId: payload.scenarioId.trim() } : {}) };
  }

  function validateMessageRequest(payload) {
    assert(isRecord(payload), ERROR.INVALID_PAYLOAD, 'El cuerpo del mensaje debe ser un objeto JSON.');
    assert(nonEmptyString(payload.conversationId), ERROR.INVALID_PAYLOAD, 'conversationId es obligatorio.');
    assert(typeof payload.message === 'string', ERROR.EMPTY_MESSAGE, 'message debe ser texto.');
    const message = payload.message.trim();
    assert(message.length > 0, ERROR.EMPTY_MESSAGE, 'El mensaje no puede estar vacío.');
    assert(message.length >= 2, ERROR.MESSAGE_TOO_SHORT, 'El mensaje debe tener al menos 2 caracteres.');
    assert(message.length <= 5000, ERROR.MESSAGE_TOO_LONG, 'El mensaje no puede superar 5000 caracteres.');
    assert(!/<\s*(script|iframe|object|embed)\b/i.test(message), ERROR.UNSAFE_CONTENT, 'El mensaje contiene etiquetas HTML no permitidas.');
    assert(typeof payload.timestamp === 'undefined' || !Number.isNaN(Date.parse(payload.timestamp)), ERROR.INVALID_PAYLOAD, 'timestamp debe ser una fecha válida.');
    return { conversationId: payload.conversationId.trim(), message, timestamp: payload.timestamp || new Date().toISOString() };
  }

  function validateAiRequest(payload) {
    assert(isRecord(payload), ERROR.INVALID_PAYLOAD, 'El cuerpo de respuesta IA debe ser un objeto JSON.');
    assert(nonEmptyString(payload.conversationId), ERROR.INVALID_PAYLOAD, 'conversationId es obligatorio.');
    assert(nonEmptyString(payload.commercialMessage), ERROR.EMPTY_MESSAGE, 'commercialMessage es obligatorio.');
    assert(CONVERSATION_STATES.includes(payload.state), ERROR.INVALID_STATE, 'state no es válido.');
    assert(EMOTIONAL_STATES.includes(payload.emotion), ERROR.INVALID_EMOTION, 'emotion no es válido.');
    return { conversationId: payload.conversationId.trim(), commercialMessage: payload.commercialMessage.trim(), state: payload.state, emotion: payload.emotion };
  }

  function createConversation({ id, scenarioId, currentState = 'GREETING', emotionState = 'CALM', startDate = new Date().toISOString(), messages = [] }) {
    assert(nonEmptyString(id) && nonEmptyString(scenarioId), ERROR.INVALID_PAYLOAD, 'Conversation id y scenarioId son obligatorios.');
    assert(CONVERSATION_STATES.includes(currentState), ERROR.INVALID_STATE, 'Estado de conversación no válido.');
    assert(EMOTIONAL_STATES.includes(emotionState), ERROR.INVALID_EMOTION, 'Estado emocional no válido.');
    assert(Array.isArray(messages), ERROR.INVALID_PAYLOAD, 'messages debe ser una lista.');
    return { id, scenarioId, currentState, emotionState, startDate, messages: messages.slice(), ...(currentState === 'FINISHED' ? { endDate: new Date().toISOString() } : {}) };
  }

  function createMessage({ id, sender, text, timestamp = new Date().toISOString(), intent, stateSnapshot, emotionSnapshot }) {
    assert(nonEmptyString(id) && ['COMMERCIAL', 'CLIENT'].includes(sender) && nonEmptyString(text), ERROR.INVALID_PAYLOAD, 'Message requiere id, sender y text válidos.');
    assert(INTENTS.includes(intent), ERROR.INVALID_INTENT, 'La intención del mensaje no es válida.');
    assert(CONVERSATION_STATES.includes(stateSnapshot), ERROR.INVALID_STATE, 'stateSnapshot no es válido.');
    assert(EMOTIONAL_STATES.includes(emotionSnapshot), ERROR.INVALID_EMOTION, 'emotionSnapshot no es válido.');
    return { id, sender, text, timestamp, intent, stateSnapshot, emotionSnapshot };
  }

  function createCustomer({ id, name, surname, dni, phone, profileType, emotionalState = 'CALM' }) {
    assert(nonEmptyString(id), ERROR.INVALID_PAYLOAD, 'Customer id es obligatorio.');
    assert(PROFILE_TYPES.includes(profileType), ERROR.INVALID_PAYLOAD, 'profileType no es válido.');
    assert(EMOTIONAL_STATES.includes(emotionalState), ERROR.INVALID_EMOTION, 'emotionalState no es válido.');
    return { id, ...(name ? { name } : {}), ...(surname ? { surname } : {}), ...(dni ? { dni } : {}), ...(phone ? { phone } : {}), profileType, emotionalState };
  }

  function createScenario({ id, category, difficulty, title, description, hiddenInformation = [] }) {
    assert(nonEmptyString(id) && SCENARIO_CATEGORIES.includes(category) && DIFFICULTIES.includes(difficulty), ERROR.INVALID_PAYLOAD, 'Scenario id, category o difficulty no válidos.');
    assert(nonEmptyString(title) && nonEmptyString(description) && Array.isArray(hiddenInformation), ERROR.INVALID_PAYLOAD, 'Scenario requiere title, description y hiddenInformation válidos.');
    return { id, category, difficulty, title, description, hiddenInformation: hiddenInformation.slice() };
  }

  function validateTransition(current, next) {
    assert(CONVERSATION_STATES.includes(current) && CONVERSATION_STATES.includes(next), ERROR.INVALID_STATE, 'Estado desconocido.');
    assert((ALLOWED_STATES[current] || []).includes(next), ERROR.INVALID_STATE, `Transición no permitida: ${current} → ${next}.`);
    return true;
  }

  function validateEmotionTransition(current, next, event = '') {
    assert(EMOTIONAL_STATES.includes(current) && (EMOTIONAL_STATES.includes(next) || next === 'CLOSING'), ERROR.INVALID_EMOTION, 'Estado emocional desconocido.');
    if (current === next) return true;
    const directAllowed = (ALLOWED_EMOTIONS[current] || []).includes(next);
    const severeEvent = /insulto|amenaza|trato irrespetuoso|respuesta agresiva/i.test(event);
    assert(directAllowed || (current === 'CALM' && next === 'ANNOYED' && severeEvent), ERROR.INVALID_EMOTION, `Transición emocional no permitida: ${current} → ${next}.`);
    return true;
  }

  function similarityScore(left, right) {
    const a = words(left);
    const b = words(right);
    if (!a.size && !b.size) return 1;
    let intersection = 0;
    a.forEach(word => { if (b.has(word)) intersection += 1; });
    return intersection / (a.size + b.size - intersection);
  }

  function validateNoDuplicateMessage(currentMessage, messages = []) {
    const current = normalize(currentMessage);
    assert(current.length > 0, ERROR.EMPTY_MESSAGE, 'El mensaje no puede estar vacío.');
    const previous = messages[messages.length - 1];
    const previousText = typeof previous === 'string' ? previous : previous && (previous.text || previous.content);
    assert(!previousText || normalize(previousText) !== current, ERROR.DUPLICATED_MESSAGE, 'No se permiten mensajes duplicados consecutivos.');
    return true;
  }

  function validateQuestionRepetition(candidate, messages = [], limit = 3) {
    const candidateText = normalize(candidate);
    if (!candidateText.includes('?')) return true;
    const matching = messages.filter(message => {
      const text = typeof message === 'string' ? message : message && (message.text || message.content);
      return text && normalize(text).includes('?') && similarityScore(text, candidate) >= 0.8;
    }).length;
    assert(matching <= limit, ERROR.OUT_OF_CONTEXT, 'La pregunta repetida supera el límite permitido.');
    return true;
  }

  function validateContext(candidate, conversationMessages = [], threshold = 0.08) {
    const candidateWords = words(candidate);
    const contextWords = new Set(conversationMessages.flatMap(message => {
      const text = typeof message === 'string' ? message : message && (message.text || message.content);
      return text ? [...words(text)] : [];
    }));
    if (!contextWords.size || !candidateWords.size) return true;
    const overlap = [...candidateWords].filter(word => contextWords.has(word)).length / candidateWords.size;
    assert(overlap >= threshold, ERROR.OUT_OF_CONTEXT, 'La respuesta no guarda relación suficiente con la conversación.');
    return true;
  }

  function validateIntent(intent) {
    assert(INTENTS.includes(intent), ERROR.INVALID_INTENT, 'La intención detectada no es válida.');
    return true;
  }

  function validateClosure({ identifiedCustomer, mainQuestionResolved, pendingQuestions, currentState }) {
    if (currentState !== 'FINISHED') return true;
    assert(identifiedCustomer === true && mainQuestionResolved === true && Number(pendingQuestions) === 0, ERROR.INVALID_CLOSURE, 'Solo se puede cerrar si el cliente está identificado, el motivo principal resuelto y no quedan preguntas pendientes.');
    validateTransition('CLOSING', 'FINISHED');
    return true;
  }

  function validateGeneratedResponse(candidate, context = {}) {
    const messages = context.messages || [];
    assert(nonEmptyString(candidate), ERROR.EMPTY_MESSAGE, 'La respuesta generada está vacía.');
    assert(candidate.trim().length >= 2 && candidate.trim().length <= 5000, ERROR.MESSAGE_TOO_LONG, 'La respuesta generada debe tener entre 2 y 5000 caracteres.');
    assert(!/<\s*(script|iframe|object|embed)\b/i.test(candidate), ERROR.UNSAFE_CONTENT, 'La respuesta contiene etiquetas no permitidas.');
    validateIntent(context.intent);
    validateNoDuplicateMessage(candidate, messages.filter(message => (message.sender || message.role) === 'CLIENT' || (message.sender || message.role) === 'customer'));
    validateQuestionRepetition(candidate, messages, 3);
    validateContext(candidate, messages);
    if (context.currentState && context.nextState) validateTransition(context.currentState, context.nextState);
    if (context.emotion && context.nextEmotion) validateEmotionTransition(context.emotion, context.nextEmotion, context.event || '');
    if (context.currentState === 'FINISHED') validateClosure(context);
    return { allowed: true, message: candidate.trim(), intent: context.intent, nextState: context.nextState || context.currentState, emotion: context.nextEmotion || context.emotion };
  }

  const contracts = Object.freeze({
    INTENTS, CONVERSATION_STATES, EMOTIONAL_STATES, PROFILE_TYPES, SCENARIO_CATEGORIES, DIFFICULTIES,
    ALLOWED_STATES, ALLOWED_EMOTIONS, ERROR, ContractError,
    endpoints: Object.freeze({
      start: { method: 'POST', path: '/api/conversations/start', validate: validateStartRequest },
      message: { method: 'POST', path: '/api/conversations/message', validate: validateMessageRequest },
      state: { method: 'GET', path: '/api/conversations/{conversationId}/state' },
      respond: { method: 'POST', path: '/api/ai/respond', validate: validateAiRequest },
      evaluate: { method: 'POST', path: '/api/conversations/evaluate' }
    }),
    validateStartRequest, validateMessageRequest, validateAiRequest,
    createConversation, createMessage, createCustomer, createScenario,
    validateTransition, validateEmotionTransition, similarityScore, validateNoDuplicateMessage,
    validateQuestionRepetition, validateContext, validateIntent, validateClosure, validateGeneratedResponse
  });

  root.MovistarConversationContracts = contracts;
})(typeof globalThis !== 'undefined' ? globalThis : window);
