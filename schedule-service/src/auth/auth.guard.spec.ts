import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AuthGuard } from './auth.guard';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let reflector: Reflector;
  let configService: ConfigService;

  beforeEach(() => {
    reflector = new Reflector();
    configService = new ConfigService();
    jest.spyOn(configService, 'get').mockReturnValue('http://auth-service:3001/graphql');
    guard = new AuthGuard(reflector, configService);
    jest.clearAllMocks();
  });

  const createMockContext = (headers: Record<string, any> = {}): ExecutionContext => {
    const req = { headers, user: null };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getType: jest.fn().mockReturnValue('graphql'),
      getArgs: jest.fn().mockReturnValue([null, null, { req }, null]),
      switchToHttp: jest.fn(),
    } as unknown as ExecutionContext;
  };

  it('should allow access if handler is marked as Public', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const context = createMockContext();

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException if authorization header is missing', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException if header is not Bearer format', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockContext({ authorization: 'Basic 123456' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should validate token and attach user to req when valid', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockContext({ authorization: 'Bearer valid-jwt-token' });

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          validateToken: {
            id: 'user-uuid-1',
            email: 'admin@healthcare.local',
          },
        },
      },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException when auth service returns graphql errors', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockContext({ authorization: 'Bearer invalid-jwt-token' });

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        errors: [{ message: 'Invalid or expired token' }],
      },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when auth service is unreachable', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockContext({ authorization: 'Bearer valid-jwt-token' });

    mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

