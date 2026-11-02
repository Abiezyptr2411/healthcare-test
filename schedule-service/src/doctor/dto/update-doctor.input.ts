import { InputType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType({ description: 'Input data required to update an existing doctor profile' })
export class UpdateDoctorInput {
  @Field(() => ID, { description: 'Unique identifier of the doctor to update' })
  @IsNotEmpty({ message: 'Doctor ID is required' })
  id: string;

  @Field(() => String, { description: 'Updated full name and title of the doctor' })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Doctor name is required' })
  name: string;
}

