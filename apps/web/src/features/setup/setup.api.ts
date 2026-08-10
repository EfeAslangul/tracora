import { apiClient } from '../../services/api-client';
import type { SetupInput, SetupResult, SetupStatus } from './setup.types';

export function getSetupStatus() {
  return apiClient.get<SetupStatus>('/setup/status');
}

export function submitSetup(input: SetupInput) {
  return apiClient.post<SetupResult, SetupInput>('/setup', input);
}
