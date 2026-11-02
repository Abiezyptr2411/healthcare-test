import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ScheduleService } from './schedule.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { NotificationService } from '../notification/notification.service';

describe('ScheduleService', () => {
  let service: ScheduleService;
  let prisma: PrismaService;
  let cache: RedisCacheService;
  let notificationService: NotificationService;

  const mockCustomer = {
    id: 'cust-uuid-1',
    name: 'Alice Patient',
    email: 'alice@example.com',
  };

  const mockDoctor = {
    id: 'doc-uuid-1',
    name: 'Dr. Gregory House',
  };

  const scheduledDate = new Date('2026-12-01T10:00:00.000Z');

  const mockSchedule = {
    id: 'sched-uuid-1',
    objective: 'Cardiology general checkup',
    customerId: 'cust-uuid-1',
    doctorId: 'doc-uuid-1',
    scheduledAt: scheduledDate,
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: mockCustomer,
    doctor: mockDoctor,
  };

  const mockPrismaService = {
    customer: {
      findUnique: jest.fn(),
    },
    doctor: {
      findUnique: jest.fn(),
    },
    schedule: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
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

  const mockNotificationService = {
    sendScheduleCreated: jest.fn(),
    sendScheduleDeleted: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisCacheService, useValue: mockCacheService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<ScheduleService>(ScheduleService);
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<RedisCacheService>(RedisCacheService);
    notificationService = module.get<NotificationService>(NotificationService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSchedule', () => {
    const input = {
      objective: 'Cardiology general checkup',
      customerId: 'cust-uuid-1',
      doctorId: 'doc-uuid-1',
      scheduledAt: scheduledDate,
    };

    it('should successfully create schedule and enqueue notification', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      mockPrismaService.doctor.findUnique.mockResolvedValue(mockDoctor);
      mockPrismaService.schedule.findFirst.mockResolvedValue(null);
      mockPrismaService.schedule.create.mockResolvedValue(mockSchedule);

      const result = await service.createSchedule(input);

      expect(result).toEqual(mockSchedule);
      expect(mockCacheService.del).toHaveBeenCalledWith('schedules:*');
      expect(mockNotificationService.sendScheduleCreated).toHaveBeenCalledWith({
        customerEmail: mockCustomer.email,
        customerName: mockCustomer.name,
        doctorName: mockDoctor.name,
        objective: mockSchedule.objective,
        scheduledAt: mockSchedule.scheduledAt.toISOString(),
        scheduleId: mockSchedule.id,
      });
    });

    it('should throw NotFoundException if customer does not exist', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);

      await expect(service.createSchedule(input)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if doctor does not exist', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      mockPrismaService.doctor.findUnique.mockResolvedValue(null);

      await expect(service.createSchedule(input)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if doctor already booked at scheduled time', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      mockPrismaService.doctor.findUnique.mockResolvedValue(mockDoctor);
      mockPrismaService.schedule.findFirst.mockResolvedValue(mockSchedule);

      await expect(service.createSchedule(input)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should handle unique constraint collision (P2002) as ConflictException', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      mockPrismaService.doctor.findUnique.mockResolvedValue(mockDoctor);
      mockPrismaService.schedule.findFirst.mockResolvedValue(null);

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.14.0' },
      );
      mockPrismaService.schedule.create.mockRejectedValue(p2002Error);

      await expect(service.createSchedule(input)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('schedules', () => {
    it('should return cached schedules if present', async () => {
      const cached = {
        items: [mockSchedule],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockCacheService.get.mockResolvedValue(cached);

      const result = await service.schedules({}, { page: 1, limit: 10 });
      expect(result).toEqual(cached);
      expect(mockPrismaService.schedule.findMany).not.toHaveBeenCalled();
    });

    it('should fetch and cache schedules when cache miss', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.schedule.count.mockResolvedValue(1);
      mockPrismaService.schedule.findMany.mockResolvedValue([mockSchedule]);

      const result = await service.schedules(
        { doctorId: 'doc-uuid-1', dateFrom: new Date('2026-01-01') },
        { page: 1, limit: 10 },
      );

      expect(result.items).toEqual([mockSchedule]);
      expect(result.meta.total).toBe(1);
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe('schedule', () => {
    it('should return schedule by ID', async () => {
      mockPrismaService.schedule.findUnique.mockResolvedValue(mockSchedule);
      const result = await service.schedule('sched-uuid-1');
      expect(result).toEqual(mockSchedule);
    });

    it('should throw NotFoundException if schedule not found', async () => {
      mockPrismaService.schedule.findUnique.mockResolvedValue(null);
      await expect(service.schedule('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteSchedule', () => {
    it('should delete schedule and dispatch cancellation email', async () => {
      mockPrismaService.schedule.findUnique.mockResolvedValue(mockSchedule);
      mockPrismaService.schedule.delete.mockResolvedValue(mockSchedule);

      const result = await service.deleteSchedule('sched-uuid-1');

      expect(result.id).toBe(mockSchedule.id);
      expect(mockCacheService.del).toHaveBeenCalledWith('schedules:*');
      expect(mockNotificationService.sendScheduleDeleted).toHaveBeenCalledWith({
        customerEmail: mockCustomer.email,
        customerName: mockCustomer.name,
        doctorName: mockDoctor.name,
        objective: mockSchedule.objective,
        scheduledAt: mockSchedule.scheduledAt.toISOString(),
        scheduleId: mockSchedule.id,
      });
    });

    it('should throw NotFoundException if schedule does not exist', async () => {
      mockPrismaService.schedule.findUnique.mockResolvedValue(null);
      await expect(service.deleteSchedule('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

