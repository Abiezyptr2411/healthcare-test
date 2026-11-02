import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly authServiceUrl: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    this.authServiceUrl = this.configService.get<string>(
      'AUTH_SERVICE_URL',
      'http://auth-service:3001/graphql',
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const gqlContext = GqlExecutionContext.create(context);
    const req = gqlContext.getContext().req;

    if (!req) {
      this.logger.warn('No HTTP request found in GraphQL context');
      throw new UnauthorizedException('Authentication context is missing');
    }

    const authHeader = req.headers?.authorization || req.headers?.Authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException(
        'Missing Authorization header. Expected format: Bearer <token>',
      );
    }

    const parts = authHeader.trim().split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new UnauthorizedException(
        'Malformed Authorization header. Expected format: Bearer <token>',
      );
    }

    const token = parts[1];

    try {
      const response = await axios.post(
        this.authServiceUrl,
        {
          query: `
            query ValidateToken($token: String!) {
              validateToken(token: $token) {
                id
                email
              }
            }
          `,
          variables: { token },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        },
      );

      const data = response.data;

      if (data?.errors && data.errors.length > 0) {
        this.logger.warn(
          `Auth service rejected token: ${data.errors[0]?.message}`,
        );
        throw new UnauthorizedException(
          data.errors[0]?.message || 'Invalid or expired token',
        );
      }

      const user = data?.data?.validateToken;
      if (!user || !user.id) {
        throw new UnauthorizedException('Token validation failed');
      }

      // Attach authenticated user identity to request context
      req.user = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(
        `Failed to communicate with Auth Service: ${error.message}`,
      );
      throw new UnauthorizedException(
        'Unable to authenticate request. Auth service is unavailable or token is invalid.',
      );
    }
  }
}

