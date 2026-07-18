import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { OAuthService } from './oauth/oauth.service'
import { OAuthController } from './oauth/oauth.controller'

@Module({
  imports: [JwtModule.register({})],
  providers: [AuthService, OAuthService],
  controllers: [AuthController, OAuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
