import type { GitLabUserDto, GitLabProjectDto } from '../bindings';

export type GitLabUser = GitLabUserDto;
export type GitLabProject = GitLabProjectDto;

export interface GitLabAccount {
  id: string;
  host: string;
  allowSelfSigned?: boolean;
  user?: GitLabUser;
  createdAt: number;
  lastVerifiedAt?: number;
}
