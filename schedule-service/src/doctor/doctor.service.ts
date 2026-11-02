import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { CreateDoctorInput } from './dto/create-doctor.input';
import { UpdateDoctorInput } from './dto/update-doctor.input';
import { PaginationArgs } from '../common/dto/pagination.args';
import { DoctorPagination } from './entities/doctor-pagination.entity';
import { Doctor } from './entities/doctor.entity';

@Injectable()
export class DoctorService {
  private readonly logger = new Logger(DoctorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  async createDoctor(input: CreateDoctorInput): Promise<Doctor> {
    const doctor = await this.prisma.doctor.create({
      data: {
        name: input.name.trim(),
      },
    });

    await this.cache.del('doctors:*');
    return doctor;
  }

  async updateDoctor(input: UpdateDoctorInput): Promise<Doctor> {
    const existing = await this.prisma.doctor.findUnique({
      where: { id: input.id },
    });

    if (!existing) {
      throw new NotFoundException(`Doctor with ID '${input.id}' not found`);
    }

    const updated = await this.prisma.doctor.update({
      where: { id: input.id },
      data: {
        name: input.name.trim(),
      },
    });

    await this.cache.del('doctors:*');
    await this.cache.del('schedules:*');
    return updated;
  }

  async doctors(pagination: PaginationArgs): Promise<DoctorPagination> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const skip = (page - 1) * limit;

    const cacheKey = `doctors:page:${page}:limit:${limit}`;
    const cached = await this.cache.get<DoctorPagination>(cacheKey);
    if (cached) {
      return cached;
    }

    const [total, items] = await Promise.all([
      this.prisma.doctor.count(),
      this.prisma.doctor.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const result: DoctorPagination = {
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

  async doctor(id: string): Promise<Doctor> {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID '${id}' not found`);
    }

    return doctor;
  }

  async deleteDoctor(id: string): Promise<Doctor> {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      include: {
        schedules: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID '${id}' not found`);
    }

    if (doctor.schedules && doctor.schedules.length > 0) {
      throw new BadRequestException(
        `Cannot delete doctor with ID '${id}' because active schedules are linked to this doctor. Cancel the schedules first.`,
      );
    }

    const deleted = await this.prisma.doctor.delete({
      where: { id },
    });

    await this.cache.del('doctors:*');
    await this.cache.del('schedules:*');
    return deleted;
  }
}

