import { ObjectType, Field } from '@nestjs/graphql';
import { Schedule } from './schedule.entity';
import { PaginationMeta } from '../../common/entities/pagination-meta.entity';

@ObjectType({ description: 'Paginated appointment schedule list response' })
export class SchedulePagination {
  @Field(() => [Schedule], { description: 'List of schedules on current page' })
  items: Schedule[];

  @Field(() => PaginationMeta, { description: 'Pagination metadata' })
  meta: PaginationMeta;
}

