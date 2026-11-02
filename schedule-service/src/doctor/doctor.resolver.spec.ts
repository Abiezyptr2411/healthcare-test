import { Test, TestingModule } from '@nestjs/testing';
import { DoctorResolver } from './doctor.resolver';
import { DoctorService } from './doctor.service';

describe('DoctorResolver', () => {
  let resolver: DoctorResolver;
  let service: DoctorService;

  const mockDoctor = {
    id: 'doc-1',
    name: 'Dr. John Watson',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDoctorService = {
    createDoctor: jest.fn(),
    updateDoctor: jest.fn(),
    doctors: jest.fn(),
    doctor: jest.fn(),
    deleteDoctor: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoctorResolver,
        { provide: DoctorService, useValue: mockDoctorService },
      ],
    }).compile();

    resolver = module.get<DoctorResolver>(DoctorResolver);
    service = module.get<DoctorService>(DoctorService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should call createDoctor', async () => {
    mockDoctorService.createDoctor.mockResolvedValue(mockDoctor);
    const input = { name: 'Dr. John Watson' };
    const res = await resolver.createDoctor(input);
    expect(mockDoctorService.createDoctor).toHaveBeenCalledWith(input);
    expect(res).toEqual(mockDoctor);
  });

  it('should call updateDoctor', async () => {
    mockDoctorService.updateDoctor.mockResolvedValue(mockDoctor);
    const input = { id: 'doc-1', name: 'Dr. John Watson Updated' };
    const res = await resolver.updateDoctor(input);
    expect(mockDoctorService.updateDoctor).toHaveBeenCalledWith(input);
    expect(res).toEqual(mockDoctor);
  });

  it('should call doctors', async () => {
    const mockPagination = {
      items: [mockDoctor],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    };
    mockDoctorService.doctors.mockResolvedValue(mockPagination);
    const res = await resolver.doctors({ page: 1, limit: 10 });
    expect(mockDoctorService.doctors).toHaveBeenCalledWith({ page: 1, limit: 10 });
    expect(res).toEqual(mockPagination);
  });

  it('should call doctor', async () => {
    mockDoctorService.doctor.mockResolvedValue(mockDoctor);
    const res = await resolver.doctor('doc-1');
    expect(mockDoctorService.doctor).toHaveBeenCalledWith('doc-1');
    expect(res).toEqual(mockDoctor);
  });

  it('should call deleteDoctor', async () => {
    mockDoctorService.deleteDoctor.mockResolvedValue(mockDoctor);
    const res = await resolver.deleteDoctor('doc-1');
    expect(mockDoctorService.deleteDoctor).toHaveBeenCalledWith('doc-1');
    expect(res).toEqual(mockDoctor);
  });
});

