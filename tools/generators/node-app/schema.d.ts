export interface NodeAppGeneratorSchema {
  name: string;
  description?: string;
  includeInfra?: boolean;
  includeApiGateway?: boolean;
}
