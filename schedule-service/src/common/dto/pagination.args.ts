import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsOptional, Min, Max } from 'class-validator';

@ArgsType()
export class PaginationArgs {
  @Field(() => Int, {
    nullable: true,
    defaultValue: 1,
    description: 'Page number for pagination (starts from 1)',
  })
  @IsOptional()
  @Min(1, { message: 'Page must be greater than or equal to 1' })
  page?: number = 1;

  @Field(() => Int, {
    nullable: true,
    defaultValue: 10,
    description: 'Number of items per page (maximum 100)',
  })
  @IsOptional()
  @Min(1, { message: 'Limit must be greater than or equal to 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 10;
}

