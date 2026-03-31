export interface EndpointConfig {
  url: string;
  apiKey: string;
  models?: string[];
  priority?: number;
  weight?: number;
}

export interface ModelsResponse {
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>;
} 