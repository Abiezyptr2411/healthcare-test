import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { ScheduleService } from './schedule.service';
import { Schedule } from './entities/schedule.entity';
import { SchedulePagination } from './entities/schedule-pagination.entity';
import { CreateScheduleInput } from './dto/create-schedule.input';
import { ScheduleFilterArgs } from './dto/schedule-filter.args';
import { PaginationArgs } from '../common/dto/pagination.args';

@Resolver(() => Schedule)
export class ScheduleResolver {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Mutation(() => Schedule, {
    description:
      'Book a new healthcare consultation schedule for a doctor and customer. Enforces non-overlapping appointments.',
  })
  async createSchedule(
    @Args('input') input: CreateScheduleInput,
  ): Promise<Schedule> {
    return this.scheduleService.createSchedule(input);
  }

  @Query(() => SchedulePagination, {
    description:
      'Retrieve a filtered and paginated list of medical appointment schedules',
  })
  async schedules(
    @Args() filter: ScheduleFilterArgs,
    @Args() pagination: PaginationArgs,
  ): Promise<SchedulePagination> {
    return this.scheduleService.schedules(filter, pagination);
  }

  @Query(() => Schedule, {
    description: 'Find a specific schedule by UUID including doctor and customer details',
  })
  async schedule(
    @Args('id', { type: () => ID, description: 'Schedule UUID' }) id: string,
  ): Promise<Schedule> {
    return this.scheduleService.schedule(id);
  }

  @Mutation(() => Schedule, {
    description:
      'Cancel and delete an appointment schedule by ID, triggering a notification to the customer',
  })
  async deleteSchedule(
    @Args('id', { type: () => ID, description: 'Schedule UUID to cancel/delete' })
    id: string,
  ): Promise<Schedule> {
    return this.scheduleService.deleteSchedule(id);
  }
}

