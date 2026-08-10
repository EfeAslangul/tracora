import { Injectable } from '@nestjs/common';
import type { SiteProfile } from './site-profile.types';

const genericProfile: SiteProfile = {
  key: 'generic',
  version: 1,
  hostnames: ['*'],
  priority: 0,
  fetchMode: 'AUTO',
  normalizeUrl: (url) => new URL(url.toString()),
};

@Injectable()
export class SiteProfileRegistry {
  private readonly profiles: SiteProfile[] = [genericProfile];

  resolve(hostname: string): SiteProfile {
    return (
      this.profiles
        .filter((profile) => profile.hostnames.some((candidate: string) => candidate === hostname))
        .sort((left, right) => right.priority - left.priority || right.version - left.version)[0] ??
      genericProfile
    );
  }
}
