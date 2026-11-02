import { ObjectType, Field } from '@nestjs/graphql';
import { Customer } from './customer.entity';
import { PaginationMeta } from '../../common/entities/pagination-meta.entity';

@ObjectType({ description: 'Paginated customer list response' })
export class CustomerPagination {
  @Field(() => [Customer], { description: 'List of customers on the current page' })
  items: Customer[];

  @Field(() => PaginationMeta, { description: 'Pagination metadata' })
  meta: PaginationMeta;
}

