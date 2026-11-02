import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Customer } from '../../customer/entities/customer.entity';
import { Doctor } from '../../doctor/entities/doctor.entity';

@ObjectType({ description: 'Healthcare appointment schedule entry' })
export class Schedule {
  @Field(() => ID, { description: 'Unique identifier of the schedule (UUID)' })
  id: string;

  @Field(() => String, { description: 'Consultation objective or clinical reason for appointment' })
  objective: string;

  @Field(() => ID, { description: 'ID of the patient/customer' })
  customerId: string;

  @Field(() => ID, { description: 'ID of the assigned doctor' })
  doctorId: string;

  @Field(() => Date, { description: 'Scheduled date and time of the medical consultation' })
  scheduledAt: Date;

  @Field(() => Customer, { nullable: true, description: 'Customer details linked to this appointment' })
  customer?: Customer;

  @Field(() => Doctor, { nullable: true, description: 'Doctor details linked to this appointment' })
  doctor?: Doctor;

  @Field(() => Date, { description: 'Timestamp when schedule was created' })
  createdAt: Date;

  @Field(() => Date, { description: 'Timestamp when schedule was last updated' })
  updatedAt: Date;
}

