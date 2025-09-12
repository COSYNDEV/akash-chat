export interface Model {
  id: string;
  name: string;
  description?: string;
  available?: boolean;
  temperature?: number;
  top_p?: number;
  tokenLimit?: number;
  owned_by?: string;
  parameters?: string;
  architecture?: string;
  hf_repo?: string;
  aboutContent?: string;
  infoContent?: string;
  thumbnailId?: string;
  deployUrl?: string;
  // Optional field to map to different API model IDs
  apiId?: string;
}

export const models: Model[] = [
  {
    id: 'NousResearch-Hermes-4-405B-FP8',
    name: 'Hermes 4 405B',
    apiId: 'NousResearch/Hermes-4-405B-FP8',
    description: 'Frontier reasoning model with hybrid mode capabilities',
    temperature: 0.6,
    top_p: 0.9,
    tokenLimit: 65536,
    parameters: '405B',
    architecture: 'Llama-3.1-405B with reasoning enhancement',
    hf_repo: 'NousResearch/Hermes-4-405B-FP8',
    aboutContent: `Experience **Hermes 4 405B FP8**, Nous Research's frontier reasoning model built on Llama-3.1-405B. This advanced model features hybrid mode capabilities with deliberation reasoning using <think>...</think> tags, delivering exceptional performance in math, code, STEM, logic, and creative tasks.

Hermes 4 excels in function calling, tool use, schema adherence, and structured JSON outputs while maintaining reduced refusal rates and high steerability. The FP8 quantized version provides efficient deployment without compromising on the model's advanced reasoning capabilities.`,
    infoContent: `
* ⚡ Advanced reasoning with deliberation mode support
* 🧠 Function calling and tool use capabilities
* 🌐 Decentralized hosting for lower costs & full control
* 🔍 Optimized for math, code, STEM, logic, and creative tasks`,
    thumbnailId: 'llama-3',
    deployUrl: 'https://console.akash.network/templates/akash-network-awesome-akash-Hermes-4-405B-FP8'
  },
  {
    id: 'DeepSeek-V3.1',
    name: 'DeepSeek V3.1',
    apiId: 'deepseek-ai/DeepSeek-V3.1',
    description: 'Next-generation reasoning model with enhanced capabilities',
    temperature: 0.6,
    top_p: 0.95,
    tokenLimit: 64000,
    parameters: '685B',
    architecture: 'Mixture-of-Experts',
    hf_repo: 'deepseek-ai/DeepSeek-V3.1',
    aboutContent: `Discover **DeepSeek V3.1**, the latest advancement in DeepSeek's flagship model series. This state-of-the-art 685B parameter Mixture-of-Experts (MoE) architecture delivers exceptional performance across reasoning, coding, mathematics, and general intelligence tasks.

DeepSeek V3.1 features improved training methodologies, enhanced reasoning capabilities, and superior instruction following. With its advanced architecture and extensive knowledge base, it excels at complex problem-solving, creative tasks, and professional applications requiring deep understanding and analytical thinking.`,
    infoContent: `
* ⚡ Cutting-edge DeepSeek V3.1 with 685B parameters
* 🧠 Advanced MoE architecture for superior reasoning and problem-solving
* 🌐 Decentralized hosting for cost-effective, unrestricted access
* 🔍 Optimized for coding, mathematics, reasoning, and creative tasks`,
    thumbnailId: 'deepseek',
    deployUrl: 'https://console.akash.network/templates/akash-network-awesome-akash-DeepSeek-V3.1'
  },
  {
    id: 'openai-gpt-oss-120b',
    name: 'GPT-OSS-120B',
    apiId: 'openai/gpt-oss-120b',
    description: 'Efficient reasoning model with 117B parameters (5.1B active)',
    temperature: 0.6,
    top_p: 0.95,
    tokenLimit: 128000,
    parameters: '117B (5.1B active)',
    architecture: 'Transformer with native MXFP4 quantization',
    hf_repo: 'openai/gpt-oss-120b',
    aboutContent: `Experience **GPT-OSS-120B**, OpenAI's open-source reasoning model with 117B total parameters and 5.1B active parameters. Built with native MXFP4 quantization, this model is designed for powerful reasoning, agentic tasks, and versatile developer use cases.

GPT-OSS-120B features configurable reasoning levels (Low, Medium, High) and supports advanced capabilities like tool use, web browsing, and function calling. Optimized to run efficiently on a single H100 GPU while delivering high-quality reasoning performance.`,
    infoContent: `
* ⚡ Open-source reasoning model with configurable reasoning levels
* 🧠 117B parameters (5.1B active) with native MXFP4 quantization
* 🌐 Decentralized hosting for lower costs & full control
* 🔍 Optimized for reasoning, agentic tasks, and tool use`,
    thumbnailId: 'llama-3',
    deployUrl: 'https://console.akash.network/templates/akash-network-awesome-akash-openai-gpt-oss-120b'
  },
  {
    id: 'Kimi-K2-Instruct',
    name: 'Kimi K2 Instruct',
    description: 'Advanced 1T Mixture-of-Experts model (32B active)',
    temperature: 0.6,
    top_p: 0.95,
    tokenLimit: 128000,
    parameters: '1T (32B active)',
    architecture: 'Mixture-of-Experts (384 experts, 8 activated)',
    hf_repo: 'moonshotai/Kimi-K2-Instruct',
    aboutContent: `Discover **Kimi K2 Instruct**, a next-generation Mixture-of-Experts (MoE) language model with 1 trillion total parameters and 32 billion activated per token. Trained on 15.5T tokens with the Muon optimizer, Kimi K2 achieves exceptional performance in knowledge, reasoning, coding, and agentic tasks. Specifically designed for tool use and autonomous problem-solving, it excels in both chat and agentic experiences.\n\nKimi K2 Instruct features a 128K context window, advanced MLA attention, and robust instruction-following capabilities. It is a top performer on coding, reasoning, and tool-use benchmarks, making it ideal for demanding AI applications.`,
    infoContent: `\n* ⚡ 1T parameter Mixture-of-Experts model (32B active)\n* 🧠 128K context window for extended conversations\n* 🛠️ Optimized for tool use, reasoning, and agentic intelligence\n* 🌐 Open-source, deployable on vLLM, SGLang, KTransformers, TensorRT-LLM\n* 🔍 Top-tier performance in coding, reasoning, and tool-use tasks`,
    thumbnailId: 'llama-3',
  },
  {
    id: 'Qwen3-235B-A22B-FP8',
    name: 'Qwen3 235B A22B',
    description: 'Advanced reasoning model with 235B parameters (22B active)',
    temperature: 0.6,
    top_p: 0.95,
    tokenLimit: 128000,
    parameters: '235B (22B active)',
    architecture: 'Mixture-of-Experts (128 experts)',
    hf_repo: 'Qwen/Qwen3-235B-A22B-FP8',
    aboutContent: `Experience the power of **Qwen3 235B A22B**, a cutting-edge Mixture-of-Experts model with 235B total parameters and 22B active parameters. This advanced model excels in reasoning, instruction-following, and multilingual support, offering seamless switching between thinking and non-thinking modes.

Qwen3 235B A22B delivers superior performance in complex logical reasoning, mathematics, coding, and creative writing, making it ideal for demanding AI applications.`,
    infoContent: `
* ⚡ Instant access to Qwen3 235B A22B with no signup
* 🧠 Supports up to 32K tokens with YaRN scaling up to 131K
* 🌐 Decentralized hosting for lower costs & full control
* 🔍 Optimized for reasoning, coding, and multilingual tasks`,
    thumbnailId: 'llama-3',
    deployUrl: 'https://console.akash.network/templates/akash-network-awesome-akash-Qwen3-235B-A22B-FP8'
  },
  {
    id: 'Qwen3-235B-A22B-Instruct-2507-FP8',
    name: 'Qwen3 235B A22B Instruct 2507',
    apiId: 'Qwen/Qwen3-235B-A22B-Instruct-2507-FP8',
    description: 'Enhanced reasoning and alignment in a non-thinking model',
    temperature: 0.7,
    top_p: 0.8,
    tokenLimit: 262144,
    parameters: '235B (22B active)',
    architecture: 'Mixture-of-Experts (128 experts, 8 activated)',
    hf_repo: 'Qwen/Qwen3-235B-A22B-Instruct-2507-FP8',
    aboutContent: `Experience **Qwen3 235B A22B Instruct 2507**, the enhanced non-thinking mode version of Qwen3 with significant improvements across all capabilities. This updated model features substantial gains in instruction following, logical reasoning, mathematics, science, coding, and tool usage, along with markedly better alignment with user preferences.

With native 262K context length support and enhanced long-context understanding, this model excels in subjective and open-ended tasks, delivering more helpful responses and higher-quality text generation across multiple languages.`,
    infoContent: `
* ⚡ Enhanced non-thinking mode with improved capabilities
* 🧠 Native 262K context length for extended conversations
* 🌐 Decentralized hosting for lower costs & full control
* 🔍 Superior performance in reasoning, coding, and multilingual tasks`,
    thumbnailId: 'llama-3',
    deployUrl: 'https://console.akash.network/templates/akash-network-awesome-akash-Qwen3-235B-A22B-Instruct-2507-FP8'
  },
  {
    id: 'Qwen3-235B-A22B-Thinking-2507-FP8',
    name: 'Qwen3 235B A22B Thinking 2507',
    description: 'Advanced thinking model with enhanced reasoning capabilities',
    temperature: 0.6,
    top_p: 0.95,
    tokenLimit: 262144,
    parameters: '235B (22B active)',
    architecture: 'Mixture-of-Experts (128 experts, 8 activated)',
    hf_repo: 'Qwen/Qwen3-235B-A22B-Thinking-2507-FP8',
    aboutContent: `Experience **Qwen3 235B A22B Thinking 2507 FP8**, the thinking mode version of Qwen3 with state-of-the-art reasoning capabilities. This advanced model features automatic thinking processes using <think> tags, delivering enhanced performance in complex reasoning, mathematics, science, and coding tasks.

With native 262K context length support and improved long-context understanding, this model excels in multi-step problem solving and provides transparent reasoning through its thinking mode, making it ideal for complex analytical tasks.`,
    infoContent: `
* ⚡ Advanced thinking mode with transparent reasoning process
* 🧠 Native 262K context length for extended conversations
* 🌐 Decentralized hosting for lower costs & full control
* 🔍 State-of-the-art performance in reasoning, math, science, and coding`,
    thumbnailId: 'llama-3',
    deployUrl: 'https://console.akash.network/templates/akash-network-awesome-akash-Qwen3-235B-A22B-Thinking-2507-FP8'
  },
  {
    id: 'DeepSeek-R1-0528',
    name: 'DeepSeek R1 0528',
    apiId: 'deepseek-ai/DeepSeek-R1-0528',
    description: 'Strong Mixture-of-Experts (MoE) LLM',
    temperature: 0.6,
    top_p: 0.95,
    tokenLimit: 64000,
    parameters: '671B',
    architecture: 'Mixture-of-Experts',
    hf_repo: 'deepseek-ai/DeepSeek-R1-0528',
    aboutContent: `Experience **DeepSeek R1 0528**, the latest iteration of DeepSeek's groundbreaking reasoning model. This advanced 671B parameter Mixture-of-Experts (MoE) architecture represents a significant leap forward in AI reasoning capabilities, featuring enhanced chain-of-thought processing and superior problem-solving abilities.

The 0528 version introduces refined training techniques and improved reasoning pathways, making it exceptionally powerful for complex analytical tasks, mathematical reasoning, and multi-step problem solving. Built for professionals who demand the highest level of AI performance.`,
    infoContent: `
* ⚡ Latest DeepSeek R1 0528 with enhanced reasoning capabilities
* 🧠 Advanced chain-of-thought processing with 671B parameters
* 🌐 Decentralized hosting for cost-effective, unrestricted access
* 🔍 Optimized for complex reasoning, analysis, and problem-solving tasks`,
    thumbnailId: 'deepseek',
    deployUrl: 'https://console.akash.network/templates/akash-network-awesome-akash-DeepSeek-R1-0528'
  },
  {
    id: 'meta-llama-Llama-4-Maverick-17B-128E-Instruct-FP8',
    name: 'Llama 4 Maverick 17B 128E',
    apiId: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
    description: '400B parameter model (17B active) with 128 experts',
    temperature: 0.6,
    top_p: 0.9,
    tokenLimit: 128000,
    parameters: '400B',
    architecture: 'Mixture-of-Experts (128 experts)',
    hf_repo: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct',
    aboutContent: `Looking to explore Meta's Llama 4 Maverick 17B 128E? AkashChat lets you experience this cutting-edge multimodal language model in real time—no setup required. Powered by a Mixture-of-Experts (MoE) architecture with 128 experts and 17B active parameters per pass, Maverick delivers top-tier performance in reasoning, coding, and multimodal tasks.

AkashChat provides a fast, user-friendly interface to chat with Llama 4 Maverick—leveraging decentralized compute on the Akash Network.`,
    infoContent: `
* ⚡ Instant access to Llama 4 Maverick with no signup
* 🧠 Run on a 1M-token context window with advanced multimodal capabilities
* 🌐 Decentralized hosting for lower costs & full control
* 🔍 Optimized for developers, researchers, and AI enthusiasts`,
    thumbnailId: 'llama-4',
    deployUrl: 'https://console.akash.network/templates/akash-network-awesome-akash-Llama-4-Maverick-17B-128E-Instruct-FP8'
  },
  {
    id: 'nvidia-Llama-3-3-Nemotron-Super-49B-v1',
    name: 'Llama 3.3 Nemotron Super 49B',
    description: 'Great tradeoff between model accuracy and efficiency',
    temperature: 0.6,
    top_p: 0.95,
    tokenLimit: 128000,
    parameters: '49B',
    architecture: 'Optimized Transformer',
    hf_repo: 'nvidia/Llama-3.3-Nemotron-Super-49B-v1',
    aboutContent: `Experience **Llama 3.3 Nemotron Super 49B**—a powerful open-source model that strikes the perfect balance between performance and efficiency. Available now on AkashChat, this high-capacity model delivers excellent results in reasoning, generation, and coding tasks without sacrificing speed.

Powered by NVIDIA's cutting-edge design, Nemotron Super 49B is perfect for developers and researchers looking to maximize output on a flexible, decentralized platform.`,
    infoContent: `
* ⚡ Instant access to Llama 3.3 Nemotron Super 49B with no signup
* 🧠 Supports massive 128K-token context for long-form content  
* 🌐 Decentralized hosting for lower costs & full control
* 🔍 Optimized for developers, researchers, and AI enthusiasts`,
    thumbnailId: 'llama-1',
    deployUrl: 'https://console.akash.network/templates/akash-network-awesome-akash-Llama-3.3-Nemotron-Super-49B-v1'
  },
  {
    id: 'Qwen-QwQ-32B',
    name: 'Qwen QwQ-32B',
    description: 'Medium-sized reasoning model with enhanced performance',
    temperature: 0.6,
    top_p: 0.95,
    tokenLimit: 128000,
    parameters: '32B',
    architecture: 'Reasoning-optimized',
    hf_repo: 'Qwen/QwQ-32B',
    aboutContent: `Unlock the capabilities of **Qwen QwQ-32B**, a versatile reasoning model optimized for both general-purpose and complex tasks. On AkashChat, you get instant access to this medium-sized powerhouse—no setup required.

Qwen QwQ-32B blends fast inference with high accuracy, making it ideal for researchers, developers, and creators pushing the boundaries of LLM capabilities.`,
    infoContent: `
* ⚡ Lightning-fast access with no login  
* 🧠 Long context window (128K tokens) for better coherence 
* 🌐 Decentralized hosting for lower costs & full control
* 🔍 Great for logic, Q&A, and creative content generation`,
    thumbnailId: 'llama-3',
    deployUrl: 'https://console.akash.network/templates/akash-network-awesome-akash-QwQ-32B'
  },
  {
    id: 'Meta-Llama-3-3-70B-Instruct',
    name: 'Llama 3.3 70B',
    apiId: 'meta-llama/Llama-3.3-70B-Instruct',
    description: 'Well-rounded model with strong capabilities',
    temperature: 0.6,
    top_p: 0.9,
    tokenLimit: 128000,
    parameters: '70B',
    architecture: 'Transformer',
    hf_repo: 'meta-llama/Llama-3.3-70B-Instruct',
    aboutContent: `Meet **Llama 3.3 70B**, Meta's well-rounded large model available now on AkashChat for instant access. With strong performance across tasks—reasoning, summarization, coding—this model is a reliable all-rounder for both casual and professional users.

Enjoy top-tier performance and low-latency interaction without needing to configure anything.`,
    infoContent: `
* ⚡ Jump in with zero setup  
* 🧠 Handles long conversations with a 128K token limit  
* 🌐 Cost-effective, censorship-resistant hosting  
* 🔍 Ideal for devs, startups, and AI researchers`,
    thumbnailId: 'llama-2',
    deployUrl: 'https://console.akash.network/templates/akash-network-awesome-akash-Llama-3.3-70B-Instruct'
  },
  {
    id: 'DeepSeek-R1',
    name: 'DeepSeek R1 671B',
    description: 'Strong Mixture-of-Experts (MoE) LLM',
    temperature: 0.6,
    top_p: 0.95,
    tokenLimit: 64000,
    parameters: '671B',
    architecture: 'Mixture-of-Experts',
    hf_repo: 'deepseek-ai/DeepSeek-R1',
    aboutContent: `Tap into the strength of **DeepSeek R1 671B**, one of the most capable Mixture-of-Experts (MoE) models available. Now live on AkashChat, this massive model offers world-class performance on tasks like reasoning, planning, and instruction-following.

Built to scale, DeepSeek R1 uses expert routing to reduce compute while maximizing results—ideal for large-scale AI development.`,
    infoContent: `
* ⚡ Instant access to DeepSeek R1 671B with no signup
* 🧠 Efficient MoE architecture with scalable performance 
* 🌐 Decentralized hosting for lower costs & full control
* 🔍 Built for professionals tackling high-complexity tasks`,
    thumbnailId: 'deepseek',
    deployUrl: 'https://console.akash.network/templates/akash-network-awesome-akash-DeepSeek-R1'
  },
  {
    id: 'Meta-Llama-3-1-405B-Instruct-FP8',
    name: 'Llama 3.1 405B',
    description: 'Most capable model for complex tasks',
    temperature: 0.6,
    top_p: 0.9,
    tokenLimit: 60000,
    parameters: '405B',
    architecture: 'Transformer',
    hf_repo: 'meta-llama/Llama-3.1-405B-Instruct-FP8',
    aboutContent: `Explore the high-performance **Llama 3.1 405B**, Meta's most capable model for complex reasoning, code generation, and advanced natural language tasks. Live on AkashChat, you can access this model instantly—no hardware required.

With 405 billion parameters, this model excels at deep understanding, long-context retention, and high-quality generation for even the most demanding workloads.`,
    infoContent: `
* ⚡ Instant access to Llama 3.1 405B with no signup 
* 🧠 Handles long conversations with a 128K token limit  
* 🌐 Cost-effective, censorship-resistant hosting  
* 🔍 Best for complex enterprise-grade AI tasks`,
    thumbnailId: 'llama-3',
    deployUrl: 'https://console.akash.network/templates/akash-network-awesome-akash-Llama-3.1-405B-FP8'
  },
  {
    id: 'Meta-Llama-3-2-3B-Instruct',
    name: 'Llama 3.2 3B',
    description: 'Fast model for quick responses',
    temperature: 0.6,
    top_p: 0.9,
    tokenLimit: 128000,
    parameters: '3B',
    architecture: 'Transformer',
    hf_repo: 'meta-llama/Llama-3.2-3B-Instruct',
    aboutContent: `Get instant, efficient performance with **Llama 3.2 3B**, a lightweight model ideal for fast, responsive interactions. Perfect for basic tasks, short conversations, and casual use cases, Llama 3.2 3B offers quick results without heavy compute demands.
  
  Accessible through AkashChat, this small but capable model is great for users seeking speed and simplicity on a decentralized platform.`,
    infoContent: `
  * ⚡ Super-fast responses with minimal latency
  * 🧠 128K-token context window for coherent exchanges
  * 🌐 Decentralized hosting ensures full control and lower costs
  * 🔍 Ideal for quick chats, FAQs, and lightweight workloads`,
    thumbnailId: 'llama-3',
    deployUrl: 'https://console.akash.network/templates/akash-network-awesome-akash-Llama-3.2-3B'
  },  
  {
    id: 'Meta-Llama-3-1-8B-Instruct-FP8',
    name: 'Llama 3.1 8B',
    description: 'Efficient model for basic tasks',
    temperature: 0.6,
    top_p: 0.9,
    tokenLimit: 128000,
    parameters: '8B',
    architecture: 'Transformer',
    hf_repo: 'meta-llama/Llama-3.1-8B-Instruct-FP8',
    aboutContent: `Discover the versatility of **Llama 3.1 8B**, a compact yet capable model perfect for daily tasks, chatbots, and lightweight reasoning. Available on AkashChat, Llama 3.1 8B offers a great balance between speed and capability without the need for large-scale compute.
  
  With FP8 optimization, it delivers faster inference and lower memory usage—ideal for quick deployments and fast responses.`,
    infoContent: `
  * ⚡ Fast, efficient model ready for instant interaction
  * 🧠 Supports extended conversations with a 128K-token window
  * 🌐 Cost-effective, decentralized deployment via Akash
  * 🔍 Best for lightweight applications, prototyping, and experimentation`,
    thumbnailId: 'llama-3',
    deployUrl: 'https://console.akash.network/templates/akash-network-awesome-akash-Llama-3.1-8B'
  },
  {
    id: 'Qwen3-Next-80B-A3B-Instruct',
    name: 'Qwen3 Next 80B A3B',
    apiId: 'Qwen/Qwen3-Next-80B-A3B-Instruct',
    description: 'Advanced MoE model with 80B parameters (3B active) and ultra-long context',
    temperature: 0.7,
    top_p: 0.8,
    tokenLimit: 262144,
    parameters: '80B (3B active)',
    architecture: 'Hybrid Attention with High-Sparsity MoE',
    hf_repo: 'Qwen/Qwen3-Next-80B-A3B-Instruct',
    aboutContent: `Experience **Qwen3 Next 80B A3B**, an innovative Mixture-of-Experts model with 80B total parameters and only 3B activated per token. This cutting-edge model features Hybrid Attention combining Gated DeltaNet and Gated Attention, delivering exceptional performance with 10x inference throughput for long contexts.

With native support for 262K tokens (extensible up to 1M tokens), Qwen3 Next excels in knowledge tasks, reasoning, coding, and multilingual applications. The high-sparsity MoE architecture ensures efficient computation while maintaining performance comparable to much larger models.`,
    infoContent: `
* ⚡ Revolutionary 80B model with only 3B activation per token
* 🧠 Ultra-long context support up to 262K tokens (1M with scaling)
* 🌐 Decentralized hosting for cost-effective, unrestricted access
* 🔍 Hybrid Attention architecture for superior long-context performance`,
    thumbnailId: 'llama-3',
    deployUrl: 'https://console.akash.network/templates/akash-network-awesome-akash-Qwen3-Next-80B-A3B-Instruct'
  },
  {
    id: 'mistral',
    name: 'Mistral-7B',
    description: 'Balanced model for general use',
    temperature: 0.7,
    top_p: 0.95,
    tokenLimit: 32768,
    parameters: '7B',
    architecture: 'Sliding Window Attention',
    hf_repo: 'mistral/Mistral-7B-v0.1',
    thumbnailId: 'mistral', 
    aboutContent: `Meet **Mistral-7B**, a lightweight, efficient language model known for its impressive performance across a wide range of general-purpose tasks. Now available on AkashChat, Mistral-7B is designed with sliding window attention for faster, more efficient handling of long sequences.
  
  It's perfect for developers and researchers looking for a compact yet capable model for real-world applications and experiments.`,
    infoContent: `
  * ⚡ Highly efficient with sliding window attention
  * 🧠 Supports context-rich conversations up to 32K tokens
  * 🌐 Decentralized, low-cost deployment options
  * 🔍 Great for summarization, chatbots, and general-purpose AI tasks`,
    deployUrl: 'https://console.akash.network/templates/akash-network-awesome-akash-Mistral-7B'
  },
  {
    id: 'AkashGen',
    name: 'AkashGen',
    description: 'Generate images using AkashGen',
    available: true,
    temperature: 0.85,
    top_p: 1,
    tokenLimit: 12000,
    aboutContent: `AkashGen is a powerful image generation model that leverages the Akash Network for decentralized hosting. It allows you to generate images using a text prompt—no setup required.`,
    infoContent: `
* ⚡ Instant access to AkashGen with no signup
* 🌐 Decentralized hosting for lower costs & full control
* 🔍 Great for image generation and creative content`,
    thumbnailId: 'akash-gen',
  }
];

// in case the `DEFAULT_MODEL` environment variable is not set or set to an unsupported model
export const fallbackModelID = 'Qwen3-Next-80B-A3B-Instruct';
export const defaultModel = process.env.DEFAULT_MODEL || fallbackModelID;

/**
 * Creates a mapping from API model IDs to config model IDs
 * This allows us to maintain consistent model IDs in our config while handling changes in the API
 */
export function createApiToConfigIdMap(): Map<string, string> {
  const map = new Map<string, string>();
  
  models.forEach(model => {
    // If apiId is specified, map it to the config id
    if (model.apiId) {
      map.set(model.apiId, model.id);
    }
    // Also map the config id to itself (for direct matches)
    map.set(model.id, model.id);
  });
  
  return map;
}

/**
 * Creates a mapping from config model IDs to API model IDs
 * Used when making API calls to translate our config IDs to the actual API IDs
 */
export function createConfigToApiIdMap(): Map<string, string> {
  const map = new Map<string, string>();
  
  models.forEach(model => {
    // If apiId is specified, map config id to API id
    if (model.apiId) {
      map.set(model.id, model.apiId);
    } else {
      // Otherwise, use the same id
      map.set(model.id, model.id);
    }
  });
  
  return map;
} 