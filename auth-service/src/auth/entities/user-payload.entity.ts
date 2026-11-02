import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType({ description: 'Validated token payload returned to consuming microservices' })
export class UserPayload {
  @Field(() => ID, { description: 'Unique user identifier (UUID)' })
  id: string;

  @Field(() => String, { description: 'Email address of the authenticated user' })
  email: string;
}

