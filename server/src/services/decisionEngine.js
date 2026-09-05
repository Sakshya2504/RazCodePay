import OpenAI from 'openai';
import { config } from '../config.js';
import { scoreRecoveryPotential } from '../ai/riskModel.js';

const ACTIONS = ['wait', 'send_payment_reminder', 'request_payment_method_update', 'create_human_task', 'stop_case'];

function localDecision(caseData, allowedActions, now = new Date()) {
  const model = scoreRecoveryPotential(caseData, now);
  const safe = ACTIONS.filter((action) => allowedActions.includes(action));
  const highValue = caseData.amountMinor > 100000;

  let recommendation = 'wait';
  if (safe.includes('create_human_task') && (highValue || model.recoverabilityScore < 0.45)) recommendation = 'create_human_task';
  else if (safe.includes('send_payment_reminder') && model.recoverabilityScore >= 0.58) recommendation = 'send_payment_reminder';
  else if (safe.includes('request_payment_method_update')) recommendation = 'request_payment_method_update';
  else if (safe.includes('stop_case')) recommendation = 'stop_case';

  const reasons = model.signals
    .filter((signal) => signal.direction === 'positive')
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((signal) => `${signal.label.replaceAll(' ', '_')}_positive`);

  return {
    recommendedAction: safe.includes(recommendation) ? recommendation : 'wait',
    channel: recommendation === 'send_payment_reminder' ? 'email' : null,
    confidence: Number(Math.max(0.62, Math.min(0.96, 0.62 + Math.abs(model.recoverabilityScore - 0.5) * 0.65)).toFixed(2)),
    reasonCodes: reasons.length ? reasons : ['policy_bounded_decision'],
    explanation: recommendation === 'create_human_task'
      ? 'The model sees enough value or uncertainty that a human should approve the next step.'
      : recommendation === 'send_payment_reminder'
        ? 'The case has strong recovery signals and customer contact is policy-approved.'
        : 'No customer-facing action is justified yet; the case should wait or be reviewed.',
    source: 'local-model',
    modelVersion: model.modelVersion,
    riskScore: model.riskScore,
    recoverabilityScore: model.recoverabilityScore,
    signals: model.signals,
  };
}

export async function recommendRecoveryAction(caseData, allowedActions) {
  const safe = ACTIONS.filter((action) => allowedActions.includes(action));
  const baseline = localDecision(caseData, safe);

  if (!config.aiApiKey || safe.length === 0) return baseline;

  const client = new OpenAI({ apiKey: config.aiApiKey });
  const context = {
    caseType: caseData.type,
    amountMinor: caseData.amountMinor,
    currency: caseData.currency,
    failureCode: caseData.failureCode,
    failureDescription: caseData.failureDescription,
    attemptCount: caseData.attemptCount,
    consent: caseData.consent,
    riskScore: baseline.riskScore,
    recoverabilityScore: baseline.recoverabilityScore,
    allowedActions: safe,
  };

  try {
    const response = await client.chat.completions.create({
      model: config.aiModel,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a payment recovery analyst. Choose exactly one action from allowedActions. Never invent discounts, payment links, deadlines, or provider operations. Explain the choice using only the supplied facts. Return JSON with recommendedAction, confidence, reasonCodes, and explanation.',
        },
        { role: 'user', content: JSON.stringify(context) },
      ],
    });

    const parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}');
    if (!safe.includes(parsed.recommendedAction)) return baseline;

    return {
      ...baseline,
      recommendedAction: parsed.recommendedAction,
      channel: parsed.recommendedAction === 'send_payment_reminder' ? 'email' : null,
      confidence: Math.min(0.99, Math.max(0, Number(parsed.confidence) || baseline.confidence)),
      reasonCodes: Array.isArray(parsed.reasonCodes) ? parsed.reasonCodes.slice(0, 5) : baseline.reasonCodes,
      explanation: typeof parsed.explanation === 'string' ? parsed.explanation.slice(0, 500) : baseline.explanation,
      source: 'openai-llm',
      modelVersion: config.aiModel,
    };
  } catch (error) {
    console.warn(`LLM unavailable; local model retained: ${error.message}`);
    return baseline;
  }
}
