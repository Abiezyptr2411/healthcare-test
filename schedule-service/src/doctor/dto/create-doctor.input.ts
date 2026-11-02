import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType({ description: 'Input data required to create a new doctor profile' })
export class CreateDoctorInput {
  @Field(() => String, { description: 'Full name and title of the doctor' })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Doctor name is required' })
  name: string;
}

