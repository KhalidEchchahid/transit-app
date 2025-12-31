// ========== ANONYMOUS AUTH TYPES ==========

export interface AnonymousUser {
  id: number;
  hasPin: boolean;
  createdAt: string;
}

export interface AnonymousAuthResponse {
  accessToken: string;
  user: AnonymousUser;
}

export interface AnonymousRegisterRequest {
  tokenHash: string;
  recoveryHash: string;
  pin?: string;
}

export interface AnonymousLoginRequest {
  tokenHash: string;
  pin?: string;
}

export interface AnonymousRecoverRequest {
  recoveryHash: string;
  newTokenHash: string;
  newPin?: string;
}

// ========== LEGACY AUTH TYPES (for email/password) ==========

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
