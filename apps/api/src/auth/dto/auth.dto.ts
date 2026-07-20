import { Transform } from 'class-transformer'
import { Equals, IsEmail, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator'
import { normalizePhone } from '../../common/phone'

/** Email приводим к нижнему регистру: иначе Ivan@ и ivan@ станут разными аккаунтами. */
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value

export class RegisterDto {
  @IsString()
  @Length(2, 80, { message: 'Имя должно быть от 2 до 80 символов' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string

  @IsEmail({}, { message: 'Некорректный email' })
  @MaxLength(160)
  @Transform(normalizeEmail)
  email!: string

  // Приводим к E.164 до валидации: форма присылает +7 (9xx) xxx-xx-xx, а
  // normalizePhone вернёт null на всём, что не мобильный РФ, — тогда regex ниже
  // не сойдётся и запрос отклонится.
  @Matches(/^\+79\d{9}$/, { message: 'Укажите телефон в формате +7 (9xx) xxx-xx-xx' })
  @Transform(({ value }) => (typeof value === 'string' ? (normalizePhone(value) ?? value) : value))
  phone!: string

  // Верхняя граница — не придирка: argon2 считает хэш от всей строки, и без
  // неё мегабайтный «пароль» станет способом положить сервер.
  @IsString()
  @MinLength(8, { message: 'Пароль должен быть не короче 8 символов' })
  @MaxLength(128)
  password!: string

  @Equals(true, { message: 'Без согласия на обработку персональных данных регистрация невозможна' })
  consent!: boolean
}

export class LoginDto {
  @IsEmail({}, { message: 'Некорректный email' })
  @MaxLength(160)
  @Transform(normalizeEmail)
  email!: string

  @IsString()
  @MaxLength(128)
  password!: string

  @Equals(true, { message: 'Требуется согласие на обработку персональных данных' })
  consent!: boolean
}

export class VerifyDto {
  @IsString()
  @Length(1, 40)
  challengeId!: string

  @Matches(/^\d{4}$/, { message: 'Код состоит из 4 цифр' })
  code!: string
}

export class ResendCodeDto {
  @IsString()
  @Length(1, 40)
  challengeId!: string
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Некорректный email' })
  @MaxLength(160)
  @Transform(normalizeEmail)
  email!: string
}

export class ResetPasswordDto {
  @IsString()
  @Length(10, 200)
  token!: string

  @IsString()
  @MinLength(8, { message: 'Пароль должен быть не короче 8 символов' })
  @MaxLength(128)
  newPassword!: string
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  currentPassword!: string

  @IsString()
  @MinLength(8, { message: 'Пароль должен быть не короче 8 символов' })
  @MaxLength(128)
  newPassword!: string
}

export class CompleteProfileDto {
  @IsString()
  @Length(2, 120, { message: 'Укажите ФИО' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fio!: string

  @IsString()
  @Length(2, 200, { message: 'Укажите адрес' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  address!: string

  @Matches(/^\+79\d{9}$/, { message: 'Укажите телефон в формате +7 (9xx) xxx-xx-xx' })
  @Transform(({ value }) => (typeof value === 'string' ? (normalizePhone(value) ?? value) : value))
  phone!: string

  // Публичный email для футера/контактов (отдельный от email-логина аккаунта).
  @IsEmail({}, { message: 'Укажите корректный email для сайта' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string
}

export class ChangeCredentialsDto {
  // Текущий пароль обязателен даже сразу после входа: это защита от смены
  // доступов по перехваченной сессии.
  @IsString()
  @MaxLength(128)
  currentPassword!: string

  @IsEmail({}, { message: 'Некорректный email' })
  @MaxLength(160)
  @Transform(normalizeEmail)
  newEmail!: string

  @IsString()
  @MinLength(8, { message: 'Пароль должен быть не короче 8 символов' })
  @MaxLength(128)
  newPassword!: string
}
