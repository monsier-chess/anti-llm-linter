import { OllamaProvider } from './OllamaProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';

/**
 * @typedef {{
 *   provider: 'ollama' | 'openai' | 'lmstudio' | 'openrouter' | 'anthropic',
 *   model?: string,
 *   baseURL?: string,
 *   apiKey?: string,
 *   timeoutMs?: number,
 * }} ProviderConfig
 */

/**
 * Create an LLMProvider instance from config.
 * @param {ProviderConfig} config
 * @returns {{ complete(prompt: string): Promise<string> }}
 */
export function createProvider(config) {
  const { provider, ...rest } = config;
  switch (provider) {
    case 'ollama':
      return new OllamaProvider(rest);

    case 'lmstudio':
      return new OpenAIProvider({
        baseURL: rest.baseURL ?? 'http://localhost:1234/v1',
        apiKey: rest.apiKey ?? 'lm-studio',
        ...rest,
      });

    case 'openrouter':
      return new OpenAIProvider({
        baseURL: rest.baseURL ?? 'https://openrouter.ai/api/v1',
        ...rest,
      });

    case 'openai':
      return new OpenAIProvider(rest);

    case 'anthropic':
      return new AnthropicProvider(rest);

    default:
      throw new Error(`Unknown provider: "${provider}". Supported: ollama, openai, lmstudio, openrouter, anthropic`);
  }
}
