import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

@InputType({ description: 'Input data required for user registration' })
export class RegisterInput {
  @Field(() => String, { description: 'Valid email address of the new user' })
  @IsEmail({}, { message: 'Invalid email address format' })
  @IsNotEmpty({ message: 'Email must not be empty' })
  email: string;

  @Field(() => String, { description: 'Password with minimum 8 characters' })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}

