import { InputType, Field, ID } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType({ description: 'Input data required to update an existing customer' })
export class UpdateCustomerInput {
  @Field(() => ID, { description: 'Unique identifier of the customer to update' })
  @IsNotEmpty({ message: 'Customer ID is required' })
  id: string;

  @Field(() => String, { nullable: true, description: 'Updated customer name' })
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name cannot be empty' })
  name?: string;

  @Field(() => String, { nullable: true, description: 'Updated unique email address' })
  @IsOptional()
  @IsEmail({}, { message: 'Must be a valid email address' })
  email?: string;
}

