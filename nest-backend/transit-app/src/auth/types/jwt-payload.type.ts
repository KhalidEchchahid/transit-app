export interface JwtPayload {
  sub: number;
  email?: string;
  uuid?: string;
  anonymous?: boolean;
}
