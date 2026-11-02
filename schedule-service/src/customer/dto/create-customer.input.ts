import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

@InputType({ description: 'Input data required to create a new customer' })
export class CreateCustomerInput {
  @Field(() => String, { description: 'Full name of the customer' })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @Field(() => String, { description: 'Unique email address for contact and notifications' })
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;
}

