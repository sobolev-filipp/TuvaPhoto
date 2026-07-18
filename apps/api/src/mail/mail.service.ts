import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createTransport, type Transporter } from 'nodemailer'

/**
 * Отправка писем.
 *
 * Если в .env задан SMTP_HOST — письма уходят через SMTP (nodemailer).
 * Если пусто — на время разработки печатаем содержимое в консоль сервера
 * с пометкой [DEV-EMAIL]. Так flow подтверждения и сброса можно гонять без
 * реальной почты, а на боевом достаточно заполнить SMTP_*.
 *
 * ВАЖНО: вывод кода 2FA в консоль допустим только в разработке — доступ к
 * логам это доступ к чужим входам. На проде SMTP_HOST обязателен.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private readonly transporter: Transporter | null
  private readonly from: string

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('SMTP_HOST')?.trim()
    this.from =
      config.get<string>('SMTP_FROM')?.trim() ||
      config.get<string>('SMTP_USER')?.trim() ||
      'no-reply@tuvafoto.local'

    if (host) {
      const port = Number(config.get('SMTP_PORT') ?? 587)
      this.transporter = createTransport({
        host,
        port,
        // 465 — SSL сразу; 587 — STARTTLS.
        secure: port === 465,
        auth: {
          user: config.get<string>('SMTP_USER'),
          pass: config.get<string>('SMTP_PASSWORD'),
        },
      })
      this.logger.log(`SMTP включён: ${host}:${port}`)
    } else {
      this.transporter = null
      this.logger.warn('SMTP не настроен — письма выводятся в консоль (режим разработки)')
    }
  }

  private async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `\n[DEV-EMAIL]\nTo: ${to}\nSubject: ${subject}\n\n${text}\n` +
          `${'─'.repeat(48)}`,
      )
      return
    }

    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text })
    } catch (e) {
      // Письмо не ушло — логируем, но наверх ошибку не выносим: пользователю
      // всё равно показываем нейтральный ответ (иначе форма выдаёт, какой
      // адрес зарегистрирован).
      this.logger.error(`Не удалось отправить письмо на ${to}: ${(e as Error).message}`)
    }
  }

  async sendTwoFactorCode(email: string, name: string, code: string): Promise<void> {
    const text =
      `${name}, ваш код для входа в ТуваФото: ${code}\n\n` +
      `Введите его на странице подтверждения. Код действует 10 минут.\n` +
      `Если вы не пытались войти — просто проигнорируйте это письмо.`
    await this.send(email, 'Код для входа — ТуваФото', text)
  }

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    const text =
      `Вы запросили восстановление пароля в ТуваФото.\n\n` +
      `Перейдите по ссылке, чтобы задать новый пароль:\n${resetUrl}\n\n` +
      `Ссылка действует 1 час. Если вы не запрашивали сброс — проигнорируйте письмо, ` +
      `пароль останется прежним.`
    await this.send(email, 'Восстановление пароля — ТуваФото', text)
  }
}
