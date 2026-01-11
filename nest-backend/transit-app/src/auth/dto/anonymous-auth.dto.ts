import { IsString, IsNotEmpty } from 'class-validator';

export class AnonymousLoginDto {
  @IsString()
  @IsNotEmpty()
  uuid: string;

  @IsString()
  @IsNotEmpty()
  passkey: string;
}
