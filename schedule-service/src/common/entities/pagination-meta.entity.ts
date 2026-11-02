import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType({ description: 'Pagination metadata for listing queries' })
export class PaginationMeta {
  @Field(() => Int, { description: 'Total number of items available across all pages' })
  total: number;

  @Field(() => Int, { description: 'Current page number' })
  page: number;

  @Field(() => Int, { description: 'Number of items per page' })
  limit: number;

  @Field(() => Int, { description: 'Total number of pages calculated from total and limit' })
  totalPages: number;
}

