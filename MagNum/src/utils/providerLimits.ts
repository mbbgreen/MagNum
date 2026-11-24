import { ModelProvider } from '../types';

export const MODEL_CHAR_LIMITS: Record<ModelProvider, number> = {
  gemini: 250000,
  chatgpt: 65000,
  deepseek: 65000,
};

export const DEFAULT_MODEL_CHAR_LIMIT = 65000;

export function getModelCharLimit(provider?: ModelProvider | string | null): number {
  if (provider && provider in MODEL_CHAR_LIMITS) {
    return MODEL_CHAR_LIMITS[provider as ModelProvider];
  }
  return DEFAULT_MODEL_CHAR_LIMIT;
}

export function getCharCounterThreshold(limit: number): number {
  return Math.floor(limit * 0.9);
}

export function getProviderDisplayName(provider?: ModelProvider | string | null): string {
  if (provider === 'gemini') return 'Gemini';
  if (provider === 'chatgpt') return 'ChatGPT';
  return 'DeepSeek';
}

export function getHigherLimitProviderNames(currentMax: number): string[] {
  return (Object.keys(MODEL_CHAR_LIMITS) as ModelProvider[])
    .filter((p) => MODEL_CHAR_LIMITS[p] > currentMax)
    .map(getProviderDisplayName);
}
