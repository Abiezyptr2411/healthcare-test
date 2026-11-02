import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { NotificationService } from '../notification/notification.service';
import { CreateScheduleInput } from './dto/create-schedule.input';
import { ScheduleFilterArgs } from './dto/schedule-filter.args';
import { PaginationArgs } from '../common/dto/pagination.args';
import { SchedulePagination } from './entities/schedule-pagination.entity';
import { Schedule } from './entities/schedule.entity';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
    private readonly notificationService: NotificationService,
  ) {}

  async createSchedule(input: CreateScheduleInput): Promise<Schedule> {
    // 1. Verify customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
    });
    if (!customer) {
      throw new NotFoundException(
        `Customer with ID '${input.customerId}' not found in database`,
      );
    }

    // 2. Verify doctor exists
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: input.doctorId },
    });
    if (!doctor) {
      throw new NotFoundException(
        `Doctor with ID '${input.doctorId}' not found in database`,
      );
    }

    // 3. Check for doctor schedule conflict
    const scheduledDate = new Date(input.scheduledAt);
    const conflictingSchedule = await this.prisma.schedule.findFirst({
      where: {
        doctorId: input.doctorId,
        scheduledAt: scheduledDate,
      },
    });

    if (conflictingSchedule) {
      throw new ConflictException(
        `Doctor '${doctor.name}' already has an appointment scheduled at ${scheduledDate.toISOString()}`,
      );
    }

    try {
      const schedule = await this.prisma.schedule.create({
        data: {
          objective: input.objective.trim(),
          customerId: input.customerId,
          doctorId: input.doctorId,
          scheduledAt: scheduledDate,
        },
        include: {
          customer: true,
          doctor: true,
        },
      });

      // Invalidate cache
      await this.cache.del('schedules:*');

      // Dispatch async email notification via BullMQ
      await this.notificationService.sendScheduleCreated({
        customerEmail: customer.email,
        customerName: customer.name,
        doctorName: doctor.name,
        objective: schedule.objective,
        scheduledAt: schedule.scheduledAt.toISOString(),
        scheduleId: schedule.id,
      });

      return schedule;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Doctor already has a booked appointment at ${scheduledDate.toISOString()}`,
        );
      }
      throw error;
    }
  }

  async schedules(
    filter: ScheduleFilterArgs,
    pagination: PaginationArgs,
  ): Promise<SchedulePagination> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ScheduleWhereInput = {};

    if (filter?.doctorId) {
      where.doctorId = filter.doctorId;
    }

    if (filter?.customerId) {
      where.customerId = filter.customerId;
    }

    if (filter?.dateFrom || filter?.dateTo) {
      where.scheduledAt = {};
      if (filter.dateFrom) {
        where.scheduledAt.gte = new Date(filter.dateFrom);
      }
      if (filter.dateTo) {
        where.scheduledAt.lte = new Date(filter.dateTo);
      }
    }

    const cacheKey = `schedules:${JSON.stringify(where)}:p${page}:l${limit}`;
    const cached = await this.cache.get<SchedulePagination>(cacheKey);
    if (cached) {
      return cached;
    }

    const [total, items] = await Promise.all([
      this.prisma.schedule.count({ where }),
      this.prisma.schedule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'asc' },
        include: {
          customer: true,
          doctor: true,
        },
      }),
    ]);

    const result: SchedulePagination = {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };

    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  async schedule(id: string): Promise<Schedule> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: {
        customer: true,
        doctor: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID '${id}' not found`);
    }

    return schedule;
  }

  async deleteSchedule(id: string): Promise<Schedule> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: {
        customer: true,
        doctor: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID '${id}' not found`);
    }

    const deleted = await this.prisma.schedule.delete({
      where: { id },
    });

    await this.cache.del('schedules:*');

    // Dispatch async cancellation email via BullMQ
    if (schedule.customer) {
      await this.notificationService.sendScheduleDeleted({
        customerEmail: schedule.customer.email,
        customerName: schedule.customer.name,
        doctorName: schedule.doctor?.name || 'Assigned Physician',
        objective: schedule.objective,
        scheduledAt: schedule.scheduledAt.toISOString(),
        scheduleId: schedule.id,
      });
    }

    return {
      ...deleted,
      customer: schedule.customer,
      doctor: schedule.doctor,
    };
  }
}

