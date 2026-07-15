import { Controller, Post, Body, Get, UseGuards, Request, Res, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Response, Request as ExpressRequest } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/auth.guard';
import { resolveAuthCookieOptions } from '../common/auth-cookie.util';
import { jwtExpiresInMs } from '../common/jwt-cookie.util';

/** Production: 5/min per IP. Dev/CI/E2E: higher limit so parallel Playwright workers do not 429. */
const LOGIN_THROTTLE_LIMIT =
  process.env.NODE_ENV === 'production' && process.env.E2E !== 'true' ? 5 : 200;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  private cookieOptions() {
    return resolveAuthCookieOptions(this.config);
  }

  private setAuthCookie(res: Response, token: string) {
    const maxAge = jwtExpiresInMs(this.config.get('JWT_EXPIRES_IN'));
    res.cookie('token', token, {
      ...this.cookieOptions(),
      maxAge,
    });
  }

  @Post('login')
  @SkipThrottle()
  @Throttle({ default: { limit: LOGIN_THROTTLE_LIMIT, ttl: 60000 } })
  @ApiOperation({ summary: 'Tizimga kirish' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: ExpressRequest,
  ) {
    const ip = req.ip || req.headers['x-forwarded-for']?.toString();
    const result = await this.authService.login(dto, ip);
    if (result.accessToken) {
      this.setAuthCookie(res, result.accessToken);
      const isProd = this.config.get('NODE_ENV') === 'production';
      if (isProd) {
        const { accessToken: _token, ...safe } = result;
        return safe;
      }
    }
    return result;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tizimdan chiqish' })
  logout(
    @Res({ passthrough: true }) res: Response,
    @Request() req: { user: { id: string } },
    @Req() expressReq: ExpressRequest,
  ) {
    res.clearCookie('token', this.cookieOptions());
    return this.authService.invalidateSessions(req.user.id, expressReq.ip);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Joriy foydalanuvchi ma\'lumotlari' })
  getMe(@Request() req: { user: Record<string, unknown> }) {
    return req.user;
  }
}
