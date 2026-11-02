import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { ScheduleEmailPayload } from './dto/email-job.dto';

@Processor('email-queue')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    super();
    const mailHost = this.configService.get<string>('MAIL_HOST', 'localhost');
    const mailPort = this.configService.get<number>('MAIL_PORT', 1025);
    this.fromEmail = this.configService.get<string>(
      'MAIL_FROM',
      '"Healthcare Scheduling" <noreply@healthcare.local>',
    );

    this.transporter = nodemailer.createTransport({
      host: mailHost,
      port: Number(mailPort),
      ignoreTLS: true,
    });
  }

  async process(job: Job<ScheduleEmailPayload>): Promise<any> {
    this.logger.log(`Processing email job "${job.name}" for ${job.data.customerEmail}`);
    const { customerEmail, customerName, doctorName, objective, scheduledAt, scheduleId } =
      job.data;

    if (job.name === 'schedule-created') {
      const info = await this.transporter.sendMail({
        from: this.fromEmail,
        to: customerEmail,
        subject: `[Confirmed] Appointment Scheduled: ${objective}`,
        text: `Hello ${customerName},\n\nYour appointment with Dr. ${doctorName} has been confirmed for ${new Date(
          scheduledAt,
        ).toUTCString()}.\n\nObjective: ${objective}\nReference ID: ${scheduleId}\n\nThank you for choosing our clinic.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #2b6cb0;">Appointment Confirmed</h2>
            <p>Dear <strong>${customerName}</strong>,</p>
            <p>Your healthcare appointment has been successfully scheduled. Here are the details:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; color: #555;"><strong>Doctor</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">Dr. ${doctorName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; color: #555;"><strong>Date & Time</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${new Date(
                  scheduledAt,
                ).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; color: #555;"><strong>Objective</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${objective}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; color: #555;"><strong>Appointment ID</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><code>${scheduleId}</code></td>
              </tr>
            </table>
            <p style="font-size: 13px; color: #777;">If you need to reschedule or cancel, please contact the clinic or use our service portal.</p>
          </div>
        `,
      });
      this.logger.log(`Schedule created email sent to ${customerEmail}: ${info.messageId}`);
      return info;
    }

    if (job.name === 'schedule-deleted') {
      const info = await this.transporter.sendMail({
        from: this.fromEmail,
        to: customerEmail,
        subject: `[Cancelled] Appointment Cancelled: ${objective}`,
        text: `Hello ${customerName},\n\nYour appointment with Dr. ${doctorName} previously scheduled for ${new Date(
          scheduledAt,
        ).toUTCString()} has been cancelled.\n\nObjective: ${objective}\nReference ID: ${scheduleId}\n\nClinic Administration`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #c53030;">Appointment Cancelled</h2>
            <p>Dear <strong>${customerName}</strong>,</p>
            <p>Your appointment with Dr. <strong>${doctorName}</strong> on <strong>${new Date(
              scheduledAt,
            ).toLocaleString()}</strong> has been cancelled.</p>
            <p><strong>Reason/Objective:</strong> ${objective}</p>
            <p style="font-size: 13px; color: #777;">Please contact our reception if you wish to book another consultation.</p>
          </div>
        `,
      });
      this.logger.log(`Schedule cancelled email sent to ${customerEmail}: ${info.messageId}`);
      return info;
    }
  }
}

