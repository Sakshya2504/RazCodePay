import OpenAI from 'openai';
import { config } from '../config.js';
import { scoreRecoveryPotential } from '../ai/riskModel.js';

const ACTIONS = ['wait', 'send_payment_reminder', 'create_payment_link', 'request_payment_method_update', 'create_human_task', 'stop_case'];

const ACTION_BY_FAILURE = {
  CUSTOMER_ACTION_REQUIRED: 'request_payment_method_update',
  AUTHENTICATION_ERROR: 'request_payment_method_update',
};

function localDecision(caseData, allowedActions, now = new Date()) {
  const model = scoreRecoveryPotential(caseData, now);
  const safe = ACTIONS.filter((action) => allowedActions.includes(action));
  const amountMinor = Number(caseData.amountMinor || 0);
  const failureCode = caseData.failure?.code || caseData.failureCode;
  const directAction = ACTION_BY_FAILURE[failureCode];
  let recommendation = 'wait';

  if (safe.includes('create_human_task') && (amountMinor > 100000 || model.confidence < 0.65 || model.uncertainty > 0.45)) {
    recommendation = 'create_human_task';
  } else if (directAction && safe.includes(directAction) && model.customerIntent >= 0.75) {
    recommendation = directAction;
  } else if (safe.includes('create_payment_link') && model.recoverabilityScore >= 0.72 && model.expectedRecoveryMinor >= Math.round(amountMinor * 0.45)) {
    recommendation = 'create_payment_link';
  } else if (safe.includes('send_payment_reminder') && model.recoverabilityScore >= 0.58 && model.confidence >= 0.66) {
    recommendation = 'send_payment_reminder';
  } else if (safe.includes('request_payment_method_update') && model.recoverabilityScore >= 0.45) {
    recommendation = 'request_payment_method_update';
  } else if (safe.includes('stop_case') && model.recoverabilityScore < 0.25 && Number(caseData.attemptCount || 0) >= 2) {
    recommendation = 'stop_case';
  }

  const reasons = model.signals
    .filter((signal) => signal.direction === 'positive')
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)
    .map((signal) => `${signal.label.replaceAll(' ', '_')}_positive`);

  return {
    recommendedAction: safe.includes(recommendation) ? recommendation : 'wait',
    channel: ['send_payment_reminder', 'create_payment_link'].includes(recommendation) ? 'email' : null,
    confidence: model.confidence,
    uncertainty: model.uncertainty,
    dataQuality: model.dataQuality,
    expectedRecoveryMinor: model.expectedRecoveryMinor,
    reasonCodes: reasons.length ? reasons : ['policy_bounded_decision'],
    explanation:
      recommendation === 'create_human_task'
        ? 'Value, uncertainty, or model confidence crosses the human-review boundary, so automation stops at an operator decision.'
        : recommendation === 'request_payment_method_update'
          ? 'The failure profile suggests the customer may need to update or re-authorize their payment method before retrying.'
          : recommendation === 'create_payment_link'
            ? 'The model sees strong recovery potential and enough expected recovered value to justify a direct Razorpay payment link.'
            : recommendation === 'send_payment_reminder'
              ? 'Recent, recoverable signals and valid consent make a concise payment reminder the safest next action.'
              : recommendation === 'stop_case'
                ? 'Repeated attempts and low predicted recovery make further automated intervention uneconomic.'
                : 'No customer-facing action is justified yet; policy or timing requires the case to wait or be reviewed.',
    source: 'local-model',
    modelVersion: model.modelVersion,
    riskScore: model.riskScore,
    recoverabilityScore: model.recoverabilityScore,
    signals: model.signals,
    features: model.features,
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
    failureCode: caseData.failure?.code,
    failureDescription: caseData.failure?.description,
    attemptCount: caseData.attemptCount,
    consent: caseData.consent,
    riskScore: baseline.riskScore,
    recoverabilityScore: baseline.recoverabilityScore,
    expectedRecoveryMinor: baseline.expectedRecoveryMinor,
    confidence: baseline.confidence,
    uncertainty: baseline.uncertainty,
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
          content: 'You are a payment recovery analyst. Choose exactly one action from allowedActions. Never invent discounts, payment links, deadlines, provider operations, or customer facts. Do not override policy. Prefer wait or create_human_task when confidence is low or uncertainty is high. Return JSON with recommendedAction, confidence, reasonCodes, and explanation.',
        },
        { role: 'user', content: JSON.stringify(context) },
      ],
    });
    const parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}');
    if (!safe.includes(parsed.recommendedAction)) return baseline;
    return {
      ...baseline,
      recommendedAction: parsed.recommendedAction,
      channel: ['send_payment_reminder', 'create_payment_link'].includes(parsed.recommendedAction) ? 'email' : null,
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
