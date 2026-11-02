import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';

describe('AuthResolver', () => {
  let resolver: AuthResolver;
  let service: AuthService;

  const mockAuthPayload = {
    accessToken: 'test-jwt-token',
    user: {
      id: 'uuid-1',
      email: 'test@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockUserPayload = {
    id: 'uuid-1',
    email: 'test@example.com',
  };

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    validateToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    resolver = module.get<AuthResolver>(AuthResolver);
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should call register with correct args', async () => {
    mockAuthService.register.mockResolvedValue(mockAuthPayload);
    const input = { email: 'test@example.com', password: 'password123' };
    const res = await resolver.register(input);
    expect(mockAuthService.register).toHaveBeenCalledWith(input);
    expect(res).toEqual(mockAuthPayload);
  });

  it('should call login with correct args', async () => {
    mockAuthService.login.mockResolvedValue(mockAuthPayload);
    const input = { email: 'test@example.com', password: 'password123' };
    const res = await resolver.login(input);
    expect(mockAuthService.login).toHaveBeenCalledWith(input);
    expect(res).toEqual(mockAuthPayload);
  });

  it('should call validateToken with correct token', async () => {
    mockAuthService.validateToken.mockResolvedValue(mockUserPayload);
    const res = await resolver.validateToken('test-token');
    expect(mockAuthService.validateToken).toHaveBeenCalledWith('test-token');
    expect(res).toEqual(mockUserPayload);
  });
});

