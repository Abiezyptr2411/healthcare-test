import { ObjectType, Field } from '@nestjs/graphql';
import { Doctor } from './doctor.entity';
import { PaginationMeta } from '../../common/entities/pagination-meta.entity';

@ObjectType({ description: 'Paginated doctor list response' })
export class DoctorPagination {
  @Field(() => [Doctor], { description: 'List of doctors on the current page' })
  items: Doctor[];

  @Field(() => PaginationMeta, { description: 'Pagination metadata' })
  meta: PaginationMeta;
}

