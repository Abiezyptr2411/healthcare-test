import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../cache/redis-cache.service';

describe('DoctorService', () => {
  let service: DoctorService;
  let prisma: PrismaService;
  let cache: RedisCacheService;

  const mockDoctor = {
    id: 'doc-uuid-1',
    name: 'Dr. Gregory House',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    doctor: {
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
        DoctorService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisCacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<DoctorService>(DoctorService);
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<RedisCacheService>(RedisCacheService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDoctor', () => {
    it('should create a doctor successfully', async () => {
      mockPrismaService.doctor.create.mockResolvedValue(mockDoctor);

      const result = await service.createDoctor({ name: 'Dr. Gregory House' });
      expect(result).toEqual(mockDoctor);
      expect(mockCacheService.del).toHaveBeenCalledWith('doctors:*');
    });
  });

  describe('updateDoctor', () => {
    it('should update doctor details', async () => {
      mockPrismaService.doctor.findUnique.mockResolvedValue(mockDoctor);
      mockPrismaService.doctor.update.mockResolvedValue({
        ...mockDoctor,
        name: 'Dr. Gregory House, M.D.',
      });

      const result = await service.updateDoctor({
        id: 'doc-uuid-1',
        name: 'Dr. Gregory House, M.D.',
      });

      expect(result.name).toBe('Dr. Gregory House, M.D.');
      expect(mockCacheService.del).toHaveBeenCalledWith('doctors:*');
    });

    it('should throw NotFoundException if doctor does not exist', async () => {
      mockPrismaService.doctor.findUnique.mockResolvedValue(null);

      await expect(
        service.updateDoctor({
          id: 'non-existent',
          name: 'Dr. Who',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('doctors', () => {
    it('should return cached doctors if available', async () => {
      const cached = {
        items: [mockDoctor],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockCacheService.get.mockResolvedValue(cached);

      const result = await service.doctors({ page: 1, limit: 10 });
      expect(result).toEqual(cached);
      expect(mockPrismaService.doctor.findMany).not.toHaveBeenCalled();
    });

    it('should fetch from DB and cache if cache miss', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.doctor.count.mockResolvedValue(1);
      mockPrismaService.doctor.findMany.mockResolvedValue([mockDoctor]);

      const result = await service.doctors({ page: 1, limit: 10 });
      expect(result.items).toEqual([mockDoctor]);
      expect(result.meta.total).toBe(1);
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe('doctor', () => {
    it('should return doctor by ID', async () => {
      mockPrismaService.doctor.findUnique.mockResolvedValue(mockDoctor);
      const result = await service.doctor('doc-uuid-1');
      expect(result).toEqual(mockDoctor);
    });

    it('should throw NotFoundException if doctor not found', async () => {
      mockPrismaService.doctor.findUnique.mockResolvedValue(null);
      await expect(service.doctor('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteDoctor', () => {
    it('should delete doctor if no active schedules exist', async () => {
      mockPrismaService.doctor.findUnique.mockResolvedValue({
        ...mockDoctor,
        schedules: [],
      });
      mockPrismaService.doctor.delete.mockResolvedValue(mockDoctor);

      const result = await service.deleteDoctor('doc-uuid-1');
      expect(result).toEqual(mockDoctor);
      expect(mockCacheService.del).toHaveBeenCalledWith('doctors:*');
    });

    it('should throw BadRequestException if doctor has active schedules', async () => {
      mockPrismaService.doctor.findUnique.mockResolvedValue({
        ...mockDoctor,
        schedules: [{ id: 'sched-1' }],
      });

      await expect(service.deleteDoctor('doc-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if doctor does not exist', async () => {
      mockPrismaService.doctor.findUnique.mockResolvedValue(null);
      await expect(service.deleteDoctor('unknown')).rejects.toThrow(NotFoundException);
    });
  });
});

