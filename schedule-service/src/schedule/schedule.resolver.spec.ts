import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleResolver } from './schedule.resolver';
import { ScheduleService } from './schedule.service';

describe('ScheduleResolver', () => {
  let resolver: ScheduleResolver;
  let service: ScheduleService;

  const mockSchedule = {
    id: 'sched-1',
    objective: 'Dental cleaning',
    customerId: 'cust-1',
    doctorId: 'doc-1',
    scheduledAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockScheduleService = {
    createSchedule: jest.fn(),
    schedules: jest.fn(),
    schedule: jest.fn(),
    deleteSchedule: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleResolver,
        { provide: ScheduleService, useValue: mockScheduleService },
      ],
    }).compile();

    resolver = module.get<ScheduleResolver>(ScheduleResolver);
    service = module.get<ScheduleService>(ScheduleService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should call createSchedule', async () => {
    mockScheduleService.createSchedule.mockResolvedValue(mockSchedule);
    const input = {
      objective: 'Dental cleaning',
      customerId: 'cust-1',
      doctorId: 'doc-1',
      scheduledAt: new Date(),
    };
    const res = await resolver.createSchedule(input);
    expect(mockScheduleService.createSchedule).toHaveBeenCalledWith(input);
    expect(res).toEqual(mockSchedule);
  });

  it('should call schedules', async () => {
    const mockPagination = {
      items: [mockSchedule],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    };
    mockScheduleService.schedules.mockResolvedValue(mockPagination);
    const res = await resolver.schedules({}, { page: 1, limit: 10 });
    expect(mockScheduleService.schedules).toHaveBeenCalledWith({}, { page: 1, limit: 10 });
    expect(res).toEqual(mockPagination);
  });

  it('should call schedule', async () => {
    mockScheduleService.schedule.mockResolvedValue(mockSchedule);
    const res = await resolver.schedule('sched-1');
    expect(mockScheduleService.schedule).toHaveBeenCalledWith('sched-1');
    expect(res).toEqual(mockSchedule);
  });

  it('should call deleteSchedule', async () => {
    mockScheduleService.deleteSchedule.mockResolvedValue(mockSchedule);
    const res = await resolver.deleteSchedule('sched-1');
    expect(mockScheduleService.deleteSchedule).toHaveBeenCalledWith('sched-1');
    expect(res).toEqual(mockSchedule);
  });
});

