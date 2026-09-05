import OpenAI from 'openai';
import { config } from '../config.js';

const ACTIONS = [
  'wait',
  'send_payment_reminder',
  'request_payment_method_update',
  'create_human_task',
  'stop_case',
];

function deterministicDecision(caseData, allowedActions) {
  if (allowedActions.includes('send_payment_reminder') && caseData.consent?.email) {
    return {
      recommendedAction: 'send_payment_reminder',
      channel: 'email',
      templateId: 'payment_recovery_v1',
      reasonCodes: ['recoverable_signal', 'email_consent', 'policy_allowed'],
      confidence: 0.72,
      requiresHumanReview: false,
      source: 'deterministic_fallback',
    };
  }

  if (allowedActions.includes('create_human_task')) {
    return {
      recommendedAction: 'create_human_task',
      channel: null,
      templateId: null,
      reasonCodes: ['automation_boundary_reached'],
      confidence: 0.98,
      requiresHumanReview: true,
      source: 'deterministic_fallback',
    };
  }

  return {
    recommendedAction: 'wait',
    channel: null,
    templateId: null,
    reasonCodes: ['no_contact_action_allowed'],
    confidence: 0.99,
    requiresHumanReview: false,
    source: 'deterministic_fallback',
  };
}

/**
 * AI never gets provider credentials and never executes a side effect. It can
 * only choose from the action set that policy has already approved.
 */
export async function recommendRecoveryAction(caseData, allowedActions) {
  const safeActions = ACTIONS.filter((action) => allowedActions.includes(action));

  if (!config.aiApiKey || safeActions.length === 0) {
    return deterministicDecision(caseData, safeActions);
  }

  const client = new OpenAI({ apiKey: config.aiApiKey });
  const context = {
    type: caseData.type,
    amountMinor: caseData.amountMinor,
    currency: caseData.currency,
    failureCode: caseData.failureCode,
    failureDescription: caseData.failureDescription,
    attemptCount: caseData.attemptCount,
    consent: caseData.consent,
    allowedActions: safeActions,
  };

  try {
    const response = await client.chat.completions.create({
      model: config.aiModel,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a payment recovery decision assistant. Choose only one action from allowedActions. Never invent actions, discounts, payment instructions, deadlines, or provider operations. Return JSON only.',
        },
        {
          role: 'user',
          content: JSON.stringify(context),
        },
      ],
    });

    const raw = response.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(raw);
    const valid = safeActions.includes(parsed.recommendedAction);

    if (!valid) {
      return deterministicDecision(caseData, safeActions);
    }

    return {
      recommendedAction: parsed.recommendedAction,
      channel: parsed.recommendedAction === 'send_payment_reminder' ? 'email' : null,
      templateId: parsed.recommendedAction === 'send_payment_reminder' ? 'payment_recovery_v1' : null,
      reasonCodes: Array.isArray(parsed.reasonCodes) ? parsed.reasonCodes.slice(0, 5) : ['ai_recommendation'],
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      requiresHumanReview: parsed.recommendedAction === 'create_human_task',
      source: 'llm',
    };
  } catch (error) {
    console.warn(`AI decision failed; using deterministic fallback: ${error.message}`);
    return deterministicDecision(caseData, safeActions);
  }
}
