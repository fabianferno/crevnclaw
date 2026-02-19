import type { LLMProvider, ProviderConfig } from '@crevnclaw/types';
import { BedrockProvider } from './bedrock.js';

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.type) {
    case 'bedrock':
      if (!config.region) {
        throw new Error('Bedrock provider requires a region');
      }
      return new BedrockProvider({
        model: config.model,
        region: config.region,
      });

    case 'anthropic':
      throw new Error('Anthropic direct provider not yet implemented');

    case 'openai':
      throw new Error('OpenAI provider not yet implemented');

    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

export { BedrockProvider } from './bedrock.js';
