import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { CreateCustomerInput } from './dto/create-customer.input';
import { UpdateCustomerInput } from './dto/update-customer.input';
import { PaginationArgs } from '../common/dto/pagination.args';
import { CustomerPagination } from './entities/customer-pagination.entity';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    const existing = await this.prisma.customer.findUnique({
      where: { email: input.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException(
        `Customer with email '${input.email}' already exists`,
      );
    }

    const customer = await this.prisma.customer.create({
      data: {
        name: input.name.trim(),
        email: input.email.toLowerCase().trim(),
      },
    });

    await this.cache.del('customers:*');
    return customer;
  }

  async updateCustomer(input: UpdateCustomerInput): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.id },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID '${input.id}' not found`);
    }

    if (input.email && input.email.toLowerCase().trim() !== customer.email) {
      const emailTaken = await this.prisma.customer.findUnique({
        where: { email: input.email.toLowerCase().trim() },
      });
      if (emailTaken) {
        throw new ConflictException(
          `Email '${input.email}' is already in use by another customer`,
        );
      }
    }

    const updated = await this.prisma.customer.update({
      where: { id: input.id },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        email: input.email !== undefined ? input.email.toLowerCase().trim() : undefined,
      },
    });

    await this.cache.del('customers:*');
    await this.cache.del('schedules:*');
    return updated;
  }

  async customers(pagination: PaginationArgs): Promise<CustomerPagination> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const skip = (page - 1) * limit;

    const cacheKey = `customers:page:${page}:limit:${limit}`;
    const cached = await this.cache.get<CustomerPagination>(cacheKey);
    if (cached) {
      return cached;
    }

    const [total, items] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customer.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const result: CustomerPagination = {
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

  async customer(id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID '${id}' not found`);
    }

    return customer;
  }

  async deleteCustomer(id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        schedules: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID '${id}' not found`);
    }

    if (customer.schedules && customer.schedules.length > 0) {
      throw new BadRequestException(
        `Cannot delete customer with ID '${id}' because active schedules are linked to this customer. Cancel the schedules first.`,
      );
    }

    const deleted = await this.prisma.customer.delete({
      where: { id },
    });

    await this.cache.del('customers:*');
    await this.cache.del('schedules:*');
    return deleted;
  }
}

