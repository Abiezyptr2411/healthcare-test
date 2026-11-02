import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType({ description: 'Doctor profile registered in the healthcare system' })
export class Doctor {
  @Field(() => ID, { description: 'Unique identifier of the doctor (UUID)' })
  id: string;

  @Field(() => String, { description: 'Full name and title of the doctor' })
  name: string;

  @Field(() => Date, { description: 'Timestamp when doctor record was created' })
  createdAt: Date;

  @Field(() => Date, { description: 'Timestamp when doctor record was last updated' })
  updatedAt: Date;
}

