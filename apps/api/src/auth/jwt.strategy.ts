import { Injectable, UnauthorizedException } from '@nestjs/common';

import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { ConfigService } from '@nestjs/config';

import { Request } from 'express';

import { AuthService } from './auth.service';

import { getJwtSecret } from '../common/jwt-config';



@Injectable()

export class JwtStrategy extends PassportStrategy(Strategy) {

  constructor(

    private authService: AuthService,

    config: ConfigService,

  ) {

    super({

      jwtFromRequest: ExtractJwt.fromExtractors([

        ExtractJwt.fromAuthHeaderAsBearerToken(),

        (req: Request) => (req?.cookies?.token as string) || null,

      ]),

      ignoreExpiration: false,

      secretOrKey: getJwtSecret(config),

    });

  }



  async validate(payload: { sub: string; email: string; role: string; tv?: number }) {

    const user = await this.authService.validateUser(payload.sub);

    if (!user || !user.isActive) {

      throw new UnauthorizedException();

    }

    if (payload.tv !== undefined && payload.tv !== user.tokenVersion) {

      throw new UnauthorizedException('Sessiya bekor qilingan — qayta kiring');

    }

    const { tokenVersion: _tv, ...safeUser } = user;

    return safeUser;

  }

}


