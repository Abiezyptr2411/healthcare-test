import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { AuthPayload } from './entities/auth-payload.entity';
import { UserPayload } from './entities/user-payload.entity';
import { RegisterInput } from './dto/register.input';
import { LoginInput } from './dto/login.input';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthPayload, {
    description: 'Register a new user account with email and password',
  })
  async register(@Args('input') input: RegisterInput): Promise<AuthPayload> {
    return this.authService.register(input);
  }

  @Mutation(() => AuthPayload, {
    description: 'Authenticate user with credentials and return JWT access token',
  })
  async login(@Args('input') input: LoginInput): Promise<AuthPayload> {
    return this.authService.login(input);
  }

  @Query(() => UserPayload, {
    description: 'Validate a JWT access token and return user identity for service authorization',
  })
  async validateToken(
    @Args('token', {
      type: () => String,
      description: 'JWT bearer token to validate',
    })
    token: string,
  ): Promise<UserPayload> {
    return this.authService.validateToken(token);
  }
}

