import { InputType, Field, ID } from '@nestjs/graphql';
import { IsDate, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

@InputType({ description: 'Input data required to schedule a new consultation appointment' })
export class CreateScheduleInput {
  @Field(() => String, { description: 'Purpose or clinical symptoms for the consultation' })
  @IsString({ message: 'Objective must be a string' })
  @IsNotEmpty({ message: 'Objective is required' })
  objective: string;

  @Field(() => ID, { description: 'Existing customer/patient UUID' })
  @IsUUID('4', { message: 'customerId must be a valid UUID v4' })
  @IsNotEmpty({ message: 'customerId is required' })
  customerId: string;

  @Field(() => ID, { description: 'Existing doctor UUID' })
  @IsUUID('4', { message: 'doctorId must be a valid UUID v4' })
  @IsNotEmpty({ message: 'doctorId is required' })
  doctorId: string;

  @Field(() => Date, { description: 'Appointment date and time (ISO format)' })
  @Type(() => Date)
  @IsDate({ message: 'scheduledAt must be a valid ISO Date' })
  @IsNotEmpty({ message: 'scheduledAt is required' })
  scheduledAt: Date;
}

