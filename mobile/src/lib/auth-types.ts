// Regular user (email-based auth)
export interface User {
  id: number;
  email: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface SignUpRequest {
  email: string;
  password: string;
  name?: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

// Anonymous user (privacy-first auth)
export interface AnonymousUser {
  id: number;
  uuid: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface AnonymousAuthResponse {
  accessToken: string;
  user: AnonymousUser;
  /** Only returned on registration - user must save this! */
  credentials?: {
    uuid: string;
    passkey: string;
  };
}

export interface AnonymousLoginRequest {
  uuid: string;
  passkey: string;
}
