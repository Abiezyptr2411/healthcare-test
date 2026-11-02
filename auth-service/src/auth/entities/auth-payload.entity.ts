import { ObjectType, Field } from '@nestjs/graphql';
import { User } from './user.entity';

@ObjectType({ description: 'Authentication payload returned after successful registration or login' })
export class AuthPayload {
  @Field(() => String, { description: 'Signed JWT access token for authenticating future requests' })
  accessToken: string;

  @Field(() => User, { description: 'Authenticated user profile details' })
  user: User;
}

