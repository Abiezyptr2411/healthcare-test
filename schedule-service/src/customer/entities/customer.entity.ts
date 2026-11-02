import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType({ description: 'Customer (patient) registered in the healthcare scheduling system' })
export class Customer {
  @Field(() => ID, { description: 'Unique identifier of the customer (UUID)' })
  id: string;

  @Field(() => String, { description: 'Full name of the customer' })
  name: string;

  @Field(() => String, { description: 'Unique email address of the customer' })
  email: string;

  @Field(() => Date, { description: 'Timestamp when customer record was created' })
  createdAt: Date;

  @Field(() => Date, { description: 'Timestamp when customer record was last updated' })
  updatedAt: Date;
}

