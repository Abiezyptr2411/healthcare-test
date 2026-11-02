import { ArgsType, Field, ID } from '@nestjs/graphql';
import { IsDate, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

@ArgsType()
export class ScheduleFilterArgs {
  @Field(() => ID, { nullable: true, description: 'Filter schedules by specific doctor UUID' })
  @IsOptional()
  @IsUUID('4', { message: 'doctorId must be a valid UUID' })
  doctorId?: string;

  @Field(() => ID, { nullable: true, description: 'Filter schedules by specific customer UUID' })
  @IsOptional()
  @IsUUID('4', { message: 'customerId must be a valid UUID' })
  customerId?: string;

  @Field(() => Date, { nullable: true, description: 'Filter appointments scheduled on or after this date (ISO format)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'dateFrom must be a valid ISO Date' })
  dateFrom?: Date;

  @Field(() => Date, { nullable: true, description: 'Filter appointments scheduled on or before this date (ISO format)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'dateTo must be a valid ISO Date' })
  dateTo?: Date;
}

