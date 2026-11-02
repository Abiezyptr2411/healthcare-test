import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { DoctorService } from './doctor.service';
import { Doctor } from './entities/doctor.entity';
import { DoctorPagination } from './entities/doctor-pagination.entity';
import { CreateDoctorInput } from './dto/create-doctor.input';
import { UpdateDoctorInput } from './dto/update-doctor.input';
import { PaginationArgs } from '../common/dto/pagination.args';

@Resolver(() => Doctor)
export class DoctorResolver {
  constructor(private readonly doctorService: DoctorService) {}

  @Mutation(() => Doctor, {
    description: 'Register a new doctor in the clinic system',
  })
  async createDoctor(
    @Args('input') input: CreateDoctorInput,
  ): Promise<Doctor> {
    return this.doctorService.createDoctor(input);
  }

  @Mutation(() => Doctor, {
    description: 'Update doctor profile details by ID',
  })
  async updateDoctor(
    @Args('input') input: UpdateDoctorInput,
  ): Promise<Doctor> {
    return this.doctorService.updateDoctor(input);
  }

  @Query(() => DoctorPagination, {
    description: 'Retrieve a paginated list of doctors',
  })
  async doctors(
    @Args() pagination: PaginationArgs,
  ): Promise<DoctorPagination> {
    return this.doctorService.doctors(pagination);
  }

  @Query(() => Doctor, {
    description: 'Find a specific doctor profile by UUID',
  })
  async doctor(
    @Args('id', { type: () => ID, description: 'Doctor UUID' }) id: string,
  ): Promise<Doctor> {
    return this.doctorService.doctor(id);
  }

  @Mutation(() => Doctor, {
    description: 'Delete a doctor profile. Fails if the doctor has existing schedules',
  })
  async deleteDoctor(
    @Args('id', { type: () => ID, description: 'Doctor UUID to delete' })
    id: string,
  ): Promise<Doctor> {
    return this.doctorService.deleteDoctor(id);
  }
}

