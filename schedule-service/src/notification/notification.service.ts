import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ScheduleEmailPayload } from './dto/email-job.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectQueue('email-queue')
    private readonly emailQueue: Queue,
  ) {}

  async sendScheduleCreated(payload: ScheduleEmailPayload): Promise<void> {
    try {
      await this.emailQueue.add('schedule-created', payload, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
      });
      this.logger.log(`Enqueued schedule-created email job for ${payload.customerEmail}`);
    } catch (err) {
      this.logger.warn(`Failed to enqueue schedule-created email: ${err.message}`);
    }
  }

  async sendScheduleDeleted(payload: ScheduleEmailPayload): Promise<void> {
    try {
      await this.emailQueue.add('schedule-deleted', payload, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
      });
      this.logger.log(`Enqueued schedule-deleted email job for ${payload.customerEmail}`);
    } catch (err) {
      this.logger.warn(`Failed to enqueue schedule-deleted email: ${err.message}`);
    }
  }
}

