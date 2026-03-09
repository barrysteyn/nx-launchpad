export interface PythonAppGeneratorSchema {
  name: string;
  description?: string;
  pythonVersion?: string;
  includeInfra?: boolean;
  infrastructureType?: 'lambda' | 'ecs';
  includeApiGateway?: boolean;
}
