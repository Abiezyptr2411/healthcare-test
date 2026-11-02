import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../cache/redis-cache.service';

describe('CustomerService', () => {
  let service: CustomerService;
  let prisma: PrismaService;
  let cache: RedisCacheService;

  const mockCustomer = {
    id: 'cust-uuid-1',
    name: 'Alice Patient',
    email: 'alice@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    customer: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisCacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<RedisCacheService>(RedisCacheService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCustomer', () => {
    it('should successfully create customer when email is unique', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);
      mockPrismaService.customer.create.mockResolvedValue(mockCustomer);

      const result = await service.createCustomer({
        name: 'Alice Patient',
        email: 'alice@example.com',
      });

      expect(result).toEqual(mockCustomer);
      expect(mockCacheService.del).toHaveBeenCalledWith('customers:*');
    });

    it('should throw ConflictException when email is taken', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomer);

      await expect(
        service.createCustomer({
          name: 'Alice Patient',
          email: 'alice@example.com',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateCustomer', () => {
    it('should update customer data', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValueOnce(mockCustomer);
      mockPrismaService.customer.update.mockResolvedValue({
        ...mockCustomer,
        name: 'Alice Updated',
      });

      const result = await service.updateCustomer({
        id: 'cust-uuid-1',
        name: 'Alice Updated',
      });

      expect(result.name).toBe('Alice Updated');
      expect(mockCacheService.del).toHaveBeenCalledWith('customers:*');
    });

    it('should throw NotFoundException if customer not found', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCustomer({
          id: 'non-existent',
          name: 'Bob',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if new email is taken by another customer', async () => {
      mockPrismaService.customer.findUnique
        .mockResolvedValueOnce(mockCustomer)
        .mockResolvedValueOnce({ id: 'cust-uuid-2', email: 'taken@example.com' });

      await expect(
        service.updateCustomer({
          id: 'cust-uuid-1',
          email: 'taken@example.com',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('customers', () => {
    it('should return cached customers if available', async () => {
      const cached = {
        items: [mockCustomer],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockCacheService.get.mockResolvedValue(cached);

      const result = await service.customers({ page: 1, limit: 10 });
      expect(result).toEqual(cached);
      expect(mockPrismaService.customer.findMany).not.toHaveBeenCalled();
    });

    it('should fetch from DB and cache if not in cache', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.customer.count.mockResolvedValue(1);
      mockPrismaService.customer.findMany.mockResolvedValue([mockCustomer]);

      const result = await service.customers({ page: 1, limit: 10 });
      expect(result.items).toEqual([mockCustomer]);
      expect(result.meta.total).toBe(1);
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe('customer', () => {
    it('should return single customer by ID', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      const result = await service.customer('cust-uuid-1');
      expect(result).toEqual(mockCustomer);
    });

    it('should throw NotFoundException if customer not found', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);
      await expect(service.customer('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCustomer', () => {
    it('should delete customer if no active schedules exist', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue({
        ...mockCustomer,
        schedules: [],
      });
      mockPrismaService.customer.delete.mockResolvedValue(mockCustomer);

      const result = await service.deleteCustomer('cust-uuid-1');
      expect(result).toEqual(mockCustomer);
      expect(mockCacheService.del).toHaveBeenCalledWith('customers:*');
    });

    it('should throw BadRequestException if customer has active schedules', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue({
        ...mockCustomer,
        schedules: [{ id: 'sched-1' }],
      });

      await expect(service.deleteCustomer('cust-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if customer to delete does not exist', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);
      await expect(service.deleteCustomer('unknown')).rejects.toThrow(NotFoundException);
    });
  });
});

