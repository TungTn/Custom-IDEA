export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  email?: string | null;
  avatar_url?: string | null;
  web_url?: string | null;
}

export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path_with_namespace: string;
  http_url_to_repo: string;
  ssh_url_to_repo: string;
  default_branch?: string | null;
  visibility?: string | null;
  description?: string | null;
  last_activity_at?: string | null;
  web_url?: string | null;
  star_count?: number | null;
}

export interface GitLabAccount {
  id: string;
  host: string;
  token: string;
  user?: GitLabUser;
  createdAt: number;
  lastVerifiedAt?: number;
}
