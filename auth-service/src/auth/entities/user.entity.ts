import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType({ description: 'User entity containing user details without sensitive fields' })
export class User {
  @Field(() => ID, { description: 'Unique identifier for the user (UUID)' })
  id: string;

  @Field(() => String, { description: 'Unique email address of the user' })
  email: string;

  @Field(() => Date, { description: 'Timestamp when the user account was created' })
  createdAt: Date;

  @Field(() => Date, { description: 'Timestamp when the user account was last updated' })
  updatedAt: Date;
}

